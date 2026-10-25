# Phase 7 — Operations and system monitoring

Date: 24 October 2026. Local implementation only; awaiting Product Owner acceptance.

## Implementation summary

`/vpp-demo/operations` is now a functional Operations Center over the existing shared fleet and dispatch history. It provides fleet KPIs, deterministic equipment-health/telemetry fixtures, asset filters and controls, an alert center with lifecycle actions, interval and asset-level dispatch monitoring, and a filtered operational timeline. The existing logo, navigation, dark styling and two-decimal formatters are reused.

There is no second asset/SOC registry, device connection, market connection, email/notification delivery or financial transaction. Scenario runs remain isolated.

## Created and modified files

Created:

- `lib/vpp/operations.ts`: monitoring types/fixtures, health/telemetry derivation, alert reconciliation/lifecycle reducer, core-transition observer, KPI helpers, dispatch-log and event-timeline derivation.
- `app/vpp-demo/operations/page.tsx`: Operations dashboard, asset-health filters/controls, alerts, dispatch monitoring and event timeline.
- `app/vpp-demo/operations/operations.module.css`: scoped responsive layouts and status colors.
- `tests/vpp/operations.test.mjs`: 17 automated tests (restoration expectation updated by the acceptance fix).
- `tests/vpp/connectivity-restoration.test.mjs`: 9 acceptance regression tests for restoring availability and preserving independent restrictions.
- `docs/vpp-phase-7.md`: this report.

Modified:

- `lib/vpp/simulation.ts`: monitoring metadata in shared state; operations actions and a wrapper around the accepted core reducer. The dispatch, price, energy and financial calculations are unchanged.
- `app/vpp-demo/[module]/page.tsx`: unknown modules remain unavailable; Operations now has its own explicit route rather than the placeholder.

No dependencies, package/lock changes, corporate homepage/contact changes, global CSS, root layout or branding asset changes. Work remains on local `main`; previous phase work was already uncommitted/untracked. No staging, commits, pushes, PRs, remote branches or deployment.

## Acceptance fix — Offline/Online availability restoration

The Product Owner's reproduction was investigated before code changes. Initial Available Assets was 1,020; Simulate Offline reduced it to 1,019; Restore Online left it at 1,019. The availability flag stayed `available` throughout. The handler unconditionally restored `standby`, while the accepted dispatch engine requires `ready`. The handler had overwritten and discarded the original status. This was a controller/status-restoration bug, not a battery calculation or KPI aggregation error.

The fix keeps a small `preOfflineStatus` mapping in shared DemoState, separate from monitoring annotations and from the underlying availability flag. When an asset enters Offline, its previous non-offline status is recorded once. Core `offline` remains the effective connectivity gate already understood by the accepted physics engine. Restore consumes that saved status instead of blindly setting standby or ready. The current availability flag, SOC, health/fault annotations and settlement are never restored from stale snapshots or cleared by reconnection.

Repeated Offline/Online commands are no-ops when already in the requested connectivity state. Repeated cycles capture/restore the original status without accumulating or overwriting pending metadata. Explicit core status edits that leave Offline supersede and discard pending restoration, so an operator's maintenance edit cannot later be overwritten by stale Ready state. Availability/SOC edits while staying Offline are preserved and applied by the existing dispatch limits on reconnection.

The mapping is outside `operations`, so Operations Reset cannot discard it and strand an asset offline or unavailable. Operations Reset still preserves core assets/history/finances; full Reset demo clears pending restoration with the rest of the full-demo state. Seeded offline assets with no known previous status safely restore to standby. No second fleet registry or physical eligibility calculation was introduced, and battery physics, SOC arithmetic, market valuation, settlement formulas and Scenario Analysis were not edited.

The Operations button/help text now says “Restore online → previous status.” The original Phase 7 test that expected forced standby has been updated to the newly required restoration behavior. Nine additional regressions cover Ready/Available restoration, pre-existing unavailability, repeated/idempotent cycles, offline dispatch rejection, faults and restrictions added while offline, maintenance/standby preservation and superseding status edits, KPI/core capability consistency, Operations/full reset, and seeded-offline fallback.

