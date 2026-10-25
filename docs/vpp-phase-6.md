# Phase 6 — Scenario analysis, strategy comparison and UI refinement

Date: 23 October 2026. Local implementation only; awaiting Product Owner acceptance.

## Implementation

`/vpp-demo/scenarios` is now a functional strategy lab with six presets, custom parameters, a 1–96 interval horizon, Run Scenario, Compare Scenarios and Reset scenarios. Results include gross value, signed net distributable value, owner/platform allocations, separate deficits, imported/exported energy, final energy-weighted SOC, command counts, rejected/curtailed energy, storage/nameplate ratings and reconciliation residuals. Each result has a price chart with time/units, decision/power/SOC tooltips and expandable interval results.

Scenario controls and results are local to the page. Reset scenarios restores Base Case/default controls and clears results. Reset demo also resets the mounted scenario workspace. Leaving the Scenarios route discards its local results. No scenario execution dispatches a main Context action.

## Presets and assumptions

Every run snapshots the **current** assets (including SOC, availability, status and V2G settings) and applied commercial settings. Existing main dispatch history is excluded. Each scenario starts an independent synthetic day at midnight Central Time on 23 October 2026, regardless of the main clock. Compare uses one shared snapshot and each preset's defaults; it deliberately ignores custom input edits. Run uses the selected preset's price profile and the entered parameters.

| Preset | Price profile | Charge below / discharge above USD/MWh | Target MW | Requested reserve | Capacity multiplier |
|---|---|---:|---:|---:|---:|
| Base Case | Existing Phase 5 anchors/interpolation | 50 / 300 | 1 | 20% | 1 |
| High Volatility | Deviations from 100 USD/MWh × 1.5 | 50 / 300 | 1 | 20% | 1 |
| Low Volatility | Deviations from 100 USD/MWh × 0.2 | 50 / 300 | 1 | 20% | 1 |
| High Storage Capacity | Existing price profile | 50 / 300 | 1 | 20% | 2 |
| Conservative Dispatch | Existing price profile | 20 / 600 | 0.5 | 40% | 1 |
| Aggressive Dispatch | Existing price profile | 80 / 150 | 2 | 20% | 1 |

Volatility transformation: `100 + (existing interval price − 100) × factor`. This preserves timing and the scarcity/overnight structure, rather than generating random prices. High-volatility prices span −350 to 3,700 USD/MWh; low-volatility prices span 40 to 580 USD/MWh. These are illustrative stress cases, not ERCOT observations or forecasts.

Storage scaling changes each asset's MWh capacity, retaining its starting SOC, MW ratings, asset count and availability. It therefore scales starting stored energy too; this is an explicit equipment/initial-energy assumption, not free energy produced during simulation. Costs of adding equipment and terminal stored-energy value are not included. With the default modest dispatch target, larger storage need not improve cash revenue; small financial differences can arise from per-asset allocation and existing cent rounding.

## Strategy, physics and settlement

- Strictly below the charge threshold → charge; strictly above the discharge threshold → discharge; between/equal → idle. The main market and scenario engine share `recommendAtPrice`; no copied decision or battery physics implementation.
- Target zero explicitly disables dispatch. Other requests use existing stable asset-ID greedy fleet allocation, not optimization.
- Requested reserve cannot relax the original physical SOC minimum. A below-reserve asset can charge; its effective physical minimum initially equals its current SOC (or original minimum if higher), then rises with SOC until the requested reserve is attained. It cannot export further below the requested floor. No initial SOC is raised to satisfy a reserve.
- Each step invokes the existing dispatch engine exactly once for the interval. Rated MW, separate charge/discharge MW limits, availability/status, V2G restrictions, energy headroom and minimum/maximum SOC remain enforced.
- Grid export is positive and import negative. AC energy = signed AC power × 0.25 hours. Charge efficiency and discharge efficiency remain 95%; losses retain the existing energy-conservation convention. No additional loss debit is imposed.
- Unique fixed timestamps advance sequentially by 15 minutes, with at most 96 intervals. Idle/rejected intervals create no energy earnings.
- The existing settlement engine processes scenario history, using captured prices and commercial settings. Gross is signed grid MWh × USD/MWh; QSE applies to positive rounded gross, transaction costs to absolute grid MWh, and degradation to absolute battery kWh. Existing half-away-from-zero cent rounding, owner rounding/platform residual allocation, separate deficit policy, compensated source sums and reconciliation tolerances are unchanged.
- Zero-energy asset detail rows are omitted from isolated settlement input to bound memory. Their cashflows are zero under the existing engine. All interval aggregate accepted/rejected/curtailed quantities, battery deltas, losses and SOC are retained. Final copied assets and interval summaries are returned; a second persistent per-asset scenario ledger is not created.

