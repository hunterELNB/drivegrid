import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as units from '../../lib/vpp/units.ts';
import { createInitialState, demoReducer } from '../../lib/vpp/simulation.ts';
import { settleHistory } from '../../lib/vpp/settlement.ts';

// Render the actual TSX readout using installed TypeScript/React; only unrelated
// renderer imports and CSS are stubbed, not formatting or reconciliation data.
const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../../app/vpp-demo/settlement/SettlementIntelligence.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const exports = {};
runInNewContext(compiled, { exports, require: id => {
  if (id === '@/lib/vpp/units') return units;
  if (id.endsWith('.css')) return { default: {} };
  if (id === './settlement-presentation' || id === './RevenueBridgeSvg') return {};
  return require(id);
}});
const render = ledger => renderToStaticMarkup(React.createElement(exports.ReconciliationReadout, { ledger }));

for (const [name, value, expected] of [
  ['positive', 9.827749999997565, '$9.83'],
  ['negative', -9.827749999997565, '-$9.83'],
  ['tiny negative residual', -2.4442670110147446e-12, '$0.00'],
  ['tiny positive tolerance', 1.4590122681946695e-9, '$0.00'],
  ['negative zero', -0, '$0.00'],
  ['large amount', 1234567890.125, '$1,234,567,890.13'],
  ['tolerance', 15.455000001459013, '$15.46'],
]) test(`USD presentation: ${name}`, () => assert.equal(units.formatUSD(value), expected));

test('actual reconciliation readout formats differences/tolerances and preserves engine status', () => {
  for (const reconciled of [true, false]) {
    const ledger = Object.freeze({ residualCents: 0, roundingDifferenceUSD: 9.827749999997565,
      roundingToleranceUSD: 15.455000001459013, sourceDifferenceUSD: -2.4442670110147446e-12,
      sourceToleranceUSD: 1.4590122681946695e-9, reconciled });
    const before = structuredClone(ledger);
    const html = render(ledger);
    assert.match(html, /<code>\$9\.83<\/code>/);
    assert.match(html, /<code>\$15\.46<\/code>/);
    assert.equal((html.match(/<code>\$0\.00<\/code>/g) || []).length, 2);
    assert.ok(html.includes(reconciled ? '>RECONCILED<' : '>REVIEW REQUIRED<'));
    assert.doesNotMatch(html, /e-\d|9\.827749|15\.455000|-\$0\.00/);
    assert.deepEqual(ledger, before);
  }
});

test('rendering real settlement leaves raw numbers, state and full-precision outcomes unchanged', () => {
  let state = createInitialState();
  for (const command of ['discharge', 'charge', 'idle']) {
    state = demoReducer(state, { type: 'execute-dispatch', step: state.step, resetVersion: state.resetVersion,
      request: { assetId: null, command, requestedPowerMW: command === 'idle' ? 0 : 1 } });
    assert.equal(state.history.at(-1)?.request.command, command);
    const beforeState = structuredClone(state);
    const ledger = settleHistory(state.history, state.assets, state.commercialSettings);
    const before = structuredClone(ledger);
    render(ledger);
    assert.deepEqual(ledger, before);
    assert.deepEqual(state, beforeState);
    assert.deepEqual(settleHistory(state.history, state.assets, state.commercialSettings), before);
  }
});
