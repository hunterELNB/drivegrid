# Phase 8 — Browser-only Analytics & Reporting (revised)

Status: implemented locally; awaiting Product Owner acceptance. This revision supersedes the original Phase 8 CSV/print requirements. No Phase 9, remote changes or deployment.

## Implementation and removed features

The `/vpp-demo/analytics` route retains financial cards, revenue/cost breakdowns, financial/energy/power charts, dispatch outcomes, asset type comparisons, searchable/sortable/paginated asset contributions, current operational monitoring and recent actual events. All analysis is visible directly on the webpage, using the existing DriveGrid shell, logo, navy CSS Modules and two-decimal display utilities.

Removed all five CSV dataset choices and downloads (financial summary, dispatch records, asset performance, alerts and events), CSV generation/escaping/filename code, Blob/object URL/link download handlers, export status messages, and four export-only tests. Removed the printable report view, report toggle, Print / Save as PDF button, `window.print()`, report component and all Phase 8 print/report styles. No alternative downloadable or document format was added.

The retained timestamp and financial-card display helpers moved to `presentation.ts`; their calculations and output are unchanged. Analytics aggregation, dispatch physics, SOC, market, settlement, operations and scenario calculations were not modified.

## Revision files

Modified:

- `app/vpp-demo/analytics/page.tsx`: remove file/print controls and handlers; always show interactive analytics.
- `app/vpp-demo/analytics/analytics.module.css`: remove export/report/print-only styles.
- `app/vpp-demo/_components/Shell.tsx`: remove Analytics print scope.
- `app/vpp-demo/demo.module.css`: remove Phase 8 shell print styles.
- `tests/vpp/analytics.test.mjs`: remove CSV-only cases, retain calculation/filter/isolation tests.
- `docs/vpp-phase-8.md`: revised design, checks and acceptance instructions.

Created:

- `app/vpp-demo/analytics/presentation.ts`: retained financial KPI and CT timestamp display helpers.
- `tests/vpp/browser-only.test.mjs`: regression guard scanning all VPP runtime TypeScript/TSX/CSS for file controls/APIs, printing, persistent browser storage, environment access and local filesystem path literals; verifies deleted export/report modules stay absent.

Deleted:

- `lib/vpp/analytics-csv.ts`.
- `app/vpp-demo/analytics/AnalyticsReport.tsx`.

Original Phase 8 foundation retained: `lib/vpp/analytics.ts`, `AnalyticsCharts.tsx`, Analytics navigation and its fixture assertion. No packages were added or updated. Corporate homepage, contact API, root layout, global CSS and lockfile remain untouched.

## Browser-only audit and state behavior

The entire `app/vpp-demo` and `lib/vpp` runtime source was audited. No user-facing upload/import/file input, file picker, FileReader, File System Access API, download link/handler, Blob export, print action or print-specific stylesheet remains. No localStorage, sessionStorage, IndexedDB, filesystem persistence, external database or backend data collection was introduced. The VPP runtime does not reference environment secrets or internal Windows paths. Regular application assets (logo, JavaScript and CSS) load normally; no user file access is required or permission requested.

State remains synthetic and in memory through the existing React Context/reducer. Navigation preserves main simulation state within the running demo; reload/full reset restores fixtures and clears recorded activity. Analytics only reads that state; filters, sorting and pagination are local view state. No authentication, cloud persistence or public deployment is included. Removing file features does not establish production security or replace a future deployment/security review. Browser-owned features such as the browser's own Print or Save commands are outside application controls; the application offers none.

## Data sources and financial reconciliation

Historical analysis uses actual shared `state.history` intervals and original asset records. Empty ranges produce zero summaries and explicit empty charts; skipped clock intervals are never invented. All 1,150 registered assets remain in the contribution table, with zero historical results where no records exist. Asset dispatch count counts actual rows, including recorded Idle/rejected rows.

Financial analytics calls the unchanged Phase 5 `settleHistory` with current commercial settings and accepted asset-level cent rounding. Asset/type contributions sum those exact ledger rows. Changing commercial assumptions revalues existing history as on Settlement.

In settled cents:

```
gross - QSE - transaction - degradation = net
net = owner allocation + DriveGrid allocation - unallocated deficit
allocation residual = 0
raw export value - raw import cost = raw fleet gross
settlement gross - raw fleet gross = asset-cent rounding bridge
```

Import cost is signed (negative prices may yield a credit); export value can also be negative. Raw energy values remain separate from settled cent amounts, with the rounding bridge visible. Deficit is separate from positive allocations, not deducted twice. Scenario terminal-energy valuations are excluded from realized settlement. No real payments occur. USD display values use two decimals; other display values use at most two decimals with no negative zero.

## Energy methodology

```
import magnitude = sum(max(0, -AC energy))
export magnitude = sum(max(0, AC energy))
net grid energy = exports - imports
net grid energy + signed battery energy change + conversion losses = 0
energy acceptance = accepted AC energy magnitude / requested magnitude
```

Acceptance is N/A for zero requested energy. Interval outcomes determine accepted/curtailed/rejected counts; Idle contributes a count with zero energy. Losses are those already recorded by the accepted physics engine, counted once. Fleet energy units are MWh and power MW. Charts use actual timestamped points and identify lines as connecting recorded samples, without filling skipped intervals.

## Time and asset filters

