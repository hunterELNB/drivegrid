# Phase 9 — Public Demo Readiness

Status: local implementation completed; acceptance checks and remaining release gates are distinguished below. No deployment, remote changes, commits or Phase 10 work.

## Implementation

Preserved the existing client-side in-memory simulation architecture. Added public-demo input limits, safe action/error recovery, a short expandable Dashboard introduction, clearer module/reset guidance, bounded search text and eight readiness regression tests. Memoized portfolio metrics on Dashboard and Assets to avoid recalculation on clock-only updates. Added a repeatable local performance profiling script. No dependencies or accepted physical/settlement formulas were changed.

## Files changed

- `lib/vpp/dispatch.ts`: request validation rejects requests above 100 MW; accepted execution equations, equipment limits, SOC, efficiencies and allocation order unchanged.
- `lib/vpp/market-decision.ts`: reject targets above 100 MW and threshold magnitudes above 100,000 USD/MWh.
- `lib/vpp/scenarios.ts`: explicitly require all six numeric fields to be finite (including missing fields), retaining existing parameter bounds.
- `lib/vpp/simulation.ts`: missing dispatch asset returns a visible error without consuming time; unexpected action failure retains previous state and pauses playback with a generic message.
- `app/vpp-demo/_components/PrecisionInput.tsx`: reject missing required, non-finite, out-of-range and overlong numeric strings without rounding internal values.
- `app/vpp-demo/_components/Shell.tsx`: show simulation feedback consistently across routes.
- `app/vpp-demo/page.tsx`: introductory guide and memoized fleet metrics.
- `app/vpp-demo/assets/page.tsx`: validate before showing Saved feedback, bound search and memoize metrics.
- `app/vpp-demo/dispatch/page.tsx`: visible requested-power bounds and bounded search.
- `app/vpp-demo/market/page.tsx`: bounded inputs and safe preview error feedback.
- `app/vpp-demo/scenarios/page.tsx`: generic unexpected calculation failure message; expected validation remains specific.
- `app/vpp-demo/owner/page.tsx`, `operations/page.tsx`, `analytics/page.tsx`: bounded search inputs.

Created:

- `app/vpp-demo/error.tsx`: route render-error fallback, retry action and clear refresh/reset guidance; never displays thrown messages/stacks.
- `app/vpp-demo/_components/DemoGuide.tsx` and `DemoGuide.module.css`: concise expandable introduction, readable scoped typography and module/reset overview.
- `app/vpp-demo/_components/SimulationFeedback.tsx`: visible safe simulation-action feedback.
- `tests/vpp/readiness.test.mjs`: eight readiness regression cases.
- `scripts/vpp-profile.mjs`: local domain workload profiling, console-only; no persistent browser storage or visitor collection.
- `docs/vpp-phase-9.md`: this report.

## Visitor isolation review

`DemoProvider` creates state with `useReducer(demoReducer, undefined, createInitialState)` inside each client provider instance. Each factory call creates new fleet objects, settings, restoration metadata, Operations alerts/events and history. There is no module-level mutable simulation store, VPP server action, VPP API handler, cookie, visitor identifier, localStorage, sessionStorage, IndexedDB or database. Shared fixture constants are read as templates, not used as a mutable visitor registry. Navigation keeps a visitor's provider mounted; refresh constructs fresh state. Scenario functions copy their input fleet and settings; Scenario results never enter main history or settlement.

Automated tests verify two independently created visitor states: A's dispatch, SOC, alerts and financial results leave B deeply unchanged. Existing frozen-state, scenario and analytics isolation tests also pass.

**Required independent-browser-context test remains a manual acceptance gate.** The available browser inventory exposes only the single in-app browser profile and a non-browser MCP Apps surface; its documented capabilities provide viewport/visibility controls, not isolated/incognito context creation. Two same-profile tabs are not substituted or reported as meeting the requirement. This limitation does not imply a known leakage defect, but browser-level cross-context isolation is not yet proven.

## Security audit

Reviewed all VPP runtime source under `app/vpp-demo` and `lib/vpp`:

