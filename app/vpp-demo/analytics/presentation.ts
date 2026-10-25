import type { AnalyticsModel } from '@/lib/vpp/analytics';
import { formatEnergy, formatNumber, formatUSD } from '../../../lib/vpp/units.ts';

export const analyticsTime=(timestamp:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:'America/Chicago',year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(timestamp))+' CT';
export function financialItems(model:AnalyticsModel):[string,number][]{
  const t=model.ledger.totals;
  return [['Gross energy value',t.grossCents/100],['Net distributable value',t.netCents/100],['Asset-owner earnings',t.ownerCents/100],['DriveGrid revenue',t.platformCents/100],['QSE fees',t.qseCents/100],['Market transaction fees',t.transactionCents/100],['Battery degradation costs',t.degradationCents/100],['Unallocated deficit',t.deficitCents/100],['Grid import cost / credit',model.economics.chargingCostUSD],['Grid export revenue / cost',model.economics.dischargingValueUSD]];
}

export interface RecordedEnergyPoint {
  readonly timestamp:string;
  readonly step:number;
  readonly command:'charge'|'discharge'|'idle';
  readonly status:string;
  readonly acEnergyMWh:number;
  readonly grossCents:number;
  readonly netCents:number;
}
/** Read-only selection of accepted outputs, never a second analytics engine. */
export function recordedEnergyPoints(model:AnalyticsModel):readonly RecordedEnergyPoint[]{
  return model.trends.map(point=>({timestamp:point.timestamp,step:point.step,
    command:point.interval.request.command,status:point.interval.status,
    acEnergyMWh:point.interval.acEnergyMWh,grossCents:point.grossCents,netCents:point.netCents}));
}
export function executiveItems(model:AnalyticsModel){
  return [
    {label:'Grid energy exported',value:formatEnergy(model.energy.exportedMWh,'fleet'),note:'Recorded export · selected range',tone:'blue'},
    {label:'Grid energy imported',value:formatEnergy(model.energy.importedMWh,'fleet'),note:'Recorded import · selected range',tone:'cyan'},
    {label:'Net distributable value',value:formatUSD(model.ledger.totals.netCents/100),note:'Simulated settlement · selected range',tone:model.ledger.totals.netCents<0?'negative':'blue'},
    {label:'Dispatch acceptance (energy)',value:model.energy.acceptancePct===null?'N/A':`${formatNumber(model.energy.acceptancePct)}%`,note:'Accepted / requested AC energy',tone:'cyan'},
    {label:'Asset availability',value:`${formatNumber(model.operations.availabilityPct)}%`,note:'Current snapshot · not time filtered',tone:'teal'},
    {label:'Operational events in range',value:formatNumber(model.events.length),note:'Recorded events · selected range',tone:'blue'},
  ] as const;
}

/** Geometry only: true timestamps, 15-minute bar spans, zero-inclusive scale. */
export function energyPlotGeometry(points:readonly RecordedEnergyPoint[]){
  const first=points.length?Date.parse(points[0].timestamp):0;
  const last=points.length?Date.parse(points.at(-1)!.timestamp)+15*60*1000:first+15*60*1000;
  const extent=Math.max(0.001,...points.map(p=>Math.abs(p.acEnergyMWh)));
  return {first,last,minimum:-extent,maximum:extent,
    barWidth:Math.min(80,(15*60*1000)/(last-first)*870*.72),
    x:(timestamp:string)=>130+(Date.parse(timestamp)+7.5*60*1000-first)/(last-first)*870,
    y:(value:number)=>70+(extent-value)/(extent*2)*260};
}
