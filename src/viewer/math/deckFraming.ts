/**
 * Pure, viewer-local geometry helpers for framing a (possibly skewed) deck.
 *
 * The 3D viewer historically framed the camera and probe plane on the
 * rectangle `lengthM x widthM`, which under-covers a skewed deck (its
 * global-x extent is `lengthM + widthM * |tan(skewAngleDeg)|`, and part of
 * the rectangle lies outside the actual parallelogram). These helpers let
 * the viewer frame on the deck's real axis-aligned bounds and reject probe
 * hits that land outside the true deck polygon.
 */

export interface DeckBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface DeckFraming {
  centerX: number;
  centerY: number;
  spanX: number;
  spanY: number;
  maxSpan: number;
}

/** Derive camera/probe framing (center, spans) from axis-aligned deck bounds. */
export function computeDeckFraming(bounds: DeckBounds): DeckFraming {
  const spanX = bounds.xMax - bounds.xMin;
  const spanY = bounds.yMax - bounds.yMin;
  return {
    centerX: (bounds.xMin + bounds.xMax) / 2,
    centerY: (bounds.yMin + bounds.yMax) / 2,
    spanX,
    spanY,
    maxSpan: Math.max(spanX, spanY),
  };
}

/**
 * Robust point-in-polygon test for a convex polygon of either winding order
 * (clockwise or counter-clockwise), using a sign-of-cross-product method: a
 * point is inside iff it lies on the same side of every directed edge. A
 * point within `tolerance` (perpendicular distance, in the polygon's own
 * units) of an edge line is treated as on-edge, and on-edge counts as
 * inside.
 */
export function pointInConvexPolygon(
  x: number,
  y: number,
  polygon: Array<{ x: number; y: number }>,
  tolerance = 1e-9,
): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let sawPositive = false;
  let sawNegative = false;

  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const edgeX = b.x - a.x;
    const edgeY = b.y - a.y;
    const edgeLength = Math.hypot(edgeX, edgeY);

    if (edgeLength === 0) {
      continue; // degenerate (repeated-vertex) edge contributes no constraint
    }

    const toPointX = x - a.x;
    const toPointY = y - a.y;
    const cross = edgeX * toPointY - edgeY * toPointX;
    const signedPerpDistance = cross / edgeLength;

    if (Math.abs(signedPerpDistance) <= tolerance) {
      continue; // on the edge line within tolerance: treat as inside
    }

    if (signedPerpDistance > 0) {
      sawPositive = true;
    } else {
      sawNegative = true;
    }

    if (sawPositive && sawNegative) {
      return false;
    }
  }

  return true;
}
