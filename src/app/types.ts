export type ResultField = "deflection" | "mx" | "my" | "qx" | "qy" | "reactions";

export type SupportKind = "line" | "point";
export type Dof = "uz" | "rx" | "ry";
export type ConstraintType = "free" | "fixed" | "pinned" | "spring";
export type VehicleInputMode = "axle" | "direct";
export type TravelDirection = "x+" | "x-" | "y+" | "y-";

export interface SlabGeometry {
  lengthM: number;
  widthM: number;
  thicknessM: number;
}

export interface MaterialProps {
  elasticModulusMPa: number;
  poisson: number;
  densityKnPerM3: number;
}

export interface MeshSettings {
  density: number;
  autoTargetElementM: number;
}

export interface ConstraintSetting {
  type: ConstraintType;
  stiffness?: number;
}

export type ConstraintSet = Record<Dof, ConstraintSetting>;

interface SupportBase {
  id: string;
  kind: SupportKind;
  name: string;
  constraints: ConstraintSet;
}

export interface LineSupport extends SupportBase {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PointSupport extends SupportBase {
  kind: "point";
  x: number;
  y: number;
}

export type Support = LineSupport | PointSupport;

export interface AxleInput {
  id: string;
  spacingFromPreviousM: number;
  axleLoadKn: number;
}

export interface DirectWheelInput {
  id: string;
  xM: number;
  yM: number;
  loadKn: number;
  patchLongM: number;
  patchTransM: number;
}

export interface VehicleDefinition {
  name: string;
  mode: VehicleInputMode;
  trackM: number;
  wheelsPerAxle: number;
  wheelPatchLongM: number;
  wheelPatchTransM: number;
  axleInputs: AxleInput[];
  directWheels: DirectWheelInput[];
}

export interface VehiclePlacement {
  centerXM: number;
  centerYM: number;
  headingDeg: number;
  transverseOffsetM: number;
  travelDirection: TravelDirection;
  pathStartM: number;
  pathEndM: number;
  pathStepM: number;
}

export interface DisplayToggles {
  mesh: boolean;
  supports: boolean;
  wheelPatches: boolean;
  contours: boolean;
  tables: boolean;
}

export interface SlabModel {
  projectName: string;
  geometry: SlabGeometry;
  material: MaterialProps;
  mesh: MeshSettings;
  supports: Support[];
  vehicle: VehicleDefinition;
  placement: VehiclePlacement;
  display: DisplayToggles;
}

export interface ContourPoint {
  xM: number;
  yM: number;
  value: number;
}

export interface RectOverlay {
  xMinM: number;
  xMaxM: number;
  yMinM: number;
  yMaxM: number;
}

export interface MeshOverlay {
  xCoordsM: number[];
  yCoordsM: number[];
}

export interface ContourData {
  field: Exclude<ResultField, "reactions">;
  points: ContourPoint[];
  min: number;
  max: number;
  units: string;
}

export interface ReactionRow {
  supportId: string;
  dof: Dof;
  value: number;
  units: string;
}

export interface AnalysisSummary {
  maxDeflectionMm: number;
  maxAbsMomentKnmPerM: number;
  maxAbsShearKnPerM: number;
}

export interface AnalysisResults {
  status: "idle" | "running" | "success" | "error";
  source: "solver";
  contours: Partial<Record<Exclude<ResultField, "reactions">, ContourData>>;
  mesh?: MeshOverlay;
  wheelPatches?: RectOverlay[];
  reactions: ReactionRow[];
  summary: AnalysisSummary;
  elapsedMs: number;
  warning?: string;
  error?: string;
}
