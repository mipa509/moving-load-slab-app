# Moving Load Slab App V4 Specification

This document records the next presentation-focused batch after the vehicle-library work in [v3-specification.md](./v3-specification.md).

V4 is a viewport and plotting quality pass. The goal is to make the app read more like engineering post-processing software and less like a generic web dashboard, while staying within the current browser-based 2D rendering architecture.

## 1. V4 Summary

V4 improves three areas:

- professional viewport visual language
- richer engineering plot annotation and legend treatment
- clearer separation between structure, mesh, and results views

The solver remains the same. This batch is about result presentation, workflow clarity, and trust in what is being shown.

## 2. Design Intent

The current slab result view is functional but visually soft:

- the viewport styling is too dashboard-like
- the plot metadata is under-explained
- the result layers are all presented with the same weight
- the structure view does not clearly separate geometry from post-processing

V4 should move the output toward the feel of lightweight FEA software:

- neutral plotting surface
- stronger plot frame and viewport chrome
- clearer legend ticks and engineering metadata
- visible coordinate orientation
- more deliberate layer hierarchy for slab, mesh, supports, and loads
- dedicated view modes for structure review versus result review

## 3. Implementation Checklist

The work will be implemented and committed locally in the following order:

1. Professional viewport visual system refresh
2. Engineering annotation pass for legend, axes, extrema, and metadata
3. Structure/results view modes and plotting polish
4. Final independent review pass by a review agent

Each implementation step must be:

- reviewed in code before commit
- verified with `npm test`
- verified with `npm run build`
- committed locally before moving to the next step

GitHub push is explicitly deferred until after manual live testing.

## 4. Detailed Scope

### Step 1: professional viewport visual system refresh

- Replace the current soft green dashboard treatment in the results area with a more neutral engineering presentation.
- Tighten the viewport shell, header, summary cards, and overlay styling.
- Improve contrast and hierarchy for the plot frame, slab boundary, mesh, supports, and wheel patches.
- Keep print output compatible with the refreshed styling.

### Step 2: engineering annotation pass

- Improve the legend so it reads like plot metadata rather than a decorative color bar.
- Add more explicit engineering context around the selected field, units, and range.
- Add viewport coordinate orientation cues.
- Highlight extrema in contour mode where the available data makes that reliable.
- Improve result summaries so the plot and numeric values reinforce each other.

### Step 3: structure/results view modes and plotting polish

- Add a dedicated plot mode control so the user can switch between structure-oriented review and contour-oriented review.
- Reduce visual clutter by changing which layers are emphasized in each mode.
- Refine contour presentation and slab-layer composition within the constraints of the existing SVG approach.
- Keep defaults sensible for first-time users and exported PDFs.

## 5. Constraints

- Rectangular slab geometry remains the only slab shape in scope.
- The result view remains browser-rendered and lightweight.
- This batch does not require a new solver model.
- The existing analysis fields remain:
  - `deflection`
  - `mx`
  - `my`
  - `qx`
  - `qy`
  - `reactions`

## 6. Explicitly Out of Scope

Still deferred after V4:

- full interactive 3D deformed-surface plotting
- orbit camera controls
- nodal contour recovery and high-order smoothing
- moving-load envelope plotting
- non-rectangular slab geometry
- cloud sync or GitHub publishing workflow changes
