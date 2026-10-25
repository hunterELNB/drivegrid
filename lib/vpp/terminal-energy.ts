import type { DERAsset } from './domain.ts';

export interface TerminalSettings {
  referencePriceUSDPerMWh:number;
  /** null resolves to the run's initial capacity-weighted SOC, without rounding. */
  targetSocPct:number|null;
  tolerancePct:number;
}
export const DEFAULT_TERMINAL_SETTINGS:Readonly<TerminalSettings>={referencePriceUSDPerMWh:100,targetSocPct:null,tolerancePct:2};
export function validateTerminalSettings(settings:TerminalSettings):string|null {
  if(!Number.isFinite(settings.referencePriceUSDPerMWh)||Math.abs(settings.referencePriceUSDPerMWh)>100_000) return 'Terminal reference price must be finite and between −100,000 and 100,000 USD/MWh.';
  if(settings.targetSocPct!==null&&(!Number.isFinite(settings.targetSocPct)||settings.targetSocPct<0||settings.targetSocPct>100)) return 'Terminal SOC target must be between 0 and 100%.';
  if(!Number.isFinite(settings.tolerancePct)||settings.tolerancePct<0||settings.tolerancePct>100) return 'Terminal SOC tolerance must be between 0 and 100 percentage points.';
  return null;
}
/** Battery-side MWh, including all assets; availability does not remove stored energy. */
export function storedEnergy(assets:readonly Pick<DERAsset,'energyCapacityMWh'|'socPct'>[]) {
  if(assets.some(a=>!Number.isFinite(a.energyCapacityMWh)||a.energyCapacityMWh<0||!Number.isFinite(a.socPct)||a.socPct<0||a.socPct>100)) throw new Error('Stored-energy accounting requires finite nonnegative capacities and SOC between 0 and 100%.');
  const capacityMWh=assets.reduce((sum,a)=>sum+a.energyCapacityMWh,0);
  const storedMWh=assets.reduce((sum,a)=>sum+a.energyCapacityMWh*a.socPct/100,0);
  return {capacityMWh,storedMWh,weightedSocPct:capacityMWh===0?0:storedMWh/capacityMWh*100};
}
/** Comparison-only mark of the change in battery inventory. Never a settlement posting. */
export function evaluateTerminalEnergy(initialAssets:readonly DERAsset[],finalAssets:readonly DERAsset[],netDistributableUSD:number,settings:TerminalSettings=DEFAULT_TERMINAL_SETTINGS) {
  const invalid=validateTerminalSettings(settings);
  if(invalid) throw new Error(invalid);
  if(!Number.isFinite(netDistributableUSD)) throw new Error('Operating net value must be finite.');
  const initial=storedEnergy(initialAssets),final=storedEnergy(finalAssets);
  const netStoredMWh=final.storedMWh-initial.storedMWh;
  const targetSocPct=settings.targetSocPct??initial.weightedSocPct;
  const deviationPct=final.weightedSocPct-targetSocPct;
  // Only binary arithmetic noise at a percentage-point boundary; no SOC is adjusted.
  const boundaryEpsilon=32*Number.EPSILON*Math.max(1,Math.abs(final.weightedSocPct),Math.abs(targetSocPct));
  const hasCapacity=initial.capacityMWh>0&&final.capacityMWh>0;
  const meetsTarget=hasCapacity&&Math.abs(deviationPct)<=settings.tolerancePct+boundaryEpsilon;
  const adjustmentUSD=netStoredMWh*settings.referencePriceUSDPerMWh;
  return {initialStoredMWh:initial.storedMWh,finalStoredMWh:final.storedMWh,netStoredMWh,
    initialSocPct:initial.weightedSocPct,finalSocPct:final.weightedSocPct,targetSocPct,deviationPct,
    tolerancePct:settings.tolerancePct,referencePriceUSDPerMWh:settings.referencePriceUSDPerMWh,
    adjustmentUSD,adjustedEconomicValueUSD:netDistributableUSD+adjustmentUSD,
    status:!hasCapacity?'unavailable' as const:meetsTarget?'pass' as const:'fail' as const,
    comparable:meetsTarget};
}
