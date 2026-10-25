# VPP Demo — Phase 1

## Scope

An isolated `/vpp-demo` operations dashboard with a dark navy application shell,
responsive sidebar/menu, six approved fixture KPIs, hourly price and dispatch
charts, DER composition, asset availability, and recent simulated events.
The seven other workspace modules are clearly labeled future-phase placeholders.
Unknown module URLs are not generated and return 404.

All data is deterministic and illustrative. The fixed reference day is
23 October 2026 in Central Time. Revenue, SOC, and availability are fixtures,
not outputs of operational models. No market feeds, device commands, persistence,
authentication, optimization, battery physics, or settlement logic is implemented.

## Organization

- `app/vpp-demo/layout.tsx`: dedicated layout and metadata.
- `app/vpp-demo/page.tsx`: dashboard composition.
- `app/vpp-demo/[module]/page.tsx`: statically generated placeholder routes.
- `app/vpp-demo/_components/Shell.tsx`: client-side navigation and mobile menu.
- `app/vpp-demo/_components/Panel.tsx`: reusable section panel.
- `app/vpp-demo/_components/TimeSeriesChart.tsx`: SVG charts and accessible data tables.
- `app/vpp-demo/demo.module.css`: scoped visual styles and responsive breakpoints.
- `lib/vpp/fixtures.ts`: typed, deterministic sample data and navigation definitions.
- `tests/vpp/fixtures.test.mjs`: Node test-runner suite.
- `package.json`: adds only `test:vpp`; no dependency changes.

Future simulation functions should live in `lib/vpp/simulation/`, independently
of React. Real integrations should use separate adapters and server-side credential
boundaries. Phase 1 does not introduce empty services or speculative frameworks.

## Validation

Baseline, commands initiated before implementation:

- `npm run lint`: failed with seven existing errors and one warning in `app/page.tsx`:
  six explicit `any` types, one unescaped apostrophe, and an image optimization warning.
- `npm run build`: failed fetching the existing Geist/Geist Mono Google Fonts
  under restricted networking.

After implementation:

- `npm run test:vpp`: five passing tests covering approved KPIs, hourly coverage,
  value bounds, portfolio/status totals, route definitions, and event ordering.
- `npx eslint app/vpp-demo lib/vpp tests/vpp`: passes.
- `npm run lint`: same seven pre-existing homepage errors and one warning.
- Default Turbopack production build with network access: failed starting its
  CSS processing worker for the existing global stylesheet.
- `npm run build -- --webpack`: successful production compilation, TypeScript
  checking, and static generation of the dashboard and seven module routes.
- Read-only local HTTP checks: `/` and all eight demo routes return 200.
- Browser checks: desktop, 768px tablet, and 390px mobile presentation;
  sidebar route navigation, mobile menu expansion and automatic close on route
  selection, dashboard return, and expandable hourly data table.
- Tablet document width matches content width (no horizontal overflow observed).
- Browser verification found an SVG title hydration issue; single-string SVG
  titles corrected it. Fresh development and rebuilt production browser loads
  report no console errors.
- Corporate return link, ERCOT market filtering, and existing simulation control
  smoke-tested. Contact form never submitted; no real emails sent.
- Git diff confirms no changes to homepage, contact endpoint, global CSS, root
  layout, lockfile, or existing configuration.

## Local usage

Use Node.js 24 (the verified runtime is 24.21.0). The test script uses native
TypeScript stripping and Node's built-in test runner, with no added dependencies.
Node may print a harmless module-type detection warning for the fixture import;
the root package module mode is intentionally unchanged.

```powershell
npm run dev -- --webpack
```

Open `http://localhost:3000/vpp-demo`.

```powershell
npm run test:vpp
npx eslint app/vpp-demo lib/vpp tests/vpp
npm run build -- --webpack
npm run start
```

Existing root font configuration requires Google Fonts access at build time.
The Webpack flag is a supported command-line fallback; the existing build script
and corporate configuration remain unchanged. Automated browser tests are not
installed; browser checks above were performed interactively. Cross-browser and
real-device coverage remain future validation work.

No commits, pushes, deployments, or Phase 2 implementation were performed.