Validation: all parameters finite; charge threshold < discharge threshold; threshold magnitudes ≤100,000 USD/MWh; target 0–100 MW; reserve 0–100%; capacity multiplier 0.1–10; integer horizon 1–96. Commercial configuration uses existing validation and safe-cent guards. These limits are demo safeguards, not market rules. Duplicate asset IDs are rejected.

## Display and logo

Central utilities now display numbers, power, energy and prices with at most two decimals; currency remains two decimals. Negative zero is normalized and unit conversions retain full precision. Very small physical quantities may display zero at the selected unit's two-decimal resolution; calculations still use the full value.

`PrecisionInput` displays rounded numbers at rest, reveals exact values on focus and submits the original exact numeric string through a hidden named control. An unrelated save therefore does not round SOC or rates. Inputs retain native required/number checks plus exact-value min/max validation. This precision-preserving focus behavior is the intentional editable-control exception to the normal display rule.

Settlement distinguishes the actual, much smaller internal floating-point source check from the currency-rounding bridge and exact integer-cent allocation identity. Positive tolerance displays use a rounded-up cent ceiling (for example $0.01), explicitly labelled as a display ceiling, never as a substituted engine or accounting allowance. Internal source/rounding tolerances and settlement arithmetic were not changed.

The shared shell uses the existing `public/logo.jpg` through Next Image, with intrinsic dimensions 892 × 413, fixed aspect ratio, alt text, responsive sizing and a link to `/vpp-demo`. The corporate logo file/homepage are unchanged. Formatting applies across Dashboard, Assets, Dispatch, Market, Settlement, Owner, Scenarios and the shared Operations shell/navigation.

## Complete Phase 6 file inventory

Created:

- `lib/vpp/scenarios.ts` — typed presets, parameter validation, pure isolated engine and result model.
- `app/vpp-demo/scenarios/page.tsx` — interactive scenario configuration/results/comparison.
- `app/vpp-demo/scenarios/scenarios.module.css` — scoped responsive styles.
- `app/vpp-demo/_components/PrecisionInput.tsx` — exact-value editing with rounded rest display.
- `tests/vpp/scenarios.test.mjs` — 13 formatting/scenario tests.
- `docs/vpp-phase-6.md` — this report.

Modified:

- `lib/vpp/units.ts` — centralized two-decimal formatting, tolerance display ceiling, input display.
- `lib/vpp/market-decision.ts` — extracted shared recommendation-at-price helper; formatted explanations.
- `app/vpp-demo/_components/Shell.tsx` — existing corporate logo integration.
- `app/vpp-demo/_components/TimeSeriesChart.tsx` — formatted tooltip/table numbers.
- `app/vpp-demo/demo.module.css` — scoped logo dimensions/layout.
- `app/vpp-demo/page.tsx` — centralized KPI/composition/status formatting.
- `app/vpp-demo/assets/page.tsx` — rounded metrics/limits and exact SOC input.
- `app/vpp-demo/dispatch/page.tsx` — precision-preserving power input.
- `app/vpp-demo/market/page.tsx` — precision-preserving threshold/power inputs.
- `app/vpp-demo/settlement/page.tsx` — precision inputs, formatted applied costs and distinct reconciliation explanations.
- `app/vpp-demo/owner/page.tsx` — formatted commercial cost rates.
- `app/vpp-demo/[module]/page.tsx` — reserve placeholder only for Operations; Scenarios has a dedicated route.
- `tests/vpp/dispatch.test.mjs` — update display-only expectations to the approved two-decimal policy; physical assertions unchanged.

No dependencies were added. `package.json` and `tsconfig.json` already had uncommitted changes from earlier phases; Phase 6 did not change them. The work remains on local branch `main`, with prior phase files still uncommitted/untracked as before.

## Verification

- Baseline: all 66 tests passed, scoped VPP ESLint passed, Webpack production build passed.
- Final automated suite: **79/79 passed**, including all earlier tests and 13 new tests. Coverage includes decimal/currency/negative-zero formatting, conversions, parameter validation, shared boundary decisions, 96 unique intervals, efficiency and energy conservation, SOC/power/headroom limits, cent reconciliation and explicit payouts/deficits, six-preset deterministic replay, volatility, capacity scaling, reserve behavior, frozen-input isolation, reset/replay, unavailable/empty assets, zero target and oversized requests.
- Scoped `npx eslint app/vpp-demo lib/vpp tests/vpp`: passed with no warnings/errors.
- `npm run build -- --webpack`: passed; all VPP routes and corporate homepage/contact route built successfully. Existing Google Font downloads needed network permission for the local build; no deployment ran.
- Full `npm run lint`: unchanged corporate `app/page.tsx` issues: six `no-explicit-any` errors (216, 217, 263, 264, 265, 332), unescaped apostrophe error (2729), and existing `<img>` warning (2517). No corporate fixes attempted.
- Existing Node test execution still emits `MODULE_TYPELESS_PACKAGE_JSON`; no project-wide module-system change was introduced.
- Git comparison confirmed no changes to corporate homepage, contact API, root layout/global CSS, existing logo or package lock.

