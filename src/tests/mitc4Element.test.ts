import { describe, expect, it } from "vitest";
import {
  computeMindlinConstitutive,
  computeMindlinQ4ElementStiffness,
  evaluateMindlinQ4At,
} from "../solver/core/element";
import {
  buildMitc4AssumedShearB,
  buildMitc4TyingRows,
} from "../solver/core/mitc4";
import {
  evaluateQ4Jacobian,
  evaluateQ4PhysicalGradients,
  evaluateQ4ShapeFunctions,
} from "../solver/core/q4Geometry";
import {
  addElementStiffnessToSparse,
  buildReducedSystem,
  createSparseMatrix,
  expandReducedSolution,
  multiplySparseMatrixVector,
  solveConjugateGradient,
  type SparseMatrix,
} from "../solver/core/sparse";
import type { MaterialDefinition, MeshNode } from "../solver/model/types";
import {
  assembleDenseStiffness,
  createAffineStructuredMesh,
  createMappedStructuredMesh,
  evaluateMeshJacobianQuality,
  extractPrincipalSubmatrix,
  matrixInfinityNorm,
  multiplyMatrixVector,
  normalizedAntisymmetry,
  quadraticEnergy,
  relativeMatrixResidual,
  scalePlateDofsByLength,
  symmetricEigenDiagnostics,
  vectorNorm,
  type DenseMatrix,
  type DiagnosticMesh,
} from "./helpers/elementStabilityDiagnostics";

const MATERIAL: MaterialDefinition = {
  elasticModulusMPa: 30_000,
  poissonRatio: 0.2,
  shearCorrectionFactor: 5 / 6,
};
const LENGTH = 2;
const WIDTH = 1.4;
const THICKNESS = 0.2;
const GAUSS = 1 / Math.sqrt(3);
const GAUSS_POINTS: ReadonlyArray<readonly [number, number]> = [
  [-GAUSS, -GAUSS],
  [GAUSS, -GAUSS],
  [GAUSS, GAUSS],
  [-GAUSS, GAUSS],
];
const TYING_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
const QUALITY_POINTS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
  ...TYING_POINTS,
  ...GAUSS_POINTS,
  [0, 0],
];
const ROUND_OFF_MULTIPLIER = 8192;

const ROTATED_SHEARED_AFFINE: [MeshNode, MeshNode, MeshNode, MeshNode] = [
  { id: 0, x: 0, y: 0 },
  { id: 1, x: 2, y: 0.6 },
  { id: 2, x: 2.45, y: 2 },
  { id: 3, x: 0.45, y: 1.4 },
];

const NON_AFFINE: [MeshNode, MeshNode, MeshNode, MeshNode] = [
  { id: 0, x: 0, y: 0 },
  { id: 1, x: 2, y: 0.2 },
  { id: 2, x: 2.25, y: 1.5 },
  { id: 3, x: -0.15, y: 1.25 },
];

function multiplyB(
  b: ArrayLike<number>,
  rows: number,
  displacement: ArrayLike<number>,
): number[] {
  return Array.from({ length: rows }, (_, row) => {
    let sum = 0;
    for (let column = 0; column < 12; column += 1) {
      sum += b[row * 12 + column] * displacement[column];
    }
    return sum;
  });
}

function dot(left: ArrayLike<number>, right: ArrayLike<number>): number {
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result += left[index] * right[index];
  }
  return result;
}

function nodalVector(
  nodes: readonly MeshNode[],
  field: (node: MeshNode) => readonly [number, number, number],
): Float64Array {
  const result = new Float64Array(nodes.length * 3);
  nodes.forEach((node, nodeIndex) => result.set(field(node), nodeIndex * 3));
  return result;
}

function expectNear(
  actual: number,
  expected: number,
  scale = Math.max(Math.abs(expected), 1),
  terms = 32,
): void {
  const tolerance = ROUND_OFF_MULTIPLIER * Number.EPSILON * terms * scale;
  expect(Math.abs(actual - expected), `${actual} ~= ${expected} within ${tolerance}`).toBeLessThanOrEqual(
    tolerance,
  );
}

function expectVectorNear(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  scale = 1,
): void {
  expect(actual.length).toBe(expected.length);
  for (let index = 0; index < actual.length; index += 1) {
    expectNear(actual[index], expected[index], scale);
  }
}

function elementMatrix(
  nodes: readonly [MeshNode, MeshNode, MeshNode, MeshNode],
  thickness = THICKNESS,
): DenseMatrix {
  return {
    order: 12,
    values: computeMindlinQ4ElementStiffness(nodes, MATERIAL, thickness),
  };
}