Fix verification: **115/115 VPP tests passed**, including nine new regressions and the existing test updated to the corrected restoration policy. VPP ESLint passed (`node node_modules/eslint/bin/eslint.js app/vpp-demo lib/vpp tests/vpp`), and the Webpack production build passed with TypeScript checks and all routes. The production browser reproduced **1,020 → 1,019 → 1,020**; Assets returned to Ready with 6 kW available and Dispatch also showed 6 kW. Restoration after Operations Reset returned the count to 1,020. A pre-existing unavailable flag remained blocked at count 1,019, and a simulated Fault annotation persisted across reconnection. Browser console errors were absent; mobile content/viewport widths both measured 375 CSS pixels. No existing physics/SOC/settlement/Scenario Analysis source was changed. Phase 7 remains pending Product Owner acceptance.

## Monitoring architecture

The existing DemoProvider/Context exposes one DemoState. Its `operations` field contains health overrides, offline telemetry timestamps, alert episodes, event metadata, reset generation and UI feedback. It contains no copied fleet SOC, dispatch ledger or settlement amounts. UI snapshots reference the current core assets/history; monitoring helpers read those inputs without running physics.

The existing core reducer is kept as a private function. A wrapper handles operations-specific actions and observes successful core transitions. It preserves existing no-op state identity and reset semantics. Core asset edits from Assets, manual/market dispatch, clock progression and full-demo resets are reflected automatically. Market/commercial settings changes do not create spurious monitoring events.

Dispatch monitoring derives interval rows from shared history, newest first, and displays original per-asset records for a selected interval. Fleet unallocated demand is reported once in the aggregate; it is not duplicated across excluded asset records. The event timeline stores one execution observation per interval, rather than copying individual physical or financial ledgers.

## Connectivity, health and telemetry rules

- Connectivity: core asset status `offline` means simulated Offline; all other core statuses are Online. Online does not imply dispatch eligibility: standby, maintenance and unavailable assets remain subject to the existing dispatch rules.
- **Simulate offline → core offline** explicitly sets the shared asset's accepted operational status to `offline`, preserving SOC and availability flag. The existing physical engine already blocks charge and discharge for this status. No new connectivity rule is inserted into physics.
- **Restore online → previous status** restores the recorded status from before the connectivity override, preserving the **current** SOC and availability flag. Ready assets become eligible again only when existing dispatch rules allow it; standby/maintenance/unavailable/SOC restrictions remain. Seeded offline assets with no known previous status retain the safe standby fallback.
- Health: stable unsigned asset-ID hash, seeded with multiplier 31. Hash divisible by 389 → Fault; otherwise divisible by 113 → Warning; otherwise Healthy. Overrides can set Warning, Fault or Healthy.
- Health controls are explicitly **monitoring only**. They do not change core availability/status, power, SOC, energy, market-preview revision or settlement. A fault can therefore coexist with core dispatch capability; the UI labels capability as core-engine capability and separately marks monitoring readiness as attention required. Enforcing health as an additional dispatch interlock would need a future approved business-rule change.
- Online heartbeat age is deterministically 0 or 15 minutes according to the hash, except hash divisible by 53 has a stale-fixture age of 45 minutes. Timestamps derive only from simulation time. Online heartbeat ages follow that seeded schedule; no network packets are read.
- Baseline offline telemetry is 60–105 minutes older than initialization, based on hash. On an online→offline transition, the last simulated online telemetry timestamp freezes. It remains unchanged while the main clock advances. Restoring online resumes the seeded heartbeat model.
- Stale means strictly older than 30 simulated minutes. Low operational SOC means strictly below 25%; neither threshold changes the accepted physical SOC minimum/maximum.
- Advisory monitoring readiness requires Online, no Fault, fresh telemetry and some charge or discharge capability. Warnings do not by themselves prevent advisory readiness. This is distinct from core discharge availability and is not an enforcement policy.

Offline assets cannot appear dispatch-available: Offline is the same accepted core status used by the physical engine, whose capability is zero. Thus no change to accepted dispatch physics/business rules was required. The control buttons state their core-status effects explicitly.

## Alert lifecycle

Alerts have deterministic condition keys, reset generation, episode number, ID, severity, source/asset, simulation timestamps, description, status and condition-active flag. Displayed descriptions represent the detected episode; current SOC/capability is always available in the asset-health table.

