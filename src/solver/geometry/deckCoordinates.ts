import type {
  Aabb,
  DeckEdge,
  DeckEdgeFrame,
  DeckLocalPoint,
  Point2D,
  Polygon2D,
  SlabGeometry,
} from "./types";

const MIN_SKEW_ANGLE_DEG = -90;
const MAX_SKEW_ANGLE_DEG = 90;

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`);
  }
}

function assertGeometry(geometry: SlabGeometry): void {
  assertFinite(geometry.lengthM, "Slab geometry lengthM");
  assertFinite(geometry.widthM, "Slab geometry widthM");
  assertFinite(geometry.thicknessM, "Slab geometry thicknessM");
  assertFinite(geometry.skewAngleDeg, "Slab geometry skewAngleDeg");

  if (geometry.lengthM <= 0) {
    throw new RangeError("Slab geometry lengthM must be greater than 0.");
  }
  if (geometry.widthM <= 0) {
    throw new RangeError("Slab geometry widthM must be greater than 0.");
  }
  if (geometry.thicknessM <= 0) {
    throw new RangeError("Slab geometry thicknessM must be greater than 0.");
  }
  if (
    geometry.skewAngleDeg <= MIN_SKEW_ANGLE_DEG ||
    geometry.skewAngleDeg >= MAX_SKEW_ANGLE_DEG
  ) {
    throw new RangeError(
      `Slab geometry skewAngleDeg must be greater than ${MIN_SKEW_ANGLE_DEG} and less than ${MAX_SKEW_ANGLE_DEG} degrees.`,
    );
  }
}

function assertLocalPoint(local: DeckLocalPoint): void {
  assertFinite(local.s, "Deck-local coordinate s");
  assertFinite(local.t, "Deck-local coordinate t");
}

function assertGlobalPoint(point: Point2D): void {
  assertFinite(point.x, "Global coordinate x");
  assertFinite(point.y, "Global coordinate y");
}

function normalizeZero(value: number): number {
  return value === 0 ? 0 : value;
}

function toRadians(skewAngleDeg: number): number {
  return (skewAngleDeg * Math.PI) / 180;
}

function getSkewTangent(geometry: SlabGeometry): number {
  return Math.tan(toRadians(geometry.skewAngleDeg));
}

function assertFiniteDerivedPoint(point: Point2D): Point2D {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError("Deck-coordinate transform produced a non-finite point.");
  }
  return {
    x: normalizeZero(point.x),
    y: normalizeZero(point.y),
  };
}

/**
 * Map oblique deck-local coordinates to the global Cartesian plane.
 *
 * This is a total affine map for finite coordinates. It deliberately neither
 * tests deck containment nor clamps points to the physical deck boundary.
 */
export function deckLocalToGlobal(
  geometry: SlabGeometry,
  local: DeckLocalPoint,
): Point2D {
  assertGeometry(geometry);
  assertLocalPoint(local);

  if (geometry.skewAngleDeg === 0) {
    return { x: normalizeZero(local.s), y: normalizeZero(local.t) };
  }

  return assertFiniteDerivedPoint({
    x:
      local.s +
      (local.t - geometry.widthM / 2) * getSkewTangent(geometry),
    y: local.t,
  });
}

/**
 * Map a global Cartesian point to oblique deck-local coordinates.
 *
 * This is a total affine map for finite coordinates. It deliberately neither
 * tests deck containment nor clamps points to the physical deck boundary.
 */
export function globalToDeckLocal(
  geometry: SlabGeometry,
  point: Point2D,
): DeckLocalPoint {
  assertGeometry(geometry);
  assertGlobalPoint(point);

  if (geometry.skewAngleDeg === 0) {
    return { s: normalizeZero(point.x), t: normalizeZero(point.y) };
  }

  const local = {
    s:
      point.x -
      (point.y - geometry.widthM / 2) * getSkewTangent(geometry),
    t: point.y,
  };
  if (!Number.isFinite(local.s) || !Number.isFinite(local.t)) {
    throw new RangeError("Deck-coordinate transform produced a non-finite point.");
  }
  return {
    s: normalizeZero(local.s),
    t: normalizeZero(local.t),
  };
}

/** Build the physical deck polygon in canonical counter-clockwise order. */
export function buildDeckPolygon(geometry: SlabGeometry): Polygon2D {
  assertGeometry(geometry);

  if (geometry.skewAngleDeg === 0) {
    return [
      { x: 0, y: 0 },
      { x: geometry.lengthM, y: 0 },
      { x: geometry.lengthM, y: geometry.widthM },
      { x: 0, y: geometry.widthM },
    ];
  }

  const halfOffset = (geometry.widthM * getSkewTangent(geometry)) / 2;
  const polygon = [
    { x: -halfOffset, y: 0 },
    { x: geometry.lengthM - halfOffset, y: 0 },
    { x: geometry.lengthM + halfOffset, y: geometry.widthM },
    { x: halfOffset, y: geometry.widthM },
  ];
  return polygon.map(assertFiniteDerivedPoint);
}

/** Return an edge segment directed along its canonical signed tangent. */
export function getDeckEdgeSegment(
  geometry: SlabGeometry,
  edge: DeckEdge,
): readonly [Point2D, Point2D] {
  const [startLower, endLower, endUpper, startUpper] =
    buildDeckPolygon(geometry);

  switch (edge) {
    case "start":
      return [startLower, startUpper];
    case "end":
      return [endLower, endUpper];
    case "lower-side":
      return [startLower, endLower];
    case "upper-side":
      return [startUpper, endUpper];
  }
}

/** Return exact rectangular bounds at zero skew and physical AABB otherwise. */
export function getDeckBounds(geometry: SlabGeometry): Aabb {
  assertGeometry(geometry);

  if (geometry.skewAngleDeg === 0) {
    return {
      xMin: 0,
      xMax: geometry.lengthM,
      yMin: 0,
      yMax: geometry.widthM,
    };
  }

  const halfOffsetMagnitude = Math.abs(getSupportOffset(geometry)) / 2;
  const bounds = {
    xMin: -halfOffsetMagnitude,
    xMax: geometry.lengthM + halfOffsetMagnitude,
    yMin: 0,
    yMax: geometry.widthM,
  };
  if (!Object.values(bounds).every(Number.isFinite)) {
    throw new RangeError("Deck bounds contain a non-finite value.");
  }
  return bounds;
}

/** Signed global-x offset across either skew support edge. */
export function getSupportOffset(geometry: SlabGeometry): number {
  assertGeometry(geometry);
  if (geometry.skewAngleDeg === 0) {
    return 0;
  }

  const offset = geometry.widthM * getSkewTangent(geometry);
  if (!Number.isFinite(offset)) {
    throw new RangeError("Support offset is non-finite.");
  }
  return normalizeZero(offset);
}

/** Perpendicular distance between the start and end support lines. */
export function getNormalSpan(geometry: SlabGeometry): number {
  assertGeometry(geometry);
  if (geometry.skewAngleDeg === 0) {
    return geometry.lengthM;
  }

  const span = geometry.lengthM * Math.cos(toRadians(geometry.skewAngleDeg));
  if (!Number.isFinite(span)) {
    throw new RangeError("Normal span is non-finite.");
  }
  return span;
}

/** Build the canonical segment, signed tangent, and unit boundary normals. */
export function getSupportAxes(
  geometry: SlabGeometry,
  edge: DeckEdge,
): DeckEdgeFrame {
  assertGeometry(geometry);
  const segment = getDeckEdgeSegment(geometry, edge);

  let tangent: Point2D;
  let inwardNormal: Point2D;
  let lengthM: number;

  if (edge === "lower-side" || edge === "upper-side") {
    tangent = { x: 1, y: 0 };
    inwardNormal = edge === "lower-side" ? { x: 0, y: 1 } : { x: 0, y: -1 };
    lengthM = geometry.lengthM;
  } else if (geometry.skewAngleDeg === 0) {
    tangent = { x: 0, y: 1 };
    inwardNormal = edge === "start" ? { x: 1, y: 0 } : { x: -1, y: 0 };
    lengthM = geometry.widthM;
  } else {
    const angleRad = toRadians(geometry.skewAngleDeg);
    const increasingTTangent = {
      x: Math.sin(angleRad),
      y: Math.cos(angleRad),
    };
    const increasingSpanNormal = {
      x: increasingTTangent.y,
      y: -increasingTTangent.x,
    };
    tangent = increasingTTangent;
    inwardNormal =
      edge === "start"
        ? increasingSpanNormal
        : { x: -increasingSpanNormal.x, y: -increasingSpanNormal.y };
    lengthM = geometry.widthM / increasingTTangent.y;
  }

  if (!Number.isFinite(lengthM)) {
    throw new RangeError("Deck edge length is non-finite.");
  }

  const normalizedTangent = {
    x: normalizeZero(tangent.x),
    y: normalizeZero(tangent.y),
  };
  const normalizedInwardNormal = {
    x: normalizeZero(inwardNormal.x),
    y: normalizeZero(inwardNormal.y),
  };

  return {
    edge,
    segment,
    tangent: normalizedTangent,
    inwardNormal: normalizedInwardNormal,
    outwardNormal: {
      x: normalizeZero(-normalizedInwardNormal.x),
      y: normalizeZero(-normalizedInwardNormal.y),
    },
    lengthM,
  };
}
