import type { DERAsset } from './domain.ts';
import { portfolioMetrics } from './domain.ts';
import { executeDispatch } from './dispatch.ts';
import type { DispatchCommand } from './dispatch.ts';
import { DEFAULT_MARKET_SETTINGS, recommendAtPrice } from './market-decision.ts';
import { marketPriceAt } from './market-data.ts';
import { simulationTimestamp, TOTAL_INTERVALS } from './simulation.ts';
import type { DispatchInterval } from './simulation.ts';
import { grossEnergyValueUSD } from './economics.ts';
import { settleHistory, validateCommercialSettings } from './settlement.ts';
import type { CommercialSettings } from './settlement.ts';
import { DEFAULT_TERMINAL_SETTINGS, evaluateTerminalEnergy, validateTerminalSettings } from './terminal-energy.ts';
import type { TerminalSettings } from './terminal-energy.ts';

export interface ScenarioConfig {
  chargeThresholdUSDPerMWh:number; dischargeThresholdUSDPerMWh:number; requestedFleetPowerMW:number;
  reserveSocPct:number; capacityMultiplier:number; intervals:number;
}
const defaults:ScenarioConfig={...DEFAULT_MARKET_SETTINGS,reserveSocPct:20,capacityMultiplier:1,intervals:96};
export const scenarioPresets = [
  {id:'base',name:'Base Case',volatility:1,description:'Current asset snapshot; original synthetic prices and default strategy.',config:{...defaults}},
  {id:'high-volatility',name:'High Volatility',volatility:1.5,description:'Price deviations from 100 USD/MWh multiplied by 1.5; timing retained.',config:{...defaults}},
  {id:'low-volatility',name:'Low Volatility',volatility:.2,description:'Price deviations from 100 USD/MWh multiplied by 0.2; fewer scarcity opportunities.',config:{...defaults}},
  {id:'high-storage',name:'High Storage Capacity',volatility:1,description:'Energy capacity doubles at unchanged SOC, asset counts and MW ratings. This assumes additional stored energy initially.',config:{...defaults,capacityMultiplier:2}},
  {id:'conservative',name:'Conservative Dispatch',volatility:1,description:'40% reserve, charge below 20 and discharge above 600 USD/MWh; target 0.5 MW.',config:{...defaults,reserveSocPct:40,chargeThresholdUSDPerMWh:20,dischargeThresholdUSDPerMWh:600,requestedFleetPowerMW:.5}},
  {id:'aggressive',name:'Aggressive Dispatch',volatility:1,description:'20% reserve, charge below 80 and discharge above 150 USD/MWh; target 2 MW. Equipment limits remain binding.',config:{...defaults,chargeThresholdUSDPerMWh:80,dischargeThresholdUSDPerMWh:150,requestedFleetPowerMW:2}},
] as const;
export type ScenarioId=typeof scenarioPresets[number]['id'];
export function initialScenarioControls():{presetId:ScenarioId;config:ScenarioConfig} {
  return {presetId:'base',config:{...scenarioPresets[0].config}};
}
export function validateScenario(config:ScenarioConfig):string|null {
  if(![config.chargeThresholdUSDPerMWh,config.dischargeThresholdUSDPerMWh,config.requestedFleetPowerMW,config.reserveSocPct,config.capacityMultiplier,config.intervals].every(Number.isFinite)) return 'All scenario parameters must be finite.';
  if(config.chargeThresholdUSDPerMWh>=config.dischargeThresholdUSDPerMWh) return 'Charge threshold must be lower than discharge threshold.';
  if(Math.max(Math.abs(config.chargeThresholdUSDPerMWh),Math.abs(config.dischargeThresholdUSDPerMWh))>100_000) return 'Threshold magnitude must not exceed 100,000 USD/MWh.';
  if(config.requestedFleetPowerMW<0||config.requestedFleetPowerMW>100) return 'Target must be between 0 and 100 MW.';
  if(config.reserveSocPct<0||config.reserveSocPct>100) return 'SOC reserve must be between 0 and 100%.';
  if(config.capacityMultiplier<.1||config.capacityMultiplier>10) return 'Storage multiplier must be between 0.1 and 10.';
  if(!Number.isInteger(config.intervals)||config.intervals<1||config.intervals>TOTAL_INTERVALS) return 'Use 1 to 96 whole intervals.';
  return null;
}
export function scenarioPrice(id:ScenarioId,step:number):number {
  const preset=scenarioPresets.find(p=>p.id===id);
  const price=marketPriceAt(step);
  if(!preset||price===null) throw new Error('Unknown scenario or interval.');
  return preset.volatility===1?price:100+(price-100)*preset.volatility;
}
export interface ScenarioPoint {
  step:number;timestamp:string;priceUSDPerMWh:number;command:DispatchCommand;acPowerMW:number;acEnergyMWh:number;
  batteryEnergyDeltaMWh:number;lossMWh:number;rejectedEnergyMWh:number;curtailedEnergyMWh:number;
  averageSocPct:number;grossEnergyValueUSD:number;
}
/** No Context, reducers, timers, randomness, external services or mutation of caller inputs. */
export function runScenario(id:ScenarioId,config:ScenarioConfig,input:readonly DERAsset[],commercial:CommercialSettings,terminalSettings:TerminalSettings=DEFAULT_TERMINAL_SETTINGS) {
  const invalid=validateScenario(config)||validateCommercialSettings(commercial)||validateTerminalSettings(terminalSettings);
  if(invalid) throw new Error(invalid);
  const preset=scenarioPresets.find(p=>p.id===id);
  if(!preset) throw new Error('Unknown scenario.');
  if(new Set(input.map(a=>a.id)).size!==input.length) throw new Error('Scenario asset IDs must be unique.');
  const originalFloors=new Map(input.map(a=>[a.id,a.minSocPct]));
  let assets=input.map(a=>({...a,energyCapacityMWh:a.energyCapacityMWh*config.capacityMultiplier}));
  const initialAssets=assets;
  const initialMetrics=portfolioMetrics(assets);
  const initialStoredMWh=assets.reduce((sum,a)=>sum+a.energyCapacityMWh*a.socPct/100,0);
  const history:DispatchInterval[]=[];
  const points:ScenarioPoint[]=[];
  const commands={charge:0,discharge:0,idle:0};
  for(let step=0;step<config.intervals;step++) {
    // Assets below the requested reserve can charge, but cannot export further.
    // The physical floor rises with SOC until the reserve is attained; no energy is invented.
    assets=assets.map(a=>({...a,minSocPct:Math.max(originalFloors.get(a.id)!,Math.min(config.reserveSocPct,a.socPct))}));
    const price=scenarioPrice(id,step);
    const result=config.requestedFleetPowerMW===0
      ?executeDispatch(assets,{command:'idle',requestedPowerMW:0,assetId:null})
      :recommendAtPrice(assets,step,config,price).physicalPreview;
    const {assets:next,...dispatch}=result;
    assets=next.map(a=>({...a}));
    commands[dispatch.request.command]++;
    const gross=grossEnergyValueUSD(dispatch.acEnergyMWh,price);
    // Zero-energy detail records have no cashflows; retaining only participating records
    // bounds comparison memory without changing settlement or aggregate rejection amounts.
    history.push({...dispatch,records:dispatch.records.filter(r=>r.acEnergyMWh!==0),step,timestamp:simulationTimestamp(step),endTimestamp:simulationTimestamp(step+1),source:'market',marketScenarioId:`isolated-${id}`,marketPriceUSDPerMWh:price,grossEnergyValueUSD:gross});
    points.push({step,timestamp:simulationTimestamp(step),priceUSDPerMWh:price,command:dispatch.request.command,acPowerMW:dispatch.acPowerMW,acEnergyMWh:dispatch.acEnergyMWh,batteryEnergyDeltaMWh:dispatch.batteryEnergyDeltaMWh,lossMWh:dispatch.lossMWh,rejectedEnergyMWh:dispatch.rejectedEnergyMWh,curtailedEnergyMWh:dispatch.curtailedEnergyMWh,averageSocPct:portfolioMetrics(assets).averageSocPct,grossEnergyValueUSD:gross});
  }
  const ledger=settleHistory(history,assets,{...commercial});
  const terminal=evaluateTerminalEnergy(initialAssets,assets,ledger.totals.netCents/100,terminalSettings);
  return {id,name:preset.name,config:{...config},commercial:{...commercial},initialMetrics,initialStoredMWh,finalStoredMWh:assets.reduce((sum,a)=>sum+a.energyCapacityMWh*a.socPct/100,0),
    terminal,
    finalAssets:assets,points,commands,totals:ledger.totals,reconciled:ledger.reconciled,residualCents:ledger.residualCents,
    sourceDifferenceUSD:ledger.sourceDifferenceUSD,sourceToleranceUSD:ledger.sourceToleranceUSD,roundingDifferenceUSD:ledger.roundingDifferenceUSD,roundingToleranceUSD:ledger.roundingToleranceUSD,
    importedMWh:points.reduce((sum,p)=>sum+Math.max(0,-p.acEnergyMWh),0),exportedMWh:points.reduce((sum,p)=>sum+Math.max(0,p.acEnergyMWh),0),
    rejectedMWh:points.reduce((sum,p)=>sum+p.rejectedEnergyMWh,0),curtailedMWh:points.reduce((sum,p)=>sum+p.curtailedEnergyMWh,0),finalSocPct:portfolioMetrics(assets).averageSocPct};
}
export type ScenarioResult=ReturnType<typeof runScenario>;
