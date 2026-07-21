# ADR: Skew plate shared data and API contracts

- **Status:** Accepted - independently reviewed for implementation
- **Date:** 2026-07-21
- **Scope:** Geometry, common geometry, mesh, supports, wheel patches, results, reactions, equilibrium, sections, verification status, warnings, compatibility, and downstream ownership
- **Integration baseline:** `feat/skew-plate-analysis` at `7f4c77f24b0712075b754f13a232b9d9e7ac9c13`
- **Depends on:** Accepted `docs/adr/ADR-skew-mathematical-conventions.md`
- **Amendment:** `CD-WP005-001` approved 2026-07-21 - compile-safe collision staging and real WP-021 normalizer boundary; no numerical, sign, warning-authority, or runtime-behaviour change

## 1. Decision, authority, and labels

This ADR freezes the shared contracts required by WP-003. It is normative for later work only after independent review and lead acceptance at G0. It does not activate a live type, validate the finite-element formulation, choose a benchmark tolerance, or authorize non-zero-skew engineering use.

The accepted mathematical ADR is authoritative for axes, signs, generalized degrees of freedom, physical rotations and couples, support actions, tensor transformations, equilibrium, and mirror parity. This ADR does not redefine those decisions.

Statements use these labels:

- **Observed:** current repository behavior at the integration baseline; evidence, not target authority.
- **Normative:** the required target contract and invariant.
- **Compatibility:** a temporary representation or conversion needed to preserve current behavior.
- **Staged:** a target shape declared before its named activation owner changes live producers and consumers.
- **Verify:** a later executable obligation. Numerical tolerances must name their source; none is invented here.

Only the lead may approve a contract deviation. The ADR remains **Proposed** until independent review. Chartered Engineer review remains required before design submission or reliance.

## 2. Layering, ownership, units, and absence rules

### 2.1 Single ownership boundary

**Normative.** Shared geometry primitives and the normalized slab geometry are owned by `src/solver/geometry/types.ts`. Solver types import them; app-facing types either import them or use the explicitly unit-suffixed transport forms defined here. No downstream packet may declare a private `Point2D`, `Polygon2D`, `Aabb`, `DeckEdge`, mesh-node, patch, equilibrium, quality, or verification-status lookalike.

### 2.1.1 Compile-safe WP-005 staging scheme

WP-005 must not collide with the live top-level `SlabGeometry`, `MeshNode`, `MeshElement`, `StructuredMesh`, `Support`, or `AnalysisResults` names. It therefore uses this exact temporary scheme:

```ts
// src/solver/geometry/types.ts - canonical shared primitives, final names now
export interface Point2D { x: number; y: number }
export type Polygon2D = Point2D[];
export interface Aabb { xMin: number; xMax: number; yMin: number; yMax: number }
export type DeckEdge = 'start' | 'end' | 'lower-side' | 'upper-side';
export interface SlabGeometry { /* Section 3.1 */ }

// src/solver/model/types.ts
import type * as SkewGeometryContract from '../geometry/types';
import type {
  DiagnosticWarning, ElementCenterPlateResult, MeshQualityReport, NodalKinematics,
  NodalRecoveredPlateResult, PhysicalActionTotals, SignedEquilibrium,
  SupportReactionRow, VerificationEvidenceStatus,
} from '../../app/types';
export declare namespace StagedSkewSolverContract {
  type NormalizedSlabGeometry = SkewGeometryContract.SlabGeometry;
  interface MeshNodeV2 {
    id: number; x: number; y: number; s: number; t: number;
  }
  interface MeshElementV2 {
    id: number;
    nodeIds: [number, number, number, number];
    polygon: SkewGeometryContract.Polygon2D;
    bounds: SkewGeometryContract.Aabb;
  }
  interface StructuredMeshV2 {
    sCoords: number[];
    tCoords: number[];
    /** @deprecated Exact same array object as sCoords; local, not global x. */
    xCoords: number[];
    /** @deprecated Exact same array object as tCoords; local, not global y. */
    yCoords: number[];
    nodes: MeshNodeV2[];
    elements: MeshElementV2[];
    nodeIdsByIJ: number[][];
    elementCountS: number;
    elementCountT: number;
  }
  type SupportDefinitionV2 = InternalNormalizedSupport;
  interface InternalNodalKinematicsV2 {
    nodeId: number; x: number; y: number; s: number; t: number;
    w: number; betaX: number; betaY: number;
  }
  interface InternalElementResultV2 {
    elementId: number; x: number; y: number; s: number; t: number;
    deflection: number; mx: number; my: number; mxy: number; qx: number; qy: number;
  }
  interface InternalNodalRecoveryV2 {
    nodeId: number; x: number; y: number; s: number; t: number;
    deflection: number; mx: number; my: number; mxy: number;
  }
  interface WheelPatchV2 {
    id: string;
    sourceWheelId: string;
    direction: AxisDirection;
    wheelLoadKn: number;
    pressureKnPerM2: number;
    patchLengthM: number;
    patchWidthM: number;
    center: SkewGeometryContract.Point2D;
    originalPolygon: SkewGeometryContract.Polygon2D;
    clippedPolygon: SkewGeometryContract.Polygon2D | null;
    originalBounds: SkewGeometryContract.Aabb;
    clippedBounds: SkewGeometryContract.Aabb | null;
    originalAreaM2: number;
    clippedAreaM2: number;
    clippedCentroid: SkewGeometryContract.Point2D | null;
  }
  interface FixedPositionAnalysisSummaryV2 {
    totalWheelLoadKn: number;
    totalAppliedLoadToSlabKn: number;
    totalVerticalReactionKn: number;
    minDeflectionM: number;
    maxDeflectionM: number;
    maxAbsMxKnmPerM: number;
    maxAbsMyKnmPerM: number;
    maxAbsMxyKnmPerM: number;
    maxAbsQxKnPerM: number;
    maxAbsQyKnPerM: number;
  }
  interface FixedPositionAnalysisResultV2 {
    geometry: NormalizedSlabGeometry;
    mesh: StructuredMeshV2;
    wheelPatches: WheelPatchV2[];
    internalNodalKinematics: InternalNodalKinematicsV2[];
    internalElementResults: InternalElementResultV2[];
    internalNodalRecovery: InternalNodalRecoveryV2[];
    physicalNodalKinematics: NodalKinematics[];
    physicalElementResults: ElementCenterPlateResult[];
    physicalNodalRecovery: NodalRecoveredPlateResult[];
    physicalSupportReactions: SupportReactionRow[];
    physicalReactionSummaryBySupport: Array<PhysicalActionTotals & { supportId: string }>;
    physicalReactionTotals: PhysicalActionTotals;
    equilibrium: SignedEquilibrium;
    meshQuality: MeshQualityReport;
    verificationEvidence: VerificationEvidenceStatus;
    summary: FixedPositionAnalysisSummaryV2;
    diagnostics: SolverDiagnostics;
    diagnosticWarnings: DiagnosticWarning[];
  }
}

// src/app/types.ts
import type * as SkewGeometryContract from '../solver/geometry/types';
export declare namespace StagedSkewAppContract {
  type SlabGeometryV2 = SkewGeometryContract.SlabGeometry;
  type ResultFieldV2 = 'deflection' | 'mx' | 'my' | 'mxy' | 'qx' | 'qy' | 'reactions';
  type EnvelopeFieldV2 = 'deflection' | 'mx' | 'my' | 'mxy';
  interface MeshNodeOverlayV2 {
    id: number; xM: number; yM: number; sM: number; tM: number;
  }
  interface MeshElementOverlayV2 {
    id: number;
    nodeIds: [number, number, number, number];
    polygon: Array<{ xM: number; yM: number }>;
    bounds: { xMinM: number; xMaxM: number; yMinM: number; yMaxM: number };
  }
  interface EnvelopePerNodeV2 {
    nodeId: number; xM: number; yM: number; sM: number; tM: number;
    max: number; min: number;
  }
  interface EnvelopeFieldDataV2<F extends EnvelopeFieldV2, U extends 'mm' | 'kN*m/m'> {
    field: F; points: EnvelopePerNodeV2[]; max: number; min: number;
    absMax: number; units: U;
  }
  interface EnvelopeWorstStationV2<F extends MomentField> {
    field: F; stationM: number; peakValue: number; peakAbs: number;
    nodeId: number; units: 'kN*m/m';
  }
  interface EnvelopeWorstStationsV2 {
    mx: EnvelopeWorstStationV2<'mx'>;
    my: EnvelopeWorstStationV2<'my'>;
    mxy: EnvelopeWorstStationV2<'mxy'>;
  }
  interface EnvelopeDataV2 {
    stationsRun: number; pathStartM: number; pathEndM: number; pathStepM: number;
    travelDirection: 'x+' | 'x-' | 'y+' | 'y-';
    computedAtIso: string; signature: string;
    fields: EnvelopeFieldMap;
    worstStations: EnvelopeWorstStationsV2;
  }
  interface SupportBaseV2 {
    id: string;
    name: string;
    restraint: SupportRestraint;
  }
  type SupportV2 =
    | (SupportBaseV2 & { kind: 'edge'; edge: SkewGeometryContract.DeckEdge })
    | (SupportBaseV2 & {
        kind: 'line'; x1M: number; y1M: number; x2M: number; y2M: number;
      })
    | (SupportBaseV2 & { kind: 'point'; xM: number; yM: number });
  type SectionSettingsV2 = SectionSettingsBridgeV4;
  type AnalysisResultsV2 =
    | IdleAnalysisResults
    | RunningAnalysisResults
    | SuccessAnalysisResults
    | ErrorAnalysisResults;
}
```

This block contains no documentary placeholder: every namespace member is legal TypeScript and is materialized by WP-005. Object records use `interface`; aliases and discriminated unions use `type`. WP-005 also declares every referenced, non-colliding top-level contract from Sections 3-12 before these aliases. No top-level `StagedSlabGeometry`, `TargetMeshNode`, or similar alias is permitted. The only temporary names for colliding live types are the exact `V2` members of the two namespaces above, imported through the exact module paths shown. Shared primitives are aliases/imports from `src/solver/geometry/types.ts`, never namespace-local lookalikes. This expanded collision list is the approved `CD-WP005-001` correction: it prevents a target import such as live `EnvelopeData` from silently resolving to the legacy contract while preserving the live application until WP-032B.

Namespace-member ownership is exact. WP-014A promotes and removes app `SlabGeometryV2`. WP-020 promotes and removes `MeshNodeV2`, `MeshElementV2`, and `StructuredMeshV2`, retaining the required deprecated axes in the promoted mesh. WP-021 consumes `SupportDefinitionV2` from its leased support implementation/tests but neither promotes nor removes it. WP-022 likewise consumes `WheelPatchV2` from its leased load implementation/tests but neither promotes nor removes it. WP-026, whose lease includes final solver model/type activation, promotes and removes `NormalizedSlabGeometry`, `SupportDefinitionV2`, `InternalNodalKinematicsV2`, `InternalElementResultV2`, `InternalNodalRecoveryV2`, `WheelPatchV2`, `FixedPositionAnalysisSummaryV2`, and `FixedPositionAnalysisResultV2`; it also activates the solver-support input bridge. WP-027 promotes and removes app `SupportBaseV2`/`SupportV2`. WP-032B promotes and removes app `ResultFieldV2`, `EnvelopeFieldV2`, `MeshNodeOverlayV2`, `MeshElementOverlayV2`, `EnvelopePerNodeV2`, `EnvelopeFieldDataV2`, `EnvelopeWorstStationV2`, `EnvelopeWorstStationsV2`, `EnvelopeDataV2`, `SectionSettingsV2`, and `AnalysisResultsV2` atomically with its app-result shape. WP-032A owns facade compatibility retention/removal within its lease; WP-050 performs the final repository audit and only the plan-authorized minimal integration fixes specified below. No packet promotes or removes a namespace member outside its write lease.

