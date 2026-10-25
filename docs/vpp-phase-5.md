# DriveGrid VPP Demo — Phase 5 technical report

## Implementation summary

Phase 5 adds a pure asset-level simulated settlement engine, configurable
commercial assumptions, exact-cent reconciliation, and a working EV Owner Portal.
All financial results derive from the existing executed dispatch history and its
captured synthetic prices. No separate SOC ledger or dispatch history was added.

The shared 96-interval price source now uses the Product Owner's requested levels
and default charge/discharge thresholds of 50/300 USD/MWh. Market displays the
USD/kWh equivalent, and its chart covers the expanded range. Existing battery
physics, efficiencies, manual dispatch, preview guards, and clock behavior remain
unchanged. No packages were added or updated.

## Complete Phase 5 file inventory

Created:

- `lib/vpp/settlement.ts` — validation, rounding, deduplication, per-asset calculations,
  aggregation, and reconciliation.
- `app/vpp-demo/_state/useSettlement.ts` — memoized derived view of shared history.
- `app/vpp-demo/_components/SettlementTotals.tsx` — reusable USD totals cards.
- `app/vpp-demo/_components/SettlementSummary.tsx` — calculated Dashboard allocation.
- `app/vpp-demo/settlement/page.tsx` — totals, commercial controls, reconciliation,
  interval history, and filtered/paginated asset details.
- `app/vpp-demo/settlement/settlement.module.css` — scoped settlement/owner styling.
- `app/vpp-demo/owner/page.tsx` — EV selector, current SOC, participation and earnings.
- `tests/vpp/settlement.test.mjs` — 19 new tests, including a complete day stress run.
- `docs/vpp-phase-5.md` — this report.

Modified:

- `lib/vpp/market-data.ts` — revised deterministic prices and scenario ID.
- `lib/vpp/market-decision.ts` — default thresholds 50/300.
- `lib/vpp/units.ts` — price conversions and equivalent price formatting.
- `lib/vpp/simulation.ts` — shared commercial configuration, validation and reset.
- `app/vpp-demo/page.tsx` — calculated settlement summary.
- `app/vpp-demo/market/page.tsx` — dual price units and explicit stress-spike label.
- `app/vpp-demo/market/MarketPriceChart.tsx` — range, tooltips and equivalent-price table.
- `app/vpp-demo/[module]/page.tsx` — Settlement and Owner removed from placeholders.
- `tests/vpp/market.test.mjs` — scenario-specific expectations updated; behavior tests retained.
- `docs/vpp-phase-4.md` — marks its previous scenario as historical, superseded here.

The corporate homepage, contact API, global CSS, root layout, physical dispatch
engine, domain fixtures, package manifest, lockfile, and TypeScript configuration
were not modified by this phase. Earlier approved local package/config changes
remain uncommitted in the working tree.

## Revised synthetic market assumptions

Scenario ID: `synthetic-ercot-inspired-2026-10-23-phase5`. The date and Central Time
alignment remain unchanged. Interval 0 starts at 00:00 CT on 23 October 2026.

| Illustrative level | USD/MWh | USD/kWh | Representative interval |
| --- | ---: | ---: | --- |
| Negative valley | -200 | -0.20 | 8–9, starting 02:00 CT |
| Ordinary low | 30 | 0.03 | 0–4, starting midnight |
| Moderate | 100 | 0.10 | 32–35, starting 08:00 CT |
| High-price period | 500 | 0.50 | 68–72, starting 17:00 CT |
| Intentional extreme scarcity | 2,500 | 2.50 | 74, 18:30 CT |

Fixed anchor points with deterministic linear transitions produce 96 finite
quarter-hour prices, rounded to 0.001 USD/MWh. Plateaus give the ordinary levels
multiple meaningful intervals. The intentional scarcity spike occupies one
interval; it is explicitly labeled a stress event, not a normal or typical ERCOT
price. The daily average displays as 171.406 USD/MWh.

The only price source remains `market-data.ts`. Executed manual and market
dispatch capture the corresponding interval price; Settlement and Owner use that
snapshot, never the current clock price or a second price array. Refresh/reset is
the starting point for reviewing the revised scenario; there is no persisted
legacy run or migration. Historical Phase 4 reports describe its earlier prices.

Conversions are `USD/kWh = USD/MWh / 1000` and the inverse multiplication by 1000.
Market cards, tooltips, and the exact-price table show equivalents. Price-per-kWh
formatting retains 2–6 decimals, separate from USD payment-amount formatting.

Default decision rules are unchanged except their thresholds: charge strictly
below 50, discharge strictly above 300, otherwise Idle, including exact boundaries.
No live ERCOT data, tariff verification, trading, bidding, or payment service exists.

