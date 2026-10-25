import type { ScenarioConfig, ScenarioResult } from '@/lib/vpp/scenarios';

export type ScenarioDisplayResult=Omit<ScenarioResult,'name'>&{name:string};
export interface StrategyCardView {
  readonly id:string;readonly name:string;readonly description:string;readonly config:Readonly<ScenarioConfig>;
}
export interface ComparisonBarGroup {readonly label:string;readonly values:readonly number[]}
export function comparisonViews(results:readonly ScenarioDisplayResult[]){
  return {
    economics:results.map(r=>({label:r.name,values:[r.totals.netCents/100,r.terminal.adjustedEconomicValueUSD]})),
    energy:results.map(r=>({label:r.name,values:[r.importedMWh,r.exportedMWh]})),
  };
}
export function constraintLabel(r:ScenarioDisplayResult):string {
  return r.terminal.status==='pass'?'PASS · within terminal SOC constraint':r.terminal.status==='fail'?'FAIL · non-comparable under terminal SOC constraint':'N/A · no storage capacity; non-comparable';
}
export const scenarioClock=(step:number)=>`${String(Math.floor(step/4)).padStart(2,'0')}:${String(step%4*15).padStart(2,'0')}`;
/** Geometry only. It neither chooses commands nor adjusts prices/energy. */
export function comparisonScale(groups:readonly ComparisonBarGroup[]){
  const values=groups.flatMap(group=>[...group.values]);
  const minimum=Math.min(0,...values),maximum=Math.max(0,...values);
  const span=maximum-minimum||1;
  return {minimum,maximum:minimum+span,x:(value:number)=>280+(value-minimum)/span*590};
}
