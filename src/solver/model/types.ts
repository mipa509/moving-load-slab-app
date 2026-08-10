import type * as SkewGeometryContract from '../geometry/types';
import type { SignedEquilibriumReport } from '../core/equilibrium';
import type {
  DiagnosticWarning,
  ElementCenterPlateResult,
  MeshQualityReport,
  NodalKinematics,
  NodalRecoveredPlateResult,
  PhysicalActionTotals,
  SignedEquilibrium,
  SupportReactionRow,
  VerificationEvidenceStatus,
} from '../../app/types';

export const DOF_KEYS = ["w", "rx", "ry"] as const;

export type DofKey = (typeof DOF_KEYS)[number];
export type AxisDirection = "+x" | "-x" | "+y" | "-y";
export type SupportBehavior = "fixed" | "pinned" | "custom";
export type AxleReferenceKind = "lead-axle-center" | "vehicle-center";
export type ExplicitWheelCoordinateSystem = "global-slab";

export const DOF_INDEX_BY_KEY: Record<DofKey, number> = {
  w: 0,
  rx: 1,
  ry: 2,
};

export interface UnitSystem {
  force: "kN";
  length: "m";
  stress: "MPa";
}

export interface RectBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface SlabGeometry {
  lengthX: number;
  lengthY: number;
  thickness: number;
  /** Compatibility input only; WP-015 normalizes it and WP-026 removes internal use. */
  skewAngleDeg?: number;
}

export interface LegacySolverSlabGeometryInput {
  lengthX: number;
  lengthY: number;
  thickness: number;
  skewAngleDeg?: number;
}

export interface MaterialDefinition {
  elasticModulusMPa: number;
  poissonRatio: number;
  shearCorrectionFactor?: number;
}

export interface MeshSettings {
  targetElementsX: number;
  targetElementsY: number;
  forcedX?: number[];
  forcedY?: number[];
  tolerance?: number;
}

export type SupportDofConstraint =
  | { kind: "free" }
  | { kind: "fixed" }
  | { kind: "spring"; stiffness: number };

export interface SupportDofConstraints {
  w?: SupportDofConstraint;
  rx?: SupportDofConstraint;
  ry?: SupportDofConstraint;
}

export interface BaseSupportDefinition {
  id?: string;
  behavior?: SupportBehavior;
  dofs?: SupportDofConstraints;
}

export interface LineSupportDefinition extends BaseSupportDefinition {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PointSupportDefinition extends BaseSupportDefinition {
  kind: "point";
  x: number;
  y: number;
}

export type SupportDefinition = LineSupportDefinition | PointSupportDefinition;

export interface VehicleReferencePoint {
  x: number;
  y: number;
}

export interface VehicleAxleDefinition {
  id?: string;
  axleLoad: number;
  spacingToNext?: number;
  offset?: number;
  wheelCount?: number;
  transverseSpacing?: number;
  leftLoadFraction?: number;
  rightLoadFraction?: number;
  patchLength?: number;
  patchWidth?: number;
}

export interface AxleBuilderVehicleDefinition {
  kind: "axle-builder";
  direction: AxisDirection;
  reference: VehicleReferencePoint;
  referenceKind?: AxleReferenceKind;
  transverseOffset?: number;
  defaultTransverseSpacing: number;
  defaultPatchLength: number;
  defaultPatchWidth: number;
  axles: VehicleAxleDefinition[];
}

export interface ExplicitWheelInput {
  id?: string;
  x: number;
  y: number;
  load: number;
  patchLength: number;
  patchWidth: number;
  direction?: AxisDirection;
}

export interface ExplicitWheelVehicleDefinition {
  kind: "explicit-wheels";
  direction?: AxisDirection;
  coordinateSystem?: ExplicitWheelCoordinateSystem;
  wheels: ExplicitWheelInput[];
}

export type VehicleDefinition =
  | AxleBuilderVehicleDefinition
  | ExplicitWheelVehicleDefinition;

export interface AnalysisOptions {
  cgTolerance?: number;
  cgAbsoluteTolerance?: number;
  cgMaxIterations?: number;
}

export interface FixedPositionAnalysisModel {
  slab: SlabGeometry;
  material: MaterialDefinition;
  mesh: MeshSettings;
  supports: SupportDefinition[];
  vehicle: VehicleDefinition;
  options?: AnalysisOptions;
  metadata?: Record<string, unknown>;
}

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
  polygon: SkewGeometryContract.Polygon2D;
  bounds: SkewGeometryContract.Aabb;
}

export interface StructuredMesh {
  sCoords: number[];
  tCoords: number[];
  /** @deprecated Exact same array object as sCoords; local, not global x. WP-050 removes it. */
  xCoords: number[];
  /** @deprecated Exact same array object as tCoords; local, not global y. WP-050 removes it. */
  yCoords: number[];
  nodes: MeshNode[];
  elements: MeshElement[];
  nodeIdsByIJ: number[][];
  elementCountS: number;
  elementCountT: number;
}

export interface WheelPatch {
  id: string;
  sourceWheelId: string;
  direction: AxisDirection;
  load: number;
  pressure: number;
  patchLength: number;
  patchWidth: number;
  center: VehicleReferencePoint;
  originalBounds: RectBounds;
  clippedBounds: RectBounds | null;
  clippedArea: number;
}

export interface SupportDofAssignment {
  supportId: string;
  nodeId: number;
  dof: DofKey;
  kind: "fixed" | "spring";
  stiffness?: number;
}

export interface MappedSupportResult {
  fixedDofs: Set<number>;
  springStiffnessByDof: Map<number, number>;
  assignments: SupportDofAssignment[];
}

export interface ElementCenterResult {
  elementId: number;
  center: VehicleReferencePoint;
  deflection: number;
  moments: {
    mx: number;
    my: number;
    mxy: number;
  };
  shears: {
    qx: number;
    qy: number;
  };
}

