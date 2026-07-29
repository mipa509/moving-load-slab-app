# Moving Load Slab App

A browser-based structural analysis tool for rapid moving-load checks on concrete slab decks. Built for engineers who need a fast screening result, an envelope of worst-case moments, and a printable engineering note — without firing up a full FEA package.

> **Status:** Screening / quick-check tool. Not a substitute for full design FEA. See [Scope and limitations](#scope-and-limitations) before using results outside preliminary checks.
>
> **Skew (non-rectangular plan) analysis is experimental and screening-only.** The unified solver now analyses plan-skewed decks (rectangular is the `skew angle = 0` case), but non-zero-skew results have **not** completed independent numerical verification and carry a mandatory in-app experimental warning. Do not use non-zero-skew results for design. See [`docs/skew-verification-status.md`](./docs/skew-verification-status.md).

## Features

- **Linear-elastic plate analysis** of an RC slab with point, line, and (skew) edge supports.
- **Plan-skew geometry** *(experimental)* — a skew-angle input with fixed-fixed / pinned-pinned boundary presets and user-creatable deck-edge supports; rectangular is the `skew angle = 0` case of the same solver.
- **Vehicle loading** in two modes:
  - Axle definition with longitudinal spacings, axle load, and wheels-per-axle.
  - Direct wheel placement with arbitrary patch sizes.
- **Live re-run** with debounced auto-analysis as inputs change.
- **Moving-load envelope** — sweep the vehicle along a path and accumulate worst-case Mxx / Myy / **Mxy** / deflection per node, with skew-aware entry/exit travel bounds and worst-station capture.
- **Result fields** — deflection, `Mx`, `My`, `Mxy` (twisting moment), `Qx`, `Qy`, and reactions, as nodal contours.
- **Cross-section plots** — a global-XY section along the travel axis (current + envelope curves) *and* a deck-local (s/t) section that follows the skewed deck.
- **WebGL viewer** with three modes — *Structure*, *Results 2D* (nodal contours), and *Deformed 3D* (out-of-plane displacement) — polygon-aware framing, probe, and overlays for skewed decks.
- **Cursor-follow probe** for live value readout, docked colour legend, and configurable display toggles (mesh, supports, wheel patches, contours).
- **Reaction summaries** per support and deduplicated totals.
- **Skew-evidence diagnostics** — signed-equilibrium residuals, mesh-quality status, and three separately reported verification statuses (formulation / stored 19° reference study / current-model convergence), with an experimental banner on non-zero skew.
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
npm run dev      # Vite dev server, http://localhost:5173
npm test         # vitest run (~520 tests)
npm run build    # tsc -b + vite build, outputs to dist/
npm run preview  # serve the production build, http://localhost:4173
```

Production build is a static SPA — `dist/` can be served by any static host or deployed to Vercel/Netlify/Cloudflare Pages.

## Tech stack

- React 18 + TypeScript
- Vite 7 (dev server + production build)
- `@react-three/fiber` + `@react-three/drei` (WebGL viewer, Three.js under the hood)
- Vitest (unit tests, Node test environment — no jsdom)

Custom in-repo solver: a 4-node **MITC4** Mindlin/Reissner plate element (assumed transverse-shear strain, mitigating shear locking) on a structured mesh mapped to the deck geometry, 3 DOFs per node (`w`, `rx`, `ry`), solved with a **sparse conjugate-gradient** solver. Rectangular and skew decks use the same unified path — a skew deck is the sheared (`skew angle ≠ 0`) case of the same element and assembly.

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
- **Structured mesh only** — a plan-**skew** deck is supported *(experimental, screening-only — see below)* as a sheared structured mesh, but curved-in-plan decks, general non-rectangular / non-parallelogram plan shapes, and local refinement under tyre patches are not supported.
- **High skew degrades the mesh** — the sheared quadrilateral mesh becomes increasingly distorted as skew grows (interior angles `90° ± skew`), and established practice moves to triangular/mixed meshing around 30–35°. This tool has no triangular mesh: an advisory fires at skew ≥ 30° and results there are very rough screening only. Note the internal mesh-quality "OK" is not an accuracy claim — it only flags *severe* distortion (≈ 60°+). See [`docs/skew-verification-status.md`](./docs/skew-verification-status.md).
- **Isotropic material only** — voided, ribbed, and orthotropic deck behaviour is not captured.
- **Supports align to mesh nodes/edges** — arbitrary bearing positions require mesh adjustment.
- **Dense direct solve** — practical up to ~10⁴ DOFs.
- **Static linear elastic only** — no dynamic amplification, no non-linear material or geometric effects.
- **Tyre patch loads** are clipped rectangular pressure patches converted to equivalent nodal vertical loads; local effects under the contact patch remain mesh-dependent.
- **Post-processing** reports `w`, plate moments, and reactions. Wood–Armer reinforcement moments are not yet produced.

Suitable as a screening / quick-check tool for **right (non-skew), solid RC slab decks without composite edge beams**. **Plan-skew analysis is experimental and screening-only:** non-zero-skew results are not independently verified, carry a mandatory in-app warning, and must not be used for design. Any design-submission use (skew or not) requires independent verification against a second method and Chartered Engineer review.

### High-skew roadmap

Rather than add a triangular/mixed-element mesher to this app to reach high skew, the moving-load capability (vehicle + wheel-patch loads, the moving-load envelope sweep, and the section / reaction / contour plots) is being **ported onto a separate app, Anax** — Python, with **gmsh** unstructured meshing and an **OpenSeesPy** solver — which handles general / skew / irregular plan geometry natively. This app remains the rectangular / low-skew screening tool; the high-skew moving-load work continues in the Anax repository (new branch), where the detailed port plan lives.

See [`docs/2026-04-18-solver-suitability-review.md`](./docs/2026-04-18-solver-suitability-review.md) for the bridge-deck assessment, and [`docs/skew-verification-status.md`](./docs/skew-verification-status.md) for the precise implemented / provisional / deferred / verified breakdown of the skew capability.

## Workflow notes

- Most valid input changes trigger a re-run automatically after ~150 ms. A manual *Re-run Analysis* button sits at the top of the control panel.
- In axle mode, the travel direction sets whether the live slider controls vehicle `X` or `Y`, and the range covers the full vehicle crossing.
- *Run Envelope* sweeps the vehicle along the configured path range/step and accumulates worst-case fields. The envelope persists across input changes; if inputs that affect the envelope change, it is marked stale and a re-run is offered.
- The hover probe is enabled in *Structure* and *Results 2D*, disabled in *Deformed 3D*.
- *Deformed 3D* uses auto-fit base exaggeration × a user-controlled multiplier rather than a fixed absolute scale.
- *Export PDF (Print)* opens the browser print dialog with a print-tuned engineering note. If an envelope is available and fresh, the export re-runs analysis at the worst-Mxx and worst-Myy stations to capture additional plan views, then restores your original placement.

## Documentation

- [Solver suitability review (2026-04-18)](./docs/2026-04-18-solver-suitability-review.md) — incl. the skew-analysis addendum
- **Skew analysis:** [verification status](./docs/skew-verification-status.md) · [implementation status ledger](./docs/skew-implementation-status.md) · [implementation plan](./docs/2026-07-21-skew-plate-analysis-implementation-plan.md)
- [Benchmark reference](./docs/benchmark-reference.md)
- Version specifications: [v5](./docs/v5-specification.md) · [v4](./docs/v4-specification.md) · [v3](./docs/v3-specification.md) · [v2](./docs/v2-specification.md) · [v1](./docs/v1-specification.md)
- Feature design notes: [V5 WebGL viewer](./docs/2026-04-17-v5-webgl-viewer.md) · [PDF envelope + vehicle elevation](./docs/2026-05-18-pdf-envelope-and-vehicle-diagram.md)

## Disclaimer

This tool is provided for engineering screening and educational use. Outputs are not a substitute for project-specific design FEA, code-compliant assessment, or independent checking by a competent Chartered Engineer. The authors accept no liability for use of the results.
