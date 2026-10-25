# Phase 6.1 — Fair strategy comparison and terminal energy accounting

Date: 24 October 2026. Local implementation; pending Product Owner acceptance. Phase 6 remains subject to final acceptance, and Phase 7 is not started.

## Implementation

Scenario results now separate simulated operating cash earnings, battery inventory changes, and comparison-only terminal economic value. Users can configure a terminal reference price (default 100 USD/MWh), choose an initial-weighted-SOC or custom terminal target, and set a symmetric tolerance (default ±2 percentage points).

The results table has four labelled sections: realized simulated operating earnings, stored battery energy, comparison-only terminal valuation/constraint, and physical dispatch activity. Each scenario header and a dedicated row show PASS, FAIL/non-comparable, or N/A/non-comparable for a portfolio with no storage capacity. A failure never removes or silently alters earnings. No ranking is assigned, including when a non-comparable strategy has higher cash or adjusted value.

Run Scenario applies custom strategy controls. Compare Scenarios runs the six existing preset defaults. The new Compare Strategy A / B action runs two Base Case strategies with thresholds 50/300 and 10/100, retaining the Base Case target 1 MW, reserve 20%, storage multiplier 1 and 96 intervals. Both comparison actions use one current asset/commercial snapshot and the same terminal assumptions; they ignore custom strategy edits. The reference strategies contain no hardcoded financial results.

Terminal controls persist when switching preset selection. Reset scenarios restores all strategy and terminal defaults and clears results. Reset demo resets the mounted scenario workspace as before. Results retain their captured assumptions; editing controls requires rerunning to update results.

## Files created and modified

Created:

- `lib/vpp/terminal-energy.ts`: typed settings/defaults/validation, capacity-weighted stored-energy accounting and pure post-run valuation/constraint evaluation.
- `tests/vpp/terminal-energy.test.mjs`: 10 automated tests.
- `docs/vpp-phase-6-1.md`: this report.

Modified:

- `lib/vpp/scenarios.ts`: optional fifth terminal-settings argument and a separate `terminal` result, evaluated after existing settlement. Existing call signatures remain valid through defaults.
- `app/vpp-demo/scenarios/page.tsx`: terminal controls, grouped metrics, clear constraint labels, A/B comparison and reset behavior.
- `app/vpp-demo/scenarios/scenarios.module.css`: scoped section/constraint styling and responsive table headers.

No new dependencies or package changes. No changes to battery physics, market price data/valuation, settlement engine/formulas, main reducer/Context, corporate homepage/contact API, global CSS or logo asset. Prior local uncommitted work remains on `main`; no staging, commits, pushes, PRs or deployment.

## Accounting formulas

For asset capacity `Cᵢ` in battery-side MWh and SOC `sᵢ` in percent:

```text
Stored energy E = Σ(Cᵢ × sᵢ / 100)                  MWh
Capacity-weighted SOC = 100 × E / ΣCᵢ               %
Net stored-energy change ΔE = E_final − E_initial   MWh
Terminal deviation = SOC_final − SOC_target        percentage points
```

All registered assets are included, including unavailable/offline assets: availability does not erase stored energy. Accounting uses each scenario's actual scaled capacities and initial snapshot. It does not average SOC percentages equally. Empty/zero-capacity portfolios have no meaningful terminal SOC constraint; they are explicitly non-comparable rather than receiving a false PASS.

With existing AC grid conventions (imports/exports are nonnegative magnitudes in this equation):

```text
ΔE = imported AC MWh × 0.95 − exported AC MWh / 0.95
   = imported AC MWh − exported AC MWh − conversion losses
```

The physical dispatch engine still accounts for losses exactly once. Terminal accounting reads its resulting SOC; it does not create, remove, charge or discharge energy.

## Terminal valuation and constraint methodology

```text
Terminal energy adjustment = ΔE × reference price                 USD
Adjusted economic value = signed net distributable USD + adjustment
PASS when |SOC_final − SOC_target| ≤ tolerance
```

The default target resolves independently from the exact initial capacity-weighted SOC of the run. For the A/B comparison, both runs use identical initial assets/capacities and therefore the same target. A custom percentage target is common across every compared scenario. Tolerance is in percentage points, not a percentage of the target. A binary-arithmetic boundary guard of `32 × Number.EPSILON × max(1, |final SOC|, |target SOC|)` avoids a spurious failure exactly at the boundary; it does not change SOC, configured tolerance, earnings, or any existing financial/physical tolerances.

The adjustment marks only the **change** in stored battery inventory, not all remaining stored energy. This avoids giving a strategy comparison credit for its initial battery inventory. Initial/final inventory is displayed separately. Larger-capacity presets still start with more stored energy by their explicit Phase 6 assumption; passing a terminal SOC constraint does not make different initial capacities, market profiles or inventories equivalent.