The no-lookalike rule applies immediately to canonical primitives and to all code outside these two namespaces. The namespaces are the sole, time-bounded exception needed for compile-safe declaration; they must alias canonical primitives and cannot become runtime producers.

The data path has four deliberate layers. During WP-005 staging only, `src/solver/model/types.ts` has a type-only import of the app-owned, unit-suffixed facade/result transport contracts referenced by `FixedPositionAnalysisResultV2`. It creates no runtime edge and must not be used by solver kernels. WP-026 removes that staged aggregate; WP-032A then owns the real solver-facade transport boundary. This narrow direction is approved by `CD-WP005-001`; moving or duplicating those app-facing shapes into the core solver is prohibited.

1. persisted/app input, with unit-suffixed public fields;
2. app-to-solver translation, which normalizes legacy input exactly once;
3. internal solver data, using the base units and global/local coordinates below; and
4. solver-facade/app-result transport, with explicit physical names and unit-bearing metadata.

`fromAppModel` owns input translation. `src/solver/index.ts` owns solver-facade transport. `src/app/solverAdapter.ts` owns runtime validation and app normalization. Geometry formulae, sign conversions, patch clipping, and reaction deduplication must not be reimplemented in those boundary files.

### 2.2 Base units and coordinate naming

**Normative.** Unless a field suffix or literal unit says otherwise:

| Quantity | Internal base unit / meaning |
|---|---|
| `x`, `y`, `s`, `t`, lengths, bounds, area roots | m |
| area | m2 |
| angle inputs | deg |
| rotation/director values | rad, dimensionless in algebra |
| force and vertical action | kN |
| pressure | kN/m2 |
| physical or generalized nodal couple | kN*m |
| plate moment components `mx`, `my`, `mxy` | kN*m/m |
| transverse shear resultants `qx`, `qy` | kN/m |
| deflection in solver kinematics | m |
| deflection in contour/envelope presentation | mm |

Internal geometry fields use `x/y/s/t`; app and transport geometry fields use `xM/yM/sM/tM`. A boundary may rename but must not rescale those four coordinates. Unit strings in result packets are fixed literals, not arbitrary labels.

### 2.3 Required, optional, nullable, and empty

**Normative.** Required structural fields are never silently defaulted by the app adapter. Optionality is permitted only where this ADR writes `?`. Geometric absence is represented by `null`, not by a zero-area fabricated rectangle. Collections with no members use `[]`. A failed or malformed required payload produces an error result; it is not converted to zero, `passed`, or an empty successful solve.

All IDs are stable within one solve. Node and element IDs are non-negative integers, unique, and index their corresponding solver arrays in the first release. Support and wheel-patch IDs are non-empty and unique in their collection.

## 3. Slab geometry and deck-coordinate ownership

### 3.1 Canonical normalized geometry

**Normative.** The canonical shared type is:

```ts
export interface SlabGeometry {
  lengthM: number;
  widthM: number;
  thicknessM: number;
  skewAngleDeg: number;
}

export interface LegacySolverSlabGeometryInput {
  lengthX: number;
  lengthY: number;
  thickness: number;
  skewAngleDeg?: number;
}

export function normalizeSolverGeometry(
  input: LegacySolverSlabGeometryInput,
): SlabGeometry {
  return {
    lengthM: input.lengthX,
    widthM: input.lengthY,
    thicknessM: input.thickness,
    skewAngleDeg: input.skewAngleDeg ?? 0,
  };
}
```

All four fields are finite. Length, width, and thickness are positive. Persisted app input is limited to the agreed inclusive range `-45 <= skewAngleDeg <= 45`. `lengthM` is the centreline span in global `x`; `widthM` is measured in global `y`. Vehicle `headingDeg` is unrelated and cannot supply `skewAngleDeg`.

**Observed.** The app currently uses `lengthM/widthM/thicknessM` without skew. The solver currently has a separate `SlabGeometry` with `lengthX/lengthY/thickness`.

**Compatibility.** WP-005 leaves the live solver's existing top-level `SlabGeometry` name and rectangular fields intact and additively adds only `skewAngleDeg?: number` to that live input; `LegacySolverSlabGeometryInput` freezes that exact structural form. The target is declared separately as `StagedSkewSolverContract.NormalizedSlabGeometry`; no competing top-level alias is added. WP-015 activates the exact pure mapping above: `lengthX -> lengthM`, `lengthY -> widthM`, `thickness -> thicknessM`, and absent skew -> exact zero. Every skew-capable kernel accepts only the required normalized result. The old zero-skew `FixedPositionAnalysisModel` call remains valid during the bridge. WP-026 removes the legacy shape from internal kernel calls but retains it as the explicitly named external facade input. WP-032A owns retaining or removing that facade compatibility within its facade lease; if retained, WP-050 removes it only as an approved minimal integration fix after the external-consumer audit. No kernel accepts optional skew and no branch infers geometry form from field presence.

### 3.2 Deck-local contract and exact zero-skew branch

```ts
export interface DeckLocalPoint {
  s: number;
  t: number;
}

export interface DeckEdgeFrame {
  edge: DeckEdge;
  segment: readonly [Point2D, Point2D];
  tangent: Point2D;
  inwardNormal: Point2D;
  outwardNormal: Point2D;
  lengthM: number;
}
```

**Normative.** One pure deck-coordinate module is the only owner of:

```ts
deckLocalToGlobal(geometry: SlabGeometry, local: DeckLocalPoint): Point2D
globalToDeckLocal(geometry: SlabGeometry, point: Point2D): DeckLocalPoint
buildDeckPolygon(geometry: SlabGeometry): Polygon2D
getDeckEdgeSegment(geometry: SlabGeometry, edge: DeckEdge): readonly [Point2D, Point2D]
getDeckBounds(geometry: SlabGeometry): Aabb
getSupportOffset(geometry: SlabGeometry): number
getNormalSpan(geometry: SlabGeometry): number
getSupportAxes(geometry: SlabGeometry, edge: DeckEdge): DeckEdgeFrame
```

The affine mapping is exactly the accepted mathematical ADR. For `skewAngleDeg === 0` (including normalized negative zero), both transforms take a direct branch: global `(x,y)=(s,t)` and local `(s,t)=(x,y)`. That branch also returns the exact rectangular vertices and bounds without evaluating trigonometric functions. This is a behavioral requirement, not merely a tolerance check.

Edge frames use these canonical directions:

- `start` and `end`: segment and tangent run from lower to upper, increasing `t`;
- `lower-side` and `upper-side`: segment and tangent run from start to end, increasing `s`;
- inward/outward normals are geometry-derived and unit length;
- start/end frames reproduce the accepted `n+` and increasing-`t` tangent convention exactly.

`s/t` are oblique affine parameters, not Cartesian tensor axes. No result or reaction component is relabelled as an `s/t` component.

## 4. Common geometry contracts

```ts
export interface Point2D {
  x: number;
  y: number;
}

export type Polygon2D = Point2D[];

export interface Aabb {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export type DeckEdge = "start" | "end" | "lower-side" | "upper-side";
```

**Normative.** `Point2D` is a global Cartesian point unless a containing field explicitly says otherwise. A non-empty physical `Polygon2D` has at least three unique finite vertices, is convex for this release, uses counter-clockwise winding, and does not repeat its first vertex at the end. Its signed area is positive after scale-aware cleanup. Clipping absence is `null`; a degenerate two-point or zero-area object is never passed as a physical polygon.

The deck polygon vertex order is `start-lower`, `end-lower`, `end-upper`, `start-upper`. Element polygons follow local Q4 nodes 1, 2, 3, 4 and the same counter-clockwise convention. Original and clipped patch polygons are also counter-clockwise.

An `Aabb` contains finite extrema with `xMin <= xMax` and `yMin <= yMax`. It is broad-phase metadata, camera metadata, or a diagnostic bound only. It is never used as a substitute for a deck, element, patch, or section polygon in physical clipping, integration, point-in-polygon checks, or rendering.

Scale-aware duplicate/collinear cleanup, winding normalization, clipping, area, centroid, first moments, and triangulation are owned by WP-013. Consumers cannot apply private fixed decimal rounding or a second clipping tolerance.

## 5. Structured mesh and transport

```ts
export interface MeshNode {
  id: number;
  x: number;
  y: number;
  s: number;
  t: number;
}

export interface MeshElement {
  id: number;
  nodeIds: [number, number, number, number];
  polygon: Polygon2D;
  bounds: Aabb;
}

export interface StructuredMesh {
  sCoords: number[];
  tCoords: number[];
  /** @deprecated Exact same array object as sCoords; local, not global x. */
  xCoords: number[];
  /** @deprecated Exact same array object as tCoords; local, not global y. */
  yCoords: number[];
  nodes: MeshNode[];
  elements: MeshElement[];
  nodeIdsByIJ: number[][];
  elementCountS: number;
  elementCountT: number;
}

export interface MeshNodeOverlay {
  id: number;
  xM: number;
  yM: number;
  sM: number;
  tM: number;
}

export interface MeshElementOverlay {
  id: number;
  nodeIds: [number, number, number, number];
  polygon: Array<{ xM: number; yM: number }>;
  bounds: { xMinM: number; xMaxM: number; yMinM: number; yMaxM: number };
}
```

**Normative.** `sCoords` and `tCoords` are finite, strictly increasing, include exact deck limits `0/L` and `0/W`, and contain any accepted forced local coordinates once. `nodeIdsByIJ[j][i]` uses `j` for `t` and `i` for `s`. Nodes are generated in increasing `t`, then increasing `s`; element connectivity is lower-left, lower-right, upper-right, upper-left in local coordinates. Every stored polygon is coordinate-identical to its referenced nodes or is derived from those nodes on demand. Bounds contain the actual polygon.

The mesh remains topologically structured but is not globally rectilinear. An element centre is Q4 interpolation at natural `(0,0)`, not its AABB midpoint. No global `x` or `y` axis array exists for a skew mesh.

**Observed.** The live mesh exposes `xCoords/yCoords`, `elementCountX/Y`, nodes without local coordinates, and element rectangles through `bounds`.

**Compatibility and removal.** `StagedSkewSolverContract.StructuredMeshV2` has required deprecated `xCoords/yCoords` aliases while any live consumer needs them. WP-020 assigns `xCoords === sCoords` and `yCoords === tCoords`, including object identity, and never constructs separate values. They are local coordinates and never claim to enumerate global axes. WP-032A removes `mesh.xCoordsM/yCoordsM` from the solver-facade payload; WP-032B removes app `MeshOverlay`/`AnalysisResults.mesh`. After viewer, probe, section, envelope, facade, and test consumers use nodes, topology, polygons, and bounds, WP-050 is the exact owner that removes the internal `xCoords/yCoords` members from `StructuredMesh` and verifies no consumer remains.

## 6. Supports, restraints, topology, and spring meaning

### 6.1 Authored support union

