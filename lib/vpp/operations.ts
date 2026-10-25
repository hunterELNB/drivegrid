import type { DERAsset } from './domain.ts';
import { dispatchLimit } from './dispatch.ts';
import type { DispatchInterval } from './simulation.ts';
import { formatNumber, formatPower } from './units.ts';

export type EquipmentHealth='healthy'|'warning'|'fault';
export type AlertSeverity='info'|'warning'|'critical';
export type AlertStatus='open'|'acknowledged'|'resolved';
export type EventType='asset-change'|'connectivity'|'health'|'dispatch'|'alert-created'|'alert-acknowledged'|'alert-resolved'|'clock'|'reset';
export interface OperationsSnapshot {assets:readonly DERAsset[];history:readonly DispatchInterval[];step:number;timestamp:string}
export interface AlertCondition {key:string;source:string;assetId:string|null;severity:AlertSeverity;description:string;kind:'condition'|'dispatch';active:boolean}
export interface OperationsAlert extends AlertCondition {id:string;episode:number;status:AlertStatus;createdAt:string;updatedAt:string;acknowledgedAt?:string;resolvedAt?:string;resolution?:string}
export interface OperationsEvent {id:string;sequence:number;timestamp:string;type:EventType;source:string;description:string;alertId?:string}
export interface OperationsState {
  healthOverrides:Readonly<Record<string,EquipmentHealth>>;
  offlineTelemetryAt:Readonly<Record<string,string>>;
  alerts:readonly OperationsAlert[];events:readonly OperationsEvent[];
  sequence:number;generation:number;message:string;
}
export type OperationsAction=
  |{type:'operations-connectivity';assetId:string;online:boolean}
  |{type:'operations-health';assetId:string;health:EquipmentHealth}
  |{type:'operations-acknowledge';alertId:string}
  |{type:'operations-resolve';alertId:string}
  |{type:'operations-reset'};

