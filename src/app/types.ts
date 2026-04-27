export type ResultField = "deflection" | "mx" | "my" | "qx" | "qy" | "reactions";

export type SupportKind = "line" | "point";
export type Dof = "uz" | "rx" | "ry";
export type ConstraintType = "free" | "fixed" | "pinned" | "spring";
export type VehicleInputMode = "axle" | "direct";
export type TravelDirection = "x+" | "x-" | "y+" | "y-";
export type PlotMode = "results" | "structure" | "deformed";

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
  transverseSpacingM: number;
  wheelsPerAxle: number;
  wheelPatchLongM: number;
  wheelPatchTransM: number;
  axleInputs: AxleInput[];
  directWheels: DirectWheelInput[];
}

export interface VehicleLibraryItem {
  id: string;
  name: string;
  vehicle: VehicleDefinition;
  updatedAtIso: string;
}

export interface VehicleLibraryExport {
  version: 1;
  exportedAtIso: string;
  vehicles: VehicleLibraryItem[];
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
  plotMode: PlotMode;
  mesh: boolean;
  supports: boolean;
  wheelPatches: boolean;
  contours: boolean;
  tables: boolean;
}

export type SectionAxisMode = "auto" | "x" | "y";

export interface SectionSettings {
  axis: SectionAxisMode;
  centerPerpM: number;
  widthM: number;
}

export interface SlabModel {
  projectName: string;
  description: string;
  assumptions: string;
  geometry: SlabGeometry;
  material: MaterialProps;
  mesh: MeshSettings;
  supports: Support[];
  vehicle: VehicleDefinition;
  placement: VehiclePlacement;
  display: DisplayToggles;
  section: SectionSettings;
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

export interface NodalContourPoint {
  nodeId: number;
  xM: number;
  yM: number;
  value: number;
}

export interface NodalContourData {
  field: Exclude<ResultField, "reactions">;
  points: NodalContourPoint[];
  min: number;
  max: number;
  units: string;
}

export interface MeshNodeOverlay {
  id: number;
  xM: number;
  yM: number;
}

export interface MeshElementOverlay {
  id: number;
  nodeIds: [number, number, number, number];
}

export interface NodalDisplacementOverlay {
  nodeId: number;
  wM: number;
}

export interface ReactionRow {
  supportId: string;
  nodeId?: number;
  dof: Dof;
  type?: "fixed" | "spring";
  value: number;
  units: string;
}

export interface ReactionComponentTotals {
  uz: number;
  rx: number;
  ry: number;
}

export interface ReactionSummaryRow extends ReactionComponentTotals {
  supportId: string;
}

export interface AnalysisSummary {
  maxDeflectionMm: number;
  maxAbsMomentKnmPerM: number;
  maxAbsShearKnPerM: number;
}

export type EnvelopeField = "deflection" | "mx" | "my";

export interface EnvelopePerNode {
  nodeId: number;
  xM: number;
  yM: number;
  max: number;
  min: number;
}

export interface EnvelopeFieldData {
  field: EnvelopeField;
  points: EnvelopePerNode[];
  max: number;
  min: number;
  absMax: number;
  units: string;
}

export interface EnvelopeData {
  stationsRun: number;
  pathStartM: number;
  pathEndM: number;
  pathStepM: number;
  travelDirection: TravelDirection;
  computedAtIso: string;
  signature: string;
  mx: EnvelopeFieldData;
  my: EnvelopeFieldData;
  deflection: EnvelopeFieldData;
}

export interface AnalysisResults {
  status: "idle" | "running" | "success" | "error";
  source: "solver";
  contours: Partial<Record<Exclude<ResultField, "reactions">, ContourData>>;
  nodalContours: Partial<Record<Exclude<ResultField, "reactions">, NodalContourData>>;
  meshNodes: MeshNodeOverlay[];
  meshElements: MeshElementOverlay[];
  nodalDisplacements: NodalDisplacementOverlay[];
  mesh?: MeshOverlay;
  wheelPatches?: RectOverlay[];
  reactions: ReactionRow[];
  reactionSummaryBySupport: ReactionSummaryRow[];
  reactionTotals: ReactionComponentTotals;
  summary: AnalysisSummary;
  envelope?: EnvelopeData;
  elapsedMs: number;
  warning?: string;
  error?: string;
}
