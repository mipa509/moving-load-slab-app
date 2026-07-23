import type { Aabb, Point2D, Polygon2D } from "./types";

/** A non-degenerate triangle with no repeated closing vertex. */
export type Triangle2D = readonly [Point2D, Point2D, Point2D];

export type PointInPolygonLocation = "outside" | "boundary" | "inside";

export interface GeometryTolerance {
  /** Coordinate-distance tolerance in the units of the input points. */
  length: number;
  /** Cross-product/area tolerance in the squared units of the input points. */
  area: number;
}

export interface PolygonFirstMoments {
  /** First area moment `integral(x dA)`. */
  integralX: number;
  /** First area moment `integral(y dA)`. */
  integralY: number;
}

export interface TriangleQuadraturePoint {
  point: Point2D;
  /** Positive physical-area weight. The three weights sum to triangle area. */
  weight: number;
  barycentric: readonly [number, number, number];
}

// The tolerance is deliberately translation-invariant. Input coordinates have
// already been rounded to representable numbers; validity and cleanup depend
// on local spans/edges, never on distance from the global origin.
const LOCAL_ROUNDOFF_FACTOR = 64;

type PointList = readonly Point2D[] | null | undefined;

function isFinitePoint(point: Point2D): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function orient(a: Point2D, b: Point2D, c: Point2D): number {
  return cross(b.x - a.x, b.y - a.y, c.x - a.x, c.y - a.y);
}

function pointDistance(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function rawBounds(points: readonly Point2D[]): Aabb {
  let xMin = points[0].x;
  let xMax = points[0].x;
  let yMin = points[0].y;
  let yMax = points[0].y;

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    xMin = Math.min(xMin, point.x);
    xMax = Math.max(xMax, point.x);
    yMin = Math.min(yMin, point.y);
    yMax = Math.max(yMax, point.y);
  }

  return { xMin, xMax, yMin, yMax };
}

/**
 * Returns the single scale-aware tolerance policy used by this kernel.
 * Non-finite or empty input has zero geometric scale and therefore returns
 * the smallest positive representable tolerance, not a fixed decimal floor.
 */
export function getGeometryTolerance(points: PointList): GeometryTolerance {
  if (!points || points.length === 0 || points.some((point) => !isFinitePoint(point))) {
    return { length: Number.MIN_VALUE, area: Number.MIN_VALUE };
  }

  const bounds = rawBounds(points);
  const span = Math.hypot(bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin);
  const length = Math.max(
    Number.MIN_VALUE,
    LOCAL_ROUNDOFF_FACTOR * Number.EPSILON * span,
  );
  const area = Math.max(
    Number.MIN_VALUE,
    length * Math.max(span, length),
  );
  return { length, area };
}

function orientationTolerance(
  a: Point2D,
  b: Point2D,
  c: Point2D,
  lengthTolerance: number,
): number {
  const perimeterScale = pointDistance(a, b) + pointDistance(b, c) + pointDistance(c, a);
  return lengthTolerance * Math.max(perimeterScale, lengthTolerance);
}

function pointsCoincide(a: Point2D, b: Point2D, tolerance: number): boolean {
  return pointDistance(a, b) <= tolerance;
}

function comparePointsLexicographically(a: Point2D, b: Point2D): number {
  return a.x === b.x ? a.y - b.y : a.x - b.x;
}

function canonicalCoincidentRepresentative(
  point: Point2D,
  points: readonly Point2D[],
  tolerance: number,
): Point2D {
  let representative = point;
  for (const candidate of points) {
    if (
      pointsCoincide(point, candidate, tolerance)
      && comparePointsLexicographically(candidate, representative) < 0
    ) {
      representative = candidate;
    }
  }
  return { x: representative.x, y: representative.y };
}

function isBetweenNeighbours(
  previous: Point2D,
  point: Point2D,
  next: Point2D,
  tolerance: number,
): boolean {
  const fromPreviousX = point.x - previous.x;
  const fromPreviousY = point.y - previous.y;
  const fromNextX = point.x - next.x;
  const fromNextY = point.y - next.y;
  return fromPreviousX * fromNextX + fromPreviousY * fromNextY <= tolerance * tolerance;
}

