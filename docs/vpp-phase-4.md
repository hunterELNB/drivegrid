# DriveGrid VPP Demo — Phase 4 technical report

Historical acceptance report: the price levels and default thresholds below
describe Phase 4. Phase 5 supersedes those assumptions and adds simulated
settlement and owner allocation; see `docs/vpp-phase-5.md` for the current model.

## Implementation summary

The Market route is now a deterministic ERCOT-inspired simulator with 96 synthetic
quarter-hour prices, clock-aligned highlighting and statistics, configurable
threshold rules, a physical recommendation preview, explicit execution, and
illustrative gross energy economics. It shares the existing asset state, clock,
dispatch engine, and history with manual Dispatch, Assets, and Dashboard.

Preview does not change SOC, time, history, or economics. Market execution uses
the Phase 3 engine and the same interval guards as manual execution. No second
SOC ledger, dispatch history, cash ledger, or automatic execution service exists.

All work remains local and uncommitted. No staging, commits, pushes, remote
branches, pull requests, remote repository changes, deployments, external market
connections, business-service calls, formal settlement, or Phase 5 work occurred.
No packages were added or updated.

## Complete Phase 4 file inventory

Created:

- `lib/vpp/market-data.ts` — synthetic prices, lookup, scenario ID and statistics.
- `lib/vpp/market-decision.ts` — settings validation and pure recommendation engine.
- `lib/vpp/economics.ts` — pure signed energy valuation and cumulative aggregates.
- `app/vpp-demo/market/page.tsx` — rules, preview/execute, results and market history.
- `app/vpp-demo/market/MarketPriceChart.tsx` — highlighted SVG and accessible data table.
- `app/vpp-demo/market/market.module.css` — scoped responsive Market styles.
- `app/vpp-demo/_components/EconomicSummary.tsx` — shared calculated economics panel.
- `tests/vpp/market.test.mjs` — 16 new automated tests.
- `docs/vpp-phase-4.md` — this report.

Modified:

- `lib/vpp/simulation.ts` — shared settings/revision, market action, source/price/
  valuation snapshots in the existing history, and reset behavior.
- `lib/vpp/units.ts` — USD formatting, separate from economic calculations.
- `app/vpp-demo/[module]/page.tsx` — excludes Market from future placeholders.
- `app/vpp-demo/dispatch/page.tsx` — clearer energy terminology and shared history
  source, synthetic price, and gross energy value columns.
- `app/vpp-demo/page.tsx` — clock-aligned synthetic price and calculated economics.
- `app/vpp-demo/_components/DispatchActivity.tsx` — manual/market sources and value.

The corporate homepage, contact API, global CSS, root layout, assets fixtures,
Phase 3 physical engine, Context provider, package manifest, lockfile, and
TypeScript configuration were not modified in Phase 4. Earlier approved local
package/config modifications remain in the working tree.

## Synthetic price assumptions

- Fixed scenario ID: `synthetic-ercot-inspired-2026-10-23`.
- Reference day: 23 October 2026, America/Chicago, aligned to the existing clock.
- Exactly 96 prices, one per 15-minute interval, in USD/MWh.
- Deterministic hourly anchors with fixed quarter-hour offsets. No random values,
  downloaded prices, live feeds, or claims of historical ERCOT settlement data.
- Negative overnight minimum: **-30 USD/MWh at 02:00 CT**, interval 8.
- Illustrative scarcity maximum: **1,500 USD/MWh at 18:30 CT**, interval 74.
- Initial price: **21 USD/MWh**; next price: **24 USD/MWh**.
- Daily arithmetic average: **91.427 USD/MWh displayed**. Equal interval durations
  make arithmetic and time-weighted daily averages equivalent.
- The price at interval `n` values energy executed over that interval. History
  captures that price before time advances and is not repriced by later edits.
- At interval 95 there is no next price; at completion (96) neither current nor
  next price exists. The UI displays N/A and requests reset instead of reusing the
  last price. Current-interval highlight disappears after completion.

The SVG chart highlights the current interval in cyan, includes units and Central
Time axes, and provides exact prices in a 96-row expandable table. On narrow
screens the chart and tables scroll within focusable regions to keep labels
readable without document-level overflow.

## Decision rules and physical feasibility

Default applied settings:

| Setting | Default |
| --- | --- |
| Charge threshold | 30 USD/MWh |
| Discharge threshold | 100 USD/MWh |
| Requested fleet power | 1 MW |

Rules are deliberately transparent:

1. `price < charge threshold` recommends Charge.
2. `price > discharge threshold` recommends Discharge.
3. All prices between or exactly equal to either threshold recommend Idle.

Both thresholds must be finite, charge must be strictly below discharge, and
configured fleet power must be positive and finite. Negative thresholds are valid.
Draft edits must be applied before Preview is enabled. Applied settings persist
between demo routes and reset to defaults on Reset demo.

The configured fleet power is a requested target, not a claim of deliverability.
The recommendation passes that request to the Phase 3 dispatch engine. Preview
shows the rule direction/explanation, requested versus physically feasible power,
acceptance/curtailment/rejection status, and reasons. Idle requests zero power.

