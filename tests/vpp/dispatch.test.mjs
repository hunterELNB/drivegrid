import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssets, availableDispatchMW } from '../../lib/vpp/domain.ts';
import { dispatchAsset, executeDispatch, CHARGE_EFFICIENCY, DISCHARGE_EFFICIENCY } from '../../lib/vpp/dispatch.ts';
import { createInitialState, demoReducer } from '../../lib/vpp/simulation.ts';
import { mwToKw, kwToMw, mwhToKwh, kwhToMwh, formatPower, formatEnergy, formatNumber } from '../../lib/vpp/units.ts';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ~= ${expected}`);
const asset = (changes={}) => ({...createAssets()[0],...changes});
const request = (changes={}) => ({command:'discharge',requestedPowerMW:.006,assetId:'ev-v2g-0001',...changes});
const action = (state, changes={}) => ({type:'execute-dispatch',step:state.step,resetVersion:state.resetVersion,request:request(changes)});
const conserve = r => {
  near(r.acEnergyMWh + r.batteryEnergyDeltaMWh + r.lossMWh,0);
  near(r.requestedPowerMW,r.acceptedPowerMW+r.rejectedPowerMW+r.curtailedPowerMW);
  near(r.requestedEnergyMWh,r.acceptedEnergyMWh+r.rejectedEnergyMWh+r.curtailedEnergyMWh);
  near(r.acceptedEnergyMWh,r.acceptedPowerMW*.25);
};

test('unit conversions preserve MW/kW and MWh/kWh quantities, signs, and zero',()=>{
  near(mwToKw(.0072),7.2); near(kwToMw(7.2),.0072);
  near(mwhToKwh(.075),75); near(kwhToMwh(75),.075);
  for (const value of [0,-.0072,2.5,1234.56789]) {
    near(kwToMw(mwToKw(value)),value);
    near(kwhToMwh(mwhToKwh(value)),value);
  }
});
test('context units use conversion, deterministic precision, and equipment thresholds',()=>{
  assert.equal(formatPower(.0072,'ev-v2g'),'7.2 kW');
  assert.equal(formatEnergy(.075,'residential-battery'),'75 kWh');
  assert.equal(formatPower(2.5,'commercial-bess'),'2.5 MW');
  assert.equal(formatPower(.24,'commercial-bess'),'240 kW');
  assert.equal(formatEnergy(.8,'commercial-bess'),'800 kWh');
  assert.equal(formatEnergy(2,'commercial-bess'),'2 MWh');
  assert.equal(formatPower(1,'commercial-bess'),'1 MW');
  assert.equal(formatPower(.0072,'fleet'),'0.01 MW');
  assert.equal(formatPower(-.0072,'record'),'-7.2 kW');
  assert.equal(formatEnergy(.0016625,'record'),'1.66 kWh');
  assert.equal(formatNumber(12.123456),'12.12');
  assert.equal(formatPower(-0,'record'),'0 kW');
  assert.equal(formatEnergy(.000078947,'fleet'),'0 MWh');
  assert.equal(formatNumber(-1.6625),'-1.66');
});
test('15-minute discharge uses AC export and battery-side withdrawal including loss',()=>{
  const a=asset(); const r=dispatchAsset(a,'discharge',.006);
  assert.equal(r.status,'accepted'); near(r.acEnergyMWh,.0015);
  near(r.batteryEnergyDeltaMWh,-.0015/DISCHARGE_EFFICIENCY);
  near(r.socAfterPct,68-.0015/DISCHARGE_EFFICIENCY/.075*100);
  assert.ok(r.lossMWh>0); conserve(r); assert.equal(a.socPct,68);
});
test('15-minute charge uses negative AC import and positive battery gain including loss',()=>{
  const r=dispatchAsset(asset(),'charge',.007);
  assert.equal(r.status,'accepted'); near(r.acEnergyMWh,-.00175);
  near(r.batteryEnergyDeltaMWh,.00175*CHARGE_EFFICIENCY);
  near(r.socAfterPct,68+.00175*CHARGE_EFFICIENCY/.075*100);
  assert.ok(r.lossMWh>0); conserve(r);
});
test('power limits curtail requests and distinguish rejected versus curtailed quantities',()=>{
  for(const command of ['charge','discharge']) {
    const r=dispatchAsset(asset(),command,1);
    assert.equal(r.status,'curtailed');
    near(r.acceptedPowerMW,command==='charge'?.007:.006);
    near(r.rejectedPowerMW,0); assert.ok(r.curtailedPowerMW>0); assert.ok(r.reasons.length); conserve(r);
  }
  const r=dispatchAsset(asset({ratedPowerMW:.002}),'discharge',.006);
  near(r.acceptedPowerMW,.002); conserve(r);
});
test('energy headroom clips charging at maximum SOC with conversion losses',()=>{
  const a=asset({ratedPowerMW:2,maxChargingPowerMW:2,energyCapacityMWh:1,socPct:99});
  const r=dispatchAsset(a,'charge',2);
  assert.equal(r.status,'curtailed'); near(r.socAfterPct,100);
  near(r.acceptedPowerMW,.01/(.95*.25)); near(r.batteryEnergyDeltaMWh,.01);
  assert.match(r.reasons.join(' '),/Maximum SOC/); conserve(r);
  assert.equal(dispatchAsset({...a,socPct:100},'charge',2).status,'rejected');
});
test('minimum SOC reserve clips discharge and makes available power duration-aware',()=>{
  const a=asset({ratedPowerMW:2,maxDischargingPowerMW:2,energyCapacityMWh:1,socPct:21});
  const r=dispatchAsset(a,'discharge',2);
  assert.equal(r.status,'curtailed'); near(r.socAfterPct,20);
  near(r.acceptedPowerMW,.01*.95/.25); near(r.batteryEnergyDeltaMWh,-.01); conserve(r);
  near(availableDispatchMW(a),r.acceptedPowerMW);
  assert.equal(dispatchAsset({...a,socPct:20},'discharge',2).status,'rejected');
});
test('offline, unavailable, standby, maintenance and non-V2G discharge reject with reasons',()=>{
  for(const changes of [{status:'offline'},{status:'maintenance'},{status:'standby'},{availability:'unavailable'},{v2gEnabled:false}]) {
    const r=dispatchAsset(asset(changes),'discharge',.006);
    assert.equal(r.status,'rejected'); near(r.rejectedPowerMW,.006); near(r.acEnergyMWh,0);
    near(r.socAfterPct,68); assert.ok(r.reasons.length); conserve(r);
  }
  assert.equal(dispatchAsset(asset({v2gEnabled:false}),'charge',.006).status,'accepted');
});
test('invalid requests and equipment never change energy or asset SOC',()=>{
  for(const value of [-1,NaN,Infinity,-Infinity,0]) {
    const r=dispatchAsset(asset(),'discharge',value);
    assert.equal(r.status,'rejected'); near(r.acEnergyMWh,0); near(r.socAfterPct,68);
  }
  for(const changes of [{energyCapacityMWh:0},{ratedPowerMW:-1},{socPct:101},{minSocPct:70},{maxChargingPowerMW:NaN}]) {
    const r=dispatchAsset(asset(changes),'charge',1);
    assert.equal(r.status,'rejected'); near(r.acEnergyMWh,0);
  }
  assert.equal(dispatchAsset(asset(),'invalid',1).status,'rejected');
});
test('Idle is zero-energy and positive Idle power is invalid',()=>{
  const r=dispatchAsset(asset({status:'offline'}),'idle',0);
  assert.equal(r.status,'accepted'); near(r.socAfterPct,68); conserve(r);
  assert.equal(dispatchAsset(asset(),'idle',1).status,'rejected');
});
test('fleet allocation is greedy in stable ID order and respects exclusions',()=>{
  const assets=[asset({id:'b'}),asset({id:'a'}),asset({id:'c',availability:'unavailable'})];
  const r=executeDispatch(assets,request({assetId:null,requestedPowerMW:.009}));
  assert.equal(r.status,'accepted');
  assert.deepEqual(r.records.map(x=>x.assetId),['a','b']);
  near(r.records[0].acceptedPowerMW,.006); near(r.records[1].acceptedPowerMW,.003);
  assert.deepEqual(r.exclusions.map(x=>x.assetId),['c']); conserve(r);
  const reversed=executeDispatch([...assets].reverse(),r.request);
  assert.deepEqual(reversed.records,r.records); assert.deepEqual(reversed.exclusions,r.exclusions);
  assert.equal(assets[0].socPct,68);
});
test('fleet summary accounts for unallocated power once, without duplicate rejected demand',()=>{
  const assets=[asset({id:'a'}),asset({id:'b'})];
  const r=executeDispatch(assets,request({assetId:null,requestedPowerMW:1}));
  assert.equal(r.status,'curtailed'); near(r.acceptedPowerMW,.012); near(r.curtailedPowerMW,.988); conserve(r);
  const rejected=executeDispatch([asset({status:'offline'})],request({assetId:null}));
  assert.equal(rejected.status,'rejected'); conserve(rejected); assert.ok(rejected.reasons.length);
  assert.equal(executeDispatch(assets,request({assetId:'missing'})).status,'rejected');
  assert.equal(executeDispatch([],request({assetId:null})).status,'rejected');
});
test('reducer execution consumes one interval, records timestamps, and blocks duplicate attempts',()=>{
  const initial=createInitialState(); const event=action(initial);
  const next=demoReducer(initial,event);
  assert.equal(next.step,1); assert.equal(next.history.length,1);
  assert.equal(next.history[0].timestamp,'2026-10-23T05:00:00.000Z');
  assert.equal(next.history[0].endTimestamp,'2026-10-23T05:15:00.000Z');
  assert.ok(next.assets[0].socPct<68);
  const duplicate=demoReducer(next,event);
  assert.equal(duplicate.step,1); assert.equal(duplicate.history,next.history); assert.equal(duplicate.assets,next.assets);
  assert.match(duplicate.dispatchError,/blocked/);
  const second=demoReducer(next,action(next));
  assert.equal(new Set(second.history.map(h=>h.timestamp)).size,2);
});
test('playback and manual step do not dispatch; running/end-of-day/stale reset commands are blocked',()=>{
  const initial=createInitialState(); const running=demoReducer(initial,{type:'start'});
  const blocked=demoReducer(running,action(running)); assert.equal(blocked.history.length,0);
  const ticked=demoReducer(running,{type:'tick'});
  assert.equal(ticked.assets,initial.assets); assert.equal(ticked.history.length,0);
  const stepped=demoReducer(initial,{type:'step'});
  const executed=demoReducer(stepped,action(stepped));
  assert.equal(executed.history[0].timestamp,'2026-10-23T05:15:00.000Z');
  assert.equal(demoReducer({...initial,step:96},action({...initial,step:96})).history.length,0);
  const reset=demoReducer(executed,{type:'reset'});
  assert.equal(demoReducer(reset,action(initial)).history.length,0);
});
test('valid physical rejection and Idle consume an interval; invalid input does not',()=>{
  const initial=createInitialState();
  const unavailable=initial.assets.find(a=>a.status==='offline');
  const r=demoReducer(initial,action(initial,{assetId:unavailable.id}));
  assert.equal(r.step,1); assert.equal(r.history[0].status,'rejected');
  const idle=demoReducer(initial,action(initial,{command:'idle',requestedPowerMW:0}));
  assert.equal(idle.step,1); near(idle.assets[0].socPct,68);
  assert.equal(demoReducer(initial,action(initial,{requestedPowerMW:NaN})).step,0);
});
test('reset and replay produce identical history/SOC and clear simulation errors',()=>{
  function replay(state) {
    for(const command of ['discharge','charge','idle']) state=demoReducer(state,action(state,{command,requestedPowerMW:command==='idle'?0:.006}));
    return state;
  }
  const first=replay(createInitialState());
  const reset=demoReducer(first,{type:'reset'});
  assert.equal(reset.history.length,0); near(reset.assets[0].socPct,68); assert.equal(reset.step,0);
  const second=replay(reset);
  assert.deepEqual(second.history,first.history); assert.deepEqual(second.assets,first.assets);
  assert.equal(second.dispatchError,'');
});
test('conservation and SOC bounds hold throughout repeated mixed fleet intervals',()=>{
  let assets=createAssets();
  for(let i=0;i<96;i++) {
    const result=executeDispatch(assets,request({assetId:null,command:i%3===0?'charge':'discharge',requestedPowerMW:30}));
    conserve(result);
    for(const r of result.records) conserve(r);
    for(const a of result.assets) assert.ok(a.socPct>=a.minSocPct-1e-9 && a.socPct<=a.maxSocPct+1e-9);
    const before=assets.reduce((sum,a)=>sum+a.energyCapacityMWh*a.socPct/100,0);
    const after=result.assets.reduce((sum,a)=>sum+a.energyCapacityMWh*a.socPct/100,0);
    near(after-before,result.batteryEnergyDeltaMWh);
    assets=result.assets;
  }
});
