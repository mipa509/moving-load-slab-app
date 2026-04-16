# 1. Reference Audit

## Transfer slab notebook

Relevant reusable ideas from `transfer_slab_design.ipynb`:

- The PyNite plate model is the correct benchmark reference for this app, not the preliminary strip model.
- Vehicle definition is stored as reusable data rather than embedded in analysis code.
- Wheel patches are applied directly over the slab plan area rather than converted into equivalent beam loads.
- The notebook uses a structured rectangular mesh with forced control lines at support positions.
- Reaction equilibrium is checked explicitly. The executed notebook output shows:
  - `Expected ULS total load = 2583.3 kN`
  - `Case A sum reactions = 2583.3 kN`
  - `Case B sum reactions = 2583.3 kN`
- The benchmark reference cases are narrow and useful:
  - Case A: span-1 midspan bending reference
  - Case B: near-support shear reference
- The executed notebook output also provides useful comparison values:
  - Case A plate `Mx min = -303.3 kNm/m`
  - Case A plate `Mx max = 240.2 kNm/m`
  - Case B centreline `max |Qx| = 310.1 kN/m`
- The support review is transparent and simple. Support lines carry only vertical restraint in the plate model, and separate anchor nodes are used only because PyNite includes in-plane DOFs. That anchoring issue disappears in a plate-bending-only browser model.

Implications for v1:

- Use wheel patches as the native load representation.
- Preserve a reusable vehicle registry and an axle-builder workflow.
- Preserve reaction-balance checks in tests and benchmark fixtures.
- Preserve a structured mesh with forced support coordinates.

## Gmsh notebook

Relevant reusable ideas from `06_gmsh_mesh_test.ipynb`:

- Geometry, support, and load points should be verified against the mesh, not assumed.
- Mesh plots should overlay supports and load points for trust.
- Local refinement around supports and load points is possible, but the notebook exists because geometry is irregular.

Not reusable for v1:

- Gmsh itself is not needed for a rectangular slab with no openings.
- Unstructured meshing adds complexity without helping the defined MVP.

Implications for v1:

- Keep the mesher custom and structured.
- Keep explicit node/support snapping and verification summaries.
- Defer unstructured meshing, local point refinement fields, and arbitrary openings.

## Browser FEA app reference

Relevant reusable ideas from `C:\awatif`:

- Reactive pipeline shape is good: model inputs -> mesh -> loads/supports -> analysis -> viewer.
- Simple control-first interaction is good for design meetings and quick engineering checks.
- Display toggles are a must-have for trust and clarity.
- Moving-load controls in the existing beam example show the right UX pattern:
  - axle load
  - axle spacing
  - axle count
  - lead position
  - off-domain load positions are simply ignored
- Viewer and result layering are well separated from the analysis core.

Not reusable for v1:

- The existing solver is a line-element solver, not a plate solver.
- The 3D viewer style is heavier than this app needs.
- VanJS is not aligned with the preferred stack for this app.

Implications for v1:

- Keep the reactive architecture.
- Use React rather than copying the existing UI framework.
- Use a 2D slab-plan viewer rather than a general 3D structural scene.

# 2. Feature Brainstorm

## Must-have v1

- Rectangular slab only.
- Linear elastic isotropic plate-bending solver.
- Constant slab thickness.
- Structured rectangular mesh with user mesh-density slider.
- Point supports and line supports.
- Support behavior per relevant plate-bending DOF:
  - pinned: `w` fixed, rotations free
  - fixed: `w`, `rx`, `ry` fixed
  - spring: translational and optional rotational springs
- One vehicle at a time.
- Direct wheel input.
- Axle-based vehicle builder as the default workflow.
- Fixed-position analysis.
- Result outputs:
  - deflection
  - `Mx`, `My`
  - `Qx`, `Qy`
  - reactions
- Visualization toggles:
  - mesh
  - supports
  - wheel patches
  - contours
  - tables
