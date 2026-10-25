<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## VPP visualization architecture

All VPP visual development must follow `docs/vpp-visualization-architecture.md`.
Keep equipment renderers separate from domain calculations and shared state; pass
typed, read-only presentation inputs across replaceable renderer boundaries.
SVG remains the default renderer and the fallback for future GLB loading failures,
unsupported devices, or constrained performance. Preserve layout, dimensions,
responsive behavior, accessibility, bindings and interactions when refactoring.
Do not install 3D dependencies, create empty model placeholders, or implement
Blender/GLB integration without explicit approval. Accepted Dashboard and Dispatch
visuals must not be redesigned during architecture-only work.