This is an illustrative linear inventory mark, not guaranteed liquidation value or realized market revenue. There is no new terminal sale/recharge, settlement row, fee, owner payout or DriveGrid payout. All `totals` continue to come exclusively from the unchanged settlement engine. The adjustment is neither rounded into the settlement ledger nor distributed. Internal calculations retain full precision; the existing centralized formatters display no more than two decimals and suppress negative zero. Exact editable values remain accessible on focus through the existing PrecisionInput component.

Validation: reference price must be finite and within −100,000 to 100,000 USD/MWh; custom target 0–100%; tolerance 0–100 percentage points, including zero for an exact target. Signed/zero reference assumptions are supported and their arithmetic signs are preserved. Blank comparison assumptions are rejected, rather than being silently interpreted as zero. Existing scenario parameter and equipment validation remains in effect.

## Reproduced Strategy A/B investigation

Fresh deterministic 1,150-asset portfolio, original 117.70 MWh capacity, initial weighted SOC 68%, 1 MW target, existing commercial defaults, original fixed price scenario and 96 intervals. These are outputs reproduced from the engine, not constants driving it.

| Metric | A: charge 50 / discharge 300 | B: charge 10 / discharge 100 |
|---|---:|---:|
| Gross energy value | $2,405.19 | $3,519.69 |
| Net distributable value | $2,085.51 | $3,110.07 |
| Initial stored energy | 80.04 MWh | 80.04 MWh |
| Final stored energy | 81.31 MWh | 72.22 MWh |
| Net stored-energy change | 1.28 MWh | −7.81 MWh |
| Imported energy | 5.50 MWh | 1.75 MWh |
| Exported energy | 3.75 MWh | 9.00 MWh |
| Conversion losses | 0.47 MWh | 0.56 MWh |
| Initial weighted SOC | 68% | 68% |
| Final weighted SOC | 69.09% | 61.36% |
| Charge / discharge / idle intervals | 22 / 15 / 59 | 7 / 36 / 53 |
| Terminal target | 68% | 68% |
| Terminal deviation | 1.09 percentage points | −6.64 percentage points |
| Constraint, ±2 percentage points | PASS | FAIL — non-comparable |
| Terminal adjustment at 100 USD/MWh | $127.76 | −$781.12 |
| Adjusted economic value | $2,213.27 | $2,328.95 |

All Product Owner observed operating values reproduce. Lower charge threshold means fewer charging intervals; lower discharge threshold means more export intervals. B's cash earnings therefore accompany a larger drawdown of initial stored energy. Both have 96 unique sequential timestamps and energy/loss conservation; no duplicate execution or fabricated idle cashflow was found.

The unrounded initial stored energy is 80.036 MWh; the net changes are approximately 1.277631578947 MWh (A) and −7.811184210526 MWh (B). Formulas use these internal values, not the rounded table entries. At the default reference price, B's adjusted value is still higher, but it fails the common terminal constraint. No adjustment was chosen to enforce a desired ranking. At a reference price of 200 USD/MWh, adjusted values are $2,341.04 (A) and $1,547.83 (B); operating cash and constraint status stay unchanged. At zero reference price, adjusted value equals operating net for both.

## Verification

- Baseline automated tests: 79/79 passed.
- Updated automated tests: **89/89 passed**, including all earlier tests and 10 terminal-accounting tests. New coverage: unequal capacity weights, initial/final stored energy, different initial SOC/capacities, signed/zero/precise terminal prices, adjusted value, inclusive positive/negative tolerance boundaries, custom/zero-tolerance targets, empty portfolios, invalid assumptions, original A/B behavior and unique timestamps, efficiency/loss consistency, no settlement/payout/dispatch changes, deterministic replay, frozen-input/main-state isolation, and two-decimal/negative-zero formatting.
- Scoped `npx eslint app/vpp-demo lib/vpp tests/vpp`: passed with no warnings or errors.
- `npm run build -- --webpack`: passed, including TypeScript checks and all corporate/VPP routes. The local build fetched the project's existing Google Fonts with permission; no hosting or deployment action ran.
- Full project lint: unchanged corporate `app/page.tsx` issues: six `no-explicit-any` errors at lines 216, 217, 263, 264, 265 and 332; unescaped apostrophe error at 2729; existing `<img>` warning at 2517. No corporate fixes attempted.
- Existing Node `MODULE_TYPELESS_PACKAGE_JSON` warnings remain; no module-system/dependency changes.

Local production browser checks (port 3003):