export interface NodalDisplacement {
  nodeId: number;
  x: number;
  y: number;
  w: number;
  rx: number;
  ry: number;
}

/**
 * Area-weighted averages of the surrounding element-centre (superconvergent)
 * field values at a single mesh node (one entry per node). Moments and shears
 * are smoothed averages, not extrapolated corner peaks or singular extrema;
 * deflection is the exact nodal degree of freedom.
 */
export interface NodalFieldValues {
  nodeId: number;
  x: number;
  y: number;
  deflection: number;
  mx: number;
  my: number;
  mxy: number;
  qx: number;
  qy: number;
}

export interface SupportReaction {
  supportId: string;
  nodeId: number;
  x: number;
  y: number;
  dof: DofKey;
  type: "fixed" | "spring";
  value: number;
  displacement: number;
  springStiffness?: number;
}

export interface SolverDiagnostics {
  converged: boolean;
  iterations: number;
  residualNorm: number;
  initialResidualNorm: number;
  totalDofs: number;
  freeDofs: number;
  fixedDofs: number;
}

export interface SignConventionDefinition {
  transverseDeflection: string;
  rotationX: string;
  rotationY: string;
  momentX: string;
  momentY: string;
  momentXY: string;
  shearX: string;
  shearY: string;
}

export interface FixedPositionAnalysisSummary {
  totalWheelLoad: number;
  totalAppliedLoadToSlab: number;
  totalVerticalReaction: number;
  minDeflection: number;
  maxDeflection: number;
  maxAbsMomentX: number;
  maxAbsMomentY: number;
  maxAbsMomentXY: number;
  maxAbsShearX: number;
  maxAbsShearY: number;
}

export interface FixedPositionAnalysisResult {
  units: UnitSystem;
  signConvention: SignConventionDefinition;
  mesh: StructuredMesh;
  wheelPatches: WheelPatch[];
  nodalDisplacements: NodalDisplacement[];
  elementResults: ElementCenterResult[];
  /**
   * Area-weighted nodal recovery (WP-030), one entry per mesh node, including
   * the twisting moment `mxy`. Smoothed averages, never singular corner extrema.
   */
  nodalFields: NodalFieldValues[];
  supportReactions: SupportReaction[];
  /**
   * Signed global force/moment equilibrium (WP-025) about the ADR reporting
   * origin (start-support centre). Verified within tolerance before the result
   * is returned; exposed for the facade, reaction distributions, and the report.
   */
  equilibrium: SignedEquilibriumReport;
  summary: FixedPositionAnalysisSummary;
  diagnostics: SolverDiagnostics;
  warnings: string[];
}

export interface BenchmarkCaseReference {
  id: string;
  label: string;
  vehicleReferenceX: number;
  loadedElementCount: number;
  expectedTotalReactionKN: number;
  referenceMxMinKNmPerM: number;
  referenceMxMaxKNmPerM: number;
  referenceMyMinKNmPerM: number;
  referenceMyMaxKNmPerM: number;
  referenceCentrelineMaxAbsQxKNPerM: number;
}

export interface BenchmarkFixtureMetadata {
  id: string;
  name: string;
  sourceNotebookPath: string;
  notes: string[];
  toleranceTargetPercent: number;
  slabReference: {
    lengthX: number;
    widthY: number;
    thickness: number;
    supportLineX: number[];
    meshSize: number;
  };
  loadReference: {
    vehicleName: string;
    patchLength: number;
    patchWidth: number;
    patchLoad: number;
    wheelsPerAxle: number;
    axleCount: number;
    wheelSpacingAlong: number;
    axleSpacingAcross: number;
    dynamicAmplificationFactor: number;
    gammaG: number;
    gammaQ: number;
    psi1: number;
  };
  cases: BenchmarkCaseReference[];
}

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
  | {
      id: string;
      kind: 'edge';
      edge: SkewGeometryContract.DeckEdge;
      restraint: NormalizedSupportRestraint;
    }
  | {
      id: string;
      kind: 'line';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      restraint: NormalizedSupportRestraint;
    }
  | {
      id: string;
      kind: 'point';
      x: number;
      y: number;
      restraint: NormalizedSupportRestraint;
    };

export type LegacyGeneralizedCoordinateSupportInput =
  | {
      id?: string;
      behavior?: 'fixed' | 'pinned' | 'custom';
      kind: 'line';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      dofs?: { w?: SupportDofConstraint; rx?: SupportDofConstraint; ry?: SupportDofConstraint };
    }
  | {
      id?: string;
      behavior?: 'fixed' | 'pinned' | 'custom';
      kind: 'point';
      x: number;
      y: number;
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

/**
 * Compile-safe declarations only. WP-020 promoted the mesh members; WP-026
 * promotes the remaining solver members and removes their staged aliases.
 */
export declare namespace StagedSkewSolverContract {
  type NormalizedSlabGeometry = SkewGeometryContract.SlabGeometry;

  type SupportDefinitionV2 = InternalNormalizedSupport;

  interface InternalNodalKinematicsV2 {
    nodeId: number;
    x: number;
    y: number;
    s: number;
    t: number;
    w: number;
    betaX: number;
    betaY: number;
  }

  interface InternalElementResultV2 {
    elementId: number;
    x: number;
    y: number;
    s: number;
    t: number;
    deflection: number;
    mx: number;
    my: number;
    mxy: number;
    qx: number;
    qy: number;
  }

  interface InternalNodalRecoveryV2 {
    nodeId: number;
    x: number;
    y: number;
    s: number;
    t: number;
    deflection: number;
    mx: number;
    my: number;
    mxy: number;
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
    mesh: StructuredMesh;
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