function pointOnSegmentWithTolerance(
  point: Point2D,
  start: Point2D,
  end: Point2D,
  lengthTolerance: number,
): boolean {
  if (
    Math.abs(orient(start, end, point))
      > lengthTolerance * Math.max(pointDistance(start, end), lengthTolerance)
  ) {
    return false;
  }
  return (
    point.x >= Math.min(start.x, end.x) - lengthTolerance
    && point.x <= Math.max(start.x, end.x) + lengthTolerance
    && point.y >= Math.min(start.y, end.y) - lengthTolerance
    && point.y <= Math.max(start.y, end.y) + lengthTolerance
  );
}

function segmentsIntersectOrTouch(
  a: Point2D,
  b: Point2D,
  c: Point2D,
  d: Point2D,
  lengthTolerance: number,
): boolean {
  const abC = orient(a, b, c);
  const abD = orient(a, b, d);
  const cdA = orient(c, d, a);
  const cdB = orient(c, d, b);
  const abTolerance = lengthTolerance * Math.max(pointDistance(a, b), lengthTolerance);
  const cdTolerance = lengthTolerance * Math.max(pointDistance(c, d), lengthTolerance);

  if (
    ((abC > abTolerance && abD < -abTolerance)
      || (abC < -abTolerance && abD > abTolerance))
    && ((cdA > cdTolerance && cdB < -cdTolerance)
      || (cdA < -cdTolerance && cdB > cdTolerance))
  ) {
    return true;
  }
  return (
    (Math.abs(abC) <= abTolerance && pointOnSegmentWithTolerance(c, a, b, lengthTolerance))
    || (Math.abs(abD) <= abTolerance && pointOnSegmentWithTolerance(d, a, b, lengthTolerance))
    || (Math.abs(cdA) <= cdTolerance && pointOnSegmentWithTolerance(a, c, d, lengthTolerance))
    || (Math.abs(cdB) <= cdTolerance && pointOnSegmentWithTolerance(b, c, d, lengthTolerance))
  );
}

