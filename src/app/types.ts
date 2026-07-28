import type * as SkewGeometryContract from '../solver/geometry/types';

export type ResultField = "deflection" | "mx" | "my" | "mxy" | "qx" | "qy" | "reactions";

export type SupportKind = "line" | "point" | "edge";
export type Dof = "uz" | "rx" | "ry";
export type ConstraintType = "free" | "fixed" | "pinned" | "spring";
export type VehicleInputMode = "axle" | "direct";
export type TravelDirection = "x+" | "x-" | "y+" | "y-";
export type PlotMode = "results" | "structure" | "deformed";

export type SlabGeometry = SkewGeometryContract.SlabGeometry;

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

export interface EdgeSupport extends SupportBase {
  kind: "edge";
  edge: SkewGeometryContract.DeckEdge;
}

export type Support = LineSupport | PointSupport | EdgeSupport;

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

export interface EnvelopeWorstStation {
  stationM: number;
  peakValue: number;
  peakAbs: number;
  nodeId: number;
}

export interface EnvelopeWorstStations {
  mx: EnvelopeWorstStation;
  my: EnvelopeWorstStation;
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
  worstStations: EnvelopeWorstStations;
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

  // WP-032B: skew-general evidence (optional; populated by the adapter in
  // WP-032C, consumed incrementally by WP-041B etc.)
  deckPolygon?: Array<{ xM: number; yM: number }>;
  deckBounds?: { xMinM: number; xMaxM: number; yMinM: number; yMaxM: number };
  meshNodeOverlays?: StagedSkewAppContract.MeshNodeOverlayV2[];
  meshElementOverlays?: StagedSkewAppContract.MeshElementOverlayV2[];
  wheelPatchOverlays?: WheelPatchOverlay[];
  nodalKinematics?: NodalKinematics[];
  nodalFields?: NodalFieldMap;
  elementFields?: ElementFieldMap;
  physicalReactions?: SupportReactionRow[];
  physicalReactionSummaryBySupport?: Array<PhysicalActionTotals & { supportId: string }>;
  physicalReactionTotals?: PhysicalActionTotals;
  reactionDistributions?: SupportReactionDistribution[]; // predefined for WP-034; adapter leaves undefined
  sections?: SectionCurve[]; // predefined for WP-033; adapter leaves undefined
  envelopeV2?: StagedSkewAppContract.EnvelopeDataV2; // predefined for WP-035; complete mxy-inclusive envelope
  equilibrium?: SignedEquilibrium;
  meshQuality?: MeshQualityReport;
  verification?: VerificationEvidenceStatus;
  warningRequired?: boolean;
}

export type PhysicalSupportDof = 'w' | 'rotationX' | 'rotationY';

export type SupportDofConstraint =
  | { kind: 'free' }
  | { kind: 'fixed' }
  | { kind: 'spring'; stiffness: number };

export interface PhysicalSupportDofConstraints {
  w: SupportDofConstraint;
  rotationX: SupportDofConstraint;
  rotationY: SupportDofConstraint;
}

export type SupportRestraint =
  | { behavior: 'fixed' }
  | { behavior: 'pinned' }
  | { behavior: 'custom'; dofs: PhysicalSupportDofConstraints };

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
      id: string;
      name: string;
      kind: 'line';
      constraints: LegacyConstraintSet;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }
  | {
      id: string;
      name: string;
      kind: 'point';
      constraints: LegacyConstraintSet;
      x: number;
      y: number;
    }
  | {
      id: string;
      name: string;
      kind: 'edge';
      constraints: LegacyConstraintSet;
      edge: SkewGeometryContract.DeckEdge;
    };

export interface PersistedMaterialSnapshotV1 {
  elasticModulusMPa: number;
  poisson: number;
  densityKnPerM3: number;
}

export interface PersistedMeshSnapshotV1 {
  density: number;
  autoTargetElementM: number;
}

export interface PersistedAxleSnapshotV1 {
  id: string;
  spacingFromPreviousM: number;
  axleLoadKn: number;
}

export interface PersistedDirectWheelSnapshotV1 {
  id: string;
  xM: number;
  yM: number;
  loadKn: number;
  patchLongM: number;
  patchTransM: number;
}

export interface PersistedVehicleSnapshotV1 {
  name: string;
  mode: 'axle' | 'direct';
  transverseSpacingM: number;
  wheelsPerAxle: number;
  wheelPatchLongM: number;
  wheelPatchTransM: number;
  axleInputs: PersistedAxleSnapshotV1[];
  directWheels: PersistedDirectWheelSnapshotV1[];
}

export interface PersistedPlacementSnapshotV1 {
  centerXM: number;
  centerYM: number;
  headingDeg: number;
  transverseOffsetM: number;
  travelDirection: 'x+' | 'x-' | 'y+' | 'y-';
  pathStartM: number;
  pathEndM: number;
  pathStepM: number;
}

export interface PersistedDisplaySnapshotV1 {
  plotMode: 'results' | 'structure' | 'deformed';
  mesh: boolean;
  supports: boolean;
  wheelPatches: boolean;
  contours: boolean;
  tables: boolean;
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
  axis: 'auto' | 'x' | 'y';
  centerPerpM: number;
  widthM: number;
}

