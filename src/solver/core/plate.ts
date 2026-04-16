import type { MaterialDefinition } from "../model/types";

type ShapeData = {
  n: [number, number, number, number];
  dNdXi: [number, number, number, number];
  dNdEta: [number, number, number, number];
};

export type PlateConstitutive = {
  bending: [number, number, number][];
  shear: [number, number][];
};

export function getPlateConstitutive(
  material: MaterialDefinition,
  thickness: number,
): PlateConstitutive {
  const e = material.elasticModulusMPa * 1000;
  const nu = material.poissonRatio;
  const shearFactor = material.shearCorrectionFactor ?? 5 / 6;
  const bendingScale = (e * thickness ** 3) / (12 * (1 - nu ** 2));
  const shearModulus = e / (2 * (1 + nu));
  const shearScale = shearFactor * shearModulus * thickness;

  return {
    bending: [
      [bendingScale, bendingScale * nu, 0],
      [bendingScale * nu, bendingScale, 0],
      [0, 0, bendingScale * (1 - nu) * 0.5],
    ],
    shear: [
      [shearScale, 0],
      [0, shearScale],
    ],
  };
}

export function createPlateElementStiffness(
  width: number,
  height: number,
  material: MaterialDefinition,
  thickness: number,
): Float64Array {
  const constitutive = getPlateConstitutive(material, thickness);
  const stiffness = new Float64Array(12 * 12);
  const detJ = (width * height) / 4;
  const gauss = [-1 / Math.sqrt(3), 1 / Math.sqrt(3)] as const;

  for (const xi of gauss) {
    for (const eta of gauss) {
      const shape = getShapeData(xi, eta);
      const bendingB = buildBendingMatrix(shape, width, height);
      addTransposedProduct(stiffness, 12, bendingB, constitutive.bending, detJ);
    }
  }

  const shape = getShapeData(0, 0);
  const shearB = buildShearMatrix(shape, width, height);
  addTransposedProduct(stiffness, 12, shearB, constitutive.shear, detJ * 4);

  return stiffness;
}

export function createSubRectangleLoadVector(
  elementBounds: { xMin: number; xMax: number; yMin: number; yMax: number },
  subBounds: { xMin: number; xMax: number; yMin: number; yMax: number },
  pressure: number,
): Float64Array {
  const width = elementBounds.xMax - elementBounds.xMin;
  const height = elementBounds.yMax - elementBounds.yMin;
  const vector = new Float64Array(12);
  const gp = [-1 / Math.sqrt(3), 1 / Math.sqrt(3)] as const;

  const xm = 0.5 * (subBounds.xMin + subBounds.xMax);
  const ym = 0.5 * (subBounds.yMin + subBounds.yMax);
  const jx = 0.5 * (subBounds.xMax - subBounds.xMin);
  const jy = 0.5 * (subBounds.yMax - subBounds.yMin);

  for (const s of gp) {
    for (const t of gp) {
      const x = xm + jx * s;
      const y = ym + jy * t;
      const xi = (2 * (x - elementBounds.xMin)) / width - 1;
      const eta = (2 * (y - elementBounds.yMin)) / height - 1;
      const shape = getShapeData(xi, eta);
      const weight = jx * jy;
      for (let i = 0; i < 4; i += 1) {
        vector[i * 3] += pressure * shape.n[i] * weight;
      }
    }
  }

  return vector;
}