function rawCompatibleFullIntegrationElement(
  nodes: readonly [MeshNode, MeshNode, MeshNode, MeshNode],
  thickness: number,
): Float64Array {
  const constitutive = computeMindlinConstitutive(MATERIAL, thickness);
  const stiffness = new Float64Array(12 * 12);
  for (const [xi, eta] of GAUSS_POINTS) {
    const shapeFunctions = evaluateQ4ShapeFunctions(xi, eta);
    const derivatives = evaluateQ4PhysicalGradients(nodes, xi, eta);
    const bendingB = new Float64Array(3 * 12);
    for (let nodeIndex = 0; nodeIndex < 4; nodeIndex += 1) {
      const base = nodeIndex * 3;
      bendingB[base + 1] = derivatives.dNdx[nodeIndex];
      bendingB[12 + base + 2] = derivatives.dNdy[nodeIndex];
      bendingB[24 + base + 1] = derivatives.dNdy[nodeIndex];
      bendingB[24 + base + 2] = derivatives.dNdx[nodeIndex];
    }
    // Independent test oracle: assemble gamma = grad(w) + beta locally rather
    // than sharing the production compatible-shear helper used by MITC4.
    const shearB = new Float64Array(2 * 12);
    for (let nodeIndex = 0; nodeIndex < 4; nodeIndex += 1) {
      const base = nodeIndex * 3;
      shearB[base] = derivatives.dNdx[nodeIndex];
      shearB[base + 1] = shapeFunctions[nodeIndex];
      shearB[12 + base] = derivatives.dNdy[nodeIndex];
      shearB[12 + base + 2] = shapeFunctions[nodeIndex];
    }
    for (let row = 0; row < 12; row += 1) {
      for (let column = 0; column < 12; column += 1) {
        let value = 0;
        for (let i = 0; i < 3; i += 1) {
          for (let j = 0; j < 3; j += 1) {
            value +=
              bendingB[i * 12 + row] *
              constitutive.db[i * 3 + j] *
              bendingB[j * 12 + column];
          }
        }
        for (let i = 0; i < 2; i += 1) {
          for (let j = 0; j < 2; j += 1) {
            value +=
              shearB[i * 12 + row] *
              constitutive.ds[i * 2 + j] *
              shearB[j * 12 + column];
          }
        }
        stiffness[row * 12 + column] += value * derivatives.jacobian.determinant;
      }
    }
  }
  return stiffness;
}

function assembleWithElementKernel(
  mesh: DiagnosticMesh,
  thickness: number,
  kernel: (
    nodes: readonly [MeshNode, MeshNode, MeshNode, MeshNode],
    thickness: number,
  ) => Float64Array,
): DenseMatrix {
  const order = mesh.nodes.length * 3;
  const values = new Float64Array(order * order);
  for (const nodeIds of mesh.elements) {
    const nodes = nodeIds.map((nodeId) => mesh.nodes[nodeId]) as [
      MeshNode,
      MeshNode,
      MeshNode,
      MeshNode,
    ];
    const element = kernel(nodes, thickness);
    for (let localRow = 0; localRow < 12; localRow += 1) {
      const globalRow = nodeIds[Math.floor(localRow / 3)] * 3 + (localRow % 3);
      for (let localColumn = 0; localColumn < 12; localColumn += 1) {
        const globalColumn =
          nodeIds[Math.floor(localColumn / 3)] * 3 + (localColumn % 3);
        values[globalRow * order + globalColumn] +=
          element[localRow * 12 + localColumn];
      }
    }
  }
  return { order, values };
}

function polygonArea(nodes: readonly MeshNode[]): number {
  let twiceArea = 0;
  for (let index = 0; index < nodes.length; index += 1) {
    const next = nodes[(index + 1) % nodes.length];
    twiceArea += nodes[index].x * next.y - next.x * nodes[index].y;
  }
  return 0.5 * twiceArea;
}

function warpedMesh(divisions: number): DiagnosticMesh {
  return createMappedStructuredMesh(divisions, divisions, (u, v) => ({
    x: LENGTH * (u + 0.08 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v)),
    y: WIDTH * (v - 0.06 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v)),
  }));
}

function constantCurvatureVector(
  nodes: readonly MeshNode[],
  kappa: readonly [number, number, number],
): Float64Array {
  return nodalVector(nodes, (node) => [
    -0.5 * kappa[0] * node.x * node.x -
      0.5 * kappa[1] * node.y * node.y -
      0.5 * kappa[2] * node.x * node.y,
    kappa[0] * node.x + 0.5 * kappa[2] * node.y,
    kappa[1] * node.y + 0.5 * kappa[2] * node.x,
  ]);
}

function constitutiveQuadratic(
  matrix: readonly number[],
  order: number,
  vector: ArrayLike<number>,
): number {
  let result = 0;
  for (let row = 0; row < order; row += 1) {
    for (let column = 0; column < order; column += 1) {
      result += vector[row] * matrix[row * order + column] * vector[column];
    }
  }
  return result;
}

