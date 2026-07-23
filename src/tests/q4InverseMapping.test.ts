import { describe, expect, it } from "vitest";
import {
  assertAffineParallelogramQ4,
  interpolateQ4Point,
  inverseQ4Point,
  isAffineParallelogramQ4,
  type Q4NodeCoordinates,
} from "../solver/core/q4Geometry";
import type { Point2D } from "../solver/geometry/types";

const SKEW_TAN_19 = Math.tan((19 * Math.PI) / 180);

/** Affine rectangle. */
const RECTANGULAR_Q4: Q4NodeCoordinates = [
  { x: 2, y: -1 },
  { x: 6, y: -1 },
  { x: 6, y: 3 },
  { x: 2, y: 3 },
];

/** Affine parallelogram (opposite sides are equal vectors). */
const SHEARED_Q4: Q4NodeCoordinates = [
  { x: -1, y: 0 },
  { x: 3, y: 0 },
  { x: 5, y: 2 },
  { x: 1, y: 2 },
];

/** Non-affine convex trapezoid (top edge shorter than bottom edge). */
const TRAPEZOID_Q4: Q4NodeCoordinates = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 3, y: 2 },
  { x: 1, y: 2 },
];

function skewParallelogram(sign: 1 | -1): Q4NodeCoordinates {
  const offset = sign * 1.25 * SKEW_TAN_19;
  return [
    { x: 0, y: 0 },
    { x: 2.5, y: 0 },
    { x: 2.5 + offset, y: 1.25 },
    { x: offset, y: 1.25 },
  ];
}

const INTERIOR_NATURAL_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.25, -0.5],
  [-0.37, 0.41],
  [1, -1],
  [-1, 1],
];