```ts
export type PhysicalSupportDof = "w" | "rotationX" | "rotationY";

export type SupportDofConstraint =
  | { kind: "free" }
  | { kind: "fixed" }
  | { kind: "spring"; stiffness: number };

export interface PhysicalSupportDofConstraints {
  w: SupportDofConstraint;
  rotationX: SupportDofConstraint;
  rotationY: SupportDofConstraint;
}

export type SupportRestraint =
  | { behavior: "fixed" }
  | { behavior: "pinned" }
  | { behavior: "custom"; dofs: PhysicalSupportDofConstraints };

export interface SupportBase {
  id: string;
  name: string;
  restraint: SupportRestraint;
}

export interface EdgeSupport extends SupportBase {
  kind: "edge";
  edge: DeckEdge;
}

export interface LineSupport extends SupportBase {
  kind: "line";
  x1M: number;
  y1M: number;
  x2M: number;
  y2M: number;
}

export interface PointSupport extends SupportBase {
  kind: "point";
  xM: number;
  yM: number;
}

export type Support = EdgeSupport | LineSupport | PointSupport;

export type GeneralizedSupportDof = 'w' | 'betaX' | 'betaY';
export interface NormalizedGeneralizedDofConstraints {
  w: SupportDofConstraint;
  betaX: SupportDofConstraint;
  betaY: SupportDofConstraint;
}
export type NormalizedSupportRestraint =
  | { behavior: 'fixed' }
  | { behavior: 'pinned' }
  | { behavior: 'custom'; dofs: NormalizedGeneralizedDofConstraints };
export type InternalNormalizedSupport =
  | { id: string; kind: 'edge'; edge: DeckEdge; restraint: NormalizedSupportRestraint }
  | {
      id: string; kind: 'line'; x1: number; y1: number; x2: number; y2: number;
      restraint: NormalizedSupportRestraint;
    }
  | { id: string; kind: 'point'; x: number; y: number; restraint: NormalizedSupportRestraint };
```

**Normative.** Support geometry is discriminated only by `kind`. Preset meaning is discriminated only by `restraint.behavior`:

- `fixed`: restrain `w`, `rotationX`, and `rotationY`;
- `pinned`: restrain `w` only; both rotations are free;
- `custom`: use all three required component constraints.

There is no per-DOF `pinned` value. A preset has no simultaneous custom `dofs`, so contradictory preset/custom values are unrepresentable. Prescribed non-zero displacements and rotations are out of scope.

Public and persisted support coordinates are global metres and therefore carry `M` suffixes. Only `InternalNormalizedSupport`, produced once by `fromAppModel`, uses unsuffixed internal `x/y` coordinates and generalized `betaX/betaY` names. Public rotation constraints are physical right-hand rotations. The app-to-solver mapping follows the accepted ADR: physical `rotationX` acts on internal `betaY`; physical `rotationY` acts on internal `betaX`; `w` maps to `w`. Zero fixed values and positive scalar spring energies require the axis swap but no sign-modified stiffness.

**Compatibility.** Current app `uz/rx/ry` constraints are legacy semantics. During the WP-027 saved-model migration, `uz -> w`, legacy `rx` (current `betaX`) maps to physical `rotationY`, and legacy `ry` (current `betaY`) maps to physical `rotationX`. A legacy per-component `pinned` is first resolved by the current rule (`uz` fixed, rotational components free), then migrated. This preserves zero-skew structural behavior. Legacy names may exist only in migration input and the raw WP-001 characterization boundary after WP-027.

The solver-support transition is an explicit discriminator bridge, not a bare structural union:

```ts
export type LegacyGeneralizedCoordinateSupportInput =
  | {
      id?: string; behavior?: 'fixed' | 'pinned' | 'custom';
      kind: 'line'; x1: number; y1: number; x2: number; y2: number;
      dofs?: { w?: SupportDofConstraint; rx?: SupportDofConstraint; ry?: SupportDofConstraint };
    }
  | {
      id?: string; behavior?: 'fixed' | 'pinned' | 'custom';
      kind: 'point'; x: number; y: number;
      dofs?: { w?: SupportDofConstraint; rx?: SupportDofConstraint; ry?: SupportDofConstraint };
    };

export type SolverSupportInputBridgeV2 =
  | {
      supportInputSchema?: never;
      supports: LegacyGeneralizedCoordinateSupportInput[];
    }
  | {
      supportInputSchema: 'physical-v2';
      supports: StagedSkewSolverContract.SupportDefinitionV2[];
    };

export type FixedPositionAnalysisModelInputV2 =
  Omit<FixedPositionAnalysisModel, 'supports'> & SolverSupportInputBridgeV2;

export type NormalizeSolverSupports = (
  input: SolverSupportInputBridgeV2,
) => StagedSkewSolverContract.SupportDefinitionV2[];
```

WP-005 declares these names without changing the live `FixedPositionAnalysisModel.supports` member. `NormalizeSolverSupports` is deliberately a callable type, not an ambient value export from a real `.ts` module. WP-021 implements and tests the real `normalizeSolverSupports` value in its leased `src/solver/core/supports.ts` and annotates that export with `NormalizeSolverSupports`; it treats an absent discriminator only as the frozen legacy route and the exact literal only as the physical route, but it neither changes the shared live model type nor removes the staged member. Existing `fromAppModel` output therefore remains valid. WP-026 promotes `SupportDefinitionV2`, `FixedPositionAnalysisModelInputV2`, and the bridge into the live solver model types and removes the staged support member. WP-027 atomically changes `fromAppModel` to emit `supportInputSchema: 'physical-v2'`. WP-032A owns retaining or removing the external legacy generalized-coordinate facade route; WP-050 audits the outcome and removes any retained route only through its plan-authorized minimal integration-fix mechanism. No member is guessed from shape. This callable-type correction is approved by `CD-WP005-001`; a declaration erased from emitted JavaScript is not an acceptable promise of a runtime export.

### 6.1.1 Deterministic saved-model versions

Saved models use an explicit top-level integer discriminator after the implicit legacy format. The following immutable snapshots freeze every persisted common/input field; no version is derived from, or widened when, mutable live `SlabModel` changes:

```ts
export interface LegacyRectangularGeometry {
  lengthM: number;
  widthM: number;
  thicknessM: number;
}

export type LegacyConstraintSetting =
  | { type: 'free' | 'fixed' | 'pinned' }
  | { type: 'spring'; stiffness: number };
export type LegacyConstraintSet = Record<'uz' | 'rx' | 'ry', LegacyConstraintSetting>;
export type LegacyCoordinateSupport =
  | {
      id: string; name: string; kind: 'line'; constraints: LegacyConstraintSet;
      x1: number; y1: number; x2: number; y2: number;
    }
  | {
      id: string; name: string; kind: 'point'; constraints: LegacyConstraintSet;
      x: number; y: number;
    };

export interface PersistedMaterialSnapshotV1 {
  elasticModulusMPa: number; poisson: number; densityKnPerM3: number;
}
export interface PersistedMeshSnapshotV1 {
  density: number; autoTargetElementM: number;
}
export interface PersistedAxleSnapshotV1 {
  id: string; spacingFromPreviousM: number; axleLoadKn: number;
}
export interface PersistedDirectWheelSnapshotV1 {
  id: string; xM: number; yM: number; loadKn: number;
  patchLongM: number; patchTransM: number;
}
export interface PersistedVehicleSnapshotV1 {
  name: string; mode: 'axle' | 'direct'; transverseSpacingM: number;
  wheelsPerAxle: number; wheelPatchLongM: number; wheelPatchTransM: number;
  axleInputs: PersistedAxleSnapshotV1[];
  directWheels: PersistedDirectWheelSnapshotV1[];
}
export interface PersistedPlacementSnapshotV1 {
  centerXM: number; centerYM: number; headingDeg: number; transverseOffsetM: number;
  travelDirection: 'x+' | 'x-' | 'y+' | 'y-';
  pathStartM: number; pathEndM: number; pathStepM: number;
}
export interface PersistedDisplaySnapshotV1 {
  plotMode: 'results' | 'structure' | 'deformed';
  mesh: boolean; supports: boolean; wheelPatches: boolean;
  contours: boolean; tables: boolean;
}
export interface PersistedModelCommonSnapshotV1 {
  projectName: string;
  description: string;
  assumptions: string;
  material: PersistedMaterialSnapshotV1;
  mesh: PersistedMeshSnapshotV1;
  vehicle: PersistedVehicleSnapshotV1;
  placement: PersistedPlacementSnapshotV1;
  display: PersistedDisplaySnapshotV1;
}
export interface PersistedLegacySectionSettingsV1 {
  axis: 'auto' | 'x' | 'y'; centerPerpM: number; widthM: number;
}
export type PersistedDeckSectionSettingsV1 =
  | { mode: 'longitudinal'; ordinate: SectionOrdinate; centerTM: number; widthM: number }
  | { mode: 'transverse'; ordinate: SectionOrdinate; centerSM: number; widthM: number };

export interface SectionSettingsBridgeV4 extends PersistedLegacySectionSettingsV1 {
  deck: PersistedDeckSectionSettingsV1;
}

export type PersistedModelV1Implicit = PersistedModelCommonSnapshotV1 & {
  schemaVersion?: never;
  supportSchema?: never;
  sectionSchema?: never;
  geometry: LegacyRectangularGeometry;
  supports: LegacyCoordinateSupport[];
  section: PersistedLegacySectionSettingsV1;
};

export type PersistedModelV2SkewLegacySupports = PersistedModelCommonSnapshotV1 & {
  schemaVersion: 2;
  supportSchema: 'legacy-generalized-v1';
  sectionSchema?: never;
  geometry: SlabGeometry;
  supports: LegacyCoordinateSupport[];
  section: PersistedLegacySectionSettingsV1;
};

export type PersistedModelV3PhysicalSupports = PersistedModelCommonSnapshotV1 & {
  schemaVersion: 3;
  supportSchema: 'physical-v1';
  sectionSchema?: never;
  geometry: SlabGeometry;
  supports: Support[];
  section: PersistedLegacySectionSettingsV1;
};

export type PersistedModelV4SectionBridge = PersistedModelCommonSnapshotV1 & {
  schemaVersion: 4;
  supportSchema: 'physical-v1';
  sectionSchema: 'section-bridge-v1';
  geometry: SlabGeometry;
  supports: Support[];
  section: SectionSettingsBridgeV4;
};

export type PersistedModelV5DeckOnly = PersistedModelCommonSnapshotV1 & {
  schemaVersion: 5;
  supportSchema: 'physical-v1';
  sectionSchema: 'deck-local-v1';
  geometry: SlabGeometry;
  supports: Support[];
  section: PersistedDeckSectionSettingsV1;
};

export type LoadablePersistedModel =
  | PersistedModelV1Implicit
  | PersistedModelV2SkewLegacySupports
  | PersistedModelV3PhysicalSupports
  | PersistedModelV4SectionBridge
  | PersistedModelV5DeckOnly;
```

WP-014B owns V1-to-V2 loading and saving: absent `schemaVersion` is V1, missing skew becomes exactly zero, and every save before WP-027 writes V2. WP-014B accepts V2 only when `supportSchema` and the legacy support and section shapes agree. WP-027 owns V1/V2-to-V3 support migration and makes every save before WP-032B V3. It applies the fixed `uz/rx/ry` mapping above. Every legacy coordinate `line` becomes a physical `LineSupport` with the same ordered endpoints renamed `x1M/y1M/x2M/y2M`; it never becomes `EdgeSupport`, even when geometrically coincident with a deck edge. Every legacy coordinate `point` becomes `PointSupport` with `xM/yM`. Only a newly authored explicit edge identity can produce `EdgeSupport`.

WP-032B alone owns V1/V2/V3-to-V4 migration, defaulting, sanitization, and saving under its `src/app/types.ts`/`src/app/defaults.ts` lease. It promotes `SectionSettingsV2` as the live `SectionSettingsBridgeV4`, so current consumers still compile against `axis/centerPerpM/widthM`, while new consumers use `.deck`. The conversion is exact: the legacy view is preserved; legacy `axis: 'x'` maps `.deck` to longitudinal, `axis: 'y'` to transverse, and `axis: 'auto'` resolves to `x` for `x+|x-` travel or `y` for `y+|y-` travel. Longitudinal maps `centerPerpM -> centerTM`; transverse maps it to `centerSM`; both preserve `widthM` and set `ordinate: 'mx'`. V4 validation requires that the legacy view and `.deck` agree under that rule, and every save through WP-045 writes synchronized V4. WP-032C owns adapter normalization only and has no persistence, migration, sanitizer, default, or save ownership.

