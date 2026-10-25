# DriveGrid VPP Demo — Phase 3 technical report

## Delivery

Phase 3 adds a deterministic charge/discharge/idle engine, a functional Dispatch
route, interval history, dashboard activity, and context-aware equipment units.
It reuses the existing Context and reducer. No dependencies were added.

Everything remains local and uncommitted. No staging, commits, pushes, remote
branches, pull requests, deployments, live market/device connections, or Phase 4
work were performed. The corporate homepage, contact API, global CSS, root
layout, package manifest, lockfile, and TypeScript configuration were not changed
by this phase. Package/config modifications from earlier approved phases remain.

## Complete file inventory for Phase 3

Created:

- `lib/vpp/units.ts`: conversion and display utilities.
- `lib/vpp/dispatch.ts`: typed requests/results and pure physical calculations.
- `app/vpp-demo/dispatch/page.tsx`: fleet/individual controls, result details,
  exclusions, pagination, and interval history.
- `app/vpp-demo/dispatch/dispatch.module.css`: scoped responsive Dispatch styling.
- `app/vpp-demo/_components/DispatchActivity.tsx`: calculated dashboard activity.
- `tests/vpp/dispatch.test.mjs`: 17 new unit, physics, and integration tests.
- `docs/vpp-phase-3.md`: this report.

Modified:

- `lib/vpp/domain.ts`: available discharge uses the 15-minute physical power limit.
- `lib/vpp/simulation.ts`: dispatch action, guarded interval execution, history,
  error feedback, and reset integration.
- `app/vpp-demo/assets/page.tsx`: individual equipment units, formatted SOC,
  unrestricted decimal precision in the validated SOC editor, updated help text.
- `app/vpp-demo/page.tsx`: calculated dispatch activity and duration-aware KPI label.
- `app/vpp-demo/_components/SimulationClock.tsx`: explicit time-only semantics.
- `app/vpp-demo/[module]/page.tsx`: Dispatch removed from future placeholders.

## Physical conventions and assumptions

All internal quantities retain MW and MWh. Requests supply a **nonnegative AC
power magnitude** plus a command. Every execution models a constant average AC
power over exactly 0.25 hours (15 minutes).

| Quantity | Convention |
| --- | --- |
| Signed AC power/energy | Positive = discharge/export; negative = charge/import |
| Battery energy delta | Positive = stored energy increase; negative = withdrawal |
| Requested/accepted/rejected/curtailed quantities | Nonnegative magnitudes |
| Charge efficiency | 0.95 for all simulated equipment |
| Discharge efficiency | 0.95 for all simulated equipment |

For accepted magnitude `P`, duration `h = 0.25`, capacity `C`, and current stored
energy `E = C × SOC / 100`:

- Discharge: `AC energy = P × h`; `battery delta = -AC energy / 0.95`.
- Charge: `AC energy = -P × h`; `battery delta = -AC energy × 0.95`.
- `SOC after = 100 × (E + battery delta) / C`.
- `loss = -AC energy - battery delta`, nonnegative within numerical tolerance.
- Consequently, `AC energy + battery delta + loss = 0`.

Accepted power is limited by rated power, command-specific power limits, and the
energy available within minimum/maximum SOC. Charge energy headroom limits AC
power to `(Emax - E) / (0.95 × h)`; discharge reserve limits AC power to
`(E - Emin) × 0.95 / h`. SOC is bounded after the calculation to remove floating
point overshoot, without rounding the physical state for display.

Energy-transfer commands require available + ready status. EV discharge also
requires V2G enabled; EV charging does not. Idle is an intentional zero-power,
zero-energy no-op, including on unavailable/offline assets; it sends no device
command. Invalid ratings/SOC reject the request. Charge/discharge require positive
finite power; Idle requires zero. Negative and nonfinite power are rejected.

An entirely unserviceable valid demand is **rejected**; partially serviceable
demand is **curtailed**; a fully serviceable request is **accepted**. The engine
returns power and 15-minute energy magnitudes for all three quantities, signed
AC energy, battery energy change, losses, SOC snapshots, and reasons.

