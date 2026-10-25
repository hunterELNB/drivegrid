import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_COMMERCIAL_SETTINGS, aggregateSettlement, settleHistory, usdToCents, validateCommercialSettings } from '../../lib/vpp/settlement.ts';
import { createInitialState, demoReducer } from '../../lib/vpp/simulation.ts';
import { marketPriceAt, marketPrices, marketStatistics } from '../../lib/vpp/market-data.ts';
import { DEFAULT_MARKET_SETTINGS, recommendMarket } from '../../lib/vpp/market-decision.ts';
import { formatMarketPrice, usdPerKwhToUsdPerMwh, usdPerMwhToUsdPerKwh } from '../../lib/vpp/units.ts';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} ~= ${expected}`);
const execute=(state,command='discharge',power=.006,assetId='ev-v2g-0001')=>demoReducer(state,{type:'execute-dispatch',step:state.step,resetVersion:state.resetVersion,request:{command,requestedPowerMW:command==='idle'?0:power,assetId}});
const run=(step,command='discharge')=>execute({...createInitialState(),step},command);
const ledger=state=>settleHistory(state.history,state.assets,state.commercialSettings);
const reconcile=amounts=>{
  assert.equal(amounts.grossCents-amounts.qseCents-amounts.transactionCents-amounts.degradationCents,amounts.netCents);
  assert.equal(amounts.ownerCents+amounts.platformCents-amounts.deficitCents,amounts.netCents);
};

test('refined scenario preserves 96 clock intervals and all five requested levels',()=>{
  assert.equal(marketPrices.length,96);
  assert.equal(marketStatistics().minimum,-200);assert.equal(marketStatistics().maximum,2500);
  for(const [step,price] of [[0,30],[8,-200],[32,100],[68,500],[74,2500]]) assert.equal(marketPriceAt(step),price);
  for(const price of [-200,30,100,500]) assert.ok(marketPrices.filter(p=>p.priceUSDPerMWh===price).length>=2);
  assert.equal(marketPrices.filter(p=>p.priceUSDPerMWh===2500).length,1);
  assert.equal(DEFAULT_MARKET_SETTINGS.chargeThresholdUSDPerMWh,50);
  assert.equal(DEFAULT_MARKET_SETTINGS.dischargeThresholdUSDPerMWh,300);
  for(let i=1;i<68;i++) if(i!==8&&i!==10) assert.ok(Math.abs(marketPriceAt(i)-marketPriceAt(i-1))<=120);
});
test('USD/MWh and USD/kWh conversions and labels preserve equivalent price levels',()=>{
  for(const [mwh,kwh] of [[-200,-.2],[30,.03],[100,.1],[500,.5],[2500,2.5]]) {
    near(usdPerMwhToUsdPerKwh(mwh),kwh);near(usdPerKwhToUsdPerMwh(kwh),mwh);
  }
  assert.equal(formatMarketPrice(-200),'-200 USD/MWh (-0.20 USD/kWh)');
  assert.equal(formatMarketPrice(2500),'2,500 USD/MWh (2.50 USD/kWh)');
  assert.equal(formatMarketPrice(30),'30 USD/MWh (0.03 USD/kWh)');
});
test('default commercial model and positive EV settlement calculate fees and 70/30 shares',()=>{
  assert.deepEqual(DEFAULT_COMMERCIAL_SETTINGS,{ownerSharePct:70,platformSharePct:30,qseFeePct:5,transactionUSDPerMWh:1,degradationUSDPerKWh:.02});
  const result=ledger(run(68));const row=result.rows[0];
  assert.equal(row.assetId,'ev-v2g-0001');assert.equal(row.assetType,'ev-v2g');assert.equal(row.priceUSDPerMWh,500);
  assert.equal(row.grossCents,75);assert.equal(row.qseCents,4);assert.equal(row.transactionCents,0);assert.equal(row.degradationCents,3);
  assert.equal(row.netCents,68);assert.equal(row.ownerCents,48);assert.equal(row.platformCents,20);assert.equal(row.deficitCents,0);
  reconcile(row);assert.equal(result.reconciled,true);
});
test('positive-price import preserves negative gross and produces only an unallocated deficit',()=>{
  const row=ledger(run(0,'charge')).rows[0];
  near(row.rawGrossUSD,-.045);assert.equal(row.grossCents,-5);assert.equal(row.qseCents,0);
  assert.equal(row.degradationCents,3);assert.equal(row.netCents,-8);assert.equal(row.deficitCents,8);
  assert.equal(row.ownerCents,0);assert.equal(row.platformCents,0);reconcile(row);
});
test('negative-price charge earns positive gross while negative-price discharge incurs a deficit',()=>{
  const charge=ledger(run(8,'charge')).rows[0];
  assert.equal(charge.grossCents,30);assert.equal(charge.qseCents,2);assert.equal(charge.degradationCents,3);
  assert.equal(charge.netCents,25);assert.equal(charge.ownerCents,18);assert.equal(charge.platformCents,7);reconcile(charge);
  const discharge=ledger(run(8)).rows[0];
  assert.equal(discharge.grossCents,-30);assert.equal(discharge.qseCents,0);assert.equal(discharge.netCents,-33);assert.equal(discharge.deficitCents,33);reconcile(discharge);
});
test('transaction fees use absolute grid MWh and degradation uses absolute battery kWh once',()=>{
  const state=execute({...createInitialState(),step:68},'discharge',1,null);
  const result=ledger(state);const first=result.rows[0];
  near(first.acEnergyMWh,.03625);assert.equal(first.transactionCents,4);
  assert.equal(first.degradationCents,usdToCents(Math.abs(first.batteryEnergyDeltaMWh)*1000*.02));
  assert.equal(first.grossCents,usdToCents(first.acEnergyMWh*500));
  assert.equal(first.degradationCents,76);
  // No extra efficiency-loss fee exists; gross is grid energy only.
  reconcile(first);assert.equal(result.reconciled,true);
});
test('Idle and rejected zero-energy records never create fees, shares or deficits',()=>{
  const idle=ledger(execute(createInitialState(),'idle')).rows[0];
  const initial=createInitialState();const a=initial.assets[0];
  const unavailable=demoReducer(initial,{type:'update-asset',id:a.id,update:{socPct:a.socPct,status:a.status,availability:'unavailable'}});
  const rejected=ledger(execute(unavailable)).rows[0];
  for(const row of [idle,rejected]) for(const key of ['grossCents','qseCents','transactionCents','degradationCents','netCents','ownerCents','platformCents','deficitCents']) assert.equal(row[key],0);
});
test('zero net and allocation endpoints produce no fictitious payouts',()=>{
  const state=run(68);const settings={...DEFAULT_COMMERCIAL_SETTINGS,qseFeePct:100,transactionUSDPerMWh:0,degradationUSDPerKWh:0};
  const zero=settleHistory(state.history,state.assets,settings).rows[0];
  assert.equal(zero.netCents,0);assert.equal(zero.ownerCents,0);assert.equal(zero.platformCents,0);assert.equal(zero.deficitCents,0);
  for(const ownerSharePct of [0,100]) {
    const row=settleHistory(state.history,state.assets,{...DEFAULT_COMMERCIAL_SETTINGS,ownerSharePct,platformSharePct:100-ownerSharePct}).rows[0];
    assert.equal(ownerSharePct===0?row.ownerCents:row.platformCents,0);reconcile(row);
  }
});
test('fleet cents reconcile exactly with an explicit asset-rounding bridge to raw gross',()=>{
  const state=execute({...createInitialState(),step:68},'discharge',1,null);const result=ledger(state);
  assert.equal(result.rows.length,7);near(result.rawFleetGrossUSD,125);
  assert.equal(result.totals.grossCents,12503);near(result.roundingDifferenceUSD,.03);
  assert.ok(Math.abs(result.roundingDifferenceUSD)<=result.roundingToleranceUSD);
  assert.equal(result.residualCents,0);assert.equal(result.totals.ownerCents,7925);assert.equal(result.totals.platformCents,3400);
  reconcile(result.totals);for(const row of result.rows) reconcile(row);
  assert.deepEqual(aggregateSettlement(result.rows),result.totals);
});
test('attribution follows actual energy, not equal EV nameplate capacity',()=>{
  const initial=createInitialState();const state=execute({...initial,step:68,assets:initial.assets.slice(0,2)},'discharge',.009,null);
  const result=ledger(state);assert.equal(result.rows.length,2);
  near(result.rows[0].acEnergyMWh,.0015);near(result.rows[1].acEnergyMWh,.00075);
  assert.equal(result.rows[0].ownerCents,48);assert.equal(result.rows[1].ownerCents,24);
  assert.equal(aggregateSettlement(result.rows.filter(r=>r.assetId==='ev-v2g-0001')).ownerCents,48);
});
test('deficits are not netted against positive asset-interval payouts',()=>{
  let state=execute(createInitialState(),'charge');state=execute({...state,step:68});
  const result=ledger(state);
  assert.equal(result.totals.ownerCents,48);assert.equal(result.totals.platformCents,20);assert.equal(result.totals.deficitCents,8);
  assert.equal(result.totals.netCents,60);reconcile(result.totals);
});
test('duplicate asset intervals are suppressed; conflicts and missing attribution are rejected',()=>{
  const state=run(68);const interval=state.history[0];
  const once=ledger(state);
  const doubled=settleHistory([interval,interval],state.assets,state.commercialSettings);
  assert.deepEqual(doubled.totals,once.totals);assert.equal(doubled.rows.length,1);assert.equal(doubled.duplicatesIgnored,1);assert.equal(doubled.intervals.length,1);
  const repeatedRecord={...interval,records:[...interval.records,...interval.records]};
  assert.equal(settleHistory([repeatedRecord],state.assets,state.commercialSettings).rows.length,1);
  assert.throws(()=>settleHistory([{...interval,records:[...interval.records,{...interval.records[0],acEnergyMWh:.002}]}],state.assets,state.commercialSettings),/Conflicting duplicate/);
  assert.throws(()=>settleHistory(state.history,[],state.commercialSettings),/Unknown settlement asset/);
  assert.throws(()=>settleHistory([{...interval,acEnergyMWh:.5}],state.assets,state.commercialSettings),/do not reconcile/);
});
test('manual and market settlement use the same updated source and shared dispatch history',()=>{
  const initial={...createInitialState(),step:8};const manual=execute(initial,'charge');
  const market=demoReducer(initial,{type:'execute-market',step:8,resetVersion:0,revision:0});
  for(const state of [manual,market]) {
    const result=ledger(state);assert.equal(state.history[0].marketPriceUSDPerMWh,-200);
    near(result.rawFleetGrossUSD,state.history[0].grossEnergyValueUSD);assert.equal(result.reconciled,true);
  }
  assert.equal(ledger(manual).rows[0].source,'manual');assert.equal(ledger(market).rows[0].source,'market');
});
test('previews alone and empty history create no settlement',()=>{
  const state=createInitialState();const before=structuredClone(state);
  recommendMarket(state.assets,0,state.marketSettings);
  assert.deepEqual(state,before);assert.equal(ledger(state).rows.length,0);
  assert.equal(ledger(state).totals.ownerCents,0);assert.equal(ledger(state).reconciled,true);
});
test('commercial configuration validates allocations, percentages, costs and numeric bounds',()=>{
  for(const changes of [{ownerSharePct:71},{ownerSharePct:-1},{platformSharePct:101},{qseFeePct:NaN},{qseFeePct:101},{transactionUSDPerMWh:-1},{degradationUSDPerKWh:Infinity},{degradationUSDPerKWh:1_000_001}]) {
    const settings={...DEFAULT_COMMERCIAL_SETTINGS,...changes};assert.ok(validateCommercialSettings(settings));
    const initial=createInitialState();const result=demoReducer(initial,{type:'set-commercial-settings',settings});
    assert.deepEqual(result.commercialSettings,initial.commercialSettings);assert.ok(result.dispatchError);
    assert.throws(()=>settleHistory([],initial.assets,settings));
  }
  assert.equal(validateCommercialSettings({...DEFAULT_COMMERCIAL_SETTINGS,ownerSharePct:50,platformSharePct:50,qseFeePct:0,transactionUSDPerMWh:0,degradationUSDPerKWh:0}),null);
});
test('commercial edits recalculate existing rows without changing physical state',()=>{
  const state=run(68);const next=demoReducer(state,{type:'set-commercial-settings',settings:{...DEFAULT_COMMERCIAL_SETTINGS,ownerSharePct:50,platformSharePct:50}});
  assert.equal(next.assets,state.assets);assert.equal(next.history,state.history);assert.equal(next.step,state.step);
  assert.equal(ledger(next).rows[0].ownerCents,34);assert.equal(ledger(next).rows[0].platformCents,34);
  assert.equal(ledger(state).rows[0].ownerCents,48);
});
test('currency rounding is deterministic, half away from zero, and guards unsafe values',()=>{
  for(const [usd,cents] of [[1.005,101],[-1.005,-101],[.005,1],[-.005,-1],[.004,0],[-.004,0],[.015,2]]) assert.equal(usdToCents(usd),cents);
  assert.equal(Object.is(usdToCents(-0),-0),false);
  for(const value of [NaN,Infinity,1e20]) assert.throws(()=>usdToCents(value));
  const state=run(68);const oneCent={...state.history[0],acEnergyMWh:.00002,records:[{...state.history[0].records[0],acEnergyMWh:.00002,batteryEnergyDeltaMWh:0}]};
  const row=settleHistory([oneCent],state.assets,{...DEFAULT_COMMERCIAL_SETTINGS,qseFeePct:0,transactionUSDPerMWh:0,degradationUSDPerKWh:0}).rows[0];
  assert.equal(row.netCents,1);assert.equal(row.ownerCents,1);assert.equal(row.platformCents,0);reconcile(row);
});
test('reset clears settlement and restores defaults; deterministic replay reproduces the rows',()=>{
  function replay(state) {state=execute(state,'charge');return execute({...state,step:68});}
  const initial=createInitialState();const first=replay(initial);
  const configured=demoReducer(first,{type:'set-commercial-settings',settings:{...DEFAULT_COMMERCIAL_SETTINGS,ownerSharePct:50,platformSharePct:50}});
  const reset=demoReducer(configured,{type:'reset'});
  assert.deepEqual(reset.commercialSettings,DEFAULT_COMMERCIAL_SETTINGS);assert.equal(ledger(reset).rows.length,0);assert.equal(reset.assets[0].socPct,68);assert.equal(reset.step,0);
  const second=replay(reset);assert.deepEqual(ledger(first).rows,ledger(second).rows);assert.deepEqual(ledger(first).totals,ledger(second).totals);
});

test('a full 96-interval fleet run reconciles and is independent of history input order',()=>{
  let state=createInitialState();
  state=demoReducer(state,{type:'set-market-settings',settings:{...DEFAULT_MARKET_SETTINGS,requestedFleetPowerMW:100}});
  for(let i=0;i<96;i++) state=demoReducer(state,{type:'execute-market',step:state.step,resetVersion:state.resetVersion,revision:state.marketRevision});
  assert.equal(state.step,96);assert.equal(state.history.length,96);
  const result=ledger(state);assert.equal(result.reconciled,true);assert.equal(result.residualCents,0);
  assert.ok(Math.abs(result.sourceDifferenceUSD)<=result.sourceToleranceUSD);
  assert.ok(result.sourceToleranceUSD<.0001);
  reconcile(result.totals);
  const reversed=settleHistory(state.history.toReversed(),state.assets,state.commercialSettings);
  assert.deepEqual(reversed.rows,result.rows);assert.deepEqual(reversed.totals,result.totals);
});
