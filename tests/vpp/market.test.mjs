import test from 'node:test';
import assert from 'node:assert/strict';
import { marketPrices, marketPriceAt, marketStatistics, MARKET_SCENARIO_ID } from '../../lib/vpp/market-data.ts';
import { DEFAULT_MARKET_SETTINGS, recommendMarket, validateMarketSettings } from '../../lib/vpp/market-decision.ts';
import { economicSummary, grossEnergyValueUSD } from '../../lib/vpp/economics.ts';
import { createInitialState, demoReducer, simulationTimestamp } from '../../lib/vpp/simulation.ts';
import { createAssets } from '../../lib/vpp/domain.ts';
import { executeDispatch } from '../../lib/vpp/dispatch.ts';
import { formatUSD, formatPower, formatEnergy } from '../../lib/vpp/units.ts';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} ~= ${expected}`);
const marketAction=state=>({type:'execute-market',step:state.step,resetVersion:state.resetVersion,revision:state.marketRevision});
const manualAction=state=>({type:'execute-dispatch',step:state.step,resetVersion:state.resetVersion,request:{command:'discharge',assetId:'ev-v2g-0001',requestedPowerMW:.006}});

test('synthetic price scenario has 96 unique clock-aligned finite quarter-hour intervals',()=>{
  assert.equal(marketPrices.length,96);
  assert.deepEqual(marketPrices.map(p=>p.step),Array.from({length:96},(_,i)=>i));
  const times=marketPrices.map(p=>simulationTimestamp(p.step));
  assert.equal(new Set(times).size,96);
  for(let i=0;i<96;i++) {
    assert.ok(Number.isFinite(marketPrices[i].priceUSDPerMWh));
    if(i) assert.equal(Date.parse(times[i])-Date.parse(times[i-1]),900_000);
  }
  assert.equal(times[0],'2026-10-23T05:00:00.000Z');
  assert.equal(times[95],'2026-10-24T04:45:00.000Z');
  assert.equal(marketPriceAt(0),30);assert.equal(marketPriceAt(8),-200);assert.equal(marketPriceAt(74),2500);
  for(const step of [-1,96,NaN,1.5]) assert.equal(marketPriceAt(step),null);
});
test('daily statistics cover negative overnight prices and scarcity spike without claiming observations',()=>{
  const stats=marketStatistics();
  assert.equal(stats.minimum,-200);assert.equal(stats.maximum,2500);
  near(stats.average,marketPrices.reduce((sum,p)=>sum+p.priceUSDPerMWh,0)/96);
  assert.ok(marketPriceAt(74)>marketPriceAt(0));
  assert.match(MARKET_SCENARIO_ID,/synthetic/);
});
test('strict threshold boundaries recommend Idle, with Charge below and Discharge above',()=>{
  const assets=createAssets();const price=marketPriceAt(0);
  assert.equal(recommendMarket(assets,0,DEFAULT_MARKET_SETTINGS).request.command,'charge');
  assert.equal(recommendMarket(assets,74,DEFAULT_MARKET_SETTINGS).request.command,'discharge');
  assert.equal(recommendMarket(assets,32,DEFAULT_MARKET_SETTINGS).request.command,'idle');
  assert.equal(recommendMarket(assets,0,{...DEFAULT_MARKET_SETTINGS,chargeThresholdUSDPerMWh:price}).request.command,'idle');
  const atDischarge=recommendMarket(assets,0,{...DEFAULT_MARKET_SETTINGS,chargeThresholdUSDPerMWh:0,dischargeThresholdUSDPerMWh:price});
  assert.equal(atDischarge.request.command,'idle');assert.equal(atDischarge.request.requestedPowerMW,0);
  assert.match(atDischarge.explanation,/Boundary/);
});
test('invalid thresholds and power inputs are rejected without changing applied settings',()=>{
  const initial=createInitialState();
  for(const changes of [{chargeThresholdUSDPerMWh:300},{chargeThresholdUSDPerMWh:301},{chargeThresholdUSDPerMWh:NaN},{dischargeThresholdUSDPerMWh:Infinity},{requestedFleetPowerMW:0},{requestedFleetPowerMW:-1},{requestedFleetPowerMW:NaN}]) {
    const settings={...DEFAULT_MARKET_SETTINGS,...changes};
    assert.ok(validateMarketSettings(settings));
    assert.throws(()=>recommendMarket(initial.assets,0,settings));
    const state=demoReducer(initial,{type:'set-market-settings',settings});
    assert.deepEqual(state.marketSettings,initial.marketSettings);assert.equal(state.marketRevision,0);
    assert.ok(state.dispatchError);
  }
  assert.equal(validateMarketSettings({...DEFAULT_MARKET_SETTINGS,chargeThresholdUSDPerMWh:-50,dischargeThresholdUSDPerMWh:-10}),null);
});
test('preview uses the physical engine and leaves original assets, clock, history and economics untouched',()=>{
  const initial=createInitialState();const before=structuredClone(initial);
  const preview=recommendMarket(initial.assets,0,DEFAULT_MARKET_SETTINGS);
  assert.deepEqual(initial,before);
  assert.deepEqual(preview.physicalPreview,executeDispatch(initial.assets,preview.request));
  assert.ok(preview.physicalPreview.assets.some(a=>a.socPct>68));
  assert.equal(economicSummary(initial.history).cumulativeGrossValueUSD,0);
});
test('recommendation power respects current equipment, SOC, availability and efficiency constraints',()=>{
  const base=createAssets()[0];
  const assets=[{...base,id:'limited',type:'commercial-bess',energyCapacityMWh:1,ratedPowerMW:2,maxDischargingPowerMW:2,socPct:21}];
  const preview=recommendMarket(assets,74,{...DEFAULT_MARKET_SETTINGS,requestedFleetPowerMW:2});
  near(preview.physicalPreview.acceptedPowerMW,.038);assert.equal(preview.physicalPreview.status,'curtailed');
  const unavailable=recommendMarket([{...base,availability:'unavailable'}],0,DEFAULT_MARKET_SETTINGS);
  assert.equal(unavailable.physicalPreview.status,'rejected');assert.equal(unavailable.physicalPreview.acceptedPowerMW,0);
  assert.ok(unavailable.physicalPreview.reasons.length);
});
test('market execution updates the one shared SOC ledger, advances clock, and captures its price',()=>{
  const initial=createInitialState();const next=demoReducer(initial,marketAction(initial));
  assert.equal(next.step,1);assert.equal(next.history.length,1);
  assert.equal(next.history[0].source,'market');assert.equal(next.history[0].marketPriceUSDPerMWh,30);
  near(next.history[0].acEnergyMWh,-.25);near(next.history[0].grossEnergyValueUSD,-7.5);
  assert.ok(next.assets.some(a=>a.socPct>68));assert.equal(initial.assets[0].socPct,68);
});
test('manual and market executions share history, pricing rules and duplicate protection',()=>{
  const initial=createInitialState();const event=manualAction(initial);
  const manual=demoReducer(initial,event);
  assert.equal(manual.history[0].source,'manual');near(manual.history[0].grossEnergyValueUSD,.0015*30);
  const staleMarket=demoReducer(manual,marketAction(initial));
  assert.equal(staleMarket.history,manual.history);assert.equal(staleMarket.assets,manual.assets);
  const market=demoReducer(manual,marketAction(manual));
  assert.deepEqual(market.history.map(h=>h.source),['manual','market']);
  assert.equal(new Set(market.history.map(h=>h.timestamp)).size,2);
  const duplicate=demoReducer(market,marketAction(manual));
  assert.equal(duplicate.history,market.history);
  near(economicSummary(market.history).cumulativeGrossValueUSD,market.history.reduce((sum,h)=>sum+h.grossEnergyValueUSD,0));
});
test('asset edits, settings, clock changes and reset invalidate old preview tokens',()=>{
  const initial=createInitialState();const token=marketAction(initial);const a=initial.assets[0];
  const assetEdited=demoReducer(initial,{type:'update-asset',id:a.id,update:{socPct:40,availability:a.availability,status:a.status}});
  const configured=demoReducer(initial,{type:'set-market-settings',settings:{...DEFAULT_MARKET_SETTINGS,requestedFleetPowerMW:2}});
  for(const state of [assetEdited,configured,demoReducer(initial,{type:'step'}),demoReducer(initial,{type:'reset'}),demoReducer(initial,{type:'start'}),{...initial,step:96}]) {
    const rejected=demoReducer(state,token);
    assert.equal(rejected.history.length,0);assert.equal(rejected.assets,state.assets);assert.ok(rejected.dispatchError);
  }
});
test('positive and negative prices value exports and imports with correct signs',()=>{
  near(grossEnergyValueUSD(.25,100),25);near(grossEnergyValueUSD(-.25,100),-25);
  near(grossEnergyValueUSD(.25,-30),-7.5);near(grossEnergyValueUSD(-.25,-30),7.5);
  assert.equal(grossEnergyValueUSD(0,1500),0);assert.equal(grossEnergyValueUSD(-0,-30),0);
  assert.throws(()=>grossEnergyValueUSD(NaN,100));assert.throws(()=>grossEnergyValueUSD(1,Infinity));
});
test('negative-price charging creates a credit and scarcity discharge uses the executed interval price',()=>{
  for(const [step,energy,value] of [[8,-.25,50],[74,.25,625]]) {
    const initial={...createInitialState(),step};const next=demoReducer(initial,marketAction(initial));
    near(next.history[0].acEnergyMWh,energy);near(next.history[0].grossEnergyValueUSD,value);
    assert.equal(next.history[0].marketPriceUSDPerMWh,marketPriceAt(step));
    if(step===8) near(economicSummary(next.history).chargingCostUSD,-50);
  }
});
test('economic aggregates include charging cost/credit and energy-weighted export price',()=>{
  const totals=economicSummary([{acEnergyMWh:.25,marketPriceUSDPerMWh:10},{acEnergyMWh:.75,marketPriceUSDPerMWh:30},{acEnergyMWh:-.5,marketPriceUSDPerMWh:-20}]);
  near(totals.exportedMWh,1);near(totals.importedMWh,.5);near(totals.dischargingValueUSD,25);
  near(totals.chargingCostUSD,-10);near(totals.cumulativeGrossValueUSD,35);near(totals.averageExportPriceUSDPerMWh,25);
  assert.equal(economicSummary([]).averageExportPriceUSDPerMWh,null);
  assert.equal(economicSummary([{acEnergyMWh:0,marketPriceUSDPerMWh:-100}]).cumulativeGrossValueUSD,0);
  const exportAtNegativePrice=economicSummary([{acEnergyMWh:.25,marketPriceUSDPerMWh:-30}]);
  near(exportAtNegativePrice.cumulativeGrossValueUSD,-7.5);near(exportAtNegativePrice.averageExportPriceUSDPerMWh,-30);
  near(economicSummary([{acEnergyMWh:-.25,marketPriceUSDPerMWh:100}]).chargingCostUSD,25);
  assert.throws(()=>economicSummary([{acEnergyMWh:NaN,marketPriceUSDPerMWh:1}]));
});
test('losses are represented by physics and never charged a second time',()=>{
  const a=createAssets()[0];const request={command:'charge',assetId:a.id,requestedPowerMW:.006};
  const charge=executeDispatch([a],request);
  const discharge=executeDispatch(charge.assets,{...request,command:'discharge'});
  const totals=economicSummary([charge,discharge].map(r=>({acEnergyMWh:r.acEnergyMWh,marketPriceUSDPerMWh:100})));
  near(totals.cumulativeGrossValueUSD,0);
  assert.ok(discharge.assets[0].socPct<a.socPct);
  near(charge.lossMWh+discharge.lossMWh,charge.batteryEnergyDeltaMWh*-1-discharge.batteryEnergyDeltaMWh);
});
test('Idle, rejected requests and time-only playback produce no economic value',()=>{
  const initial=createInitialState();
  const idle={...initial,step:32};const idled=demoReducer(idle,marketAction(idle));
  assert.equal(idled.history[0].request.command,'idle');assert.equal(idled.history[0].grossEnergyValueUSD,0);
  const unavailable={...initial,assets:initial.assets.map(a=>({...a,availability:'unavailable'}))};
  const rejected=demoReducer(unavailable,marketAction(unavailable));
  assert.equal(rejected.history[0].status,'rejected');assert.equal(rejected.history[0].grossEnergyValueUSD,0);
  const advanced=demoReducer(demoReducer(initial,{type:'start'}),{type:'tick'});
  assert.equal(advanced.history.length,0);assert.equal(economicSummary(advanced.history).cumulativeGrossValueUSD,0);
});
test('end-of-day handling, reset and deterministic market replay preserve one history',()=>{
  function replay(state) {
    state=demoReducer(state,{type:'set-market-settings',settings:{...DEFAULT_MARKET_SETTINGS,requestedFleetPowerMW:2}});
    for(let i=0;i<3;i++) state=demoReducer(state,marketAction(state));
    return state;
  }
  const first=replay(createInitialState());const reset=demoReducer(first,{type:'reset'});
  assert.equal(reset.history.length,0);assert.equal(reset.step,0);assert.deepEqual(reset.marketSettings,DEFAULT_MARKET_SETTINGS);
  assert.equal(economicSummary(reset.history).cumulativeGrossValueUSD,0);
  const second=replay(reset);assert.deepEqual(first.history,second.history);assert.deepEqual(first.assets,second.assets);
  assert.throws(()=>recommendMarket(reset.assets,96,reset.marketSettings));
  const end={...createInitialState(),step:95};const last=demoReducer(end,marketAction(end));
  assert.equal(last.step,96);assert.equal(marketPriceAt(last.step),null);
  assert.equal(demoReducer(last,marketAction(last)).history.length,1);
});
test('price, energy and USD display utilities retain existing unit rules and normalize negative zero',()=>{
  assert.equal(formatUSD(7.5),'$7.50');assert.equal(formatUSD(-5.25),'-$5.25');assert.equal(formatUSD(-0),'$0.00');
  assert.equal(formatUSD(-.001),'$0.00');assert.equal(formatUSD(1.005),'$1.01');
  assert.equal(formatPower(.006,'record'),'6 kW');assert.equal(formatEnergy(.0015,'record'),'1.5 kWh');
  assert.equal(formatPower(1,'fleet'),'1 MW');assert.equal(formatEnergy(.25,'fleet'),'0.25 MWh');
});