WP-033 reads only `section.deck`. WP-041A edits `.deck` and synchronizes the legacy view while it exists: longitudinal writes `axis: 'x'`/`centerPerpM = centerTM`; transverse writes `axis: 'y'`/`centerPerpM = centerSM`; both copy `widthM`. WP-041B migrates the legacy section reads in its leased `Viewport.tsx`; WP-043 and WP-045 migrate overlay and report consumers respectively. After those consumers move, WP-050 uses its plan-authorized minimal integration-fix mechanism to atomically replace live `SectionSettingsBridgeV4` with the deck-only settings, own exact V4-to-V5 migration (`section = v4.section.deck` after bridge validation), make subsequent saves V5, and remove the legacy view. There is no red compile interval.

There is no field-shape or value-shape guessing. An absent version with V2-V5-only fields, a declared version with the wrong `supportSchema` or `sectionSchema`, an unsupported future version, a physical support inside V1/V2, a deck-local section inside V1-V3, a mismatched V4 bridge, or a legacy view inside V5 fails with a versioned migration error. V3-V5 never interpret `rx/ry`; V5 never interprets legacy `axis`. Import sanitization occurs only after the version-specific parser has accepted the discriminator and exact snapshot shape.

The unsuffixed support coordinates in V1/V2 are read-only historical compatibility fields, not the public target convention. V3-V5 physical-support models use `x1M/y1M/x2M/y2M` or `xM/yM`. Only the internal normalized solver union uses unsuffixed coordinates after V3 activation.

### 6.2 Mapping and topology

**Normative.** Edge supports map by `nodeIdsByIJ` topology, never by coordinate tolerance:

- `start`: `i=0` for all `j`;
- `end`: `i=last` for all `j`;
- `lower-side`: `j=0` for all `i`;
- `upper-side`: `j=last` for all `i`.

Edge nodes are ordered along the canonical edge frame in Section 3. A retained point support is inverse-mapped before axis generation by WP-020, injects its local `s/t` coordinates, and is confirmed by physical Euclidean node distance in WP-021. A retained coordinate line uses its public global `x1M/y1M/x2M/y2M` endpoints, translated once to the normalized internal fields. An inclined line is accepted only when the existing mesh already contains exact member nodes under the shared scale-aware point-to-segment test. It does not force an arbitrary internal mesh line. Axis-aligned zero-skew line and point supports preserve existing behavior. Unsupported internal lines fail with the support ID and reason.

### 6.3 Spring contract

**Normative.** `stiffness` is positive and means component stiffness:

- point `w`: kN/m;
- point `rotationX/rotationY`: kN*m/rad;
- line or edge `w`: total kN/m for the complete support;
- line or edge rotations: total kN*m/rad for the complete support.

It is not a per-length modulus. Line and edge totals are distributed using non-negative Euclidean tributary lengths in canonical support-node order. Fractions sum to one and nodal component stiffnesses sum to the authored total. A one-node line receives the total. A future per-length value requires a separate `stiffnessPerLength` field and a contract deviation; `stiffness` cannot be overloaded.

Raw solver spring products use `+k*u` internally but public support actions are normalized to `-k*u` before aggregation, as required by the accepted ADR.

### 6.4 Duplicate fixed constraints and shared corners

**Normative reporting attribution.** A fixed global DOF is solved and counted once globally even if several support definitions claim it. The solver does not determine a unique physical distribution of that single action between coincident ideal constraints. Solely for per-support reporting, duplicate assignments by the same support ID are collapsed, the distinct claiming support IDs are sorted, and the normalized fixed action is partitioned equally among them. Each emitted fixed reaction row carries `attributionFraction = 1 / claimantCount` and the complete sorted `sharedBySupportIds`. Fractions for one fixed global DOF sum to one. Reports and plots must label this as equal shared-corner reporting attribution, not a calculated physical load split.

Spring assignments are physical separate supports: their stiffnesses and normalized external actions sum. They are not fixed-action duplicates and each has `attributionFraction = 1`. This rule makes global totals and the sum of per-support totals identical without absolute values or double counting.

## 7. Wheel patches and overlays

```ts
export type AxisDirection = '+x' | '-x' | '+y' | '-y';

export interface WheelPatch {
  id: string;
  sourceWheelId: string;
  direction: AxisDirection;
  wheelLoadKn: number;
  pressureKnPerM2: number;
  patchLengthM: number;
  patchWidthM: number;
  center: Point2D;
  originalPolygon: Polygon2D;
  clippedPolygon: Polygon2D | null;
  originalBounds: Aabb;
  clippedBounds: Aabb | null;
  originalAreaM2: number;
  clippedAreaM2: number;
  clippedCentroid: Point2D | null;
}

export interface WheelPatchOverlay {
  id: string;
  sourceWheelId: string;
  originalPolygon: Array<{ xM: number; yM: number }>;
  clippedPolygon: Array<{ xM: number; yM: number }> | null;
  originalBounds: { xMinM: number; xMaxM: number; yMinM: number; yMaxM: number };
  clippedBounds: { xMinM: number; xMaxM: number; yMinM: number; yMaxM: number } | null;
  originalAreaM2: number;
  clippedAreaM2: number;
  clippedCentroidM: { xM: number; yM: number } | null;
  wheelLoadKn: number;
  pressureKnPerM2: number;
}
```

**Normative.** `originalPolygon` is the complete axis-direction-aligned wheel contact rectangle in global coordinates. `clippedPolygon` is its intersection with the actual deck polygon. Both use the common winding rules. Off-deck or tangent zero-area patches retain their original data and use `null` clipped geometry, zero clipped area, and null clipped centroid/bounds.

`originalAreaM2 = patchLengthM * patchWidthM` and `pressureKnPerM2 = wheelLoadKn / originalAreaM2`. Pressure is never recomputed from clipped area. Applied vertical force is positive downward and equals `pressureKnPerM2 * clippedAreaM2` before consistent nodal distribution. The original and clipped polygon first moments are available to verification; AABBs are broad phase only.

`direction` remains `+x | -x | +y | -y`. `headingDeg` does not rotate the patch in this release. The facade transports both original and clipped overlays, but the deck load fill and outline render from `clippedPolygon` only. No facade filter may discard an off-deck original patch or replace a clipped polygon with its original bounds.

**Observed.** The current solver carries original/clipped rectangles, filters out null clips at the facade, and renders the original AABB for retained patches. WP-022 implements polygon generation and deck clipping against staged `WheelPatchV2` without promoting a shared model type; WP-024 implements physical polygon integration against that staged contract; WP-026 promotes the shared wheel-patch/result types; WP-032A transports both overlays; WP-043 removes rectangle rendering.

## 8. Results, recovery locations, envelopes, and quality

### 8.1 Field names, signs, and locations

```ts
export type ResultField =
  | "deflection"
  | "mx"
  | "my"
  | "mxy"
  | "qx"
  | "qy"
  | "reactions";

export type MomentField = "mx" | "my" | "mxy";
export type EnvelopeField = "deflection" | MomentField;
export type FieldLocation = "node" | "element-center";

export interface NodalKinematics {
  nodeId: number;
  xM: number;
  yM: number;
  sM: number;
  tM: number;
  wM: number;
  rotationXRad: number;
  rotationYRad: number;
}

export interface NodalRecoveredPlateResult {
  nodeId: number;
  xM: number;
  yM: number;
  sM: number;
  tM: number;
  deflectionMm: number;
  mxKnmPerM: number;
  myKnmPerM: number;
  mxyKnmPerM: number;
}

export interface ElementCenterPlateResult {
  elementId: number;
  xM: number;
  yM: number;
  sM: number;
  tM: number;
  deflectionMm: number;
  mxKnmPerM: number;
  myKnmPerM: number;
  mxyKnmPerM: number;
  qxKnPerM: number;
  qyKnPerM: number;
}
```

**Normative.** All values are signed according to the accepted mathematical ADR. `rotationX/rotationY` are physical right-hand rotations, not legacy `rx/ry`. `mx/my/mxy` are raw components of the symmetric plate-moment tensor in orthonormal global roadway axes. `qx/qy` are global shear-resultant components. Support-axis transformed moments are separately named `mnn/mtt/mnt`; they never replace or relabel raw global fields.

`mxy` is required wherever `mx/my` are available: raw element results, approved nodal recovery, contours, extrema, envelopes, worst-station capture, selectors, legends, sections, print capture, and reports.

The conservative first-release recovery contract exposes `qx/qy` at element centres. They are not nodal recovered values and are not eligible for nodal extrema, section ordinates, or nodal envelopes. WP-030 may only promote nodal shear through an approved contract deviation backed by its required recovery-location, mirror, thin/thick, and convergence evidence. App `nodalContours` may retain optional typed `qx/qy` keys during staged compilation, but the normalized target payload omits them.

### 8.2 Contour and envelope transport

```ts
export interface NodalFieldPoint {
  nodeId: number;
  xM: number;
  yM: number;
  sM: number;
  tM: number;
  value: number;
}

export interface ElementFieldPoint {
  elementId: number;
  xM: number;
  yM: number;
  sM: number;
  tM: number;
  value: number;
}

export type ResultUnits = 'mm' | 'kN*m/m' | 'kN/m';

export interface FieldDataBase<
  F extends Exclude<ResultField, 'reactions'>,
  L extends FieldLocation,
  U extends ResultUnits,
  P,
> {
  field: F;
  location: L;
  points: P[];
  min: number;
  max: number;
  units: U;
}

export type NodalDeflectionFieldData =
  FieldDataBase<'deflection', 'node', 'mm', NodalFieldPoint>;
export type NodalMxFieldData =
  FieldDataBase<'mx', 'node', 'kN*m/m', NodalFieldPoint>;
export type NodalMyFieldData =
  FieldDataBase<'my', 'node', 'kN*m/m', NodalFieldPoint>;
export type NodalMxyFieldData =
  FieldDataBase<'mxy', 'node', 'kN*m/m', NodalFieldPoint>;

export interface NodalFieldMap {
  deflection: NodalDeflectionFieldData;
  mx: NodalMxFieldData;
  my: NodalMyFieldData;
  mxy: NodalMxyFieldData;
}

export type ElementDeflectionFieldData =
  FieldDataBase<'deflection', 'element-center', 'mm', ElementFieldPoint>;
export type ElementMxFieldData =
  FieldDataBase<'mx', 'element-center', 'kN*m/m', ElementFieldPoint>;
export type ElementMyFieldData =
  FieldDataBase<'my', 'element-center', 'kN*m/m', ElementFieldPoint>;
export type ElementMxyFieldData =
  FieldDataBase<'mxy', 'element-center', 'kN*m/m', ElementFieldPoint>;
export type ElementQxFieldData =
  FieldDataBase<'qx', 'element-center', 'kN/m', ElementFieldPoint>;
export type ElementQyFieldData =
  FieldDataBase<'qy', 'element-center', 'kN/m', ElementFieldPoint>;

export interface ElementFieldMap {
  deflection: ElementDeflectionFieldData;
  mx: ElementMxFieldData;
  my: ElementMyFieldData;
  mxy: ElementMxyFieldData;
  qx: ElementQxFieldData;
  qy: ElementQyFieldData;
}

export interface EnvelopeFieldMap {
  deflection: StagedSkewAppContract.EnvelopeFieldDataV2<'deflection', 'mm'>;
  mx: StagedSkewAppContract.EnvelopeFieldDataV2<'mx', 'kN*m/m'>;
  my: StagedSkewAppContract.EnvelopeFieldDataV2<'my', 'kN*m/m'>;
  mxy: StagedSkewAppContract.EnvelopeFieldDataV2<'mxy', 'kN*m/m'>;
}
```