| Condition | Severity | Lifecycle |
|---|---|---|
| Offline | Warning | Active until core status is restored online |
| Core availability flag unavailable | Info | Active until flag becomes available |
| SOC below 25% | Warning | Active until actual shared SOC reaches 25% or more |
| Health Warning | Warning | Active until annotation changes |
| Health Fault | Critical | Active until annotation changes |
| Telemetry older than 30 minutes | Warning | Active while derived telemetry remains stale |
| Historical rejected dispatch | Warning | Reviewable historical event; manual close allowed |
| Historical curtailed dispatch | Info | Reviewable historical event; manual close allowed |

Rules:

1. A persistent condition creates one Open episode. Repeated reconciliation or clock ticks do not create duplicate episodes/events.
2. Acknowledge changes Open→Acknowledged only. It neither repairs a condition nor changes any physics, assets or earnings. Acknowledged conditions still count as active, including critical conditions.
3. Resolve is disabled/rejected for an active physical/monitoring condition. Acknowledgment never enables it. Clear the underlying cause instead; reconciliation automatically marks the episode Resolved with a resolution reason/time.
4. Recurrence after recovery creates a new episode/ID, retaining the prior resolved episode until monitoring reset. It does not reopen/reuse the old episode.
5. Dispatch rejection/curtailment is a historical fact, not an ongoing equipment fault. Such alerts may be acknowledged and manually resolved after review; the execution record and settlement remain unchanged. A closed historical dispatch alert does not reopen on each clock tick.
6. Active alert counts include Open+Acknowledged. Open-by-severity counts include Open only. Resolved alerts remain filterable.
7. Operations Reset starts a new monitoring generation: clears overrides, episode reviews and timeline, restores seeded telemetry/health fixtures and re-derives current core conditions plus historical rejected/curtailed outcomes. Existing unresolved core offline/unavailable/SOC conditions therefore reappear as Open; closing an old alert is not a repair. IDs include reset generation to reject stale actions from the prior timeline.

Operations Reset preserves core assets (including an explicitly changed offline status and its pending restoration metadata), clock/running state, resetVersion, history, market settings/revision, commercial settings and settlement. It is intentionally different from Reset demo, which restores the full accepted demo baseline. Both effects are labelled in the UI.

## Operational timeline

Events include dispatch execution, core availability/status and connectivity changes, explicit health changes, alert creation/acknowledgment/resolution, monitoring initialization/reset, and clock checkpoints. Each has a simulation timestamp and monotonically ordered sequence/ID within its monitoring generation. Sort order is timestamp descending, then sequence descending for same-time events. Filters support event type and text/source.

Clock-only actions log at whole simulated hours, at most 24 checkpoints for a day. Dispatch-driven time advancement logs execution instead of an extra clock checkpoint. Bootstrap alert events and per-asset alert episodes are retained, but tables render only 20 rows per page. No per-asset SOC event is logged for every dispatch, avoiding a full-day event flood.

## KPI formulas and baseline

| Metric | Formula / definition |
|---|---|
| Registered | Current asset count |
| Available assets | Assets with accepted 15-minute discharge limit > 0 |
| Unavailable assets | Registered − discharge-available count |
| Online / Offline | Count by simulated connectivity/core status |
| Available fleet power | Sum of sustainable per-asset AC discharge limits, MW |
| Weighted SOC | Σ(capacity MWh × SOC %) / Σ(capacity MWh), including all assets |
| Connectivity % | Online count / registered count × 100 |
| Availability % | Discharge-available count / registered count × 100 |
| Healthy % | Healthy annotation count / registered count × 100 |
| Dispatch acceptance % | Total accepted AC energy magnitude / total requested AC energy magnitude × 100; N/A if requested energy is zero |
| Curtailed / rejected energy | Sum of respective aggregate interval MWh, counted once |
| Recent dispatch count | Executions starting in the preceding four 15-minute intervals (60 simulated minutes) |
| Active / critical alerts | Unresolved episodes / unresolved critical episodes |

