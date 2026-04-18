# Moving Load Slab App

Browser-based structural analysis app for rapid fixed-position and stepped moving-load checks on a rectangular concrete slab model.

## Documentation

- [V5 specification](./docs/v5-specification.md)
- [V4 specification](./docs/v4-specification.md)
- [V3 specification](./docs/v3-specification.md)
- [V2 specification](./docs/v2-specification.md)
- [V1 specification](./docs/v1-specification.md)
- [Benchmark reference](./docs/benchmark-reference.md)
- [Solver suitability review (2026-04-18)](./docs/2026-04-18-solver-suitability-review.md)

## Stack

- React
- TypeScript
- Vite

## Current scope

- Rectangular slab only
- Linear elastic plate analysis
- One vehicle at a time
- Fixed-position analysis workflow with live rerun
- JSON save/load
- Browser-persisted vehicle library with import/export
- Print-based PDF export with plot-aware print layout
- WebGL viewer with `Structure`, `Results 2D`, and `Deformed 3D` modes
- Mesh, support, wheel-patch, and contour display toggles
- Nodal contour rendering with docked legend
- Cursor-follow probe readout in `Structure` and `Results 2D`
- Larger support glyphs with `UZ/RX/RY` restraint chips in `Structure`
- Deformed plate view with auto-fit displacement exaggeration
- Safe error handling for invalid or under-restrained runs
- Axle-mode live travel slider covering the full vehicle crossing envelope
- Reaction summaries by support and total

## Current solver limitations

The v1 solver is a custom TypeScript 4-node Mindlin/Reissner plate element on a structured rectangular mesh with 3 DOFs per node (`w`, `rx`, `ry`). This scope is intentionally narrow and the following apply to every analysis produced by the app:

- **Pure plate bending only** — no in-plane (membrane) DOF. Composite steel–concrete decks, eccentric edge beams/parapets acting compositely, in-plane prestress, and restraint thermal/shrinkage effects cannot be modelled.
- **No beam, bar, or rigid-link elements** — kerbs, edge-stiffening beams, diaphragms, and bearing plinths are not represented. Decks must be idealised as a bare slab.
- **Structured rectangular mesh only** — skew decks, curved-in-plan decks, non-rectangular plan shapes, and local refinement under tyre patches are not supported.
- **Isotropic material only** (current build) — voided, ribbed, and orthotropic deck behaviour is not captured.
- **Point and line supports must align with mesh nodes/edges** — arbitrary bearing positions require mesh adjustment.
- **Dense direct solver** — practical up to roughly 10⁴ DOF; refined full-deck patch-load studies will be slow or run out of memory.
- **Static linear elastic only** — no dynamic amplification, no non-linear material or geometric effects.
- **Tyre patch loading** is modeled as rectangular pressure patches clipped to the slab and converted into equivalent nodal vertical loads on the structured grid; local effects under the contact patch remain mesh-dependent and should not be read as design values without refinement checks.
- **Post-processing** currently reports `w`, plate moments, and reactions. Wood–Armer reinforcement moments and moment envelopes across moving-load sweeps are not yet produced by the app.

Suitable as a screening / quick-check tool for **right (non-skew), solid RC slab decks without composite edge beams**. Any design-submission use requires independent verification against a second method and Chartered Engineer review. See the [solver suitability review](./docs/2026-04-18-solver-suitability-review.md) for a full assessment against bridge-deck use and the roadmap to lift these limitations.

## Current viewer notes

- The current viewer is WebGL-based and uses nodal contour data rather than the older cell-based SVG plot.
- `Mesh` is now an overlay toggle, not a separate plot mode.
- `Deformed 3D` shows out-of-plane slab displacement only; there are still no in-plane `ux/uy` DOFs in the solver.
- Solver/view-only controls stay separated so toggling display state does not rerun the analysis.
- If the support setup is obviously invalid or the solve produces non-finite data, the app clears the plotted result state and shows an explicit error instead of leaving stale geometry on screen.

## What Changed In V3

- Added a `Vehicle Library` panel for saving reusable vehicle definitions.
- Added `Save Current`, `Load Selected`, `Overwrite Selected`, `Duplicate Selected`, and `Delete Selected` actions.
- Added JSON export/import for the full vehicle library.
- Added duplicate-id protection and sanitization for imported vehicle library items.
- Kept the library separate from slab model JSON save/load.

## What Changed In V2

- Added debounced live auto-run and a sticky top-level `Re-run Analysis` button.
- Added an initial auto-run so the viewport starts populated.
- Added stale-run protection so older async runs cannot overwrite newer results.
- Added a live travel-axis slider for axle-mode placement.
- Reworked contour coloring into a centralized diverging scale and added a vertical legend bar.
- Added viewport padding so the slab is easier to inspect visually.
- Made `reactions` a proper result mode with support summaries, total sums, and raw nodal rows.
- Fixed mesh sizing so `target element size` now actually drives the solver mesh.
- Improved model sanitization and TypeScript/Vite build setup for the nested app repo.

## Main Interaction Notes

- Most valid input changes trigger a rerun automatically after `150 ms`.
- The manual rerun button stays visible at the top of the control panel.
- Vehicle definitions can now be saved to a browser-local library and reloaded later from the panel list.
- In axle mode, the travel direction determines whether the live slider controls vehicle `X` or `Y`, and the range allows the full vehicle to move completely across the slab.
- Hover probing follows the cursor in `Structure` and `Results 2D`; it is intentionally disabled in `Deformed 3D`.
- `Deformed 3D` uses an auto-fit base exaggeration with a user multiplier rather than a fixed absolute deformation scale.
- PDF export keeps the colour scale on the plot and moves the info panel below the plot for print.
- Reaction totals are shown by support and as a deduplicated global total.

## Run

```powershell
npm install
npm run dev
npm test
npm run build
```