## Settlement source and attribution

`settleHistory` accepts executed `DispatchInterval` records, the registered ID/type
mapping, and applied commercial settings. It returns a derived, repeatable view,
not posted transactions. Previews/recommendations are absent from that history.

For each executed asset record it preserves ID/type, timestamp, step, source,
direction/status, accepted power, signed grid energy, battery energy change,
synthetic price, raw gross value, rounded costs/net/shares, and deficit. Attribution
uses **actual asset energy**, never nameplate capacity or a pro-rata fleet estimate.

Identity is `interval timestamp + asset ID`. Identical duplicate records are
suppressed and counted; conflicting financial duplicates, unknown asset IDs, or
unreconciled source data are rejected. Duplicate execution is also blocked by the
existing reducer before history is appended. Re-rendering the derived view cannot
post additional settlement or double-count a record.

Idle/rejected zero-energy rows are retained with zero costs/payouts. The Settlement
detail view hides those rows by default; an explicit toggle includes them. Fleet
rejections with no assigned asset record contribute zero totals and remain in
interval history. Owner participation counts nonzero energy intervals, while its
history can show executed zero-energy rows. Nonparticipating EVs earn nothing.

## Commercial defaults and validation

| Assumption | Default |
| --- | --- |
| Asset-owner share | 70% |
| DriveGrid platform share | 30% |
| QSE service fee | 5% of positive rounded asset gross value |
| Transaction fee | 1 USD/MWh absolute grid energy |
| Battery degradation | 0.02 USD/kWh absolute battery energy change |

Percentages must be finite and within 0–100. Owner + platform must equal 100%
within `1e-9` percentage points. Rates must be finite and nonnegative. A numeric
safety bound of 1,000,000 USD per stated rate unit applies to this fixed demo;
integer-cent overflow is also rejected. This bound is not a market tariff limit.

Applying changes recalculates **all executed records in the current run**. The
form and explanation state that retrospective behavior explicitly. It changes
neither SOC, time, dispatch records nor captured market prices. Applied settings
survive demo navigation; reset restores all defaults. There are no locked or
versioned customer contracts in this demonstration.

## Formulas, signs, and deficits

Retain the Phase 4 convention: positive grid energy is export/discharge; negative
grid energy is import/charge. Battery energy increase is positive.

For an asset interval, let `Eg` be signed grid MWh, `ΔEb` be battery energy change
in MWh, and `P` be the captured price in USD/MWh:

`Raw Gross USD = Eg × P`

No efficiency loss is deducted again. Phase 3 already determines the accepted
grid energy and battery delta using its physical limits and 95% efficiencies.
Degradation is the explicitly requested operating cost on actual battery
throughput, not an additional efficiency adjustment.

Let `C(x)` round a USD amount to integer cents, half away from zero:

- `G = C(Eg × P)`
- `Q = C(max(G, 0) / 100 × QSE percent / 100)`
- `T = C(abs(Eg) × transaction USD/MWh)`
- `D = C(abs(ΔEb) × 1000 × degradation USD/kWh)`
- `N = G − Q − T − D` (signed net distributable cents)
- `PositivePool = max(N, 0)`
- `Owner = C(PositivePool / 100 × owner percent / 100)`
- `Platform = PositivePool − Owner`
- `Deficit = max(-N, 0)` (a positive magnitude)

Only positive asset-interval net values are distributed. A zero/negative net
generates no positive payout. Deficits remain unallocated operating deficits;
they are not billed to owners and do not offset positive payouts from another
asset or interval. Consequently, a fleet can show positive payouts and a deficit
simultaneously. This is a deliberate illustrative treatment, not a contractual
loss-allocation policy.

Examples for EV 0001 at 6 kW over 15 minutes under defaults:

- Charge at -200 USD/MWh: 1.5 kWh imported, $0.30 gross, $0.02 QSE, $0.00 rounded
  transaction fee, $0.03 degradation, $0.25 net, $0.18 owner and $0.07 platform.
- Discharge at 500 USD/MWh: 1.5 kWh exported, $0.75 gross, $0.04 QSE, $0.00 rounded
  transaction fee, $0.03 degradation, $0.68 net, $0.48 owner and $0.20 platform.
- Charge at 30 USD/MWh: raw gross -$0.045 rounds to -$0.05; degradation $0.03
  yields an $0.08 deficit and no payout. Negative gross is preserved.

## Currency rounding and reconciliation

Physical quantities and raw grid-energy economics retain full numeric precision.
Every asset gross value, QSE fee, transaction fee and degradation cost is rounded
to cents before calculating the signed net. Owner share is rounded from positive
net; platform receives the residual cent. This deterministic residual convention
means tiny rows may not display an exact nominal 70/30 ratio, but shares always
sum exactly to the positive pool. No separate fleet-level rounding is applied.