Count percentages are not capacity-weighted. Available asset count is specifically **discharge** availability; an asset at physical minimum SOC may be able to charge while not counted as discharge-available. Idle contributes no requested/accepted energy to the energy acceptance ratio. The monitoring-ready count is advisory and separately defined above.

Fresh baseline outputs: 1,150 registered; 1,020 discharge-available; 130 unavailable; 1,116 online/34 offline; 12 MW available; 68% weighted SOC. Connectivity 97.04%; availability 88.70%; healthy 98.61% (1,134 assets). There are 236 seeded active alerts: 130 Info, 103 Warning, 3 Critical, all initially Open. No dispatch gives N/A acceptance, zero recent/total count and zero curtailed/rejected energy. The fixture volume is intentional and paginated, not a live incident count.

## Verification

- Baseline accepted suite: 89 tests.
- Initial Phase 7 suite (before the acceptance restoration fix): **106/106 passed**, including all prior tests and 17 new Operations tests. Coverage includes stable fixtures/IDs, offline/standby transitions and physical blocking, core Assets change observation, acknowledgment/non-repair, active-fault resolution guards, automatic recovery and recurrence, deduplication, SOC/unavailable/stale conditions, frozen telemetry, annotation isolation, dispatch-log derivation, historical alert closure, KPI formulas, hourly event limits/order/filtering, reset isolation/stale IDs, full Reset demo, scenario isolation and numerical formatting. The additional full-day test retained 96 unique dispatch intervals and exactly 96 execution observations, no duplicate active condition keys and four recent dispatches at end of day.
- VPP-scoped ESLint: passed with no warnings or errors. The final local check used `node node_modules/eslint/bin/eslint.js app/vpp-demo lib/vpp tests/vpp` (the same configured ESLint CLI, invoked directly).
- `npm run build -- --webpack`: passed with all corporate and VPP routes, including the dedicated Operations route. The final bounded-table/accessibility refinement build also passed.
- Full `npm run lint`: only the existing corporate `app/page.tsx` issues: six `no-explicit-any` errors at 216, 217, 263, 264, 265 and 332; unescaped apostrophe error at 2729; existing `<img>` warning at 2517. Corporate files were not edited.
- Existing Node `MODULE_TYPELESS_PACKAGE_JSON` warnings remain; no module-system change was introduced.

Initial Phase 7 local production browser checks (port 3003; standby restoration behavior below is superseded by the acceptance fix):

- Baseline KPI cards matched the formulas/fixture counts above. Alert acknowledgment kept EV 0001's fault active, active alerts at 237 and critical alerts at 4; Resolve remained disabled. Clearing the health annotation automatically resolved episode 1; a recurring fault created episode 2, Open.
- Offline control changed the shared EV status to offline, retained availability flag and SOC, and displayed 0 kW charge/discharge with Discharge unavailable. Its telemetry stayed at 22 Oct 23:45 CT while age rose from 15 to 45 minutes and became stale. Restore changed core status to standby, with zero capability until an explicit Ready edit in Assets.
- After explicitly setting Ready, an individual 1 MW discharge request accepted 6 kW and curtailed 994 kW. Operations showed the same aggregate and original asset record, a related deterministic historical alert, 0.6% energy acceptance and 0.25 MWh curtailed energy (rounded display). Health was still Fault, demonstrating the explicitly labelled monitoring-only limitation rather than a new hidden dispatch rule.
- Resolving the historical curtailment alert left the Settlement page byte-for-byte unchanged. Operations Reset also preserved Dashboard and Settlement page text exactly and retained a deliberately offline core asset; only monitoring overrides/reviews/timeline reset.
- A/B Scenario Analysis left the complete Operations page text unchanged on return. No scenario execution or financial result was written into the main operational timeline.
- Event filtering showed connectivity transitions and exactly one hourly checkpoint for clock progression through 01:00 and 01:15. Core filters, source search and lifecycle status filtering worked. Browser error log was empty.
- Final desktop/tablet/mobile checks passed: document content width equalled viewport width at 1265, 1009 and 375 CSS pixels. Wide tables scroll inside their own labelled regions with sticky headers and bounded height; they do not widen the document. Health pagination moved correctly to EV 0021 on page 2. Numeric-text checks found no decimals beyond two places after excluding preserved ISO timestamps/IDs.
- Mobile menu, Operations navigation, clickable corporate-logo return and corporate homepage heading/Submit Inquiry control were verified. No form was submitted. Final browser error log remained empty. Screenshots `vpp-phase7-desktop.jpg` and `vpp-phase7-mobile.jpg` were saved outside the repository in the task visualization folder and visually inspected.