function integratedRecoveredEnergy(
  nodes: readonly [MeshNode, MeshNode, MeshNode, MeshNode],
  displacement: Float64Array,
  thickness: number,
): number {
  const constitutive = computeMindlinConstitutive(MATERIAL, thickness);
  let energy = 0;
  for (const [xi, eta] of GAUSS_POINTS) {
    const evaluation = evaluateMindlinQ4At(nodes, displacement, xi, eta);
    const determinant = evaluateQ4Jacobian(nodes, xi, eta).determinant;
    energy +=
      (constitutiveQuadratic(constitutive.db, 3, evaluation.curvatures) +
        constitutiveQuadratic(constitutive.ds, 2, evaluation.shears)) *
      determinant;
  }
  return energy;
}

function solveDense(matrix: DenseMatrix, rightHandSide: readonly number[]): number[] {
  const order = matrix.order;
  const augmented = Array.from({ length: order }, (_, row) => [
    ...Array.from(
      { length: order },
      (_, column) => matrix.values[row * order + column],
    ),
    rightHandSide[row],
  ]);
  for (let pivot = 0; pivot < order; pivot += 1) {
    let pivotRow = pivot;
    for (let row = pivot + 1; row < order; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[pivotRow][pivot])) {
        pivotRow = row;
      }
    }
    [augmented[pivot], augmented[pivotRow]] = [augmented[pivotRow], augmented[pivot]];
    const pivotValue = augmented[pivot][pivot];
    expect(Number.isFinite(pivotValue)).toBe(true);
    expect(Math.abs(pivotValue)).toBeGreaterThan(Number.EPSILON);
    for (let column = pivot; column <= order; column += 1) {
      augmented[pivot][column] /= pivotValue;
    }
    for (let row = 0; row < order; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let column = pivot; column <= order; column += 1) {
        augmented[row][column] -= factor * augmented[pivot][column];
      }
    }
  }
  return augmented.map((row) => row[order]);
}

function normalizedComplianceSweep(
  shear: number,
  kernel: (
    nodes: readonly [MeshNode, MeshNode, MeshNode, MeshNode],
    thickness: number,
  ) => Float64Array,
): number[] {
  const divisions = 4;
  const nodesPerRow = divisions + 1;
  const mesh = createAffineStructuredMesh(divisions, divisions, LENGTH, WIDTH, shear);
  const freeDofs: number[] = [];
  for (let j = 1; j < divisions; j += 1) {
    for (let i = 1; i < divisions; i += 1) {
      const nodeId = j * nodesPerRow + i;
      freeDofs.push(nodeId * 3, nodeId * 3 + 1, nodeId * 3 + 2);
    }
  }
  const centerNodeId = 2 * nodesPerRow + 2;
  const centerW = freeDofs.indexOf(centerNodeId * 3);
  return [1e-1, 1e-2, 1e-3, 1e-4].map((ratio) => {
    const thickness = ratio * LENGTH;
    const stiffness = assembleWithElementKernel(mesh, thickness, kernel);
    const free = extractPrincipalSubmatrix(stiffness, freeDofs);
    const scaled = scalePlateDofsByLength(free, LENGTH);
    const rightHandSide = Array.from({ length: scaled.order }, () => 0);
    rightHandSide[centerW] = LENGTH;
    const scaledDisplacement = solveDense(scaled, rightHandSide);
    const centerDisplacement = LENGTH * scaledDisplacement[centerW];
    return centerDisplacement * computeMindlinConstitutive(MATERIAL, thickness).db[0];
  });
}

function assembleSparseStiffness(
  mesh: DiagnosticMesh,
  thickness: number,
): SparseMatrix {
  const matrix = createSparseMatrix(mesh.nodes.length * 3);
  for (const nodeIds of mesh.elements) {
    const nodes = nodeIds.map((nodeId) => mesh.nodes[nodeId]) as [
      MeshNode,
      MeshNode,
      MeshNode,
      MeshNode,
    ];
    const dofIndices = nodeIds.flatMap((nodeId) => [
      nodeId * 3,
      nodeId * 3 + 1,
      nodeId * 3 + 2,
    ]);
    addElementStiffnessToSparse(
      matrix,
      dofIndices,
      computeMindlinQ4ElementStiffness(nodes, MATERIAL, thickness),
    );
  }
  return matrix;
}

function assembleUniformTransverseLoad(mesh: DiagnosticMesh): Float64Array {
  const load = new Float64Array(mesh.nodes.length * 3);
  for (const nodeIds of mesh.elements) {
    const nodes = nodeIds.map((nodeId) => mesh.nodes[nodeId]) as [
      MeshNode,
      MeshNode,
      MeshNode,
      MeshNode,
    ];
    for (const [xi, eta] of GAUSS_POINTS) {
      const shapeFunctions = evaluateQ4ShapeFunctions(xi, eta);
      const determinant = evaluateQ4Jacobian(nodes, xi, eta).determinant;
      nodeIds.forEach((nodeId, localNode) => {
        load[nodeId * 3] += shapeFunctions[localNode] * determinant;
      });
    }
  }
  return load;
}

