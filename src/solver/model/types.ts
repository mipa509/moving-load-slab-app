export const DOF_KEYS = ["w", "rx", "ry"] as const;

export type DofKey = (typeof DOF_KEYS)[number];
export type AxisDirection = "+x" | "-x" | "+y" | "-y";
export type SupportBehavior = "fixed" | "pinned" | "custom";

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
  wheelTrack?: number;
  leftLoadFraction?: number;
  rightLoadFraction?: number;
  patchLength?: number;
  patchWidth?: number;
}

export interface AxleBuilderVehicleDefinition {
  kind: "axle-builder";
  direction: AxisDirection;
  reference: VehicleReferencePoint;
  transverseOffset?: number;
  defaultWheelTrack: number;
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
}

export interface MeshElement {
  id: number;
  nodeIds: [number, number, number, number];
  bounds: RectBounds;
}

export interface StructuredMesh {
  xCoords: number[];
  yCoords: number[];
  nodes: MeshNode[];
  elements: MeshElement[];
  nodeIdsByIJ: number[][];
  elementCountX: number;
  elementCountY: number;
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
  supportReactions: SupportReaction[];
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
