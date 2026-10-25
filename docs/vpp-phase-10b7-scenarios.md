# Phase 10B-7 — Strategy Intelligence

Status: local implementation complete; pending Product Owner visual acceptance. No Phase 10B-8 work, commits, pushes, pull requests or deployment.

## Visual upgrade

Scenarios now presents a dedicated Strategy Intelligence header, six substantial selectable strategy cards, a threshold-rule diagram, a structured custom configuration panel, a three-part economic overview, grouped economic/energy comparisons, terminal SOC bars and exact discrete day timelines. The original preset dropdown, every parameter, all actions, comparison rows, explanations and interval details remain available.

Before: a dropdown-led configuration form, a comparison table and small price curves. After: a strategy-selection hierarchy, explicit economic meanings, graphical comparisons and discrete price/command/energy timelines alongside the original numerical evidence. Dark navy, restrained cyan/blue/teal and negative-value accents follow the accepted identity without reusing the Dashboard layout.

No strategy definition, market data, physics, optimization, financial formula or shared simulation behavior changed. No dependencies were added.

## Files and component boundaries

Modified:

- `app/vpp-demo/scenarios/page.tsx`: header, strategy cards, new result/comparison/timeline presentation. Preset selection reuses the original state updates. Execution/validation handlers and all original comparison-row definitions are textually unchanged.
- `app/vpp-demo/scenarios/scenarios.module.css`: route-local responsive styling, focus states, technical chart surfaces and reduced-motion rules.
- `docs/vpp-visualization-architecture.md`: Scenarios adapter/renderer contract.

Created:

- `app/vpp-demo/scenarios/presentation.ts`: typed read-only strategy/result/chart inputs, direct comparison mapping, clock labels and pixel-scale geometry.
- `app/vpp-demo/scenarios/StrategySelection.tsx`: six preset buttons and the applied threshold-rule diagram.
- `app/vpp-demo/scenarios/ScenarioIntelligence.tsx`: selected-result economic overview and captured-result comparisons.
- `app/vpp-demo/scenarios/ComparisonBarsSvg.tsx`: pure grouped-bar renderer.
- `app/vpp-demo/scenarios/ScenarioTimeline.tsx`: presentation-only interval selection and exact text readouts.
- `app/vpp-demo/scenarios/ScenarioTimelineSvg.tsx`: pure discrete price, command and signed-energy renderer.
- `tests/vpp/scenarios-presentation.test.mjs`: eight presentation/regression tests.
- This report and actual local browser screenshots listed below.

SVG renderers do not import simulation state, reducers or business algorithms. `comparisonViews` selects existing outputs; `comparisonScale` positions pixels only. Local result/interval selection never executes scenarios or changes the main clock. Analytical charts remain 2D. No equipment illustration, GLB dependency, model file or speculative placeholder was needed; the permanent SVG/default/fallback architecture remains intact.

## Authoritative data mappings

| Presentation | Existing source / meaning |
| --- | --- |
| Strategy cards | Unchanged `scenarioPresets` names, descriptions, thresholds, target MW, reserve and storage multiplier |
| Threshold-rule diagram | Selected preset / last applied `controls.config`; strict charge/discharge boundaries and Idle equality. It is explicitly categorical, not a quantitative price scale or historical distribution. Unsaved edits are applied on Run, preserving existing input behavior. |
| Simulated operating net | `result.totals.netCents / 100`, after existing QSE, transaction and degradation costs |
| Terminal energy adjustment | Exact existing `result.terminal.adjustmentUSD`; inventory mark only |
| SOC-adjusted economic value | Exact existing `result.terminal.adjustedEconomicValueUSD`; comparison metric, never owner/platform cash payout |
| Cost/gross/energy cards | Direct existing totals, import/export, net stored MWh and command counts |
| Comparison charts | Existing operating net versus adjusted comparison value; separate AC import/export magnitudes; original result order, no ranking |
| Final SOC bars | Existing terminal final SOC on 0–100% scale, with existing target marker and status |
| Timeline | Existing `ScenarioPoint[]`: timestamp, step, command, price, signed AC energy/power, weighted SOC and raw gross value |