export function recoverPlateResponseAtCenter(
  width: number,
  height: number,
  material: MaterialDefinition,
  thickness: number,
  elementDisplacements: ArrayLike<number>,
): {
  w: number;
  moments: { mx: number; my: number; mxy: number };
  shears: { qx: number; qy: number };
} {
  const constitutive = getPlateConstitutive(material, thickness);
  const shape = getShapeData(0, 0);
  const bendingB = buildBendingMatrix(shape, width, height);
  const shearB = buildShearMatrix(shape, width, height);
  const curvatures = multiplySmallMatrixVector(bendingB, elementDisplacements);
  const shears = multiplySmallMatrixVector(shearB, elementDisplacements);
  const moments = multiplySymmetricConstitutive(constitutive.bending, curvatures);
  const shearForces = multiplyShearConstitutive(constitutive.shear, shears);
  const w =
    0.25 *
    (elementDisplacements[0] +
      elementDisplacements[3] +
      elementDisplacements[6] +
      elementDisplacements[9]);

  return {
    w,
    moments: {
      mx: moments[0],
      my: moments[1],
      mxy: moments[2],
    },
    shears: {
      qx: shearForces[0],
      qy: shearForces[1],
    },
  };
}

function getShapeData(xi: number, eta: number): ShapeData {
  return {
    n: [
      0.25 * (1 - xi) * (1 - eta),
      0.25 * (1 + xi) * (1 - eta),
      0.25 * (1 + xi) * (1 + eta),
      0.25 * (1 - xi) * (1 + eta),
    ],
    dNdXi: [
      -0.25 * (1 - eta),
      0.25 * (1 - eta),
      0.25 * (1 + eta),
      -0.25 * (1 + eta),
    ],
    dNdEta: [
      -0.25 * (1 - xi),
      -0.25 * (1 + xi),
      0.25 * (1 + xi),
      0.25 * (1 - xi),
    ],
  };
}

function buildBendingMatrix(
  shape: ShapeData,
  width: number,
  height: number,
): number[][] {
  const b = Array.from({ length: 3 }, () => Array(12).fill(0));
  for (let i = 0; i < 4; i += 1) {
    const dNdx = (2 / width) * shape.dNdXi[i];
    const dNdy = (2 / height) * shape.dNdEta[i];
    const col = i * 3;
    b[0][col + 1] = dNdx;
    b[1][col + 2] = dNdy;
    b[2][col + 1] = dNdy;
    b[2][col + 2] = dNdx;
  }
  return b;
}

function buildShearMatrix(
  shape: ShapeData,
  width: number,
  height: number,
): number[][] {
  const b = Array.from({ length: 2 }, () => Array(12).fill(0));
  for (let i = 0; i < 4; i += 1) {
    const dNdx = (2 / width) * shape.dNdXi[i];
    const dNdy = (2 / height) * shape.dNdEta[i];
    const col = i * 3;
    b[0][col] = dNdx;
    b[0][col + 1] = -shape.n[i];
    b[1][col] = dNdy;
    b[1][col + 2] = -shape.n[i];
  }
  return b;
}

function addTransposedProduct(
  out: Float64Array,
  size: number,
  b: number[][],
  d: number[][],
  scale: number,
): void {
  const db = Array.from({ length: d.length }, () => Array(size).fill(0));
  for (let i = 0; i < d.length; i += 1) {
    for (let j = 0; j < size; j += 1) {
      let sum = 0;
      for (let k = 0; k < d[i].length; k += 1) {
        sum += d[i][k] * b[k][j];
      }
      db[i][j] = sum;
    }
  }

  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j < size; j += 1) {
      let sum = 0;
      for (let k = 0; k < b.length; k += 1) {
        sum += b[k][i] * db[k][j];
      }
      out[i * size + j] += sum * scale;
    }
  }
}

function multiplySmallMatrixVector(
  matrix: number[][],
  vector: ArrayLike<number>,
): number[] {
  return matrix.map((row) =>
    row.reduce((sum, value, index) => sum + value * vector[index], 0),
  );
}

function multiplySymmetricConstitutive(
  matrix: [number, number, number][],
  vector: number[],
): [number, number, number] {
  return [
    matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
    matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
    matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2],
  ];
}

function multiplyShearConstitutive(
  matrix: [number, number][],
  vector: number[],
): [number, number] {
  return [
    matrix[0][0] * vector[0] + matrix[0][1] * vector[1],
    matrix[1][0] * vector[0] + matrix[1][1] * vector[1],
  ];
}
