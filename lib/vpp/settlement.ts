import type { DERAsset, AssetType } from './domain.ts';
import type { DispatchInterval } from './simulation.ts';
import type { DispatchCommand } from './dispatch.ts';
import { grossEnergyValueUSD } from './economics.ts';

export interface CommercialSettings {
  ownerSharePct: number;
  platformSharePct: number;
  qseFeePct: number;
  transactionUSDPerMWh: number;
  degradationUSDPerKWh: number;
}
export const DEFAULT_COMMERCIAL_SETTINGS: Readonly<CommercialSettings> = {
  ownerSharePct:70,platformSharePct:30,qseFeePct:5,transactionUSDPerMWh:1,degradationUSDPerKWh:.02,
};
export function validateCommercialSettings(settings:CommercialSettings):string|null {
  const percentages=[settings.ownerSharePct,settings.platformSharePct,settings.qseFeePct];
  if(!percentages.every(value=>Number.isFinite(value)&&value>=0&&value<=100)) return 'Percentages must be finite and between 0 and 100.';
  if(Math.abs(settings.ownerSharePct+settings.platformSharePct-100)>1e-9) return 'Owner and platform allocation must total 100%.';
  if(![settings.transactionUSDPerMWh,settings.degradationUSDPerKWh].every(value=>Number.isFinite(value)&&value>=0&&value<=1_000_000)) return 'Cost rates must be finite, nonnegative, and at most 1,000,000 per stated unit for this demonstration.';
  return null;
}
/** Half away from zero, with binary midpoint correction; never round physical quantities. */
export function usdToCents(value:number):number {
  if(!Number.isFinite(value)) throw new Error('Currency must be finite.');
  const cents=Math.sign(value)*Math.round((Math.abs(value)+Number.EPSILON*Math.max(1,Math.abs(value)))*100);
  if(!Number.isSafeInteger(cents)) throw new Error('Currency exceeds the safe integer-cent range.');
  return Object.is(cents,-0)?0:cents;
}
export interface SettlementAmounts {
  grossCents:number; qseCents:number; transactionCents:number; degradationCents:number;
  netCents:number; ownerCents:number; platformCents:number; deficitCents:number;
}
export interface SettlementRow extends SettlementAmounts {
  key:string; assetId:string; assetType:AssetType; timestamp:string; step:number;
  source:'manual'|'market'; direction:DispatchCommand; status:string; acceptedPowerMW:number;
  acEnergyMWh:number; batteryEnergyDeltaMWh:number; priceUSDPerMWh:number;
  rawGrossUSD:number;
}
const emptyAmounts=():SettlementAmounts=>({grossCents:0,qseCents:0,transactionCents:0,degradationCents:0,netCents:0,ownerCents:0,platformCents:0,deficitCents:0});
function compensatedSum(values:readonly number[]):number {
  let sum=0;let compensation=0;
  for(const value of values) {
    const corrected=value-compensation;
    const next=sum+corrected;
    compensation=(next-sum)-corrected;
    sum=next;
  }
  return sum;
}
export function aggregateSettlement(rows:readonly SettlementAmounts[]):SettlementAmounts {
  const totals=emptyAmounts();
  for(const row of rows) for(const key of Object.keys(totals) as (keyof SettlementAmounts)[]) {
    totals[key]+=row[key];
    if(!Number.isSafeInteger(totals[key])) throw new Error('Settlement total exceeds safe integer cents.');
  }
  return totals;
}
export function settleHistory(history:readonly DispatchInterval[],assets:readonly Pick<DERAsset,'id'|'type'>[],settings:CommercialSettings) {
  const error=validateCommercialSettings(settings);
  if(error) throw new Error(error);
  const registry=new Map(assets.map(a=>[a.id,a.type]));
  const seen=new Map<string,string>();
  const intervalValues=new Map<string,{timestamp:string;step:number;source:'manual'|'market';priceUSDPerMWh:number;grossUSD:number}>();
  const rows:SettlementRow[]=[];
  let duplicatesIgnored=0;
  for(const interval of history.toSorted((a,b)=>a.timestamp.localeCompare(b.timestamp))) {
    const intervalInfo={timestamp:interval.timestamp,step:interval.step,source:interval.source,priceUSDPerMWh:interval.marketPriceUSDPerMWh,grossUSD:grossEnergyValueUSD(interval.acEnergyMWh,interval.marketPriceUSDPerMWh)};
    const previousInterval=intervalValues.get(interval.timestamp);
    if(previousInterval&&JSON.stringify(previousInterval)!==JSON.stringify(intervalInfo)) throw new Error('Conflicting duplicate dispatch interval.');
    intervalValues.set(interval.timestamp,intervalInfo);
    for(const record of interval.records.toSorted((a,b)=>a.assetId.localeCompare(b.assetId))) {
      const assetType=registry.get(record.assetId);
      if(!assetType) throw new Error(`Unknown settlement asset: ${record.assetId}`);
      const key=`${interval.timestamp}|${record.assetId}`;
      const fingerprint=JSON.stringify([assetType,interval.source,interval.request.command,interval.marketScenarioId,interval.marketPriceUSDPerMWh,record.status,record.acceptedPowerMW,record.acEnergyMWh,record.batteryEnergyDeltaMWh]);
      const previous=seen.get(key);
      if(previous) {if(previous!==fingerprint) throw new Error('Conflicting duplicate asset-interval settlement.'); duplicatesIgnored++;continue;}
      seen.set(key,fingerprint);
      const rawGrossUSD=grossEnergyValueUSD(record.acEnergyMWh,interval.marketPriceUSDPerMWh);
      const grossCents=usdToCents(rawGrossUSD);
      const qseCents=usdToCents(Math.max(grossCents,0)/100*settings.qseFeePct/100);
      const transactionCents=usdToCents(Math.abs(record.acEnergyMWh)*settings.transactionUSDPerMWh);
      const degradationCents=usdToCents(Math.abs(record.batteryEnergyDeltaMWh)*1000*settings.degradationUSDPerKWh);
      const netCents=grossCents-qseCents-transactionCents-degradationCents;
      const positive=Math.max(netCents,0);
      const ownerCents=usdToCents(positive/100*settings.ownerSharePct/100);
      const platformCents=positive-ownerCents;
      const deficitCents=Math.max(-netCents,0);
      rows.push({key,assetId:record.assetId,assetType,timestamp:interval.timestamp,step:interval.step,source:interval.source,direction:interval.request.command,status:record.status,acceptedPowerMW:record.acceptedPowerMW,acEnergyMWh:record.acEnergyMWh,batteryEnergyDeltaMWh:record.batteryEnergyDeltaMWh,priceUSDPerMWh:interval.marketPriceUSDPerMWh,rawGrossUSD,grossCents,qseCents,transactionCents,degradationCents,netCents,ownerCents,platformCents,deficitCents});
    }
  }
  const totals=aggregateSettlement(rows);
  const groupedRows=new Map<string,SettlementRow[]>();
  for(const row of rows) {
    const group=groupedRows.get(row.timestamp);
    if(group)group.push(row);else groupedRows.set(row.timestamp,[row]);
  }
  const intervals=Array.from(intervalValues.values()).map(info=>({...info,recordCount:groupedRows.get(info.timestamp)?.length??0,...aggregateSettlement(groupedRows.get(info.timestamp)??[])}));
  const rawFleetGrossUSD=compensatedSum(Array.from(intervalValues.values()).map(i=>i.grossUSD));
  const rawAttributedGrossUSD=compensatedSum(rows.map(row=>row.rawGrossUSD));
  const sourceDifferenceUSD=rawAttributedGrossUSD-rawFleetGrossUSD;
  // Bounds accumulation error from the unchanged physical engine and price multiplication.
  const sourceToleranceUSD=1e-9+8*Number.EPSILON*Math.max(1,...intervals.map(i=>i.recordCount))*compensatedSum(rows.map(row=>Math.abs(row.rawGrossUSD)));
  if(Math.abs(sourceDifferenceUSD)>sourceToleranceUSD) throw new Error('Asset records do not reconcile to executed fleet gross energy value.');
  const roundingDifferenceUSD=totals.grossCents/100-rawFleetGrossUSD;
  const roundingToleranceUSD=rows.filter(row=>row.rawGrossUSD!==0).length*.005+sourceToleranceUSD;
  const residualCents=totals.grossCents-totals.qseCents-totals.transactionCents-totals.degradationCents-totals.ownerCents-totals.platformCents+totals.deficitCents;
  return {rows,totals,intervals,duplicatesIgnored,rawFleetGrossUSD,sourceDifferenceUSD,sourceToleranceUSD,roundingDifferenceUSD,roundingToleranceUSD,residualCents,reconciled:residualCents===0&&Math.abs(roundingDifferenceUSD)<=roundingToleranceUSD};
}
