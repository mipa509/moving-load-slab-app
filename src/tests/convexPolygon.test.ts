import { describe, expect, it } from "vitest";
import {
  classifyPointInConvexPolygon,
  clipConvexPolygons,
  getPolygonAabb,
  integrateTriangleDegreeTwo,
  normalizeConvexPolygon,
  pointInConvexPolygon,
  pointOnSegment,
  polygonArea,
  polygonCentroid,
  polygonFirstMoments,
  signedPolygonArea,
  triangleQuadratureDegreeTwo,
  triangulateConvexPolygon,
  type Triangle2D,
} from "../solver/geometry/convexPolygon";
import type { Point2D, Polygon2D } from "../solver/geometry/types";

const TEST_ROUNDOFF_FACTOR = 512;

function expectRoundoff(
  actual: number,
  expected: number,
  characteristicScale: number,
): void {
  const tolerance = TEST_ROUNDOFF_FACTOR
    * Number.EPSILON
    * Math.max(Math.abs(expected), characteristicScale, Number.MIN_VALUE);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function expectPointRoundoff(
  actual: Point2D | null,
  expected: Point2D,
  characteristicLength: number,
): void {
  expect(actual).not.toBeNull();
  expectRoundoff(actual!.x, expected.x, characteristicLength);
  expectRoundoff(actual!.y, expected.y, characteristicLength);
}

const SQUARE: Polygon2D = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 2 },
  { x: 0, y: 2 },
];

describe("convex polygon normalization and measures", () => {
  it("preserves signed winding and normalizes CW/CCW rings deterministically", () => {
    const clockwise = [...SQUARE].reverse();

    expect(signedPolygonArea(SQUARE)).toBe(4);
    expect(signedPolygonArea(clockwise)).toBe(-4);
    expect(polygonArea(clockwise)).toBe(4);
    expect(normalizeConvexPolygon(SQUARE)).toEqual(SQUARE);
    expect(normalizeConvexPolygon(clockwise)).toEqual(SQUARE);
  });

  it("removes a repeated close, duplicate vertices, and collinear vertices", () => {
    const noisy: Polygon2D = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ];

    expect(normalizeConvexPolygon(noisy)).toEqual(SQUARE);
  });

  it("returns null for empty, non-finite, concave, self-intersecting, and degenerate rings", () => {
    expect(normalizeConvexPolygon(null)).toBeNull();
    expect(normalizeConvexPolygon([])).toBeNull();
    expect(normalizeConvexPolygon([{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBeNull();
    expect(normalizeConvexPolygon([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ])).toBeNull();
    expect(normalizeConvexPolygon([
      { x: 0, y: 0 },
      { x: Number.NaN, y: 0 },
      { x: 0, y: 1 },
    ])).toBeNull();
    expect(normalizeConvexPolygon([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ])).toBeNull();
    expect(normalizeConvexPolygon([
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 2, y: 0 },
    ])).toBeNull();
    const regularPentagon = Array.from({ length: 5 }, (_, index) => {
      const angle = -Math.PI / 2 + index * 2 * Math.PI / 5;
      return { x: Math.cos(angle), y: Math.sin(angle) };
    });
    expect(normalizeConvexPolygon([0, 2, 4, 1, 3].map((index) => regularPentagon[index]))).toBeNull();
    expect(polygonCentroid([])).toBeNull();
    expect(polygonFirstMoments([])).toBeNull();
    expect(getPolygonAabb([])).toBeNull();
  });

  it("is translation invariant at large finite coordinate offsets", () => {
    const offset = 1e15;
    const remoteSquare: Polygon2D = [
      { x: offset, y: offset },
      { x: offset + 1, y: offset },
      { x: offset + 1, y: offset + 1 },
      { x: offset, y: offset + 1 },
    ];

    expect(normalizeConvexPolygon(remoteSquare)).toEqual(remoteSquare);
    expect(polygonArea(remoteSquare)).toBe(1);
    expect(classifyPointInConvexPolygon(
      { x: offset + 0.5, y: offset + 0.5 },
      remoteSquare,
    )).toBe("inside");
    expect(clipConvexPolygons(remoteSquare, remoteSquare)).toEqual(remoteSquare);
  });

  it("chooses a deterministic representative for tolerance-equivalent vertices", () => {
    const delta = 1e-15;
    const noisyCounterClockwise: Polygon2D = [
      { x: delta, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const noisyClockwiseRotated: Polygon2D = [
      { x: 1, y: 1 },
      { x: 1, y: 0 },
      { x: delta, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ];
    const expected: Polygon2D = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];

    expect(normalizeConvexPolygon(noisyCounterClockwise)).toEqual(expected);
    expect(normalizeConvexPolygon(noisyClockwiseRotated)).toEqual(expected);
  });

  it("computes triangle and trapezoid area, centroid, first moments, and AABB", () => {
    const triangle: Polygon2D = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 3 },
    ];
    expect(polygonArea(triangle)).toBe(6);
    expectPointRoundoff(polygonCentroid(triangle), { x: 4 / 3, y: 1 }, 4);
    const triangleMoments = polygonFirstMoments(triangle)!;
    expectRoundoff(triangleMoments.integralX, 8, 24);
    expectRoundoff(triangleMoments.integralY, 6, 18);

    const trapezoid: Polygon2D = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 3, y: 2 },
      { x: 1, y: 2 },
    ];
    expect(polygonArea(trapezoid)).toBe(6);
    expectPointRoundoff(polygonCentroid(trapezoid), { x: 2, y: 8 / 9 }, 4);
    const trapezoidMoments = polygonFirstMoments(trapezoid)!;
    expectRoundoff(trapezoidMoments.integralX, 12, 24);
    expectRoundoff(trapezoidMoments.integralY, 16 / 3, 12);
    expect(getPolygonAabb(trapezoid)).toEqual({
      xMin: 0,
      xMax: 4,
      yMin: 0,
      yMax: 2,
    });
  });
});