function elementDisplacement(
  nodeIds: readonly [number, number, number, number],
  globalDisplacement: ArrayLike<number>,
): Float64Array {
  const local = new Float64Array(12);
  nodeIds.forEach((nodeId, localNode) => {
    for (let dof = 0; dof < 3; dof += 1) {
      local[localNode * 3 + dof] = globalDisplacement[nodeId * 3 + dof];
    }
  });
  return local;
}

function averagedCentreResult(
  mesh: DiagnosticMesh,
  divisions: number,
  displacement: Float64Array,
): { momentNorm: number; shearNorm: number } {
  const half = divisions / 2;
  const samples = [
    { element: (half - 1) * divisions + half - 1, xi: 1, eta: 1 },
    { element: (half - 1) * divisions + half, xi: -1, eta: 1 },
    { element: half * divisions + half, xi: -1, eta: -1 },
    { element: half * divisions + half - 1, xi: 1, eta: -1 },
  ] as const;
  const averageCurvature = [0, 0, 0];
  const averageShear = [0, 0];
  for (const sample of samples) {
    const nodeIds = mesh.elements[sample.element];
    const nodes = nodeIds.map((nodeId) => mesh.nodes[nodeId]) as [
      MeshNode,
      MeshNode,
      MeshNode,
      MeshNode,
    ];
    const result = evaluateMindlinQ4At(
      nodes,
      elementDisplacement(nodeIds, displacement),
      sample.xi,
      sample.eta,
    );
    result.curvatures.forEach((value, index) => {
      averageCurvature[index] += value / samples.length;
    });
    result.shears.forEach((value, index) => {
      averageShear[index] += value / samples.length;
    });
  }
  const constitutive = computeMindlinConstitutive(MATERIAL, THICKNESS);
  const moments = Array.from({ length: 3 }, (_, row) =>
    averageCurvature.reduce(
      (sum, value, column) =>
        sum + constitutive.db[row * 3 + column] * value,
      0,
    ),
  );
  return {
    momentNorm: Math.hypot(...moments),
    // Four adjacent one-sided element values are averaged at the common
    // parametric centre node before forming this shear trend.
    shearNorm: Math.hypot(...averageShear),
  };
}

function warpedUniformLoadEvidence(divisions: number): {
  divisions: number;
  converged: boolean;
  iterations: number;
  relativeResidual: number;
  compliance: number;
  momentNorm: number;
  shearNorm: number;
  energyResidual: number;
} {
  const mesh = warpedMesh(divisions);
  const stiffness = assembleSparseStiffness(mesh, THICKNESS);
  const load = assembleUniformTransverseLoad(mesh);
  const fixed = new Set<number>();
  const nodesPerRow = divisions + 1;
  for (let j = 0; j <= divisions; j += 1) {
    for (let i = 0; i <= divisions; i += 1) {
      if (i !== 0 && i !== divisions && j !== 0 && j !== divisions) continue;
      const nodeId = j * nodesPerRow + i;
      fixed.add(nodeId * 3);
      fixed.add(nodeId * 3 + 1);
      fixed.add(nodeId * 3 + 2);
    }
  }
  const reduced = buildReducedSystem(stiffness, load, fixed);
  const solve = solveConjugateGradient(reduced.matrix, reduced.rhs, {
    tolerance: 1e-11,
    absoluteTolerance: 1e-13,
    maxIterations: 10_000,
  });
  const displacement = expandReducedSolution(
    solve.solution,
    reduced.freeToFull,
    stiffness.size,
  );
  const internalForce = multiplySparseMatrixVector(stiffness, displacement);
  const compliance = dot(load, displacement);
  const strainEnergy = dot(displacement, internalForce);
  const centre = averagedCentreResult(mesh, divisions, displacement);
  return {
    divisions,
    converged: solve.converged,
    iterations: solve.iterations,
    relativeResidual:
      solve.residualNorm / Math.max(solve.initialResidualNorm, Number.MIN_VALUE),
    compliance,
    ...centre,
    energyResidual:
      Math.abs(strainEnergy - compliance) /
      Math.max(Math.abs(compliance), Number.MIN_VALUE),
  };
}

function integratedMeshRecoveredEnergy(
  mesh: DiagnosticMesh,
  displacement: Float64Array,
  thickness: number,
): number {
  let energy = 0;
  for (const nodeIds of mesh.elements) {
    const nodes = nodeIds.map((nodeId) => mesh.nodes[nodeId]) as [
      MeshNode,
      MeshNode,
      MeshNode,
      MeshNode,
    ];
    energy += integratedRecoveredEnergy(
      nodes,
      elementDisplacement(nodeIds, displacement),
      thickness,
    );
  }
  return energy;
}

