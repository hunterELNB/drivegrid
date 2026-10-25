import type { DERAsset } from './domain.ts';
import type { CommercialSettings } from './settlement.ts';
import type { DemoState, DispatchInterval } from './simulation.ts';
import { INITIAL_TIME, simulationTimestamp } from './simulation.ts';
import { aggregateSettlement, settleHistory } from './settlement.ts';
import { economicSummary } from './economics.ts';
import { assetMonitoring, eventTimeline, operationsMetrics } from './operations.ts';
import { assetTypes } from './domain.ts';

export type AnalyticsMode='all'|'day'|'last4h'|'custom';
export interface AnalyticsFilter {mode:AnalyticsMode;startStep:number;endStep:number}
export const DEFAULT_ANALYTICS_FILTER:Readonly<AnalyticsFilter>={mode:'all',startStep:0,endStep:96};
const clockLabel=(step:number)=>step===96?'24:00':`${String(Math.floor(step/4)).padStart(2,'0')}:${String(step%4*15).padStart(2,'0')}`;
export function analyticsRange(filter:AnalyticsFilter,step:number){
  if(!['all','day','last4h','custom'].includes(filter.mode))throw new Error('Unknown analytics time filter.');
  if(filter.mode==='custom'&&(!Number.isInteger(filter.startStep)||!Number.isInteger(filter.endStep)||filter.startStep<0||filter.endStep>96||filter.startStep>=filter.endStep))throw new Error('Choose a custom start earlier than end, within the 96-interval simulation day.');
  if(!Number.isInteger(step)||step<0||step>96)throw new Error('Invalid simulation clock.');
  const start=filter.mode==='all'?null:filter.mode==='custom'?filter.startStep:filter.mode==='last4h'?Math.max(0,step-16):0;
  const end=filter.mode==='all'?null:filter.mode==='custom'?filter.endStep:filter.mode==='last4h'?step:96;
  return {mode:filter.mode,startTimestamp:start===null?null:simulationTimestamp(start),endTimestamp:end===null?null:simulationTimestamp(end),
    label:filter.mode==='all'?'All recorded intervals':filter.mode==='day'?'Simulation day · 23 Oct 2026':filter.mode==='last4h'?`Last 4 simulated hours · ${clockLabel(start!)}–${clockLabel(end!)} CT`:`Custom · 23 Oct 2026 ${clockLabel(start!)}–${clockLabel(end!)} CT`,
    token:filter.mode==='custom'?`custom-${start}-${end}`:filter.mode};
}
export type AnalyticsRange=ReturnType<typeof analyticsRange>;
export function inAnalyticsRange(timestamp:string,range:AnalyticsRange):boolean {
  const value=Date.parse(timestamp);
  return Number.isFinite(value)&&(range.startTimestamp===null||value>=Date.parse(range.startTimestamp))&&(range.endTimestamp===null||value<Date.parse(range.endTimestamp));
}
export function filteredAnalyticsHistory(history:readonly DispatchInterval[],range:AnalyticsRange){
  return history.filter(i=>inAnalyticsRange(i.timestamp,range)).toSorted((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
/** Read-only projection: no reducer, fabricated intervals, terminal mark or extra settlement policy. */
export function buildAnalytics(state:DemoState,filter:AnalyticsFilter=DEFAULT_ANALYTICS_FILTER){
  const range=analyticsRange(filter,state.step);
  const history=filteredAnalyticsHistory(state.history,range);
  return analyticsSnapshot(state,range,analyticsRecords(state.assets,history,state.commercialSettings));
}
export function analyticsRecords(fleet:readonly DERAsset[],history:readonly DispatchInterval[],commercial:CommercialSettings){
  const ledger=settleHistory(history,fleet,commercial);
  const economics=economicSummary(history);
  const byAsset=new Map(fleet.map(asset=>[asset.id,{asset,
    importedMWh:0,exportedMWh:0,batteryEnergyDeltaMWh:0,lossMWh:0,dispatchCount:0,totals:aggregateSettlement([])}]));
  for(const interval of history)for(const record of interval.records){
    const row=byAsset.get(record.assetId);
    if(!row)throw new Error('Unknown analytics asset.');
    row.importedMWh+=Math.max(0,-record.acEnergyMWh);row.exportedMWh+=Math.max(0,record.acEnergyMWh);
    row.batteryEnergyDeltaMWh+=record.batteryEnergyDeltaMWh;row.lossMWh+=record.lossMWh;row.dispatchCount++;
  }
  for(const row of ledger.rows){const entry=byAsset.get(row.assetId)!;entry.totals=aggregateSettlement([entry.totals,row]);}
  const assets=Array.from(byAsset.values());
  const intervalTotals=new Map(ledger.intervals.map(i=>[i.timestamp,i]));
  const trends=history.map(interval=>({interval,...intervalTotals.get(interval.timestamp)!}));
  const requestedMWh=history.reduce((sum,i)=>sum+i.requestedEnergyMWh,0),acceptedMWh=history.reduce((sum,i)=>sum+i.acceptedEnergyMWh,0);
  const outcomes={accepted:0,curtailed:0,rejected:0},commands={charge:0,discharge:0,idle:0};
  for(const interval of history){outcomes[interval.status]++;commands[interval.request.command]++;}
  const energy={importedMWh:economics.importedMWh,exportedMWh:economics.exportedMWh,netGridMWh:economics.exportedMWh-economics.importedMWh,
    batteryEnergyDeltaMWh:history.reduce((sum,i)=>sum+i.batteryEnergyDeltaMWh,0),lossMWh:history.reduce((sum,i)=>sum+i.lossMWh,0),
    requestedMWh,acceptedMWh,acceptancePct:requestedMWh===0?null:acceptedMWh/requestedMWh*100,
    curtailedMWh:history.reduce((sum,i)=>sum+i.curtailedEnergyMWh,0),rejectedMWh:history.reduce((sum,i)=>sum+i.rejectedEnergyMWh,0),
    peakRequestedMW:Math.max(0,...history.map(i=>i.requestedPowerMW)),peakAcceptedMW:Math.max(0,...history.map(i=>i.acceptedPowerMW))};
  const typePerformance=assetTypes.map(type=>{const rows=assets.filter(row=>row.asset.type===type.value);return {...type,count:rows.length,
    importedMWh:rows.reduce((sum,r)=>sum+r.importedMWh,0),exportedMWh:rows.reduce((sum,r)=>sum+r.exportedMWh,0),totals:aggregateSettlement(rows.map(r=>r.totals))};});
  return {history,ledger,economics,assets,trends,energy,outcomes,commands,typePerformance,assetRecordCount:history.reduce((sum,i)=>sum+i.records.length,0)};
}
export function analyticsSnapshot(state:DemoState,range:AnalyticsRange,records:ReturnType<typeof analyticsRecords>){
  const snapshot={assets:state.assets,history:state.history,step:state.step,timestamp:simulationTimestamp(state.step)};
  const assets=records.assets.map(row=>({...row,monitor:assetMonitoring(row.asset,state.operations,snapshot)}));
  return {...records,range,assets,alerts:state.operations.alerts.filter(a=>inAnalyticsRange(a.createdAt,range)),events:eventTimeline(state.operations.events).filter(e=>inAnalyticsRange(e.timestamp,range)),
    snapshotAt:snapshot.timestamp,simulationDay:INITIAL_TIME,commercial:{...state.commercialSettings},
    operations:{...operationsMetrics(snapshot,state.operations),warning:assets.filter(a=>a.monitor.health==='warning').length,fault:assets.filter(a=>a.monitor.health==='fault').length,
      alertCounts:{open:state.operations.alerts.filter(a=>a.status==='open').length,acknowledged:state.operations.alerts.filter(a=>a.status==='acknowledged').length,resolved:state.operations.alerts.filter(a=>a.status==='resolved').length}}};
}
export type AnalyticsModel=ReturnType<typeof buildAnalytics>;
export type AssetPerformance=AnalyticsModel['assets'][number];
export type PerformanceSort='id'|'net'|'gross'|'owner'|'exported'|'imported'|'dispatches'|'soc';
export interface AssetPerformanceFilter {search:string;type:string;sort:PerformanceSort;direction:'asc'|'desc'}
export const DEFAULT_PERFORMANCE_FILTER:AssetPerformanceFilter={search:'',type:'all',sort:'net',direction:'desc'};
export function assetPerformanceRows(rows:readonly AssetPerformance[],filter:AssetPerformanceFilter){
  const value=(row:AssetPerformance)=>filter.sort==='net'?row.totals.netCents:filter.sort==='gross'?row.totals.grossCents:filter.sort==='owner'?row.totals.ownerCents:filter.sort==='exported'?row.exportedMWh:filter.sort==='imported'?row.importedMWh:filter.sort==='dispatches'?row.dispatchCount:row.asset.socPct;
  return rows.filter(row=>(filter.type==='all'||row.asset.type===filter.type)&&row.asset.id.toLowerCase().includes(filter.search.trim().toLowerCase()))
    .toSorted((a,b)=>{const compared=filter.sort==='id'?a.asset.id.localeCompare(b.asset.id):value(a)-value(b);return (filter.direction==='asc'?compared:-compared)||a.asset.id.localeCompare(b.asset.id);});
}