- JSON save/load.
- PDF summary export.
- Clear units and sign conventions.

## Nice-to-have in the first build if time remains

- Straight-path stepped movement using the same solver factorization.
- Envelope extraction for one selected result component.
- Multiple saved vehicle templates.
- Reaction grouping by support object as well as by node.
- Result cursor probe for element-center values.

## Deferred

- Openings.
- Arbitrary support orientation.
- Arbitrary vehicle path angle.
- Multiple simultaneous vehicles.
- Nonlinear behavior.
- Cracked-section stiffness reduction.
- True dynamics.
- Optimization and automated worst-position search.
- Design-code checks.
- Multi-user or cloud features.
- CAD import.

## Explicit MVP conflict resolution

- `Gmsh` and arbitrary geometry are cut because the slab is rectangular in v1.
- Arbitrary path angle is cut because axis-aligned movement preserves speed, keeps patch clipping exact, and materially reduces implementation risk.
- Movement and envelopes are phased after fixed-position analysis so the solver core and trust model can be verified first.
- The app is not a bridge platform. It is one slab, one vehicle, one straight axis-aligned path, elastic analysis only.

# 3. Recommended Solver Strategy

## Recommendation

Use a custom browser-native TypeScript plate solver for v1 with these characteristics:

- Structured rectangular mesh only.
- 4-node Mindlin/Reissner plate element.
- Three DOFs per node: `w`, `rx`, `ry`.
- Dense symmetric assembly and direct solve for the initial release.
- Factorize the stiffness matrix once per model and reuse it for each load case or movement step.
- Run the solve in a Web Worker so the UI stays responsive.

## Why this is the right production choice

- It is fast enough for the stated target problem sizes.
- It is narrow enough to verify properly.
- It avoids shipping Python, Pyodide, or a general FE kernel into the browser.
- It keeps the solver explainable and maintainable by a small engineering team.
- It is better aligned with browser performance than trying to replicate PyNite in-browser.

## Rejected alternatives

### PyNite in production

Rejected because:

- It is Python-first rather than browser-first.
- It adds runtime weight and deployment friction in the browser.
- Matching PyNite internals is not the real goal; fast trustworthy slab results are.

### Pyodide or Python-in-browser

Rejected because:

- Startup cost is too high for a meeting tool.
- Package compatibility and performance are weaker than a narrow native TS core.
- It complicates bundling, debugging, and offline use.

### WebAssembly-first production kernel

Deferred, not rejected.

Reason:

- It may become useful later if the mesh limit or sweep performance proves insufficient.
- It is not the simplest credible v1.
- The right architecture is to keep a `LinearSolver` abstraction so the matrix-solve backend can be replaced later without rewriting the UI or model layer.

### General-purpose JS FE libraries

Rejected because:

- Plate-bending coverage is limited or not well aligned with this use case.
- Verification burden stays high even if some code is reused.
- A narrow custom slab solver is lower risk than forcing a generic library into a specialist workflow.

# 4. Full Specification

## Product summary

The app is a browser-based analysis tool for quick elastic moving-load checks on a single rectangular concrete slab. It is intended for concept design, internal engineering discussions, and rapid option checking. The product goal is speed first and trust second, with trust delivered through transparency, clear sign conventions, and a small benchmark suite rather than through a heavy verification workflow in every run.

## User workflow

1. Define slab geometry, thickness, material, mesh density, and supports.
2. Define a vehicle from a saved template, axle builder, or direct wheel input.
3. Define a fixed position, then optionally a straight stepped path in a later milestone.
4. Run analysis.
5. Review contours, reactions, and summary values.
6. Save or reload the model as JSON.
7. Export a PDF summary.

## Solver assumptions

- Linear elastic isotropic slab.
- Constant thickness.
- Plate-bending response only.
- No membrane action in v1.
- Plate formulation uses `w`, `rx`, `ry`.
- Relevant support DOFs are therefore:
  - vertical translation `w`
  - rotation about slab local `x`
  - rotation about slab local `y`
