import type { Point2D } from "../geometry/types";

/**
 * Symmetric plate moment tensor in orthonormal global roadway axes.
 * `mxy` is the twisting moment; the tensor is `[[mx, mxy], [mxy, my]]`.
 */
export interface PlateMomentTensor {
  mx: number;
  my: number;
  mxy: number;
}

/** Plate moments resolved onto an orthonormal normal/tangent axis pair. */
export interface TransformedMoments {
  /** Bending moment on the face whose outward normal is the axis normal. */
  mNN: number;
  /** Bending moment on the face whose normal is the axis tangent. */
  mTT: number;
  /** Twisting moment in the normal/tangent frame. */
  mNT: number;
}

/** An orthonormal in-plane frame: unit `normal`, unit `tangent`, and normal angle. */
export interface OrthonormalFrame {
  normal: Point2D;
  tangent: Point2D;
  /** Angle of `normal` from global x, radians. */
  angleRad: number;
}

/**
 * Rotate the symmetric plate moment tensor onto axes whose normal is at
 * `angleRad` from global x. This is a genuine orthonormal tensor rotation and
 * must never be applied using oblique deck `(s, t)` parameters as if they were
 * Cartesian axes. The components are invariant under a normal sign flip
 * (`normal -> -normal`).
 */
export function transformMomentTensor(
  moments: PlateMomentTensor,
  angleRad: number,
): TransformedMoments {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  const cc = c * c;
  const ss = s * s;
  const cs = c * s;
  const { mx, my, mxy } = moments;
  return {
    mNN: mx * cc + my * ss + 2 * mxy * cs,
    mTT: mx * ss + my * cc - 2 * mxy * cs,
    mNT: (my - mx) * cs + mxy * (cc - ss),
  };
}

/**
 * Build an orthonormal normal/tangent frame from a support edge segment. The
 * tangent runs along the edge; the normal is the in-plane perpendicular. Both
 * are unit vectors, so a skew (inclined) support edge yields proper Cartesian
 * axes rather than the oblique deck parameters.
 *
 * `normal` is always the tangent rotated -90 degrees; it is not guaranteed to be
 * the inward vs outward normal for a given edge. This does not affect the moment
 * components (`mNN/mTT/mNT` are invariant under a normal sign flip), but a
 * consumer that needs a directed normal (e.g. a polar reaction) must orient it.
 */
export function supportAxisFrame(start: Point2D, end: Point2D): OrthonormalFrame {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length === 0) {
    throw new Error("Support axis frame requires a non-degenerate (non zero-length) edge.");
  }
  const tangent: Point2D = { x: dx / length, y: dy / length };
  const normal: Point2D = { x: tangent.y, y: -tangent.x };
  return { normal, tangent, angleRad: Math.atan2(normal.y, normal.x) };
}

/** Resolve plate moments onto a support edge's orthonormal normal/tangent axes. */
export function transformMomentsToSupportAxes(
  moments: PlateMomentTensor,
  start: Point2D,
  end: Point2D,
): TransformedMoments {
  const frame = supportAxisFrame(start, end);
  return transformMomentTensor(moments, frame.angleRad);
}
