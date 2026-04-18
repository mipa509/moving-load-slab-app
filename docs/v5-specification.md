# Moving Load Slab App V5 Specification

This document records the next major plotting and viewer architecture batch after
[v4-specification.md](./v4-specification.md).

V5 is not a styling pass. It is a rendering and interaction upgrade intended to move the
viewport from a browser SVG diagram toward a modern, professional FEA post-processing viewer.

## 1. V5 Summary

V5 replaces the current SVG-first contour viewport with a GPU-accelerated viewer that supports:

- smoother contour presentation from nodal or corner-based field values
- dedicated structure, mesh, results, and deformed-shape views
- zoom, pan, orbit, fit, and reset camera controls
- probe-style inspection of values under the cursor
- docked legend, toolbar, and status presentation that do not cover the plot
- a more technical and credible engineering visual language

The target is a lightweight browser FEA viewer rather than a generic web dashboard.

## 2. Why V5 Exists

The current viewport has reached the limit of what is reasonable with the present SVG approach.

Current limitations:

- contour fields are still rendered as flat cell rectangles
- contour values are tied to sampled element-centre output
- the viewer has no true deformed-surface mode
- interaction is limited and does not feel like engineering software
- presentation improvements help, but they do not solve the core rendering problem

V5 exists to solve the plotting problem at the architecture level rather than by adding more
surface-level UI polish.

## 3. Technical Direction

### 3.1 Options reviewed

#### Option A: `three.js` + `@react-three/fiber` + `@react-three/drei`

Pros:

- strongest fit for the existing React app
- one WebGL rendering stack can support both 2D plan views and 3D deformed views
- direct access to custom geometry, custom materials, cameras, picking, and interaction
- good path to smooth contour shading, mesh overlays, and orbit controls
- React Three Fiber integrates cleanly with React state and component structure

Cons:

- requires deliberate viewer architecture rather than simple chart configuration
- custom engineering plot features still need to be built by us

#### Option B: `vtk.js`

Pros:

- serious scientific-visualization library
- strong fit for web scientific graphics and rendering pipelines
- credible alternative if we want a more VTK-like visualization stack

Cons:

- heavier mental model for this small app
- less natural fit for the current codebase than React Three Fiber
- likely more effort than needed for a slab viewer with custom app UI

#### Option C: `PixiJS`

Pros:

- excellent high-performance 2D GPU rendering
- suitable for heatmaps, overlays, and large numbers of graphical elements
- could produce a very strong 2D contour viewer

Cons:

- weaker as a single-stack answer because V5 also needs a real 3D deformed view
- would likely lead to a split architecture if we later add `three.js` anyway

#### Option D: high-level chart libraries such as `Plotly` or `ECharts`

Pros:

- fast to get standard charts onto the screen
- useful reference point for legends, contours, and interaction patterns

Cons:

- too chart-oriented for a custom engineering viewport
- not the right base for mesh-aware picking, support glyphs, wheel patches, and a true slab
  viewer
- likely to constrain the product to the library's chart model rather than our domain model

### 3.2 Decision

V5 will use:

- `three.js`
- `@react-three/fiber`
- `@react-three/drei`

as the primary plotting stack.

The viewer should stay WebGL-based, with DOM used only for:

- docked legends
- toolbars
- status readouts
- tables and supporting UI

`vtk.js` remains a credible alternative, but not the recommended first implementation for this
project.

## 4. Product Goals

V5 should make the viewer feel like lightweight engineering software rather than a web demo.

The viewer should communicate:

- technical precision
- legibility under load
- trust in what is being shown
- immediate access to inspection tools
- clean separation between geometry review and result review

## 5. Functional Scope

### 5.1 View modes

The viewer must support the following modes:

- `Structure`
- `Mesh`
- `Results 2D`
- `Deformed 3D`

Expected behavior:

- `Structure` emphasizes slab outline, supports, and wheel patches
- `Mesh` emphasizes solver discretization and support alignment
- `Results 2D` shows smooth field contours in plan view
- `Deformed 3D` shows z-scaled deflected shape with result colouring

### 5.2 Interaction tools

The viewer must support:

- zoom in and out
- pan in plan view
- orbit in 3D view
- fit to model
- reset view
- hover probe for position and field value
- optional jump-to-min and jump-to-max
- deformation scale control for 3D mode

### 5.3 Plot features

The plot layer must support:

- smooth contours from nodal or corner values
- engineering legend with readable ticks and units
- optional contour isolines
- mesh overlay toggle
- support toggle
- wheel patch toggle
- extrema markers
- consistent axis orientation cues
- better depth cues for the 3D result surface

### 5.4 Layout requirements

The plot layout must move away from overlapping floating cards.

Required layout behavior:

- legend is docked, not covering critical plot area
- toolbar is compact and plot-focused
- viewport status is outside the plot drawing area
- plot chrome is restrained and technical
- exported output remains clean in PDF/print form

