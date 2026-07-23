# Skew Plate Analysis — Detailed Parallel Implementation Plan

**Date:** 21 July 2026  
**Application:** Moving Load Slab App  
**Primary target:** Single-span, solid isotropic slab deck with a 19° plan skew and fully restrained skew end lines  
**Plan owner:** Lead/integrator  
**Status:** Implementation-ready planning baseline; numerical verification and independent engineering review remain mandatory  
**Release status:** Non-zero-skew analysis must remain experimental/screening-only until every release gate in this plan passes

## 1. Purpose

This document turns the approved skew-analysis basis into small, dependency-controlled work packages that can be delegated to fresh agents without loading the full repository or exhausting a 256k-token context window.

It is both the technical implementation plan and the delivery-control document for the lead agent, implementation agents, numerical reviewers, and final Chartered Engineer reviewer. Mathematical conventions, element stability, executable baselines, and shared data contracts deliberately precede feature coding.

## 2. Executive decisions

### 2.1 Included in the first skew release

- An affine parallelogram plate with user-defined `skewAngleDeg`.
- Three plate-bending DOFs per node and no membrane DOFs.
- Edge-attached start/end supports, with fixed and pinned presets.
- Fixed and moving rectangular wheel-pressure patches integrated over actual deck and element polygons.
- Raw global bending, twisting, shear, deflection, and restrained-DOF reactions.
- Deck-coordinate longitudinal and transverse sections.
- Existing zero-skew behaviour preserved within recorded numerical tolerances.
- Signed vertical-force and global x/y moment equilibrium diagnostics.
- A visible experimental warning until all release evidence is complete.

### 2.2 Explicitly out of scope

- Membrane action or a general shell formulation.
- Integral-abutment soil, wall, thermal, shrinkage, or staged-construction effects.
- Eccentric edge beams, diaphragms, rigid links, composite action, or orthotropy.
- Curved/non-convex plans or a general unstructured mesher.
- Local through-thickness stresses.
- Arbitrary wheel-heading rotation beyond the existing axis-direction contract.
- Arbitrary global result cuts as a release requirement.
- Wood–Armer design moments.
- New code-compliant traffic-load generation.

`skewAngleDeg` is structural geometry and must never reuse the vehicle `headingDeg`. That heading is currently not a solver source for arbitrary patch rotation; this feature must not silently change that behaviour.

### 2.3 Gate 0 decisions

Before parallel coding, freeze:

1. the physical meaning and positive sign of both nodal rotation/slope DOFs;
2. their virtual-work relationship to restrained generalized moments;
3. applied load, displacement, shear, moment, twisting, and reaction signs;
4. polygon winding and tolerance rules;
5. app, solver, mesh, support, patch, result, equilibrium, and section contracts;
6. reaction attribution where multiple supports restrain one global DOF;
7. minimum section modes;
8. scaled numerical acceptance metrics; and
9. the warning-removal authority and evidence.

### 2.4 New hard numerical gate

The existing one-point shear integration is provisional. A Q4 element admits a candidate checkerboard deflection pattern `[+1, -1, +1, -1]` with zero centre shear when rotations are zero; bending energy is also zero for that pattern. Element rank, mesh-level mechanisms, conditioning, and energy must therefore be audited before the formulation is retained for skew work.

If that gate fails, feature integration stops and the replacement-element branch in Section 11 is executed. Empirical stabilization or looser tolerances are not acceptable remedies.

## 3. Geometry and engineering convention

### 3.1 Canonical axes

- global `x`: roadway longitudinal direction;
- global `y`: roadway transverse direction;
- local `s`: centreline station between skew end lines;
- local `t`: transverse parameter measured in global `y`, `0 <= t <= W`;
- positive skew: support lines move in positive global `x` as `t` increases;
- `skewAngleDeg`: end-support angle away from global transverse;
- `lengthM`: centreline span along global `x`;
- `widthM`: width measured in global `y`.

For angle `theta`:

```text
x = s + (t - W/2) tan(theta)
y = t

t = y
s = x - (y - W/2) tan(theta)
```

Deck vertices, in mandatory counter-clockwise order:

```text
start-lower = (-W/2 tan(theta), 0)
end-lower   = (L - W/2 tan(theta), 0)
end-upper   = (L + W/2 tan(theta), W)
start-upper = ( W/2 tan(theta), W)
```

Derived dimensions:

```text
support offset = W tan(theta)
normal span = L cos(theta)
physical support-edge length = W / cos(theta)
```

At 19°, the support offset is approximately `0.3443 W`.

### 3.2 Basis warning

`(s,t)` are oblique affine parameters, not orthonormal tensor axes. Their global basis directions are proportional to `(1,0)` and `(tan(theta),1)`. Raw `mx`, `my`, and `mxy` remain components in orthonormal global roadway axes. Support-normal/support-tangent output requires an orthonormal tensor transformation, not relabelled `s/t` components.

### 3.3 Boundary terminology

- **Fixed/clamped:** restrain all three plate kinematic DOFs after their convention is frozen.
- **Pinned:** restrain transverse displacement only; rotations/slopes remain free. This is a soft simply supported plate idealisation.
- Published benchmarks must reproduce the exact source boundary definition; “simply supported” alone is insufficient.

## 4. Current repository baseline

### 4.1 Confirmed workspace

```text
C:\MyEngineering\04-Apps\moving-load-slab-app
```

This plan is currently an untracked user document. Unrelated user files and edits must be preserved.

### 4.2 Data flow

```text
SlabModel (src/app/types.ts)
  -> defaults/sanitization/App/auto-run
  -> src/solver/model/fromAppModel.ts
  -> src/solver/index.ts
  -> src/solver/runFixedPositionAnalysis.ts
       -> mesh / element / supports / vehicle / patch / sparse / recovery
  -> src/solver/post/recoverNodal.ts
  -> src/app/solverAdapter.ts
  -> envelope / sections / viewer / report
```

### 4.3 Confirmed implementation facts

- App and solver have separate models joined by `fromAppModel`.
- `mxy` exists at element centres but is omitted from nodal recovery and public result unions.
- Structured topology can be retained for an affine parallelogram.
- Current `xCoords/yCoords` cannot describe row-dependent global skew coordinates.
- Q4 physical derivatives currently use `J^-1`; the stored Jacobian convention requires `J^-T`.
- Rectangle intersection is duplicated in `loads/vehicle.ts` and `loads/patch.ts`.
- Patch assembly treats element AABBs as physical elements.
- Sections round and bucket global coordinates.
- Result-surface and mesh rendering already accept arbitrary node positions; camera, probe, boundaries, patches, support glyphs, and section strips remain rectangular.
- Internal reactions retain x/y, but the public payload drops them.
- Default/report prose says Kirchhoff; code is Mindlin/Reissner-type with selective shear integration.
- Current code uses sparse assembly and conjugate gradient, while some docs still describe dense/direct reuse and a Web Worker.
- Every envelope station rebuilds and resolves the complete model.

### 4.4 Baseline execution status

`node_modules` is absent. The suite could not start because `vitest` is not locally installed. PowerShell blocks unsigned `npm.ps1`; use `npm.cmd` on this machine.

No green baseline may be claimed until WP-001 runs:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
git diff --check
```

No dependency installation was performed while preparing this plan.

## 5. Target contracts

The contract owner may refine names, but every deviation must be recorded before downstream work.

### 5.1 Geometry

```ts
interface SlabGeometry {
  lengthM: number;
  widthM: number;
  thicknessM: number;
  skewAngleDeg: number;
}
```

The solver boundary may temporarily accept optional skew for backward compatibility, but normalizes it once. One pure module owns:

```text
deckLocalToGlobal
globalToDeckLocal
buildDeckPolygon
getDeckEdgeSegment
getDeckBounds
getSupportOffset
getNormalSpan
getSupportAxes
```

At zero skew, the mapping must be exactly `x=s`, `y=t` without avoidable trigonometric drift.

### 5.2 Common geometry

```ts
interface Point2D { x: number; y: number }
type Polygon2D = Point2D[];
interface Aabb { xMin: number; xMax: number; yMin: number; yMax: number }
type DeckEdge = start | end | lower-side | upper-side;
```

All physical polygons use documented counter-clockwise winding. AABBs are broad-phase metadata only.

### 5.3 Mesh

```ts
interface MeshNode {
  id: number;
  x: number;
  y: number;
  s: number;
  t: number;
}

interface MeshElement {
  id: number;
  nodeIds: [number, number, number, number];
  polygon: Polygon2D;
  bounds: Aabb;
}

interface StructuredMesh {
  sCoords: number[];
  tCoords: number[];
  nodes: MeshNode[];
  elements: MeshElement[];
  nodeIdsByIJ: number[][];
  elementCountS: number;
  elementCountT: number;
}
```

Do not retain `xCoords/yCoords` as global axes. Temporary aliases must be deprecated and documented as local coordinates.

### 5.4 Supports

```ts
interface EdgeSupport extends SupportBase {
  kind: edge;
  edge: DeckEdge;
}

