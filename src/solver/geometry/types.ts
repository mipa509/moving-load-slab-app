/** Global Cartesian point in metres unless a containing field states otherwise. */
export interface Point2D {
  x: number;
  y: number;
}

/** Counter-clockwise physical polygon without a repeated closing vertex. */
export type Polygon2D = Point2D[];

/** Axis-aligned broad-phase bounds in global metres. */
export interface Aabb {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export type DeckEdge = "start" | "end" | "lower-side" | "upper-side";

/** Normalized slab geometry consumed by skew-capable kernels. */
export interface SlabGeometry {
  lengthM: number;
  widthM: number;
  thicknessM: number;
  skewAngleDeg: number;
}

export interface DeckLocalPoint {
  s: number;
  t: number;
}

export interface DeckEdgeFrame {
  edge: DeckEdge;
  segment: readonly [Point2D, Point2D];
  tangent: Point2D;
  inwardNormal: Point2D;
  outwardNormal: Point2D;
  lengthM: number;
}