Fleet allocation is greedy in ascending stable asset ID order, independent of
input-array order (commercial BESS IDs precede EV IDs in this fixture set). It
is not an optimizer. Each eligible asset receives up to its physical limit until
the fleet demand is fulfilled. Unallocated demand is counted once in the fleet
summary, not repeatedly against every excluded asset. Individual records describe
their allocated demand; exclusions list unavailable/blocked assets and reasons.

Floating point comparisons use a `1e-10 MW` tolerance; automated energy and
aggregation checks use an absolute `1e-9` tolerance in the relevant base units.

## Clock, idempotency, and replay

- **Execute interval** is manual and allowed only while paused, before interval 96.
- It uses the current interval start timestamp and consumes exactly one interval,
  applying SOC updates and advancing time by 15 minutes atomically in the reducer.
- Every valid attempt, including a physical rejection or Idle, is recorded and
  consumes its interval. Invalid numeric/command inputs do not consume time.
- Each action carries its expected interval index and reset version. Stale actions,
  duplicate history intervals, running playback, and end-of-day execution are
  blocked. The UI requires interval-specific confirmation that clears after each
  execution, protecting against double-click execution of the next interval.
- **Start/Pause/Step only change time.** Playback ticks every two wall-clock seconds;
  Step advances 15 simulated minutes. There are no pending automatic instructions.
- Navigating between demo routes never executes dispatch. Shared state and history
  remain mounted at the demo layout boundary.
- Reset restores all fixture SOC/status/availability values, midnight time, paused
  state, empty history/errors, and a new reset version. Old actions cannot execute
  against the new run. Replaying the same actions yields identical history and SOC.
- Refreshing or leaving the demo restores fixtures. History is browser-memory-only.
- Manual asset edits are simulated state corrections, independent of the clock.
  Reproducibility requires the same sequence of both edits and dispatch actions;
  history is a dispatch ledger, not a complete immutable audit log.

## Display rules

- Portfolio power/energy: MW/MWh.
- Individual EV and residential equipment: kW/kWh.
- Commercial equipment: kW below 1 MW, MW at/above 1 MW; independently kWh below
  1 MWh, MWh at/above 1 MWh. Magnitude controls thresholds for signed values.
- Individual dispatch summaries/records/history: kW/kWh, including large equipment.
- Fleet dispatch summaries/history and portfolio dashboard activity: MW/MWh.
- Dispatch inputs explicitly request MW for fleet or kW for an individual asset;
  kW is converted to MW before calculations. SOC inputs explicitly use percent.
- Formatting uses `en-US`, up to three decimal places, half-away-from-zero rounding
  with floating-point midpoint correction, and no unnecessary trailing zeros.
  Nonzero values below 0.001 retain up to three significant digits so small losses
  are not shown as zero. Negative zero is normalized.
- Stored data and calculations are never rounded for display. The SOC editor
  retains its exact numeric value with `step="any"`, avoiding invalid browser
  step constraints or accidental rounding when changing availability after dispatch.

Examples: `0.0072 MW → 7.2 kW`, `0.075 MWh → 75 kWh`, small fixture BESS
`0.24 MW / 0.8 MWh → 240 kW / 800 kWh`, large BESS `2.5 MW → 2.5 MW`.
Display rounding is independent of the energy ledger; displayed components can
differ slightly from displayed totals because calculations retain full precision.

## Dashboard behavior

Available dispatch now means sustainable AC discharge over the next 15-minute
interval, including SOC reserve and discharge losses. Weighted SOC derives from
the updated asset records. Latest dispatch status and the five most recent actual
dispatch events are presented separately from reference content.

The price/revenue KPIs, historical price/dispatch charts, and original operations
fixture events remain labeled reference data. They are not calculated market or
settlement results and are not executed automatically by the clock.

## Local verification

| Check | Result |
| --- | --- |
| `npm run test:vpp` | 31 passed, zero failures (14 existing + 17 new) |
| `npx eslint app/vpp-demo lib/vpp tests/vpp` | Passed |
| `npm run build -- --webpack` | Passed compilation, TypeScript, static generation |
| `npm run lint` | Existing seven homepage errors and one warning only |
| Protected corporate source / global CSS / root layout / lockfile | No diff |