The colliding live envelope names remain legacy until WP-032B. Their exact target definitions are the `StagedSkewAppContract.*V2` members in Section 2.1.1; `EnvelopeFieldMap` is non-colliding and references those members directly. Inline or intersection lookalikes are prohibited.

The map interfaces are closed and required on a successful solve. Their key, embedded `field`, `location`, point kind, and `units` are correlated by construction; a value for one key cannot legally carry another field name or unit. The adapter validates the same correlations at runtime.

For each field, `min/max` are signed extrema and `absMax = max(abs(min), abs(max))`. Envelope topology is invariant across stations: the same ordered node IDs and local/global coordinates are required at every solve. A mismatch fails the envelope. The envelope signature includes the complete slab geometry, including skew, supports, mesh, vehicle, and placement/path definition. Each envelope map key agrees with its embedded field and units, and each worst-station key agrees with its generic field. Worst-station re-solves must reproduce the stored signed field and node.

### 8.3 Mesh quality transport

```ts
export type DiagnosticSeverity = "info" | "warning" | "error";

export interface ElementQualityMetrics {
  elementId: number;
  determinantMin: number;
  determinantMax: number;
  scaledJacobianMin: number;
  minEdgeLengthM: number;
  maxEdgeLengthM: number;
  minInteriorAngleDeg: number;
  maxInteriorAngleDeg: number;
  aspectRatio: number;
  thicknessToMaxEdgeRatio: number;
  severity: "ok" | "warning";
  diagnosticCodes: string[];
}

export interface MeshQualityDiagnostic {
  code: string;
  severity: 'info' | 'warning';
  message: string;
  elementIds: number[];
}

export interface MeshQualityErrorDiagnostic {
  code: string;
  severity: 'error';
  message: string;
  elementIds: number[];
}

export interface MeshQualityReport {
  definitionId: string;
  elements: ElementQualityMetrics[];
  status: "ok" | "warning";
  diagnostics: MeshQualityDiagnostic[];
}
```

Dimensionless metrics are identified above; determinants carry the Jacobian convention's area scaling. WP-020 owns formulas, thresholds, and `definitionId`. A successful `MeshQualityReport` cannot contain an error-severity diagnostic by type. Non-positive Jacobian, collapse, inversion, or another threshold classified as hard produces `ErrorAnalysisResults` with a `quality` failure and one or more `MeshQualityErrorDiagnostic` entries; it cannot appear in `SuccessAnalysisResults` or be downgraded to warning quality.

## 9. Physical reactions and signed equilibrium

### 9.1 Reaction rows

```ts
interface SupportReactionBase {
  supportId: string;
  nodeId: number;
  source: 'fixed' | 'spring';
  attributionFraction: number;
  sharedBySupportIds: string[];
}

export type SupportReactionLocation =
  | {
      supportKind: 'edge' | 'line';
      xM: number;
      yM: number;
      distanceAlongSupportM: number;
    }
  | {
      supportKind: 'point';
      xM: number;
      yM: number;
      distanceAlongSupportM?: never;
    };

export type SupportReactionComponent =
  | {
      component: 'forceZ';
      value: number;
      units: 'kN';
    }
  | {
      component: 'coupleX' | 'coupleY';
      value: number;
      units: 'kN*m';
    };

export type SupportReactionRow =
  SupportReactionBase & SupportReactionLocation & SupportReactionComponent;

export interface PhysicalActionTotals {
  forceZKn: number;
  coupleXKnm: number;
  coupleYKnm: number;
}

export interface SupportReactionSourceSubtotals {
  fixedAttributed: PhysicalActionTotals;
  springDirect: PhysicalActionTotals;
}

export interface SupportReactionDistributionSampleBase {
  nodeId: number;
  xM: number;
  yM: number;
  distanceAlongSupportM: number;
  sourceSubtotals: SupportReactionSourceSubtotals;
  total: PhysicalActionTotals;
  coupleNormalKnm: number;
  coupleTangentKnm: number;
}

export type FixedReactionAttribution =
  | { method: 'unshared-fixed'; attributionFraction: 1; sharedBySupportIds: [string] }
  | {
      method: 'equal-shared-fixed-reporting';
      attributionFraction: number;
      sharedBySupportIds: [string, string, ...string[]];
    };

export type SupportReactionDistributionSample = SupportReactionDistributionSampleBase & (
  | { sourceCase: 'unshared-fixed'; fixedAttribution: Extract<FixedReactionAttribution, { method: 'unshared-fixed' }> }
  | { sourceCase: 'shared-fixed-attribution'; fixedAttribution: Extract<FixedReactionAttribution, { method: 'equal-shared-fixed-reporting' }> }
  | { sourceCase: 'spring-direct'; fixedAttribution?: never }
  | { sourceCase: 'mixed-fixed-spring'; fixedAttribution: FixedReactionAttribution }
);

export interface UnitPlanarDirection { x: number; y: number }
export interface CanonicalEdgeReactionFrame {
  frameKind: 'canonical-edge';
  tangent: UnitPlanarDirection;
  normal: UnitPlanarDirection;
}
export interface AuthoredLineReactionFrame {
  frameKind: 'authored-line-left-normal';
  tangent: UnitPlanarDirection;
  normal: UnitPlanarDirection;
}

export interface SupportReactionDistributionBase {
  supportId: string;
  supportLengthM: number;
  samples: SupportReactionDistributionSample[];
  sourceTotals: SupportReactionSourceSubtotals;
  totals: PhysicalActionTotals;
}

export type SupportReactionDistribution =
  | (SupportReactionDistributionBase & {
      supportKind: 'edge';
      edge: DeckEdge;
      distanceOrigin: 'canonical-edge-start';
      frame: CanonicalEdgeReactionFrame;
    })
  | (SupportReactionDistributionBase & {
      supportKind: 'line';
      edge?: never;
      distanceOrigin: 'authored-line-start';
      frame: AuthoredLineReactionFrame;
    });
```

**Normative.** These are physical external actions exerted by supports on the slab. Positive `forceZ` is downward; `coupleX/coupleY` are physical right-hand couples. Legacy `rx/ry` cannot be reaction component names. The WP-031A mapping and accepted ADR convert normalized generalized actions before any facade, summary, viewer, or report aggregation.

The `supportKind` discriminant makes `distanceAlongSupportM` required for edge and line supports and impossible for point supports. Edge distance and axes use the canonical edge frame in Section 3 and the accepted `n+` convention. Line distance starts at authored `(x1M,y1M)`. Its tangent is exactly the normalized vector from authored start to authored end, `tau = (dx,dy)/hypot(dx,dy)`, and its fixed left normal is `n = (-tau.y,tau.x)`; reversing authored endpoints therefore reverses both axes without a private sign choice.

The equal fixed-action reporting-attribution rule in Section 6 is already applied to rows. Per-support and global totals are direct signed sums of rows; they must reconcile exactly within the later declared numerical tolerance. An optional force/couple density plot is a derived WP-034 view, not a reaction row. If added, it must state tributary conversion and units and integrate back to these nodal totals.

WP-032B declares `SupportReactionDistribution`; WP-034 produces it. Only edge/line supports appear. Samples combine rows at each support node, are ordered strictly by increasing `distanceAlongSupportM` with `nodeId` as deterministic tie-breaker, and discriminate unshared fixed, equal shared-fixed reporting attribution, direct spring, and mixed fixed/spring cases. `fixedAttributed` and `springDirect` remain separate signed subtotals at sample and support level; `total`/`totals` are their componentwise signed sums, sample totals sum to support totals, and support totals sum to the row/global totals. Only the shared-fixed case carries the equal-attribution label; spring and unshared actions are never falsely labelled. Physical `coupleNormal/coupleTangent` are resolved from each distribution's frozen frame using the accepted ADR. Equal attribution remains reporting metadata, not evidence of a physical corner load split.

### 9.2 Equilibrium packet

```ts
export interface GlobalResultant {
  forceZKn: number;
  momentXKnm: number;
  momentYKnm: number;
}

export interface EquilibriumNormalization {
  characteristicLengthM: number;
  forceScaleKn: number;
  momentScaleKnm: number;
}

export interface SignedEquilibrium {
  originM: { xM: number; yM: number };
  applied: GlobalResultant;
  reactions: GlobalResultant;
  residual: GlobalResultant;
  absoluteResidual: GlobalResultant;
  normalizedResidual: {
    forceZ: number;
    momentX: number;
    momentY: number;
  };
  normalization: EquilibriumNormalization;
}
```

**Normative.** `originM` is the start-support centre `(0, widthM/2)`. `residual = applied + reactions` component by component. `absoluteResidual` is the componentwise absolute value of that signed residual. Normalized values are non-negative dimensionless ratios to the recorded positive scales. Applied and reaction subtotals remain signed and separate.

Vertical force moments use the accepted cross product; physical nodal couples are included. Fixed actions are globally deduplicated and springs use normalized external-action signs before forming `reactions`. No field uses absolute resultants to manufacture balance.

WP-025 owns the executable scale calculation and ties any acceptance threshold to integration precision, solver residual, conditioning, and characteristic scale. This contract intentionally has no unqualified `passed` boolean or arbitrary percentage. WP-026 may emit a diagnostic only when it records the threshold and tolerance-source ID used.

## 10. Deck-coordinate section contract

```ts
export type SectionOrdinate = "mx" | "my" | "mxy";

export type DeckSectionSettings =
  | {
      mode: "longitudinal";
      ordinate: SectionOrdinate;
      centerTM: number;
      widthM: number;
    }
  | {
      mode: "transverse";
      ordinate: SectionOrdinate;
      centerSM: number;
      widthM: number;
    };

// Live from WP-032B until the atomic WP-050 V5 migration.
export type SectionSettings = SectionSettingsBridgeV4;

export interface SectionSample {
  stationM: number;
  value: number;
}

export interface SectionCurveBase {
  ordinate: SectionOrdinate;
  coordinateFrame: 'deck-local';
  requestedCenterM: number;
  requestedWidthM: number;
  averaging: 'piecewise-linear-width-average';
  units: 'kN*m/m';
}

export type SectionModeAxis =
  | { mode: 'longitudinal'; stationAxis: 's' }
  | { mode: 'transverse'; stationAxis: 't' };

export type EmptySectionCurve = SectionCurveBase & SectionModeAxis & {
  state: 'empty';
  actualStripMinM: null;
  actualStripMaxM: null;
  samples: [];
  min: null;
  max: null;
};

export type PopulatedSectionCurve = SectionCurveBase & SectionModeAxis & {
  state: 'populated';
  actualStripMinM: number;
  actualStripMaxM: number;
  samples: [SectionSample, ...SectionSample[]];
  min: number;
  max: number;
};

export type SectionCurve = EmptySectionCurve | PopulatedSectionCurve;
```

**Normative.** Section engines consume the canonical `SectionSettings.deck` member during the V4 bridge and the deck-only `SectionSettings` after WP-050/V5. Longitudinal varies `s` at a selected `t`; transverse/support-parallel varies `t` at a selected `s`. `widthM` is positive and measured in the perpendicular local parameter. The strip is clipped to the deck-local rectangle. No overlap produces `state: 'empty'`, an exact empty sample tuple, and null strip/value extents; it never fabricates zeros. Partial overlap and populated curves record finite actual clipped bounds and at least one sample.

At each structured-mesh station on the varying axis, WP-033 forms a piecewise-linear interpolation across the perpendicular axis, clips it at strip boundaries, integrates it using physical local-parameter width, and divides by actual width. This is a width-weighted strip average, not an unweighted node count. It reproduces constant and bilinear nodal fields on a structured nonuniform mesh to the relevant roundoff criterion.

