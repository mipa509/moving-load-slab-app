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

export interface InverseQ4Options {
  /** Newton starting point in natural coordinates; defaults to the centre (0, 0). */
  initialGuess?: readonly [number, number];
  /** Maximum Newton iterations for the non-affine fallback. */
  maxIterations?: number;
  /** Absolute global-length residual for convergence; scale-aware default. */
  residualTolerance?: number;
  /** Natural-coordinate slack used to classify a point as inside [-1, 1]^2. */
  containmentTolerance?: number;
}

export interface InverseQ4Result {
  xi: number;
  eta: number;
  /**
   * True when the forward map reproduces the target to the branch convergence
   * threshold. The Newton branch uses `residualTolerance`. The affine branch,
   * which admits elements with a bilinear cross term up to
   * `AFFINE_RELATIVE_TOLERANCE * scale`, uses the looser
   * `max(residualTolerance, 1e-9 * scale)` so a barely-non-affine element still
   * converges through the fast path. `inside` is always derived from this value.
   */
  converged: boolean;
  /** True when the mapping Jacobian became non-positive/degenerate and was rejected. */
  jacobianFailed: boolean;
  iterations: number;
  /** Final ||interpolateQ4Point(xi, eta) - target|| in global length units. */
  residualNorm: number;
  /** True when the converged natural coordinates lie within [-1, 1]^2 by `containmentTolerance`. */
  inside: boolean;
  method: "affine" | "newton";
}

interface BilinearMapCoefficients {
  /** Centroid term. */
  a: Point2D;
  /** d(map)/dxi at (0, 0). */
  b: Point2D;
  /** d(map)/deta at (0, 0). */
  c: Point2D;
  /** Bilinear cross term; zero for a parallelogram. */
  d: Point2D;
}

const DEFAULT_INVERSE_MAX_ITERATIONS = 20;
const AFFINE_RELATIVE_TOLERANCE = 1e-9;
const CONTAINMENT_TOLERANCE = 1e-9;

function bilinearMapCoefficients(nodes: Q4NodeCoordinates): BilinearMapCoefficients {
  const [p0, p1, p2, p3] = nodes;
  return {
    a: { x: (p0.x + p1.x + p2.x + p3.x) / 4, y: (p0.y + p1.y + p2.y + p3.y) / 4 },
    b: { x: (-p0.x + p1.x + p2.x - p3.x) / 4, y: (-p0.y + p1.y + p2.y - p3.y) / 4 },
    c: { x: (-p0.x - p1.x + p2.x + p3.x) / 4, y: (-p0.y - p1.y + p2.y + p3.y) / 4 },
    d: { x: (p0.x - p1.x + p2.x - p3.x) / 4, y: (p0.y - p1.y + p2.y - p3.y) / 4 },
  };
}

