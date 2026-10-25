import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,demoReducer} from '../../lib/vpp/simulation.ts';
import {validDispatchRequest} from '../../lib/vpp/dispatch.ts';
import {validateMarketSettings,DEFAULT_MARKET_SETTINGS} from '../../lib/vpp/market-decision.ts';
import {validateScenario,scenarioPresets,runScenario} from '../../lib/vpp/scenarios.ts';
import {validateTerminalSettings,DEFAULT_TERMINAL_SETTINGS} from '../../lib/vpp/terminal-energy.ts';
import {buildAnalytics} from '../../lib/vpp/analytics.ts';
import {validAssetUpdate} from '../../lib/vpp/domain.ts';
const execute=state=>demoReducer(state,{type:'execute-dispatch',step:state.step,resetVersion:state.resetVersion,request:{command:'discharge',requestedPowerMW:1,assetId:null}});
test('independent visitor state factories do not share mutable assets, settings, alerts or history',()=>{
 const a=createInitialState(),b=createInitialState(),before=structuredClone(b);
 assert.notEqual(a.assets,b.assets);assert.notEqual(a.assets[0],b.assets[0]);assert.notEqual(a.operations.alerts[0],b.operations.alerts[0]);assert.notEqual(a.marketSettings,b.marketSettings);
 let changed=execute(a);changed=demoReducer(changed,{type:'operations-health',assetId:a.assets[0].id,health:'fault'});
 assert.equal(changed.history.length,1);assert.notDeepEqual(changed.assets,a.assets);assert.deepEqual(b,before);
 assert.equal(buildAnalytics(b).ledger.totals.grossCents,0);assert.notEqual(buildAnalytics(changed).ledger.totals.grossCents,0);
});
test('public dispatch and market bounds reject nonfinite and excessive magnitudes',()=>{
 for(const value of [NaN,Infinity,-Infinity,Number.MAX_VALUE,101,-1]){
 assert.equal(validDispatchRequest({command:'charge',requestedPowerMW:value,assetId:null}),false);
 assert.ok(validateMarketSettings({...DEFAULT_MARKET_SETTINGS,requestedFleetPowerMW:value}));
 }
 assert.equal(validDispatchRequest({command:'charge',requestedPowerMW:100,assetId:null}),true);
 for(const value of [NaN,Infinity,100001,-100001])assert.ok(validateMarketSettings({...DEFAULT_MARKET_SETTINGS,chargeThresholdUSDPerMWh:value}));
 assert.ok(validateMarketSettings({...DEFAULT_MARKET_SETTINGS,chargeThresholdUSDPerMWh:300}));
});
test('all scenario and terminal numeric fields reject nonfinite, missing and contradictory values',()=>{
 const base={...scenarioPresets[0].config};
 for(const key of Object.keys(base))for(const value of [NaN,Infinity,-Infinity,undefined])assert.ok(validateScenario({...base,[key]:value}),key);
 for(const change of [{intervals:97},{intervals:1.5},{capacityMultiplier:11},{reserveSocPct:101},{requestedFleetPowerMW:101},{chargeThresholdUSDPerMWh:301}])assert.ok(validateScenario({...base,...change}));
 for(const key of ['referencePriceUSDPerMWh','targetSocPct','tolerancePct'])for(const value of [NaN,Infinity,-Infinity])assert.ok(validateTerminalSettings({...DEFAULT_TERMINAL_SETTINGS,[key]:value}));
 assert.ok(validateTerminalSettings({...DEFAULT_TERMINAL_SETTINGS,targetSocPct:101}));
});
test('SOC and missing IDs cannot produce a partial dispatch or invalid asset state',()=>{
 const initial=createInitialState(),asset=initial.assets[0];
 for(const value of [NaN,Infinity,-1,101])assert.equal(validAssetUpdate(asset,{socPct:value,status:'ready',availability:'available'}),false);
 const next=demoReducer(initial,{type:'execute-dispatch',step:0,resetVersion:0,request:{command:'charge',requestedPowerMW:1,assetId:'missing'}});
 assert.equal(next.assets,initial.assets);assert.equal(next.history,initial.history);assert.equal(next.step,0);assert.ok(next.dispatchError);
 for(const value of [Infinity,1e300]){const blocked=demoReducer(initial,{type:'execute-dispatch',step:0,resetVersion:0,request:{command:'charge',requestedPowerMW:value,assetId:null}});assert.equal(blocked.step,0);assert.equal(blocked.history.length,0);}
});
test('unexpected calculation errors return a safe message and retain the complete previous state',()=>{
 const initial=createInitialState();const faulty={type:'execute-dispatch',step:0,resetVersion:0,get request(){throw new Error('SECRET C:/internal/path');}};
 const next=demoReducer(initial,faulty);assert.equal(next.assets,initial.assets);assert.equal(next.history,initial.history);assert.equal(next.operations,initial.operations);assert.equal(next.step,0);assert.equal(next.running,false);assert.ok(next.dispatchError);assert.doesNotMatch(next.dispatchError,/SECRET|internal|path/);
});
test('main Reset clears monitoring, restoration metadata, finance and history; replay is deterministic',()=>{
 const initial=createInitialState();let changed=execute(initial);changed=demoReducer(changed,{type:'operations-connectivity',assetId:initial.assets[0].id,online:false});
 const reset=demoReducer(changed,{type:'reset'});assert.equal(reset.resetVersion,1);assert.deepEqual({...reset,resetVersion:0},initial);assert.deepEqual(execute(reset).history,execute(initial).history);
});
test('Operations Reset preserves core state and availability restoration remains idempotent',()=>{
 const initial=createInitialState(),asset=initial.assets[0];let state=execute(initial);const history=state.history;
 state=demoReducer(state,{type:'operations-connectivity',assetId:asset.id,online:false});const assets=state.assets;
 state=demoReducer(state,{type:'operations-reset'});assert.equal(state.assets,assets);assert.equal(state.history,history);
 state=demoReducer(state,{type:'operations-connectivity',assetId:asset.id,online:true});assert.equal(state.assets[0].status,'ready');assert.equal(state.assets[0].availability,'available');
 const online=state;assert.equal(demoReducer(state,{type:'operations-connectivity',assetId:asset.id,online:true}),online);
});
test('full-day scenarios and read-only analytics preserve visitor state and settled results',()=>{
 const state=execute(createInitialState()),before=structuredClone(state),ledger=buildAnalytics(state).ledger;
 const scenario=runScenario('base',{...scenarioPresets[0].config},state.assets,state.commercialSettings);assert.equal(scenario.points.length,96);assert.ok(scenario.reconciled);
 buildAnalytics(state,{mode:'last4h',startStep:0,endStep:96});assert.deepEqual(state,before);assert.deepEqual(buildAnalytics(state).ledger,ledger);
});