- No environment-variable reads, credential literals, internal filesystem path literals, server filesystem access or unsafe client configuration were found in VPP source. No environment file contents were opened or printed.
- No VPP network API, server action, database access, explicit fetch, XHR, WebSocket, beacon, external analytics collection or real market/device/payment connection exists. Normal Next.js page/chunk/font/image loading and internal route prefetching remain framework behavior.
- No `dangerouslySetInnerHTML`, eval/new Function or user-controlled HTML was found. User search strings are React text/filter data. Navigation links are fixed internal routes/anchors, with a fixed corporate return link; no user-supplied outbound URL is rendered.
- Phase 8's browser-only source guard continues to pass: no file input, picker, FileReader, File System Access API, Blob/object URL download, export, application print control or persistence.
- Excessive Dispatch/Market input magnitudes are now rejected before state mutation. Scenario runtime is bounded to 96 intervals and six preset comparisons; tables are paginated, dispatch candidates capped to 100, and search text capped to 120 characters.
- Unexpected reducer failures preserve all prior core/history/monitoring state and pause the clock with visible generic feedback. Preview/scenario handlers show generic failures; expected validation messages remain useful and do not contain paths/stacks. Render errors have a scoped recovery page.
- Operations enum/ID checks and Phase 7 availability restoration remain intact. Monitoring health annotations retain their accepted advisory semantics; they are not new dispatch interlocks.

No comprehensive dependency vulnerability scan, penetration test, hosting headers/CSP validation, TLS verification, load test or public infrastructure assessment was performed. Removing file features and passing source checks alone do not establish production security.

### Unrelated corporate findings (not changed)

The existing contact API sends real mail and is outside VPP state. Static review found only required-field checks in the route, without visible per-route length/type/email validation, rate limiting or bot protection. Infrastructure protection may exist elsewhere and was not established. Review these separately before public release of the full corporate site. No contact requests or emails were sent. Corporate homepage lint issues remain separately listed below. Root configuration currently defines no application-specific security headers; hosting policy is a release prerequisite, not a VPP deployment claim.

## Input validation

| Input | Guard |
| --- | --- |
| Dispatch | Finite, 0–100 MW; positive Charge/Discharge, zero Idle; current interval/reset token; valid existing asset ID. Individual UI uses equivalent 0–100,000 kW cap. Oversized requests are rejected, not clamped. Requests within the bound still use accepted curtailment physics. |
| Market | Finite thresholds within ±100,000 USD/MWh, charge strictly below discharge, target >0 and ≤100 MW. |
| Scenario | All six fields finite; power 0–100 MW, reserve 0–100%, storage ×0.1–10, 1–96 whole intervals, ordered thresholds within ±100,000. |
| SOC | Finite and within each asset's existing minimum/maximum SOC; status and availability enums validated. |
| Terminal comparison | Existing finite ±100,000 USD/MWh reference, target null or 0–100%, tolerance 0–100 percentage points. No terminal-aware dispatch or settlement change. |
| Operations | Existing known asset/alert IDs and health/status checks; duplicate connectivity operations remain idempotent. |
| Analytics | Existing known range modes and whole quarter-hour boundaries, 0–96, start strictly before end; immutable filtering. |
| Searches/numeric UI | Search maxlength 120; numeric required/range/finite checks plus 64-character raw numeric guard. Exact underlying values remain unchanged by rounded display. |

Cost/share validation and cent-safe settlement checks were retained. No accepted SOC, efficiency, market-price, fee, payout or terminal valuation formula changed.

## Performance methodology

Run `node scripts/vpp-profile.mjs` locally. The script reports OS/Node/CPU/memory and times one warmup plus five samples per named operation using Node's monotonic performance clock; median/min/max are printed. It uses 1,150 assets and, for the worst-case Analytics workload, 96 executed Idle intervals with 110,400 actual asset records. It does not call external APIs, collect visitor data or write simulation results to storage.

Baseline environment: Windows 10.0.26200, Node v24.21.0, AMD Ryzen 5 3550H, 8 logical CPUs, approximately 8 GiB RAM. Baseline medians (ms):

| Workload | Median | Observed min–max |
| --- | ---: | ---: |
| Initial state creation | 6.72 | 5.93–6.93 |
| Dashboard domain metrics | 0.51 | 0.44–2.35 |
| Assets search/filter/page | 0.74 | 0.54–1.01 |
| Dispatch plus monitoring | 8.25 | 7.48–10.22 |
| Market preview | 1.05 | 0.79–1.68 |
| Full-day 96-interval Base Case | 170.57 | 149.65–230.61 |
| Operations metrics | 5.08 | 4.78–6.15 |
| Analytics, 96 Idle intervals | 542.29 | 503.23–570.69 |
| Analytics, filtered 16 intervals | 99.01 | 88.89–106.59 |

These are local domain timings, not browser rendering, LCP, public latency or scalability guarantees. A second run while lint/build competed for CPU was substantially slower; it is not evidence of a regression or speedup. Final post-build/browser observations are recorded below. Memoization avoids work on unchanged fleet data; existing Analytics record memoization keeps table-only edits from resettling history. No rewrite or accounting shortcut was introduced.