describe("MITC4 independent covariant transform oracle", () => {
  it("uses J^T at all four ties and J^-T at a noncentral point", () => {
    const physicalShear = [0.37, -0.21] as const;
    const expectedCovariant = [0.307, -0.06375] as const;
    const displacement = nodalVector(ROTATED_SHEARED_AFFINE, () => [
      0,
      physicalShear[0],
      physicalShear[1],
    ]);
    const tying = buildMitc4TyingRows(ROTATED_SHEARED_AFFINE);
    const tyingValues = [
      dot(tying.xiBottom, displacement),
      dot(tying.xiTop, displacement),
      dot(tying.etaLeft, displacement),
      dot(tying.etaRight, displacement),
    ];
    expectVectorNear(
      tyingValues,
      [expectedCovariant[0], expectedCovariant[0], expectedCovariant[1], expectedCovariant[1]],
    );

    for (const [xi, eta] of [...TYING_POINTS, [0.31, -0.27] as const]) {
      const jacobian = evaluateQ4Jacobian(ROTATED_SHEARED_AFFINE, xi, eta);
      expectVectorNear(jacobian.matrix, [1, 0.225, 0.3, 0.7]);
      expectNear(jacobian.determinant, 0.6325);
      const assumed = multiplyB(
        buildMitc4AssumedShearB(ROTATED_SHEARED_AFFINE, xi, eta, tying),
        2,
        displacement,
      );
      expectVectorNear(assumed, physicalShear);
      expectVectorNear(
        evaluateMindlinQ4At(ROTATED_SHEARED_AFFINE, displacement, xi, eta).shears,
        physicalShear,
      );
    }
  });

  it("keeps the bottom/top and left/right tying directions distinct for a nodal w basis", () => {
    // "Node 2" in the independent review is the 1-based second node: array
    // index 1, node ID 1 (the bottom-right corner), not array index 2.
    const displacement = new Float64Array(12);
    displacement[1 * 3] = 1;
    const tying = buildMitc4TyingRows(ROTATED_SHEARED_AFFINE);
    const tyingValues = [
      dot(tying.xiBottom, displacement),
      dot(tying.xiTop, displacement),
      dot(tying.etaLeft, displacement),
      dot(tying.etaRight, displacement),
    ];
    // These values are hard-coded from the Q4 edge derivatives of the single
    // w basis; neither expected row is assembled through production algebra.
    expectVectorNear(tyingValues, [0.5, 0, 0, -0.5]);

    const xi = 0.31;
    const eta = -0.27;
    const expectedCovariant = [0.3175, -0.3275] as const;
    const actualCovariant = [
      0.5 * (1 - eta) * tyingValues[0] + 0.5 * (1 + eta) * tyingValues[1],
      0.5 * (1 - xi) * tyingValues[2] + 0.5 * (1 + xi) * tyingValues[3],
    ];
    expectVectorNear(actualCovariant, expectedCovariant);

    // Independent hard-coded J^-T result for J=[[1,.225],[.3,.7]] and
    // det(J)=.6325. Swapping either pair of opposite edges changes this value.
    const expectedCartesian = [
      0.50671936758893288,
      -0.63073122529644277,
    ] as const;
    expectVectorNear(
      multiplyB(
        buildMitc4AssumedShearB(ROTATED_SHEARED_AFFINE, xi, eta, tying),
        2,
        displacement,
      ),
      expectedCartesian,
    );
    expectVectorNear(
      evaluateMindlinQ4At(
        ROTATED_SHEARED_AFFINE,
        displacement,
        xi,
        eta,
      ).shears,
      expectedCartesian,
    );
  });

  it("obeys independently defined reflection parity for positive and negative affine shear", () => {
    const plus: [MeshNode, MeshNode, MeshNode, MeshNode] = [
      { id: 0, x: 0, y: 0 },
      { id: 1, x: 2, y: 0 },
      { id: 2, x: 2.45, y: 1.4 },
      { id: 3, x: 0.45, y: 1.4 },
    ];
    const minus: [MeshNode, MeshNode, MeshNode, MeshNode] = [
      { id: 0, x: 0, y: 0 },
      { id: 1, x: 2, y: 0 },
      { id: 2, x: 1.55, y: 1.4 },
      { id: 3, x: -0.45, y: 1.4 },
    ];
    const plusDisplacement = Float64Array.from([
      0.17, -0.08, 0.11,
      -0.04, 0.13, -0.06,
      0.21, -0.09, 0.07,
      -0.12, 0.05, 0.16,
    ]);
    // Reflection x -> 2-x maps plus nodes [1,0,3,2] to minus nodes
    // [0,1,2,3]. A scalar w is even, betaX is odd, and betaY is even.
    const reflectedNodeOrder = [1, 0, 3, 2] as const;
    const minusDisplacement = new Float64Array(12);
    reflectedNodeOrder.forEach((plusNode, minusNode) => {
      minusDisplacement[minusNode * 3] = plusDisplacement[plusNode * 3];
      minusDisplacement[minusNode * 3 + 1] =
        -plusDisplacement[plusNode * 3 + 1];
      minusDisplacement[minusNode * 3 + 2] =
        plusDisplacement[plusNode * 3 + 2];
    });

    expectNear(
      quadraticEnergy(elementMatrix(plus), plusDisplacement),
      quadraticEnergy(elementMatrix(minus), minusDisplacement),
      1e8,
    );
    for (const [xi, eta] of [...GAUSS_POINTS, [0.31, -0.27] as const]) {
      const plusResult = evaluateMindlinQ4At(plus, plusDisplacement, xi, eta);
      const minusResult = evaluateMindlinQ4At(
        minus,
        minusDisplacement,
        -xi,
        eta,
      );
      expectVectorNear(
        minusResult.curvatures,
        [
          plusResult.curvatures[0],
          plusResult.curvatures[1],
          -plusResult.curvatures[2],
        ],
      );
      expectVectorNear(
        minusResult.shears,
        [-plusResult.shears[0], plusResult.shears[1]],
      );
    }
  });
});

