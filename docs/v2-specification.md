# Moving Load Slab App V2 Specification

This document records the implemented v2 usability and correctness pass for the Moving Load Slab App. It sits on top of the broader product and solver context already captured in [v1-specification.md](./v1-specification.md).

## 1. V2 Summary

V2 keeps the app as a 2D browser-based slab analysis tool and improves the fixed-position workflow in the areas that were blocking day-to-day use:

- live analysis reruns for fast feedback
- clearer vehicle placement control
- clearer contour presentation
- meaningful reaction summaries
- corrected mesh-size behavior
- a less cramped plot viewport

V2 does not add a 3D viewer, moving-path envelope solver, or a new rendering library.

## 2. Implemented Changes

### Analysis trigger behavior

- The app now runs automatically after valid model edits with a `150 ms` debounce.
- The main run control remains available at the top of the control panel as a sticky `Re-run Analysis` button.
- The app performs an initial run on load so the viewport does not start empty.
- While a new run is in progress, the previous successful result stays visible rather than being cleared.
- Async run requests are versioned so stale results cannot overwrite newer ones.

### Vehicle placement UX

- Axle mode now includes a live travel-axis slider.
- The slider controls:
  - `centerXM` for `x+` and `x-` travel directions
  - `centerYM` for `y+` and `y-` travel directions
- Existing numeric placement inputs remain available for exact entry.
- Slider and numeric placement inputs stay synchronized.
- Direct-wheel mode does not expose the travel-axis slider.

### Contour presentation

- Contour coloring now uses a centralized diverging blue-light-red scale helper instead of the previous custom ad hoc interpolation.
- Mixed-sign fields are scaled symmetrically about zero so zero sits at the visual midpoint.
- Single-sign fields use the appropriate half of the same palette.
- A vertical legend bar is shown for contour fields with:
  - min value
  - max value
  - units
  - zero marker when the field crosses zero

### Viewport framing

- The viewport now adds breathing room around the slab instead of fitting the slab flush to the SVG bounds.
- Padding is based on `8%` of the larger slab dimension with a minimum of `0.5 m`.
- Supports, mesh lines, wheel patches, and contours remain in slab coordinates.

### Reactions workflow

- `reactions` is now a meaningful result mode rather than a near no-op selector.
- Reactions are aggregated by `supportId`.
- The results area now shows:
  - one support-summary table with summed `uz`, `rx`, and `ry` by support
  - one total row for global reaction sums
  - one raw nodal reaction table underneath for detailed inspection
- The reaction overlay text switches to support count and total vertical reaction information when reaction mode is selected.
- Grand totals deduplicate fixed-node overlaps at support intersections so overall totals are physically meaningful while per-support sums remain intact.

### Mesh behavior correction

- `mesh.autoTargetElementM` now drives the solver mesh directly.
- Solver mesh counts are derived as:
  - `targetElementsX = max(2, round(length / autoTargetElementM))`
  - `targetElementsY = max(2, round(width / autoTargetElementM))`
- The old `density` field is retained only for backward compatibility with saved models and UI continuity.
- The mesh UI now reports the estimated solver mesh resolution so users can see what their target size actually means.

### Validation and build/tooling updates

- Reaction rows now carry optional node/type metadata needed for accurate aggregation.
- Model sanitization now falls back safely when malformed support arrays are loaded.
- TypeScript/Vite project configuration was updated so the nested app repo builds cleanly.
- `@types/node` was added as a dev dependency to support the Vite config build path.

## 3. Public Interface Changes

### AnalysisResults additions

`AnalysisResults` now includes:

- `reactionSummaryBySupport`
- `reactionTotals`

These expose aggregated reaction values for the UI without recomputing them inside presentation components.

### ReactionRow additions

`ReactionRow` now supports:

- `nodeId`
- `type`

These fields are used for aggregation and total-deduplication logic.

### Mesh interpretation

`MeshSettings.autoTargetElementM` is now the authoritative meshing input for app-driven runs.

## 4. Verification Completed

The following checks were added or updated and are passing:

- mesh-size derivation tests
- reaction aggregation tests
- contour scale tests
- vehicle slider-axis mapping tests
- solver adapter tests
- solver smoke test
- full app test suite
- production build

Implementation was verified with:

- `npm test`
- `npm run build`

## 5. Current Out of Scope

Still deferred after v2:

- interactive 3D plot view
- rotating camera controls
- stepped moving-load envelope workflow
- palette switching in the UI
- arbitrary non-rectangular slab geometry