## 6. Data and Solver Requirements

V5 depends on better field data than the current cell-centre contour payload.

The solver/post-processing path must be upgraded to provide one of:

- nodal field values, preferred
- element-corner field values, acceptable first step

This is required for professional-looking contour interpolation.

Additional data requirements:

- mesh connectivity suitable for indexed triangle rendering
- result metadata per field, including units and min/max
- stable mapping between displayed geometry and returned result values
- display-only state kept separate from solver-driving state so view changes do not rerun analysis

## 7. Rendering Architecture

### 7.1 Core viewer approach

The viewer should move to a dedicated `src/viewer` area and stop treating the viewport as a single
large SVG component.

Indicative structure:

- `src/viewer/ViewerCanvas.tsx`
- `src/viewer/ViewerToolbar.tsx`
- `src/viewer/LegendDock.tsx`
- `src/viewer/scene/SlabScene.tsx`
- `src/viewer/scene/ResultSurface.tsx`
- `src/viewer/scene/StructureOverlay.tsx`
- `src/viewer/scene/SupportGlyphs.tsx`
- `src/viewer/scene/WheelPatchLayer.tsx`
- `src/viewer/hooks/useViewerState.ts`
- `src/viewer/math/interpolateField.ts`
- `src/viewer/math/buildSurfaceGeometry.ts`

The exact filenames may change, but the separation of concerns should not.

### 7.2 Geometry strategy

The slab surface should be built as indexed triangle geometry rather than a collection of SVG
rectangles.

Initial approach:

- build `BufferGeometry` from mesh node coordinates and triangle indices
- attach per-vertex field values or derived per-vertex colours
- render the slab as a mesh in top view and deformed view

### 7.3 Colouring strategy

Phase 1 colouring:

- per-vertex colour interpolation across triangles
- smooth field appearance without fake blur

Phase 2 colouring:

- shader-based contour bands
- optional isolines
- more control over anti-aliasing, banding, and legend consistency

### 7.4 2D and 3D camera strategy

Use one rendering stack with different camera modes:

- orthographic top camera for `Structure`, `Mesh`, and `Results 2D`
- perspective camera with orbit controls for `Deformed 3D`

This avoids maintaining separate plotting engines for 2D and 3D.

### 7.5 Interaction strategy

Interaction should be scene-aware rather than DOM-fragment-aware.

Expected implementation:

- pointer picking based on geometry intersection
- probe readout from nearest node, interpolated triangle value, or both
- view state stored independently from the analysis model

## 8. Visual Direction

The target look is:

- neutral background
- crisp edges
- restrained colour usage
- clear hierarchy between field, mesh, supports, and loads
- stronger typography than the current dashboard treatment
- more deliberate technical framing, less decorative card styling

The viewer should feel closer to post-processing software and less like a KPI panel.

## 9. Implementation Sequence

V5 should be delivered in the following order:

1. Viewer technology spike and dependency introduction
2. Result data upgrade from element-centre output to nodal or corner output
3. New WebGL viewer shell with docked legend and toolbar
4. Smooth `Results 2D` contour mode
5. `Structure` and `Mesh` modes on the new renderer
6. `Deformed 3D` mode with controllable exaggeration
7. Probe, extrema navigation, and interaction polish
8. Export and print verification
9. Final independent review pass

Each implementation step must be:

- reviewed before commit
- verified with `npm test`
- verified with `npm run build`
- committed locally before moving to the next step

GitHub push remains deferred until after manual live testing.

## 10. Acceptance Criteria

V5 is only complete when all of the following are true:

- contour fields are no longer rendered as per-cell SVG rectangles
- the main viewer is WebGL-based rather than SVG-based
- the legend is clearly readable without covering the plot
- the user can switch cleanly between `Structure`, `Mesh`, `Results 2D`, and `Deformed 3D`
- view-only controls do not rerun the solver
- the result view looks materially more modern and professional than V4
- exported output remains understandable and visually coherent

## 11. Risks and Mitigations

### Risk: nodal contour recovery is more involved than expected

Mitigation:

- allow element-corner recovery as an intermediate step
- keep field interpolation logic isolated from the UI layer

### Risk: viewer complexity grows too quickly

Mitigation:

- keep a dedicated viewer module boundary
- avoid mixing viewer math, DOM UI, and solver adaptation in one component

### Risk: performance regressions on larger meshes

Mitigation:

- use indexed geometry and typed arrays
- verify interaction and render cost during the early spike phase

## 12. Explicitly Out of Scope

Still out of scope after V5 unless explicitly reopened:

- full solid-element or volumetric post-processing
- non-rectangular slab geometry
- multiple slab panels in one model
- remote rendering
- server-side visualization pipelines
- a full CAD-style model tree or scene graph editor