function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("inverse Q4 point mapping", () => {
  it("recovers natural coordinates exactly on an affine rectangle via the affine path", () => {
    for (const [xi, eta] of INTERIOR_NATURAL_POINTS) {
      const target = interpolateQ4Point(RECTANGULAR_Q4, xi, eta);
      const result = inverseQ4Point(RECTANGULAR_Q4, target);

      expect(result.method).toBe("affine");
      expect(result.converged).toBe(true);
      expect(result.jacobianFailed).toBe(false);
      expect(result.inside).toBe(true);
      expect(result.xi).toBeCloseTo(xi, 12);
      expect(result.eta).toBeCloseTo(eta, 12);
      expect(result.residualNorm).toBeLessThanOrEqual(1e-9);
    }
  });

  it("recovers natural coordinates exactly on an affine parallelogram", () => {
    const target = interpolateQ4Point(SHEARED_Q4, 0.25, -0.5);
    const result = inverseQ4Point(SHEARED_Q4, target);

    expect(result.method).toBe("affine");
    expect(result.xi).toBeCloseTo(0.25, 12);
    expect(result.eta).toBeCloseTo(-0.5, 12);
    expect(distance(interpolateQ4Point(SHEARED_Q4, result.xi, result.eta), target)).toBeLessThanOrEqual(1e-9);
  });

  it.each([1, -1] as const)("round trips both skew-sign parallelogram elements (sign %d)", (sign) => {
    const element = skewParallelogram(sign);
    for (const [xi, eta] of INTERIOR_NATURAL_POINTS) {
      const target = interpolateQ4Point(element, xi, eta);
      const result = inverseQ4Point(element, target);

      expect(result.method).toBe("affine");
      expect(result.xi).toBeCloseTo(xi, 10);
      expect(result.eta).toBeCloseTo(eta, 10);
      expect(result.inside).toBe(true);
    }
  });

  it("reports a point outside the element without clamping the natural coordinates", () => {
    // Two natural units to the right of the rectangle centre => xi = 2.
    const target = interpolateQ4Point(RECTANGULAR_Q4, 2, 0);
    const result = inverseQ4Point(RECTANGULAR_Q4, target);

    expect(result.converged).toBe(true);
    expect(result.xi).toBeCloseTo(2, 10);
    expect(result.eta).toBeCloseTo(0, 10);
    expect(result.inside).toBe(false);
  });

  it("locates interior points of a non-affine convex quad with bounded Newton iteration", () => {
    for (const [xi, eta] of [
      [0, 0],
      [0.3, -0.2],
      [-0.6, 0.5],
    ] as const) {
      const target = interpolateQ4Point(TRAPEZOID_Q4, xi, eta);
      const result = inverseQ4Point(TRAPEZOID_Q4, target);

      expect(result.method).toBe("newton");
      expect(result.converged).toBe(true);
      expect(result.jacobianFailed).toBe(false);
      expect(result.iterations).toBeLessThanOrEqual(20);
      expect(result.xi).toBeCloseTo(xi, 8);
      expect(result.eta).toBeCloseTo(eta, 8);
      expect(distance(interpolateQ4Point(TRAPEZOID_Q4, result.xi, result.eta), target)).toBeLessThanOrEqual(1e-8);
    }
  });

  it("recovers hand-computed natural coordinates on the non-affine trapezoid (independent oracle)", () => {
    // TRAPEZOID_Q4 is symmetric about x = 2. Derived by hand from the shape
    // functions (not from a forward-map call): on the axis xi = 0 the forward
    // map gives (2, 1 + eta); on the bottom edge eta = -1 it gives (2(1 + xi), 0).
    const cases = [
      { target: { x: 2, y: 1 }, xi: 0, eta: 0 },
      { target: { x: 2, y: 1.5 }, xi: 0, eta: 0.5 },
      { target: { x: 2, y: 0.5 }, xi: 0, eta: -0.5 },
      { target: { x: 1, y: 0 }, xi: -0.5, eta: -1 },
    ] as const;
    for (const { target, xi, eta } of cases) {
      const result = inverseQ4Point(TRAPEZOID_Q4, target);
      expect(result.method).toBe("newton");
      expect(result.converged).toBe(true);
      expect(result.xi).toBeCloseTo(xi, 8);
      expect(result.eta).toBeCloseTo(eta, 8);
    }
  });

  it("honours an explicit iteration cap and never clamps the result", () => {
    const target = interpolateQ4Point(TRAPEZOID_Q4, 0.6, -0.4);
    const result = inverseQ4Point(TRAPEZOID_Q4, target, { maxIterations: 1 });

    expect(result.iterations).toBeLessThanOrEqual(1);
    expect(result.converged).toBe(false);
  });

  it("flags a degenerate (collapsed) quad as a Jacobian failure instead of dividing by zero", () => {
    const collapsed: Q4NodeCoordinates = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    const result = inverseQ4Point(collapsed, { x: 1.5, y: 0 });

    expect(result.jacobianFailed).toBe(true);
    expect(result.converged).toBe(false);
    expect(Number.isFinite(result.xi)).toBe(true);
    expect(Number.isFinite(result.eta)).toBe(true);
  });

  it("flags an inverted (clockwise) quad as a Jacobian failure", () => {
    const inverted: Q4NodeCoordinates = [
      RECTANGULAR_Q4[0],
      RECTANGULAR_Q4[3],
      RECTANGULAR_Q4[2],
      RECTANGULAR_Q4[1],
    ];
    const result = inverseQ4Point(inverted, { x: 4, y: 1 });

    expect(result.jacobianFailed).toBe(true);
    expect(result.converged).toBe(false);
  });
});

describe("affine parallelogram assertion for the release load path", () => {
  it("accepts rectangles, parallelograms, and skew elements", () => {
    expect(isAffineParallelogramQ4(RECTANGULAR_Q4)).toBe(true);
    expect(isAffineParallelogramQ4(SHEARED_Q4)).toBe(true);
    expect(isAffineParallelogramQ4(skewParallelogram(1))).toBe(true);
    expect(isAffineParallelogramQ4(skewParallelogram(-1))).toBe(true);
    expect(() => assertAffineParallelogramQ4(RECTANGULAR_Q4)).not.toThrow();
  });

  it("rejects a non-affine convex quad", () => {
    expect(isAffineParallelogramQ4(TRAPEZOID_Q4)).toBe(false);
    expect(() => assertAffineParallelogramQ4(TRAPEZOID_Q4)).toThrow(/affine parallelogram/i);
  });

  it("classifies robustly on both sides of the affine detection boundary", () => {
    // Perturbing one rectangle node by delta gives a bilinear cross term |d| = delta/4;
    // the scale-relative threshold is ~1e-9 * characteristic length.
    const perturb = (delta: number): Q4NodeCoordinates => [
      { x: 2, y: -1 },
      { x: 6, y: -1 },
      { x: 6 + delta, y: 3 },
      { x: 2, y: 3 },
    ];
    expect(isAffineParallelogramQ4(perturb(1e-9))).toBe(true);
    expect(isAffineParallelogramQ4(perturb(1e-2))).toBe(false);
  });
});
