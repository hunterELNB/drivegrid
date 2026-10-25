import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInitialState } from '../../lib/vpp/simulation.ts';
import { scenarioPresets, runScenario } from '../../lib/vpp/scenarios.ts';
import * as units from '../../lib/vpp/units.ts';
import * as presentation from '../../app/vpp-demo/scenarios/presentation.ts';

const state=createInitialState();
const results=scenarioPresets.map(p=>runScenario(p.id,{...p.config},state.assets,state.commercialSettings));
const baselineHashes=[
  'd35d475c9ee6d22aecf0558d02faaed9a1046104cbf6139530c7329e7650a200',
  'd3f4a31f6702c4ca81d6b157499424b5b6b870d7a62914ba4e24e47d52705303',
  '578eeb5c27daea341580dca89f9d9c27ae64a5305661f6f310f29787e258ebb8',
  'bdca093382dd6b97348c506e8fdf9bc4bfa9d580f8d4fc425801e3e8e1239d38',
  'd8115b5981c68ee5bf33424b9cb0be1fe90c871e4bc87975cd757187d466be98',
  '8aa59b1c67208276474495547b626cdcf2404d28e4bed28378b8c985fc13162a',
];
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}
const require=createRequire(import.meta.url),cache=new Map();
function component(name){
  if(cache.has(name))return cache.get(name);
  const source=readFileSync(new URL(`../../app/vpp-demo/scenarios/${name}.tsx`,import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports={};cache.set(name,exports);
  runInNewContext(compiled,{exports,require:id=>{
    if(id==='@/lib/vpp/units')return units;
    if(id==='./presentation')return presentation;
    if(id.endsWith('.css'))return {default:{}};
    if(id.startsWith('./'))return component(id.slice(2));
    return require(id);
  }});return exports;
}
const render=(type,props)=>renderToStaticMarkup(React.createElement(type,props));

test('all six complete engine outputs match the recorded pre-visual-upgrade SHA256 baseline',()=>{
  for(const [index,r] of results.entries())assert.equal(createHash('sha256').update(JSON.stringify(r)).digest('hex'),baselineHashes[index]);
});

test('scenario comparison adapters retain original order, signed values and raw terminal precision',()=>{
  const input=freeze(structuredClone(results)),before=structuredClone(input),view=presentation.comparisonViews(input);
  assert.deepEqual(view.economics.map(g=>g.label),scenarioPresets.map(p=>p.name));
  for(const [index,r] of input.entries()){
    assert.deepEqual(view.economics[index].values,[r.totals.netCents/100,r.terminal.adjustedEconomicValueUSD]);
    assert.deepEqual(view.energy[index].values,[r.importedMWh,r.exportedMWh]);
  }
  assert.deepEqual(input,before);
});

test('six strategy cards expose unchanged descriptions, thresholds and selected/disabled states',()=>{
  const html=render(component('StrategySelection').StrategyCards,{presets:scenarioPresets,selected:'aggressive',busy:true,onSelect:()=>{}});
  assert.equal((html.match(/<button/g)||[]).length,6);
  assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
  assert.equal((html.match(/disabled=""/g)||[]).length,6);
  for(const p of scenarioPresets)assert.ok(html.includes(p.name));
  assert.match(html,/CHARGE BELOW/);assert.match(html,/DISCHARGE ABOVE/);
});

test('comparison geometry includes zero and the full positive/negative extent',()=>{
  const scale=presentation.comparisonScale([{label:'A',values:[-12.5,40]},{label:'B',values:[9.827749999997565,-2.4442670110147446e-12]}]);
  assert.equal(scale.minimum,-12.5);assert.equal(scale.maximum,40);
  assert.equal(scale.x(-12.5),280);assert.equal(scale.x(40),870);
  assert.ok(scale.x(-12.5)<scale.x(0));
  const zero=presentation.comparisonScale([{label:'Idle',values:[0,0]}]);assert.ok(Number.isFinite(zero.x(0)));
});

test('rendered economic bars format positive, negative and tiny USD without raw artifacts',()=>{
  const html=render(component('ComparisonBarsSvg').ComparisonBarsSvg,{groups:[{label:'Example',values:[9.827749999997565,-2.4442670110147446e-12]},{label:'Negative',values:[-1250.5,15.455000001459013]}],labels:['Operating net','Comparison value'],unit:'USD',currency:true});
  for(const amount of ['$9.83','$0.00','-$1,250.50','$15.46'])assert.ok(html.includes(amount));
  assert.doesNotMatch(html,/9\.827749|e-12|-\$0\.00/);
});

test('negative scenario economic overview separates operating net, inventory mark and comparison metric without mutation',()=>{
  const r=freeze(runScenario('base',{...scenarioPresets[0].config,intervals:1},state.assets,state.commercialSettings,{referencePriceUSDPerMWh:0,targetSocPct:null,tolerancePct:2}));
  const before=structuredClone(r),html=render(component('ScenarioIntelligence').ScenarioResultOverview,{results:[r]});
  assert.equal(r.totals.netCents,-1250);assert.equal(r.terminal.adjustedEconomicValueUSD,-12.5);
  assert.match(html,/-\$12\.50/);assert.match(html,/COMPARISON METRIC · NOT PAYOUT/);
  assert.match(html,/COMPARISON-ONLY INVENTORY MARK/);assert.match(html,/\$0\.00/);
  assert.deepEqual(r,before);
});

test('timeline keeps all 96 discrete decisions, boundary times, signed energy and exact keyboard-readable values',()=>{
  const r=freeze(structuredClone(results[0])),before=structuredClone(r);
  const html=render(component('ScenarioTimeline').ScenarioTimeline,{result:r});
  assert.equal((html.match(/<option/g)||[]).length,96);
  assert.match(html,/00:00 CT · charge/);assert.match(html,/23:45 CT/);
  assert.match(html,/24:00/);assert.match(html,/Prices are held constant/);
  assert.doesNotMatch(html,/<polyline/);
  assert.ok(html.includes(units.formatUSD(r.points[0].grossEnergyValueUSD)));
  assert.deepEqual(r,before);
});

test('partial-day timeline contains only existing points and marks the remainder as unsimulated',()=>{
  const r=runScenario('base',{...scenarioPresets[0].config,intervals:1},state.assets,state.commercialSettings);
  const html=render(component('ScenarioTimeline').ScenarioTimeline,{result:r});
  assert.equal((html.match(/<option/g)||[]).length,1);
  assert.match(html,/outside simulated intervals/);
  assert.match(html,/Unsimulated intervals remain blank/);
});
