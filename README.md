# Moving Load Slab App

A browser-based structural analysis tool for rapid moving-load checks on rectangular concrete slab decks. Built for engineers who need a fast screening result, an envelope of worst-case moments, and a printable engineering note — without firing up a full FEA package.

> **Status:** Screening / quick-check tool. Not a substitute for full design FEA. See [Scope and limitations](#scope-and-limitations) before using results outside preliminary checks.

## Features

- **Linear-elastic plate analysis** of a rectangular RC slab with point and line supports.
- **Vehicle loading** in two modes:
  - Axle definition with longitudinal spacings, axle load, and wheels-per-axle.
  - Direct wheel placement with arbitrary patch sizes.
- **Live re-run** with debounced auto-analysis as inputs change.
- **Moving-load envelope** — sweep the vehicle along a path and accumulate worst-case Mxx / Myy / deflection per node.
- **Cross-section plot** along the travel axis with the current placement curve and envelope max/min curves overlaid.
- **WebGL viewer** with three modes — *Structure*, *Results 2D* (nodal contours), and *Deformed 3D* (out-of-plane displacement).
- **Cursor-follow probe** for live value readout, docked colour legend, and configurable display toggles (mesh, supports, wheel patches, contours).
- **Reaction summaries** per support and deduplicated totals.
- **Printable engineering note** (browser print → PDF) including:
  - Description, assumptions, structure & supports, vehicle loads.
  - Vehicle side-elevation diagram with axle arrows and kN labels.
  - Reactions table.
  - Longitudinal section plot with envelope curves.
  - Bending-moment plan views at **current placement** *and* at the **envelope worst stations** for Mxx and Myy.
- **Persistent vehicle library** in browser storage with JSON import/export.
- **Whole-model JSON** save/load for sharing or version control.

## Quick start

```powershell
npm install
npm run dev      # http://127.0.0.1:4173
npm test         # vitest run, ~100 tests
npm run build    # tsc + vite build, outputs to dist/
```

Production build is a static SPA — `dist/` can be served by any static host or deployed to Vercel/Netlify/Cloudflare Pages.

## Tech stack

- React 18 + TypeScript
- Vite 7 (dev server + production build)
- `@react-three/fiber` + `@react-three/drei` (WebGL viewer, Three.js under the hood)
- Vitest (unit tests, Node test environment — no jsdom)

Custom in-repo solver: a 4-node Mindlin/Reissner plate element on a structured rectangular mesh, 3 DOFs per node (`w`, `rx`, `ry`), dense direct solve.

## Project structure

```
src/
  app/                 application state, defaults, run/envelope orchestration, vehicle library
  components/          control panel, viewport host, report note, section plot, side elevation
  solver/              plate element, assembly, post-processing
  viewer/              WebGL scene (R3F): result surface, mesh overlay, supports, probe
  styles/              global CSS (incl. print rules)
  tests/               vitest suites
docs/                  specs, plans, and engineering reviews
```

## Scope and limitations

The solver is intentionally narrow. Before relying on any result, confirm your problem fits this envelope:

- **Plate bending only** — no in-plane (membrane) DOFs. Composite steel–concrete decks, eccentric edge beams acting compositely, in-plane prestress, and restraint thermal/shrinkage effects cannot be modelled.
- **No beam, bar, or rigid-link elements** — kerbs, edge-stiffening beams, diaphragms, and bearing plinths are not represented.
- **Structured rectangular mesh only** — skew decks, curved-in-plan decks, non-rectangular plan shapes, and local refinement under tyre patches are not supported.
- **Isotropic material only** — voided, ribbed, and orthotropic deck behaviour is not captured.
- **Supports align to mesh nodes/edges** — arbitrary bearing positions require mesh adjustment.
- **Dense direct solve** — practical up to ~10⁴ DOFs.
- **Static linear elastic only** — no dynamic amplification, no non-linear material or geometric effects.
- **Tyre patch loads** are clipped rectangular pressure patches converted to equivalent nodal vertical loads; local effects under the contact patch remain mesh-dependent.
- **Post-processing** reports `w`, plate moments, and reactions. Wood–Armer reinforcement moments are not yet produced.

Suitable as a screening / quick-check tool for **right (non-skew), solid RC slab decks without composite edge beams**. Any design-submission use requires independent verification against a second method and Chartered Engineer review.

See [`docs/2026-04-18-solver-suitability-review.md`](./docs/2026-04-18-solver-suitability-review.md) for a full assessment against bridge-deck use and the roadmap to lift these limitations.

## Workflow notes

- Most valid input changes trigger a re-run automatically after ~150 ms. A manual *Re-run Analysis* button sits at the top of the control panel.
- In axle mode, the travel direction sets whether the live slider controls vehicle `X` or `Y`, and the range covers the full vehicle crossing.
- *Run Envelope* sweeps the vehicle along the configured path range/step and accumulates worst-case fields. The envelope persists across input changes; if inputs that affect the envelope change, it is marked stale and a re-run is offered.
- The hover probe is enabled in *Structure* and *Results 2D*, disabled in *Deformed 3D*.
- *Deformed 3D* uses auto-fit base exaggeration × a user-controlled multiplier rather than a fixed absolute scale.
- *Export PDF (Print)* opens the browser print dialog with a print-tuned engineering note. If an envelope is available and fresh, the export re-runs analysis at the worst-Mxx and worst-Myy stations to capture additional plan views, then restores your original placement.

## Documentation

- [Solver suitability review (2026-04-18)](./docs/2026-04-18-solver-suitability-review.md)
- [Benchmark reference](./docs/benchmark-reference.md)
- Version specifications: [v5](./docs/v5-specification.md) · [v4](./docs/v4-specification.md) · [v3](./docs/v3-specification.md) · [v2](./docs/v2-specification.md) · [v1](./docs/v1-specification.md)
- Feature design notes: [V5 WebGL viewer](./docs/2026-04-17-v5-webgl-viewer.md) · [PDF envelope + vehicle elevation](./docs/2026-05-18-pdf-envelope-and-vehicle-diagram.md)

## Disclaimer

This tool is provided for engineering screening and educational use. Outputs are not a substitute for project-specific design FEA, code-compliant assessment, or independent checking by a competent Chartered Engineer. The authors accept no liability for use of the results.