describe("convex point predicates and clipping", () => {
  it("distinguishes inside, boundary, and outside points", () => {
    expect(classifyPointInConvexPolygon({ x: 1, y: 1 }, SQUARE)).toBe("inside");
    expect(classifyPointInConvexPolygon({ x: 2, y: 1 }, SQUARE)).toBe("boundary");
    expect(classifyPointInConvexPolygon({ x: 3, y: 1 }, SQUARE)).toBe("outside");
    expect(classifyPointInConvexPolygon({ x: 0, y: 0 }, null)).toBe("outside");
    expect(pointInConvexPolygon({ x: 2, y: 1 }, SQUARE)).toBe(true);
    expect(pointInConvexPolygon({ x: 2, y: 1 }, SQUARE, false)).toBe(false);
    expect(pointOnSegment({ x: 1, y: 0 }, SQUARE[0], SQUARE[1])).toBe(true);
    expect(pointOnSegment({ x: 3, y: 0 }, SQUARE[0], SQUARE[1])).toBe(false);
  });

  it("returns the contained polygon and null for empty or disjoint inputs", () => {
    const contained: Polygon2D = [
      { x: 0.5, y: 0.5 },
      { x: 1.5, y: 0.5 },
      { x: 1.5, y: 1.5 },
      { x: 0.5, y: 1.5 },
    ];
    const disjoint: Polygon2D = [
      { x: 3, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 3, y: 1 },
    ];

    expect(clipConvexPolygons(SQUARE, contained)).toEqual(contained);
    expect(clipConvexPolygons([], SQUARE)).toBeNull();
    expect(clipConvexPolygons(SQUARE, disjoint)).toBeNull();
  });

  it("treats shared edges and vertices as zero-area null intersections", () => {
    const edgeNeighbour: Polygon2D = [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 2 },
      { x: 2, y: 2 },
    ];
    const vertexNeighbour: Polygon2D = [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
    ];

    expect(clipConvexPolygons(SQUARE, edgeNeighbour)).toBeNull();
    expect(clipConvexPolygons(SQUARE, vertexNeighbour)).toBeNull();
  });

  it("clips to a trapezoid and conserves its area, centroid, and first moments", () => {
    const subject: Polygon2D = [
      { x: -1, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 2 },
      { x: -1, y: 2 },
    ];
    const trapezoid: Polygon2D = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 1.5, y: 2 },
      { x: 0.5, y: 2 },
    ];
    const clipped = clipConvexPolygons(subject, [...trapezoid].reverse());

    expect(clipped).toEqual(trapezoid);
    expectRoundoff(polygonArea(clipped), 3, 8);
    expectPointRoundoff(polygonCentroid(clipped), { x: 1, y: 8 / 9 }, 2);
    const moments = polygonFirstMoments(clipped)!;
    expectRoundoff(moments.integralX, 3, 6);
    expectRoundoff(moments.integralY, 8 / 3, 6);
  });
});