- Default A/B comparison reproduced every operating value and the terminal table above, including A PASS and B FAIL/non-comparable. Both custom-strategy Run workflows also reproduced net $2,085.51 / $3,110.07 and the corresponding statuses.
- Reference price 200 produced adjusted values $2,341.04 / $1,547.83; zero price produced zero adjustments and adjusted values equal to original operating net. With custom target 60% and tolerance 2, A failed and B passed. No dispatch or cash values changed.
- All six presets completed with common 100 USD/MWh / initial 68% target assumptions. No ranking was introduced.
- Reset scenarios restored reference 100, tolerance 2 and initial-target basis and cleared results. Price 123.456 retained its exact value across a preset switch while showing the rounded value at rest. Blank terminal assumptions produced an explicit error.
- Executed one real main-demo market charge, captured Dashboard and Settlement main text, compared scenarios under a changed terminal mark, and revisited both pages: both were byte-for-byte unchanged, including clock/SOC/settlement results.
- Mobile check: document/content widths both 375 CSS pixels; single-result table viewport/content widths both 342 pixels. No document/table overflow for a single result and no decimals beyond two places in main text. Multi-result tables remain contained horizontal scrolling regions. Operations/menu/logo return navigation worked. Compact desktop/tablet navigation and custom runs also passed.
- Existing logo/branding preserved. Corporate homepage heading and enabled Submit Inquiry control verified without submitting the form or sending email. Browser error log was empty.
- Screenshots saved outside the repository in the task visualization folder: `vpp-phase6-1-reference.jpg` and `vpp-phase6-1-mobile.jpg`; both visually inspected.

Git comparison confirmed corporate homepage/contact API, root layout/global CSS, existing logo and package lock are unchanged. All work remains local; no dependencies, commits, remote changes, PRs or deployments.

## Limitations and deferred constrained dispatch

The terminal constraint is a **post-run feasibility/comparability assessment**, not a scheduling constraint enforced during dispatch. Terminal-SOC-aware dispatch is deferred: a credible implementation needs a separately reviewed policy for remaining-horizon reachability, availability, fleet allocation, reserves, target bands and forward-looking price assumptions. This phase makes no prediction or forced recovery charge and introduces no new optimizer. If a strategy misses the band, the actual SOC/deviation and non-comparable status remain visible.

The linear reference-price mark is a simplified battery-inventory assumption. It excludes future export efficiency, fees, future price risk, equipment costs, terminal trading feasibility and guaranteed liquidation. A positive inventory mark is not an available owner/platform payout. Scenario cash remains the existing signed settlement net, with deficits tracked separately from positive owner/platform allocations. Capacity/price scenario differences still need contextual interpretation even when SOC passes.

Other Phase 6 limitations persist: in-memory results, snapshot-dependent output, no persistence across navigation/reload, deterministic greedy dispatch rather than optimization, and brief synchronous browser computation for full comparisons.

## Local acceptance steps

1. In `C:\business\website\drivegrid`, run `npm run dev` and open `http://localhost:3000/vpp-demo/scenarios`. For production verification, use `npm run build -- --webpack`, then `npm run start`.
2. Reset demo for the original fixture portfolio. Confirm terminal defaults: reference 100 USD/MWh, initial-weighted-SOC basis (68%), tolerance 2 percentage points.
3. Click **Compare Strategy A / B**. Confirm the table above: original earnings reproduce; stored energy gains/depletion differ; A passes and B is labelled FAIL/non-comparable in both header and constraint row. Both still show their actual cash and adjusted values; neither is silently normalized or ranked.
4. Set reference price to 200, compare A/B again: adjusted values change to $2,341.04 / $1,547.83. Gross, net, owner/platform payouts, physical activity and terminal constraint results must not change. Set price to zero: adjustment must be $0.00 and adjusted value equal operating net.
5. Choose custom target 60% with tolerance 2, compare A/B: A fails and B passes; cash/energy remain unchanged. Return to initial target/2-point tolerance. Zero tolerance, out-of-range/blank controls and exact editable decimals should behave explicitly.
6. Run a custom strategy with 50/300, then 10/100. Their results should match the corresponding A/B reference under the same snapshot/settings. Compare all six presets and verify every result uses the common captured terminal assumptions.
7. In Market, execute one existing simulated recommendation. Note the main clock, Dashboard SOC and Settlement results. Run/compare scenarios with alternative terminal prices/targets, then revisit main pages: clock, assets, history, commercial settings and settlement must remain unchanged.
8. Verify Reset scenarios restores terminal defaults and clears results; switching scenario presets retains common terminal settings. Verify two-decimal units/signs, DriveGrid branding and narrow mobile table scrolling/headers/status visibility. No contact form submission is needed.
9. Run `npm run test:vpp`, `npx eslint app/vpp-demo lib/vpp tests/vpp`, and `npm run build -- --webpack` locally.

Stop for Phase 6.1 Product Owner acceptance. No Phase 7 work or remote submission/deployment is authorized.