type Support = EdgeSupport | LineSupport | PointSupport;
```

- Edge supports map by topology.
- Existing zero-skew coordinate line/point supports remain compatible.
- Skew point supports map by physical node distance.
- An inclined coordinate line is accepted only with exact mesh-node membership using point-to-segment distance.
- Arbitrary internal support meshing is out of scope.
- Line springs use Euclidean tributary distance.
- Fixed/pinned are support presets, not a second ambiguous per-DOF `pinned` meaning.

### 5.5 Patches

`WheelPatch` carries original/clipped polygons, original/clipped AABBs, original/clipped areas, clipped centroid, pressure, wheel load, dimensions, centre, and existing axis direction. The viewer receives the clipped polygon. Pressure always uses the full contact area.

### 5.6 Results, reactions, and equilibrium

Add `mxy` to result unions, nodal recovery, contours, envelopes, worst-station capture, selectors, legends, sections, print views, and reports.

App-facing reaction rows retain:

```ts
xM: number;
yM: number;
distanceAlongSupportM?: number;
```

Expose signed applied/reacted vertical force and global x/y moments, absolute residuals, and normalized residuals. The contract defines reaction direction, spring sign, generalized moment contribution, global deduplication, and per-support shared-corner attribution.

### 5.7 Sections

Minimum release:

- longitudinal local strip: vary `s` at selected `t`;
- transverse/support-parallel local strip: vary `t` at selected `s`;
- ordinate independently selectable as `mx`, `my`, or `mxy`.

These are labelled deck-coordinate strip averages. Exact arbitrary global cuts are a separate enhancement.

### 5.8 Verification-status contract

Presentation and reports must distinguish three independent statuses:

```ts
interface VerificationStatus {
  formulation: not-checked | failed | conditional | passed;
  referenceStudy19Deg: not-run | failed | conditional | passed;
  currentModelConvergence: not-demonstrated | failed | conditional | passed;
  evidenceIds: string[];
  warningRequired: boolean;
}
```

A user model does not inherit convergence merely because the stored 19° reference study passed. Unless the current model has an attached mesh study, its report says current-model convergence is not demonstrated. `warningRequired` is controlled by the release decision, not an editable UI switch.

## 6. Delivery governance and context rules

### 6.1 Roles and concurrency

Use at most four active agents: one lead/integrator and up to three bounded workers/reviewers. Use a fresh numerical reviewer at mathematical gates. A Chartered Engineer owns the final project acceptance decision.

### 6.2 Persistent ledger

WP-001 creates `docs/skew-implementation-status.md`. Keep this plan stable. The ledger contains only current integration hash, decision digests, packet states, file leases, exact test/build outcomes, gate evidence/tolerances, risks/deviations, and the next three delegations. Do not paste source, full diffs, logs, or full agent reports.

### 6.3 Packet limits

- One primary concern.
- 2–6 production files and 1–3 focused test files.
- At most one shared integration hotspot.
- Target reading budget under 25k source tokens.
- Handoff under 500 words with no pasted source.
- No drive-by refactors, formatting sweeps, dependency upgrades, or unrelated docs.

If a packet exceeds the limit, stop and split it.

### 6.4 File leases

In the shared workspace, only the lead stages/commits. Every worker gets an exclusive write list. Workers preserve user changes and may not alter frozen shared contracts without a deviation request.

Hotspots requiring exclusive leases:

- `src/app/types.ts`
- `src/solver/model/types.ts`
- `src/app/defaults.ts`
- `src/solver/index.ts`
- `src/app/solverAdapter.ts`
- `src/solver/runFixedPositionAnalysis.ts`
- `src/components/ControlPanel.tsx`
- `src/components/Viewport.tsx`
- `src/components/ReportNote.tsx`
- `src/viewer/scene/StructureOverlay.tsx`
- `src/styles/app.css`

### 6.5 Contract deviation

```text
Contract deviation requested:
Decision/contract ID:
Current definition:
Required change:
Why this packet cannot continue:
Affected packets:
Backward-compatibility impact:
Proposed migration/test:
```

Only the lead approves and integrates it.

## 7. Dependency graph

```text
WP-001 baseline/ledger
  -> WP-002 mathematical/sign ADR
       -> {WP-003 data/API ADR, WP-004 source protocol,
           WP-031A reaction-moment mapping}
WP-003 -> WP-005 compile-safe contract scaffold
WP-005 -> {WP-010 Q4 mapping, WP-012 deck geometry,
           WP-013 polygon kernel, WP-014A app geometry type}