- Shear deformation is included using a Mindlin/Reissner formulation.
- One vehicle only.
- Static analysis only.

## Geometry and meshing

- Slab geometry:
  - `length`
  - `width`
  - `thickness`
- Material:
  - `E`
  - `nu`
  - optional `density` for self-weight
- Mesh:
  - user controls density through a slider
  - solver builds a structured rectangular mesh
  - exact support and point-support coordinates are injected as control lines
  - default target is approximately 10 divisions along the long side

## Support model

### Line supports

- Axis-aligned only in v1.
- Defined by start and end coordinates.
- Supported behaviors:
  - pinned
  - fixed
  - spring

### Point supports

- Defined by exact point coordinates.
- Same restraint options as line supports for the relevant DOFs.

### Support springs

- `kw` mandatory for translational spring supports.
- `krx` and `kry` optional for rotational spring supports.

## Vehicle and load model

### Primary workflow: axle builder

Vehicle definition includes:

- vehicle name
- wheel patch width
- wheel patch length
- wheel track or transverse wheel spacing
- wheels per axle
- axle count
- axle loads
- axle spacing
- travel direction

The builder converts the vehicle into explicit wheel patches before load application.

### Secondary workflow: direct wheel input

- Explicit list of wheel patches with center, size, and load.

### Placement

Fixed-position placement in v1 includes:

- travel direction: `+x`, `-x`, `+y`, `-y`
- longitudinal reference position
- transverse offset

Movement architecture reserved for the next milestone:

- start position
- end position
- step size

### Load application

- Each wheel patch is clipped against the slab and against each intersected element.
- Patch force is distributed by consistent nodal loading over the intersected sub-area.
- Wheels partly outside the slab are allowed without warning by default.

## Results

### Primary plotted fields

- vertical deflection
- `Mx`
- `My`
- `Qx`
- `Qy`

### Tables

- nodal reactions
- support-group reactions
- max/min result summary

### Sign conventions

The UI must show a fixed sign-convention panel. Initial v1 convention:

- deflection, rotations, moments, and shears are shown using the solver local sign convention exactly as computed
- the sign note must be displayed in the result view and PDF
- `Mx`, `My`, `Mxy`, `Qx`, and `Qy` are not re-signed for code-design conventions in v1

The exact convention text must be displayed beside results and in the PDF.

## UX

- Desktop-first control layout with a persistent analysis panel.
- Plan-view result viewport.
- Layer toggles for:
  - mesh
  - supports
  - wheel patches
  - contour field
  - tables
- One-click run button.
- Visible solve status.
- Benchmark or analysis metadata area showing:
  - mesh size
  - element count
  - solve time
  - total applied load
  - total reaction
  - equilibrium error

## Visualization approach

- React UI.
- 2D canvas plan-view renderer.
- Contours shown as per-element filled rectangles in v1.
- Optional overlays:
  - mesh lines
  - support symbols
  - wheel-patch rectangles
- Numeric tables rendered in HTML.

## Data model

Core persisted model includes:

- slab geometry
- material
- mesh settings
- supports
- vehicle library item or ad hoc vehicle
- load placement
- selected analysis mode
- display settings

Results are not persisted by default in the JSON model file.

## Verification strategy

- Hand-check simple plate cases.
- Compare selected reference cases against the PyNite benchmark notebook.
- Maintain approximately `5%` tolerance on chosen comparison outputs.
- Always check equilibrium:
  - sum of applied load
  - sum of reactions
- Use the transfer slab case outputs as seeded reference data in the test suite.

## Testing strategy

- Unit tests:
  - mesh generation
  - support snapping
  - patch overlap clipping
  - element stiffness symmetry
  - reaction equilibrium
- Solver smoke tests:
  - uniform load on a simple supported slab
  - fixed-position vehicle load on a simple slab
