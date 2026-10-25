import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,demoReducer,operationsSnapshot} from '../../lib/vpp/simulation.ts';
import {assetMonitoring,operationsMetrics} from '../../lib/vpp/operations.ts';
import {portfolioMetrics} from '../../lib/vpp/domain.ts';
import {dispatchLimit} from '../../lib/vpp/dispatch.ts';
import {settleHistory} from '../../lib/vpp/settlement.ts';

const connect=(state,online,id=state.assets[0].id)=>demoReducer(state,{type:'operations-connectivity',assetId:id,online});
const update=(state,changes)=>demoReducer(state,{type:'update-asset',id:state.assets[0].id,update:{socPct:state.assets[0].socPct,availability:state.assets[0].availability,status:state.assets[0].status,...changes}});
const metrics=state=>operationsMetrics(operationsSnapshot(state),state.operations);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9);

test('Available → Offline → Online restores status, availability counts and accepted capability',()=>{
  const initial=createInitialState(),offline=connect(initial,false),online=connect(offline,true);
  assert.equal(metrics(initial).available,1020);assert.equal(metrics(offline).available,1019);assert.equal(metrics(online).available,1020);
  assert.deepEqual(online.assets,initial.assets);assert.deepEqual(online.preOfflineStatus,{});
  near(dispatchLimit(online.assets[0],'discharge').powerMW,.006);
  assert.equal(online.step,initial.step);assert.equal(online.history,initial.history);assert.equal(online.commercialSettings,initial.commercialSettings);
});
test('an initially unavailable asset remains unavailable after restoring online',()=>{
  const initial=update(createInitialState(),{availability:'unavailable'}),online=connect(connect(initial,false),true);
  assert.deepEqual(online.assets,initial.assets);assert.equal(online.assets[0].status,'ready');assert.equal(online.assets[0].availability,'unavailable');
  assert.equal(metrics(online).available,metrics(initial).available);assert.equal(dispatchLimit(online.assets[0],'charge').powerMW,0);
});
test('repeated connectivity cycles and duplicate commands are idempotent',()=>{
  const initial=createInitialState();let state=initial;
  for(let cycle=0;cycle<10;cycle++){
    state=connect(state,false);const offline=state;state=connect(state,false);assert.equal(state,offline);assert.equal(state.preOfflineStatus[state.assets[0].id],'ready');
    state=connect(state,true);const online=state;state=connect(state,true);assert.equal(state,online);assert.deepEqual(state.preOfflineStatus,{});
    assert.deepEqual(state.assets,initial.assets);assert.equal(metrics(state).available,1020);
  }
});
test('offline dispatch remains rejected and restoring connectivity does not rewrite execution',()=>{
  let state=connect(createInitialState(),false);
  state=demoReducer(state,{type:'execute-dispatch',step:state.step,resetVersion:state.resetVersion,request:{assetId:state.assets[0].id,command:'discharge',requestedPowerMW:.006}});
  assert.equal(state.history[0].status,'rejected');assert.equal(state.history[0].acEnergyMWh,0);
  const history=state.history,ledger=settleHistory(history,state.assets,state.commercialSettings),online=connect(state,true);
  assert.equal(online.assets[0].status,'ready');assert.equal(online.history,history);assert.equal(online.step,state.step);
  assert.deepEqual(settleHistory(online.history,online.assets,online.commercialSettings),ledger);
});
test('restoring online preserves faults, acknowledgments and restrictions changed while offline',()=>{
  let state=createInitialState();const id=state.assets[0].id;
  state=demoReducer(state,{type:'operations-health',assetId:id,health:'fault'});
  const fault=state.operations.alerts.find(a=>a.key===`asset:${id}:fault`);
  state=demoReducer(state,{type:'operations-acknowledge',alertId:fault.id});
  state=update(connect(state,false),{availability:'unavailable',socPct:20});state=connect(state,true);
  assert.equal(state.assets[0].availability,'unavailable');assert.equal(state.assets[0].socPct,20);
  assert.equal(state.operations.healthOverrides[id],'fault');assert.equal(state.operations.alerts.find(a=>a.id===fault.id).status,'acknowledged');
  assert.equal(assetMonitoring(state.assets[0],state.operations,operationsSnapshot(state)).operationallyReady,false);assert.equal(dispatchLimit(state.assets[0],'discharge').powerMW,0);
});
test('standby and maintenance restrictions are restored, not promoted to ready',()=>{
  for(const status of ['standby','maintenance']){
    const initial=update(createInitialState(),{status}),online=connect(connect(initial,false),true);
    assert.equal(online.assets[0].status,status);assert.equal(dispatchLimit(online.assets[0],'discharge').powerMW,0);
  }
  // An explicit status edit while offline supersedes the remembered ready state.
  const edited=update(connect(createInitialState(),false),{status:'maintenance'});
  assert.deepEqual(edited.preOfflineStatus,{});assert.equal(connect(edited,true),edited);assert.equal(edited.assets[0].status,'maintenance');
});
test('Operations KPIs and core Assets/Dispatch capability stay consistent throughout transitions',()=>{
  let state=createInitialState();
  for(const online of [false,true,false,true]){
    state=connect(state,online);const ops=metrics(state),core=portfolioMetrics(state.assets);
    near(ops.availablePowerMW,core.availablePowerMW);
    assert.equal(ops.available,state.assets.filter(a=>dispatchLimit(a,'discharge').powerMW>0).length);
    assert.equal(ops.online,state.assets.filter(a=>a.status!=='offline').length);
    const asset=assetMonitoring(state.assets[0],state.operations,operationsSnapshot(state));assert.equal(asset.online,online);assert.equal(asset.dispatchAvailable,online);
  }
});
test('Operations Reset preserves restoration metadata and core history; Reset demo clears it',()=>{
  let state=createInitialState();state=demoReducer(state,{type:'execute-market',step:0,resetVersion:0,revision:0});state=connect(state,false);
  const before=structuredClone(state),reset=demoReducer(state,{type:'operations-reset'});
  assert.deepEqual(reset.preOfflineStatus,before.preOfflineStatus);assert.deepEqual(reset.assets,before.assets);assert.deepEqual(reset.history,before.history);assert.equal(reset.step,before.step);
  const online=connect(reset,true);assert.equal(online.assets[0].status,'ready');assert.equal(metrics(online).available,1020);
  assert.deepEqual(online.history,before.history);assert.deepEqual(online.commercialSettings,before.commercialSettings);
  const full=demoReducer(state,{type:'reset'});assert.deepEqual(full.preOfflineStatus,{});assert.deepEqual(full.assets,createInitialState().assets);
});
test('seeded offline assets without a recorded prior status use safe standby fallback',()=>{
  const initial=createInitialState(),asset=initial.assets.find(a=>a.status==='offline');
  const online=connect(initial,true,asset.id),restored=online.assets.find(a=>a.id===asset.id);
  assert.equal(restored.status,'standby');assert.equal(restored.availability,asset.availability);assert.equal(dispatchLimit(restored,'discharge').powerMW,0);
});