WP-010 -> WP-011 element stability
WP-014A -> WP-014B skew defaults/migration
{WP-012, WP-014B} -> WP-015 app-to-solver geometry and mesh sizing
{WP-010, WP-011, WP-012, WP-015} -> WP-020 skew mesh/quality
WP-020 -> {WP-021 supports, WP-023 inverse Q4}
{WP-012, WP-013, WP-015} -> WP-022 patch polygons
{WP-013, WP-020, WP-022, WP-023} -> WP-024 patch integration
{WP-021, WP-024, WP-031A} -> WP-025 signed equilibrium
{WP-010, WP-011, WP-020} -> WP-030 raw recovery
{WP-002, WP-030} -> WP-031B plate-tensor transformation
{WP-025, WP-030, WP-031B} -> WP-026 solver integration
{WP-021, WP-026} -> WP-027 atomic app EdgeSupport migration
WP-026 -> WP-032A solver-facade transport
{WP-027, WP-032A} -> WP-032B app contracts/defaults
WP-032B -> WP-032C app adapter
WP-032C -> {WP-033 sections, WP-034 reactions, WP-035 envelopes/path}
{WP-027, WP-032C} -> WP-040 geometry/support controls
{WP-033, WP-035, WP-040} -> WP-041A result/section controls
{WP-032C, WP-041A} -> WP-041B viewport diagnostics
{WP-020, WP-032C} -> WP-042 viewer bounds/probe
{WP-021, WP-022, WP-033, WP-032C} -> WP-043 viewer overlays
{WP-034, WP-041B} -> WP-044 reaction UI
{WP-025, WP-031B, WP-033, WP-034, WP-035,
 WP-041B, WP-042, WP-043} -> WP-045 report/print
{WP-040..WP-046} -> WP-050 user journey
After G4: {WP-060 regression, WP-061 skew verification,
           WP-063 UI/report QA, Wave 5 presentation lanes}
{WP-060, WP-061} -> WP-062 published benchmarks
{WP-060..WP-063 all passed} -> G6
G6 -> WP-064 shell comparison -> WP-065 release audit -> G7
```

Critical path:

```text
conventions -> Q4 correction/stability -> mesh/polygon/load -> equilibrium
-> recovery/transforms -> structural verification -> independent comparison
```

## 8. Parallel waves

| Wave | Parallel lanes | Checkpoint |
|---|---|---|
| 0 | Baseline; then conventions; then API contract/source protocol in parallel; compile-safe contract scaffold | G0 |
| 1 | Q4/stability, geometry, polygon, skew migration, app/solver geometry bridge | G1 |
| 2 | Mesh/quality, supports, patch polygons/inverse mapping | G2 |
| 3 | Loading, equilibrium, recovery/transforms | G3 |
| 4 | Solver/API, sections, reactions, envelopes | G4 |
| 5 | Controls/viewer/report plus early regression/skew-verification lanes after G4 | G5 application gate; numerical work continues |
| 6 | Complete regression/skew evidence, then benchmarks; UI/report QA | G6 |
| 7 | Independent shell comparison and CEng review | G7 |

Waves can contain more logical packets than available slots; execute them in batches of up to three workers while the lead integrates and reviews.

Recommended initial dispatch batches:

- **Wave 0A:** WP-001 only.
- **Wave 0B:** WP-002 only.
- **Wave 0C:** WP-003 and WP-004 in parallel; then WP-005 serially.
- **Wave 1A:** WP-010, WP-012, and WP-013 in parallel.
- **Wave 1B:** WP-011, WP-014A, and WP-031A; then WP-014B and WP-015 as dependencies permit.
- **Wave 2A:** WP-020 and WP-022 in parallel.
- **Wave 2B:** WP-021 and WP-023 in parallel.
- **After G4:** start WP-060, WP-061, and presentation work in disjoint lanes. Start WP-062 only after WP-060/WP-061 declare kernel readiness.

## 9. Detailed work packages

### Wave 0 — baseline and contract freeze

#### WP-001 — Restore executable baseline and create status ledger

- **Owner:** lead or bounded baseline worker
- **Size/context:** S; package metadata, tests, benchmark fixture; no feature code
- **Prerequisites:** none
- **Write lease:** new status ledger; narrow baseline fixtures after current output is observed
- **Tasks:**
  1. run `npm.cmd ci` without changing declared dependency versions;
  2. record Node/npm versions and platform;
  3. run full tests and build;
  4. record every pre-existing failure;
  5. identify executable coverage for mesh, element, loads, equilibrium, and benchmarks;
  6. add zero-skew characterization fixtures for element stiffness, assembled patch vector, one solve, nodal results, and signed reactions where known;
  7. record solver options/tolerances and fixture precision; and
  8. determine whether `TRANSFER_SLAB_BENCHMARK_FIXTURE` is reproducible or metadata-only.
- **Acceptance:** exact commands/results are in the ledger; characterization is not mislabelled as physical validation.
- **Handoff:** baseline hash, results, fixture paths, discrepancies.

#### WP-002 — Freeze mathematical, DOF, sign, and virtual-work conventions

- **Owner:** numerical architecture reviewer
- **Size/context:** M; element, recovery, reactions, report, solver types
- **Prerequisites:** WP-001 observations
- **Write lease:** new ADR only, recommended `docs/adr/ADR-skew-mathematical-conventions.md`
- **Tasks:**
  1. derive current rotational-variable meaning from the bending/shear B matrices;
  2. decide whether to rename internally to `betaX/betaY` or define an explicit physical-rotation mapping;
  3. define applied load and displacement signs;
  4. define curvature, shear strain, `mx/my/mxy`, `qx/qy`, and generalized-reaction signs;
  5. derive force and x/y moment equilibrium from virtual work and `r × F`;
  6. resolve spring versus fixed reaction sign;
  7. define support tangent/normal axes;
  8. separate plate-tensor and reaction-vector transformations; and
  9. define ±skew mirror expectations for every field.
- **Acceptance:** an independent reviewer can reproduce every sign; equilibrium never relies on absolute values.
- **Stop condition:** if code/report language cannot be reconciled, add an explicit conversion layer before result/report work.

#### WP-003 — Freeze shared data and API contracts

- **Owner:** lead/architecture reviewer
- **Size/context:** M; app types, solver types, adapters, viewer inputs
- **Prerequisites:** WP-002
- **Write lease:** ADR only; no broad type edit
- **Tasks:** freeze Section 5 contracts, compatibility/removal of axis arrays, edge discriminants, winding, patch overlays, local coordinates, equilibrium outputs, section settings, and warning lifecycle.
- **Acceptance:** each downstream packet has explicit inputs/outputs; no two workers invent the same field.

#### WP-004 — Acquire and freeze verification-source protocols

- **Owner:** engineering reference-data reviewer
- **Size/context:** M; documentation only
- **Prerequisites:** WP-002
- **Write lease:** verification-source document and fixture-data directory
- **Tasks:**
  1. acquire exact Morley and Razzaque definitions;
  2. record geometry, skew convention, thickness ratio, material, load, support type, normalization, mesh, extraction, and reference values;
  3. obtain an authoritative rectangular plate reference compatible with the theory;
  4. define fixture-provenance fields;
  5. freeze commercial-shell comparison protocol before seeing results;
  6. specify external solver/version, element, mesh, axes, restraints, loads, and signed extraction tables; and
  7. confirm current standards/UK NA basis only where load/design compliance is claimed.
- **Acceptance:** source interpretation is independently reviewed before tolerances are chosen; no unattributed values.

#### WP-005 — Materialize the compile-safe shared contract scaffold

- **Owner:** lead/contract integrator; serial exception to the normal hotspot limit
- **Size/context:** M; type definitions and compile fixtures only
- **Prerequisites:** WP-003
- **Write lease:** new `src/solver/geometry/types.ts`, `src/solver/model/types.ts`, `src/app/types.ts`, focused type/adapter fixtures
- **Tasks:**
  1. add canonical `Point2D`, `Polygon2D`, `Aabb`, `DeckEdge`, equilibrium, quality, and verification-status shapes;
  2. add target mesh/patch/result/section/reaction interfaces in a compile-safe staged form;
  3. identify which target fields may be additive immediately and which active unions/required fields must be activated by later vertical slices;
  4. do not widen the live app `Support` union to `EdgeSupport` yet;
  5. document temporary aliases and their removal packet;
  6. ensure later workers import common types instead of declaring private duplicates; and
  7. keep strict typecheck/build green.
- **Acceptance:** every foundation worker has an importable frozen type; the current application still compiles; activation owners are recorded for every staged field.
- **Reason for exception:** centralizing this small serial edit prevents three parallel workers from independently changing both type systems.

### Gate G0 — baseline and contract gate

- Executable baseline recorded, or failures accepted as pre-existing.
- Mathematical/sign ADR approved.
- Data/API ADR approved.
- Verification-source protocol approved.
- File leases and next three delegations recorded.
- Warning lifecycle frozen.
- Compile-safe contract scaffold passes typecheck/build.

### Wave 1 — mathematical foundations

#### WP-010 — Extract and verify shared Q4 geometry primitives

- **Owner:** element-kernel worker
- **Size/context:** M
- **Prerequisites:** G0
- **Write lease:** `src/solver/core/element.ts`, new `q4Geometry.ts`, focused tests
- **Tasks:** extract shape functions, natural derivatives, forward interpolation, Jacobian, determinant, and physical gradients; preserve node ordering; add a test API; add constant/global-x/global-y tests on rectangular and sheared quads; correct inverse transpose; reject non-positive determinant; prove zero-skew stiffness unchanged within scaled roundoff.
- **Evidence:** `grad(x)=(1,0)`, `grad(y)=(0,1)`, constant gradient zero, stiffness symmetry, zero-skew fixture stable.
- **Do not:** change integration rules or combine with loading.

#### WP-011 — Audit element rank, rigid modes, locking, and hourglass stability

- **Owner:** numerical element reviewer/worker
- **Size/context:** M
- **Prerequisites:** WP-010
- **Write lease:** stability tests/diagnostic helper; production changes only after lead approval
- **Tasks:** verify rigid translation and tilts; linear rotation-field/constant-curvature completeness; run a multi-element constant-bending patch test on rectangular and sheared meshes with stated boundary data, tractions/residual measure, and integration-point expectations; verify zero-shear compatibility; inspect stiffness rank/eigenvalues; test checkerboard mode; assemble small restrained meshes; require positive `p^T K p` during CG and scaled positive constrained-system pivots/eigenvalues; report CG breakdown explicitly; study representative `h/L`; issue retain-SRI or replace recommendation.
- **Acceptance:** only physical null modes before restraint, no extra mesh modes, stable positive-definite restrained system, documented conditioning trend. Do not claim a general quadratic `w` field is exactly represented everywhere by bilinear Q4 interpolation.
- **Branch condition:** failure activates Section 11 before mesh/load/benchmark integration.

#### WP-031A — Map generalized nodal moments to physical global moment components

- **Owner:** numerical convention worker
- **Size/context:** S
- **Prerequisites:** WP-002
- **Write lease:** new `src/solver/post/reactionMomentMapping.ts` and focused analytical tests
- **Tasks:** implement the DOF-ADR mapping from restrained generalized nodal moments to physical global x/y couple components used in equilibrium; keep it separate from plate moment-tensor rotation.
- **Tests:** unit generalized components, signs, virtual-work consistency, 90° axis cases, round trip where defined.
- **Acceptance:** WP-025 can balance global moments without guessing how `rx/ry` reactions map physically.

#### WP-012 — Implement affine deck-coordinate kernel

- **Owner:** geometry worker
- **Size/context:** S
- **Prerequisites:** G0
- **Write lease:** new `src/solver/geometry/deckCoordinates.ts` and tests
- **Tasks:** implement Section 5.1 utilities, scale-aware tolerances, signed edge tangents, inward/outward normals, polygon/bounds, and zero-skew fast path.
- **Tests:** 0°, ±19°, ±45°; corners/random round trips; analytic vertices, area, offset, normal span, edge length, mirror behaviour.
- **Acceptance:** error no greater than `100 * machine epsilon * characteristic length` for well-scaled cases.

#### WP-013 — Implement convex polygon and quadrature kernel

- **Owner:** computational-geometry worker
- **Size/context:** M
- **Prerequisites:** G0
- **Write lease:** new `src/solver/geometry/convexPolygon.ts` and tests
- **Tasks:** winding normalization; duplicate/collinear cleanup; area, centroid, first moments; AABB; point predicates; convex clipping; deterministic triangulation; degree-two triangle quadrature. Document that exact consistent-load integration with this rule is claimed only for affine parallelogram Q4 release elements.
- **Tests:** CW/CCW, shared edge/vertex, empty/contained, triangles/trapezoids, degeneracy cleanup, conservation.
- **Do not:** add a geometry dependency without approval.

#### WP-014A — Activate the app skew-geometry type

- **Owner:** schema worker
- **Size/context:** S
- **Prerequisites:** WP-005 and WP-012 validation contract
- **Write lease:** `src/app/types.ts`, mechanical geometry fixture updates including `src/tests/vehiclePlacement.test.ts`
- **Tasks:** make live `skewAngleDeg` required; keep vehicle heading independent; update typed fixtures without changing runtime defaults.
- **Acceptance:** strict typecheck passes and fixture changes are mechanical/explicit.

#### WP-014B — Add skew defaults, sanitization, and persistence migration

- **Owner:** migration worker
- **Size/context:** S
- **Prerequisites:** WP-014A
- **Write lease:** `src/app/defaults.ts`, `src/tests/defaults.test.ts`
- **Tasks:** default zero; missing legacy field -> zero; agreed inclusive ±45° range; deterministic NaN/infinite/out-of-range handling; save/load round trip; no `EdgeSupport` activation yet.
- **Acceptance:** old JSON, zero, ±19°, limits, invalid values, and round trips pass.

#### WP-015 — Propagate skew geometry and freeze mesh-sizing policy

- **Owner:** app/solver boundary worker
- **Size/context:** S–M
- **Prerequisites:** WP-012 and WP-014B
- **Write lease:** `src/solver/model/fromAppModel.ts`, `src/app/meshSizing.ts`, `src/tests/meshSizing.test.ts`, focused adapter tests
- **Tasks:**
  1. propagate normalized `skewAngleDeg` into solver geometry;
  2. choose and document parametric `L/W` sizing or physical skew-edge sizing;
  3. if physical sizing is selected, size the support direction using `W/cos(theta)` while retaining centreline-span semantics;
  4. keep zero-skew element counts identical; and
  5. test 0°, ±19°, and ±45° sizing/translation.
- **Acceptance:** one documented source controls target counts; `fromAppModel` has no separate skew formula.

### Gate G1 — mathematical foundation gate

- Inverse-transpose tests pass.
- Zero-skew element fixture is stable.
- Element retain/replace decision is approved.
- Geometry and polygon kernels pass review.
- Reaction generalized-moment mapping WP-031A passes virtual-work review.
- Migration/translation/mesh-sizing tests, full suite, and build pass.

### Wave 2 — mesh, supports, and patch representation

#### WP-020 — Implement skew structured mesh and quality diagnostics

- **Owner:** mesh worker
- **Size/context:** M
- **Prerequisites:** WP-010, approved WP-011 decision, WP-012, WP-015
- **Write lease:** `src/solver/model/types.ts`, `src/solver/core/mesh.ts`, new quality module/tests, mechanical mesh fixture migration including `src/tests/recoverNodal.test.ts`
- **Tasks:**
  1. generate local `sCoords/tCoords` with forced local coordinates;
  2. map nodes through the shared affine kernel;
  3. store global and local coordinates;
  4. preserve `nodeIdsByIJ` and CCW connectivity;
  5. build actual polygons and AABBs;
  6. calculate centres by Q4 interpolation at `(0,0)`, not AABB midpoint;
  7. inverse-map retained skew point supports to `(s,t)` before axis generation and inject both as forced local coordinates;
  8. keep arbitrary inclined internal-line mesh forcing unsupported and explicit;
  9. calculate determinant range, scaled Jacobian, edges, angles, aspect ratio, and thickness/size indicators;
  10. freeze formulas, dimensionless definitions, thresholds, warning/error levels, and their technical basis in the quality module/ADR;
  11. reject non-positive Jacobians;
  12. expose deterministic warnings for poor but valid elements; and
  13. assert that any stored element polygon matches the current node coordinates, or derive it from `nodeIds` on demand.
- **Tests:** zero-skew topology, ±19° mapping, forced coordinates, AABB containment, quality classifications, refined/nonuniform grids.
- **Acceptance:** no stiffness/load code treats an AABB as physical element geometry.

#### WP-021 — Implement edge and retained coordinate support mapping

- **Owner:** support worker
- **Size/context:** M
- **Prerequisites:** WP-020 and WP-002
- **Write lease:** `src/solver/core/supports.ts`, support tests
- **Tasks:** topology-based four-edge mapping; support-level fixed/pinned/custom resolution; map retained point supports to the node inserted by WP-020 using physical-distance confirmation; exact point-to-segment line membership for already meshed nodes; precise rejection of unsupported internal lines; Euclidean node ordering/tributaries; total spring conservation; duplicate global-DOF exposure.
- **Tests:** every edge/skew sign, all presets, nonuniform nodes, refinement-invariant springs, point tolerance, valid/invalid lines, intersecting supports.

#### WP-022 — Generate and slab-clip wheel patch polygons

- **Owner:** load-geometry worker
- **Size/context:** S–M
- **Prerequisites:** WP-012, WP-013, patch contract
- **Write lease:** `src/solver/loads/vehicle.ts`, patch-geometry tests
- **Tasks:** replace rectangular slab clipping with global patch polygons and deck clipping; retain AABBs only as metadata; preserve full-contact-area pressure.
- **Tests:** fully inside, partial at every edge, tangent edge/vertex, outside, ±skew mirror, x/y direction, zero-skew equivalence.
- **Out of scope:** arbitrary `headingDeg` rotation unless Gate 0 explicitly changes the direction contract.

#### WP-023 — Implement inverse Q4 point mapping

- **Owner:** Q4 geometry worker
- **Size/context:** S
- **Prerequisites:** WP-010 and WP-020
- **Write lease:** `q4Geometry.ts` and tests
- **Tasks:** affine inverse fast path; bounded Newton fallback for future convex non-affine point location; explicit initial guess, residual norm, iteration cap, Jacobian failure, containment tolerance; no silent clamping. The release load path must assert affine parallelogram elements. Newton support must not be presented as evidence that degree-two triangle quadrature is exact for variable-Jacobian non-affine quads.
- **Tests:** corners, edges, centre, random interior/exterior, distorted convex quad, bad/inverted quad, ±19° round trips.

### Gate G2 — mesh and representation gate

- Mesh contract is frozen.
- Support-node sets reviewed at ±19°.
- Patch clipping agrees with analytic geometry.
- Inverse mapping passes round trips.
- Zero-skew mesh/support/patch fixtures pass.
- Full suite and build pass.

### Wave 3 — loading, equilibrium, and raw results

#### WP-024 — Assemble consistent polygon patch loads

- **Owner:** load-integration worker
- **Size/context:** M
- **Prerequisites:** WP-013, WP-020, WP-022, WP-023
- **Write lease:** `src/solver/loads/patch.ts`, direct integration tests
- **Tasks:**
  1. use patch/element AABBs for broad phase only;
  2. clip patch against each element polygon;
  3. clean and triangulate intersections;
  4. evaluate degree-two quadrature points globally;
  5. inverse-map to `(xi,eta)`;
  6. integrate `pressure * N_i * dA` into four vertical nodal forces;
  7. accumulate analytic polygon and assembled force/first-moment totals; and
  8. assert/reject non-affine release elements unless a separately verified variable-Jacobian quadrature path is introduced; and
  9. fail with element/patch IDs when mapping fails.
- **Tests:** full parallelogram gives `pA/4`; triangle/trapezoid; outside zero; x/y first moments; smooth boundary sweep; zero-skew vector matches baseline.
- **Acceptance:** unit conservation is at scaled machine precision; a solver residual never excuses a load-geometry error.

#### WP-025 — Implement signed force/moment equilibrium and reaction consistency

- **Owner:** equilibrium worker with numerical review
- **Size/context:** M
- **Prerequisites:** WP-002, WP-021, WP-024, WP-031A
- **Write lease:** new `src/solver/core/equilibrium.ts`, `src/solver/analysisGuards.ts`, focused equilibrium tests; no shared result-type edit
- **Tasks:** assembled applied force/moments; independent polygon check; consistent fixed/spring support action; physical generalized nodal moments using WP-031A; global DOF deduplication; separate per-support attribution; absolute and normalized signed residuals. Keep output pure until WP-026 integrates it into solver result types.

Candidate normalization:

```text
eF = |sum(F_applied) + sum(F_reaction)|
     / max(sum(|F_applied|), 1 kN)