Integer-cent identities hold per row and fleet:

`Gross − QSE − Transaction − Degradation = Net = Owner + Platform − Deficit`

The allocation residual must be **exactly zero cents**. Summaries sum asset cents,
so they can differ from Phase 4's unrounded aggregate grid-energy value. The UI
shows the raw fleet gross, rounding difference, and a permissible bound:

`Gross rounding bound (USD) = nonzero gross row count × 0.005 + source tolerance`

Raw asset and fleet gross values are accumulated with compensated summation.
The unchanged physical engine sums floating-point asset energy, so the comparison
allows a conservative scale-aware accumulation tolerance:

`source tolerance (USD) = 1e-9 + 8 × Number.EPSILON × Nmax × sum(abs(raw asset gross USD))`

`Nmax` is the maximum deduplicated asset-record count in an interval. This is a
floating-point source check, not permission to leave a cent-based allocation
residual. The stress test asserts a source tolerance below $0.0001. Deliberately
corrupted source totals still fail the source check.

A full-day test exposed an approximately `-3.09e-9 USD` difference from naive
summation across 98,730 records. Compensated summation and the explicit bound
resolve that numerical comparison without changing physics or monetary cents.

At the default 1 MW fleet export at 500 USD/MWh, seven asset records yield $125.03
rounded gross versus $125.00 raw fleet gross. The $0.03 difference is below the
seven-row half-cent bound. Owner $79.25 + platform $34.00 = $113.25 positive net
after $6.27 QSE, $0.27 transaction and $5.24 degradation costs.

Small EV transaction fees can round to zero per interval. That follows this
explicit cent-based demonstration method; it is not a claim about actual billing.

## UI and cross-page behavior

Settlement displays all eight fleet totals, applied commercial controls,
reconciliation, interval history, and asset details. Filters cover ID, type,
interval, direction and optional zero-energy records. Details paginate 20 rows;
filtered subtotals are labeled separately from full-fleet totals.

The owner portal selects a simulated EV by ID/name/city, shows its current shared
SOC and equipment units, imported/exported kWh, participating intervals, attributed
gross/costs/earnings/deficit, and a paginated calculation history. The selector
shows 100 matches at a time; search by ID can locate all 1,000 EVs. There is no
authentication, real identity, banking, payment account or payable balance.

Dashboard adds calculated net/owner/platform/deficit results and links to detailed
assumptions. Gross economics remain labeled as excluding fees; Settlement adds
the requested illustrative cost/share layer. Static $4,280 reference revenue and
the older hourly reference charts are not replaced by or represented as actual
settlement results. All pages use one shared asset/dispatch state.

## Automated and build results

| Check | Result |
| --- | --- |
| `npm run test:vpp` | **66 passed**, zero failures: 47 prior tests + 19 new tests |
| `npx eslint app/vpp-demo lib/vpp tests/vpp` | **Passed** |
| `npm run build -- --webpack` | **Passed** compilation, TypeScript and route generation |
| `npm run lint` | Existing **seven homepage errors and one warning** only |
| Protected homepage/contact API/global CSS/root layout/lockfile diff | **Unchanged** |

Prior test behavior remains covered; scenario-specific Phase 4 expected prices
and default threshold values were updated to the explicitly approved refinement.
The new tests cover all requested price levels and conversions, defaults,
positive/negative gross, QSE/throughput/degradation costs, zero/rejected results,
shares and allocation endpoints, deficits, actual-energy attribution, duplicates,
source corruption, pure previews, manual/market consistency, invalid commercial
inputs, half-cent rounding, retrospective model changes, reset/replay, and the
full 96-interval run with history-order invariance.

Node 24.21.0 was used. The existing harmless module-type detection warning
remains. The supported Webpack fallback is used for the previously recorded
Turbopack worker issue; existing Google Fonts still require access at build time.

## Local browser verification

- Market displays 30 / 0.03 initially, -200 / -0.20 minimum, 2,500 / 2.50 maximum,
  171.406 USD/MWh average, and applied 50/300 thresholds. The stress spike is
  explicitly identified as atypical.
- Preview alone leaves all settlement totals zero.
- A midnight market fleet Charge 1 MW produces -$7.50 gross, $0.25 transaction,
  $4.75 degradation, $12.50 deficit, and no owner/platform payout.
- Manual EV Charge 6 kW at interval 8 (-200 USD/MWh) gives $0.30 gross and $0.18
  owner earnings. Owner history shows the exact EV and energy; a nonparticipant
  EV shows zero participation and earnings.
