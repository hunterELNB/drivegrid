import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as simulation from '../../lib/vpp/simulation.ts';
import * as settlement from '../../lib/vpp/settlement.ts';
import * as units from '../../lib/vpp/units.ts';
import * as market from '../../lib/vpp/market-data.ts';
import { ownerAssetView } from '../../app/vpp-demo/owner/presentation.ts';

function execute(state,command){return simulation.demoReducer(state,{type:'execute-dispatch',step:state.step,resetVersion:state.resetVersion,request:{assetId:'ev-v2g-0001',command,requestedPowerMW:command==='idle'?0:.006}});}
function recordedState(){
  let state=simulation.createInitialState();
  for(const command of ['discharge','charge','idle'])state=execute(state,command);
  while(state.step<74)state=simulation.demoReducer(state,{type:'step'});
  return execute(state,'discharge');
}
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}
const require=createRequire(import.meta.url),cache=new Map();let renderState=simulation.createInitialState();
function component(name){
  if(cache.has(name))return cache.get(name);
  const source=readFileSync(new URL(`../../app/vpp-demo/owner/${name}.tsx`,import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports={};cache.set(name,exports);
  runInNewContext(compiled,{exports,require:id=>{
    if(id==='@/lib/vpp/units')return units;
    if(id==='@/lib/vpp/simulation')return simulation;
    if(id==='@/lib/vpp/market-data')return market;
    if(id==='@/lib/vpp/settlement')return settlement;
    if(id==='./presentation')return {ownerAssetView};
    if(id==='../_state/DemoProvider')return {useDemo:()=>({state:renderState})};
    if(id==='../_state/useSettlement')return {useSettlement:()=>settlement.settleHistory(renderState.history,renderState.assets,renderState.commercialSettings)};
    if(id==='../_components/Panel')return {Panel:({title,subtitle,children})=>React.createElement('section',{'aria-label':title},React.createElement('h2',null,title),React.createElement('p',null,subtitle),children)};
    if(id==='../_components/NetworkEquipment')return {EquipmentGraphic:({kind})=>React.createElement('svg',{'aria-label':`${kind} equipment`})};
    if(id==='next/link')return {default:({href,children})=>React.createElement('a',{href},children)};
    if(id.endsWith('.css'))return {default:{}};
    if(id.startsWith('./'))return component(id.slice(2));
    return require(id);
  }});return exports;
}
function renderPage(state){renderState=state;return renderToStaticMarkup(React.createElement(component('page').default));}

test('Owner Portal preserves EV-only mapping, first-100 selection and the existing asset/ledger source',()=>{
  const state=simulation.createInitialState(),html=renderPage(state);
  assert.equal((html.match(/<option/g)||[]).length,100);
  assert.match(html,/value="ev-v2g-0001" selected=""/);
  assert.match(html,/value="ev-v2g-0100"/);
  assert.doesNotMatch(html,/value="residential-battery|value="commercial-bess/);
  assert.match(html,/No executed records for this EV/);
});

test('read-only asset adapter copies exact SOC, status, availability and units without new eligibility logic',()=>{
  const asset=freeze({...simulation.createInitialState().assets[0],socPct:67.123456,status:'standby',availability:'unavailable'}),before=structuredClone(asset),view=ownerAssetView(asset);
  assert.equal(view.kind,'ev');assert.equal(view.socPct,asset.socPct);
  assert.equal(view.status,'standby');assert.equal(view.availability,'unavailable');
  assert.equal(view.ratedPowerMW,asset.ratedPowerMW);assert.equal(view.energyCapacityMWh,asset.energyCapacityMWh);
  assert.deepEqual(asset,before);
});

test('rendered asset card preserves authoritative battery values and accessible gauge',()=>{
  const view=ownerAssetView(simulation.createInitialState().assets[0]);
  const html=renderToStaticMarkup(React.createElement(component('OwnerAssetCard').OwnerAssetCard,{asset:view,priceLabel:units.formatMarketPrice(30)}));
  assert.match(html,/role="meter"/);assert.match(html,/aria-valuenow="68"/);
  assert.match(html,/75 kWh/);assert.match(html,/7 kW/);
  assert.match(html,/Availability: available/);assert.match(html,/Status: ready/);
  assert.match(html,/not a guarantee of dispatch/);
});

test('recorded EV earnings match accepted cents, imports/exports and all four original records',()=>{
  const state=freeze(recordedState()),before=structuredClone(state),ledger=settlement.settleHistory(state.history,state.assets,state.commercialSettings);
  const rows=ledger.rows.filter(row=>row.assetId==='ev-v2g-0001'),totals=settlement.aggregateSettlement(rows);
  assert.deepEqual(totals,{grossCents:375,qseCents:19,transactionCents:0,degradationCents:9,netCents:347,ownerCents:248,platformCents:107,deficitCents:8});
  assert.deepEqual(rows.map(row=>row.step),[0,1,2,74]);
  const html=renderPage(state);
  for(const amount of ['$2.48','$3.75','$0.19','$0.09','$0.08','$3.47','$1.07'])assert.ok(html.includes(amount));
  assert.match(html,/3 kWh/);assert.match(html,/1\.5 kWh/);
  assert.match(html,/not paid income/);assert.match(html,/not a share of gross revenue/);
  assert.deepEqual(state,before);
  assert.deepEqual(settlement.settleHistory(state.history,state.assets,state.commercialSettings),ledger);
});

test('negative and zero intervals do not invent owner earnings or erase deficits',()=>{
  const charged=execute(simulation.createInitialState(),'charge'),chargedHtml=renderPage(charged);
  assert.match(chargedHtml,/-\$0\.05/);assert.match(chargedHtml,/-\$0\.08/);assert.match(chargedHtml,/\$0\.08/);
  assert.match(chargedHtml,/No positive owner\/platform allocation/);
  const idle=execute(simulation.createInitialState(),'idle'),idleHtml=renderPage(idle);
  assert.match(idleHtml,/No grid transfer/);assert.match(idleHtml,/Command: idle/);
  assert.match(idleHtml,/\$0\.00/);assert.doesNotMatch(idleHtml,/-\$0\.00/);
});

test('actual rounded allocation is shown without forcing a 70/30 aggregate or gross split',()=>{
  const html=renderPage(execute(simulation.createInitialState(),'discharge'));
  assert.match(html,/owner \$0\.01, DriveGrid \$0\.01/);
  assert.match(html,/each positive asset-interval net/);
});

test('activity uses only supplied real records, keeps signed energy and zero-command outcomes',()=>{
  const state=recordedState(),rows=settlement.settleHistory(state.history,state.assets,state.commercialSettings).rows.filter(row=>row.assetId==='ev-v2g-0001');
  const html=renderToStaticMarkup(React.createElement(component('OwnerParticipation').OwnerActivity,{records:rows.toReversed(),pageRecordCount:4}));
  assert.equal((html.match(/<li /g)||[]).length,4);
  for(const step of [0,1,2,74])assert.ok(html.includes(simulation.simulationLabel(step)));
  assert.match(html,/-1\.5 kWh/);assert.match(html,/No grid transfer/);
  assert.match(html,/Skipped time creates no activity/);
});

test('global reset preserves the EV registry and returns displayed earnings/history and SOC to baseline',()=>{
  const state=recordedState(),reset=simulation.demoReducer(state,{type:'reset'}),html=renderPage(reset);
  assert.equal(reset.assets.filter(a=>a.type==='ev-v2g').length,1000);
  assert.match(html,/aria-valuenow="68"/);assert.match(html,/No executed records for this EV/);
  assert.match(html,/\$0\.00/);assert.equal(reset.history.length,0);
});