eM = |sum(M_applied) + sum(M_reaction)|
     / max(sum(|F_applied|) * Lchar + sum(|M_applied|), 1 kN m)
```

- **Tests:** eccentric patch; fixed-only, spring-only, mixed; duplicate constraints; asymmetric lever arms; zero applied moment; sign reversal.
- **Acceptance:** thresholds are tied to integration precision and iterative residual, not an arbitrary display percentage.

#### WP-030 — Add defensible raw nodal recovery including `mxy`

- **Owner:** post-processing worker
- **Size/context:** M
- **Prerequisites:** WP-010, WP-011, WP-020
- **Write lease:** `src/solver/post/recoverNodal.ts`, `src/solver/post/recover.ts`, solver `NodalFieldValues` type activation in `src/solver/model/types.ts`, focused recovery tests; `analysisGuards.ts` remains leased by WP-025 until released
- **Tasks:** add `mxy`; calculate element centres isoparametrically rather than by AABB midpoint; replace unweighted corner averaging with approved weighted recovery; document centre/extrapolated values; define a shear policy consistent with one-point integration; avoid unverified corner shear extrema; retain raw centre results; test manufactured curvature and constant-shear states on uniform/nonuniform meshes.
- **Acceptance:** constant curvature recovers within roundoff; nonuniform behaviour is convergent; singular peaks are labelled/excluded; `qx/qy` have a declared recovery location, units, mirror parity, and thin/thick convergence evidence. If only element-centre shear is defensible, nodal shear/extrema are prohibited and UI/report contracts say so.

#### WP-031B — Implement plate moment-tensor transformations

- **Owner:** transformation worker/numerical reviewer
- **Size/context:** S–M
- **Prerequisites:** WP-002 and WP-030 contract
- **Write lease:** new moment and reaction-axis helpers/tests
- **Tasks:** implement symmetric plate-moment tensor transformation for global and support-normal/tangent axes. Generalized reaction mapping remains the separate WP-031A utility.
- **Tests:** identity, ±45°, 90°, uniaxial, isotropic, pure twist, invariant/round trip, mirror.
- **Prohibition:** do not use oblique `(s,t)` as Cartesian tensor axes.

### Gate G3 — solver subsystem gate

- Element formulation remains approved.
- Loading conserves force and first moments.
- Signed equilibrium passes focused cases.
- `mxy` recovery passes manufactured states.
- Transformations pass analytical review.
- Full zero-skew suite/build pass.

### Wave 4 — solver integration and downstream analytical APIs

#### WP-026 — Integrate skew fixed-position solver path

- **Owner:** lead/integrator
- **Size/context:** M
- **Prerequisites:** G3 and WP-031B
- **Write lease:** `src/solver/runFixedPositionAnalysis.ts`, final solver result/diagnostic activations in `src/solver/model/types.ts`, post-release `src/solver/analysisGuards.ts`, integration tests
- **Tasks:** normalize geometry once; mesh; approved element/support/load path; mechanism/SPD guard; require positive `p^T K p` and explicit CG breakdown reporting; solve; recover; attach quality/equilibrium/reaction/verification data; add finite checks for `mxy` and all diagnostics; issue warnings without downgrading hard failures.
- **Tests:** zero-skew fixture; 19° fixed-fixed; stable pinned case; mechanism rejection; partial patch; signed equilibrium; deterministic warnings.
- **Acceptance:** skew solve has no geometry-specific workaround outside shared kernels.

#### WP-027 — Atomically activate the app `EdgeSupport` vertical slice

- **Owner:** lead/contract integrator; serial compile-safe exception
- **Size/context:** M; read only the support-related regions of large UI/report files
- **Prerequisites:** WP-021 and WP-026
- **Write lease:** `src/app/types.ts`, `src/app/defaults.ts`, `src/solver/model/fromAppModel.ts`, support-related regions of `src/components/ControlPanel.tsx`, `src/viewer/supportPresentation.ts`, `src/viewer/scene/StructureOverlay.tsx`, and `src/components/ReportNote.tsx`; focused support/adapter tests
- **Tasks:** widen the live app support union; sanitize/save edge identities; translate every edge to the solver; make existing exhaustive point/line consumers compile-safe; derive edge endpoints with slab geometry at the overlay boundary; render/report an edge through shared geometry; keep full editor/preset design for WP-040/WP-043.
- **Tests:** all four edges, 0° and ±19°, legacy line/point JSON, invalid edge identity, adapter exhaustiveness.
- **Acceptance:** repository compiles before and after this atomic packet; no red intermediate commit; zero-skew legacy supports are unchanged.
- **Reason for exception:** widening a discriminated union necessarily updates all existing exhaustive consumers together. The lead alone integrates this packet.

#### WP-032A — Transport results through the solver facade

- **Owner:** API-boundary worker
- **Size/context:** S–M
- **Prerequisites:** WP-026, WP-030, WP-031B
- **Write lease:** `src/solver/index.ts`, solver-facade tests
- **Tasks:** expose `s/t`, topology, polygon patches, `mxy`, reaction coordinates/distance, equilibrium, quality, and verification status; remove/deprecate rectangular axes; preferably remove facade-only DOF reconstruction.
- **Acceptance:** solver payload is complete, signed, and zero-skew compatible.

#### WP-032B — Activate all app-facing analytical result contracts

- **Owner:** lead/app contract integrator; serial compile-safe exception to the normal hotspot limit
- **Size/context:** S–M
- **Prerequisites:** WP-027 and WP-032A
- **Write lease:** `src/app/types.ts`, `src/app/defaults.ts`, focused type/default tests
- **Tasks:** activate polygon overlays; node `s/t`; `mxy`; equilibrium/quality; verification status; section metadata; reaction distributions; complete envelope/worst-station shapes; update `idleResults` and `errorResults`. Predefine all fields needed by WP-033/WP-034/WP-035 so those workers do not edit shared app types.
- **Acceptance:** strict typecheck passes; defaults say non-zero-skew formulation/reference/current-model convergence are not demonstrated unless evidence is attached.
- **Reason for exception:** new required result/status fields and their idle/error constructors must land together to keep the branch compilable; no other worker runs against either file during this packet.

#### WP-032C — Normalize the complete solver payload in the app adapter

- **Owner:** adapter worker
- **Size/context:** S–M
- **Prerequisites:** WP-032B
- **Write lease:** `src/app/solverAdapter.ts`, `src/tests/solverAdapter.test.ts`
- **Tasks:** normalize every frozen field; reject malformed topology/polygons/diagnostics; preserve signed values; do not silently synthesize missing structural evidence as zero/passed.
- **Acceptance:** valid zero/skew payloads pass; malformed required structural fields fail clearly.

#### WP-033 — Implement deck-coordinate section engine

- **Owner:** section worker
- **Size/context:** M
- **Prerequisites:** WP-020, WP-030, WP-032C
- **Write lease:** `src/app/sectionCurve.ts`, section types/helpers/tests
- **Tasks:** replace global buckets; select in `s/t`; longitudinal and transverse/support-parallel strips; preserve signed station order; independently choose `mx/my/mxy`; attach mode/axis/width metadata; optional exact sampler only as a bounded follow-on.
- **Tests:** 0°, ±19°, nonuniform mesh, analytic field, strip bounds, envelope compatibility, empty/edge strips.

#### WP-034 — Build support reaction distributions

- **Owner:** reaction-results worker
- **Size/context:** S–M
- **Prerequisites:** WP-021, WP-025, WP-031A, WP-032C
- **Write lease:** new `src/app/reactionDistribution.ts`, `src/app/reactionSummary.ts`, focused tests
- **Tasks:** group by support; order by actual distance; expose vertical/global/support-normal/support-tangent moment series; sum nodal integrated forces/moments for totals; apply shared-corner rule; attach singularity/extraction limitations. If displaying force or moment per unit length, define tributary conversion, units, smoothing, and prove integration recovers the nodal total.
- **Tests:** start/end at both signs, nonuniform spacing, shared corner, fixed/spring mix, total reconciliation.

#### WP-035 — Extend envelopes, signatures, and skew travel bounds

- **Owner:** envelope worker
- **Size/context:** S–M
- **Prerequisites:** WP-032C
- **Write lease:** `src/app/runPathEnvelope.ts`, `src/app/placementControls.ts`, `src/tests/runPathEnvelope.test.ts`, `src/tests/vehiclePlacement.test.ts`, skew assertion in `src/tests/autoRun.test.ts`
- **Tasks:** accumulate signed `mxy`; capture worst twist station; validate node IDs/topology; preserve geometry signature; reproduce worst result by a fixed solve; derive complete vehicle entry/exit limits from actual skew-deck/global patch geometry rather than `0..L/W` rectangular bounds.
- **Tests:** ±19° at lower/upper transverse positions; full entry/exit at both skew edges; skew invalidates stale envelopes; worst-station re-solve.
- **Acceptance:** `mx/my/mxy/w` envelopes are deterministic; stale detection includes skew geometry.

### Gate G4 — fixed-position analytical gate

- 19° solve passes signed equilibrium.
- Transport contains geometry, `mxy`, reactions, diagnostics.
- Sections and distributions reconcile with source data.
- Envelope topology checks pass.
- Zero-skew fixtures remain in tolerance.
- Fresh numerical reviewer recommends presentation work.

After G4, WP-060 and WP-061 may start immediately in parallel with Wave 5 presentation packets. This prevents UI progress from being mistaken for numerical validation and reduces rework if verification activates the element-replacement branch. WP-062 waits for WP-060/WP-061 kernel-readiness results.

### Wave 5 — application and presentation

#### WP-040 — Add skew geometry and boundary controls

- **Owner:** UI controls worker
- **Size/context:** M; only geometry/support regions of the large component
- **Prerequisites:** WP-027, WP-032C
- **Write lease:** geometry/support blocks of `ControlPanel.tsx`, `src/styles/app.css`, narrow helpers
- **Tasks:** skew input/range; sign diagram; support-offset/normal-span readouts; fixed-fixed, pinned-pinned, custom presets; edge-identity editor at non-zero skew; legacy coordinate editor at zero skew; clamped-plate idealisation warning.
- **Tests:** pure preset/sign/readout helpers; migration; only intended DOFs/supports change.
- **Do not:** edit result or section controls in this packet.

#### WP-041A — Add `mxy` and section controls

- **Owner:** control-results worker
- **Size/context:** S–M
- **Prerequisites:** WP-033, WP-035, and release of `ControlPanel.tsx`/`app.css` by WP-040
- **Write lease:** result/section blocks of `ControlPanel.tsx`, `src/styles/app.css`, focused control helpers/tests
- **Tasks:** `Mxy` selector; explicit section mode/ordinate; verification status controls/read-only presentation; experimental banner control placement.
- **Acceptance:** ordinate is never inferred from direction; axes are explicit; verification status is not user-editable.

#### WP-041B — Present results, equilibrium, quality, and verification status

- **Owner:** viewport-results worker
- **Size/context:** S–M
- **Prerequisites:** WP-032C, WP-041A
- **Write lease:** `src/components/Viewport.tsx`, `src/viewer/viewerPresentation.ts`, `src/styles/app.css`, focused tests
- **Tasks:** `Mxy` units/extrema/legend routing; equilibrium summary; mesh-quality warnings; separate formulation/reference-study/current-model convergence statuses; experimental banner.
- **Acceptance:** every result label identifies axes/units; current-model convergence defaults to not demonstrated.

#### WP-042 — Make viewer bounds, camera, and probe polygon-aware

- **Owner:** viewer-core worker
- **Size/context:** M
- **Prerequisites:** WP-020, WP-032C
- **Write lease:** `SlabScene.tsx`, `ProbeSurface.tsx`, `ViewerCanvas.tsx` only if required, `src/viewer/math/probeHit.ts`, pure helpers/tests
- **Tasks:** fit actual mesh/deformed bounds; target bounds centre; raycast result surface or reject outside-deck hits; make deformation reference span geometry-aware.
- **Tests:** 0°, ±19°, long/wide decks, outside rejection, every mesh node in bounds, zero-skew framing tolerance.

#### WP-043 — Render deck, patch, support, and section polygons

- **Owner:** viewer-overlay worker
- **Size/context:** M
- **Prerequisites:** WP-021, WP-022, WP-027 (and release of `StructureOverlay.tsx`), WP-033, WP-032C; independent of WP-042 implementation
- **Write lease:** `StructureOverlay.tsx`, `supportPresentation.ts`, overlay helpers/tests
- **Tasks:** actual deck outline; clipped patch fills/outlines; edge-aligned support glyphs; local section-strip polygon; print-safe framing.
- **Acceptance:** no rectangle-only deck/patch/section geometry remains; zero-skew geometry remains equivalent.

#### WP-044 — Add reaction distribution plots and warnings

- **Owner:** reaction UI worker
- **Size/context:** S–M
- **Prerequisites:** WP-034; `Viewport.tsx` and `app.css` released by WP-041B
- **Write lease:** new reaction plot component, reaction block of `Viewport.tsx`, `src/styles/app.css`
- **Tasks:** vertical and global/support-axis moment plots versus support distance; clearly distinguish nodal integrated values from optional tributary-normalized densities; integrated totals; support selection; shared-corner marker; mesh-sensitive corner warning.
- **Acceptance:** plotted totals reconcile with the distribution model and never double-count a fixed DOF.

#### WP-045 — Update engineering note and print capture

- **Owner:** report worker
- **Size/context:** M
- **Prerequisites:** WP-025, WP-031B, WP-033–WP-035, WP-041B, WP-042, WP-043, WP-044
- **Write lease:** `ReportNote.tsx`, report helpers/tests, print-capture portions of `App.tsx`, print rules in `src/styles/app.css`
- **Tasks:**
  1. state skew convention, centreline span, normal span, width, and offset;
  2. state supports and restrained kinematic DOFs using approved terminology;
  3. state Mindlin/Reissner theory and selective-shear verification status;
  4. state excluded membrane, soil, abutment, beam, diaphragm, thermal, and through-thickness effects;
  5. state mesh, quality, convergence, and equilibrium status;
  6. state raw moment axes/signs;
  7. include required `mx/my/mxy`, sections, global/support-axis reactions, and dimensional units;
  8. generalize duplicated mx/my capture state before adding mxy; and
  9. separately report formulation, stored 19° reference-study, and current-model convergence status; and
  10. retain the non-zero-skew experimental warning until G7.
- **Acceptance:** safety-critical phrases/status have tests; no UI flag can clear the warning.

#### WP-046 — Update README, limitations, and migration documentation

- **Owner:** documentation worker
- **Size/context:** S
- **Prerequisites:** integrated API/UI behaviour known
- **Write lease:** `README.md`, `docs/2026-04-18-solver-suitability-review.md` only through an explicitly reviewed addendum, and a new skew verification-status document
- **Tasks:** correct rectangular scope, current sparse-CG architecture, theory wording, skew limitations, verification state, saved-model migration, and exact local commands.
- **Acceptance:** implemented, provisional, deferred, and independently verified capabilities are clearly distinct.

#### WP-050 — Integrate and exercise the complete 19° user journey

- **Owner:** lead/integrator
- **Size/context:** M; integration only, no new subsystem design
- **Prerequisites:** WP-040–WP-046
- **Write lease:** minimal integration fixes approved one at a time
- **Acceptance journey:**
  1. load an old zero-skew JSON and solve unchanged;
  2. create/load a 19° slab;
  3. apply fixed start/end edges;
  4. place a partly clipped wheel patch and solve;
  5. inspect `mx`, `my`, `mxy`, `qx`, `qy`, and deflection;
  6. run an envelope and reproduce worst stations;
  7. inspect local longitudinal/transverse sections;
  8. inspect support distributions and equilibrium;
  9. probe inside and outside the polygon;
  10. export the engineering note; and
  11. confirm the experimental warning.

Evidence classification:

- geometry, presets, adapters, fields, sections, reactions, and warning-state logic are unit tested;
- TypeScript/application integration is build verified;
- camera interaction, probe behaviour, print framing, and the end-to-end workflow are manually exercised in a browser and recorded with screenshots/notes;
- no automated browser E2E suite is claimed unless a separately approved dependency and packet add one.

### Gate G5 — integrated application gate

- WP-050 journey recorded.
- Focused tests, full suite, build, and `git diff --check` pass.
- Zero-skew comparison passes.
- Viewer/report labels agree with the mathematical ADR.
- Experimental warning is present.

### Wave 6 — verification evidence

#### WP-060 — Mathematical and zero-skew regression suite

- **Owner:** independent verification worker
- **Prerequisites:** G4
- **Write lease:** new `src/tests/skewGeometryRegression.test.ts`, `src/tests/elementVerification.test.ts`, `src/tests/patchLoadVerification.test.ts`, `src/tests/rectangularPlateBenchmark.test.ts`, their fixture files under `src/solver/benchmarks/rectangular`, and `docs/verification/zero-skew-regression.md`; no production edits
- **Scope:** affine mappings; Q4 completeness/rank/SPD; rigid modes; constant-bending multi-element patch test; zero shear compatibility; full/partial patch invariants; V28 authoritative rectangular reference; old smoke/default/adapter/viewer suites; executable transfer-slab fixture if reproducible.
- **Acceptance:** no undeclared zero-skew change; any deliberate baseline correction is documented, reviewed, and versioned separately from skew effects.

#### WP-061 — Skew structural verification and 19° convergence

- **Owner:** numerical verification worker
- **Prerequisites:** G4 and WP-004 protocol
- **Write lease:** new `src/tests/skewSystemVerification.test.ts`, `src/tests/skewConvergence.test.ts`, `src/tests/shearVerification.test.ts`, their fixture files under `src/solver/benchmarks/skew19`, and `docs/verification/19deg-skew-convergence.md`; no production edits
- **Scope:** ±skew mirror; signed equilibrium; manufactured/approved-location shear check; thin/thick sensitivity; distorted mesh response; systematic 19° mesh series; section and summed reaction response away from singular corners.
- **Mesh-series minimum:** at least four systematic refinements using unchanged geometry/load/BC/extraction definitions.
- **Acceptance:** use successive-mesh differences and convergence bands, not a blanket monotonicity requirement. Do not gate on raw nodal extrema, obtuse-corner moments, patch-edge point moments, or unverified shear peaks.

#### WP-062 — Executable Morley and Razzaque benchmarks

- **Owner:** benchmark worker plus independent engineering reviewer
- **Prerequisites:** WP-004, WP-060, WP-061 kernel readiness
- **Write lease:** new `src/tests/morleySkewBenchmark.test.ts`, `src/tests/razzaqueSkewBenchmark.test.ts`, fixture data under `src/solver/benchmarks/skewPublished`, and `docs/verification/published-skew-benchmarks.md`; no production edits
- **Scope:** source-backed fixtures, nondimensional calculations, exact support interpretation, mesh sequence, response extraction, tabulated comparison.
- **Acceptance:** tolerances are agreed before solver results are viewed; source edition/page/DOI and normalization are stored with each fixture; formulation is not tuned to pass.

#### WP-063 — UI, persistence, viewer, and report acceptance

- **Owner:** application QA worker
- **Prerequisites:** G5
- **Write lease:** new `src/tests/skewPersistenceAcceptance.test.ts`, `src/tests/skewViewerAcceptance.test.ts`, `src/tests/skewReportAcceptance.test.ts`, and `docs/verification/skew-ui-report-acceptance.md`; no production edits
- **Scope:** legacy and skew JSON; angle validation; camera/probe/overlay; `mxy`; section/reaction controls; envelope capture; print content; unconditional warning.
- **Evidence classification:** unit tests for pure/data behaviour, successful production build, and recorded manual browser checks for WebGL interaction/print. No E2E automation claim without a separate approved packet.
- **Acceptance:** all Definition of Done user actions are reproduced and evidence is linked from the ledger.

### Gate G6 — internal verification gate

- Every mandatory WP-060 through WP-063 check passes. Blocker evidence makes G6 conditional/failed and prevents release progression.
- Numerical reviewer signs the internal verification summary.
- Published benchmark provenance and results are archived.
- 19° convergence bands are accepted for named quantities.
- The feature remains experimental; G6 alone cannot remove the warning. Release-path WP-064 requires a passed G6. An external model may be run earlier for diagnosis under the frozen WP-004 protocol, but that activity is not WP-064 completion and supplies no G7 evidence until repeated/accepted after G6 passes.

### Wave 7 — independent project verification and release

#### WP-064 — Independent 19° commercial shell comparison

- **Owner:** independent analyst outside the implementation calculation path
- **Prerequisites:** G6 and frozen comparison protocol from WP-004
- **Scope:** same centreline span, width, thickness, material, skew convention, support idealisation, wheel patch geometry/pressure, load locations, axes, and extraction locations.
- **Required comparisons:** signed centre/section deflections; `mx/my/mxy` at defined nonsingular points/sections; integrated edge reactions; support-segment reactions; global force/moment balance; selected moving-load stations.
- **Required metadata:** product/version, element formulation, mesh, convergence, local/global axes, restraints, load application, screenshots/model file, signed result tables.
- **Write lease:** external model/evidence archive location defined by WP-004 and a comparison summary under `docs/verification`; no production code
- **Acceptance:** quantity-specific tolerances are pre-agreed and differences are explained; comparison receives Chartered Engineer review.

#### WP-065 — Final release audit and Chartered Engineer decision

- **Owner:** lead plus Chartered Engineer
- **Prerequisites:** WP-064
- **Tasks:** full suite/build; dependency/licence audit; security/basic input review; verify report limitations; verify source archive; audit every G0–G7 item; decide warning state and permitted use.
- **Possible decisions:**
  - keep experimental and create corrective backlog;
  - approve bounded screening use while retaining a warning; or
  - approve removal/change of the warning for the explicitly verified scope.
- **Prohibition:** no implementation agent removes the warning without this recorded decision.

### Gate G7 — release decision gate

G7 passes only when:

- G0–G6 are passed, not merely documented as blocked;
- WP-064 comparison satisfies pre-agreed signed quantity tolerances or has accepted engineering explanations;
- the complete evidence archive is reviewable and reproducible;
- all report limitations and verification statuses are correct;
- a Chartered Engineer records the permitted scope and warning decision; and
- any warning change is implemented in a separate, traceable release packet after the decision.

Otherwise the feature remains experimental/screening-only and the ledger records corrective packets.

## 10. Verification matrix

Every check needs a named fixture, command, tolerance source, actual result, reviewer, and evidence link in the ledger.

| ID | Check | Required evidence | Gate principle |
|---|---|---|---|
| V01 | Geometry forward/inverse | corners and random interior at 0°, ±19°, ±45° | error <= `100 eps * Lchar` |
| V02 | Deck polygon | analytic area `LW`, centroid, CCW order | scaled roundoff |
| V03 | Support axes/dimensions | offset, normal span, edge length, orthonormal n/t | analytic agreement |
| V04 | Linear-coordinate completeness | constant, x, y on sheared Q4 | machine precision |
| V05 | Rigid kinematics | translation and two rigid tilts | zero strain/energy |
| V06 | Plate patch/completeness | linear rotation field, multi-element constant bending, zero-shear compatibility | stated residual/traction/integration checks |
| V07 | Stiffness symmetry | rectangular and skew elements | normalized antisymmetry <= `1e-12` candidate |
| V08 | Rank/SPD stability | element and restrained small meshes, `p^T K p`, pivots/eigenvalues, CG breakdown | only physical null modes; no checkerboard/indefiniteness |
| V09 | Quality diagnostics | inverted, collapsed, high aspect/skew | deterministic error/warning |
| V10 | Zero-skew stiffness | pre-change fixture | scaled roundoff |
| V11 | Full-element UDL | asserted affine parallelogram | each nodal share `pA/4`; non-affine release element rejected |
| V12 | Partial patch | analytic triangles/trapezoids | area/force near roundoff |
| V13 | Patch first moments | arbitrary convex intersection | assembled equals analytic |
| V14 | Off-slab patch | empty intersection | exactly zero |
| V15 | Skew-edge sweep | moving clipped patch | continuous analytic load/response |
| V16 | Zero-skew load vector | recorded rectangle fixtures | unchanged within roundoff |
| V17 | Edge/point support selection | all edges/skew signs; inverse-mapped forced point | exact expected node IDs |
| V18 | Spring distribution | coarse/fine/nonuniform | total stiffness conserved |
| V19 | Stability guard | stable and mechanism models | mechanisms rejected before solve |
| V20 | Signed force equilibrium | fixed, spring, mixed | tied to solver residual |
| V21 | Signed moment equilibrium | eccentric patch/fixed rotations | x/y balances close |
| V22 | Duplicate constraints | intersecting supports | no global double count |
| V23 | Moment tensor transform | uniaxial/isotropic/pure twist | analytic and invariant checks |
| V24 | Reaction transform | unit generalized moments | matches DOF ADR |
| V25 | Mirror symmetry | +theta/-theta, mirrored load | specified even/odd field behaviour |
| V26 | Bending/twisting recovery | uniform/nonuniform mesh | exact manufactured or convergent |
| V27 | Section extraction | analytic scalar/bilinear field | exact samples/averages |
| V28 | Rectangular reference plate | authoritative clamped/SS case | pre-agreed quantity tolerance |
| V29 | Thin/thick study | multiple `h/L` | no locking/instability/mode switch |
| V30 | Morley/Razzaque | exact sourced cases | protocol tolerance |
| V31 | 19° convergence | >=4 meshes | final refinements in bands |
| V32 | Commercial shell model | fixed project geometry/cases | signed quantity comparison + CEng |
| V33 | Persistence | old, zero, ±19°, invalid angles | deterministic migration |
| V34 | Envelope integrity | worst station re-solve | identical field/station within tolerance |
| V35 | Viewer geometry | bounds, probe, overlays | no hit/draw outside polygon |
| V36 | Report safety | theory, axes, limits, residuals, separate statuses | warning retained until explicit G7/WP-065 decision |
| V37 | Shear output | constant-shear fixture, approved location, thin/thick trend, mirror parity | defensible location/units; no prohibited nodal extrema |
| V38 | Skew travel bounds | ±19° at lower/upper offsets and both directions | complete entry/exit through skew polygon |
| V39 | Verification-status isolation | formulation, reference study, current model | no inherited current-model convergence |

### 10.1 Tolerance policy

- Pure geometry, shape-function completeness, and load-integration conservation use scale-aware machine-precision tolerances.
- Solver force/moment equilibrium limits derive from the iterative residual, conditioning, and characteristic force/length.
- Published benchmark tolerances are fixed from the source/protocol before results are calculated.
- Project comparison tolerances are quantity-specific and Chartered Engineer approved.
- Tolerances may not be loosened after observing an inconvenient result without a documented cause, independent review, and a new fixture version.

### 10.2 Convergence quantities

Use signed:

- centre deflection;
- defined centreline, transverse, and support-parallel section values;
- integrated start/end reactions;
- reactions over defined support segments; and
- results at a fixed physical extraction distance from corners and patch edges.

Do not use raw corner peaks, raw global nodal extrema, point-load moments, patch-edge discontinuities, or inconsistent nodal shear as release gates.

### 10.3 Mirror expectations

WP-002 must provide the authoritative table. At minimum, the fixture shall check coordinate-mirrored `w`, `mx`, `my`, vertical reactions, and the expected sign reversals of twisting and transverse-direction quantities. The test must transform points before comparing them; array index coincidence is not sufficient evidence.

## 11. Conditional element-formulation replacement branch

Activate this branch if WP-011, WP-060, WP-061, or WP-062 finds extra zero-energy modes, unacceptable locking, unstable reduced integration, poor skew/distortion sensitivity, or non-convergence not attributable to other modules.

### EF-001 — Freeze failure evidence

- Record the smallest failing fixture, mesh, kinematic mode, eigen/energy evidence, solver residual, and why geometry/loading/supports are not the cause.
- Do not tune shear factors, diagonals, CG tolerances, or mesh warnings to conceal failure.

### EF-002 — Select documented replacement formulation

- Compare a documented MITC4, DKMQ, or equivalent assumed-shear formulation against the required DOFs, affine/skew mesh, browser constraints, recovery needs, and available primary references.
- Choose by verified element behaviour, not implementation convenience.
- Obtain independent numerical approval of equations, DOF convention, integration, and benchmark fixtures.

### EF-003 — Implement replacement behind the same element API

- Keep mesh, support, patch, solver, and result contracts stable where mathematically valid.
- Isolate formulation code and its tests.
- Add rigid, constant-curvature, rank, locking, distortion, thin/thick, rectangular, Morley, and Razzaque tests before reintegration.

### EF-004 — Rebaseline deliberately

- A corrected formulation may change zero-skew numerical results. Record old/new values, convergence evidence, reason, and engineering impact.
- Never classify a formulation correction as “no regression” merely by widening tolerances.

### EF-005 — Re-enter main path

Re-enter at G1, then rerun every downstream numerical and presentation gate affected by changed results. Existing benchmark/UI evidence is invalid until regenerated.

## 12. Risk register

| Risk | Consequence | Prevention/detection | Owner / response |
|---|---|---|---|
| Wrong inverse derivative transform | false skew stiffness/results | V04/V10 before mesh integration | element owner; hard stop |
| Extra zero-energy/hourglass mode | singular/mesh-dependent solution | V05–V09, small mesh eigen/energy tests | numerical reviewer; EF branch |
| Unresolved DOF meaning | wrong moments/reactions/report | WP-002 ADR and V24 | lead; block result/report work |
| Spring reaction sign mismatch | false equilibrium | signed fixed/spring/mixed tests | equilibrium owner |
| Duplicate corner reaction | doubled support totals | global DOF dedup + attribution policy | support/reaction owners |
| Treating AABB as element | wrong clipped load | polygon intersection and first moments | load owner |
| Degenerate polygon tolerance | load jumps/failures | scale-aware cleanup and sweep test | geometry owner |
| Pressure recomputed from clipped area | edge load artificially constant | full-area pressure contract | patch owner |
| Oblique `s/t` used as tensor axes | wrong transformed moments | WP-031B analytical tests | transformation reviewer |
| Unweighted nodal recovery | biased nonuniform-mesh extrema | manufactured/convergence tests | recovery owner |
| Raw one-point shear at corners | misleading shear plots | explicit shear-output policy | recovery reviewer |
| Strict monotonic convergence gate | false failure/pass | convergence bands, multiple quantities | verification owner |
| Benchmark BC mismatch | meaningless comparison | source protocol before fixture | reference owner |
| Viewer looks correct but solver wrong | false confidence | numerical gates precede UI | lead |
| Parallel shared-file edits | conflict/lost change | exclusive leases and lead commits | lead |
| Context-window exhaustion | incomplete/contradictory work | packet limits, ledger, compact handoffs | lead |
| Stale architecture documentation | incorrect engineering note | WP-046/current-code review | docs owner |
| Warning removed prematurely | unsafe design use | warning authority locked to G7 | lead + CEng |
| External comparison not like-for-like | false validation | protocol frozen before results | independent analyst |
| Performance regression in envelopes | unusable sweep | benchmark runtime/memory per wave | lead; separate optimization backlog |

### 12.1 Performance is monitored, not conflated with correctness

Record solve/envelope time and memory for the baseline and representative 19° meshes. Correctness work must not be mixed with factorization reuse, Web Workers, or broad solver optimization. If performance is unacceptable after correctness passes, create a separate profiled optimization plan.

## 13. Delegation and handoff protocol

### 13.1 Lead pre-dispatch checklist

Before every packet, the lead:

1. confirms prerequisites and current integration hash;
2. checks `git status --short` and identifies user-owned changes;
3. records an exclusive file lease;
4. provides only the relevant plan excerpt and decision digest;
5. lists the 2–6 files the worker should read first;
6. names files the worker must not edit;
7. gives focused and full acceptance commands;
8. gives numerical assertions and tolerance sources;
9. names stop/contract-deviation conditions; and
10. specifies the compact return format.

### 13.2 Worker brief template

```text
Work package:
Objective:
Prerequisites and integration hash:
Frozen decision digest:
Read first:
Exclusive write scope:
Do not touch:
Implementation steps:
Required tests:
Acceptance commands:
Engineering/numerical checks:
Out of scope:
Stop/deviation conditions:
Return format:
```

Do not send a fresh worker the full conversation history when a plan excerpt, ADR digest, and file manifest are sufficient.

### 13.3 Worker handoff template

```text
Status: complete | partial | blocked
Files changed:
Behaviour implemented:
Tests added/changed:
Commands run and exact result:
Numerical checks and tolerance sources:
Contract deviations:
Assumptions made:
Known risks/edge cases:
Recommended next dependency:
Diff size:
```

The handoff is ideally under 500 words and contains no pasted source or long logs. Failed commands are reported, not omitted.

### 13.4 Reviewer brief template

```text
Reviewed integration hash/diff:
Scope and frozen decisions:
Files/tests inspected:
Independent checks performed:
Findings by severity:
Acceptance criteria passed/failed:
Required corrections:
Gate recommendation: pass | conditional | fail
```

Numerical workers do not self-approve their mathematical work. The reviewer must be fresh enough to challenge conventions and test adequacy.

### 13.5 Contract-deviation handling

When a deviation is requested, the lead:

1. pauses directly affected packets;
2. assesses migration and shared-file impact;
3. obtains numerical review if signs, axes, equilibrium, or result meaning change;
4. updates the ADR and ledger;
5. makes the smallest centralized contract change;
6. reruns contract/baseline tests; and
7. reissues affected packet briefs from the new integration hash.

## 14. Integration and review procedure

### 14.1 End-of-packet checks

For every completed packet:

1. inspect `git diff --stat` and `git diff --check`;
2. confirm only leased files changed;
3. inspect the actual diff before running formatting/build tools;
4. run the packet's focused tests;
5. run the relevant subsystem regression set;
6. record exact command output in compact form;
7. resolve or record every deviation/risk;
8. release the file lease; and
9. update ledger state.

### 14.2 End-of-wave checkpoint

At G1–G6, the lead:

1. integrates in dependency order;
2. runs all focused suites for the wave;
3. runs `npm.cmd test`;
4. runs `npm.cmd run build`;
5. runs `git diff --check`;
6. compares executable zero-skew fixtures;
7. runs the wave's numerical fixtures;
8. requests the specified independent review;
9. commits only after the gate passes; and
10. records the named integration hash before dispatching the next wave.

### 14.3 Merge/integration order inside each wave

- **Wave 1:** WP-010 -> WP-011 decision; WP-012 and WP-013 may land independently; WP-014A -> WP-014B -> WP-015; WP-031A is independent after WP-002.
- **Wave 2:** WP-020 before WP-021/WP-023; WP-022 can land independently after geometry/polygon kernels.
- **Wave 3:** WP-024 before WP-025; WP-031A must precede WP-025; WP-030/WP-031B can progress against their own leases once prerequisites are stable.
- **Wave 4:** WP-026 -> WP-027/WP-032A -> WP-032B -> WP-032C; WP-033/WP-034/WP-035 start only from WP-032C.
- **Wave 5:** WP-040 -> WP-041A for `ControlPanel.tsx`; WP-041B -> WP-044 for `Viewport.tsx`; `app.css` leases in order WP-040 -> WP-041A -> WP-041B -> WP-044 -> WP-045. WP-042 and WP-043 remain file-disjoint and parallel; WP-045 follows both for valid print capture.
- **Wave 6:** verification packets do not alter production code except through separately approved corrective packets; corrections invalidate affected evidence and rerun the gate.

### 14.4 Work that must not be parallelized

- Mathematical sign decisions and reaction/equilibrium implementation.
- Shared type edits and saved-model migration.
- Mesh representation and support mapping against an unfrozen mesh.
- Patch representation and its integration against an unfrozen patch type.
- Solver facade and app adapter edits.
- Section semantics and section-overlay implementation before the section contract.
- Equilibrium sign convention and support distribution attribution.
- Benchmark interpretation and benchmark acceptance.
- External comparison protocol and comparison-result judgement.
- Warning removal and final engineering sign-off.

## 15. Definition of ready and definition of done

### 15.1 Packet definition of ready

A packet is ready only when:

- all prerequisite packets/gates pass;
- the integration hash is named;
- required ADR decisions are frozen;
- write/read scopes are explicit;
- acceptance tests and tolerance sources are known;
- no active worker owns the same files; and
- relevant baseline failures are recorded.

### 15.2 Packet definition of done

A packet is done only when:

- required behaviour and tests are implemented;
- all focused commands pass or a genuine blocker is recorded;
- no out-of-scope files changed;
- numerical results include signed values and tolerance source where relevant;
- the handoff is complete;
- lead review accepts the diff; and
- ledger state and file leases are updated.

### 15.3 Feature definition of done

The bounded implementation is technically complete only when a user can:

1. load legacy zero-skew models without changed semantics;
2. define a 19° parallelogram slab with the documented convention;
3. select fully fixed or pinned start/end edges;
4. position/sweep wheel patches through skew boundaries without load jumps;
5. solve without rectangular geometry workarounds;
6. inspect signed global `mx`, `my`, `mxy`, `qx`, `qy`, and `w`;
7. inspect labelled deck-coordinate sections;
8. inspect support reaction distributions and integrated totals;
9. review force/moment equilibrium, mesh quality, and convergence status;
10. export a report with theory, axes, limitations, and verification status; and
11. reproduce all documented verification evidence.

Engineering release is complete only after WP-064 and WP-065. Until then, the feature remains for screening/sensitivity studies and requires Chartered Engineer review before any submission or design reliance.

## 16. Required source and standards record

### 16.1 Numerical benchmark sources

- Morley's original skew-plate definition and reference values must be obtained with exact edition/page and boundary/normalization details.
- Razzaque's original definition and thin/thick series must likewise be sourced.
- A useful modern cross-check is M. Grbac and D. Ribarić, [“Accurate Numerical Solutions for Standard Skew Plate Benchmark Problems”](https://ojs3.uniri.hr/index.php/zr/en/article/view/186), 2022, DOI `10.32762/zr.25.1.15`. It must not replace examination of the exact fixture definitions and cited originals.
- If the element is replaced, use a primary formulation reference and its verification suite for MITC4/DKMQ or the selected alternative.

### 16.2 Standards and jurisdiction

Traffic/design standards define actions and resistance requirements; they do not validate the finite-element kernel. If compliance is claimed, the standards owner must record the project-specified basis, applicable UK National Annexes, and edition transition.

As of plan preparation, [BSI lists `BS EN 1991-2:2023`](https://knowledge.bsigroup.com/products/eurocode-1-actions-on-structures-traffic-loads-on-bridges-and-other-civil-engineering-works) as the current release for traffic loads on bridges. BSI also describes a UK coexistence period in which first-generation Eurocodes remain the generally applicable basis until withdrawal on 30 March 2028 unless the relevant authority/project specification requires otherwise. The project basis must therefore be confirmed, not inferred from this plan.

Relevant standards may include:

- BS EN 1990 and UK National Annex;
- BS EN 1991-2 and UK National Annex/associated UK guidance;
- BS EN 1992-2 and UK National Annex where concrete bridge design is claimed; and
- project/client requirements governing assessment, modelling, and independent checking.

### 16.3 Professional review note

Chartered Engineer review is required before the skew solver is relied upon for design submission. Independent verification must match geometry, material, supports, loads, axes, signs, mesh convergence, and extraction locations. A visually similar contour is not an adequate comparison.

## 17. Lead reporting cadence

After each gate, report to the user:

- outcome first: pass, conditional, or fail;
- completed packets and integration hash;
- focused/full test and build state;
- key signed numerical evidence;
- deviations/risks and their engineering impact;
- whether the feature remains experimental; and
- the next parallel batch of at most three packets.

Do not flood the user with raw worker reports. Synthesize disagreements, explain the selected decision, and link the ledger/ADRs/evidence.