Worst-case history processing can still cause a main-thread pause, and six full-day comparisons run synchronously after a brief scheduled busy indicator. Slower phones and long monitoring sessions need further profiling; repeated Operations changes retain alert/event history in memory without a retention policy. No audit history is silently discarded in this phase.

## UX and Reset semantics

Dashboard now offers a short expandable 'New here?' guide with an explicit 1 MW Dispatch starting path, module explanations and synthetic-data/private-session notices. Existing clear empty states, labeled controls, mobile menu, contained table scrolling and two-decimal formatting remain. Main action errors are visible on every VPP route.

- Reset demo: new fixture fleet/settings/clock/history/Operations state and empty restoration metadata; version increment invalidates old commands and remounts scenario/market/analytics workspaces.
- Operations Reset: monitoring fixtures, annotations, reviews and timeline only; preserves assets, SOC, clock, dispatch/settlement and pending offline restoration status.
- Reset scenarios: clears only local Scenario results/controls/terminal assumptions; main provider untouched.
- Refresh: fresh in-memory provider; no session resume or saved history.
- Restore Online: retains the accepted pre-offline status, independent availability/SOC/fault restrictions and idempotence from Phase 7.

## Automated verification

Full VPP test suite: **135/135 passed**, including eight new readiness tests. New cases cover fresh visitor factories, SOC/history/alerts/finance isolation, excessive/non-finite/missing inputs, unknown dispatch IDs, safe unexpected errors with state retention, full reset/deterministic replay, Operations Reset/restoration, full-day Scenario isolation and read-only Analytics settlement consistency. All earlier settlement reconciliation, terminal comparison, reset and availability restoration cases remain green. The existing Node module-type performance warning is unchanged; no package-mode migration was introduced.

VPP lint (including profiling script): passed. TypeScript `npx tsc --noEmit`: passed. Production/build/browser final results are recorded below. Existing full-project lint findings are confined to corporate `app/page.tsx`: six explicit-any errors at 216/217/263/264/265/332, apostrophe error at 2729, image warning at 2517. Protected corporate source/config/lockfile diff checks remain unchanged; no unrelated fixes were made.

## Release readiness checklist

| Area | Acceptance status | Public-release prerequisite |
| --- | --- | --- |
| Functional scope | Phase 9 implemented locally; awaits PO acceptance | Final end-to-end acceptance of all phases |
| Tests/types/lint/build | Local checks reported here | Repeat in release environment; resolve or explicitly accept corporate lint debt |
| Visitor isolation | Independent-state automated checks pass | **Two independent browser contexts/profiles must be verified** |
| Browser compatibility | Available Chromium-based local tool only | Current Chrome, Edge, Firefox, Safari and real iOS/Android checks |
| Security | Scoped source review, no new VPP APIs/secrets/files/persistence | Dependency review, hosting/TLS/CSP/headers, abuse and contact-endpoint protections, independent review |
| Performance | Repeatable local 1,150-asset measurements | Target-device and production-like LCP/load/memory testing, especially 96-interval Analytics and six-scenario comparisons |
| Synthetic-data notices | Existing notices plus introduction | PO review of final wording; no misleading live-market claims |
| Reset/replay | Automated checks plus browser observations | Complete manual reset and independent-context acceptance steps |
| Deployment | No deployment authorized/performed | Explicit final PO authorization, release config review, rollback/monitoring plan |

**Ready for Product Owner review with documented test limitations; not certified ready for public deployment.** Independent-context verification and cross-browser/device/hosting security checks remain open. No auth, database, external persistence or architecture change is proposed in this phase.

## Product Owner acceptance steps

