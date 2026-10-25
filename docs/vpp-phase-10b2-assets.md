# Phase 10B-2 — Premium Asset Fleet

Status: implemented locally; pending Product Owner visual acceptance. No Phase 10B-3 work, commits, pushes, pull requests or deployments.

## Design summary

The Assets page now presents a substantial three-category equipment overview, a rated-power composition bar, a refined registry and an illustrated asset detail/editor. Navy surfaces, restrained lighting, category accents and reused accepted industrial SVG illustrations connect it to the Dashboard/Dispatch design system.

Before, the page led directly from four totals into a plain registry and editor. After, EV/V2G, residential BESS and commercial BESS each have an equipment panel with existing counts, capacity and weighted SOC. The table retains its efficient structure, with category glyphs, status dots, compact SOC batteries, hover/selection styling and clearer View controls. Details use equipment-specific art and a saved-state SOC gauge above the original fields.

## Files

Modified:

- `app/vpp-demo/assets/page.tsx` — presentation markup; original control logic preserved.
- `app/vpp-demo/dispatch/DispatchScene.tsx` — minor renderer extraction for the newly mandated architecture; accepted appearance unchanged.
- `AGENTS.md` — permanent VPP renderer separation and fallback contract.

Created:

- `app/vpp-demo/assets/FleetOverview.tsx` — memoized overview, lightweight category glyphs and reusable SOC gauges.
- `app/vpp-demo/assets/fleet.module.css` — Assets-only visual styling and responsive rules.
- `app/vpp-demo/dispatch/DispatchSceneSvg.tsx` — typed presentation-only SVG renderer with original markup.
- `docs/vpp-visualization-architecture.md` — permanent architecture contract and future GLB integration points.
- This report and actual browser screenshots listed below.

No dependencies were added. Shared `assets.module.css`, accepted equipment SVGs, Dashboard files and Dispatch styles were not changed. Existing package/TypeScript working-tree changes predate this phase.

## Existing data bindings

`FleetOverview` groups current assets by existing type and reuses the existing `portfolioMetrics` selector for every category. No independent fleet model, availability rule, SOC formula or other business calculation was introduced.

| Category on reset | Registered | Discharge-available | Rated power | Energy capacity | Weighted SOC |
| --- | --- | --- | --- | --- | --- |
| EV / V2G | 1,000 | 900 | 7 MW | 75 MWh | 68% |
| Residential BESS | 100 | 80 | 1 MW | 2.7 MWh | 68% |
| Commercial BESS | 50 | 40 | 12 MW | 40 MWh | 68% |

Available counts reuse the domain selector's existing Available status count, which follows dispatch eligibility. They are explicitly **discharge-available**, not online counts or raw availability flags. Category SOC reuses energy-capacity weighting across all assets of that type. The composition segments represent existing rated MW, not asset counts. Overview data represent the complete registered fleet, independently of registry filters, as labeled.

Top totals remain 1,150 assets, 20 MW rated power, 12 MW available dispatch and 117.7 MWh energy capacity. Row/detail SOC use the existing asset value and `formatNumber`; the input retains its existing exact-value behavior. The detail gauge shows saved state, not an unsaved edit or interpolated telemetry.

Search, type/status/availability filtering, clear filters, 20-row pagination, selection, validation, save actions and reset semantics remain unchanged. Original registry ordering is preserved; this page did not have a sorting control and none was added. No editable fields were added.

## 3D-ready architecture audit

See [the permanent visualization architecture](vpp-visualization-architecture.md).

- Dashboard was already compliant: typed `ResourceView[]` separates its state adapter from `NetworkScene2D`. No Dashboard edits were necessary.
- Dispatch's existing SVG markup moved into `DispatchSceneSvg`, accepting a typed `RecordedFlowView` with mode, active state and replay key. The wrapper still owns the original record mapping, SOC/labels and replay interaction. No business calculations or accepted styles changed.
- Assets keeps domain selector calls in its overview adapter and passes only equipment kind into the existing `EquipmentGraphic` renderer. Equipment, numeric captions and editing behavior remain separate.

Future GLB models may replace only those renderer boundaries; preserve parent dimensions, text alternatives, labels and responsive behavior. Recommended future model paths and fallback requirements are documented, but no 3D dependencies, model files or empty placeholders were created. SVG remains the default and future fallback for unsupported devices, constrained performance or loading errors.

## Regression and build verification

| Check | Result |
| --- | --- |
| Full VPP suite, `npm run test:vpp` | 135 passed, 0 failed |
| VPP lint, `node node_modules/eslint/bin/eslint.js app/vpp-demo lib/vpp tests/vpp` | Passed |
| Standalone `npx tsc --noEmit`, after build | Passed |
| `npm run build -- --webpack` | Passed; all 14 pages generated |
| `git diff --check` | Passed; existing Windows line-ending notices only |
| Corporate/root protected-file diff | Unchanged |
| Browser console | No errors observed |

Hash comparison of all 70 pre-existing VPP source/domain/test files found only Assets `page.tsx` and Dispatch `DispatchScene.tsx` changed. Domain logic, fixtures, reducer, tests, Dashboard and the rest of Dispatch are unchanged. Direct source comparison confirmed the Assets component's entire state/selection/filter/pagination/validation/save logic before its JSX return is byte-identical to the baseline. No existing tests were changed.

The existing Node module-type warning remains. The local preview/build used approved outside-sandbox execution because earlier sandbox runs could block localhost/build output. No configuration was changed to work around this. Existing unrelated corporate lint debt was not modified; scoped VPP lint passes.