The ordinate is independently selected and is always a raw global tensor component. It is not inferred from travel direction or section mode. Output labels must say “deck-coordinate strip average” and identify the global component. Exact arbitrary global cuts and support-axis tensor ordinates are separate enhancements.

**Observed.** Current settings use `axis: auto|x|y`; sections round global coordinates and compute arithmetic means of included nodes. WP-032B promotes the compile-safe bridge, WP-033 activates the local weighted engine from `.deck`, WP-041A edits `.deck` while synchronizing the legacy view, WP-041B migrates `Viewport.tsx`, WP-043/WP-045 migrate overlay/report consumers, and WP-050 atomically removes the legacy view with the V5 migration.

## 11. Verification status and warning lifecycle

```ts
export type FormulationVerification =
  | "not-checked"
  | "failed"
  | "conditional"
  | "passed";

export type ReferenceStudyVerification =
  | "not-run"
  | "failed"
  | "conditional"
  | "passed";

export type CurrentModelConvergence =
  | "not-demonstrated"
  | "failed"
  | "conditional"
  | "passed";

export interface VerificationEvidenceStatus {
  formulation: FormulationVerification;
  referenceStudy19Deg: ReferenceStudyVerification;
  currentModelConvergence: CurrentModelConvergence;
  evidenceIds: string[];
}

export interface ZeroSkewReleaseState {
  scope: 'zero-skew';
  authority: 'baseline';
  warningRequired: false;
  decisionId: null;
}

export interface PreWp065ReleaseState {
  scope: 'non-zero-skew';
  authority: 'pre-wp065';
  warningRequired: true;
  decisionId: null;
}
export interface PostWp065WarningReleaseState {
  scope: 'non-zero-skew';
  authority: 'wp065-decision';
  warningRequired: true;
  decisionId: string;
}
export interface PostWp065AuthorizedReleaseState {
  scope: 'non-zero-skew';
  authority: 'wp065-decision';
  warningRequired: false;
  decisionId: string;
}
export type NonZeroSkewReleaseState =
  | PreWp065ReleaseState
  | PostWp065WarningReleaseState
  | PostWp065AuthorizedReleaseState;

export type WarningFreeVerificationStatus =
  | (VerificationEvidenceStatus & {
      geometryScope: 'zero-skew';
      release: ZeroSkewReleaseState;
    })
  | (VerificationEvidenceStatus & {
      geometryScope: 'non-zero-skew';
      release: PostWp065AuthorizedReleaseState;
    });

export type WarningRequiredVerificationStatus = VerificationEvidenceStatus & {
  geometryScope: 'non-zero-skew';
  release: PreWp065ReleaseState | PostWp065WarningReleaseState;
};

export type VerificationStatus =
  | WarningFreeVerificationStatus
  | WarningRequiredVerificationStatus;

export interface DiagnosticWarning {
  code: string;
  severity: 'info' | 'warning';
  message: string;
  source: 'solver' | 'quality' | 'equilibrium' | 'verification';
  dismissible: boolean;
  evidenceIds: string[];
}

export interface ReleaseWarning {
  code: 'NON_ZERO_SKEW_EXPERIMENTAL';
  severity: 'warning';
  message: string;
  source: 'release';
  dismissible: false;
  evidenceIds: string[];
}
```

**Normative.** The three verification fields are independent:

- `formulation` describes the approved plate formulation evidence;
- `referenceStudy19Deg` describes the stored named 19-degree study only;
- `currentModelConvergence` describes the current user model and is `not-demonstrated` unless evidence for that exact model is attached.

Passing the reference study never promotes current-model convergence. Evidence IDs are stable references to ledger/verification artifacts, not prose or user-entered claims. Idle, error, legacy, and non-zero-skew result constructors never default an unknown status to `passed`.

`src/app/defaults.ts` is the single release-policy authority module for this release. WP-032B activates `CURRENT_SKEW_RELEASE_POLICY`, `deriveReleaseState(skewAngleDeg)`, and `buildRequiredReleaseWarnings(releaseState)` there with focused tests. No solver payload, adapter fallback, saved model, UI control, report, or other module constructs or overrides release state. WP-026 supplies only `VerificationEvidenceStatus`; WP-032C combines it with the state derived by the authority module.

The discriminants make a pre-WP-065 non-zero-skew `warningRequired: false` object untypeable. `warningRequired` is not persisted in `SlabModel`, accepted from imported JSON, or editable. For every non-zero-skew result it remains `true` until WP-065 records a Chartered Engineer decision and a later separately reviewed release-policy revision packet changes `CURRENT_SKEW_RELEASE_POLICY` with that non-empty `decisionId` and focused regression evidence. WP-065 itself records the decision but does not edit code. G6, successful benchmarks, or a user-model convergence study alone cannot clear it.

While `warningRequired` is true, `buildRequiredReleaseWarnings` returns exactly `[ReleaseWarning]`; for zero skew or an authorized post-WP-065 `warningRequired: false` state it returns exactly `[]`. Its type fixes `source: 'release'`, the code, severity, and `dismissible: false`; diagnostic warnings are transported separately and cannot impersonate it. Solver/quality/equilibrium warnings may be additive but cannot replace or suppress it. Removing or weakening the warning before the authorized revision packet is a contract violation.

## 12. Target app-result aggregate

**Staged.** WP-032B activates the following semantic aggregate. Exact file organization may use named subinterfaces above, but fields and meanings cannot be duplicated under alternate names:

```ts
export interface LegacyContourPointView { xM: number; yM: number; value: number }
export interface LegacyNodalContourPointView extends LegacyContourPointView { nodeId: number }
export interface LegacyContourDataView {
  field: 'deflection' | 'mx' | 'my' | 'qx' | 'qy';
  points: LegacyContourPointView[];
  min: number; max: number; units: string;
}
export interface LegacyNodalContourDataView {
  field: 'deflection' | 'mx' | 'my' | 'qx' | 'qy';
  points: LegacyNodalContourPointView[];
  min: number; max: number; units: string;
}
export interface LegacyMeshNodeView { id: number; xM: number; yM: number }
export interface LegacyMeshElementView {
  id: number; nodeIds: [number, number, number, number];
}
export interface LegacyNodalDisplacementView { nodeId: number; wM: number }
export interface LegacyMeshAxesView { xCoordsM: number[]; yCoordsM: number[] }
export interface LegacyRectWheelPatchView {
  xMinM: number; xMaxM: number; yMinM: number; yMaxM: number;
}
export interface LegacyReactionRowView {
  supportId: string; nodeId?: number; dof: 'uz' | 'rx' | 'ry';
  type?: 'fixed' | 'spring'; value: number; units: string;
}
export interface LegacyReactionTotalsView { uz: number; rx: number; ry: number }
export interface LegacyReactionSummaryView extends LegacyReactionTotalsView {
  supportId: string;
}
export interface LegacyAnalysisSummaryView {
  maxDeflectionMm: number;
  maxAbsMomentKnmPerM: number;
  maxAbsShearKnPerM: number;
}
export interface LegacyEnvelopePerNodeView {
  nodeId: number; xM: number; yM: number; max: number; min: number;
}
export interface LegacyEnvelopeFieldDataView {
  field: 'deflection' | 'mx' | 'my';
  points: LegacyEnvelopePerNodeView[];
  max: number; min: number; absMax: number; units: string;
}
export interface LegacyEnvelopeWorstStationView {
  stationM: number; peakValue: number; peakAbs: number; nodeId: number;
}
export interface LegacyEnvelopeWorstStationsView {
  mx: LegacyEnvelopeWorstStationView;
  my: LegacyEnvelopeWorstStationView;
}
export interface LegacyEnvelopeDataView {
  stationsRun: number; pathStartM: number; pathEndM: number; pathStepM: number;
  travelDirection: 'x+' | 'x-' | 'y+' | 'y-'; computedAtIso: string; signature: string;
  mx: LegacyEnvelopeFieldDataView;
  my: LegacyEnvelopeFieldDataView;
  deflection: LegacyEnvelopeFieldDataView;
  worstStations: LegacyEnvelopeWorstStationsView;
}
export interface LegacyAnalysisResultViews {
  /** @deprecated Derived from nodalFields/elementFields. */
  contours: Partial<Record<'deflection' | 'mx' | 'my' | 'qx' | 'qy', LegacyContourDataView>>;
  /** @deprecated Derived from nodalFields. */
  nodalContours: Partial<Record<'deflection' | 'mx' | 'my' | 'qx' | 'qy', LegacyNodalContourDataView>>;
  /** @deprecated Derived from meshNodeOverlays. */
  meshNodes: LegacyMeshNodeView[];
  /** @deprecated Derived from meshElementOverlays. */
  meshElements: LegacyMeshElementView[];
  /** @deprecated Derived from nodalKinematics. */
  nodalDisplacements: LegacyNodalDisplacementView[];
  /** @deprecated Derived from the canonical mesh; local axes only. */
  mesh?: LegacyMeshAxesView;
  /** @deprecated Derived from wheelPatchOverlays.originalBounds. */
  wheelPatches: LegacyRectWheelPatchView[];
  /** @deprecated Derived from physicalReactions by the accepted axis mapping. */
  reactions: LegacyReactionRowView[];
  /** @deprecated Derived from physicalReactionSummaryBySupport. */
  reactionSummaryBySupport: LegacyReactionSummaryView[];
  /** @deprecated Derived from physicalReactionTotals. */
  reactionTotals: LegacyReactionTotalsView;
  /** @deprecated Derived from canonical signed field maps. */
  summary: LegacyAnalysisSummaryView;
  /** @deprecated Derived from envelopeData. */
  envelope?: LegacyEnvelopeDataView;
  /** @deprecated Derived from diagnosticWarnings/releaseWarnings. */
  warning?: string;
}

export interface AnalysisResultCommon extends LegacyAnalysisResultViews {
  source: 'solver';
  elapsedMs: number;
  diagnosticWarnings: DiagnosticWarning[];
}

export interface NoSuccessfulSolveEvidence {
  deckPolygon?: never;
  deckBounds?: never;
  meshNodeOverlays?: never;
  meshElementOverlays?: never;
  nodalKinematics?: never;
  elementFields?: never;
  nodalFields?: never;
  wheelPatchOverlays?: never;
  physicalReactions?: never;
  physicalReactionSummaryBySupport?: never;
  physicalReactionTotals?: never;
  reactionDistributions?: never;
  equilibrium?: never;
  meshQuality?: never;
  verification?: never;
  envelopeData?: never;
  sections?: never;
}

export type IdleAnalysisResults = AnalysisResultCommon & NoSuccessfulSolveEvidence & {
  status: 'idle';
  elapsedMs: 0;
  releaseWarnings: [];
  error?: never;
};

export type RunningAnalysisResults = AnalysisResultCommon & NoSuccessfulSolveEvidence & {
  status: 'running';
  progress?: { current: number; total: number };
  releaseWarnings: [];
  error?: never;
};

export type AnalysisFailure =
  | {
      source: 'quality';
      diagnostics: [MeshQualityErrorDiagnostic, ...MeshQualityErrorDiagnostic[]];
    }
  | {
      source: 'solver' | 'equilibrium' | 'verification';
      code: string;
      evidenceIds: string[];
    };

export type ErrorAnalysisResults = AnalysisResultCommon & NoSuccessfulSolveEvidence & {
  status: 'error';
  releaseWarnings: [];
  error: string;
  failure: AnalysisFailure;
};

export interface SuccessAnalysisResultEvidence extends AnalysisResultCommon {
  status: 'success';
  deckPolygon: Array<{ xM: number; yM: number }>;
  deckBounds: { xMinM: number; xMaxM: number; yMinM: number; yMaxM: number };
  meshNodeOverlays: StagedSkewAppContract.MeshNodeOverlayV2[];
  meshElementOverlays: StagedSkewAppContract.MeshElementOverlayV2[];
  nodalKinematics: NodalKinematics[];
  elementFields: ElementFieldMap;
  nodalFields: NodalFieldMap;
  wheelPatchOverlays: WheelPatchOverlay[];
  physicalReactions: SupportReactionRow[];
  physicalReactionSummaryBySupport: Array<PhysicalActionTotals & { supportId: string }>;
  physicalReactionTotals: PhysicalActionTotals;
  reactionDistributions: SupportReactionDistribution[];
  equilibrium: SignedEquilibrium;
  meshQuality: MeshQualityReport;
  envelopeData?: StagedSkewAppContract.EnvelopeDataV2;
  sections?: SectionCurve[];
  error?: never;
}

export type SuccessAnalysisResults = SuccessAnalysisResultEvidence & (
  | {
      verification: WarningFreeVerificationStatus;
      releaseWarnings: [];
    }
  | {
      verification: WarningRequiredVerificationStatus;
      releaseWarnings: [ReleaseWarning];
    }
);

export type AnalysisResults =
  | IdleAnalysisResults
  | RunningAnalysisResults
  | SuccessAnalysisResults
  | ErrorAnalysisResults;
```

