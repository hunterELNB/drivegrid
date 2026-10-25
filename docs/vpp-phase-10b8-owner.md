# Phase 10B-8 — My Energy / Owner Portal

Status: local implementation complete; pending Product Owner visual acceptance. No later-phase, Blender, 3D integration, commit, push, pull request or deployment work.

## Scope and supported owner associations

The accepted portal has **EV-only asset selection**, not customer accounts or residential/commercial owner mappings. This phase preserves that behavior: 1,000 existing simulated EVs, the original first-100 search matches, selected-option fallback and per-EV settlement attribution. No identities, ownership records or BESS associations were invented.

Consequently, residential and commercial BESS **owner views/screenshots are unsupported by the frozen baseline**. They were not fabricated or substituted with unrelated fleet data. The existing equipment renderer supports those kinds, and the typed boundary can accept them if real associations are separately authorized in a future functional phase.

## Before and after

Before: an EV selector, a text-only SOC/rating strip, eight uniform participation figures and a wide earnings ledger. After: a customer-facing My Energy header with selected-asset context and the same allocation visible immediately, an illustrated asset card with a readable battery gauge, a prominent owner-allocation overview, a concise financial breakdown and recorded activity cards above the unchanged ledger.

Mobile places the financial panel before the asset illustration, retains large touch targets and keeps wide tables locally scrollable. Navy surfaces, soft gradients, restrained cyan/blue/teal and plain-language explanations preserve DriveGrid branding without copying the operator command-center layout.

All eight original metrics remain visible. No projected earnings, payment schedule, extra customer account feature or invented telemetry was introduced.

## Files

Modified:

- `app/vpp-demo/owner/page.tsx`: presentation composition, header, equipment/results/activity components; switches from Settlement CSS to a dedicated Owner CSS Module. All existing state, filters, selected-asset association, aggregation and pagination derivations before the JSX return are textually unchanged.
- `docs/vpp-visualization-architecture.md`: Owner Portal integration boundary.

Created:

- `app/vpp-demo/owner/owner.module.css`: isolated customer-facing styles, responsive ordering, readable controls, focus and reduced-motion rules.
- `app/vpp-demo/owner/presentation.ts`: typed read-only projection of existing asset fields; no association or eligibility calculation.
- `app/vpp-demo/owner/OwnerAssetCard.tsx`: selected asset, SOC meter, exact existing status/availability fields, equipment rating/capacity and existing current synthetic price.
- `app/vpp-demo/owner/OwnerParticipation.tsx`: original metric presentation, direct existing net/platform outputs and the latest five real records on the current history page.
- `tests/vpp/owner-presentation.test.mjs`: eight presentation/regression tests using the actual page/components and accepted settlement engine.
- This report and actual browser screenshots listed below.

No dependencies were added. Accepted Settlement styles and all other accepted pages were not modified.

## Data mappings and economic clarity

| Presentation | Accepted source |
| --- | --- |
| Selected asset and search | Original `evs`, `selectedId`, `matches` and the first-100/fallback logic |
| Name, ID, location, SOC, status, availability, capacity/rating | Existing selected `DERAsset`; SVG illustration is representative equipment, not a count of owned vehicles or live telemetry |
| SOC meter | Existing `asset.socPct`; formatted visible/accessible text, no SOC model or animation |
| Current synthetic market price | Unchanged `marketPriceAt(state.step)`, including the original end-of-day Scenario complete state |
| Owner allocation | Existing `aggregateSettlement(rows).ownerCents`, displayed using the original formatted card value; header repeats the same authoritative amount |
| Gross, combined fees, degradation and deficit | Original `cards` mapping, with unchanged labels/values |
| Signed net and DriveGrid allocation | Existing `totals.netCents` and `totals.platformCents`, not recalculated financial policy |
| Allocation bar | Actual rounded owner/platform cents; no forced 70/30 aggregate ratio and no split of gross |
| Imported/exported energy and participation count | Original per-EV row reductions and nonzero-energy count |
| Period | First/last existing per-EV record starts; no inferred billing period |
| Activity | At most five existing rows from the same reversed/paginated history shown in the original table; no gap filling |

Owner allocation is described as the existing share of **each positive asset-interval net after costs and cent rounding**, not a share of gross or of aggregate signed net. Unallocated deficits remain visible and do not reduce other positive owner allocations. Zero/negative records never generate hypothetical owner payouts. All figures are synthetic allocations, not paid income or amounts payable.

The availability/status labels are explicitly the existing core asset fields, not a new assertion of dispatch eligibility. Independent restrictions remain owned by the accepted domain/operations logic.

## Numerical regression

Before/after browser evidence uses EV `ev-v2g-0001` at the same fixed timestamps: 6 kW discharge at step 0, 6 kW charge at step 1, Idle at step 2, then time-only steps to 74 and 6 kW discharge at the scarcity interval. No intermediate dispatch records are invented.

| Original metric | Before | After |
| --- | ---: | ---: |
| Participating energy intervals | 3 | 3 |
| Grid energy exported | 3 kWh | 3 kWh |
| Grid energy imported | 1.5 kWh | 1.5 kWh |
| Attributed gross energy value | $3.75 | $3.75 |
| QSE + transaction fees | $0.19 | $0.19 |
| Battery degradation cost | $0.09 | $0.09 |
| Illustrative owner earnings | $2.48 | $2.48 |
| Unallocated operating deficit | $0.08 | $0.08 |

The same engine totals include signed net $3.47 and DriveGrid allocation $1.07. Existing SOC is 65.69% at display precision. All original cells of the four-record earnings table matched exactly in the browser before/after, including times, prices, power, energy and every financial column. Source-state and ledger immutability are also asserted in automated rendering tests.