- EV Discharge 6 kW at interval 68 (500 USD/MWh) adds $0.48 owner earnings. The
  EV's two intervals total $1.05 gross and $0.66 owner earnings, with 1.5 kWh
  imported and exported and current SOC 67.795% displayed.
- Market fleet Discharge 1 MW at interval 69 produces the seven-row fleet example
  above. The combined four-interval run shows $118.58 rounded gross, $6.33 QSE,
  $0.52 transaction, $10.05 degradation, $101.68 net, $79.91 owner, $34.27 platform
  and $12.50 deficit. Raw gross is $118.55 with a $0.03 rounding bridge; cent
  residual is zero.
- Invalid 80/30 allocations are rejected. Applying 50/50 recalculates fleet owner/
  platform amounts to $57.10/$57.08 and EV owner earnings to $0.47 without changing
  SOC, clock or dispatch records. Restoring 70/30 restores previous earnings.
- ID filtering shows the EV's two attributed rows and matching filtered subtotals.
- Reset restores zero settlement/earnings, midnight, 68% SOC and 70/30 defaults.
  Dashboard displays the same cleared allocation results.
- Desktop, 390px mobile and 768px tablet layouts inspected. Wide financial tables
  scroll internally; no document-level horizontal overflow observed. Mobile
  navigation works. Browser console reports no errors during the checks.
- Corporate return opens the original homepage heading and enabled inquiry form.
  The form was not submitted; no email or external business service was invoked.

Browser checks were interactive; no new browser-test dependency was installed.

## Local acceptance instructions

Use Node 24 from the existing project:

```powershell
cd C:\business\website\drivegrid
npm run dev -- --webpack
```

1. Open `http://localhost:3000/vpp-demo/market` and Reset demo. Check price units,
   the -200/2,500 extrema, and default 50/300 thresholds.
2. Preview a 1 MW Charge. Visit Settlement: totals must remain zero. Return,
   preview/confirm/execute; Settlement should show the $12.50 deficit example.
3. On Dispatch, Step seven times from interval 1 to interval 8 (02:00 CT). Choose
   Individual asset → EV / V2G 0001 → Charge → 6 kW; confirm and execute.
4. Open EV Owner Portal and select/search `ev-v2g-0001`. Expect $0.18 earnings,
   1.5 kWh imported and SOC 69.9%. Select a nonparticipant EV to verify zeros.
5. For the positive export example, return to Dispatch and Step from interval 9
   to 68 (17:00 CT), with no execution during time advancement. Execute Individual
   EV 0001 Discharge 6 kW. Its owner earnings should total $0.66.
6. At interval 69, Market recommends Discharge under defaults. Preview/confirm/
   execute 1 MW. Review the four-interval totals above, the $0.03 rounding bridge,
   asset detail filters and the zero-cent reconciliation residual.
7. Apply invalid 80/30 shares; verify rejection. Apply 50/50, inspect owner portal
   and Dashboard recalculation, then restore 70/30. Inspect individual fees and
   costs in the financial tables by horizontal scrolling where necessary.
8. Reset; confirm empty history, zero financial results, original SOC, all default
   commercial settings, default thresholds and midnight. Repeat a sequence for
   reproducibility and review mobile/tablet layouts.

```powershell
npm run test:vpp
npx eslint app/vpp-demo lib/vpp tests/vpp
npm run build -- --webpack
npm run start
```

## Limitations and handoff

The commercial model is illustrative and retrospectively applied to the current
run, not versioned contractual settlement. It has no invoices, taxes, real tariffs,
cash movement, accounts, banking, customer loss allocation, inventory cost basis,
authentication, persistence, real ERCOT integration or audit-grade financial posting.
Deficits deliberately remain unallocated; positive intervals are not netted with
negative ones before sharing. This treatment does not establish real profitability.

Per-asset cent rounding can differ from unrounded gross economics, as shown in
the reconciliation bridge. Shared prices remain fixed synthetic inputs and the
underlying simple battery/greedy dispatch assumptions are unchanged. The owner
portal initially selects the first EV, which may have no market fleet allocation;
use individual dispatch to create its participation example.

State is memory-only. Refresh/leaving the demo resets the run. Reset clears
dispatch-related settlement and restores commercial defaults; view preferences
such as the selected EV are not financial state. The day remains bounded to
96 intervals. Real-device/cross-browser coverage beyond the recorded checks is
future validation work.

All work remains LOCAL. No git add/commit/push, remote branch/PR, deployment, live
market call, email, payment, or Phase 6 implementation occurred. Stop here for
Product Owner acceptance; further phases and any eventual remote submission or
deployment require explicit approval.