Tests cover conversions, sign and precision rules, threshold selection, charging,
discharging, efficiency, power limits, energy headroom, SOC bounds, unavailable/
offline/standby/maintenance assets, V2G, invalid data, Idle, stable fleet allocation,
curtailment/rejection accounting, unique intervals, clock guards, reset/replay,
and 96 mixed fleet intervals verifying energy conservation and SOC invariants.

Interactive local production-browser checks:

- Fleet discharge 1 MW: 0.25 MWh AC export and 0.2631578947 MWh battery withdrawal;
  dashboard activity and weighted SOC update. Double-click produced one interval.
- Individual EV request 20 kW: accepted 6 kW, curtailed 14 kW; 1.5 kWh export,
  SOC 68% → 65.895% displayed. Result/history use kW/kWh.
- Fractional SOC remains editable in Assets. Setting that EV unavailable caused
  the next dispatch to reject with unchanged SOC/energy and an explicit reason.
- EV charge 6 kW: 1.5 kWh import, 1.425 kWh stored, 0.075 kWh loss, SOC 69.9%.
- Idle consumes an interval without energy change. Start disables manual dispatch;
  playback and Step advance time without adding dispatch records. Reset clears
  history and restores the initial paused midnight state.
- Assets display EV 7 kW / 75 kWh, residential battery 10 kW / 27 kWh, and fixture
  BESS 240 kW / 800 kWh.
- Desktop, 390px mobile, and 768px tablet layouts inspected. Dispatch and Assets
  have no observed document-level horizontal overflow; tables scroll internally.
  Mobile navigation works.
- Browser console: no errors observed during the checks.
- Corporate return navigation confirmed the original homepage heading and enabled
  inquiry form. The form was not submitted.

No live emails or business services were invoked. The existing Next.js Google
Fonts fetch remains a build dependency; Webpack is the supported local fallback
for the previously recorded Turbopack worker issue. Node 24 tests retain the
existing harmless module-type detection warning.

## Acceptance steps

Use Node 24 in the existing project directory:

```powershell
cd C:\business\website\drivegrid
npm run dev -- --webpack
```

1. Open `http://localhost:3000/vpp-demo/dispatch` and Reset demo.
2. Leave Entire fleet / Discharge / 1 MW, confirm the current interval, and execute.
   Expect 1 MW accepted, 0.25 MWh export, interval 00:00 recorded, clock 00:15.
3. Double-click without confirming the next interval; verify no second execution.
4. Open Dashboard through sidebar navigation. Inspect dispatch activity and SOC;
   confirm charts/revenue remain reference fixtures.
5. Reset; choose Individual asset, EV / V2G 0001, Discharge, 20 kW. Confirm/execute.
   Expect 6 kW accepted, 14 kW curtailed, 1.5 kWh delivered, SOC 65.895% displayed.
6. Open Assets, search `ev-v2g-0001`, inspect kW/kWh and updated SOC. Mark unavailable
   and save; return to Dispatch and confirm the next interval to inspect rejection.
7. Reset; select individual EV, Charge 6 kW, confirm/execute. Expect SOC 69.9%,
   -1.5 kWh AC, +1.425 kWh battery, and 0.075 kWh loss.
8. Select Idle, confirm/execute; verify no energy change. Start playback, Pause,
   and Step; check history is unchanged by time-only controls and navigation.
9. Reset; confirm midnight, empty history, original SOC and availability. Repeat
   the same requests to verify reproducibility. Review mobile/tablet layouts.

```powershell
npm run test:vpp
npx eslint app/vpp-demo lib/vpp tests/vpp
npm run build -- --webpack
npm run start
```

## Known limitations

This is a lumped-energy demonstration, not production dispatch software. It omits
voltage/current models, SOC-dependent efficiencies, ramping, degradation, thermal
limits, self-discharge, network constraints, forecasts, optimization, and market
settlement. Uniform efficiencies and equipment ratings are illustrative.

Fleet allocation is greedy rather than fair/economic. Search exposes the first
100 matching assets in the selector; IDs can locate every registered asset.
History is bounded by the 96-interval day and stored only in memory. No full audit
trail/export, persistence, or automated browser test dependency was introduced.
Interactive browser checks do not substitute for broad real-device/browser testing.
Background timer throttling can slow playback, but interval physics remains fixed.

Stop at Phase 3 for Product Owner acceptance; Phase 4 needs explicit approval.