Prices are held over the exact fifteen-minute boundaries. The 24-hour axis retains a partial run's unsimulated remainder as blank. Decisions are not smoothed; signed imports/exports remain below/above zero. Small energy ranges use kWh for readable axes without changing input values. Interval selectors, previous/next buttons and pointer inspection provide exact values, with the original expandable tables retained as alternatives.

## Economic clarity and numerical regression

The three economic figures are separately labeled, with operating net and inventory adjustment combined only by the existing engine's comparison metric. Cost categories are shown individually; no fee or terminal valuation is posted again. Failed terminal constraints remain explicitly non-comparable. Passing a constraint does not make different profiles, capacities or initial inventories equivalent. No best-strategy or profit ranking is invented.

Before implementation, complete output hashes were captured from the accepted engine for all six presets plus Strategy B, a negative one-interval case and a high-precision custom case. After implementation, all nine complete outputs matched exactly, including asset state, every interval, totals, terminal settings/valuation/status and floating-point diagnostic values. Eight new tests include persistent SHA256 baselines for the six full preset results.

| Preset | Operating net | Terminal adjustment | Adjusted comparison value | Final SOC |
| --- | ---: | ---: | ---: | ---: |
| Base Case | $2,085.51 | $127.76 | $2,213.27 | 69.09% |
| High Volatility | $3,731.47 | $88.62 | $3,820.09 | 68.75% |
| Low Volatility | $102.28 | $21.18 | $123.46 | 68.18% |
| High Storage Capacity | $2,085.48 | $127.76 | $2,213.24 | 68.54% |
| Conservative Dispatch | $538.25 | $43.65 | $581.90 | 68.37% |
| Aggressive Dispatch | $5,113.01 | -$43.55 | $5,069.46 | 67.63% |

These values are unchanged before/after. Under default initial SOC target ±2 percentage points, all six pass. Browser text comparison also confirmed every original six-scenario comparison-table cell remains identical.

Additional browser cases:

- Strategy B at 10/100: operating net $3,110.07, inventory adjustment -$781.12, comparison value $2,328.95, final SOC 61.36%; correctly FAIL/non-comparable under the unchanged 68% ±2 target.
- Negative example: Base Case, one interval, terminal reference price 0. Gross -$7.50, transaction $0.25, degradation $4.75, operating net -$12.50, terminal adjustment $0.00, comparison value -$12.50. This uses existing controls and engine outputs, not fabricated chart values.
- Custom thresholds 49.123456/301.234567, reference price 111.123456, target 67.123456 and tolerance 0.123456 preserve exact editable values. Resulting adjustment $141.97 and comparison value $2,227.48 match the full-precision baseline; terminal constraint correctly fails.

## USD formatting

All monetary amount cards, bar labels/axes/native titles, interval gross readouts, table rows and comparisons use the existing `formatUSD()`, including negative-zero normalization. Price-per-energy labels retain the existing dimensional formatter. Inputs retain the accepted full-precision focus/edit/save behavior and are not rounded before validation or calculations. Tests render actual components with positive, negative and tiny residual values, verifying $9.83/$0.00 and excluding scientific notation or negative zero.

## Verification

