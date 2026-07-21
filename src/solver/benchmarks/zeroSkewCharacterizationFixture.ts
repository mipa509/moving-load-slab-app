import type { FixedPositionAnalysisModel, MaterialDefinition, MeshNode } from "../model/types";

/**
 * Deterministic rectangular (zero-skew) case shared by the frozen pre-MITC4
 * and current MITC4 characterizations. This is regression evidence, not
 * physical validation.
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

export const ZERO_SKEW_PRE_MITC4_CHARACTERIZATION_EXPECTED = {
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

/**
 * Deliberate EF-004 zero-skew characterization produced by the MITC4 kernel
 * commit 0088e11 and captured from the 44084dd dispatch checkpoint.
 * These values are regression evidence only, not physical validation.
 */
export const ZERO_SKEW_CHARACTERIZATION_EXPECTED = {
  elementStiffness: [
    2083333.3333333335, -520833.3333333334, -520833.3333333334, -520833.33333333343, -520833.3333333334, -260416.66666666666, -1041666.6666666666, -260416.66666666666, -260416.66666666666, -520833.3333333335, -260416.66666666666, -520833.3333333334,
    -520833.3333333334, 293229.16666666674, 10546.874999999996, 520833.3333333334, 241666.6666666667, -3515.624999999999, 260416.66666666666, 113802.08333333334, -10546.874999999996, -260416.66666666666, 132552.0833333333, 3515.624999999999,
    -520833.3333333334, 10546.874999999996, 293229.1666666667, -260416.66666666666, 3515.624999999999, 132552.0833333333, 260416.66666666666, -10546.874999999996, 113802.08333333334, 520833.3333333334, -3515.6249999999986, 241666.6666666667,
    -520833.33333333343, 520833.3333333334, -260416.66666666666, 2083333.3333333335, 520833.3333333334, -520833.3333333334, -520833.33333333343, 260416.66666666666, -520833.3333333334, -1041666.6666666666, 260416.66666666666, -260416.66666666666,
    -520833.3333333334, 241666.6666666667, 3515.624999999999, 520833.3333333334, 293229.16666666674, -10546.874999999996, 260416.66666666666, 132552.0833333333, -3515.624999999999, -260416.66666666666, 113802.08333333334, 10546.874999999996,
    -260416.66666666666, -3515.624999999999, 132552.0833333333, -520833.3333333334, -10546.874999999996, 293229.16666666674, 520833.3333333334, 3515.6249999999986, 241666.6666666667, 260416.66666666666, 10546.874999999996, 113802.08333333334,
    -1041666.6666666666, 260416.66666666666, 260416.66666666666, -520833.33333333343, 260416.66666666666, 520833.3333333334, 2083333.3333333335, 520833.3333333334, 520833.3333333334, -520833.3333333335, 520833.3333333334, 260416.66666666666,
    -260416.66666666666, 113802.08333333334, -10546.874999999996, 260416.66666666666, 132552.0833333333, 3515.6249999999986, 520833.3333333334, 293229.1666666667, 10546.874999999996, -520833.3333333334, 241666.6666666667, -3515.6249999999986,
    -260416.66666666666, -10546.874999999996, 113802.08333333334, -520833.3333333334, -3515.624999999999, 241666.6666666667, 520833.3333333334, 10546.874999999996, 293229.16666666674, 260416.66666666666, 3515.6249999999986, 132552.0833333333,
    -520833.3333333335, -260416.66666666666, 520833.3333333334, -1041666.6666666666, -260416.66666666666, 260416.66666666666, -520833.3333333335, -520833.3333333334, 260416.66666666666, 2083333.3333333335, -520833.3333333334, 520833.3333333334,
    -260416.66666666666, 132552.0833333333, -3515.6249999999986, 260416.66666666666, 113802.08333333334, 10546.874999999996, 520833.3333333334, 241666.6666666667, 3515.6249999999986, -520833.3333333334, 293229.1666666667, -10546.874999999996,
    -520833.3333333334, 3515.624999999999, 241666.6666666667, -260416.66666666666, 10546.874999999996, 113802.08333333334, 260416.66666666666, -3515.6249999999986, 132552.0833333333, 520833.3333333334, -10546.874999999996, 293229.1666666667,
  ],
  globalLoadVector: [
    0.390625, 0, 0, 5.46875, 0, 0, 0.390625, 0, 0,
    5.46875, 0, 0, 76.5625, 0, 0, 5.46875, 0, 0,
    0.390625, 0, 0, 5.46875, 0, 0, 0.390625, 0, 0,
  ],
  nodalDisplacements: [
    { nodeId: 0, x: 0, y: 0, w: 0, rx: 0, ry: 0 },
    { nodeId: 1, x: 1, y: 0, w: 0, rx: 0, ry: 0 },
    { nodeId: 2, x: 2, y: 0, w: 0, rx: 0, ry: 0 },
    { nodeId: 3, x: 0, y: 1, w: 0, rx: 0, ry: 0 },
    { nodeId: 4, x: 1, y: 1, w: 0.0000091875, rx: 0, ry: 0 },
    { nodeId: 5, x: 2, y: 1, w: 0, rx: 0, ry: 0 },
    { nodeId: 6, x: 0, y: 2, w: 0, rx: 0, ry: 0 },
    { nodeId: 7, x: 1, y: 2, w: 0, rx: 0, ry: 0 },
    { nodeId: 8, x: 2, y: 2, w: 0, rx: 0, ry: 0 },
  ],
  supportReactions: [
    { supportId: "x0", nodeId: 0, x: 0, y: 0, dof: "w", type: "fixed", value: -9.9609375, displacement: 0 },
    { supportId: "x0", nodeId: 0, x: 0, y: 0, dof: "rx", type: "fixed", value: 2.392578125, displacement: 0 },
    { supportId: "x0", nodeId: 0, x: 0, y: 0, dof: "ry", type: "fixed", value: 2.392578125, displacement: 0 },
    { supportId: "x0", nodeId: 3, x: 0, y: 1, dof: "w", type: "fixed", value: -15.039062500000002, displacement: 0 },
    { supportId: "x0", nodeId: 3, x: 0, y: 1, dof: "rx", type: "fixed", value: 9.570312500000002, displacement: 0 },
    { supportId: "x0", nodeId: 3, x: 0, y: 1, dof: "ry", type: "fixed", value: -8.021743269637227e-16, displacement: 0 },
    { supportId: "x0", nodeId: 6, x: 0, y: 2, dof: "w", type: "fixed", value: -9.960937500000002, displacement: 0 },
    { supportId: "x0", nodeId: 6, x: 0, y: 2, dof: "rx", type: "fixed", value: 2.3925781250000004, displacement: 0 },
    { supportId: "x0", nodeId: 6, x: 0, y: 2, dof: "ry", type: "fixed", value: -2.3925781250000004, displacement: 0 },
    { supportId: "x2", nodeId: 2, x: 2, y: 0, dof: "w", type: "fixed", value: -9.9609375, displacement: 0 },
    { supportId: "x2", nodeId: 2, x: 2, y: 0, dof: "rx", type: "fixed", value: -2.3925781250000004, displacement: 0 },
    { supportId: "x2", nodeId: 2, x: 2, y: 0, dof: "ry", type: "fixed", value: 2.3925781249999996, displacement: 0 },
    { supportId: "x2", nodeId: 5, x: 2, y: 1, dof: "w", type: "fixed", value: -15.039062500000004, displacement: 0 },
    { supportId: "x2", nodeId: 5, x: 2, y: 1, dof: "rx", type: "fixed", value: -9.5703125, displacement: 0 },
    { supportId: "x2", nodeId: 5, x: 2, y: 1, dof: "ry", type: "fixed", value: -5.347828846424818e-16, displacement: 0 },
    { supportId: "x2", nodeId: 8, x: 2, y: 2, dof: "w", type: "fixed", value: -9.9609375, displacement: 0 },
    { supportId: "x2", nodeId: 8, x: 2, y: 2, dof: "rx", type: "fixed", value: -2.392578125, displacement: 0 },
    { supportId: "x2", nodeId: 8, x: 2, y: 2, dof: "ry", type: "fixed", value: -2.392578125, displacement: 0 },
    { supportId: "y0", nodeId: 0, x: 0, y: 0, dof: "w", type: "fixed", value: -9.9609375, displacement: 0 },
    { supportId: "y0", nodeId: 0, x: 0, y: 0, dof: "rx", type: "fixed", value: 2.392578125, displacement: 0 },
    { supportId: "y0", nodeId: 0, x: 0, y: 0, dof: "ry", type: "fixed", value: 2.392578125, displacement: 0 },
    { supportId: "y0", nodeId: 1, x: 1, y: 0, dof: "w", type: "fixed", value: -15.0390625, displacement: 0 },
    { supportId: "y0", nodeId: 1, x: 1, y: 0, dof: "rx", type: "fixed", value: -8.021743269637227e-16, displacement: 0 },
    { supportId: "y0", nodeId: 1, x: 1, y: 0, dof: "ry", type: "fixed", value: 9.5703125, displacement: 0 },
    { supportId: "y0", nodeId: 2, x: 2, y: 0, dof: "w", type: "fixed", value: -9.9609375, displacement: 0 },
    { supportId: "y0", nodeId: 2, x: 2, y: 0, dof: "rx", type: "fixed", value: -2.3925781250000004, displacement: 0 },
    { supportId: "y0", nodeId: 2, x: 2, y: 0, dof: "ry", type: "fixed", value: 2.3925781249999996, displacement: 0 },
    { supportId: "y2", nodeId: 6, x: 0, y: 2, dof: "w", type: "fixed", value: -9.960937500000002, displacement: 0 },
    { supportId: "y2", nodeId: 6, x: 0, y: 2, dof: "rx", type: "fixed", value: 2.3925781250000004, displacement: 0 },
    { supportId: "y2", nodeId: 6, x: 0, y: 2, dof: "ry", type: "fixed", value: -2.3925781250000004, displacement: 0 },
    { supportId: "y2", nodeId: 7, x: 1, y: 2, dof: "w", type: "fixed", value: -15.039062500000005, displacement: 0 },
    { supportId: "y2", nodeId: 7, x: 1, y: 2, dof: "rx", type: "fixed", value: 2.673914423212409e-16, displacement: 0 },
    { supportId: "y2", nodeId: 7, x: 1, y: 2, dof: "ry", type: "fixed", value: -9.570312500000002, displacement: 0 },
    { supportId: "y2", nodeId: 8, x: 2, y: 2, dof: "w", type: "fixed", value: -9.9609375, displacement: 0 },
    { supportId: "y2", nodeId: 8, x: 2, y: 2, dof: "rx", type: "fixed", value: -2.392578125, displacement: 0 },
    { supportId: "y2", nodeId: 8, x: 2, y: 2, dof: "ry", type: "fixed", value: -2.392578125, displacement: 0 },
  ],
  summary: {
    totalWheelLoad: 100,
    totalAppliedLoadToSlab: 100,
    totalVerticalReaction: -100,
    minDeflection: 0,
    maxDeflection: 0.0000091875,
    maxAbsMomentX: 0,
    maxAbsMomentY: 0,
    maxAbsMomentXY: 0,
    maxAbsShearX: 14.355468750000002,
    maxAbsShearY: 14.355468750000002,
  },
  diagnostics: {
    converged: true,
    iterations: 1,
    residualNorm: 2.879893969834564e-15,
    initialResidualNorm: 76.5625,
    totalDofs: 27,
    freeDofs: 3,
    fixedDofs: 24,
  },
} as const;