describe("MITC4 rank, rigid modes, and constant curvature", () => {
  const cases = [
    [
      "rectangle",
      [
        { id: 0, x: 0, y: 0 },
        { id: 1, x: 2, y: 0 },
        { id: 2, x: 2, y: 1.4 },
        { id: 3, x: 0, y: 1.4 },
      ] as [MeshNode, MeshNode, MeshNode, MeshNode],
    ],
    ["rotated-and-sheared affine", ROTATED_SHEARED_AFFINE],
    ["non-affine", NON_AFFINE],
  ] as const;

  it.each(cases)("has exactly the three physical null modes on a %s Q4", (_name, nodes) => {
    const matrix = elementMatrix(nodes);
    const scaled = scalePlateDofsByLength(matrix, LENGTH);
    const diagnostics = symmetricEigenDiagnostics(scaled);
    expect(normalizedAntisymmetry(matrix)).toBeLessThanOrEqual(1e-13);
    expect(diagnostics.negativeCount).toBe(0);
    expect(diagnostics.nullity).toBe(3);

    const rigidModes = [
      nodalVector(nodes, () => [1, 0, 0]),
      nodalVector(nodes, (node) => [node.x, -1, 0]),
      nodalVector(nodes, (node) => [node.y, 0, -1]),
    ];
    for (const mode of rigidModes) {
      expect(relativeMatrixResidual(matrix, mode)).toBeLessThanOrEqual(1e-13);
      for (const [xi, eta] of [...GAUSS_POINTS, [0.23, -0.41] as const]) {
        const evaluation = evaluateMindlinQ4At(nodes, mode, xi, eta);
        expectVectorNear(evaluation.curvatures, [0, 0, 0], 2);
        expectVectorNear(evaluation.shears, [0, 0], 2);
      }
    }
  });

  it.each(cases)("reproduces constant curvature and zero shear on a %s Q4", (_name, nodes) => {
    const kappa = [0.08, -0.05, 0.06] as const;
    const displacement = constantCurvatureVector(nodes, kappa);
    for (const [xi, eta] of [...GAUSS_POINTS, [0.23, -0.41] as const]) {
      const evaluation = evaluateMindlinQ4At(nodes, displacement, xi, eta);
      expectVectorNear(evaluation.curvatures, kappa);
      expectVectorNear(evaluation.shears, [0, 0], Math.max(...displacement.map(Math.abs), 1));
    }
    const constitutive = computeMindlinConstitutive(MATERIAL, THICKNESS);
    const expectedEnergy =
      polygonArea(nodes) * constitutiveQuadratic(constitutive.db, 3, kappa);
    const actualEnergy = quadraticEnergy(elementMatrix(nodes), displacement);
    expect(Math.abs(actualEnergy / expectedEnergy - 1)).toBeLessThanOrEqual(1e-11);
  });

  it("has only three physical null modes on an assembled non-affine 2x2 mesh", () => {
    const stiffness = assembleDenseStiffness(warpedMesh(2), MATERIAL, THICKNESS);
    const diagnostics = symmetricEigenDiagnostics(scalePlateDofsByLength(stiffness, LENGTH));
    expect(normalizedAntisymmetry(stiffness)).toBeLessThanOrEqual(1e-13);
    expect(diagnostics.negativeCount).toBe(0);
    expect(diagnostics.nullity).toBe(3);
  });
});

