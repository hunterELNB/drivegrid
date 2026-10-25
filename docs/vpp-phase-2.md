# DriveGrid VPP Demo — Phase 2 report

## Delivered

- Functional `/vpp-demo/assets` registry: 20-row pagination, combined text/type/
  status/availability filters, empty results, status badges, and accessible details.
- Editor for simulated SOC, availability, and operational status. Ratings and
  limits remain read-only. Invalid SOC edits are rejected in both UI and reducer.
- Typed DER domain for EV/V2G, residential batteries, and commercial BESS.
  Rated power, available dispatch power, charge/discharge limits (MW), and energy
  capacity (MWh) are separate fields/concepts.
- Shared React Context/reducer at the demo layout boundary. State survives client
  navigation between demo modules. No corporate components use this state.
- Shared simulation clock with start, pause, step, and reset controls. Reference
  start: `2026-10-23T00:00:00-05:00`; each tick advances exactly 15 minutes.
  Playback emits a tick every two seconds and stops after 96 intervals at the
  following midnight. Manual step pauses; it is disabled while playback runs.
- Dashboard capacity, dispatch availability, connected count, weighted SOC,
  resource composition, and status summary now derive from shared asset records.
  The Phase 1 visual language and navigation are retained.

## Model and initial state

The fixture generator creates 1,000 EV/V2G, 100 residential battery, and 50
commercial BESS records using stable IDs and locations, with no random inputs.

| Metric | Initial value |
| --- | --- |
| Registered assets | 1,150 |
| Connected assets | 1,116 |
| Rated power | 20 MW |
| Available dispatch ceiling | 12 MW |
| Energy capacity | 117.7 MWh |
| Energy-capacity-weighted SOC | 68% |
| Eligible / standby / offline-maintenance | 1,020 / 96 / 34 |

Connected excludes offline and maintenance. Standby in the dashboard groups
connected resources that are ineligible to dispatch, including unavailable or
minimum-SOC assets. Equipment status and availability remain independent fields;
an available asset marked offline still contributes zero dispatch power.

Available dispatch is zero unless the asset is ready, available, above minimum
SOC, and (for EVs) V2G-enabled. Otherwise it is the smaller of rated power and
maximum discharging power. This is an instantaneous ceiling, with no duration
guarantee, efficiency model, dispatch schedule, or energy simulation.

The Phase 1 connected-count fixture of 1,150 is replaced by the derived 1,116;
all 1,150 records remain registered. Composition now reflects the three supported
storage resource types rather than the previous four-category illustration.
SOC is weighted by nameplate energy capacity across all registered assets.

## Files

Created:

- `lib/vpp/domain.ts` — asset types, fixtures, validation, filtering, pure metrics.
- `lib/vpp/simulation.ts` — clock constants, state/actions, reducer, time formatting.
- `app/vpp-demo/_state/DemoProvider.tsx` — shared state and timer lifecycle.
- `app/vpp-demo/_components/SimulationClock.tsx` — reusable clock controls.
- `app/vpp-demo/assets/page.tsx` — registry and editor.
- `app/vpp-demo/assets.module.css` — scoped responsive asset/clock styling.
- `tests/vpp/domain.test.mjs` — nine domain/reducer tests.
- `docs/vpp-phase-2.md` — this report.

Modified:

- `app/vpp-demo/layout.tsx` — mounts provider.
- `app/vpp-demo/_components/Shell.tsx` — renders shared clock.
- `app/vpp-demo/page.tsx` — consumes shared metrics and simulation time.
- `app/vpp-demo/[module]/page.tsx` — excludes Assets from placeholders.
- `tsconfig.json` — enables `allowImportingTsExtensions` for Node-native tests
  importing pure TypeScript modules directly; compatible with existing `noEmit`.

No dependencies added, no package/lockfile changes in Phase 2. The existing
Node test runner remains in use. Node 24.21.0 was used for validation.

## Verification results

- `npm run test:vpp`: **14 passed**, including the five Phase 1 fixture tests.
  New coverage includes reproducibility, ratings, MW/MWh aggregation, weighted
  SOC, availability/status changes, minimum and maximum SOC, invalid inputs,
  filters, paused timer guards, exact 15-minute timestamps, end-of-day stopping,
  and full reset with fresh records.
- `npx eslint app/vpp-demo lib/vpp tests/vpp`: **passed**.
- `npm run lint`: **seven pre-existing homepage errors and one warning**;
  no new-module findings. Existing corporate source remains unchanged.
- `npm run build -- --webpack`: **passed**, including TypeScript and generation
  of the dashboard, concrete Assets route, and six remaining placeholders.
- Browser checks on the local production build:
  - EV availability edit: 12.000 → 11.994 MW on dashboard after client navigation.
  - Commercial BESS at minimum SOC: 11.855 MW, 67.7% weighted SOC, and 1,019
    available assets. Rated capacity remains 20 MW.
  - SOC 19% rejected by browser validation; valid 20% accepted.
  - Type and ID filtering, pagination, detail selection/focus, and save feedback.
  - Start, timed advance, pause, manual step, reset, and cross-route state.
  - Reset restores saved assets, clock and unsaved SOC input (45% → 68%).
  - Desktop presentation, 390px mobile Assets, and 768px tablet dashboard.
    No document-level horizontal overflow observed; wide registry scrolls within
    its own keyboard-focusable region. Mobile navigation and clock step work.
  - No browser console errors observed.
- Protected corporate homepage/contact API, global CSS, root layout, and lockfile
  remain unchanged according to Git diff. No contact submissions or emails.
  Browser return navigation also confirmed the corporate heading and enabled
  inquiry form remain available without submitting it.

The existing Turbopack worker limitation from Phase 1 remains; local validation
uses Next.js's supported Webpack option. Root Google Fonts still need network
access at build time. Node tests emit the existing harmless module-mode detection
warning; root package module semantics were not changed.

## Local acceptance review

```powershell
cd C:\business\website\drivegrid
npm run dev -- --webpack
```

Open `http://localhost:3000/vpp-demo/assets`.

1. Filter to Commercial BESS, search `commercial-bess-0001`, then choose View.
2. Set SOC to 20%, save, and open Dashboard through sidebar navigation.
3. Confirm available power 11.855 MW, SOC 67.7%, and status counts update.
4. Step the clock; start and pause playback. Navigate between demo modules to
   confirm clock and asset edits remain shared.
5. Reset demo and confirm 00:00 CT, 12.000 MW, and 68% SOC are restored.
6. Try invalid SOC, no-match filters, pagination, and mobile navigation.

```powershell
npm run test:vpp
npx eslint app/vpp-demo lib/vpp tests/vpp
npm run build -- --webpack
npm run start
```

## Limits and handoff

- State is memory-only. Refresh, leaving the demo, or reopening the browser
  restores fixtures. No database, authentication, external services, or secrets.
- Reset intentionally discards all asset edits and clears the clock; filters and
  selected asset are local view preferences, not simulation state.
- Clock progression is driven by ticks, not elapsed wall time; background-browser
  throttling can slow playback. Advancing time alone does not alter SOC or assets.
- Price, revenue, historical chart profiles and recent operations remain clearly
  labeled reference fixtures. No trading, settlement, optimization, battery
  physics, or live audit records were implemented.
- UI checks were interactive, not an installed automated browser suite; broader
  real-device and cross-browser coverage remains outside this verification.

All work remains local and uncommitted. No staging, commits, pushes, remote
branches, pull requests, deployments, or Phase 3 work. Ready for Product Owner
acceptance testing; the next phase requires explicit approval.