- Benchmark tests:
  - transfer slab Case A metadata and expected magnitude range
  - transfer slab Case B metadata and expected magnitude range

## Export requirements

### JSON

- Save current model to a local `.json` file.
- Load a saved `.json` file back into the app.

### PDF

- v1 uses a browser-print summary page or print stylesheet.
- Summary includes:
  - model inputs
  - support summary
  - vehicle summary
  - selected result plots
  - max/min table
  - reaction table
  - sign-convention note

# 5. Implementation Plan

## Milestone 1: fixed-position analysis vertical slice

- Create React/Vite shell.
- Define domain types and persisted model schema.
- Build structured slab mesher with support control lines.
- Implement support mapping.
- Implement axle-builder to wheel-patch conversion.
- Implement axis-aligned patch clipping and nodal load assembly.
- Implement fixed-position plate solve and reaction balance.
- Render one contour field and one reaction table.
- Add JSON save/load.

Exit criteria:

- A user can build a slab, place one vehicle in one position, run the model, and inspect deflection plus one bending/shear field and reactions.

## Milestone 2: result presentation hardening

- Add remaining contour fields.
- Add overlay toggles.
- Add support grouping table.
- Add sign-convention panel.
- Add print-to-PDF summary.
- Add benchmark view or benchmark fixture switch.

Exit criteria:

- The app feels usable in an engineering meeting and exports a readable PDF summary.

## Milestone 3: stepped movement and envelopes

- Reuse the factored stiffness matrix.
- Add stepped path controls.
- Add sweep run progress UI.
- Add max/min envelope extraction.

Exit criteria:

- A user can run a straight stepped sweep in seconds for the target mesh size.

## Dependency order

1. Domain model.
2. Structured mesher.
3. Support and vehicle builders.
4. Plate stiffness and solver.
5. Result recovery.
6. Viewer.
7. Persistence and export.
8. Sweep/envelopes.

## Benchmark checkpoints

- Checkpoint A:
  - reactions equal applied load within tight equilibrium tolerance
- Checkpoint B:
  - benchmark case magnitudes align with PyNite reference values within target tolerance
- Checkpoint C:
  - solve time acceptable on default mesh

# 6. Subagent Task Breakdown

## Main agent

- Owns product decisions.
- Owns solver strategy.
- Owns written specification.
- Owns repo structure and integration review.
- Owns final benchmark acceptance and milestone sequencing.

## Worker A: solver core

Write scope:

- `src/solver/**`

Responsibilities:

- domain types
- structured mesher
- support mapping
- wheel-patch loading
- plate element and solve
- result recovery
- benchmark fixtures

## Worker B: React/UI shell

Write scope:

- `src/app/**`
- `src/components/**`
- `src/styles/**`
- `src/main.tsx`

Responsibilities:

- app layout
- control panel
- viewport
- result tables
- display toggles
- JSON and PDF UI hooks

## Main-agent integration pass

- connect UI to solver entry point
- close type gaps
- review assumptions
- sync to the real target folder under `C:\MyEngineering\04-Apps`

# 7. Risks, Assumptions, and Open Questions

## Risks

- A dense direct solver may become too slow if mesh limits are allowed to grow without restraint.
- Plate-shear recovery can be noisy if users expect fine local peaks from a coarse mesh.
- Rotational spring interpretation must be documented clearly to avoid engineering misuse.
- If users need arbitrary path angle or diagonal supports, the structured v1 mesh will become a constraint quickly.

## Assumptions

- Axis-aligned support lines are acceptable for v1.
- Axis-aligned travel directions are acceptable for the first delivered movement workflow.
- Fixed-position analysis is the first shipped capability.
- A print-based PDF workflow is acceptable for v1.
- A benchmark tolerance of about `5%` is acceptable for selected cases.

## Open questions

- Should self-weight be on by default in v1 or opt-in?
- Should reactions be grouped strictly by support object, by node, or both by default?
- Should the default vehicle builder assume `2` wheels per axle or expose that choice every time?
