# VPP visualization architecture — permanent contract

This applies to Dashboard, Dispatch, Assets and future VPP visual development. Current rendering remains SVG. No 3D library, GLB asset, empty placeholder or speculative 3D implementation is included.

## Required separation

Keep domain calculations and the shared reducer unchanged and outside equipment renderers. A read-only presentation adapter selects existing state and constructs typed renderer input. Renderers consume that input and never execute dispatch, calculate SOC, settle revenue, change availability or write simulation state. React-local replay counters are presentation state only.

Keep labels, accessible summaries, forms, interactions and KPI text outside a replaceable scene wherever possible. A future GLB renderer must fit the same parent sizing/responsive contract and preserve those bindings. SVG is the default renderer today and must remain a fallback for unsupported devices, constrained performance or model-loading failure. Reduced-motion preferences must retain a readable static representation.

## Audited integration points

| Page | Adapter / input | Default renderer / layout contract |
| --- | --- | --- |
| Dashboard | `EnergyNetworkVisualization` memoizes typed `ResourceView[]` from existing assets and latest record, including current eligibility guards. Replay key is presentation-only. | `NetworkScene2D({resources, recordKey})`, SVG viewBox `0 0 1000 650`, inside existing `.scene`; `EquipmentGraphic` is the existing compact/mobile SVG fallback. |
| Dispatch | `DispatchScene` derives typed `RecordedFlowView` (`mode`, `active`, `replayKey`) from the latest recorded event. Current SOC and labels remain outside the scene. | `DispatchSceneSvg({flow})`, SVG viewBox `0 0 800 340`, inside the original `.diagram`; no business-state imports in the renderer. |
| Assets | `FleetOverview` groups assets and reuses existing `portfolioMetrics`; category and selected-asset views map type to an equipment kind. | Existing `EquipmentGraphic({kind: 'grid' | 'ev' | 'home' | 'bess'})`, viewBox `0 -10 305 245`, inside category/detail equipment containers. Numeric captions and SOC gauges remain outside equipment rendering. |
| Market | `marketPriceViews` maps the unchanged 96-price fixture through the existing authoritative strategy for price-only signal classification. `MarketPriceChart` owns transient inspection state; it never changes simulation time. | `MarketPricePlot` receives typed `PricePlotView`, SVG viewBox `0 0 1180 465`. Charts remain accurate lightweight 2D financial views; no equipment or 3D renderer is needed. |
| Operations | `OperationsOverview` groups authoritative existing monitoring flags into typed `OperationsResourceView[]`. Current availability/connectivity captions and the historical dispatch summary remain outside equipment rendering. | `OperationsTopologySvg({resources})`, static SVG viewBox `0 0 1200 280` on desktop and `0 0 640 470` on mobile. It imports no business state or algorithms; schematic lines do not imply live connectivity or energy transfer. |
| Settlement | `settlementBridge` positions existing integer-cent outputs cumulatively; final net and allocation amounts remain authoritative engine outputs. `SettlementIntelligence` controls only financial presentation. | `RevenueBridgeSvg({steps: readonly BridgeStep[]})`, SVG viewBox `0 0 1000 400`, with an accessible amount list. Sharing bars encode actual rounded allocations only and are suppressed for zero/negative aggregate net. Financial charts stay 2D. |
| Analytics | `recordedEnergyPoints` selects unchanged timestamps, command/status, signed AC energy and settlement cents from the accepted analytics model. `energyPlotGeometry` calculates only pixel positions. Inspection is React-local presentation state. | `EnergyPerformanceSvg` (1080 × 410) and `TrendPlotSvg` (870 × 300) accept typed read-only inputs and callbacks, without simulation-state or engine imports. Financial/time-series charts remain 2D. Resource cards reuse the existing pure `EquipmentGraphic` boundary; a future GLB swap stays inside its dimensioned equipment container, preserving all numeric labels and controls. |
| Scenarios | `comparisonViews` selects existing operating net, terminal-adjusted comparison value and import/export. `comparisonScale` computes only chart geometry. Preset cards receive typed configurations; result and interval inspection are local presentation selections. | `ComparisonBarsSvg` and `ScenarioTimelineSvg` receive typed read-only inputs without simulation-state/engine imports. Timelines hold scenario prices over exact fifteen-minute boundaries and show existing decision/energy records only. Financial/time-series comparisons remain 2D. No equipment scene or speculative 3D placeholder is introduced. |
| Owner Portal | `ownerAssetView` copies existing asset fields to a typed read-only view; association/selection remains the accepted EV-only mapping. Monetary values and activity come from the same existing per-asset settlement rows. | `OwnerEquipmentView({kind})` wraps the existing `EquipmentGraphic` in a responsive 305:245 equipment container. A future approved GLB renderer can replace only this invocation, retaining the SVG fallback, dimensions, external SOC gauge, status labels and selection. Financial summaries and activity remain 2D; no owner records or 3D placeholder are introduced. |

`NetworkEquipment.tsx` is already a pure, typed, memoized equipment illustration implementation, independent of simulation logic. Its markup and accepted appearance were not changed. Assets table glyphs are lightweight UI icons rather than replaceable scene renderers.

Dashboard was compliant without edits. Dispatch required only extraction of its unchanged SVG markup to `DispatchSceneSvg.tsx` and a typed, memoized renderer input; accepted CSS, dimensions, flow gating, replay count/direction, equipment transforms and labels are preserved. No Dashboard or Dispatch redesign was performed.

## Future GLB integration

If separately approved, replace only the renderer invocation behind these boundaries with a lazy-loaded 3D scene, retaining the existing SVG on unsupported hardware, loading errors or constrained environments. The wrapper must retain its dimensions to avoid layout shifts. Keep domain adapters, numeric display conventions, responsive wrappers, recorded/current disclosures, keyboard controls and text alternatives unchanged.

Recommended future asset locations (documentation only):

- `public/models/vpp/substation.glb`
- `public/models/vpp/v2g-station.glb`
- `public/models/vpp/home-battery.glb`
- `public/models/vpp/bess-container.glb`

Map equipment kind to model selection. Dashboard signed recorded power and motion eligibility can control direction and bounded finite lighting; Dispatch `mode`/`active`/`replayKey` can control the same recorded replay behavior. Current SOC may drive a static visual fill using the passed existing value; do not interpolate synthetic telemetry or create another SOC store. Assets category illustrations remain static unless an actual state change warrants a restrained effect. A future renderer must not infer live connectivity or dispatch from a selected/pending command.

Three.js or React Three Fiber may be considered only in a future approved integration. No such dependencies or model files were added during this phase.

## Verification and future changes

For each visual change, run the full VPP suite, scoped lint, standalone TypeScript validation and Webpack production build. Verify renderer states, reset, replay, current versus recorded data, keyboard interaction and responsive layouts. Compare accepted Dashboard/Dispatch screenshots when touching their boundaries. Record evidence and limitations in the phase report. Phase 10B-2 verification and audit screenshots are documented in `vpp-phase-10b2-assets.md`.