The status discriminant is authoritative. A successful solve requires non-null deck geometry, canonical mesh/topology, kinematics, both complete correlated field maps, polygon patch overlays, physical reactions and ordered distributions, equilibrium, non-fatal quality, and verification. Its release-state discriminant makes the exact required release-warning tuple part of the success type: missing, extra, or contradictory release warnings are untypeable. Idle/running/error variants make every canonical successful-solve evidence field `never`; their required legacy compatibility views are empty/derived presentation values and cannot masquerade as canonical solve evidence. Only the error variant permits and requires non-empty `error` text and a typed failure; hard mesh-quality failures use the `quality` branch. Envelope and sections are separate derivations and remain optional only on success. WP-032C rejects a nominal success missing any required field or with mismatched warning state; it never downgrades that payload to zero-filled success.

**Compatibility.** WP-032B promotes `AnalysisResultsV2` with the exact typed deprecated `LegacyAnalysisResultViews` above and updates idle/error defaults, so existing consumers compile in the same packet. WP-032C normalizes the canonical fields and derives every legacy view from that one source; it owns no persistence. WP-041B migrates contour, displacement, mesh-axis, envelope, summary, warning presentation, and the legacy section reads in `Viewport.tsx`. WP-043 migrates viewer mesh/rectangle-patch use. WP-045 migrates report reaction/summary aliases using the accepted `forceZ -> uz`, `coupleX -> ry`, `coupleY -> rx` compatibility mapping and its leased print-capture portions of `App.tsx`.

Two non-presentation compatibility consumers intentionally remain until the integration journey: `src/viewer/scene/ResultSurface.tsx` reads legacy nodal contour/mesh/displacement views, and the non-print run/envelope portions of `src/app/App.tsx` carry legacy envelope/warning state. The lead pre-approves these exact files as WP-050 minimal integration fixes under that packet's plan-defined mechanism. WP-050 first migrates both consumers to canonical fields in the same atomic patch, then removes `LegacyAnalysisResultViews`, the deprecated result fields, the V4 section legacy view, and writes V5. Its lease for that cleanup is limited to those two consumers, `src/app/types.ts`, `src/app/defaults.ts`, and focused integration tests; any additional file requires a separate recorded approval. No legacy view is independently writable or survives the WP-050 audit, and there is no red compile interval.

## 13. Activation and removal ownership

The following table is part of the contract. “Declare” means compile-safe staged shape only; “activate” means a live producer and all consumers use it; “remove” means the named compatibility representation can no longer be an active source.

| Contract area | Declare | Activate / producer owner | Consumer / final removal owner |
|---|---|---|---|
| canonical primitives and exact staging namespaces | WP-005 at the Section 2.1.1 paths/names | named type owners promote one member atomically | each promotion owner removes its member; WP-050 proves both namespaces unused |
| common geometry, deck edges, equilibrium/quality/status shapes | WP-005 canonical imports or exact staged members | WP-012/WP-013 and later named producers | WP-032A/WP-032B; lookalikes outside staging namespaces prohibited immediately |
| app required `skewAngleDeg` | WP-005 staged | WP-014A | WP-014B persistence; WP-015 solver propagation |
| missing legacy skew -> exact zero | WP-005 additive live input | WP-014B/WP-015 required normalizer | WP-026 removes internal use; WP-050 removes audited external facade form |
| geometry utility ownership and zero-skew fast path | WP-005 | WP-012 | all later geometry consumers; private formulas prohibited |
| `sCoords/tCoords`, local node coordinates, polygons/bounds | WP-005 | WP-020 | WP-032A transports; WP-032B app activation |
| internal `xCoords/yCoords` compatibility aliases | WP-005 required/deprecated | WP-020 populates as identical local array aliases | WP-032A/B migrate facade/app; WP-050 removes internal aliases after audit |
| `EdgeSupport` target shape | WP-005 only, not live union | WP-027 atomic app/solver migration after WP-021/WP-026 | WP-040 editor/presets; WP-043 overlay/report consumers |
| physical support DOF names and legacy `uz/rx/ry` migration | WP-005 staged | WP-027 atomic saved-model and translator migration | WP-040 UI, WP-045 report; WP-050 checks no active legacy semantics |
| saved-model V1/V2/V3 legacy-section, V4 bridge, and V5 deck-only schemas | WP-005 frozen snapshots | WP-014B owns V1/V2; WP-027 V3; WP-032B V4; WP-050 V5 | WP-063 persistence acceptance; shape guessing prohibited |
| dual solver-support input bridge | WP-005 exact discriminants | WP-021 normalizer; WP-027 switches `fromAppModel` to physical V2 | WP-032A retains external legacy route as needed; WP-050 removes it after audit |
| topology/point/line support mapping and Euclidean springs | WP-005 | WP-020/WP-021 | WP-025 reactions/equilibrium, WP-034 distributions |
| generalized reaction to physical couple mapping | type names WP-005 | WP-031A | WP-025 applies before aggregation; WP-032A transports only physical names |
| fixed deduplication/equal shared-corner reporting attribution | WP-005 | WP-025 | WP-034 ordered distributions, WP-044 plots, WP-045 report labels |
| patch original/clipped polygons, areas, centroid, pressure | WP-005 | WP-022 | WP-024 integration, WP-032A transport, WP-043 rendering |
| removal of rectangle-as-physical-patch behavior | WP-005 deprecates | WP-022/WP-024 | WP-032A removes rectangular facade payload; WP-043 removes rectangle rendering |
| `mxy` raw/recovered/result unions | WP-005 | WP-030 | WP-032A facade, WP-032B app, WP-032C adapter, WP-033/WP-035 analytical consumers, WP-041A/B and WP-045 presentation |
| element-centre shear location and nodal-shear prohibition | WP-005 | WP-030 | WP-032A/WP-032B transport; WP-041B/WP-045 labels and extrema rules |
| signed equilibrium values/scales | WP-005 | WP-025 pure output; WP-026 attaches | WP-032A/B/C, WP-041B, WP-045 |
| mesh quality report / hard quality failure | WP-005 | WP-020 metrics; WP-026 emits success report or error result | WP-032A/B/C enforce no error diagnostic in success; WP-041B/WP-045 present |
| support-kind reaction rows, frames, source subtotals, and actions | WP-005 | WP-025/WP-026 | WP-032A/B/C; WP-034 produces ordered discriminated distributions; WP-044/WP-045 present |
| section settings/output and persisted V4/V5 | WP-005 `SectionSettingsV2` staged | WP-032B promotes bridge and migrates/saves V4; WP-033 engine; WP-050 promotes deck-only and migrates/saves V5 | WP-041A controls, WP-041B viewport, WP-043 polygon, WP-045 report; legacy view removed atomically by WP-050 |
| envelope `mxy`, topology/signature, worst station | WP-005 staged | WP-032B shape, WP-035 engine | WP-041A/B and WP-045; stale geometry rules checked by WP-050 |
| verification evidence and release-state discriminants | WP-005 staged | WP-026 evidence only; WP-032B activates authority in `src/app/defaults.ts` | WP-032C derives state/rejects malformed; WP-041A/B read-only UI; WP-045 report |
| release-state-correlated warning tuple | WP-005 staged | WP-032B authority constructs exact tuple; WP-032C rejects mismatch | WP-041B/WP-045 presentation; only a post-WP-065 release-policy revision packet may change authority config |

## 14. Downstream packet input/output map

Every downstream packet consumes the frozen names above. A packet not listed as an activation owner must request a deviation before adding a shared field.

| Packet | Frozen inputs | Required outputs / ownership boundary |
|---|---|---|
| WP-005 | this ADR and mathematical ADR | materializable staging members; optional skew only on legacy live solver input; required mesh aliases; frozen bridges/snapshots; keep live compile green |
| WP-010 | `MeshNode` global coordinates and Q4 node order | shared Q4 geometry primitives; no contract mutation |
| WP-011 | Q4 primitives, DOF order/signs | stability evidence/decision only; no shared result-field invention |
| WP-012 | canonical `SlabGeometry`, `DeckLocalPoint`, `DeckEdgeFrame` | sole deck-coordinate utility implementation and exact zero-skew path |
| WP-013 | `Point2D/Polygon2D/Aabb` invariants | sole convex polygon cleanup/clipping/measure/quadrature kernel |
| WP-014A | app `SlabGeometry` declaration | required live `skewAngleDeg`; fixture-only mechanical updates |
| WP-014B | required app skew and persistence schema | parse implicit V1, write/parse V2 with legacy supports, missing skew -> exact zero; reject discriminator/shape mismatch |
| WP-015 | normalized app geometry and WP-012 utilities | one solver geometry translation and documented mesh-sizing policy |
| WP-020 | normalized geometry, Q4, mesh contract | live skew mesh, local/global coordinates, topology, polygons/bounds, quality metrics, forced point local coordinates |
| WP-021 | mesh topology, exact dual solver-support bridge, accepted DOF convention | discriminated normalization without guessing, node assignments, presets, springs, claimant metadata; existing `fromAppModel` remains valid |
| WP-022 | deck/polygon kernels and patch contract | original/clipped patch polygons, measures, centroid, fixed pressure semantics |
| WP-023 | Q4 primitives and mesh elements | inverse point mapping; no non-affine release widening |
| WP-024 | actual patch/element polygons and inverse map | consistent vertical load vector plus conserved force/first-moment diagnostics |
| WP-031A | accepted generalized/physical action mapping | one generalized-action-to-physical-couple helper; no tensor transform |
| WP-025 | mapped supports, loads, WP-031A | normalized/deduplicated actions, explicitly non-physical equal reporting attribution, and pure `SignedEquilibrium` |
| WP-030 | Q4/stability/mesh | nodal `mx/my/mxy`, raw centre results, element-centre `qx/qy`, approved recovery metadata |
| WP-031B | accepted axes and raw moment tensor | `mnn/mtt/mnt` and vector-axis helpers; raw globals unchanged |
| WP-026 | G3 outputs | integrated result with geometry, quality, equilibrium, physical reactions, verification references, hard failures and warnings |
| WP-027 | mapped edge supports and integrated solver | atomic live `EdgeSupport`, physical bridge output, M-suffixed coordinates, exact coordinate line/point V1/V2-to-V3 migration/save, exhaustive consumers |
| WP-032A | complete solver result | facade transport of `s/t`, topology/polygons, patches, `mxy`, physical reactions, equilibrium, quality, verification; remove rectangular axes/raw reaction names |
| WP-032B | facade contract and live edge support | promote the section/result compatibility bridges; migrate/default/sanitize/save V4; discriminated distributions/results; sole release authority in `src/app/defaults.ts` |
| WP-032C | app aggregate and facade payload | strict adapter normalization only; correlate release state/tuple; reject malformed success rather than synthesize it; no persistence ownership |
| WP-033 | nodal global moments and local mesh | discriminated local section settings and weighted `SectionCurve` outputs |
| WP-034 | support-kind physical rows and frozen frames | increasing-distance distributions; four source cases; fixed/spring signed subtotals and total reconciliation; optional densities integrate to nodal totals |
| WP-035 | nodal envelope fields, geometry/topology | `mxy` envelope/worst station, complete skew travel bounds, skew-aware signature and re-solve identity |
| WP-040 | live geometry/support model | skew controls, readouts, physical fixed/pinned/custom editor; no result contract edits |
| WP-041A | section/envelope contracts | `mxy` selector and explicit mode/ordinate controls; remove legacy inferred section axis |
| WP-041B | app results/status/warnings | result location/units, equilibrium, quality, three independent statuses, non-dismissible release warning |
| WP-042 | mesh nodes/elements/deck polygon/bounds | polygon-aware camera/probe; no rectangular axis dependency |
| WP-043 | deck, clipped patches, supports, section curve metadata | polygon overlays and canonical support glyph orientation; no AABB physical rendering |
| WP-044 | WP-034 distributions | plots of nodal integrated actions or explicitly unit-bearing derived densities, shared-corner marker, reconciled totals |
| WP-045 | all signed analytical/presentation contracts | report/print with raw axes, `mxy`, sections, reactions, equilibrium, quality, three statuses, theory, limitations, warning |
| WP-046 | integrated behavior | documentation distinguishes implemented/provisional/deferred/verified contracts and migration |
| WP-050 | complete vertical slices | atomically migrate `ResultSurface.tsx` and non-print result/envelope handling in `App.tsx`, remove legacy result/section views under the pre-approved minimal integration lease, write V5, and prove the 19-degree journey preserves the warning |
| WP-060 | geometry/element/load contracts | zero-skew and mathematical regression evidence; no production/type mutation |
| WP-061 | signed skew outputs/sections/reactions | mirror, equilibrium, shear-location, thin/thick, and convergence evidence; no production/type mutation |
| WP-062 | frozen source protocol and kernel readiness | executable published benchmarks using the same axes/signs/units; no production/type mutation |
| WP-063 | app aggregate and UI/report | V1/V2/V3/V4/V5 persistence plus result-status, field-key/unit, release-warning tuple, viewer, and report acceptance |
| WP-064 | frozen comparison protocol and signed outputs | like-for-like external signed result tables/evidence; no production/type mutation |
| WP-065 | all gate evidence | recorded release/warning decision only; a later traceable release-policy revision packet carries its decision ID and is the sole code/type change path |
| EF-001..005 | same stable external contracts | failure evidence, approved replacement behind the same valid APIs, deliberate rebaseline, then rerun affected gates |