export const ZERO_SKEW_CHARACTERIZATION_HASHES = {
  algorithm: "sha256-json-stringify-v1",
  preMitc4At352556d: {
    elementStiffness: "580b5155e26d170c89fa9f58f850f1d60bf591f6593d01d5fb6ee5f4794d5012",
    globalLoadVector: "26861442529cffab66f5d5d09f647f52267c54c1c81d77adf6de668aac29ef7b",
    nodalW: "bd0363194f2b8b7ca9ce18d9f07092d2b09c2281064d05d3ea4894f400868274",
    nodalRx: "2ec39b8e5281419b8e38ee0825032600b5f9708a1c3289347a7e3507991facae",
    nodalRy: "2ec39b8e5281419b8e38ee0825032600b5f9708a1c3289347a7e3507991facae",
    verticalReactions: "0faf7fa824f6c7ce685e8e08901890d4b45212c5d38644b6052e02318b11eb95",
    summary: "533fce436e24261a974e69a37023489bc5e4ca027ab4618cded28854a48eb892",
    diagnostics: "cd7ba615e2096a5db7814f15a8b9784a40fdf87c41e1844928002b5b532f1d3e",
  },
  mitc4From0088e11CapturedAt44084dd: {
    elementStiffness: "d39e6d3f80877d833e7811f6ec35e85ffde0fc75604611d206cbc54f49d56f60",
    globalLoadVector: "26861442529cffab66f5d5d09f647f52267c54c1c81d77adf6de668aac29ef7b",
    nodalDisplacements: "07f12380c0e8598d1f8940b4cd52cd5f2783b8e430c32f82f5e28b4911dbeacf",
    supportReactions: "9b22617c79379c24e0bd02e1f17e408276c9ab71884b0976fb8e4c114012b4b8",
    summary: "5d63a00503d22f18778faeb5e39fbc8a7feb52ad1d5078746dc2f24394494cc4",
    diagnostics: "c628ac75567a7b9e4a849f761e8de9edcf0d5c0347846eaae3852ac8ecfc309c",
  },
} as const;