- Baseline: 150 VPP tests passed; scoped lint passed. Before screenshot captured from the accepted production build.
- Final full VPP suite: **158 passed, 0 failed**. New tests cover complete six-preset numerical baselines, immutable direct adapters, preset selected/disabled states, zero-inclusive signed geometry, rendered currency precision, negative economic labeling, exact 96-interval timeline inspection and partial-day blank behavior.
- Existing scenario/terminal tests continue to verify strict thresholds, SOC/dispatch constraints, conservation, settlement, terminal accounting, reset and isolation from live history/state.
- VPP lint, standalone TypeScript validation and Webpack production build passed. Build generated all 14 pages. Existing Node `MODULE_TYPELESS_PACKAGE_JSON` warning remains; no package configuration change was introduced.
- One final-build attempt encountered a Windows file-stat error during tracing after compilation/type checks; an isolated retry of the same build passed with exit code 0. No application or dependency change was used to bypass it.
- Browser verified six-preset comparison, keyboard preset selection and input defaults, invalid threshold error, precise custom settings, A/B comparison, negative results, captured-result selection, timeline keyboard inspection and all 96 expanded detail rows. Step 74 retains the $2,500/MWh scarcity fixture, discharge 1 MW / 250 kWh and $625.00 raw gross.
- Responsive checks covered 1920×1080, 1280×900, 768×1024 and 390×844. Client/scroll widths matched at each size; comparison tables/charts use local scrolling. Mobile retains six readable cards, all seven comparison columns, last-interval selection and a working menu. No browser console errors were captured.
- Final browser checks passed all nine application routes. Local reset restored Base Case, 1 MW, the 100 USD/MWh reference and initial-SOC target mode, clearing results; global reset restored Base Case/96 intervals and cleared results as well. The visible monetary audit found 76 amounts, all with exactly two decimals and no scientific notation. Final screenshots include the corrected mobile header line break and explicit upper/lower financial-series labels.

All accepted application pages and `lib/vpp` files are unchanged. Only Scenarios page/styles among the 85 pre-existing VPP source/test files changed; new presentation files/tests are listed above. Corporate homepage, contact API, global CSS, root layout and package lock remain unchanged. Earlier uncommitted work was preserved.

## Actual browser screenshots

- [Before upgrade](vpp-phase-10b7-before.png)
- [Desktop Scenarios](vpp-phase-10b7-desktop.png)
- [Laptop](vpp-phase-10b7-laptop.png)
- [Tablet](vpp-phase-10b7-tablet.png)
- [Mobile Scenarios](vpp-phase-10b7-mobile.png)
- [Mobile top viewport](vpp-phase-10b7-mobile-top.png)
- [Six predefined strategy cards](vpp-phase-10b7-strategies.png)
- [Custom strategy configuration](vpp-phase-10b7-configuration.png)
- [Economic result overview](vpp-phase-10b7-results.png)
- [Economic, energy and SOC comparison](vpp-phase-10b7-comparison.png)
- [Exact scenario timeline](vpp-phase-10b7-timeline.png)
- [A/B terminal constraint failure](vpp-phase-10b7-terminal-constraint.png)
- [Negative economic result](vpp-phase-10b7-negative.png)
- [Negative comparison bars](vpp-phase-10b7-negative-comparison.png)

All evidence is actual localhost browser output. No mockup imagery or invented simulation data was used.

The temporary localhost preview was stopped after verification. Screenshot files are development evidence only; no user-facing file operation was added to the application.

## Limitations and Product Owner acceptance

The full page is long when comparing six scenarios because original information and all six timelines are preserved. Wide charts/tables scroll on mobile; exact values remain available outside charts. The threshold band describes applied values, not unsaved edits. Physical-device/cross-browser behavior and OS reduced-motion switching remain manual acceptance items; scoped reduced-motion rules are present and no continuous animation was added. This phase adds no forecasting or optimization capability and makes no production-security claim.

1. Run `npm run dev` locally and open `/vpp-demo/scenarios`. For production review, use `npm run build -- --webpack`, then `npm run start`.
2. Select each card/dropdown and inspect unchanged defaults. Edit existing fields and verify validation and exact values on focus.
3. Compare all six scenarios and match the numerical baseline above. Inspect operating net, terminal adjustment, comparison value and constraint status separately.
4. Run A/B and the one-interval negative example. Confirm negative values remain visible and failed terminal constraints are not presented as fair-comparison passes.
5. Inspect full-day and partial timelines, keyboard interval selection and expanded details; confirm no invented events or main-clock movement.
6. Exercise local scenario reset, global reset, navigation, mobile menu and local table/chart scrolling. Confirm no file/print/storage controls exist.
7. Approve this phase or request revisions. Phase 10B-8 requires separate explicit approval.