The physical engine remains authoritative for asset availability, status, V2G,
charge/discharge ratings, SOC limits, 15-minute energy headroom, and 95% charge and
discharge efficiencies. Its stable-ID greedy allocation remains unchanged. The
market layer does not duplicate battery physics or optimize allocation.

## Execution, clock synchronization, and shared state

Market execution is explicitly initiated by the user from a current preview and
requires interval confirmation. The preview carries interval, reset-version, and
asset/settings revision tokens. Asset edits, applied settings changes, any
execution, clock advancement, or reset invalidate it. Running playback and the
end-of-day state block execution. Double-clicking cannot execute a stale preview.

Execution applies the physically evaluated result atomically in the existing
reducer, appends to the same history, and advances exactly one 15-minute interval.
Valid Idle and physical rejection attempts consume an interval, consistently with
Phase 3. Invalid input/configuration does not execute. Reset clears history and
errors, restores fixture assets/SOC, resets settings, and returns to midnight.

Every history interval now records:

- source (`manual` or `market`);
- original interval start/end timestamps;
- fixed scenario ID and synthetic interval price;
- Phase 3 physical result and individual SOC snapshots;
- calculated interval gross energy value.

Manual dispatch is preserved and also receives its executed interval's synthetic
price. Economics include **all executed dispatch**, with source explicitly shown;
the Market page additionally lists the latest 10 market-triggered records.
The Dispatch page retains the full shared day history and per-device detail.

Start/Pause/Step remain **time-only**. Navigation neither executes recommendations
nor resets shared state. There is no pending automatic dispatch. Refreshing or
leaving the demo restores fixtures because state remains memory-only.

## Economic formulas and signs

For each executed interval:

`Gross Energy Value (USD) = signed AC/grid energy (MWh) × synthetic price (USD/MWh)`

Grid export/discharge is positive; grid import/charge is negative. Therefore:

| Grid action | Positive price | Negative price |
| --- | --- | --- |
| Export | Positive value | Negative value/cost |
| Import | Negative value/cost | Positive value/credit |

Idle and rejected zero-energy requests have zero value. Valuation uses **accepted
grid energy**, never requested power or battery-side energy. The 95% efficiency
losses already affect stored energy and deliverability through Phase 3 physics;
losses are not deducted again from grid-energy cash value.

Derived totals (no mutable balance ledger):

- Cumulative value = sum of interval gross values across manual and market history.
- Total exported MWh = sum of positive signed grid energies.
- Total imported MWh = negative of the sum of negative grid energies (a magnitude).
- Discharging value = sum of export energy × each executed price; can be negative.
- Charging cost/credit = negative of summed import values: **positive means cost,
  negative means credit**.
- Cumulative value = discharging value − charging cost/credit.
- Energy-weighted export price = discharging value / exported MWh, including
  negative-price exports; N/A when no energy has been exported.

These are illustrative gross grid-energy values, not net profit, formal
settlement, realized revenue, customer distribution, or inventory valuation.
Initial battery energy has no acquisition cost basis in this demonstration.
Displayed values explicitly exclude market fees, network charges, QSE fees,
battery degradation, taxes, and contractual revenue sharing.

## Units and reference content

Portfolio summaries retain MW/MWh, individual records retain kW/kWh, and editable
fields state MW or USD/MWh explicitly. USD values display cents; calculations and
the shared ledger retain full precision. Tiny values can round to $0.00 for
display; aggregation never uses those rounded strings. Negative zero is normalized.

Individual Dispatch columns now read:

- Grid Energy (kWh)
- Battery Energy Change (kWh)
- Energy Loss (kWh)
- Battery SOC Before → After

Explanatory text states positive grid energy = export, negative = import, and
positive battery change = stored energy increase.

