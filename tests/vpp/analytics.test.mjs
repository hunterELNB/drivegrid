import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,demoReducer,operationsSnapshot,simulationTimestamp} from '../../lib/vpp/simulation.ts';
import {buildAnalytics,analyticsRange,assetPerformanceRows,DEFAULT_PERFORMANCE_FILTER,filteredAnalyticsHistory} from '../../lib/vpp/analytics.ts';
import {settleHistory,aggregateSettlement} from '../../lib/vpp/settlement.ts';
import {operationsMetrics} from '../../lib/vpp/operations.ts';
import {runScenario,scenarioPresets} from '../../lib/vpp/scenarios.ts';
import {formatUSD,formatNumber,formatEnergy} from '../../lib/vpp/units.ts';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ~= ${b}`);
const execute=(state,command,power=.006,assetId=state.assets[0].id)=>demoReducer(state,{type:'execute-dispatch',step:state.step,resetVersion:state.resetVersion,request:{assetId,command,requestedPowerMW:power}});
function recordedState(){
  let state=execute(createInitialState(),'charge');
  while(state.step<8)state=demoReducer(state,{type:'step'});
  state=execute(state,'charge');state=execute(state,'discharge');state=execute(state,'discharge',1);
  state=demoReducer(state,{type:'operations-connectivity',assetId:state.assets[0].id,online:false});state=execute(state,'discharge');
  state=demoReducer(state,{type:'operations-connectivity',assetId:state.assets[0].id,online:true});
  return execute(state,'idle',0,null);
}
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}
test('analytics financial totals use the exact filtered settlement ledger and reconcile in cents',()=>{
  const state=recordedState(),model=buildAnalytics(state),expected=settleHistory(state.history,state.assets,state.commercialSettings);
  assert.deepEqual(model.ledger,expected);assert.ok(model.ledger.reconciled);assert.equal(model.ledger.residualCents,0);
  assert.deepEqual(aggregateSettlement(model.assets.map(a=>a.totals)),model.ledger.totals);
  assert.deepEqual(aggregateSettlement(model.typePerformance.map(t=>t.totals)),model.ledger.totals);
  const t=model.ledger.totals;assert.equal(t.grossCents-t.qseCents-t.transactionCents-t.degradationCents,t.ownerCents+t.platformCents-t.deficitCents);
  assert.equal(model.trends.length,state.history.length);assert.deepEqual(model.trends.map(i=>i.timestamp),state.history.map(i=>i.timestamp));
});
test('energy import/export signs, battery deltas and losses match the accepted physical records',()=>{
  const model=buildAnalytics(recordedState());near(model.energy.importedMWh,.003);near(model.energy.exportedMWh,.003);near(model.energy.netGridMWh,0);
  near(model.energy.batteryEnergyDeltaMWh,.003*.95-.003/.95);near(model.energy.netGridMWh+model.energy.batteryEnergyDeltaMWh+model.energy.lossMWh,0);
  assert.ok(model.economics.chargingCostUSD<0);assert.ok(model.economics.dischargingValueUSD<0);
  near(model.economics.dischargingValueUSD-model.economics.chargingCostUSD,model.ledger.rawFleetGrossUSD);
  near(model.assets.reduce((sum,a)=>sum+a.importedMWh,0),model.energy.importedMWh);near(model.assets.reduce((sum,a)=>sum+a.exportedMWh,0),model.energy.exportedMWh);
});
test('dispatch counts and energy-weighted acceptance include genuine Idle/rejected records only',()=>{
  const model=buildAnalytics(recordedState());assert.equal(model.history.length,6);
  assert.deepEqual(model.commands,{charge:2,discharge:3,idle:1});assert.deepEqual(model.outcomes,{accepted:4,curtailed:1,rejected:1});
  near(model.energy.acceptancePct,.006/.256*100);near(model.energy.peakRequestedMW,1);near(model.energy.peakAcceptedMW,.006);
  const idle=buildAnalytics(execute(createInitialState(),'idle',0,null));assert.equal(idle.history.length,1);assert.equal(idle.energy.acceptancePct,null);assert.equal(idle.ledger.totals.ownerCents,0);
});
test('asset performance uses actual per-asset records and preserves current snapshot fields',()=>{
  const state=recordedState(),model=buildAnalytics(state),ev=model.assets.find(a=>a.asset.id===state.assets[0].id);
  assert.equal(model.assets.length,1150);assert.equal(ev.dispatchCount,6);near(ev.asset.socPct,state.assets[0].socPct);near(ev.importedMWh,.003);near(ev.exportedMWh,.003);
  const other=model.assets.find(a=>a.asset.id===state.assets[1].id);assert.equal(other.dispatchCount,1);assert.equal(other.totals.grossCents,0);
  assert.deepEqual(ev.totals,model.ledger.totals);assert.equal(ev.monitor.online,true);
});
test('half-open custom time filters apply identically to cash, energy, trends and asset totals',()=>{
  const state=recordedState(),filter={mode:'custom',startStep:0,endStep:9},model=buildAnalytics(state,filter);
  assert.deepEqual(model.history.map(i=>i.step),[0,8]);assert.deepEqual(model.trends.map(i=>i.step),[0,8]);near(model.energy.importedMWh,.003);assert.equal(model.energy.exportedMWh,0);
  assert.deepEqual(model.ledger.totals,settleHistory(state.history.filter(i=>i.step<9),state.assets,state.commercialSettings).totals);
  assert.deepEqual(aggregateSettlement(model.assets.map(a=>a.totals)),model.ledger.totals);
  const next=buildAnalytics(state,{mode:'custom',startStep:9,endStep:12});assert.deepEqual(next.history.map(i=>i.step),[9,10,11]);
});
test('last-four-hours filtering follows simulation clock, excludes skipped intervals and never fills gaps',()=>{
  let state=recordedState();while(state.step<25)state=demoReducer(state,{type:'step'});
  const model=buildAnalytics(state,{mode:'last4h',startStep:0,endStep:96});assert.deepEqual(model.history.map(i=>i.step),[9,10,11,12]);
  assert.equal(model.range.startTimestamp,simulationTimestamp(9));assert.equal(model.range.endTimestamp,simulationTimestamp(25));
  assert.deepEqual(buildAnalytics(state,{mode:'day',startStep:0,endStep:96}).history,state.history);
  const all=analyticsRange({mode:'all',startStep:0,endStep:96},state.step);assert.deepEqual(filteredAnalyticsHistory(state.history.toReversed(),all),state.history);
});
test('invalid ranges are rejected and an empty selection returns zero financial/energy values with live snapshots',()=>{
  for(const filter of [{mode:'custom',startStep:9,endStep:9},{mode:'custom',startStep:-1,endStep:4},{mode:'custom',startStep:0,endStep:97},{mode:'custom',startStep:.5,endStep:4},{mode:'bad',startStep:0,endStep:4}])assert.throws(()=>analyticsRange(filter,0));
  assert.throws(()=>analyticsRange({mode:'all',startStep:0,endStep:96},97));
  const state=recordedState(),model=buildAnalytics(state,{mode:'custom',startStep:80,endStep:96});
  assert.equal(model.history.length,0);assert.equal(model.trends.length,0);assert.equal(model.energy.acceptancePct,null);for(const value of Object.values(model.ledger.totals))assert.equal(value,0);
  assert.equal(model.assets.length,1150);assert.equal(model.operations.online,operationsMetrics(operationsSnapshot(state),state.operations).online);
  const initial=buildAnalytics(createInitialState());assert.equal(initial.ledger.totals.grossCents,0);assert.equal(initial.assetRecordCount,0);
});
test('asset search/type/sort are deterministic, include all matching rows and never mutate source',()=>{
  const model=buildAnalytics(recordedState()),before=model.assets.map(a=>a.asset.id);
  const ev=assetPerformanceRows(model.assets,{...DEFAULT_PERFORMANCE_FILTER,search:'EV-V2G-0001',type:'ev-v2g'});assert.equal(ev.length,1);
  const ranked=assetPerformanceRows(model.assets,{...DEFAULT_PERFORMANCE_FILTER,sort:'imported',direction:'desc'});assert.equal(ranked[0].asset.id,'ev-v2g-0001');
  assert.equal(assetPerformanceRows(model.assets,{...DEFAULT_PERFORMANCE_FILTER,type:'commercial-bess'}).length,50);
  assert.deepEqual(model.assets.map(a=>a.asset.id),before);
});
test('current operational analytics are independent of historical range and match Phase 7 helpers',()=>{
  let state=recordedState();state=demoReducer(state,{type:'operations-health',assetId:state.assets[0].id,health:'fault'});
  const alert=state.operations.alerts.find(a=>a.key===`asset:${state.assets[0].id}:fault`);state=demoReducer(state,{type:'operations-acknowledge',alertId:alert.id});
  const all=buildAnalytics(state),empty=buildAnalytics(state,{mode:'custom',startStep:80,endStep:96}),expected=operationsMetrics(operationsSnapshot(state),state.operations);
  for(const key of ['online','offline','available','unavailable','healthy','connectivityPct','availabilityPct'])assert.equal(empty.operations[key],expected[key]);
  assert.deepEqual(all.operations,empty.operations);assert.ok(all.operations.alertCounts.acknowledged>0);assert.equal(empty.events.length,0);assert.equal(empty.alerts.length,0);
});
test('analytics aggregation and filtering are read-only and scenario analysis stays isolated',()=>{
  const state=freeze(recordedState()),before=structuredClone(state),model=buildAnalytics(state);
  assetPerformanceRows(model.assets,{...DEFAULT_PERFORMANCE_FILTER,search:'ev-v2g',sort:'gross'});
  buildAnalytics(state,{mode:'custom',startStep:0,endStep:9});
  assert.deepEqual(state,before);const scenario=runScenario('base',{...scenarioPresets[0].config},state.assets,state.commercialSettings);
  assert.ok(scenario.terminal);assert.deepEqual(state,before);assert.deepEqual(buildAnalytics(state).ledger,model.ledger);
});
test('analytics display formatting keeps two decimals and signs without negative zero',()=>{
  assert.equal(formatUSD(-.255),'-$0.26');assert.equal(formatNumber(2.34375),'2.34');assert.equal(formatEnergy(.0015,'fleet'),'0 MWh');assert.equal(formatNumber(-.00000001),'0');
});
