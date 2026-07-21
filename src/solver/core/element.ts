import type { MaterialDefinition, MeshNode } from "../model/types";
import {
  evaluateQ4PhysicalGradients,
  evaluateQ4ShapeFunctions,
} from "./q4Geometry";
import {
  buildMitc4AssumedShearB,
  buildMitc4TyingRows,
} from "./mitc4";

const STANDARD_GAUSS_POINTS: ReadonlyArray<[number, number, number]> = [
  [-1 / Math.sqrt(3), -1 / Math.sqrt(3), 1],
  [1 / Math.sqrt(3), -1 / Math.sqrt(3), 1],
  [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1],
  [-1 / Math.sqrt(3), 1 / Math.sqrt(3), 1],
];

export interface MindlinConstitutive {
  db: [number, number, number, number, number, number, number, number, number];
  ds: [number, number, number, number];
}

export interface MindlinPointEvaluation {
  shapeFunctions: [number, number, number, number];
  curvatures: [number, number, number];
  shears: [number, number];
}

export function computeMindlinConstitutive(
  material: MaterialDefinition,
  thickness: number,
): MindlinConstitutive {
  const poisson = material.poissonRatio;
  const e = material.elasticModulusMPa * 1000; // MPa -> kN/m^2
  const g = e / (2 * (1 + poisson));
  const shearFactor = material.shearCorrectionFactor ?? (5 / 6);

  const dbScale = (e * Math.pow(thickness, 3)) / (12 * (1 - poisson * poisson));
  const dsScale = shearFactor * g * thickness;

  return {
    db: [
      dbScale,
      dbScale * poisson,
      0,
      dbScale * poisson,
      dbScale,
      0,
      0,
      0,
      dbScale * (1 - poisson) * 0.5,
    ],
    ds: [dsScale, 0, 0, dsScale],
  };
}

export function computeMindlinQ4ElementStiffness(
  elementNodes: readonly [MeshNode, MeshNode, MeshNode, MeshNode],
  material: MaterialDefinition,
  thickness: number,
): Float64Array {
  const constitutive = computeMindlinConstitutive(material, thickness);
  const ke = new Float64Array(12 * 12);
  const tyingRows = buildMitc4TyingRows(elementNodes);

  for (const [xi, eta, weight] of STANDARD_GAUSS_POINTS) {
    const kinematics = computeKinematics(elementNodes, xi, eta);
    const bb = kinematics.bendingB;
    const bs = buildMitc4AssumedShearB(elementNodes, xi, eta, tyingRows);
    accumulateMindlinStiffnessAtPoint(
      ke,
      bb,
      constitutive.db,
      bs,
      constitutive.ds,
      kinematics.detJ * weight,
    );
  }

  return ke;
}

export function evaluateMindlinQ4At(
  elementNodes: readonly [MeshNode, MeshNode, MeshNode, MeshNode],
  elementDisplacements: Float64Array,
  xi: number,
  eta: number,
): MindlinPointEvaluation {
  const kinematics = computeKinematics(elementNodes, xi, eta);
  const curvatures = multiplyBByElementVector(kinematics.bendingB, 3, elementDisplacements);
  const assumedShearB = buildMitc4AssumedShearB(elementNodes, xi, eta);
  const shears = multiplyBByElementVector(assumedShearB, 2, elementDisplacements);
  return {
    shapeFunctions: kinematics.shapeFunctions,
    curvatures: [curvatures[0], curvatures[1], curvatures[2]],
    shears: [shears[0], shears[1]],
  };
}

function computeKinematics(
  elementNodes: readonly [MeshNode, MeshNode, MeshNode, MeshNode],
  xi: number,
  eta: number,
): {
  shapeFunctions: [number, number, number, number];
  bendingB: Float64Array;
  detJ: number;
} {
  const shapeFunctions = evaluateQ4ShapeFunctions(xi, eta);
  const derivatives = evaluateQ4PhysicalGradients(elementNodes, xi, eta);
  const bendingB = buildBendingB(derivatives.dNdx, derivatives.dNdy);

  return {
    shapeFunctions,
    bendingB,
    detJ: derivatives.jacobian.determinant,
  };
}

function buildBendingB(
  dNdx: readonly [number, number, number, number],
  dNdy: readonly [number, number, number, number],
): Float64Array {
  const b = new Float64Array(3 * 12);
  for (let i = 0; i < 4; i += 1) {
    const base = i * 3;
    b[0 * 12 + base + 1] = dNdx[i];
    b[1 * 12 + base + 2] = dNdy[i];
    b[2 * 12 + base + 1] = dNdy[i];
    b[2 * 12 + base + 2] = dNdx[i];
  }
  return b;
}

function accumulateMindlinStiffnessAtPoint(
  ke: Float64Array,
  bendingB: Float64Array,
  db: readonly number[],
  assumedShearB: Float64Array,
  ds: readonly number[],
  scale: number,
): void {
  // Accumulate all 144 ordered entries directly; never mirror or post-symmetrize.
  for (let row = 0; row < 12; row += 1) {
    for (let column = 0; column < 12; column += 1) {
      let bending = 0;
      for (let i = 0; i < 3; i += 1) {
        for (let j = 0; j < 3; j += 1) {
          bending +=
            bendingB[i * 12 + row] *
            db[i * 3 + j] *
            bendingB[j * 12 + column];
        }
      }

      let shear = 0;
      for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) {
          shear +=
            assumedShearB[i * 12 + row] *
            ds[i * 2 + j] *
            assumedShearB[j * 12 + column];
        }
      }

      ke[row * 12 + column] += (bending + shear) * scale;
    }
  }
}

function multiplyBByElementVector(
  b: Float64Array,
  rows: number,
  elementDisplacements: Float64Array,
): Float64Array {
  const result = new Float64Array(rows);
  for (let i = 0; i < rows; i += 1) {
    let sum = 0;
    for (let j = 0; j < 12; j += 1) {
      sum += b[i * 12 + j] * elementDisplacements[j];
    }
    result[i] = sum;
  }
  return result;
}
