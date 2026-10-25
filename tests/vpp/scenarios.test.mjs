import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssets} from '../../lib/vpp/domain.ts';
import {scenarioPresets,runScenario,scenarioPrice,validateScenario,initialScenarioControls} from '../../lib/vpp/scenarios.ts';
import {DEFAULT_COMMERCIAL_SETTINGS,settleHistory} from '../../lib/vpp/settlement.ts';
import {createInitialState,demoReducer} from '../../lib/vpp/simulation.ts';
import {recommendAtPrice} from '../../lib/vpp/market-decision.ts';
import {marketPriceAt} from '../../lib/vpp/market-data.ts';
import {formatNumber,formatUSD,formatMarketPrice,formatPower,formatEnergy,formatToleranceCeiling,numericInputDisplay,usdPerKwhToUsdPerMwh,usdPerMwhToUsdPerKwh} from '../../lib/vpp/units.ts';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ~= ${b}`);
const assets=createAssets();
const config={...scenarioPresets[0].config};
const run=(id='base',changes={},input=assets)=>runScenario(id,{...config,...changes},input,DEFAULT_COMMERCIAL_SETTINGS);

test('global display caps decimals and normalizes negative zero without changing conversions',()=>{
  assert.equal(formatNumber(171.406),'171.41');assert.equal(formatNumber(-1.234567),'-1.23');
  assert.equal(formatUSD(-.00001),'$0.00');assert.equal(formatNumber(-.00001),'0');
  assert.equal(formatUSD(-1.235),'-$1.24');assert.equal(formatMarketPrice(171.406),'171.41 USD/MWh (0.17 USD/kWh)');
  assert.equal(formatMarketPrice(-.0001),'0 USD/MWh (0.00 USD/kWh)');
  assert.equal(formatPower(1.234567,'fleet'),'1.23 MW');assert.equal(formatEnergy(.001234567,'record'),'1.23 kWh');
  assert.equal(formatToleranceCeiling(1e-9),'$0.01');assert.equal(formatToleranceCeiling(.025),'$0.03');
  assert.equal(numericInputDisplay(1234.56789),'1234.57');near(usdPerKwhToUsdPerMwh(usdPerMwhToUsdPerKwh(171.406)),171.406);
});
test('scenario parameters reject invalid, infinite and out-of-range inputs',()=>{
  for(const changes of [{intervals:0},{intervals:97},{intervals:1.5},{reserveSocPct:101},{reserveSocPct:-1},{capacityMultiplier:0},{capacityMultiplier:11},{requestedFleetPowerMW:-1},{requestedFleetPowerMW:101},{chargeThresholdUSDPerMWh:300},{chargeThresholdUSDPerMWh:NaN},{dischargeThresholdUSDPerMWh:Infinity}])assert.ok(validateScenario({...config,...changes}));
  assert.equal(validateScenario({...config,requestedFleetPowerMW:0}),null);
});
test('shared strict threshold rules include charge, discharge and boundary idle',()=>{
  for(const [price,command] of [[49,'charge'],[50,'idle'],[100,'idle'],[300,'idle'],[301,'discharge']])assert.equal(recommendAtPrice(assets,0,config,price).request.command,command);
});
test('full-day scenario has 96 unique sequential intervals with physical conservation and cent reconciliation',()=>{
  const r=run();assert.equal(r.points.length,96);assert.equal(new Set(r.points.map(p=>p.timestamp)).size,96);
  for(const [index,p] of r.points.entries()){
    assert.equal(p.step,index);if(index)assert.equal(Date.parse(p.timestamp)-Date.parse(r.points[index-1].timestamp),900000);
    near(p.acEnergyMWh,p.acPowerMW*.25);near(p.acEnergyMWh+p.batteryEnergyDeltaMWh+p.lossMWh,0);
    assert.ok(Math.abs(p.acPowerMW)<=config.requestedFleetPowerMW+1e-9);
    if(p.command==='charge')near(p.batteryEnergyDeltaMWh,-p.acEnergyMWh*.95);
    if(p.command==='discharge')near(p.batteryEnergyDeltaMWh,-p.acEnergyMWh/.95);
    if(p.command==='idle'){assert.equal(p.grossEnergyValueUSD,0);assert.equal(p.acEnergyMWh,0);}
  }
  near(r.finalStoredMWh-r.initialStoredMWh,r.points.reduce((sum,p)=>sum+p.batteryEnergyDeltaMWh,0));
  assert.equal(r.commands.charge+r.commands.discharge+r.commands.idle,96);
  assert.ok(r.reconciled);assert.equal(r.residualCents,0);assert.ok(Math.abs(r.sourceDifferenceUSD)<=r.sourceToleranceUSD);assert.ok(r.sourceToleranceUSD<.0001);
  assert.ok(Math.abs(r.roundingDifferenceUSD)<=r.roundingToleranceUSD);
  const t=r.totals;assert.equal(t.grossCents-t.qseCents-t.transactionCents-t.degradationCents,t.ownerCents+t.platformCents-t.deficitCents);
  for(const asset of r.finalAssets){assert.ok(asset.socPct>=asset.minSocPct-1e-9);assert.ok(asset.socPct<=asset.maxSocPct+1e-9);}
});
test('all six presets replay exactly and volatility preserves deterministic time structure',()=>{
  for(let step=0;step<96;step++)assert.equal(scenarioPrice('base',step),marketPriceAt(step));
  for(const p of scenarioPresets){const first=runScenario(p.id,{...p.config},assets,DEFAULT_COMMERCIAL_SETTINGS);assert.deepEqual(first,runScenario(p.id,{...p.config},assets,DEFAULT_COMMERCIAL_SETTINGS));}
  const spread=id=>{const values=Array.from({length:96},(_,step)=>scenarioPrice(id,step));return Math.max(...values)-Math.min(...values);};
  assert.ok(spread('high-volatility')>spread('base'));assert.ok(spread('base')>spread('low-volatility'));
  assert.throws(()=>scenarioPrice('base',96));
});
test('capacity scaling retains MW ratings and SOC while increasing MWh and initial energy',()=>{
  const r=run('high-storage',{capacityMultiplier:2,intervals:1,requestedFleetPowerMW:0});
  near(r.initialMetrics.energyCapacityMWh,117.7*2);near(r.initialMetrics.ratedPowerMW,20);
  near(r.initialStoredMWh,117.7*2*.68);near(r.finalSocPct,68);
});
test('conservative and aggressive presets change activity without bypassing hardware reserves',()=>{
  const conservative=scenarioPresets.find(p=>p.id==='conservative'),aggressive=scenarioPresets.find(p=>p.id==='aggressive');
  const c=runScenario(conservative.id,{...conservative.config},assets,DEFAULT_COMMERCIAL_SETTINGS),a=runScenario(aggressive.id,{...aggressive.config},assets,DEFAULT_COMMERCIAL_SETTINGS);
  assert.ok(c.commands.idle>a.commands.idle);
  assert.ok(c.finalAssets.every(asset=>asset.socPct>=40-1e-9));assert.ok(a.finalAssets.every(asset=>asset.socPct>=20-1e-9));
});
test('assets below strategy reserve can charge without invented energy or further discharge',()=>{
  const input=[{...assets[0],socPct:25}];
  const r=run('base',{reserveSocPct:80,intervals:1},input);assert.ok(r.finalSocPct>25);near(r.initialStoredMWh,.075*.25);
  near(r.finalStoredMWh-r.initialStoredMWh,r.points[0].batteryEnergyDeltaMWh);
  const discharge=run('base',{reserveSocPct:80,chargeThresholdUSDPerMWh:-1000,dischargeThresholdUSDPerMWh:-900,intervals:1},input);near(discharge.finalSocPct,25);assert.equal(discharge.exportedMWh,0);
});
test('unavailable, empty and zero-target scenarios earn nothing and retain SOC',()=>{
  for(const r of [run('base',{},assets.map(a=>({...a,availability:'unavailable'}))),run('base',{},[]),run('base',{requestedFleetPowerMW:0})]){
    assert.equal(r.importedMWh,0);assert.equal(r.exportedMWh,0);for(const value of Object.values(r.totals))assert.equal(value,0);
  }
  assert.equal(run('base',{requestedFleetPowerMW:0}).commands.idle,96);
});
test('scenario runs leave live history, commercial settings, clock and frozen assets unchanged',()=>{
  let state=createInitialState();state=demoReducer(state,{type:'execute-market',step:0,resetVersion:0,revision:0});
  const before=structuredClone(state);Object.freeze(state.assets);state.assets.forEach(Object.freeze);Object.freeze(state.commercialSettings);
  runScenario('base',config,state.assets,state.commercialSettings);assert.deepEqual(state,before);
  assert.deepEqual(settleHistory(state.history,state.assets,state.commercialSettings),settleHistory(before.history,before.assets,before.commercialSettings));
});
test('reset factories produce independent defaults and replay after main reset is identical',()=>{
  const controls=initialScenarioControls();controls.config.reserveSocPct=99;
  assert.equal(initialScenarioControls().config.reserveSocPct,20);
  const first=run();const state=demoReducer(createInitialState(),{type:'reset'});
  assert.deepEqual(first,runScenario('base',initialScenarioControls().config,state.assets,state.commercialSettings));
});
test('single-EV scenario settlement follows existing costs and positive-net cent allocations',()=>{
  const result=run('base',{intervals:1,requestedFleetPowerMW:.006,chargeThresholdUSDPerMWh:-100,dischargeThresholdUSDPerMWh:0},[assets[0]]);
  assert.deepEqual(result.totals,{grossCents:5,qseCents:0,transactionCents:0,degradationCents:3,netCents:2,ownerCents:1,platformCents:1,deficitCents:0});
  const charge=run('base',{intervals:1,requestedFleetPowerMW:.006},[assets[0]]);
  assert.equal(charge.totals.grossCents,-5);assert.equal(charge.totals.deficitCents,8);assert.equal(charge.totals.ownerCents,0);
});
test('oversized target reports unserved demand once and respects SOC headroom and power',()=>{
  const input=[{...assets[0],socPct:99.9}];const r=run('base',{intervals:1,requestedFleetPowerMW:100},input);
  assert.ok(r.curtailedMWh+r.rejectedMWh>24.99);assert.ok(r.points[0].acPowerMW>=-.007-1e-9);
  near(r.importedMWh+r.curtailedMWh+r.rejectedMWh,25);near(r.finalAssets[0].socPct,100);
});
