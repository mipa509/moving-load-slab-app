import type { Point2D } from "../geometry/types";

export type Q4NodeCoordinates = readonly [Point2D, Point2D, Point2D, Point2D];
export type Q4Values = [number, number, number, number];

export interface Q4NaturalDerivatives {
  dNdxi: Q4Values;
  dNdeta: Q4Values;
}

export interface Q4Jacobian {
  /** Row-major [dx/dxi, dx/deta; dy/dxi, dy/deta]. */
  matrix: [number, number, number, number];
  determinant: number;
}

export interface Q4PhysicalGradients {
  dNdx: Q4Values;
  dNdy: Q4Values;
  jacobian: Q4Jacobian;
}

/**
 * Q4 nodes are ordered counter-clockwise at the natural corners
 * (-1,-1), (1,-1), (1,1), (-1,1).
 */
export function evaluateQ4ShapeFunctions(xi: number, eta: number): Q4Values {
  return [
    0.25 * (1 - xi) * (1 - eta),
    0.25 * (1 + xi) * (1 - eta),
    0.25 * (1 + xi) * (1 + eta),
    0.25 * (1 - xi) * (1 + eta),
  ];
}

export function evaluateQ4NaturalDerivatives(
  xi: number,
  eta: number,
): Q4NaturalDerivatives {
  return {
    dNdxi: [
      -0.25 * (1 - eta),
      0.25 * (1 - eta),
      0.25 * (1 + eta),
      -0.25 * (1 + eta),
    ],
    dNdeta: [
      -0.25 * (1 - xi),
      -0.25 * (1 + xi),
      0.25 * (1 + xi),
      0.25 * (1 - xi),
    ],
  };
}

export function interpolateQ4Point(
  nodes: Q4NodeCoordinates,
  xi: number,
  eta: number,
): Point2D {
  const shapeFunctions = evaluateQ4ShapeFunctions(xi, eta);
  let x = 0;
  let y = 0;

  for (let i = 0; i < 4; i += 1) {
    x += shapeFunctions[i] * nodes[i].x;
    y += shapeFunctions[i] * nodes[i].y;
  }

  return { x, y };
}

export function evaluateQ4Jacobian(
  nodes: Q4NodeCoordinates,
  xi: number,
  eta: number,
): Q4Jacobian {
  const { dNdxi, dNdeta } = evaluateQ4NaturalDerivatives(xi, eta);
  let dxDxi = 0;
  let dxDeta = 0;
  let dyDxi = 0;
  let dyDeta = 0;

  for (let i = 0; i < 4; i += 1) {
    dxDxi += dNdxi[i] * nodes[i].x;
    dxDeta += dNdeta[i] * nodes[i].x;
    dyDxi += dNdxi[i] * nodes[i].y;
    dyDeta += dNdeta[i] * nodes[i].y;
  }

  const determinant = dxDxi * dyDeta - dxDeta * dyDxi;
  if (!Number.isFinite(determinant) || determinant <= 0) {
    throw new Error(
      `Invalid Q4 element Jacobian determinant: expected a finite positive value, received ${determinant}.`,
    );
  }

  return {
    matrix: [dxDxi, dxDeta, dyDxi, dyDeta],
    determinant,
  };
}

export function evaluateQ4PhysicalGradients(
  nodes: Q4NodeCoordinates,
  xi: number,
  eta: number,
): Q4PhysicalGradients {
  const { dNdxi, dNdeta } = evaluateQ4NaturalDerivatives(xi, eta);
  const jacobian = evaluateQ4Jacobian(nodes, xi, eta);
  const [dxDxi, dxDeta, dyDxi, dyDeta] = jacobian.matrix;
  const inverseDeterminant = 1 / jacobian.determinant;

  const dNdx: Q4Values = [0, 0, 0, 0];
  const dNdy: Q4Values = [0, 0, 0, 0];
  for (let i = 0; i < 4; i += 1) {
    // [dN/dx, dN/dy]^T = J^-T [dN/dxi, dN/deta]^T for
    // J = d(x,y)/d(xi,eta), stored row-major above.
    dNdx[i] =
      (dyDeta * dNdxi[i] - dyDxi * dNdeta[i]) * inverseDeterminant;
    dNdy[i] =
      (-dxDeta * dNdxi[i] + dxDxi * dNdeta[i]) * inverseDeterminant;
  }

  return { dNdx, dNdy, jacobian };
}
