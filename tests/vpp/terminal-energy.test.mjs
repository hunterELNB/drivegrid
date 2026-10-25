import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssets} from '../../lib/vpp/domain.ts';
import {runScenario,scenarioPresets} from '../../lib/vpp/scenarios.ts';
import {DEFAULT_COMMERCIAL_SETTINGS,settleHistory} from '../../lib/vpp/settlement.ts';
import {createInitialState,demoReducer} from '../../lib/vpp/simulation.ts';
import {DEFAULT_TERMINAL_SETTINGS,storedEnergy,evaluateTerminalEnergy,validateTerminalSettings} from '../../lib/vpp/terminal-energy.ts';
import {formatNumber,formatEnergy,formatUSD} from '../../lib/vpp/units.ts';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ~= ${b}`);
const fixture=createAssets()[0];
const asset=(capacity,soc)=>({...fixture,energyCapacityMWh:capacity,socPct:soc});
const settings=changes=>({...DEFAULT_TERMINAL_SETTINGS,...changes});
const config={...scenarioPresets[0].config};

test('stored energy and SOC weight actual capacity, including unavailable assets',()=>{
  const input=[asset(1,20),{...asset(3,80),availability:'unavailable'}];
  const summary=storedEnergy(input);near(summary.capacityMWh,4);near(summary.storedMWh,2.6);near(summary.weightedSocPct,65);
  assert.notEqual(summary.weightedSocPct,50);
  near(storedEnergy(input.map(a=>({...a,energyCapacityMWh:a.energyCapacityMWh*2}))).storedMWh,5.2);
  near(storedEnergy(input.map(a=>({...a,socPct:30}))).weightedSocPct,30);
});
test('terminal adjustment uses signed battery MWh and preserves precision separately from operating cash',()=>{
  const initial=[asset(2,50)],final=[asset(2,60)];
  const result=evaluateTerminalEnergy(initial,final,12.34,settings({}));
  near(result.initialStoredMWh,1);near(result.finalStoredMWh,1.2);near(result.netStoredMWh,.2);
  near(result.adjustmentUSD,20);near(result.adjustedEconomicValueUSD,32.34);
  const depleted=evaluateTerminalEnergy(final,initial,12.34,settings({}));near(depleted.adjustmentUSD,-20);near(depleted.adjustedEconomicValueUSD,-7.66);
  const precise=evaluateTerminalEnergy(initial,[asset(2,50.123456)],12.34,settings({referencePriceUSDPerMWh:123.456}));
  near(precise.adjustmentUSD,(precise.finalStoredMWh-precise.initialStoredMWh)*123.456);
});
test('reference price zero, negative and different positive assumptions affect valuation only',()=>{
  const initial=[asset(2,50)],final=[asset(2,40)];
  for(const price of [0,-100,100,200]){
    const r=evaluateTerminalEnergy(initial,final,50,settings({referencePriceUSDPerMWh:price}));near(r.adjustmentUSD,-.2*price);near(r.adjustedEconomicValueUSD,50-.2*price);
  }
});
test('default target is initial weighted SOC and tolerance is inclusive percentage points',()=>{
  const initial=[asset(1,20),asset(3,80)];
  const pass=evaluateTerminalEnergy(initial,[asset(1,22),asset(3,82)],0);near(pass.targetSocPct,65);near(pass.deviationPct,2);assert.equal(pass.status,'pass');assert.ok(pass.comparable);
  const lower=evaluateTerminalEnergy(initial,[asset(1,18),asset(3,78)],0);near(lower.deviationPct,-2);assert.equal(lower.status,'pass');
  const fail=evaluateTerminalEnergy(initial,[asset(1,22.00001),asset(3,82.00001)],0);assert.equal(fail.status,'fail');assert.equal(fail.comparable,false);
});
test('custom targets, zero tolerance, different initial SOC and empty portfolios are explicit',()=>{
  const initial=[asset(1,40)],final=[asset(1,60)];
  assert.equal(evaluateTerminalEnergy(initial,final,0,settings({targetSocPct:60,tolerancePct:0})).status,'pass');
  assert.equal(evaluateTerminalEnergy(initial,final,0,settings({targetSocPct:59.99,tolerancePct:0})).status,'fail');
  near(evaluateTerminalEnergy([asset(1,33.123456)],final,0).targetSocPct,33.123456);
  const empty=evaluateTerminalEnergy([],[],0);assert.equal(empty.status,'unavailable');assert.equal(empty.comparable,false);assert.equal(empty.adjustmentUSD,0);
});
test('invalid terminal assumptions and invalid energy inputs are rejected',()=>{
  for(const changes of [{referencePriceUSDPerMWh:NaN},{referencePriceUSDPerMWh:Infinity},{referencePriceUSDPerMWh:100001},{targetSocPct:-1},{targetSocPct:101},{targetSocPct:NaN},{tolerancePct:-1},{tolerancePct:101},{tolerancePct:Infinity}])assert.ok(validateTerminalSettings(settings(changes)));
  assert.equal(validateTerminalSettings(settings({referencePriceUSDPerMWh:-100,targetSocPct:0,tolerancePct:0})),null);
  for(const input of [[asset(-1,50)],[asset(1,101)],[asset(Infinity,50)]])assert.throws(()=>storedEnergy(input));
  assert.throws(()=>evaluateTerminalEnergy([],[],NaN));
});
test('A/B investigation reproduces physical differences with 96 unique intervals and consistent losses',()=>{
  const initial=createAssets();
  const a=runScenario('base',config,initial,DEFAULT_COMMERCIAL_SETTINGS);
  const b=runScenario('base',{...config,chargeThresholdUSDPerMWh:10,dischargeThresholdUSDPerMWh:100},initial,DEFAULT_COMMERCIAL_SETTINGS);
  // The Product Owner observations are investigated outputs, not constants driving the model.
  assert.ok(b.totals.netCents>a.totals.netCents);assert.ok(b.exportedMWh>a.exportedMWh);assert.ok(b.importedMWh<a.importedMWh);
  assert.ok(b.commands.discharge>a.commands.discharge);assert.ok(b.terminal.netStoredMWh<0);assert.ok(a.terminal.netStoredMWh>0);
  assert.equal(a.terminal.status,'pass');assert.equal(b.terminal.status,'fail');
  for(const r of [a,b]){
    assert.equal(new Set(r.points.map(p=>p.timestamp)).size,96);
    near(r.terminal.initialStoredMWh,r.initialStoredMWh);near(r.terminal.finalStoredMWh,r.finalStoredMWh);
    near(r.terminal.netStoredMWh,r.importedMWh*.95-r.exportedMWh/.95);
    near(r.terminal.netStoredMWh,r.importedMWh-r.exportedMWh-r.points.reduce((sum,p)=>sum+p.lossMWh,0));
    near(r.terminal.adjustmentUSD,r.terminal.netStoredMWh*100);
    near(r.terminal.adjustedEconomicValueUSD,r.totals.netCents/100+r.terminal.adjustmentUSD);
    for(const p of r.points){near(p.acEnergyMWh+p.batteryEnergyDeltaMWh+p.lossMWh,0);if(p.command==='idle')assert.equal(p.grossEnergyValueUSD,0);}
  }
});
test('valuation and target changes never change dispatch, cents, shares or settled history',()=>{
  const input=createAssets(),commercial={...DEFAULT_COMMERCIAL_SETTINGS};
  const first=runScenario('base',config,input,commercial);
  const changed=runScenario('base',config,input,commercial,settings({referencePriceUSDPerMWh:200,targetSocPct:90,tolerancePct:0}));
  assert.deepEqual(changed.points,first.points);assert.deepEqual(changed.finalAssets,first.finalAssets);assert.deepEqual(changed.totals,first.totals);
  near(changed.terminal.adjustmentUSD,first.terminal.adjustmentUSD*2);assert.equal(changed.terminal.status,'fail');
});
test('terminal assumptions and results remain deterministic and isolated from live state',()=>{
  let live=createInitialState();live=demoReducer(live,{type:'execute-market',step:0,resetVersion:0,revision:0});
  const original=structuredClone(live),assumptions=Object.freeze(settings({referencePriceUSDPerMWh:171.406,targetSocPct:70.123456}));
  const ledger=settleHistory(live.history,live.assets,live.commercialSettings);
  live.assets.forEach(Object.freeze);Object.freeze(live.assets);Object.freeze(live.commercialSettings);
  const first=runScenario('base',config,live.assets,live.commercialSettings,assumptions);
  assert.deepEqual(first,runScenario('base',config,live.assets,live.commercialSettings,assumptions));assert.deepEqual(live,original);
  assert.deepEqual(settleHistory(live.history,live.assets,live.commercialSettings),ledger);
});
test('terminal UI formats two decimals, correct units and no negative zero',()=>{
  assert.equal(formatEnergy(-7.811184210526,'fleet'),'-7.81 MWh');assert.equal(formatUSD(-781.1184210526),'-$781.12');
  assert.equal(formatNumber(-6.63652014488),'-6.64');assert.equal(formatNumber(-.0000001),'0');assert.equal(formatUSD(-0),'$0.00');
});
