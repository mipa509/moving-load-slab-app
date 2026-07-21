import type { FixedPositionAnalysisModel, MaterialDefinition, MeshNode } from "../model/types";

/**
 * Deterministic rectangular (zero-skew) characterization case for the current
 * Mindlin Q4 solver contract. This is regression evidence, not physical validation.
 */
export const ZERO_SKEW_CHARACTERIZATION_MATERIAL: MaterialDefinition = {
  elasticModulusMPa: 30000,
  poissonRatio: 0.2,
};

export const ZERO_SKEW_CHARACTERIZATION_ELEMENT_NODES: readonly [
  MeshNode,
  MeshNode,
  MeshNode,
  MeshNode,
] = [
  { id: 0, x: 0, y: 0 },
  { id: 1, x: 1, y: 0 },
  { id: 4, x: 1, y: 1 },
  { id: 3, x: 0, y: 1 },
];

export const ZERO_SKEW_CHARACTERIZATION_MODEL: FixedPositionAnalysisModel = {
  slab: { lengthX: 2, lengthY: 2, thickness: 0.3 },
  material: ZERO_SKEW_CHARACTERIZATION_MATERIAL,
  mesh: { targetElementsX: 2, targetElementsY: 2, tolerance: 1e-9 },
  supports: [
    { kind: "line", id: "x0", behavior: "fixed", x1: 0, y1: 0, x2: 0, y2: 2 },
    { kind: "line", id: "x2", behavior: "fixed", x1: 2, y1: 0, x2: 2, y2: 2 },
    { kind: "line", id: "y0", behavior: "fixed", x1: 0, y1: 0, x2: 2, y2: 0 },
    { kind: "line", id: "y2", behavior: "fixed", x1: 0, y1: 2, x2: 2, y2: 2 },
  ],
  vehicle: {
    kind: "explicit-wheels",
    coordinateSystem: "global-slab",
    direction: "+x",
    wheels: [
      {
        id: "W1",
        x: 1,
        y: 1,
        load: 100,
        patchLength: 0.5,
        patchWidth: 0.5,
        direction: "+x",
      },
    ],
  },
  options: { cgTolerance: 1e-10, cgAbsoluteTolerance: 1e-12, cgMaxIterations: 3000 },
};

export const ZERO_SKEW_CHARACTERIZATION_EXPECTED = {
  elementStiffness: [
    1562500, -390625, -390625, 0, -390625, -390625, -1562500, -390625, -390625, 0, -390625, -390625,
    -390625, 228125, 10546.875, 390625, 176562.5, -3515.625, 390625, 178906.25, -10546.875, -390625, 197656.25, 3515.625,
    -390625, 10546.875, 228125, -390625, 3515.625, 197656.25, 390625, -10546.875, 178906.25, 390625, -3515.625, 176562.5,
    0, 390625, -390625, 1562500, 390625, -390625, 0, 390625, -390625, -1562500, 390625, -390625,
    -390625, 176562.5, 3515.625, 390625, 228125, -10546.875, 390625, 197656.25, -3515.625, -390625, 178906.25, 10546.875,
    -390625, -3515.625, 197656.25, -390625, -10546.875, 228125, 390625, 3515.625, 176562.5, 390625, 10546.875, 178906.25,
    -1562500, 390625, 390625, 0, 390625, 390625, 1562500, 390625, 390625, 0, 390625, 390625,
    -390625, 178906.25, -10546.875, 390625, 197656.25, 3515.625, 390625, 228125, 10546.875, -390625, 176562.5, -3515.625,
    -390625, -10546.875, 178906.25, -390625, -3515.625, 176562.5, 390625, 10546.875, 228125, 390625, 3515.625, 197656.25,
    0, -390625, 390625, -1562500, -390625, 390625, 0, -390625, 390625, 1562500, -390625, 390625,
    -390625, 197656.25, -3515.625, 390625, 178906.25, 10546.875, 390625, 176562.5, 3515.625, -390625, 228125, -10546.875,
    -390625, 3515.625, 176562.5, -390625, 10546.875, 178906.25, 390625, -3515.625, 197656.25, 390625, -10546.875, 228125,
  ],
  globalLoadVector: [
    0.390625, 0, 0, 5.46875, 0, 0, 0.390625, 0, 0,
    5.46875, 0, 0, 76.5625, 0, 0, 5.46875, 0, 0,
    0.390625, 0, 0, 5.46875, 0, 0, 0.390625, 0, 0,
  ],
  nodalW: [0, 0, 0, 0, 0.00001225, 0, 0, 0, 0],
  nodalRx: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  nodalRy: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  verticalReactions: [
    { supportId: 'x0', nodeId: 0, value: -19.53125 },
    { supportId: 'x0', nodeId: 3, value: -5.46875 },
    { supportId: 'x0', nodeId: 6, value: -19.53125 },
    { supportId: 'x2', nodeId: 2, value: -19.53125 },
    { supportId: 'x2', nodeId: 5, value: -5.46875 },
    { supportId: 'x2', nodeId: 8, value: -19.53125 },
    { supportId: 'y0', nodeId: 0, value: -19.53125 },
    { supportId: 'y0', nodeId: 1, value: -5.46875 },
    { supportId: 'y0', nodeId: 2, value: -19.53125 },
    { supportId: 'y2', nodeId: 6, value: -19.53125 },
    { supportId: 'y2', nodeId: 7, value: -5.46875 },
    { supportId: 'y2', nodeId: 8, value: -19.53125 },
  ],
  summary: {
    totalWheelLoad: 100,
    totalAppliedLoadToSlab: 100,
    totalVerticalReaction: -100,
    minDeflection: 0,
    maxDeflection: 0.00001225,
    maxAbsMomentX: 0,
    maxAbsMomentY: 0,
    maxAbsMomentXY: 0,
    maxAbsShearX: 19.140625,
    maxAbsShearY: 19.140625,
  },
  diagnostics: {
    converged: true,
    iterations: 1,
    residualNorm: 0,
    initialResidualNorm: 76.5625,
    totalDofs: 27,
    freeDofs: 3,
    fixedDofs: 24,
  },
} as const;
