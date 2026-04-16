import type {
  AnalysisResults,
  ConstraintSet,
  SlabModel,
  Support,
} from "./types";

const defaultConstraintSet = (): ConstraintSet => ({
  uz: { type: "fixed" },
  rx: { type: "pinned" },
  ry: { type: "pinned" },
});

const defaultSupports = (): Support[] => [
  {
    id: "S1",
    name: "Left edge line support",
    kind: "line",
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 5,
    constraints: defaultConstraintSet(),
  },
  {
    id: "S2",
    name: "Corner point spring",
    kind: "point",
    x: 10,
    y: 5,
    constraints: {
      uz: { type: "spring", stiffness: 50000 },
      rx: { type: "free" },
      ry: { type: "free" },
    },
  },
];

export const createDefaultModel = (): SlabModel => ({
  projectName: "Moving Load Slab V1",
  geometry: {
    lengthM: 10,
    widthM: 5,
    thicknessM: 0.4,
  },
  material: {
    elasticModulusMPa: 32000,
    poisson: 0.2,
    densityKnPerM3: 25,
  },
  mesh: {
    density: 10,
    autoTargetElementM: 0.5,
  },
  supports: defaultSupports(),
  vehicle: {
    name: "Default 2-Axle Vehicle",
    mode: "axle",
    trackM: 2.0,
    wheelsPerAxle: 2,
    wheelPatchLongM: 0.4,
    wheelPatchTransM: 0.25,
    axleInputs: [
      { id: "A1", spacingFromPreviousM: 0, axleLoadKn: 90 },
      { id: "A2", spacingFromPreviousM: 4, axleLoadKn: 140 },
    ],
    directWheels: [
      { id: "W1", xM: 2, yM: 1.5, loadKn: 65, patchLongM: 0.4, patchTransM: 0.25 },
      { id: "W2", xM: 2, yM: 3.5, loadKn: 65, patchLongM: 0.4, patchTransM: 0.25 },
    ],
  },
  placement: {
    centerXM: 5,
    centerYM: 2.5,
    headingDeg: 0,
    transverseOffsetM: 0,
    travelDirection: "x+",
    pathStartM: 0,
    pathEndM: 10,
    pathStepM: 1,
  },
  display: {
    mesh: true,
    supports: true,
    wheelPatches: true,
    contours: true,
    tables: true,
  },
});

export const idleResults = (): AnalysisResults => ({
  status: "idle",
  source: "stub",
  contours: {},
  mesh: undefined,
  wheelPatches: [],
  reactions: [],
  summary: {
    maxDeflectionMm: 0,
    maxAbsMomentKnmPerM: 0,
    maxAbsShearKnPerM: 0,
  },
  elapsedMs: 0,
});

export const sanitizeLoadedModel = (input: unknown): SlabModel => {
  const defaults = createDefaultModel();
  if (!input || typeof input !== "object") {
    return defaults;
  }

  const candidate = input as Partial<SlabModel>;
  return {
    ...defaults,
    ...candidate,
    geometry: { ...defaults.geometry, ...(candidate.geometry ?? {}) },
    material: { ...defaults.material, ...(candidate.material ?? {}) },
    mesh: { ...defaults.mesh, ...(candidate.mesh ?? {}) },
    vehicle: {
      ...defaults.vehicle,
      ...(candidate.vehicle ?? {}),
      axleInputs:
        candidate.vehicle?.axleInputs && candidate.vehicle.axleInputs.length > 0
          ? candidate.vehicle.axleInputs
          : defaults.vehicle.axleInputs,
      directWheels:
        candidate.vehicle?.directWheels && candidate.vehicle.directWheels.length > 0
          ? candidate.vehicle.directWheels
          : defaults.vehicle.directWheels,
    },
    placement: { ...defaults.placement, ...(candidate.placement ?? {}) },
    display: { ...defaults.display, ...(candidate.display ?? {}) },
    supports:
      candidate.supports && candidate.supports.length > 0
        ? candidate.supports
        : defaults.supports,
  };
};