WP-004 is parallel rather than downstream of WP-003. It owns source/fixture provenance and tolerance protocols; it may supply evidence IDs but cannot rename these contracts.

## 15. Contract-level verification obligations

The named implementation/test owner must exercise these obligations. Algebraic exactness uses exact assertions where stated; floating-point checks use the implementation plan's scale-aware policy or an independently approved source-specific tolerance.

| Contract | Required checks | Primary owner(s) |
|---|---|---|
| geometry | required/finite/range validation; exact zero branch; 0, +/-19, +/-45 transforms; vertices, area, bounds, edge frames | WP-012, WP-014B, WP-060 |
| common polygons | CCW/no closing duplicate; CW normalization; degeneracy cleanup; containment/clipping/area/centroid/first moments | WP-013, WP-060 |
| mesh | local arrays monotonic; node/element IDs; `[j][i]`; CCW connectivity; polygon-node identity; no AABB physics; zero-skew topology | WP-020, WP-060 |
| staging/alias removal | every Section 2.1.1 namespace member compiles; live-name collisions resolve only through their exact `V2` members; `AnalysisResultsV2`/`SectionSettingsV2` and collision members promote atomically; required mesh aliases are object-identical locally; no staging/legacy facade remains at WP-050 | WP-005, activation owners, WP-032A/B, WP-050 |
| supports/persistence | exact dual bridge; all edges/skew signs; M-suffixed/internal split; axis swap; V1-V5 exact parsing/migration; every legacy line stays line; point/line mapping; spring conservation | WP-014B, WP-021, WP-027, WP-032B, WP-050, WP-060/061/063 |
| duplicate reactions | one global fixed action; four sample source cases; signed fixed/spring subtotals reconcile; authored-line left-normal/canonical-edge frames; shared attribution labelled non-physical | WP-025, WP-034, WP-060/061 |
| patches | original/clipped winding/areas/centroid; off-deck null; full-area pressure; force/first moments; zero-skew vector | WP-022, WP-024, WP-060/061 |
| results | internal/raw versus public physical fields; correlated maps; status union rejects sparse success; hard quality errors cannot enter success; `mxy`; element-centre shear; finite values | WP-026, WP-030, WP-032A/B/C, WP-060/061/063 |
| transformations | generalized action vs physical couple and tensor transform remain separate; unit/90-degree/mirror cases | WP-031A/B, WP-060/061 |
| equilibrium | named origin; signed applied/reaction subtotals; cross-product/couples; fixed/spring/mixed; recorded scales; no magnitude balance | WP-025/026, WP-060/061 |
| sections | empty/populated discriminants; no-overlap null extents; local bounds; nonuniform weighted averages; exact constant/bilinear fields; `mxy` independent of mode | WP-033, WP-061 |
| envelopes | closed correlated field/worst-station maps; topology rejection; skew signature; signed `mxy`; worst-station re-solve; complete skew entry/exit | WP-035, WP-061/063 |
| verification/warning | three evidence statuses isolated; success release state requires exact `[]` or `[ReleaseWarning]`; release warning cannot dismiss; authority ignores imports/payload; post-decision ID required | WP-032B/C, WP-041B, WP-045, WP-063 |
| zero skew | WP-001 raw characterization unchanged; optional input bridge and required kernel normalization tested; exact aliases and V1-V5 migrations preserve semantics | WP-014B/015/021/027/032B/050, WP-060/063 |

## 16. Recorded refinements, compatibility debt, and remaining risks

### 16.1 Recorded name/shape refinements permitted by Section 5

- Public support restraints use physical `w/rotationX/rotationY`; internal generalized `w/betaX/betaY` remains private. This implements, rather than changes, the accepted mathematical ADR.
- Public reaction rows use discriminated `forceZ/coupleX/coupleY` components instead of ambiguous `uz/rx/ry` totals.
- Successful results, field maps, envelope maps, reaction locations, section emptiness, and release state are discriminated so invalid combinations are not representable.
- Section settings are a discriminated local-mode union; no `auto` mode survives in the target because ordinate and direction cannot be inferred from travel.
- Off-deck clipped geometry is nullable rather than a fabricated empty `Aabb` or zero rectangle.
- Nodal shear is excluded from the target until separately verified; element-centre shear remains available.
- Equal partition among distinct fixed-support claimants is the frozen reporting-attribution rule only; it is explicitly not a physical distribution result.
- Persistence uses immutable snapshots for implicit V1, explicit V2 legacy-support, V3 physical-support, V4 compatibility-bridge, and V5 deck-only schemas with no shape guessing.
- `src/app/defaults.ts` is the single release-policy authority for the bounded release.

These are WP-003 refinements authorized by the plan's contract-owner clause. They do not change an accepted mathematical sign or broaden the release scope.

### 16.2 Observed compatibility debt with named owners

- app/solver geometry names differ and skew is absent: WP-014A/B and WP-015;
- solver/app support DOF names are ambiguous and per-DOF `pinned` exists: WP-027, then WP-040/WP-045;
- internal spring reaction sign is opposite the public support action: WP-025/026;
- fixed corners can be repeated per support: WP-025/034;
- mesh axis arrays and rectangle element bounds are treated as physical geometry: WP-020/024/032A/B;
- patches are rectangle bounds and the facade renders original rather than clipped geometry: WP-022/024/032A/043;
- public recovery omits `mxy` and exposes nodal shear without the required policy: WP-030/032A/B;
- facade drops reaction coordinates and uses raw rotational names: WP-031A/025/032A;
- adapter converts malformed structural values to zero: WP-032C must reject target-required data;
- sections use rounded global buckets and travel-inferred ordinates: WP-033/041A;
- report theory, moment, reaction, and spring-unit wording conflicts with accepted conventions: WP-045;
- a single optional warning string has no release authority: WP-032B/C and WP-041B/045.

### 16.3 Remaining review risks

- WP-020 still owns the technical definitions and thresholds behind quality fields; this ADR freezes the transport, not those numerical decisions.
- WP-030 must independently confirm that element-centre `qx/qy` are defensible for the retained formulation. Failure can narrow or replace the formulation but cannot silently publish nodal shear.
- The weighted section-average algorithm is frozen here and requires independent implementation review on nonuniform meshes.
- Runtime migration must implement the frozen V1/V2/V3/V4/V5 discriminator and exact line-to-line, point-to-point, and section rules; accepting a mismatch or inventing an edge identity is a hard parser error.
- The compile-safe geometry/support/mesh bridges deliberately retain bounded compatibility debt until WP-050; removing them earlier can break external zero-skew consumers.
- Successful result construction must jointly validate non-fatal mesh quality and the release-state-correlated warning tuple; either mismatch is a hard adapter/result-construction failure.
- Non-zero-skew analysis remains experimental/screening-only. This contract cannot clear the warning or substitute for numerical verification.

No unresolved sign decision or necessary broadening of a live union was encountered while preparing this Proposed ADR. Any review change affecting axes, signs, shared-corner attribution, recovery location, section averaging, or warning authority requires the plan's formal contract-deviation process before dependent implementation.

## 17. Repository evidence inspected

- `docs/2026-07-21-skew-plate-analysis-implementation-plan.md`: full plan, contracts, packet graph, gates, checks, replacement branch, and governance.
- `docs/skew-implementation-status.md`: integration baseline, accepted decisions, current leases, baseline evidence, and warning authority.
- `docs/adr/ADR-skew-mathematical-conventions.md`: accepted axes, DOFs, signs, spring/reaction conversions, equilibrium, support axes, transformations, mirror parity, units, and presentation obligations.
- `src/app/types.ts`, `src/solver/model/types.ts`: observed app/solver shapes, optionality, aliases, units, and result omissions.
- `src/solver/index.ts`, `src/app/solverAdapter.ts`: observed facade loss, permissive normalization, rectangular overlays, raw reaction names, and recovery transport.
- `src/viewer/scene/StructureOverlay.tsx`, `src/components/ReportNote.tsx`: observed rectangle-only geometry, section inference, reaction/theory labels, and report consumers.
- `src/solver/core/mesh.ts`, `src/solver/core/supports.ts`: observed axis arrays, topology, point/line mapping, presets, spring distribution, and duplicate assignments.
- `src/solver/loads/vehicle.ts`, `src/solver/loads/patch.ts`: observed rectangle clipping, full-area pressure, AABB integration, and duplicated geometry operations.
- `src/solver/model/fromAppModel.ts`, `src/solver/runFixedPositionAnalysis.ts`: observed translation, raw DOF/reaction signs, result construction, deduplication behavior, and warnings.
- `src/app/defaults.ts`, `src/app/sectionCurve.ts`, `src/app/reactionSummary.ts`, `src/app/runPathEnvelope.ts`, `src/app/placementControls.ts`, `src/app/autoRun.ts`: observed persistence, defaults, global section buckets, reaction totals, envelopes, travel bounds, and model signatures.

No external standard, empirical tolerance, or benchmark value is established by this ADR.
