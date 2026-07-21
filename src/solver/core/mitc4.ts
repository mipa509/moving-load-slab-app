import type { MeshNode } from "../model/types";
import {
  evaluateQ4PhysicalGradients,
  evaluateQ4ShapeFunctions,
} from "./q4Geometry";

const ELEMENT_DOF_COUNT = 12;

export interface Mitc4TyingRows {
  readonly xiBottom: Float64Array;
  readonly xiTop: Float64Array;
  readonly etaLeft: Float64Array;
  readonly etaRight: Float64Array;
}

/**
 * Compatible Cartesian Reissner-Mindlin shear operator for the accepted
 * [w, betaX, betaY] nodal ordering and gamma = grad(w) + beta convention.
 */
export function buildCompatibleMindlinShearB(
  shapeFunctions: readonly [number, number, number, number],
  dNdx: readonly [number, number, number, number],
  dNdy: readonly [number, number, number, number],
): Float64Array {
  const b = new Float64Array(2 * ELEMENT_DOF_COUNT);
  for (let nodeIndex = 0; nodeIndex < 4; nodeIndex += 1) {
    const base = nodeIndex * 3;
    b[0 * ELEMENT_DOF_COUNT + base] = dNdx[nodeIndex];
    b[0 * ELEMENT_DOF_COUNT + base + 1] = shapeFunctions[nodeIndex];
    b[1 * ELEMENT_DOF_COUNT + base] = dNdy[nodeIndex];
    b[1 * ELEMENT_DOF_COUNT + base + 2] = shapeFunctions[nodeIndex];
  }
  return b;
}

/**
 * Bathe-Dvorkin MITC4 covariant tying rows at the four edge midpoints.
 * Cartesian compatible shear is transformed with J^T before the required
 * xi or eta covariant row is retained.
 */
export function buildMitc4TyingRows(
  elementNodes: readonly [MeshNode, MeshNode, MeshNode, MeshNode],
): Mitc4TyingRows {
  return {
    xiBottom: buildCovariantTyingRow(elementNodes, 0, -1, 0),
    xiTop: buildCovariantTyingRow(elementNodes, 0, 1, 0),
    etaLeft: buildCovariantTyingRow(elementNodes, -1, 0, 1),
    etaRight: buildCovariantTyingRow(elementNodes, 1, 0, 1),
  };
}

/**
 * MITC4 assumed Cartesian shear operator at an arbitrary natural point.
 * Covariant tying rows are interpolated first and then mapped by J^-T.
 */
export function buildMitc4AssumedShearB(
  elementNodes: readonly [MeshNode, MeshNode, MeshNode, MeshNode],
  xi: number,
  eta: number,
  tyingRows: Mitc4TyingRows = buildMitc4TyingRows(elementNodes),
): Float64Array {
  const covariant = new Float64Array(2 * ELEMENT_DOF_COUNT);
  const bottomWeight = 0.5 * (1 - eta);
  const topWeight = 0.5 * (1 + eta);
  const leftWeight = 0.5 * (1 - xi);
  const rightWeight = 0.5 * (1 + xi);

  for (let column = 0; column < ELEMENT_DOF_COUNT; column += 1) {
    covariant[column] =
      bottomWeight * tyingRows.xiBottom[column] +
      topWeight * tyingRows.xiTop[column];
    covariant[ELEMENT_DOF_COUNT + column] =
      leftWeight * tyingRows.etaLeft[column] +
      rightWeight * tyingRows.etaRight[column];
  }

  const derivatives = evaluateQ4PhysicalGradients(elementNodes, xi, eta);
  const [dxDxi, dxDeta, dyDxi, dyDeta] = derivatives.jacobian.matrix;
  const inverseDeterminant = 1 / derivatives.jacobian.determinant;
  const assumed = new Float64Array(2 * ELEMENT_DOF_COUNT);

  for (let column = 0; column < ELEMENT_DOF_COUNT; column += 1) {
    const gammaXi = covariant[column];
    const gammaEta = covariant[ELEMENT_DOF_COUNT + column];
    assumed[column] =
      (dyDeta * gammaXi - dyDxi * gammaEta) * inverseDeterminant;
    assumed[ELEMENT_DOF_COUNT + column] =
      (-dxDeta * gammaXi + dxDxi * gammaEta) * inverseDeterminant;
  }

  return assumed;
}

function buildCovariantTyingRow(
  elementNodes: readonly [MeshNode, MeshNode, MeshNode, MeshNode],
  xi: number,
  eta: number,
  covariantRow: 0 | 1,
): Float64Array {
  const shapeFunctions = evaluateQ4ShapeFunctions(xi, eta);
  const derivatives = evaluateQ4PhysicalGradients(elementNodes, xi, eta);
  const compatible = buildCompatibleMindlinShearB(
    shapeFunctions,
    derivatives.dNdx,
    derivatives.dNdy,
  );
  const [dxDxi, dxDeta, dyDxi, dyDeta] = derivatives.jacobian.matrix;
  const jColumnX = covariantRow === 0 ? dxDxi : dxDeta;
  const jColumnY = covariantRow === 0 ? dyDxi : dyDeta;
  const row = new Float64Array(ELEMENT_DOF_COUNT);

  for (let column = 0; column < ELEMENT_DOF_COUNT; column += 1) {
    row[column] =
      jColumnX * compatible[column] +
      jColumnY * compatible[ELEMENT_DOF_COUNT + column];
  }
  return row;
}