Dashboard's synthetic price is now clock-aligned. Its calculated gross energy
economics and dispatch events are separate from the unchanged $4,280 illustrative
daily revenue, hourly reference charts, and original reference operations events.
Those reference figures are not calculated market or settlement results.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run test:vpp` | **47 passed**, zero failures: 31 existing + 16 Phase 4 tests |
| `npx eslint app/vpp-demo lib/vpp tests/vpp` | **Passed** |
| `npm run build -- --webpack` | **Passed** compilation, TypeScript, static generation |
| `npm run lint` | Existing **seven homepage errors and one warning**, no VPP errors |
| Protected corporate source, global CSS, root layout, lockfile | No diff |

New tests cover 96 finite contiguous intervals, 15-minute clock alignment, negative
prices and scarcity values, exact threshold boundaries, invalid settings,
charge/discharge/idle recommendations, pure previews, physical feasibility,
market SOC changes, source/price capture, shared history, stale and duplicate
guards, four valuation sign combinations, zero energy, import credits/costs,
weighted export price, no double counting of efficiency losses, time-only
playback, end-of-day handling, reset/replay, and USD/unit formatting.

Node 24.21.0 was used. The existing harmless Node module-type detection warning
remains. The existing Webpack fallback avoids the previously reported Turbopack
worker issue; root Google Fonts still require access during a production build.

## Local production-browser verification

- Current/next prices and daily min/max/average render correctly; cyan chart marker
  tracks the simulation interval.
- Preview at midnight changes neither the clock nor zero execution/economic totals.
- Market Charge 1 MW at 21 USD/MWh: -0.25 MWh grid energy, -$5.25 interval value,
  clock 00:15. Double-click executes one interval; old preview becomes disabled.
- Shared Assets shows BESS 0001 at 75.125% SOC. Dashboard shows weighted SOC 68.2%,
  next synthetic price 24 USD/MWh, and a MARKET event; reference revenue stays
  $4,280. Dispatch history shows the market source, price and value.
- Manual fleet Discharge 1 MW at the next 24 USD/MWh interval yields +$6.00. The
  same economic summary becomes $0.75, with 0.25 MWh imported and exported and
  an energy-weighted export price of 24 USD/MWh.
- Equal thresholds are rejected and Preview remains disabled until valid edits
  are applied. Advancing the clock invalidates an existing preview.
- At 02:00, synthetic price -30 USD/MWh recommends Charge. Executing 1 MW imports
  0.25 MWh and earns a $7.50 credit. The sequence above totals $8.25, with charging
  cost/credit -$2.25, discharging value $6.00, and three executed intervals.
- A 100 MW request previews as 16.7 MW feasible and 83.3 MW curtailed in the tested
  state. Preview does not change economics. Applied power persists across pages.
- Custom thresholds 0/10 trigger Discharge at 21 USD/MWh; 0/100 trigger Idle at
  24 USD/MWh. Executed Idle has zero grid energy and zero value.
- Reset restores midnight, original SOC, default 30/100 thresholds and 1 MW target,
  empty results/history, and $0.00 economic totals.
- Desktop, 390px mobile, and 768px tablet Market layouts inspected; no observed
  document-level horizontal overflow. Wide chart/tables scroll internally.
- No browser console errors observed.
- Corporate return link opens the unchanged homepage; its original heading and
  enabled inquiry form remain available. The form was not submitted; no emails.

Browser verification was interactive, not a new automated browser dependency.

## Step-by-step local acceptance

Use Node 24 in the existing local project:

```powershell
cd C:\business\website\drivegrid
npm run dev -- --webpack
```

Open `http://localhost:3000/vpp-demo/market`.

1. Reset demo. Confirm 00:00, price 21, next price 24, minimum -30 and maximum 1,500
   USD/MWh. Expand the exact-price table and inspect the cyan current marker.
2. Keep applied defaults 30/100 USD/MWh and 1 MW. Preview. Confirm Charge, 1 MW
   requested/feasible, no history, zero economics, and unchanged time/SOC.
3. Confirm and execute. Expect clock 00:15, 0.25 MWh imported and -$5.25 value.
   Try the old Execute button again; it must be disabled.
4. Navigate to Assets and search `commercial-bess-0001`: expect 75.125% SOC. Open
   Dashboard and Dispatch: confirm shared source/price/value history and the new
   individual energy column names. Reference revenue remains illustrative.
5. On Dispatch, execute a manual fleet 1 MW Discharge for 00:15. Return to Market:
   expect $0.75 cumulative gross value and two shared executed intervals.
6. Preview again, then Step once. The preview becomes stale and cannot execute.
7. For a negative-price check, Reset and Step eight times to 02:00. Preview and
   execute Charge 1 MW at -30 USD/MWh. Expect +$7.50 gross value, charging credit
   -$7.50, 0.25 MWh imported, and no exports.
8. Set target power to 100 MW, Apply and Preview; inspect feasible power and
   curtailment. Navigate away/back to confirm applied settings persist.
9. Test invalid equal/reversed thresholds, then valid custom rules. Reset; apply
   charge 0 / discharge 10 to recommend Discharge at 21. Use 0/100 for Idle at 24.
10. Reset; confirm empty history/economics and original settings/assets. Repeat a
    sequence for deterministic results. Inspect desktop/tablet/mobile layouts.

```powershell
npm run test:vpp
npx eslint app/vpp-demo lib/vpp tests/vpp
npm run build -- --webpack
npm run start
```

## Known limitations and handoff

One fixed synthetic scenario, uniform efficiencies, simple threshold logic and
stable greedy allocation are intentional. There is no forecasting, AI optimizer,
ERCOT bidding, real trading, SOC opportunity-cost optimization, formal settlement,
customer distribution, initial inventory cost, persistence, or external service.

Economics are gross energy cash values only. They do not establish profitability
or actual market eligibility. History is bounded by the 96-interval day and kept
in browser memory. The Market list shows the latest 10 market-source executions;
full mixed-source history remains on Dispatch. Applied rules persist across demo
navigation; drafts and previews are local views and are discarded on navigation.
Background throttling may slow time-only playback, without altering interval
physics. Broader real-device/cross-browser testing remains future validation.

Phase 4 is complete for Product Owner acceptance testing. Stop here; Phase 5
requires explicit approval. No remote submission or deployment is authorized.
