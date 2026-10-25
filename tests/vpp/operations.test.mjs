import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssets} from '../../lib/vpp/domain.ts';
import {createInitialState,demoReducer,operationsSnapshot,simulationTimestamp} from '../../lib/vpp/simulation.ts';
import {assetMonitoring,assetSeed,healthFixture,deriveAlertConditions,reconcileAlerts,operationsMetrics,dispatchLog,eventTimeline} from '../../lib/vpp/operations.ts';
import {settleHistory} from '../../lib/vpp/settlement.ts';
import {runScenario,scenarioPresets} from '../../lib/vpp/scenarios.ts';
import {formatNumber,formatPower,formatEnergy} from '../../lib/vpp/units.ts';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ~= ${b}`);
const monitor=(state,id=state.assets[0].id)=>assetMonitoring(state.assets.find(a=>a.id===id),state.operations,operationsSnapshot(state));
const fault=(state,id=state.assets[0].id)=>demoReducer(state,{type:'operations-health',assetId:id,health:'fault'});
const findAlert=(state,key)=>state.operations.alerts.findLast(a=>a.key===key);
const execute=(state,request)=>demoReducer(state,{type:'execute-dispatch',step:state.step,resetVersion:state.resetVersion,request});

test('health seeds, telemetry fixtures, alert IDs and initialization are deterministic',()=>{
  const first=createInitialState(),second=createInitialState();assert.deepEqual(first,second);
  assert.deepEqual(first.assets.map(healthFixture),createAssets().map(healthFixture));assert.equal(assetSeed('ev-v2g-0001'),assetSeed('ev-v2g-0001'));
  const m=monitor(first);assert.ok(Date.parse(m.lastTelemetryAt)<=Date.parse(simulationTimestamp(0)));assert.ok(['healthy','warning','fault'].includes(m.health));
  assert.equal(new Set(first.operations.alerts.map(a=>a.id)).size,first.operations.alerts.length);
  assert.deepEqual(deriveAlertConditions(operationsSnapshot(first),first.operations),deriveAlertConditions(operationsSnapshot(second),second.operations));
});
test('offline control blocks physics and restores previous ready status',()=>{
  const initial=createInitialState(),id=initial.assets[0].id;
  const offline=demoReducer(initial,{type:'operations-connectivity',assetId:id,online:false});
  assert.equal(offline.assets[0].status,'offline');assert.equal(offline.assets[0].socPct,initial.assets[0].socPct);assert.equal(offline.assets[0].availability,initial.assets[0].availability);
  assert.equal(monitor(offline).online,false);assert.equal(monitor(offline).chargingPowerMW,0);assert.equal(monitor(offline).dischargingPowerMW,0);assert.equal(monitor(offline).dispatchAvailable,false);
  const rejected=execute(offline,{assetId:id,command:'discharge',requestedPowerMW:.006});assert.equal(rejected.history[0].status,'rejected');assert.equal(rejected.history[0].acEnergyMWh,0);
  const restored=demoReducer(offline,{type:'operations-connectivity',assetId:id,online:true});assert.equal(restored.assets[0].status,'ready');assert.ok(monitor(restored).online);near(monitor(restored).dischargingPowerMW,.006);
  assert.equal(findAlert(restored,`asset:${id}:offline`).status,'resolved');
});
test('core Assets availability/status edits generate connectivity and availability events',()=>{
  const initial=createInitialState(),asset=initial.assets[0];
  const changed=demoReducer(initial,{type:'update-asset',id:asset.id,update:{socPct:asset.socPct,availability:'unavailable',status:'offline'}});
  assert.ok(changed.operations.events.some(e=>e.type==='connectivity'&&e.source===asset.id));assert.ok(changed.operations.events.some(e=>e.type==='asset-change'&&e.source===asset.id));
  assert.equal(findAlert(changed,`asset:${asset.id}:unavailable`).status,'open');assert.equal(monitor(changed).online,false);
});
test('fault acknowledgment does not repair or resolve an active persistent condition',()=>{
  let state=fault(createInitialState());const id=state.assets[0].id,key=`asset:${id}:fault`,alert=findAlert(state,key);
  state=demoReducer(state,{type:'operations-acknowledge',alertId:alert.id});assert.equal(findAlert(state,key).status,'acknowledged');assert.equal(monitor(state).health,'fault');
  const rejected=demoReducer(state,{type:'operations-resolve',alertId:alert.id});assert.equal(findAlert(rejected,key).status,'acknowledged');assert.ok(rejected.operations.message.includes('Cannot resolve'));
  const afterClock=demoReducer(rejected,{type:'step'});assert.equal(findAlert(afterClock,key).status,'acknowledged');assert.equal(afterClock.operations.alerts.filter(a=>a.key===key).length,1);
  assert.ok(operationsMetrics(operationsSnapshot(afterClock),afterClock.operations).criticalAlerts>0);
});
test('clearing a fault resolves it; recurrence creates a distinct next episode',()=>{
  const first=fault(createInitialState()),id=first.assets[0].id,key=`asset:${id}:fault`,firstAlert=findAlert(first,key);
  const cleared=demoReducer(first,{type:'operations-health',assetId:id,health:'healthy'});
  assert.equal(findAlert(cleared,key).status,'resolved');assert.equal(findAlert(cleared,key).active,false);assert.equal(monitor(cleared).health,'healthy');
  const recurrence=fault(cleared);assert.equal(findAlert(recurrence,key).episode,firstAlert.episode+1);assert.notEqual(findAlert(recurrence,key).id,firstAlert.id);assert.equal(findAlert(recurrence,key).status,'open');
  const unchanged=fault(recurrence);assert.deepEqual(unchanged.operations.alerts,recurrence.operations.alerts);
});
test('alert reconciliation deduplicates persistent conditions and uses simulation time',()=>{
  const initial=fault(createInitialState()),before=structuredClone(initial);
  const reconciled=reconcileAlerts(initial.operations,operationsSnapshot(initial));assert.deepEqual(reconciled.alerts,initial.operations.alerts);assert.deepEqual(initial,before);
  let next=initial;for(let i=0;i<8;i++)next=demoReducer(next,{type:'step'});
  const key=`asset:${initial.assets[0].id}:fault`;assert.equal(next.operations.alerts.filter(a=>a.key===key).length,1);assert.equal(findAlert(next,key).createdAt,simulationTimestamp(0));
  assert.equal(next.operations.events.filter(e=>e.type==='clock').length,2);
});
test('low SOC, unavailable and stale telemetry alert conditions are derived independently',()=>{
  const initial=createInitialState(),asset=initial.assets[0];
  let state=demoReducer(initial,{type:'update-asset',id:asset.id,update:{socPct:20,availability:'unavailable',status:'ready'}});
  assert.ok(findAlert(state,`asset:${asset.id}:soc-low`));assert.ok(findAlert(state,`asset:${asset.id}:unavailable`));
  state=demoReducer(state,{type:'operations-connectivity',assetId:asset.id,online:false});const frozen=monitor(state).lastTelemetryAt;
  for(let i=0;i<4;i++)state=demoReducer(state,{type:'step'});
  assert.equal(monitor(state).lastTelemetryAt,frozen);assert.ok(monitor(state).stale);assert.ok(findAlert(state,`asset:${asset.id}:telemetry-stale`));
});
test('warning/fault health annotations alone do not change accepted physics or financial state',()=>{
  const initial=createInitialState(),before=structuredClone(initial),id=initial.assets[0].id;
  const annotated=fault(initial);assert.equal(annotated.assets,initial.assets);assert.equal(annotated.history,initial.history);assert.equal(annotated.step,initial.step);assert.equal(annotated.marketRevision,initial.marketRevision);
  assert.equal(monitor(annotated).operationallyReady,false);assert.ok(monitor(annotated).dischargingPowerMW>0);
  const request={assetId:id,command:'discharge',requestedPowerMW:.006};
  const first=execute(initial,request),second=execute(annotated,request);assert.deepEqual(first.history,second.history);assert.deepEqual(first.assets,second.assets);
  assert.deepEqual(settleHistory(first.history,first.assets,first.commercialSettings),settleHistory(second.history,second.assets,second.commercialSettings));assert.deepEqual(initial,before);
});
test('dispatch log derives interval/asset scope without duplicating shared history',()=>{
  let state=createInitialState();const id=state.assets[0].id;
  state=execute(state,{assetId:id,command:'discharge',requestedPowerMW:1});
  state=execute(state,{assetId:null,command:'idle',requestedPowerMW:0});
  const before=structuredClone(state.history),log=dispatchLog(state.history);assert.equal(log.length,2);assert.equal(log[0].assetId,'Fleet');assert.equal(log[1].assetId,id);assert.equal(log[1].interval,state.history[0]);assert.ok(log[1].alertKey);
  assert.equal(log[0].alertKey,null);assert.deepEqual(state.history,before);assert.equal(state.operations.events.filter(e=>e.type==='dispatch').length,2);
});
test('historical dispatch alerts may resolve without changing execution and do not reopen',()=>{
  let state=createInitialState();state=execute(state,{assetId:state.assets[0].id,command:'discharge',requestedPowerMW:1});
  const alert=state.operations.alerts.find(a=>a.kind==='dispatch'),history=state.history;assert.equal(alert.active,false);
  state=demoReducer(state,{type:'operations-resolve',alertId:alert.id});assert.equal(state.operations.alerts.find(a=>a.id===alert.id).status,'resolved');assert.equal(state.history,history);
  state=demoReducer(state,{type:'step'});assert.equal(state.operations.alerts.filter(a=>a.key===alert.key).length,1);assert.equal(state.operations.alerts.find(a=>a.id===alert.id).status,'resolved');
});
test('KPIs distinguish counts, capacity weighting, open versus acknowledged and energy acceptance',()=>{
  const initial=createInitialState(),snapshot=operationsSnapshot(initial),metrics=operationsMetrics(snapshot,initial.operations);
  assert.equal(metrics.total,1150);assert.equal(metrics.online+metrics.offline,1150);assert.equal(metrics.available+metrics.unavailable,1150);near(metrics.availablePowerMW,12);near(metrics.weightedSocPct,68);assert.equal(metrics.acceptancePct,null);
  near(metrics.connectivityPct,metrics.online/metrics.total*100);near(metrics.availabilityPct,metrics.available/metrics.total*100);near(metrics.healthyPct,metrics.healthy/metrics.total*100);
  let state=execute(initial,{assetId:initial.assets[0].id,command:'discharge',requestedPowerMW:1});
  const next=operationsMetrics(operationsSnapshot(state),state.operations);near(next.acceptancePct,.6);near(next.curtailedMWh,.994*.25);assert.equal(next.recentDispatchCount,1);
  const active=state.operations.alerts.find(a=>a.severity==='critical'&&a.status==='open');
  state=demoReducer(state,{type:'operations-acknowledge',alertId:active.id});const ack=operationsMetrics(operationsSnapshot(state),state.operations);
  assert.equal(ack.criticalAlerts,next.criticalAlerts);assert.equal(ack.openBySeverity.critical,next.openBySeverity.critical-1);
});
test('event timeline has stable timestamp/sequence ordering, filters and limited clock noise',()=>{
  let state=createInitialState();state=fault(state);state=demoReducer(state,{type:'operations-health',assetId:state.assets[0].id,health:'healthy'});
  for(let i=0;i<96;i++)state=demoReducer(state,{type:'step'});
  const events=eventTimeline(state.operations.events);assert.equal(new Set(events.map(e=>e.id)).size,events.length);assert.equal(events.filter(e=>e.type==='clock').length,24);
  for(let i=1;i<events.length;i++)assert.ok(events[i-1].timestamp>events[i].timestamp||(events[i-1].timestamp===events[i].timestamp&&events[i-1].sequence>events[i].sequence));
  assert.ok(eventTimeline(state.operations.events,'health',state.assets[0].id).every(e=>e.type==='health'&&e.source===state.assets[0].id));
});
test('Operations Reset preserves main assets, clock, history and finances while resetting monitoring',()=>{
  let state=createInitialState();state=execute(state,{assetId:null,command:'charge',requestedPowerMW:1});state=fault(state);
  const oldAlert=state.operations.alerts[0];state=demoReducer(state,{type:'operations-acknowledge',alertId:oldAlert.id});
  const before=structuredClone(state),ledger=settleHistory(state.history,state.assets,state.commercialSettings),reset=demoReducer(state,{type:'operations-reset'});
  for(const key of ['assets','history','step','running','marketSettings','marketRevision','commercialSettings','resetVersion'])assert.deepEqual(reset[key],before[key]);
  assert.deepEqual(reset.operations.healthOverrides,{});assert.equal(reset.operations.generation,state.operations.generation+1);assert.ok(reset.operations.alerts.every(a=>a.status==='open'));
  assert.notEqual(reset.operations.alerts[0].id,oldAlert.id);assert.deepEqual(settleHistory(reset.history,reset.assets,reset.commercialSettings),ledger);
  assert.deepEqual(demoReducer(reset,{type:'operations-acknowledge',alertId:oldAlert.id}).operations.alerts,reset.operations.alerts);
});
test('Operations Reset does not silently restore a core offline asset or main demo edits',()=>{
  let state=createInitialState();state=demoReducer(state,{type:'operations-connectivity',assetId:state.assets[0].id,online:false});const reset=demoReducer(state,{type:'operations-reset'});
  assert.equal(reset.assets[0].status,'offline');assert.equal(monitor(reset).dispatchAvailable,false);
  const fullReset=demoReducer(reset,{type:'reset'});assert.deepEqual(fullReset,{...createInitialState(),resetVersion:1});
});
test('scenario analysis remains isolated from monitoring and main state',()=>{
  const state=fault(createInitialState()),before=structuredClone(state);Object.freeze(state.operations);Object.freeze(state.assets);
  runScenario('base',{...scenarioPresets[0].config},state.assets,state.commercialSettings);assert.deepEqual(state,before);
});
test('operations numerical displays keep two decimals and normalize negative zero',()=>{
  assert.equal(formatNumber(97.043478),'97.04');assert.equal(formatPower(11.994,'fleet'),'11.99 MW');assert.equal(formatEnergy(.2485,'fleet'),'0.25 MWh');assert.equal(formatNumber(-.000001),'0');
});
test('full-day dispatch monitoring retains 96 unique intervals without duplicated event records',()=>{
  let state=createInitialState();
  for(let step=0;step<96;step++)state=execute(state,{assetId:null,command:step%2===0?'charge':'discharge',requestedPowerMW:1});
  const log=dispatchLog(state.history),events=state.operations.events.filter(e=>e.type==='dispatch');
  assert.equal(state.step,96);assert.equal(log.length,96);assert.equal(events.length,96);
  assert.equal(new Set(log.map(row=>row.key)).size,96);assert.equal(new Set(events.map(e=>e.id)).size,96);
  assert.equal(state.operations.events.filter(e=>e.type==='clock').length,0);
  const active=state.operations.alerts.filter(a=>a.status!=='resolved');assert.equal(new Set(active.map(a=>a.key)).size,active.length);
  const metrics=operationsMetrics(operationsSnapshot(state),state.operations);assert.equal(metrics.dispatchCount,96);assert.equal(metrics.recentDispatchCount,4);
});