Corporate homepage/contact API, root layout/global CSS, existing logo and package lock were checked unchanged through Git. No dependencies, staging, commits, pushes, PRs, deployments, emails or notifications were performed.

## Known limitations

Monitoring health/telemetry are seeded illustrative annotations, not sensor measurements, network latency analysis or device diagnostics. Seeded online stale fixtures stay stale until the fixture model changes/reset; there is no real telemetry refresh service. Health and stale telemetry are advisory rather than new dispatch interlocks. Core offline control is effective through the existing status rule. Restoration now returns the prior status; only assets without recorded prior status fall back to standby and require an explicit Ready edit.

Alert reviews, monitoring overrides and timeline are in-memory and reset with the demo/reload. Operations Reset deliberately clears its own prior audit/review history; this is not a persistent compliance-grade audit system. Core dispatch history remains available and rejected/curtailed historical alerts are re-derived after reset. Previously rejected invalid/stale user submissions that produced no execution are not fabricated into dispatch history.

No optimization, actual connectivity, device health guarantee, external notifications, real settlement or Phase 8 functionality is implemented.

## Product Owner local acceptance

1. In `C:\business\website\drivegrid`, run `npm run dev`; open `http://localhost:3000/vpp-demo/operations`. Or build with `npm run build -- --webpack`, then `npm run start`.
2. Reset demo for baseline. Confirm KPI values above, seeded asset-health statuses/telemetry, simulation timestamp and no dispatch history. Check count versus weighted metric definitions.
3. Select `ev-v2g-0001` as Control target. Simulate fault (monitoring only). Filter Alert Center to Critical and the asset ID. Acknowledge: status becomes Acknowledged while the fault and active critical count remain. Resolve must remain disabled.
4. Clear simulated warning/fault: health becomes Healthy and the prior episode appears Resolved when filtering resolved alerts. Simulate fault again: a distinct next episode should be Open, without duplicates on subsequent clock steps. Health annotations alone must not change core SOC, dispatch capability or prior financial results.
5. Simulate offline: core status changes explicitly to offline, core charge/discharge capability becomes zero, an offline alert opens and Dashboard/Assets reflect the same core change. Advance the clock and confirm frozen telemetry ages/stale alerts. Restore online: an initially Ready/Available asset returns to Ready and its available count/capability recover. Previously unavailable, standby or maintenance assets retain their independent restrictions. Seeded offline assets without a recorded previous status fall back to standby.
6. In Dispatch, execute an individual 1 MW discharge request against the 6 kW EV limit (curtailed), or a valid request against an offline asset (rejected). Return to Operations: inspect aggregate requested/accepted/rejected/curtailed power, original asset record and related historical alert. Resolve that historical alert; original dispatch/settlement must remain unchanged.
7. Filter the event timeline by health, connectivity, dispatch and alert events. Equal-time events must retain stable sequence order. Clock-only steps should produce only hourly checkpoints. Test severity/status/search filters and pagination.
8. Note main SOC, clock, dispatch, financial results and commercial settings. Click Operations Reset: annotations/reviews/timeline restore to monitoring fixtures while those core values remain unchanged. A core asset deliberately left offline must remain offline, with its saved prior status preserved so Restore Online still works afterward; Reset demo is the separate full reset.
9. Run Scenario Analysis and A/B comparisons; return to Operations and main pages. Main monitoring/asset/history/financial state must be unchanged by isolated scenario runs.
10. At desktop/tablet/mobile widths, verify cards, status colors/text, contained table scrolling, filters, controls, logo/menu/return navigation and two-decimal numerical displays. Do not submit the corporate contact form.
11. Run `npm run test:vpp`, `npx eslint app/vpp-demo lib/vpp tests/vpp`, and `npm run build -- --webpack` locally.

Stop for Product Owner Phase 7 review. No Phase 8 or remote submission/deployment is authorized.