export type SectionOrdinate = 'mx' | 'my' | 'mxy';

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
  geometry: SkewGeometryContract.SlabGeometry;
  supports: LegacyCoordinateSupport[];
  section: PersistedLegacySectionSettingsV1;
};

export type PersistedModelV3PhysicalSupports = PersistedModelCommonSnapshotV1 & {
  schemaVersion: 3;
  supportSchema: 'physical-v1';
  sectionSchema?: never;
  geometry: SkewGeometryContract.SlabGeometry;
  supports: StagedSkewAppContract.SupportV2[];
  section: PersistedLegacySectionSettingsV1;
};

export type PersistedModelV4SectionBridge = PersistedModelCommonSnapshotV1 & {
  schemaVersion: 4;
  supportSchema: 'physical-v1';
  sectionSchema: 'section-bridge-v1';
  geometry: SkewGeometryContract.SlabGeometry;
  supports: StagedSkewAppContract.SupportV2[];
  section: SectionSettingsBridgeV4;
};

export type PersistedModelV5DeckOnly = PersistedModelCommonSnapshotV1 & {
  schemaVersion: 5;
  supportSchema: 'physical-v1';
  sectionSchema: 'deck-local-v1';
  geometry: SkewGeometryContract.SlabGeometry;
  supports: StagedSkewAppContract.SupportV2[];
  section: PersistedDeckSectionSettingsV1;
};

export type LoadablePersistedModel =
  | PersistedModelV1Implicit
  | PersistedModelV2SkewLegacySupports
  | PersistedModelV3PhysicalSupports
  | PersistedModelV4SectionBridge
  | PersistedModelV5DeckOnly;

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

export type MomentField = 'mx' | 'my' | 'mxy';
export type FieldLocation = 'node' | 'element-center';

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
  F extends 'deflection' | 'mx' | 'my' | 'mxy' | 'qx' | 'qy',
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
export type NodalMxFieldData = FieldDataBase<'mx', 'node', 'kN*m/m', NodalFieldPoint>;
export type NodalMyFieldData = FieldDataBase<'my', 'node', 'kN*m/m', NodalFieldPoint>;
export type NodalMxyFieldData = FieldDataBase<'mxy', 'node', 'kN*m/m', NodalFieldPoint>;

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
  severity: 'ok' | 'warning';
  diagnosticCodes: string[];
}

export type DiagnosticSeverity = 'info' | 'warning' | 'error';

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
  status: 'ok' | 'warning';
  diagnostics: MeshQualityDiagnostic[];
}

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
  | { component: 'forceZ'; value: number; units: 'kN' }
  | { component: 'coupleX' | 'coupleY'; value: number; units: 'kN*m' };

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
  | {
      sourceCase: 'unshared-fixed';
      fixedAttribution: Extract<FixedReactionAttribution, { method: 'unshared-fixed' }>;
    }
  | {
      sourceCase: 'shared-fixed-attribution';
      fixedAttribution: Extract<
        FixedReactionAttribution,
        { method: 'equal-shared-fixed-reporting' }
      >;
    }
  | { sourceCase: 'spring-direct'; fixedAttribution?: never }
  | { sourceCase: 'mixed-fixed-spring'; fixedAttribution: FixedReactionAttribution }
);

export interface UnitPlanarDirection {
  x: number;
  y: number;
}

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
      edge: SkewGeometryContract.DeckEdge;
      distanceOrigin: 'canonical-edge-start';
      frame: CanonicalEdgeReactionFrame;
    })
  | (SupportReactionDistributionBase & {
      supportKind: 'line';
      edge?: never;
      distanceOrigin: 'authored-line-start';
      frame: AuthoredLineReactionFrame;
    });

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

export type DeckSectionSettings = PersistedDeckSectionSettingsV1;

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

export type FormulationVerification = 'not-checked' | 'failed' | 'conditional' | 'passed';
export type ReferenceStudyVerification = 'not-run' | 'failed' | 'conditional' | 'passed';
export type CurrentModelConvergence =
  | 'not-demonstrated'
  | 'failed'
  | 'conditional'
  | 'passed';

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

export interface LegacyContourPointView {
  xM: number;
  yM: number;
  value: number;
}

export interface LegacyNodalContourPointView extends LegacyContourPointView {
  nodeId: number;
}

export interface LegacyContourDataView {
  field: 'deflection' | 'mx' | 'my' | 'qx' | 'qy';
  points: LegacyContourPointView[];
  min: number;
  max: number;
  units: string;
}

export interface LegacyNodalContourDataView {
  field: 'deflection' | 'mx' | 'my' | 'qx' | 'qy';
  points: LegacyNodalContourPointView[];
  min: number;
  max: number;
  units: string;
}

export interface LegacyMeshNodeView {
  id: number;
  xM: number;
  yM: number;
}

export interface LegacyMeshElementView {
  id: number;
  nodeIds: [number, number, number, number];
}

export interface LegacyNodalDisplacementView {
  nodeId: number;
  wM: number;
}

