import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as units from '../../lib/vpp/units.ts';
import * as fixtures from '../../lib/vpp/fixtures.ts';
import * as domain from '../../lib/vpp/domain.ts';
import * as simulation from '../../lib/vpp/simulation.ts';
import * as market from '../../lib/vpp/market-data.ts';

test('Dashboard reference revenue uses two-decimal USD without changing fixture or shared state', () => {
  const state = simulation.createInitialState();
  const before = structuredClone(state);
  const referenceBefore = structuredClone(fixtures.kpis);
  const require = createRequire(import.meta.url);
  const source = readFileSync(new URL('../../app/vpp-demo/page.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports, require: id => {
    if (id === '@/lib/vpp/units') return units;
    if (id === '@/lib/vpp/fixtures') return fixtures;
    if (id === '@/lib/vpp/domain') return domain;
    if (id === '@/lib/vpp/simulation') return simulation;
    if (id === '@/lib/vpp/market-data') return market;
    if (id === './_state/DemoProvider') return { useDemo: () => ({ state }) };
    if (id.endsWith('.css')) return { default: {} };
    if (id === 'next/image') return { default: props => React.createElement('img', props) };
    // Keep the actual Dashboard/KPI markup and real formatting/domain data;
    // omit unrelated child scenes and ledger panels from this focused test.
    if (id.startsWith('./_components/')) return new Proxy({}, { get: () => () => null });
    return require(id);
  }});
  const html = renderToStaticMarkup(React.createElement(exports.default));
  assert.match(html, /Simulated Daily Revenue<\/h2><p[^>]*>\$4,280\.00<span><\/span><\/p>/);
  assert.match(html, /Fixture value · not a settlement/);
  assert.deepEqual(fixtures.kpis, referenceBefore);
  assert.deepEqual(state, before);
});