- All recorded intervals includes stored main history.
- Simulation day is the bounded fixture day, 23 October 2026, 00:00 through next midnight CT.
- Last four simulated hours uses `[max(0, current step - 16), current step)`.
- Custom ranges use quarter-hour boundaries within the 96-interval day. Invalid/reversed ranges show an error and retain the previous valid filter.
- Interval starts use inclusive start and exclusive end. Financial, energy, dispatch and historical asset results use the same filtered records. Active scope and included counts remain visible.
- Asset ID search, type filter and sorting narrow only the table and matching subtotal. Headline results remain fleet-wide for the time range. Pagination is 20 rows.
- SOC/connectivity/health/discharge availability and operational KPIs are CURRENT snapshots independent of historical filters. There is no historical telemetry series, so no historical uptime is claimed.
- Recent operational events filter by their own timestamps. Alert episode creation counts use creation timestamps while alert status KPIs are current. Events exactly at a bounded range end are excluded even if they describe an interval beginning inside it.

## Verification

- Full VPP tests: **127/127 passed**: 115 prior-phase tests, 11 retained analytics tests and one browser-only runtime-source regression guard. Four CSV-only tests were removed.
- VPP lint: passed, `node node_modules/eslint/bin/eslint.js app/vpp-demo lib/vpp tests/vpp`.
- TypeScript: passed, `npx tsc --noEmit`.
- Webpack build and browser results: see final verification entry below.
- Tests retain exact financial/asset/type cent reconciliation, sign conventions, energy conservation, acceptance/outcomes/Idle, actual asset attribution, time boundaries/gaps, empty ranges, current monitoring consistency, deterministic sorting, frozen-state read-only behavior, scenario isolation and formatting coverage.
- Source audit found no remaining user-facing VPP file/print operations or browser persistence. The source regression guard is a prevention check, not a comprehensive security audit.
- Existing unrelated full-project lint findings remain in corporate `app/page.tsx`: six `no-explicit-any` errors (216, 217, 263, 264, 265, 332), unescaped apostrophe (2729), and `no-img-element` warning (2517). Corporate files were not changed to suppress them.

## Remaining limitations

The simulation is transient, synthetic and local, with no persisted session/report or historical uptime samples. Headline MWh formatting rounds tiny EV quantities at two decimals; accepted internal precision/calculations are preserved. Current snapshots are labelled separately from historical contributions. Analytics stays live against shared state, so pause the clock for repeatable comparisons. Public hosting and production security are not implemented or certified by this revision.

## Product Owner acceptance

1. Run `npm run dev -- --webpack` locally and open `http://localhost:3000/vpp-demo/analytics`. For production verification run `npm run build -- --webpack`, then `npm run start`.
2. Reset demo. Confirm zero historical cash/energy, explicit empty charts and seeded current monitoring. Confirm no CSV menu, export/download/upload/import/file selection, report toggle, print or PDF buttons anywhere in VPP navigation/pages.
3. In Dispatch, execute a confirmed Entire fleet, Discharge, 1 MW request at step 0. Return to Analytics. Expect 0.25 MWh exports, $7.51 settled gross, $7.50 raw export value, $0.01 rounding bridge, $1.65 net, $1.17 owner and $0.48 DriveGrid. Compare Settlement and the actual dispatch row.
4. Exercise positive/negative price charge and discharge using existing controls. Check signed import cost/export value, allocations, deficits, rounding bridge and energy conservation against existing pages.
5. Apply All, simulation day, last four hours and custom quarter-hour ranges. Check a boundary, an empty 01:00–02:00 range after the single step-0 execution, and a reversed range. Historical totals/counts must agree across cards/charts/tables; current monitoring stays current.
6. Search `commercial-bess-0001`, filter asset type, sort net/gross/energy/count/SOC, switch direction and paginate. Search clears to the fleet; headline totals do not change with table-only filters. All analysis remains on screen.
7. Compare current SOC/availability/connectivity with Assets/Operations. Record clock, SOC, history and settlement before using Analytics controls; revisit and confirm no main state change. Run isolated Scenarios/A-B comparison and confirm main Analytics is unchanged.
8. Check desktop/mobile navigation, cards, chart labels and contained table scrolling. Verify all time/search/sort/pagination controls remain usable without any file permission prompt or file operation. Reload confirms the original in-memory reset behavior.
9. Run `npm run test:vpp`, `npx eslint app/vpp-demo lib/vpp tests/vpp`, `npx tsc --noEmit` and `npm run build -- --webpack`.

Stop for Product Owner acceptance. No commits, pushes, pull requests, deployment or Phase 9 work.

## Final revision verification

Webpack production build passed, including the static Analytics route. The local production server was used for browser checks and stopped afterward. Desktop and mobile screenshots were visually inspected (`vpp-phase-8-browser-only-desktop.png` and `vpp-phase-8-browser-only-mobile.png` in this directory).

All nine VPP routes were visited through existing navigation. Each had zero file inputs, zero download links, and no CSV/PDF/print/upload/download/report-view controls. No file permission prompt occurred. Desktop checks confirmed the reference $7.51/$1.65 financial results, Page 2 of 58 pagination, exact asset search, gross sorting and a custom empty time range. Returning to All and navigating all routes retained the same main simulation values. Mobile checks at 390 x 844 confirmed contained layout (document client width and scroll width both 375 px), type filtering with Page 2 of 3, last-four-hours totals and mobile navigation open/close. Calculation, scenario isolation and main-state integrity are additionally covered by the passing automated suite. Protected corporate file diff and `git diff --check` passed.