Browser checks against the local production build:

- Base run and all-six comparison completed; all reported allocation residuals $0.00. Fresh-default Base Case: gross $2,405.19; net $2,085.51; owner $1,607.34; platform $689.07; separate deficit $210.90; imports 5.5 MWh, exports 3.75 MWh; final weighted SOC 69.09%; charge/discharge/idle 22/15/59. These are fixture-snapshot examples, not guaranteed results for edited assets.
- Created an actual main market charge (1 MW at 30 USD/MWh), producing gross −$7.50 and deficit $12.50. Main Settlement text/history/clock remained byte-for-byte identical after an isolated six-scenario comparison.
- Entered SOC 68.123456; resting display was 68.12, focus revealed 68.123456, and an availability-only save retained 68.123456. Custom scenario target 1.234567 executed and displayed 1.23 MW, preserving underlying calculation precision. A main Market target of 0.00000123 MW also applied successfully and revealed the exact value on focus despite its rounded rest display.
- Reset scenarios restored target 1 and cleared results; choosing Conservative populated reserve 40. Preset selection and interval details worked.
- Checked all eight VPP routes at a tablet/compact desktop viewport: no page overflow and no main text decimal values beyond two places. Market average rendered 171.41 USD/MWh and 0.17 USD/kWh.
- Checked desktop comparison and narrow mobile layout (375 CSS-pixel content width): mobile menu/Operations navigation/logo return worked; no document overflow. Single-result table fits mobile; multi-preset comparison scrolls within its own labelled region.
- Corporate heading and enabled Submit Inquiry control verified; no form submission/email. Browser error log empty.

Screenshots were saved outside the repository in the task visualization folder: `vpp-phase6-comparison.jpg` and `vpp-phase6-mobile.jpg`.

## Limitations

This is an in-memory deterministic demonstration, not an optimizer or a forecast. It excludes device schedules, self-discharge, network constraints, terminal energy valuation, equipment investment costs, trading, payments and external data. Scenario comparisons execute synchronously in the browser after a short UI paint delay; large runs may briefly occupy the UI thread. Input bounds and compact interval results limit the scope. Results are not persisted across navigation/reload. Differences in starting asset edits and commercial settings legitimately change results; compare reruns are needed after such changes. Existing unrelated full-project lint issues remain.

## Local acceptance

1. In PowerShell, `cd C:\business\website\drivegrid` and run `npm run dev` (or `npm run build -- --webpack`, then `npm run start`). Open `http://localhost:3000/vpp-demo/scenarios`.
2. Keep the main clock paused. Run Base Case and inspect metrics, chart tooltip units/times and the expandable 96 interval rows. Repeat with unchanged inputs to confirm identical results.
3. Click Compare Scenarios; inspect all six columns. Compare explicitly uses preset defaults. On mobile, swipe the comparison region horizontally.
4. Select Conservative/Aggressive/High Storage; confirm documented defaults, run, and compare activity/SOC/storage. Enter custom thresholds/target/reserve/multiplier/horizon and Run. Invalid thresholds or out-of-range parameters must report an error. Zero target must produce no energy or earnings.
5. Reset scenarios: confirm Base controls and empty results. The main clock/history must remain unchanged.
6. In Market, preview/confirm/execute one recommendation. Note Dashboard SOC, clock and Settlement results. Run/compare scenarios, then revisit these pages: the main results must be unchanged. Owner and Dispatch should still use that same main history.
7. In Assets, enter SOC 68.123456. Save: resting display is 68.12; focus reveals full precision. Save an availability change without editing SOC; focus again and confirm precision retained. Check exact fractional commercial rate edits similarly in Settlement.
8. Inspect two-decimal prices, power, energy, SOC and financial/reconciliation values across all pages. Verify no negative zero; tolerance ceilings must remain explicitly distinct from actual internal checks/accounting.
9. At desktop/tablet/mobile widths, verify the reused logo and its dashboard link, sidebar/mobile menu, Operations route and Corporate Website return link. Do not submit the contact form.
10. Run `npm run test:vpp`, `npx eslint app/vpp-demo lib/vpp tests/vpp`, and `npm run build -- --webpack` locally.

No staging, commits, pushes, remote changes, PRs, deployments, real market connections or emails were performed. Stop here for Phase 6 acceptance; Phase 7 requires explicit approval.