describe("MITC4 distortion, locking, thick response, and recovery", () => {
  it("retains shape regularity and constant-curvature energy across a warped refinement family", () => {
    const kappa = [0.04, -0.025, 0.03] as const;
    const constitutive = computeMindlinConstitutive(MATERIAL, THICKNESS);
    const expectedEnergy =
      LENGTH * WIDTH * constitutiveQuadratic(constitutive.db, 3, kappa);
    const qualityEvidence = [2, 4, 8, 16].map((divisions) => {
      const mesh = warpedMesh(divisions);
      const quality = evaluateMeshJacobianQuality(mesh, QUALITY_POINTS);
      const displacement = constantCurvatureVector(mesh.nodes, kappa);
      const energy = quadraticEnergy(
        assembleDenseStiffness(mesh, MATERIAL, THICKNESS),
        displacement,
      );
      return { divisions, ...quality, relativeEnergy: energy / expectedEnergy };
    });

    for (const evidence of qualityEvidence) {
      expect(evidence.minimumDeterminant, JSON.stringify(qualityEvidence)).toBeGreaterThan(0);
      expect(Number.isFinite(evidence.maximumConditionNumber)).toBe(true);
      expect(evidence.maximumConditionNumber, JSON.stringify(qualityEvidence)).toBeLessThan(3);
      expect(Math.abs(evidence.relativeEnergy - 1), JSON.stringify(qualityEvidence)).toBeLessThanOrEqual(
        1e-10,
      );
    }
    const scaledMinimumDeterminants = qualityEvidence.map(
      (item) => item.minimumDeterminant * item.divisions * item.divisions,
    );
    expect(
      Math.max(...scaledMinimumDeterminants) / Math.min(...scaledMinimumDeterminants),
      JSON.stringify(qualityEvidence),
    ).toBeLessThan(1.5);
  });

  it("converges under one common restrained load across the warped refinement family", () => {
    const responseEvidence = [2, 4, 8, 16].map(warpedUniformLoadEvidence);
    for (const evidence of responseEvidence) {
      expect(evidence.converged, JSON.stringify(responseEvidence)).toBe(true);
      expect(evidence.relativeResidual, JSON.stringify(responseEvidence)).toBeLessThanOrEqual(
        1e-10,
      );
      expect(evidence.compliance, JSON.stringify(responseEvidence)).toBeGreaterThan(0);
      expect(evidence.energyResidual, JSON.stringify(responseEvidence)).toBeLessThanOrEqual(
        1e-9,
      );
      expect(Number.isFinite(evidence.momentNorm)).toBe(true);
      expect(Number.isFinite(evidence.shearNorm)).toBe(true);
      expect(evidence.momentNorm).toBeGreaterThan(0);
      expect(evidence.shearNorm).toBeGreaterThan(0);
    }
    const complianceChanges = responseEvidence.slice(1).map((item, index) =>
      Math.abs(item.compliance - responseEvidence[index].compliance) /
      Math.abs(item.compliance),
    );
    for (let index = 1; index < complianceChanges.length; index += 1) {
      expect(
        complianceChanges[index],
        JSON.stringify({ responseEvidence, complianceChanges }),
      ).toBeLessThan(complianceChanges[index - 1]);
    }
    expect(
      complianceChanges[complianceChanges.length - 1],
      JSON.stringify({ responseEvidence, complianceChanges }),
    ).toBeLessThan(0.05);

    // The n=2 mesh has only one interior node and is deliberately excluded
    // from the local-result trend. Moment and four-element-averaged centre
    // shear are assessed separately; neither is an external benchmark.
    const convergingLocalEvidence = responseEvidence.slice(1);
    const momentTrend = convergingLocalEvidence.map((item) => item.momentNorm);
    const centreShearTrend = convergingLocalEvidence.map((item) => item.shearNorm);
    const momentChanges = momentTrend.slice(1).map((value, index) =>
      Math.abs(value - momentTrend[index]) / Math.abs(value),
    );
    const centreShearChanges = centreShearTrend.slice(1).map((value, index) =>
      Math.abs(value - centreShearTrend[index]) / Math.abs(value),
    );
    expect(
      momentChanges[1],
      JSON.stringify({ responseEvidence, momentChanges }),
    ).toBeLessThan(momentChanges[0]);
    expect(
      momentChanges[1],
      JSON.stringify({ responseEvidence, momentChanges }),
    ).toBeLessThan(0.01);
    expect(
      centreShearChanges[1],
      JSON.stringify({ responseEvidence, centreShearChanges }),
    ).toBeLessThan(centreShearChanges[0]);
    expect(
      centreShearChanges[1],
      JSON.stringify({ responseEvidence, centreShearChanges }),
    ).toBeLessThan(0.03);
  });

  it.each([
    ["rectangle", 0],
    ["affine shear", 0.45],
  ] as const)("separates its h/L plateau from raw full-integration locking on a %s mesh", (_name, shear) => {
    // A 2x2 perimeter clamp leaves only one free node; symmetry forces its
    // directors to zero and therefore provides no nontrivial discrete
    // Kirchhoff bending subspace. A 4x4 mesh has a 3x3 interior field.
    const mitcCompliance = normalizedComplianceSweep(
      shear,
      (nodes, thickness) =>
        computeMindlinQ4ElementStiffness(nodes, MATERIAL, thickness),
    );
    const rawCompliance = normalizedComplianceSweep(
      shear,
      rawCompatibleFullIntegrationElement,
    );
    mitcCompliance.forEach((value) => {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    });
    rawCompliance.forEach((value) => {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    });
    const mitcThinTailRatio = mitcCompliance[3] / mitcCompliance[2];
    const rawThinTailRatio = rawCompliance[3] / rawCompliance[2];
    expect(
      Math.abs(mitcThinTailRatio - 1),
      `MITC4=${mitcCompliance.join()} raw=${rawCompliance.join()}`,
    ).toBeLessThan(0.01);
    expect(
      rawThinTailRatio,
      `MITC4=${mitcCompliance.join()} raw=${rawCompliance.join()}`,
    ).toBeLessThan(0.5);
  });

  it("reproduces finite element and assembled shear-dominated thick responses", () => {
    const gamma = [0.032, -0.019] as const;
    const displacement = nodalVector(ROTATED_SHEARED_AFFINE, () => [0, gamma[0], gamma[1]]);
    for (const thickness of [0.2 * LENGTH, 0.5 * LENGTH]) {
      const constitutive = computeMindlinConstitutive(MATERIAL, thickness);
      const expectedEnergy =
        polygonArea(ROTATED_SHEARED_AFFINE) *
        constitutiveQuadratic(constitutive.ds, 2, gamma);
      const actualEnergy = quadraticEnergy(
        elementMatrix(ROTATED_SHEARED_AFFINE, thickness),
        displacement,
      );
      expect(Number.isFinite(actualEnergy)).toBe(true);
      expect(actualEnergy).toBeGreaterThan(0);
      expect(Math.abs(actualEnergy / expectedEnergy - 1)).toBeLessThanOrEqual(1e-12);
    }

    const patch = warpedMesh(2);
    const patchDisplacement = nodalVector(patch.nodes, () => [
      0,
      gamma[0],
      gamma[1],
    ]);
    const assembledEvidence = [0.2 * LENGTH, 0.5 * LENGTH].map((thickness) => {
      const stiffness = assembleDenseStiffness(patch, MATERIAL, thickness);
      const assembledEnergy = quadraticEnergy(stiffness, patchDisplacement);
      const recoveredEnergy = integratedMeshRecoveredEnergy(
        patch,
        patchDisplacement,
        thickness,
      );
      const expectedEnergy =
        LENGTH *
        WIDTH *
        constitutiveQuadratic(
          computeMindlinConstitutive(MATERIAL, thickness).ds,
          2,
          gamma,
        );
      return {
        thickness,
        assembledEnergy,
        recoveredEnergy,
        expectedEnergy,
        internalForceNorm: vectorNorm(
          multiplyMatrixVector(stiffness, patchDisplacement),
        ),
      };
    });
    for (const evidence of assembledEvidence) {
      expect(Number.isFinite(evidence.assembledEnergy)).toBe(true);
      expect(Number.isFinite(evidence.internalForceNorm)).toBe(true);
      expect(evidence.assembledEnergy).toBeGreaterThan(0);
      expect(evidence.internalForceNorm).toBeGreaterThan(0);
      expect(
        Math.abs(evidence.assembledEnergy / evidence.expectedEnergy - 1),
        JSON.stringify(assembledEvidence),
      ).toBeLessThanOrEqual(1e-12);
      expect(
        Math.abs(evidence.assembledEnergy / evidence.recoveredEnergy - 1),
        JSON.stringify(assembledEvidence),
      ).toBeLessThanOrEqual(1e-12);
    }
    expectNear(
      assembledEvidence[1].assembledEnergy / assembledEvidence[0].assembledEnergy,
      2.5,
    );
  });

  it("uses the identical assumed-shear field for stiffness and point recovery", () => {
    const displacement = Float64Array.from(
      { length: 12 },
      (_, index) => 0.013 * Math.sin(0.7 + 1.1 * index),
    );
    const stiffness = elementMatrix(NON_AFFINE, 0.17);
    const stiffnessEnergy = quadraticEnergy(stiffness, displacement);
    const recoveredEnergy = integratedRecoveredEnergy(NON_AFFINE, displacement, 0.17);
    expect(Number.isFinite(stiffnessEnergy)).toBe(true);
    expect(stiffnessEnergy).toBeGreaterThan(0);
    expect(Math.abs(stiffnessEnergy / recoveredEnergy - 1)).toBeLessThanOrEqual(1e-12);
    expect(matrixInfinityNorm(stiffness)).toBeGreaterThan(0);
  });
});