function hasNonAdjacentEdgeIntersection(
  polygon: Polygon2D,
  lengthTolerance: number,
): boolean {
  for (let firstIndex = 0; firstIndex < polygon.length; firstIndex += 1) {
    const firstNext = (firstIndex + 1) % polygon.length;
    for (let secondIndex = firstIndex + 1; secondIndex < polygon.length; secondIndex += 1) {
      const secondNext = (secondIndex + 1) % polygon.length;
      const adjacent = firstNext === secondIndex || secondNext === firstIndex;
      if (adjacent) {
        continue;
      }
      if (
        segmentsIntersectOrTouch(
          polygon[firstIndex],
          polygon[firstNext],
          polygon[secondIndex],
          polygon[secondNext],
          lengthTolerance,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function rotateToCanonicalStart(points: Polygon2D): Polygon2D {
  let firstIndex = 0;
  for (let index = 1; index < points.length; index += 1) {
    const candidate = points[index];
    const first = points[firstIndex];
    if (candidate.x < first.x || (candidate.x === first.x && candidate.y < first.y)) {
      firstIndex = index;
    }
  }
  return [...points.slice(firstIndex), ...points.slice(0, firstIndex)];
}

/** Signed shoelace area; counter-clockwise rings are positive. */
export function signedPolygonArea(points: PointList): number {
  if (!points || points.length < 3) {
    return 0;
  }
  if (points.some((point) => !isFinitePoint(point))) {
    return Number.NaN;
  }

  // Translate to the first point to reduce cancellation for remote polygons.
  const origin = points[0];
  let twiceArea = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const first = points[index];
    const second = points[index + 1];
    twiceArea += cross(
      first.x - origin.x,
      first.y - origin.y,
      second.x - origin.x,
      second.y - origin.y,
    );
  }
  return 0.5 * twiceArea;
}

/** Positive polygon area. Empty or degenerate point lists have zero area. */
export function polygonArea(points: PointList): number {
  return Math.abs(signedPolygonArea(points));
}

/**
 * Cleans and validates a convex polygon, returning a canonical CCW ring.
 * Repeated closing/duplicate vertices and between-neighbour collinear vertices
 * are removed. Empty, non-finite, non-convex, or zero-area input returns null.
 */
export function normalizeConvexPolygon(points: PointList): Polygon2D | null {
  if (!points || points.length < 3 || points.some((point) => !isFinitePoint(point))) {
    return null;
  }

  const tolerance = getGeometryTolerance(points);
  const unique: Polygon2D = [];
  for (const point of points) {
    const representative = canonicalCoincidentRepresentative(
      point,
      points,
      tolerance.length,
    );
    if (
      unique.length === 0
      || !pointsCoincide(unique[unique.length - 1], representative, tolerance.length)
    ) {
      unique.push(representative);
    }
  }
  if (
    unique.length > 1
    && pointsCoincide(unique[0], unique[unique.length - 1], tolerance.length)
  ) {
    unique.pop();
  }
  if (unique.length < 3) {
    return null;
  }

  let changed = true;
  while (changed && unique.length >= 3) {
    changed = false;
    for (let index = 0; index < unique.length; index += 1) {
      const previous = unique[(index - 1 + unique.length) % unique.length];
      const point = unique[index];
      const next = unique[(index + 1) % unique.length];
      if (
        Math.abs(orient(previous, point, next))
          <= orientationTolerance(previous, point, next, tolerance.length)
        && isBetweenNeighbours(previous, point, next, tolerance.length)
      ) {
        unique.splice(index, 1);
        changed = true;
        break;
      }
    }
  }
  if (unique.length < 3) {
    return null;
  }

  if (hasNonAdjacentEdgeIntersection(unique, tolerance.length)) {
    return null;
  }

  const signedArea = signedPolygonArea(unique);
  if (!Number.isFinite(signedArea) || Math.abs(signedArea) <= tolerance.area) {
    return null;
  }
  if (signedArea < 0) {
    unique.reverse();
  }

  for (let index = 0; index < unique.length; index += 1) {
    const previous = unique[(index - 1 + unique.length) % unique.length];
    const point = unique[index];
    const next = unique[(index + 1) % unique.length];
    if (
      orient(previous, point, next)
      <= orientationTolerance(previous, point, next, tolerance.length)
    ) {
      return null;
    }
  }

  return rotateToCanonicalStart(unique);
}

function normalizedCentroid(polygon: Polygon2D): Point2D {
  const origin = polygon[0];
  let twiceArea = 0;
  let weightedX = 0;
  let weightedY = 0;

  for (let index = 1; index < polygon.length - 1; index += 1) {
    const firstX = polygon[index].x - origin.x;
    const firstY = polygon[index].y - origin.y;
    const secondX = polygon[index + 1].x - origin.x;
    const secondY = polygon[index + 1].y - origin.y;
    const triangleTwiceArea = cross(firstX, firstY, secondX, secondY);
    twiceArea += triangleTwiceArea;
    weightedX += (firstX + secondX) * triangleTwiceArea;
    weightedY += (firstY + secondY) * triangleTwiceArea;
  }

  return {
    x: origin.x + weightedX / (3 * twiceArea),
    y: origin.y + weightedY / (3 * twiceArea),
  };
}

/** Centroid of a valid cleaned convex polygon, otherwise null. */
export function polygonCentroid(points: PointList): Point2D | null {
  const polygon = normalizeConvexPolygon(points);
  return polygon ? normalizedCentroid(polygon) : null;
}

/** First moments of a valid cleaned convex polygon, otherwise null. */
export function polygonFirstMoments(points: PointList): PolygonFirstMoments | null {
  const polygon = normalizeConvexPolygon(points);
  if (!polygon) {
    return null;
  }
  const area = signedPolygonArea(polygon);
  const centroid = normalizedCentroid(polygon);
  return {
    integralX: area * centroid.x,
    integralY: area * centroid.y,
  };
}

/** AABB of a valid physical convex polygon, otherwise null. */
export function getPolygonAabb(points: PointList): Aabb | null {
  const polygon = normalizeConvexPolygon(points);
  return polygon ? rawBounds(polygon) : null;
}

/** Scale-aware closed-segment predicate. */
export function pointOnSegment(
  point: Point2D,
  start: Point2D,
  end: Point2D,
): boolean {
  if (![point, start, end].every(isFinitePoint)) {
    return false;
  }
  const tolerance = getGeometryTolerance([point, start, end]);
  return pointOnSegmentWithTolerance(point, start, end, tolerance.length);
}

/** Classifies a point against a physical convex polygon. */
export function classifyPointInConvexPolygon(
  point: Point2D,
  points: PointList,
): PointInPolygonLocation {
  if (!isFinitePoint(point)) {
    return "outside";
  }
  const polygon = normalizeConvexPolygon(points);
  if (!polygon) {
    return "outside";
  }

  const tolerance = getGeometryTolerance([...polygon, point]);
  let boundary = false;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const side = orient(start, end, point);
    const sideTolerance = tolerance.length
      * Math.max(pointDistance(start, end), tolerance.length);
    if (side < -sideTolerance) {
      return "outside";
    }
    if (Math.abs(side) <= sideTolerance && pointOnSegment(point, start, end)) {
      boundary = true;
    }
  }
  return boundary ? "boundary" : "inside";
}

export function pointInConvexPolygon(
  point: Point2D,
  polygon: PointList,
  includeBoundary = true,
): boolean {
  const location = classifyPointInConvexPolygon(point, polygon);
  return location === "inside" || (includeBoundary && location === "boundary");
}

function lineIntersection(
  segmentStart: Point2D,
  segmentEnd: Point2D,
  lineStart: Point2D,
  lineEnd: Point2D,
): Point2D | null {
  const segmentX = segmentEnd.x - segmentStart.x;
  const segmentY = segmentEnd.y - segmentStart.y;
  const lineX = lineEnd.x - lineStart.x;
  const lineY = lineEnd.y - lineStart.y;
  const startSide = cross(
    lineX,
    lineY,
    segmentStart.x - lineStart.x,
    segmentStart.y - lineStart.y,
  );
  const endSide = cross(
    lineX,
    lineY,
    segmentEnd.x - lineStart.x,
    segmentEnd.y - lineStart.y,
  );
  const denominator = startSide - endSide;
  if (denominator === 0) {
    return null;
  }
  const parameter = Math.max(0, Math.min(1, startSide / denominator));
  return {
    x: segmentStart.x + parameter * segmentX,
    y: segmentStart.y + parameter * segmentY,
  };
}

function appendDistinct(points: Polygon2D, point: Point2D, tolerance: number): void {
  if (points.length === 0 || !pointsCoincide(points[points.length - 1], point, tolerance)) {
    points.push(point);
  }
}

/**
 * Deterministic Sutherland-Hodgman intersection of two convex polygons.
 * Clip boundaries are inclusive. Empty, disjoint, shared-edge-only, and
 * shared-vertex-only intersections return null, as no physical polygon exists.
 */
export function clipConvexPolygons(
  subjectPoints: PointList,
  clipPoints: PointList,
): Polygon2D | null {
  const subject = normalizeConvexPolygon(subjectPoints);
  const clip = normalizeConvexPolygon(clipPoints);
  if (!subject || !clip) {
    return null;
  }

  const tolerance = getGeometryTolerance([...subject, ...clip]);
  let output: Polygon2D = subject.map((point) => ({ ...point }));

  for (let clipIndex = 0; clipIndex < clip.length; clipIndex += 1) {
    const lineStart = clip[clipIndex];
    const lineEnd = clip[(clipIndex + 1) % clip.length];
    const edgeLength = pointDistance(lineStart, lineEnd);
    const sideTolerance = tolerance.length * Math.max(edgeLength, tolerance.length);
    const input = output;
    output = [];
    if (input.length === 0) {
      return null;
    }

    let segmentStart = input[input.length - 1];
    let startInside = orient(lineStart, lineEnd, segmentStart) >= -sideTolerance;
    for (const segmentEnd of input) {
      const endInside = orient(lineStart, lineEnd, segmentEnd) >= -sideTolerance;
      if (endInside !== startInside) {
        const intersection = lineIntersection(
          segmentStart,
          segmentEnd,
          lineStart,
          lineEnd,
        );
        if (intersection) {
          appendDistinct(output, intersection, tolerance.length);
        }
      }
      if (endInside) {
        appendDistinct(output, { ...segmentEnd }, tolerance.length);
      }
      segmentStart = segmentEnd;
      startInside = endInside;
    }
    if (
      output.length > 1
      && pointsCoincide(output[0], output[output.length - 1], tolerance.length)
    ) {
      output.pop();
    }
  }

  return normalizeConvexPolygon(output);
}

/** Deterministic fan triangulation from the canonical first polygon vertex. */
export function triangulateConvexPolygon(points: PointList): Triangle2D[] | null {
  const polygon = normalizeConvexPolygon(points);
  if (!polygon) {
    return null;
  }
  const triangles: Triangle2D[] = [];
  for (let index = 1; index < polygon.length - 1; index += 1) {
    triangles.push(Object.freeze([
      Object.freeze({ ...polygon[0] }),
      Object.freeze({ ...polygon[index] }),
      Object.freeze({ ...polygon[index + 1] }),
    ]) as Triangle2D);
  }
  return Object.freeze(triangles) as Triangle2D[];
}

const DEGREE_TWO_BARYCENTRIC_POINTS = [
  [2 / 3, 1 / 6, 1 / 6],
  [1 / 6, 2 / 3, 1 / 6],
  [1 / 6, 1 / 6, 2 / 3],
] as const;

/**
 * Three-point triangle rule exact for polynomials of total degree at most two.
 *
 * For release consistent-load integration, exactness is claimed only for
 * affine parallelogram Q4 elements, whose inverse shape functions and constant
 * Jacobian preserve the required polynomial degree. It is not an exactness
 * claim for non-affine quads with a variable Jacobian.
 */
export function triangleQuadratureDegreeTwo(
  triangle: Triangle2D | null | undefined,
): TriangleQuadraturePoint[] | null {
  const normalized = normalizeConvexPolygon(triangle);
  if (!normalized || normalized.length !== 3) {
    return null;
  }
  const normalizedTriangle: Triangle2D = [normalized[0], normalized[1], normalized[2]];
  const weight = signedPolygonArea(normalizedTriangle) / 3;
  const quadrature = DEGREE_TWO_BARYCENTRIC_POINTS.map((sourceBarycentric) => {
    const barycentric = Object.freeze([
      sourceBarycentric[0],
      sourceBarycentric[1],
      sourceBarycentric[2],
    ]) as readonly [number, number, number];
    return Object.freeze({
      point: Object.freeze({
        x: barycentric[0] * normalizedTriangle[0].x
          + barycentric[1] * normalizedTriangle[1].x
          + barycentric[2] * normalizedTriangle[2].x,
        y: barycentric[0] * normalizedTriangle[0].y
          + barycentric[1] * normalizedTriangle[1].y
          + barycentric[2] * normalizedTriangle[2].y,
      }),
      weight,
      barycentric,
    });
  });
  return Object.freeze(quadrature) as TriangleQuadraturePoint[];
}

/** Integrates a scalar field with the degree-two triangle rule. */
export function integrateTriangleDegreeTwo(
  triangle: Triangle2D | null | undefined,
  integrand: (point: Point2D) => number,
): number | null {
  const quadrature = triangleQuadratureDegreeTwo(triangle);
  if (!quadrature) {
    return null;
  }
  let integral = 0;
  for (const sample of quadrature) {
    integral += sample.weight * integrand(sample.point);
  }
  return integral;
}