### Browser functional checks

- Baseline totals and first page match. Next page still starts with EV 0021; page size remains 20 and total page count 58.
- Search by commercial asset ID returns the same single asset with correct 240 kW rated, 145 kW available, 800 kWh capacity, SOC and limits.
- Residential type filter gives 100 matches; combined unavailable filter gives 20 standby assets; adding offline gives the existing empty-state message. Clear filters restores the registry.
- View selects the correct equipment, ratings and edit fields and focuses the detail heading. A selected asset outside current filters remains supported.
- SOC 10% is rejected with the original custom validation message, “Value is outside the permitted range.” Saved SOC stays unchanged.
- Saving EV 0001 at 61.23456%, unavailable and standby updates its displayed SOC to 61.23%, available dispatch to 0 kW and the category count to 899. Exact input precision is retained by the unchanged input/save implementation. Category weighted SOC displays 67.99% through the existing selector.
- Reset restores original SOC/status/availability, counts and metrics. No real device commands or emails were sent.
- Refactored Dispatch still accepts fleet Discharge/Charge at 1 MW, shows signed energy +0.25/-0.25 MWh, SOC 67.78%/67.98%, correct direction and recorded labels. Idle is 0 MW with no directional transfer and replay disabled. Reset is preserved.
- All nine VPP navigation destinations load expected headings. Mobile navigation opens/closes; registry scroll region can receive keyboard focus; View focuses the selected heading.

### Accepted visual preservation

Dashboard and Dispatch reset-state screenshots at the same 1920×1080 viewport are **byte-for-byte identical** before/after the architecture refactor:

- Dashboard PNG SHA256: `63472D579EAD29A9E963CAC538C45CD4F7EBA38BB814FD14EE4662D54FCDB00C`
- Dispatch PNG SHA256: `EE5255139823F82CE2820BD1DC5E012D054D8069204BA743D499C3B2ED08E486`

This establishes equality for the captured reset states, not every possible state. Charge/Discharge/Idle behavior was separately checked as above. Both accepted pages were also checked at mobile width with no document overflow.

## Responsive, accessibility and performance

Actual browser viewport checks at 1920×1080, 1280×900, 768×1024 and 390×844 show no page-level horizontal overflow. Categories use three panels on wide screens, horizontal equipment/data panels on tablet/narrow content widths, and stacked panels on mobile. Tables preserve horizontal scrolling rather than losing columns. The mobile detail editor retains labeled, full-width controls. Desktop, tablet, mobile and overview images were visually inspected.

Only 20 registry rows are rendered, with small static glyphs and SOC bars; there are three aggregate category illustrations, not 1,150 individual animated assets. Category selectors are memoized by the existing asset array reference, so searching/filtering does not rebuild the category overview. Equipment uses the unchanged memoized renderer.

Category hover feedback, gauge-width transitions and status feedback are finite CSS effects. They reflect saved existing values; there are no generated events or continuous telemetry effects. Numeric SOC labels update directly without invented intermediate readings. Reduced motion disables animations/transitions and hover translation. Icons accompanying text are decorative; equipment SVGs retain accessible titles, controls retain labels and scoped keyboard focus outlines are provided.

## Actual screenshot evidence

- [Previous Assets design](vpp-phase-10b2-before.png)
- [Desktop Assets](vpp-phase-10b2-desktop.png)
- [Asset category overview](vpp-phase-10b2-overview.png)
- [Commercial BESS details/editor](vpp-phase-10b2-detail.png)
- [Laptop Assets](vpp-phase-10b2-laptop.png)
- [Tablet Assets](vpp-phase-10b2-tablet.png)
- [Mobile Assets](vpp-phase-10b2-mobile.png)
- [Mobile residential details/editor](vpp-phase-10b2-mobile-detail.png)
- Dashboard audit: [before](vpp-phase-10b2-dashboard-before.png), [after](vpp-phase-10b2-dashboard-after.png)
- Dispatch audit: [before](vpp-phase-10b2-dispatch-before.png), [after](vpp-phase-10b2-dispatch-after.png)

These are actual local production-browser screenshots, not mockups.

## Limitations

Equipment remains schematic SVG, not physical/geographical digital twins. All data are synthetic and in-memory. Large tables intentionally scroll on small screens, and the full mobile page is long because the original 20-row pagination is preserved. Tests/browser checks provide regression evidence but do not prove every possible user sequence. Native OS reduced-motion switching, physical-device and cross-browser testing remain manual acceptance items; CSS suppression was inspected. No production-security claim or performance benchmark is made.

No file upload/download/export/printing/browser-file-access, persistent storage or external-service features were introduced. A source audit found no VPP FileReader, picker, object-URL download, print or download-link patterns.

## Product Owner visual acceptance

1. Run `npm run dev` locally and visit `/vpp-demo/assets` at the displayed localhost address. For production review, run `npm run build -- --webpack`, then `npm run start`.
2. Compare the previous design with the new equipment panels, composition bar, row gauges and selected-asset detail. Confirm the existing numbers/units are clear and the fleet-versus-filter scope is labeled.
3. Review desktop, laptop, tablet and mobile; check category labels, filter usability, table scrolling, keyboard focus and editor controls.
4. Spot-check selection, saved-state SOC feedback and reset. Detailed functional regression checks have already been performed above.
5. Enable OS reduced motion and confirm a readable static presentation. Compare accepted Dashboard/Dispatch audit images and review the documented GLB boundaries.
6. Approve this phase or request visual revisions before Phase 10B-3.

All work remains local. Awaiting Product Owner approval.