function signedQuadArea(nodes: Q4NodeCoordinates): number {
  let twiceArea = 0;
  for (let i = 0; i < 4; i += 1) {
    const current = nodes[i];
    const next = nodes[(i + 1) % 4];
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return twiceArea / 2;
}

function characteristicLength(nodes: Q4NodeCoordinates): number {
  const centroidX = (nodes[0].x + nodes[1].x + nodes[2].x + nodes[3].x) / 4;
  const centroidY = (nodes[0].y + nodes[1].y + nodes[2].y + nodes[3].y) / 4;
  let maxRadius = 0;
  for (const node of nodes) {
    maxRadius = Math.max(maxRadius, Math.hypot(node.x - centroidX, node.y - centroidY));
  }
  return Math.max(maxRadius, Number.MIN_VALUE);
}

/**
 * A Q4 whose bilinear cross term vanishes maps natural to global coordinates by
 * a single affine transform. This is exactly the parallelogram (and rectangle)
 * family used by the skew release element.
 */
export function isAffineParallelogramQ4(
  nodes: Q4NodeCoordinates,
  tolerance: number = AFFINE_RELATIVE_TOLERANCE,
): boolean {
  const { d } = bilinearMapCoefficients(nodes);
  const scale = characteristicLength(nodes);
  return Math.hypot(d.x, d.y) <= tolerance * scale;
}

/** Guard for the release load path: only affine parallelogram elements are admitted. */
export function assertAffineParallelogramQ4(
  nodes: Q4NodeCoordinates,
  tolerance: number = AFFINE_RELATIVE_TOLERANCE,
): void {
  if (!isAffineParallelogramQ4(nodes, tolerance)) {
    throw new Error(
      "Q4 element is not an affine parallelogram; the release load path requires affine elements.",
    );
  }
}

/**
 * Invert the Q4 forward map: find natural coordinates (xi, eta) whose
 * interpolation reproduces `target`. Affine parallelograms use a direct 2x2
 * solve; general convex quads use a bounded Newton iteration. Results are never
 * silently clamped to the natural domain — `inside` reports containment instead.
 *
 * Precondition: the element must be convex (positive-area, non-self-intersecting).
 * Structured skew-mesh release elements are always convex parallelograms. For a
 * concave quad the inverse is not globally unique and the Newton branch may
 * converge to a valid-but-unintended root; only the degenerate/inverted
 * (non-positive-area) case is rejected up front as a Jacobian failure.
 */
export function inverseQ4Point(
  nodes: Q4NodeCoordinates,
  target: Point2D,
  options: InverseQ4Options = {},
): InverseQ4Result {
  const scale = characteristicLength(nodes);
  const residualTolerance = options.residualTolerance ?? 1e-11 * scale;
  const containmentTolerance = options.containmentTolerance ?? CONTAINMENT_TOLERANCE;
  const maxIterations = options.maxIterations ?? DEFAULT_INVERSE_MAX_ITERATIONS;
  const detFloor = 1e-14 * scale * scale;

  const coefficients = bilinearMapCoefficients(nodes);
  const affine = Math.hypot(coefficients.d.x, coefficients.d.y) <= AFFINE_RELATIVE_TOLERANCE * scale;

  const classify = (
    xiValue: number,
    etaValue: number,
    convergedValue: boolean,
    jacobianFailedValue: boolean,
    iterationsValue: number,
    methodValue: "affine" | "newton",
  ): InverseQ4Result => {
    const mapped = interpolateQ4Point(nodes, xiValue, etaValue);
    const residualNorm = Math.hypot(mapped.x - target.x, mapped.y - target.y);
    const inside =
      convergedValue &&
      Math.abs(xiValue) <= 1 + containmentTolerance &&
      Math.abs(etaValue) <= 1 + containmentTolerance;
    return {
      xi: xiValue,
      eta: etaValue,
      converged: convergedValue,
      jacobianFailed: jacobianFailedValue,
      iterations: iterationsValue,
      residualNorm,
      inside,
      method: methodValue,
    };
  };

  // Reject globally degenerate (zero-area) or inverted (negative-area) elements
  // up front, before any target-specific short circuit can mask the defect.
  const areaFloor = 1e-12 * scale * scale;
  const signedArea = signedQuadArea(nodes);
  if (!Number.isFinite(signedArea) || signedArea <= areaFloor) {
    return classify(0, 0, false, true, 0, affine ? "affine" : "newton");
  }

  if (affine) {
    const { a, b, c } = coefficients;
    const det = b.x * c.y - c.x * b.y;
    if (!Number.isFinite(det) || det <= detFloor) {
      return classify(0, 0, false, true, 0, "affine");
    }
    const rx = target.x - a.x;
    const ry = target.y - a.y;
    const xi = (rx * c.y - c.x * ry) / det;
    const eta = (b.x * ry - rx * b.y) / det;
    // Determine convergence before classifying so `inside` is derived from the
    // final `converged` value (never from a value that is overridden afterward).
    const mapped = interpolateQ4Point(nodes, xi, eta);
    const residualNorm = Math.hypot(mapped.x - target.x, mapped.y - target.y);
    const affineConverged = residualNorm <= Math.max(residualTolerance, 1e-9 * scale);
    return classify(xi, eta, affineConverged, false, 0, "affine");
  }

  const guess = options.initialGuess ?? [0, 0];
  let xi = guess[0];
  let eta = guess[1];
  let iterations = 0;
  let converged = false;

  while (iterations < maxIterations) {
    const mapped = interpolateQ4Point(nodes, xi, eta);
    const residualNorm = Math.hypot(mapped.x - target.x, mapped.y - target.y);
    if (residualNorm <= residualTolerance) {
      converged = true;
      break;
    }
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
    const det = dxDxi * dyDeta - dxDeta * dyDxi;
    if (!Number.isFinite(det) || det <= detFloor) {
      return classify(xi, eta, false, true, iterations, "newton");
    }
    const fx = mapped.x - target.x;
    const fy = mapped.y - target.y;
    // Newton step: delta = -J^-1 F, with J = [dxDxi dxDeta; dyDxi dyDeta].
    xi -= (dyDeta * fx - dxDeta * fy) / det;
    eta -= (-dyDxi * fx + dxDxi * fy) / det;
    iterations += 1;
  }

  if (!converged) {
    const mapped = interpolateQ4Point(nodes, xi, eta);
    const residualNorm = Math.hypot(mapped.x - target.x, mapped.y - target.y);
    converged = residualNorm <= residualTolerance;
  }

  return classify(xi, eta, converged, false, iterations, "newton");
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