1. Run `npm run dev -- --webpack` or `npm run build -- --webpack` followed by `npm run start`. Open `/vpp-demo`. Read the short Dashboard guide; verify clear simulated-data labeling and module/reset instructions.
2. Use **two independent profiles/contexts**, e.g. normal Chrome profile A and a separate Guest profile B (or two independent browser profiles). Do not count two same-profile tabs. Reset both. In A execute a confirmed 1 MW discharge and simulate a health fault/offline asset. Verify A's SOC/history/alerts/Settlement/Analytics change while B stays at initial SOC, no dispatch and zero actual settlement. Act in B and recheck A. Refresh one context; only that context must reset. Record browser versions and results.
3. Dispatch default fleet 1 MW at step 0: compare Analytics/Settlement ($7.51 settled gross, $1.65 net, $1.17 owner, $0.48 DriveGrid, raw gross $7.50) and 0.25 MWh exports. Inputs above 100 MW, invalid/empty/non-finite values and stale confirmations must not execute or corrupt state. Valid over-capacity requests within 100 MW still curtail normally.
4. On Market, test ordered/unordered and extreme thresholds and targets; Preview must not advance clock/SOC. Execute one current confirmed recommendation, and verify history and settlement.
5. Edit an asset SOC within limits and attempt out-of-range values; confirm only valid saves are reported. On Operations, choose an initially Ready/Available asset, Offline then Online repeatedly. Available count must recover. Repeat after independently making it unavailable or adding a monitoring fault; those restrictions/annotations must remain.
6. Test Operations Reset while an asset is offline: core state/history/settlement remain, pending prior status still restores. Test Reset demo: all fixture SOC/settings/clock/history/monitoring restore and actual finance becomes zero.
7. Run a full-day Scenario, Compare Strategy A/B and Compare Scenarios; inspect busy status/results and unchanged main state. Try invalid interval/reserve/storage/terminal assumptions. Reset scenarios must clear only the lab. Main Reset must also clear stale local scenario results. Refresh must restore the clean main fixture state.
8. On Analytics verify All/day/last-four-hours/custom filters, empty ranges, asset search/type/sort/pagination and current-vs-historical labels. Record main state before view changes and confirm unchanged afterward. No file permissions, uploads, downloads, exports or print controls should exist.
9. At desktop, tablet and mobile widths test navigation, controls, horizontal table scrolling, charts and readable units. Repeat on real browsers/devices listed in the checklist. No corporate contact submissions.
10. Run `npm run test:vpp`, `npx eslint app/vpp-demo lib/vpp tests/vpp scripts/vpp-profile.mjs`, `npx tsc --noEmit`, `npm run build -- --webpack`, and `node scripts/vpp-profile.mjs`. Compare measurements as local observations, not guaranteed service levels.

Stop for Product Owner Phase 9 review. No Phase 10 or public deployment authorization is inferred.


## Final performance and browser observations

Post-build rerun (five samples, same environment) medians/min–max in ms: initial state 7.14 / 5.70–8.94; Dashboard metrics 1.05 / 0.60–2.69; Assets filter/page 0.90 / 0.59–1.20; dispatch plus monitoring 10.21 / 6.22–13.60; Market preview 0.74 / 0.52–1.04; 96-interval scenario 222.91 / 189.70–262.24; Operations metrics 6.01 / 5.45–8.32; worst-case Analytics 642.10 / 550.28–792.97; filtered Analytics 106.80 / 83.08–115.45. Variation between runs is retained rather than presented as an optimization speedup.

Local production browser observations: initial Dashboard navigation plus the automation snapshot took 5,648 ms; Run Scenario click through visible 96-interval results took 521 ms; Market Preview click through visible preview took 339 ms. These single-sample observations include browser automation overhead and are not pure render timings. The browser tool does not expose Navigation/Paint Performance entries in its read-only DOM scope; LCP/paint/frame-budget profiling remains a target-browser release check.

Verified the new guide, 101 MW browser validation rejection with clock still at interval 0, valid 1 MW dispatch and unchanged reference settlement ($7.51 gross/$1.65 net), Scenario Reset without main clock/finance changes, Operations Reset while offline followed by successful previous-ready-status restoration, main Reset to zero actual cash/history, and refresh back to step 0. Market contradictory thresholds showed a specific safe error; valid Preview left main time unchanged. Earlier tests cover independent fault/unavailable preservation and repeated transitions.

Desktop, tablet 768 x 1024 and mobile 390 x 844 were inspected. Tablet/mobile document client and scroll widths matched at 753/375 px; the mobile navigation and guide worked. The initial guide typography was enlarged and spaced after visual inspection. Screenshots are local QA artifacts; the application has no screenshot/file download feature.

Final verification: the rebuilt guide uses scoped 13–14 px typography, readable spacing and keyboard focus outlines; its desktop/mobile screenshots were re-inspected. Final Webpack build completed successfully (all VPP routes), VPP lint passed, TypeScript passed, and the 135-test suite remains green. The last source-only change was guide CSS/import styling; no calculation changed afterward. Final browser console error check on the rebuilt Dashboard returned no errors. The production server was stopped after checks.

Local QA images: `vpp-phase-9-desktop.png`, `vpp-phase-9-tablet.png`, `vpp-phase-9-mobile.png`. Branch remains `main`; existing package.json/tsconfig.json modifications and earlier-phase untracked work predate this phase. No staging/commit/remote command or deployment was performed. Final protected corporate/config/lockfile diff and whitespace checks passed.
