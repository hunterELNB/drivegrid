import test from 'node:test';
import assert from 'node:assert/strict';
import { hourly, portfolio, kpis, assetStatuses, navigation, events } from '../../lib/vpp/fixtures.ts';

test('reference KPIs retain the approved illustrative values', () => {
  assert.deepEqual(kpis.map(k => `${k.value}${k.unit}`), ['20MW','12MW','1,150','68%','$85/MWh','$4,280']);
});
test('chart fixtures cover every hour exactly once with finite, bounded values', () => {
  assert.deepEqual(hourly.map(p => p.hour), Array.from({length:24}, (_,i) => i));
  for (const p of hourly) {
    assert.ok(Number.isFinite(p.price) && p.price >= 0 && p.price <= 160);
    assert.ok(Number.isFinite(p.dispatch) && p.dispatch >= 0 && p.dispatch <= 12);
  }
  assert.equal(hourly[20].price, 85);
});
test('portfolio composition and status counts reconcile to fixture totals', () => {
  assert.equal(portfolio.reduce((sum,p) => sum+p.capacityMW,0),20);
  assert.equal(assetStatuses.reduce((sum,p) => sum+p.count,0),1150);
});
test('workspace navigation has unique routes and all approved modules', () => {
  assert.deepEqual(navigation.map(n => n.slug), ['', 'assets', 'dispatch', 'market', 'settlement', 'owner', 'scenarios', 'operations', 'analytics']);
  assert.equal(new Set(navigation.map(n => n.slug)).size,9);
});
test('operation events are ordered newest first within the fixed demo day', () => {
  assert.deepEqual(events.map(e => e.time), events.map(e => e.time).sort().reverse());
  assert.equal(new Set(events.map(e => e.time)).size,events.length);
});
