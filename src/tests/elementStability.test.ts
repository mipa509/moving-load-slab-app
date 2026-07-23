import { describe, expect, it } from "vitest";
import {
  computeMindlinConstitutive,
  computeMindlinQ4ElementStiffness,
  evaluateMindlinQ4At,
} from "../solver/core/element";
import type { MaterialDefinition, MeshNode } from "../solver/model/types";
import {
  assembleDenseStiffness,
  choleskyPivots,
  conjugateGradientDiagnostics,
  createAffineStructuredMesh,
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
const THICKNESS = 0.2;
const CHARACTERISTIC_LENGTH = 2;
const ROUND_OFF_MULTIPLIER = 4096;
const GAUSS = 1 / Math.sqrt(3);
const BENDING_POINTS: ReadonlyArray<readonly [number, number]> = [
  [-GAUSS, -GAUSS],
  [GAUSS, -GAUSS],
  [GAUSS, GAUSS],
  [-GAUSS, GAUSS],
];

const ELEMENT_CASES = [
  ["rectangular", createAffineStructuredMesh(1, 1, 2, 1.4, 0)],
  ["genuinely sheared", createAffineStructuredMesh(1, 1, 2, 1.4, 0.45)],
] as const;

function asElementNodes(mesh: DiagnosticMesh): [MeshNode, MeshNode, MeshNode, MeshNode] {
  return mesh.elements[0].map((nodeId) => mesh.nodes[nodeId]) as [
    MeshNode,
    MeshNode,
    MeshNode,
    MeshNode,
  ];
}

function nodalVector(
  nodes: readonly MeshNode[],
  field: (node: MeshNode) => readonly [number, number, number],
): Float64Array {
  const result = new Float64Array(nodes.length * 3);
  nodes.forEach((node, nodeIndex) => {
    const values = field(node);
    result.set(values, nodeIndex * 3);
  });
  return result;
}

function elementMatrix(mesh: DiagnosticMesh): DenseMatrix {
  return {
    order: 12,
    values: computeMindlinQ4ElementStiffness(asElementNodes(mesh), MATERIAL, THICKNESS),
  };
}

function scaledTolerance(scale: number, termCount: number): number {
  return ROUND_OFF_MULTIPLIER * Number.EPSILON * termCount * Math.max(scale, 1);
}

function expectVectorNearZero(
  label: string,
  values: ArrayLike<number>,
  scale: number,
  termCount: number,
): void {
  const tolerance = scaledTolerance(scale, termCount);
  for (let i = 0; i < values.length; i += 1) {
    expect(Math.abs(values[i]), `${label}[${i}] <= ${tolerance}`).toBeLessThanOrEqual(
      tolerance,
    );
  }
}

function checkerboardW(mesh: DiagnosticMesh): Float64Array {
  return nodalVector(mesh.nodes, (node) => {
    const i = node.id % 3;
    const j = Math.floor(node.id / 3);
    return [(i + j) % 2 === 0 ? 1 : -1, 0, 0];
  });
}

const ELEMENT_RANK_AUDITS = ELEMENT_CASES.map(([name, mesh]) => ({
  name,
  diagnostics: symmetricEigenDiagnostics(
    scalePlateDofsByLength(elementMatrix(mesh), CHARACTERISTIC_LENGTH),
  ),
}));

const ASSEMBLED_RANK_AUDITS = ([
  ["rectangular", 0],
  ["genuinely sheared", 0.45],
] as const).map(([name, shear]) => {
  const mesh = createAffineStructuredMesh(2, 2, 2, 1.4, shear);
  const stiffness = assembleDenseStiffness(mesh, MATERIAL, THICKNESS);
  const checkerboard = checkerboardW(mesh);
  const normalizedCheckerboardEnergy =
    quadraticEnergy(stiffness, checkerboard) /
    (matrixInfinityNorm(stiffness) * vectorNorm(checkerboard) ** 2);
  return {
    name,
    diagnostics: symmetricEigenDiagnostics(
      scalePlateDofsByLength(stiffness, CHARACTERISTIC_LENGTH),
    ),
    checkerboardCg: conjugateGradientDiagnostics(stiffness, checkerboard),
    checkerboardNorm: vectorNorm(checkerboard),
    normalizedCheckerboardEnergy,
    positiveEnergyFloor: ROUND_OFF_MULTIPLIER * Number.EPSILON * stiffness.order,
  };
});

function expectFiniteEigenDiagnostics(
  diagnostics: ReturnType<typeof symmetricEigenDiagnostics>,
): void {
  expect(Number.isFinite(diagnostics.tolerance)).toBe(true);
  expect(Number.isFinite(diagnostics.conditionNumber)).toBe(true);
  diagnostics.eigenvalues.forEach((value) => expect(Number.isFinite(value)).toBe(true));
}

describe("Mindlin Q4 kinematic completeness", () => {
  it.each(ELEMENT_CASES)("has exactly the three analytical rigid modes on a %s element", (_name, mesh) => {
    const nodes = asElementNodes(mesh);
    const stiffness = elementMatrix(mesh);
    const rigidModes = [
      nodalVector(nodes, () => [1, 0, 0]),
      nodalVector(nodes, (node) => [node.x, -1, 0]),
      nodalVector(nodes, (node) => [node.y, 0, -1]),
    ];

    for (const mode of rigidModes) {
      for (const [xi, eta] of [...BENDING_POINTS, [0, 0] as const]) {
        const evaluation = evaluateMindlinQ4At(nodes, mode, xi, eta);
        expectVectorNearZero("rigid curvature", evaluation.curvatures, 1, 12);
        expectVectorNearZero("rigid shear", evaluation.shears, 1, 12);
      }
      expect(relativeMatrixResidual(stiffness, mode)).toBeLessThanOrEqual(
        scaledTolerance(1, 12),
      );
    }
  });

  it.each(ELEMENT_CASES)("reproduces a linear rotation field and constant curvature on a %s element", (_name, mesh) => {
    const nodes = asElementNodes(mesh);
    const target = [0.17, -0.09, 0.11] as const;
    const displacement = nodalVector(nodes, (node) => [
      0,
      target[0] * node.x + 0.5 * target[2] * node.y + 0.03,
      target[1] * node.y + 0.5 * target[2] * node.x - 0.02,
    ]);

    for (const [xi, eta] of BENDING_POINTS) {
      const actual = evaluateMindlinQ4At(nodes, displacement, xi, eta).curvatures;
      actual.forEach((value, index) =>
        expect(Math.abs(value - target[index])).toBeLessThanOrEqual(
          scaledTolerance(Math.abs(target[index]), 12),
        ),
      );
    }
  });
});

describe("Mindlin Q4 rank and hourglass audit", () => {
  it.each(ELEMENT_RANK_AUDITS)("has exactly three physical null modes on a $name element", ({ diagnostics }) => {
    expectFiniteEigenDiagnostics(diagnostics);
    expect(diagnostics.negativeCount).toBe(0);
    expect(diagnostics.nullity).toBe(3);
  });

  it.each(ASSEMBLED_RANK_AUDITS)("has only the three physical null modes and gives the checkerboard positive search energy on a $name 2x2 mesh", ({ diagnostics, checkerboardCg, normalizedCheckerboardEnergy, positiveEnergyFloor }) => {
    expectFiniteEigenDiagnostics(diagnostics);
    expect(diagnostics.negativeCount).toBe(0);
    expect(diagnostics.nullity).toBe(3);
    expect(Number.isFinite(checkerboardCg.minimumNormalizedSearchEnergy)).toBe(true);
    expect(Number.isFinite(normalizedCheckerboardEnergy)).toBe(true);
    expect(Number.isFinite(positiveEnergyFloor)).toBe(true);
    expect(positiveEnergyFloor).toBeGreaterThan(0);
    expect(normalizedCheckerboardEnergy).toBeGreaterThan(positiveEnergyFloor);
    expect(checkerboardCg.iterations).toBeGreaterThan(0);
    expect(
      checkerboardCg.breakdown && checkerboardCg.iterations === 0,
      `CG diagnostics ${JSON.stringify(checkerboardCg)}`,
    ).toBe(false);
  });
});

describe("restrained-system stability and thickness trend", () => {
  it.each([
    ["rectangular", 0],
    ["genuinely sheared", 0.45],
  ] as const)("is symmetric positive definite with a fully restrained perimeter on a %s 2x2 mesh", (_name, shear) => {
    const mesh = createAffineStructuredMesh(2, 2, 2, 1.4, shear);
    const stiffness = assembleDenseStiffness(mesh, MATERIAL, THICKNESS);
    const centerNode = 4;
    const freeDofs = [centerNode * 3, centerNode * 3 + 1, centerNode * 3 + 2];
    const constrained = extractPrincipalSubmatrix(stiffness, freeDofs);
    const scaled = scalePlateDofsByLength(constrained, CHARACTERISTIC_LENGTH);
    const eigen = symmetricEigenDiagnostics(scaled);
    const pivots = choleskyPivots(scaled);
    const pivotFloor = scaledTolerance(matrixInfinityNorm(scaled), scaled.order);
    const rightHandSide = Float64Array.of(1, -0.37, 0.22);
    const cg = conjugateGradientDiagnostics(scaled, rightHandSide);

    expect(normalizedAntisymmetry(scaled)).toBeLessThanOrEqual(1e-12);
    expect(eigen.negativeCount).toBe(0);
    expect(eigen.nullity).toBe(0);
    expect(Math.min(...pivots)).toBeGreaterThan(pivotFloor);
    expect(cg.breakdown, `min normalized p^T K p = ${cg.minimumNormalizedSearchEnergy}`).toBe(false);
    expect(cg.converged, `residual = ${cg.residualNorm}`).toBe(true);
    expect(cg.minimumNormalizedSearchEnergy).toBeGreaterThan(
      ROUND_OFF_MULTIPLIER * Number.EPSILON,
    );
  });

  it("records a bounded 2x2 thin-limit conditioning plateau as a stability diagnostic", () => {
    // This small restrained-system condition number is a numerical
    // conditioning/stability diagnostic only. The independent 4x4 compliance
    // comparison in mitc4Element.test.ts is the transverse-shear locking gate.
    const mesh = createAffineStructuredMesh(2, 2, 2, 1.4, 0.45);
    const ratios = [1e-1, 1e-2, 1e-3, 1e-4];
    const trend = ratios.map((ratio) => {
      const stiffness = assembleDenseStiffness(mesh, MATERIAL, ratio * CHARACTERISTIC_LENGTH);
      const centerDofs = [12, 13, 14];
      const constrained = extractPrincipalSubmatrix(stiffness, centerDofs);
      const diagnostics = symmetricEigenDiagnostics(
        scalePlateDofsByLength(constrained, CHARACTERISTIC_LENGTH),
      );
      return { ratio, diagnostics };
    });

    trend.forEach(({ diagnostics }) => {
      expectFiniteEigenDiagnostics(diagnostics);
      expect(diagnostics.negativeCount).toBe(0);
      expect(diagnostics.nullity).toBe(0);
    });
    const conditionNumbers = trend.map(({ diagnostics }) => diagnostics.conditionNumber);
    const thinTailRatio =
      Math.max(conditionNumbers[2], conditionNumbers[3]) /
      Math.min(conditionNumbers[2], conditionNumbers[3]);
    expect(
      thinTailRatio,
      `h/L=${ratios.join()} conditions=${conditionNumbers.join()}`,
    ).toBeLessThan(1.01);
  });
});

describe("multi-element prescribed-boundary constant-bending evidence", () => {
  it.each([
    ["rectangular", 0],
    ["genuinely sheared", 0.45],
  ] as const)("matches curvature, centre shear, energy, and interior residual on a %s 2x2 patch", (_name, shear) => {
    const mesh = createAffineStructuredMesh(2, 2, 2, 1.4, shear);
    const kappa = [0.08, -0.05, 0.06] as const;
    // Boundary data are nodal samples of w = -0.5*kx*x^2 - 0.5*ky*y^2
    // -0.5*kxy*x*y, beta = -grad(w). Q4 does not reproduce that quadratic w
    // everywhere; MITC4 tying nevertheless reproduces constant curvature and
    // zero assumed shear throughout each affine element.
    const displacement = nodalVector(mesh.nodes, (node) => [
      -0.5 * kappa[0] * node.x * node.x -
        0.5 * kappa[1] * node.y * node.y -
        0.5 * kappa[2] * node.x * node.y,
      kappa[0] * node.x + 0.5 * kappa[2] * node.y,
      kappa[1] * node.y + 0.5 * kappa[2] * node.x,
    ]);
    const stiffness = assembleDenseStiffness(mesh, MATERIAL, THICKNESS);
    const internalForces = multiplyMatrixVector(stiffness, displacement);
    const constitutive = computeMindlinConstitutive(MATERIAL, THICKNESS);
    const dbKappa = [
      constitutive.db[0] * kappa[0] + constitutive.db[1] * kappa[1],
      constitutive.db[3] * kappa[0] + constitutive.db[4] * kappa[1],
      constitutive.db[8] * kappa[2],
    ];
    const expectedEnergy =
      2 * 1.4 *
      (kappa[0] * dbKappa[0] + kappa[1] * dbKappa[1] + kappa[2] * dbKappa[2]);

    for (const elementNodeIds of mesh.elements) {
      const nodes = elementNodeIds.map((id) => mesh.nodes[id]) as [
        MeshNode,
        MeshNode,
        MeshNode,
        MeshNode,
      ];
      const elementDisplacement = new Float64Array(12);
      elementNodeIds.forEach((nodeId, localNode) => {
        elementDisplacement.set(displacement.slice(nodeId * 3, nodeId * 3 + 3), localNode * 3);
      });
      for (const [xi, eta] of BENDING_POINTS) {
        const actual = evaluateMindlinQ4At(nodes, elementDisplacement, xi, eta).curvatures;
        actual.forEach((value, index) =>
          expect(Math.abs(value - kappa[index])).toBeLessThanOrEqual(
            scaledTolerance(Math.abs(kappa[index]), 12),
          ),
        );
      }
      for (const [xi, eta] of [...BENDING_POINTS, [0.23, -0.41] as const]) {
        expectVectorNearZero(
          "MITC4 constant-curvature shear",
          evaluateMindlinQ4At(nodes, elementDisplacement, xi, eta).shears,
          Math.max(...elementDisplacement.map(Math.abs)),
          12,
        );
      }
    }

    // All perimeter generalized displacements are prescribed. Only the centre
    // internal residual is tested; Kd boundary entries are not an independent
    // boundary-traction oracle.
    expectVectorNearZero(
      "traction-free interior residual",
      internalForces.slice(12, 15),
      matrixInfinityNorm(stiffness) * vectorNorm(displacement),
      stiffness.order,
    );
    expect(Math.abs(quadraticEnergy(stiffness, displacement) - expectedEnergy)).toBeLessThanOrEqual(
      scaledTolerance(expectedEnergy, stiffness.order),
    );
  });
});