describe("deterministic triangulation and degree-two quadrature", () => {
  it("triangulates equivalent rings identically and conserves polygon measures", () => {
    const trapezoid: Polygon2D = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 3, y: 2 },
      { x: 1, y: 2 },
    ];
    const rotatedClockwise: Polygon2D = [
      { x: 3, y: 2 },
      { x: 4, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: 3, y: 2 },
    ];
    const triangles = triangulateConvexPolygon(trapezoid)!;

    expect(triangulateConvexPolygon(rotatedClockwise)).toEqual(triangles);
    expect(triangles).toEqual([
      [trapezoid[0], trapezoid[1], trapezoid[2]],
      [trapezoid[0], trapezoid[2], trapezoid[3]],
    ]);

    let areaSum = 0;
    let integralXSum = 0;
    let integralYSum = 0;
    for (const triangle of triangles) {
      areaSum += polygonArea(triangle);
      const moments = polygonFirstMoments(triangle)!;
      integralXSum += moments.integralX;
      integralYSum += moments.integralY;
    }
    expectRoundoff(areaSum, 6, 8);
    expectRoundoff(integralXSum, 12, 24);
    expectRoundoff(integralYSum, 16 / 3, 12);
  });

  it("returns deeply immutable triangulation and quadrature data", () => {
    const triangles = triangulateConvexPolygon(SQUARE)!;
    expect(Object.isFrozen(triangles)).toBe(true);
    expect(Object.isFrozen(triangles[0])).toBe(true);
    expect(Object.isFrozen(triangles[0][0])).toBe(true);
    expect(triangles[0][0]).not.toBe(triangles[1][0]);
    expect(() => {
      (triangles[0][0] as { x: number }).x = 99;
    }).toThrow();
    expect(triangles[1][0]).toEqual({ x: 0, y: 0 });

    const first = triangleQuadratureDegreeTwo(triangles[0])!;
    const second = triangleQuadratureDegreeTwo(triangles[0])!;
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0])).toBe(true);
    expect(Object.isFrozen(first[0].point)).toBe(true);
    expect(Object.isFrozen(first[0].barycentric)).toBe(true);
    expect(first[0].point).not.toBe(second[0].point);
    expect(first[0].barycentric).not.toBe(second[0].barycentric);
    expect(() => {
      (first[0].barycentric as unknown as number[])[0] = 1;
    }).toThrow();
    expect(second[0].barycentric).toEqual([2 / 3, 1 / 6, 1 / 6]);
  });

  it("returns null quadrature for degenerate triangles", () => {
    const degenerate = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ] as const satisfies Triangle2D;
    expect(triangulateConvexPolygon(degenerate)).toBeNull();
    expect(triangleQuadratureDegreeTwo(degenerate)).toBeNull();
    expect(integrateTriangleDegreeTwo(degenerate, () => 1)).toBeNull();
  });

  it("integrates constants, linear fields, and all quadratic monomials exactly", () => {
    const triangle: Triangle2D = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 3 },
    ];
    const quadrature = triangleQuadratureDegreeTwo(triangle)!;
    expectRoundoff(
      quadrature.reduce((sum, sample) => sum + sample.weight, 0),
      3,
      3,
    );
    expect(quadrature.every((sample) => sample.weight > 0)).toBe(true);

    const cases: Array<{
      integrand: (point: Point2D) => number;
      exact: number;
      scale: number;
    }> = [
      { integrand: () => 1, exact: 3, scale: 3 },
      { integrand: ({ x }) => x, exact: 2, scale: 6 },
      { integrand: ({ y }) => y, exact: 3, scale: 9 },
      { integrand: ({ x }) => x * x, exact: 2, scale: 12 },
      { integrand: ({ x, y }) => x * y, exact: 1.5, scale: 18 },
      { integrand: ({ y }) => y * y, exact: 4.5, scale: 27 },
    ];
    for (const testCase of cases) {
      expectRoundoff(
        integrateTriangleDegreeTwo(triangle, testCase.integrand)!,
        testCase.exact,
        testCase.scale,
      );
    }
  });
});
