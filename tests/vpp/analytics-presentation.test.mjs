import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildAnalytics } from '../../lib/vpp/analytics.ts';
import { createInitialState, demoReducer } from '../../lib/vpp/simulation.ts';
import { settleHistory } from '../../lib/vpp/settlement.ts';
import * as units from '../../lib/vpp/units.ts';
import * as presentation from '../../app/vpp-demo/analytics/presentation.ts';

function recordedState(){
  let state=createInitialState();
  for(const command of ['charge','discharge','idle'])state=execute(state,command);
  state=demoReducer(demoReducer(state,{type:'step'}),{type:'step'});
  return execute(execute(state,'charge'),'discharge');
}
function execute(state,command){return demoReducer(state,{type:'execute-dispatch',step:state.step,resetVersion:state.resetVersion,request:{assetId:null,command,requestedPowerMW:command==='idle'?0:1}});}
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}
// Compile actual presentation TSX with the already-installed TypeScript/React.
// Equipment art and CSS are irrelevant to numeric assertions; engines are never mocked.
const require=createRequire(import.meta.url),cache=new Map();
function component(name){
  if(cache.has(name))return cache.get(name);
  const source=readFileSync(new URL(`../../app/vpp-demo/analytics/${name}.tsx`,import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports={};cache.set(name,exports);
  runInNewContext(compiled,{exports,require:id=>{
    if(id==='@/lib/vpp/units')return units;
    if(id==='./presentation')return presentation;
    if(id.endsWith('.css'))return {default:{}};
    if(id==='../_components/NetworkEquipment')return {EquipmentGraphic:()=>null};
    if(id.startsWith('./'))return component(id.slice(2));
    return require(id);
  }});return exports;
}
const render=(type,props)=>renderToStaticMarkup(React.createElement(type,props));

test('analytics presentation preserves every timestamp, signed energy, command and settlement cent without mutation',()=>{
  const state=freeze(recordedState()),model=freeze(buildAnalytics(state)),before=structuredClone(model);
  const points=presentation.recordedEnergyPoints(model);
  assert.deepEqual(points.map(p=>p.step),[0,1,2,5,6]);
  assert.equal(points.length,model.history.length);
  for(const [index,p] of points.entries()){
    assert.equal(p.timestamp,model.history[index].timestamp);
    assert.equal(p.command,model.history[index].request.command);
    assert.equal(p.status,model.history[index].status);
    assert.equal(p.acEnergyMWh,model.history[index].acEnergyMWh);
    assert.equal(p.grossCents,model.ledger.intervals[index].grossCents);
    assert.equal(p.netCents,model.ledger.intervals[index].netCents);
  }
  presentation.executiveItems(model);
  assert.deepEqual(model,before);
  assert.deepEqual(model.ledger,settleHistory(state.history,state.assets,state.commercialSettings));
});

test('energy geometry retains gaps and a zero-inclusive signed scale without smoothing',()=>{
  const points=presentation.recordedEnergyPoints(buildAnalytics(recordedState())),plot=presentation.energyPlotGeometry(points);
  assert.equal(plot.minimum,-plot.maximum);
  assert.equal(plot.y(0),200);
  assert.equal(plot.y(-.25)>plot.y(0),true);
  assert.equal(plot.y(.25)<plot.y(0),true);
  const adjacent=plot.x(points[1].timestamp)-plot.x(points[0].timestamp);
  assert.ok(Math.abs((plot.x(points[3].timestamp)-plot.x(points[2].timestamp))/adjacent-3)<1e-10);
  assert.ok(plot.barWidth<adjacent);
});

test('empty analytics keeps unknown acceptance distinct from zero and does not invent history',()=>{
  const model=buildAnalytics(createInitialState()),cards=presentation.executiveItems(model);
  assert.deepEqual(presentation.recordedEnergyPoints(model),[]);
  assert.equal(cards[2].value,'$0.00');assert.equal(cards[3].value,'N/A');
  const html=render(component('AnalyticsIntelligence').PerformanceIntelligence,{model});
  assert.match(html,/No time series has been synthesized/);
  assert.doesNotMatch(html,/<svg|Inspect recorded interval/);
});

test('actual financial trend readout and SVG titles/axes use two-decimal USD including negative zero',()=>{
  const points=[{timestamp:'2026-10-23T05:00:00.000Z',step:0,values:[9.827749999997565,-2.4442670110147446e-12]}];
  const html=render(component('AnalyticsCharts').TrendChart,{id:'financial',points,labels:['Gross','Net'],unit:'USD',currency:true});
  assert.match(html,/\$9\.83/);assert.match(html,/\$0\.00/);
  assert.doesNotMatch(html,/9\.827749|e-12|-\$0\.00/);
  assert.match(html,/Inspect financial interval/);
});

test('actual performance renderer exposes command/status, true interval count and keyboard inspection',()=>{
  const model=buildAnalytics(recordedState()),points=presentation.recordedEnergyPoints(model);
  const html=render(component('EnergyPerformanceSvg').EnergyPerformanceSvg,{points,selected:2,onInspect:()=>{}});
  assert.equal((html.match(/role="button"/g)||[]).length,5);
  assert.match(html,/charge · accepted · signed AC -250 kWh/);
  assert.match(html,/discharge · accepted · signed AC 250 kWh/);
  assert.match(html,/idle · accepted · signed AC 0 kWh/);
  assert.match(html,/tabindex="0"/);
  assert.match(html,/gaps have no fabricated values/);
});

test('executive and fleet financial presentation uses the same authoritative cents as the existing ledger',()=>{
  const model=freeze(buildAnalytics(recordedState())),before=structuredClone(model);
  const components=component('AnalyticsIntelligence');
  const executive=render(components.ExecutiveOverview,{model});
  assert.ok(executive.includes(units.formatUSD(model.ledger.totals.netCents/100)));
  assert.ok(executive.includes(units.formatEnergy(model.energy.importedMWh,'fleet')));
  const fleet=render(components.FleetTypeOverview,{types:model.typePerformance,total:model.assets.length});
  for(const type of model.typePerformance)assert.ok(fleet.includes(units.formatUSD(type.totals.netCents/100)));
  assert.deepEqual(model,before);
});