export interface LegacyMeshAxesView {
  xCoordsM: number[];
  yCoordsM: number[];
}

export interface LegacyRectWheelPatchView {
  xMinM: number;
  xMaxM: number;
  yMinM: number;
  yMaxM: number;
}

export interface LegacyReactionRowView {
  supportId: string;
  nodeId?: number;
  dof: 'uz' | 'rx' | 'ry';
  type?: 'fixed' | 'spring';
  value: number;
  units: string;
}

export interface LegacyReactionTotalsView {
  uz: number;
  rx: number;
  ry: number;
}

export interface LegacyReactionSummaryView extends LegacyReactionTotalsView {
  supportId: string;
}

export interface LegacyAnalysisSummaryView {
  maxDeflectionMm: number;
  maxAbsMomentKnmPerM: number;
  maxAbsShearKnPerM: number;
}

export interface LegacyEnvelopePerNodeView {
  nodeId: number;
  xM: number;
  yM: number;
  max: number;
  min: number;
}

export interface LegacyEnvelopeFieldDataView {
  field: 'deflection' | 'mx' | 'my';
  points: LegacyEnvelopePerNodeView[];
  max: number;
  min: number;
  absMax: number;
  units: string;
}

export interface LegacyEnvelopeWorstStationView {
  stationM: number;
  peakValue: number;
  peakAbs: number;
  nodeId: number;
}

export interface LegacyEnvelopeWorstStationsView {
  mx: LegacyEnvelopeWorstStationView;
  my: LegacyEnvelopeWorstStationView;
}

export interface LegacyEnvelopeDataView {
  stationsRun: number;
  pathStartM: number;
  pathEndM: number;
  pathStepM: number;
  travelDirection: 'x+' | 'x-' | 'y+' | 'y-';
  computedAtIso: string;
  signature: string;
  mx: LegacyEnvelopeFieldDataView;
  my: LegacyEnvelopeFieldDataView;
  deflection: LegacyEnvelopeFieldDataView;
  worstStations: LegacyEnvelopeWorstStationsView;
}

export interface LegacyAnalysisResultViews {
  /** @deprecated Derived from nodalFields/elementFields. */
  contours: Partial<
    Record<'deflection' | 'mx' | 'my' | 'qx' | 'qy', LegacyContourDataView>
  >;
  /** @deprecated Derived from nodalFields. */
  nodalContours: Partial<
    Record<'deflection' | 'mx' | 'my' | 'qx' | 'qy', LegacyNodalContourDataView>
  >;
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
  | { verification: WarningFreeVerificationStatus; releaseWarnings: [] }
  | { verification: WarningRequiredVerificationStatus; releaseWarnings: [ReleaseWarning] }
);

/**
 * Compile-safe declarations only. WP-014A promotes geometry, WP-027 promotes
 * support, and WP-032B promotes section/results; each owner removes its alias.
 */
export declare namespace StagedSkewAppContract {
  type ResultFieldV2 = 'deflection' | 'mx' | 'my' | 'mxy' | 'qx' | 'qy' | 'reactions';
  type EnvelopeFieldV2 = 'deflection' | 'mx' | 'my' | 'mxy';

  interface MeshNodeOverlayV2 {
    id: number;
    xM: number;
    yM: number;
    sM: number;
    tM: number;
  }

  interface MeshElementOverlayV2 {
    id: number;
    nodeIds: [number, number, number, number];
    polygon: Array<{ xM: number; yM: number }>;
    bounds: { xMinM: number; xMaxM: number; yMinM: number; yMaxM: number };
  }

  interface EnvelopePerNodeV2 {
    nodeId: number;
    xM: number;
    yM: number;
    sM: number;
    tM: number;
    max: number;
    min: number;
  }

  interface EnvelopeFieldDataV2<
    F extends EnvelopeFieldV2,
    U extends 'mm' | 'kN*m/m',
  > {
    field: F;
    points: EnvelopePerNodeV2[];
    max: number;
    min: number;
    absMax: number;
    units: U;
  }

  interface EnvelopeWorstStationV2<F extends MomentField> {
    field: F;
    stationM: number;
    peakValue: number;
    peakAbs: number;
    nodeId: number;
    units: 'kN*m/m';
  }

  interface EnvelopeWorstStationsV2 {
    mx: EnvelopeWorstStationV2<'mx'>;
    my: EnvelopeWorstStationV2<'my'>;
    mxy: EnvelopeWorstStationV2<'mxy'>;
  }

  interface EnvelopeDataV2 {
    stationsRun: number;
    pathStartM: number;
    pathEndM: number;
    pathStepM: number;
    travelDirection: 'x+' | 'x-' | 'y+' | 'y-';
    computedAtIso: string;
    signature: string;
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
        kind: 'line';
        x1M: number;
        y1M: number;
        x2M: number;
        y2M: number;
      })
    | (SupportBaseV2 & { kind: 'point'; xM: number; yM: number });

  type SectionSettingsV2 = SectionSettingsBridgeV4;

  type AnalysisResultsV2 =
    | IdleAnalysisResults
    | RunningAnalysisResults
    | SuccessAnalysisResults
    | ErrorAnalysisResults;
}
