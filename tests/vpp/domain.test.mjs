import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssets, availableDispatchMW, portfolioMetrics, filterAssets, validAssetUpdate } from '../../lib/vpp/domain.ts';
import { createInitialState, demoReducer, simulationTimestamp, simulationLabel, TOTAL_INTERVALS } from '../../lib/vpp/simulation.ts';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);
const update = (asset, overrides) => ({ socPct: asset.socPct, availability: asset.availability, status: asset.status, ...overrides });

test('reproducible portfolio has valid equipment ratings and three supported types', () => {
  const assets = createAssets();
  assert.deepEqual(assets, createAssets());
  assert.equal(assets.length, 1150);
  assert.equal(new Set(assets.map(a => a.id)).size, 1150);
  assert.equal(new Set(assets.map(a => a.type)).size, 3);
  for (const asset of assets) {
    assert.ok(asset.energyCapacityMWh > 0 && asset.ratedPowerMW > 0);
    assert.ok(asset.maxDischargingPowerMW <= asset.ratedPowerMW);
    assert.ok(asset.maxChargingPowerMW <= asset.ratedPowerMW);
    assert.ok(validAssetUpdate(asset, update(asset, {})));
  }
});

test('aggregation distinguishes nameplate MW, available MW, and energy capacity MWh', () => {
  const metrics = portfolioMetrics(createAssets());
  close(metrics.ratedPowerMW, 20);
  close(metrics.availablePowerMW, 12);
  close(metrics.energyCapacityMWh, 117.7);
  close(metrics.averageSocPct, 68);
  assert.equal(metrics.connectedAssets, 1116);
  assert.equal(metrics.statuses.reduce((sum, s) => sum + s.count, 0), 1150);
  close(metrics.composition.reduce((sum, s) => sum + s.capacityMW, 0), 20);
  assert.equal(portfolioMetrics([]).averageSocPct, 0);
});

test('availability and operational edits update derived metrics without mutating rated power', () => {
  const initial = createInitialState();
  const asset = initial.assets[0];
  const changed = demoReducer(initial, { type: 'update-asset', id: asset.id, update: update(asset, { availability: 'unavailable' }) });
  close(portfolioMetrics(changed.assets).availablePowerMW, 11.994);
  close(portfolioMetrics(changed.assets).ratedPowerMW, 20);
  assert.equal(initial.assets[0].availability, 'available');
  assert.equal(portfolioMetrics(changed.assets).statuses[0].count, 1019);
  const offline = demoReducer(initial, { type: 'update-asset', id: asset.id, update: update(asset, { status: 'offline' }) });
  assert.equal(portfolioMetrics(offline.assets).connectedAssets, 1115);
  for (const status of ['standby','maintenance','offline']) assert.equal(availableDispatchMW({ ...asset, status }), 0);
  assert.equal(availableDispatchMW({ ...asset, v2gEnabled: false }), 0);
});

test('SOC bounds reject invalid edits and minimum SOC removes dispatch eligibility', () => {
  const initial = createInitialState();
  const asset = initial.assets[0];
  for (const socPct of [19,101,NaN,Infinity,-Infinity]) {
    assert.equal(demoReducer(initial, { type: 'update-asset', id: asset.id, update: update(asset, { socPct }) }), initial);
  }
  const minimum = demoReducer(initial, { type: 'update-asset', id: asset.id, update: update(asset, { socPct: 20 }) });
  assert.equal(availableDispatchMW(minimum.assets[0]), 0);
  assert.ok(portfolioMetrics(minimum.assets).averageSocPct < 68);
  const maximum = demoReducer(initial, { type: 'update-asset', id: asset.id, update: update(asset, { socPct: 100 }) });
  assert.equal(maximum.assets[0].socPct,100);
  assert.equal(demoReducer(initial, { type: 'update-asset', id: 'missing', update: update(asset,{}) }),initial);
  assert.equal(validAssetUpdate(asset, update(asset,{ status:'invalid' })),false);
  assert.equal(validAssetUpdate(asset, update(asset,{ availability:'invalid' })),false);
});

test('SOC averaging is energy-capacity weighted', () => {
  const asset = createAssets()[0];
  close(portfolioMetrics([{...asset, energyCapacityMWh:1, socPct:20},{...asset, energyCapacityMWh:3, socPct:100}]).averageSocPct,80);
});

test('clock supports pause, manual step and guarded timer ticks at fixed intervals', () => {
  const initial = createInitialState();
  assert.equal(simulationTimestamp(0),'2026-10-23T05:00:00.000Z');
  assert.match(simulationLabel(0), /23 Oct 2026.*00:00.*CT/);
  assert.equal(demoReducer(initial,{type:'tick'}),initial);
  const stepped = demoReducer(initial,{type:'step'});
  assert.equal(stepped.step,1);
  assert.equal(simulationTimestamp(stepped.step),'2026-10-23T05:15:00.000Z');
  assert.equal(stepped.running,false);
  const running = demoReducer(stepped,{type:'start'});
  const ticked = demoReducer(running,{type:'tick'});
  assert.equal(ticked.step,2);
  assert.equal(ticked.assets, initial.assets);
  const paused = demoReducer(ticked,{type:'pause'});
  assert.equal(demoReducer(paused,{type:'tick'}),paused);
  assert.equal(demoReducer(running,{type:'step'}).running,false);
});

test('clock stops at 96 intervals and never advances beyond the reference day', () => {
  let state = demoReducer(createInitialState(),{type:'start'});
  for (let i=0;i<TOTAL_INTERVALS;i++) state=demoReducer(state,{type:'tick'});
  assert.equal(state.step,96);
  assert.equal(state.running,false);
  assert.equal(simulationTimestamp(state.step),'2026-10-24T05:00:00.000Z');
  assert.equal(demoReducer(state,{type:'start'}),state);
  assert.equal(demoReducer(state,{type:'step'}).step,96);
});

test('reset restores clock, running state and all edits with fresh asset records', () => {
  const initial = createInitialState();
  const asset = initial.assets[0];
  let changed = demoReducer(initial,{type:'update-asset',id:asset.id,update:update(asset,{socPct:42,status:'offline'})});
  changed=demoReducer(demoReducer(changed,{type:'start'}),{type:'tick'});
  const reset=demoReducer(changed,{type:'reset'});
  assert.deepEqual(reset,{...initial, resetVersion:1});
  assert.notEqual(reset.assets,initial.assets);
  assert.equal(demoReducer(reset,{type:'tick'}),reset);
});

test('combined filters support search, types, availability, status, and no matches', () => {
  const assets=createAssets();
  const filters={search:'',type:'all',status:'all',availability:'all'};
  assert.equal(filterAssets(assets,filters).length,1150);
  assert.equal(filterAssets(assets,{...filters,type:'commercial-bess',status:'ready',availability:'available',search:'dallas'}).length,10);
  assert.equal(filterAssets(assets,{...filters,search:'  EV-V2G-0001 '})[0].id,'ev-v2g-0001');
  assert.equal(filterAssets(assets,{...filters,search:'nonexistent'}).length,0);
});