Tests additionally cover a single charge with negative gross/net, Idle with no grid transfer, no records, unavailable status, reset, exact SOC projection and the two-cent positive-net example whose actual rounded owner/platform allocations are $0.01/$0.01. That example correctly does not draw an invented aggregate 70/30 ratio.

## Formatting and architecture

All USD amounts use the existing `formatUSD()` directly or the unchanged original card strings created with it. Negative zero is normalized only for presentation. Existing SOC, kW, kWh and price-per-energy conventions remain separate; calculations and comparisons retain full precision.

`ownerAssetView` copies fields without calculating physics, eligibility or ownership. `OwnerEquipmentView({kind})` wraps the existing pure `EquipmentGraphic` inside a responsive 305:245 container. A future approved GLB renderer can replace that invocation while preserving the SVG fallback, dimensions, external gauge, status labels, selected asset and interactions. No model, 3D dependency, empty placeholder or speculative owner feature was created.

Rendering adds no timer or continuous animation. Reduced-motion rules disable presentation animation/transition. Keyboard focus, meter value text, semantic labels, timestamps and text status labels avoid reliance on color alone.

## Verification

- Baseline: 158 VPP tests passed; scoped lint passed. Accepted production build supplied the before screenshot.
- Final full suite: **166 tests passed, 0 failed**. Eight new tests verify EV mapping/selection options, exact read-only asset projection, accessible SOC and units, known settlement cents/immutability, negative/zero states, actual rounded allocation, real activity rows and reset data.
- VPP lint, standalone TypeScript validation and Webpack production build passed; all 14 pages generated. Existing Node `MODULE_TYPELESS_PACKAGE_JSON` warning remains; package configuration was not changed.
- Browser checks verified original financial/table values, search/selection, case-insensitive ID lookup, fallback when searching elsewhere/no matches, zero results for another EV, unavailable/offline EV status and end-of-day price labeling.
- Pagination was exercised with 25 real records: 20 rows on page 1 and 5 on page 2, with the expected 18:45 CT first record on page 2. Switching selected asset returns to page 1 as before.
- The original global reset behavior is preserved: while Owner Portal remains mounted, selected EV and search text remain selected; underlying SOC, history and earnings reset. This is not changed to a new selection-reset policy.
- Responsive checks: 1920×1080, 1280×900, 768×1024 and 390×844, without page-level horizontal overflow. Mobile keeps all 12 ledger columns via local keyboard scrolling, a working navigation menu, readable SOC and financial priority. Selection inputs and pagination buttons have 44–48 px minimum targets.
- Final browser audit: all nine application routes passed; no console errors were captured. All 40 visible USD amounts had exactly two decimal places, with no scientific notation. The final mobile header shows the same $2.48 allocation before the asset-selection controls. Final screenshots use the last successful production build.

Hash comparison covers 92 pre-existing VPP source/test files. Only the Owner page changed among those existing files; new components/styles/tests are listed above. Engines, fixtures, shared state and all accepted pages remain byte-identical. Corporate homepage/contact API/global styles/root layout/package lock have no changes.

## Actual browser screenshots

- [Before](vpp-phase-10b8-before.png)
- [Desktop Owner Portal](vpp-phase-10b8-desktop.png)
- [Combined asset and owner-allocation overview](vpp-phase-10b8-overview.png)
- [Laptop](vpp-phase-10b8-laptop.png)
- [Tablet](vpp-phase-10b8-tablet.png)
- [Mobile Owner Portal](vpp-phase-10b8-mobile.png)
- [Mobile top viewport](vpp-phase-10b8-mobile-top.png)
- [EV/V2G asset view](vpp-phase-10b8-ev.png)
- [Owner earnings overview](vpp-phase-10b8-earnings.png)
- [Recorded participation](vpp-phase-10b8-participation.png)
- [Empty history](vpp-phase-10b8-empty.png)
- [Zero allocation](vpp-phase-10b8-zero.png)
- [Negative net / zero owner allocation](vpp-phase-10b8-negative.png)

Residential/commercial owner screenshots are intentionally absent because the accepted portal has no such associations. All listed evidence is actual local browser output, not generated mockups or fabricated ownership data.

The temporary localhost production preview was stopped after verification. Screenshot files are development evidence; no user-facing file operation was added.

## Limitations and Product Owner acceptance

The portal remains a synthetic EV participation viewer, not an authenticated account or ownership-management system. Wide ledger tables scroll on smaller screens; the activity summary covers the latest five records on the current page and the full existing ledger remains available. Physical-device/cross-browser testing and OS reduced-motion switching remain manual acceptance items. No production-security claim, payment capability or new market/device integration is implied.

1. Run `npm run dev` locally and visit `/vpp-demo/owner`. For production review, use `npm run build -- --webpack`, then `npm run start`.
2. Review My Energy, selected asset context, representative illustration, SOC/status and financial hierarchy on desktop/mobile.
3. Search/select EVs including IDs outside the first 100; verify association, selected fallback and empty history.
4. Reproduce the four-record baseline above; match all metrics, full ledger rows and recorded activity. Confirm signed net, deficit and owner allocation retain their distinct meanings.
5. Review a charge-only negative case, Idle and reset. Confirm no payout is invented and selection/search follow the original reset behavior.
6. Verify pagination, navigation, meter accessibility, keyboard/local scrolling and two-decimal USD. Confirm no uploads/downloads/printing/persistence exist.
7. Accept this phase or request revisions. Broader owner mappings, Blender/3D or any subsequent phase require separate authorization.