/** Stable seed from the existing asset identity, independent of wall time or randomness. */
export function assetSeed(id:string):number {
  let value=0;
  for(const letter of id)value=(value*31+letter.charCodeAt(0))>>>0;
  return value;
}
export function healthFixture(asset:DERAsset):EquipmentHealth {
  const seed=assetSeed(asset.id);
  return seed%389===0?'fault':seed%113===0?'warning':'healthy';
}
export function assetMonitoring(asset:DERAsset,operations:OperationsState,snapshot:OperationsSnapshot) {
  const seed=assetSeed(asset.id);
  const online=asset.status!=='offline';
  const health=operations.healthOverrides[asset.id]??healthFixture(asset);
  const lagMinutes=online?(seed%53===0?45:seed%2*15):(4+seed%4)*15;
  const lastTelemetryAt=online
    ?new Date(Date.parse(snapshot.timestamp)-lagMinutes*60_000).toISOString()
    :operations.offlineTelemetryAt[asset.id]??new Date(Date.parse(snapshot.timestamp)-lagMinutes*60_000).toISOString();
  const telemetryAgeMinutes=(Date.parse(snapshot.timestamp)-Date.parse(lastTelemetryAt))/60_000;
  const chargingPowerMW=dispatchLimit(asset,'charge').powerMW;
  const dischargingPowerMW=dispatchLimit(asset,'discharge').powerMW;
  const stale=telemetryAgeMinutes>30;
  return {asset,online,health,lastTelemetryAt,telemetryAgeMinutes,stale,chargingPowerMW,dischargingPowerMW,
    dispatchAvailable:dischargingPowerMW>0,
    operationallyReady:online&&health!=='fault'&&!stale&&(chargingPowerMW>0||dischargingPowerMW>0)};
}
export const dispatchConditionKey=(interval:DispatchInterval):string=>`dispatch:${interval.timestamp}:${interval.request.assetId??'fleet'}`;
export function deriveAlertConditions(snapshot:OperationsSnapshot,operations:OperationsState):AlertCondition[] {
  const conditions:AlertCondition[]=[];
  for(const asset of snapshot.assets){
    const monitor=assetMonitoring(asset,operations,snapshot);
    const add=(suffix:string,severity:AlertSeverity,description:string)=>conditions.push({key:`asset:${asset.id}:${suffix}`,source:asset.id,assetId:asset.id,severity,description,kind:'condition',active:true});
    if(!monitor.online)add('offline','warning','Simulated connectivity offline. Core offline status blocks charge and discharge.');
    if(asset.availability==='unavailable')add('unavailable','info','Core asset availability is unavailable. Acknowledgment does not change dispatch eligibility.');
    if(asset.socPct<25)add('soc-low','warning',`SOC ${formatNumber(asset.socPct)}% is below the 25% operational threshold. Physical SOC limits remain unchanged.`);
    if(monitor.health==='fault')add('fault','critical','Simulated equipment fault annotation. Health monitoring is not an additional dispatch interlock.');
    if(monitor.health==='warning')add('health-warning','warning','Simulated equipment health warning; inspect the monitoring annotation.');
    if(monitor.stale)add('telemetry-stale','warning','Simulated telemetry is older than 30 minutes; no real device connection is used.');
  }
  for(const interval of snapshot.history){
    if(interval.status==='accepted')continue;
    conditions.push({key:dispatchConditionKey(interval),source:interval.request.assetId??'Fleet dispatch',assetId:interval.request.assetId,
      severity:interval.status==='rejected'?'warning':'info',kind:'dispatch',active:false,
      description:`Historical ${interval.request.command} request ${interval.status}: ${formatPower(interval.rejectedPowerMW,'fleet')} rejected, ${formatPower(interval.curtailedPowerMW,'fleet')} curtailed. Closing this alert does not alter execution.`});
  }
  return conditions;
}
function appendEvent(state:OperationsState,timestamp:string,type:EventType,source:string,description:string,alertId?:string):OperationsState {
  const sequence=state.sequence+1;
  const event:OperationsEvent={id:`ops-${state.generation}-${sequence}`,sequence,timestamp,type,source,description,...(alertId?{alertId}:{})};
  return {...state,sequence,events:[...state.events,event]};
}
/** Persistent conditions keep one episode until cleared. Historical dispatch alerts close once. */
export function reconcileAlerts(state:OperationsState,snapshot:OperationsSnapshot):OperationsState {
  let next=state;
  const desired=deriveAlertConditions(snapshot,state);
  const byKey=new Map<string,OperationsAlert>();
  for(const alert of state.alerts)byKey.set(alert.key,alert);
  const present=new Set(desired.map(condition=>condition.key));
  const alerts=state.alerts.map(alert=>{
    if(alert.kind==='condition'&&alert.status!=='resolved'&&!present.has(alert.key)){
      next=appendEvent(next,snapshot.timestamp,'alert-resolved',alert.source,'Condition cleared; alert automatically resolved.',alert.id);
      return {...alert,active:false,status:'resolved' as const,resolvedAt:snapshot.timestamp,updatedAt:snapshot.timestamp,resolution:'Underlying condition cleared'};
    }
    return alert;
  });
  for(const condition of desired){
    const previous=byKey.get(condition.key);
    if(previous&&(previous.status!=='resolved'||condition.kind==='dispatch'))continue;
    const episode=(previous?.episode??0)+1;
    const alert:OperationsAlert={...condition,id:`ops-${state.generation}:${condition.key}:episode-${episode}`,episode,status:'open',createdAt:snapshot.timestamp,updatedAt:snapshot.timestamp};
    alerts.push(alert);
    next=appendEvent(next,snapshot.timestamp,'alert-created',condition.source,condition.description,alert.id);
  }
  return {...next,alerts};
}
export function createOperationsState(snapshot:OperationsSnapshot,generation=0):OperationsState {
  const offlineTelemetryAt=Object.fromEntries(snapshot.assets.filter(a=>a.status==='offline').map(a=>[a.id,new Date(Date.parse(snapshot.timestamp)-(4+assetSeed(a.id)%4)*15*60_000).toISOString()]));
  const state:OperationsState={healthOverrides:{},offlineTelemetryAt,alerts:[],events:[],sequence:0,generation,message:''};
  return reconcileAlerts(appendEvent(state,snapshot.timestamp,'reset','Operations','Monitoring fixtures initialized. Core assets, dispatch history and finances are not changed.'),snapshot);
}
export function operationsReducer(state:OperationsState,action:OperationsAction,snapshot:OperationsSnapshot):OperationsState {
  if(action.type==='operations-reset')return {...createOperationsState(snapshot,state.generation+1),message:'Operations Reset restored monitoring fixtures and alert lifecycle. Core assets, clock, history and finances were preserved.'};
  if(action.type==='operations-health'){
    if(!snapshot.assets.some(a=>a.id===action.assetId)||!['healthy','warning','fault'].includes(action.health))return state;
    const asset=snapshot.assets.find(a=>a.id===action.assetId)!;
    if(assetMonitoring(asset,state,snapshot).health===action.health)return state;
    const next={...state,healthOverrides:{...state.healthOverrides,[action.assetId]:action.health},message:'Health annotation updated only. Core dispatch eligibility, SOC and settlement are unchanged.'};
    return reconcileAlerts(appendEvent(next,snapshot.timestamp,'health',action.assetId,`Simulated health set to ${action.health}. Monitoring only; no dispatch interlock changed.`),snapshot);
  }
  if(action.type==='operations-acknowledge'||action.type==='operations-resolve'){
    const alert=state.alerts.find(a=>a.id===action.alertId);
    if(!alert||alert.status==='resolved')return state;
    if(action.type==='operations-resolve'&&alert.kind==='condition'&&alert.active)return {...state,message:'Cannot resolve an active physical/monitoring condition. Clear its cause; acknowledgment is not a repair.'};
    if(action.type==='operations-acknowledge'&&alert.status!=='open')return state;
    const acknowledge=action.type==='operations-acknowledge';
    const updated:OperationsAlert={...alert,status:acknowledge?'acknowledged':'resolved',updatedAt:snapshot.timestamp,
      ...(acknowledge?{acknowledgedAt:snapshot.timestamp}:{resolvedAt:snapshot.timestamp,resolution:'Historical dispatch event reviewed; execution unchanged'})};
    const next={...state,alerts:state.alerts.map(a=>a.id===alert.id?updated:a),message:acknowledge?'Alert acknowledged; the underlying condition remains unchanged.':'Historical alert resolved; original dispatch and settlement remain unchanged.'};
    return appendEvent(next,snapshot.timestamp,acknowledge?'alert-acknowledged':'alert-resolved',alert.source,next.message,alert.id);
  }
  return state;
}
/** Observe shared-state transitions; never run physics or edit financial/asset values. */
export function observeOperations(state:OperationsState,before:OperationsSnapshot,after:OperationsSnapshot,eventType:string):OperationsState {
  if(before.assets===after.assets&&before.step===after.step&&before.history===after.history)return state;
  let next=state;
  const beforeAssets=new Map(before.assets.map(asset=>[asset.id,asset]));
  let offlineTelemetryAt=state.offlineTelemetryAt;
  for(const asset of after.assets){
    const previous=beforeAssets.get(asset.id);
    if(!previous||previous===asset)continue;
    if((previous.status==='offline')!==(asset.status==='offline')){
      if(asset.status==='offline')offlineTelemetryAt={...offlineTelemetryAt,[asset.id]:assetMonitoring(previous,state,before).lastTelemetryAt};
      else{offlineTelemetryAt={...offlineTelemetryAt};delete (offlineTelemetryAt as Record<string,string>)[asset.id];}
      next=appendEvent(next,after.timestamp,'connectivity',asset.id,`Connectivity ${asset.status==='offline'?'offline':'online'}; core status ${previous.status} → ${asset.status}.`);
    }
    if(previous.availability!==asset.availability||previous.status!==asset.status)next=appendEvent(next,after.timestamp,'asset-change',asset.id,`Core availability ${previous.availability} → ${asset.availability}; status ${previous.status} → ${asset.status}.`);
  }
  next={...next,offlineTelemetryAt};
  if(after.history.length>before.history.length){
    const interval=after.history.at(-1)!;
    next=appendEvent(next,interval.endTimestamp,'dispatch',interval.request.assetId??'Fleet dispatch',`${interval.request.command} ${interval.status}; ${formatPower(interval.acceptedPowerMW,'fleet')} accepted. Interval started ${interval.timestamp}.`);
  }else if((eventType==='step'||eventType==='tick')&&after.step!==before.step&&after.step%4===0){
    next=appendEvent(next,after.timestamp,'clock','Simulation clock','Hourly simulation checkpoint. Time-only progression does not execute dispatch.');
  }
  return reconcileAlerts(next,after);
}
export function operationsMetrics(snapshot:OperationsSnapshot,operations:OperationsState){
  const monitors=snapshot.assets.map(a=>assetMonitoring(a,operations,snapshot));
  const total=monitors.length;
  const online=monitors.filter(m=>m.online).length;
  const available=monitors.filter(m=>m.dispatchAvailable).length;
  const healthy=monitors.filter(m=>m.health==='healthy').length;
  const active=operations.alerts.filter(a=>a.status!=='resolved');
  const requestedMWh=snapshot.history.reduce((sum,i)=>sum+i.requestedEnergyMWh,0);
  const acceptedMWh=snapshot.history.reduce((sum,i)=>sum+i.acceptedEnergyMWh,0);
  const capacity=snapshot.assets.reduce((sum,a)=>sum+a.energyCapacityMWh,0);
  return {total,online,offline:total-online,available,unavailable:total-available,healthy,
    operationallyReady:monitors.filter(m=>m.operationallyReady).length,
    availablePowerMW:monitors.reduce((sum,m)=>sum+m.dischargingPowerMW,0),
    weightedSocPct:capacity===0?0:snapshot.assets.reduce((sum,a)=>sum+a.energyCapacityMWh*a.socPct,0)/capacity,
    connectivityPct:total?online/total*100:0,availabilityPct:total?available/total*100:0,healthyPct:total?healthy/total*100:0,
    activeAlerts:active.length,criticalAlerts:active.filter(a=>a.severity==='critical').length,
    openBySeverity:Object.fromEntries((['info','warning','critical'] as const).map(severity=>[severity,active.filter(a=>a.status==='open'&&a.severity===severity).length])) as Record<AlertSeverity,number>,
    acceptancePct:requestedMWh>0?acceptedMWh/requestedMWh*100:null,
    curtailedMWh:snapshot.history.reduce((sum,i)=>sum+i.curtailedEnergyMWh,0),
    rejectedMWh:snapshot.history.reduce((sum,i)=>sum+i.rejectedEnergyMWh,0),
    dispatchCount:snapshot.history.length,recentDispatchCount:snapshot.history.filter(i=>i.step>=Math.max(0,snapshot.step-4)&&i.step<snapshot.step).length};
}
export function dispatchLog(history:readonly DispatchInterval[]){
  return history.toSorted((a,b)=>b.step-a.step).map(interval=>({interval,key:interval.timestamp,assetId:interval.request.assetId??'Fleet',
    alertKey:interval.status==='accepted'?null:dispatchConditionKey(interval)}));
}
export function eventTimeline(events:readonly OperationsEvent[],type:EventType|'all'='all',search=''){
  const query=search.trim().toLowerCase();
  return events.filter(e=>(type==='all'||e.type===type)&&`${e.source} ${e.description}`.toLowerCase().includes(query))
    .toSorted((a,b)=>b.timestamp.localeCompare(a.timestamp)||b.sequence-a.sequence);
}
