import type { SlabModel } from "../app/types";
import { clipConvexPolygons } from "../solver/geometry/convexPolygon";
import { buildDeckPolygon } from "../solver/geometry/deckCoordinates";
import type { Point2D } from "../solver/geometry/types";

/**
 * Reproduces the legacy (pre-WP-043) section-strip RECTANGLE selection from
 * `model.section` (axis auto/x/y + `centerPerpM` + `widthM`), then clips that
 * rectangle to the real (possibly skewed) deck polygon.
 *
 * At zero skew the deck polygon IS the `[0,Lx] x [0,Ly]` rectangle, so the
 * clip is a no-op and this returns the same strip the legacy code drew. At
 * non-zero skew the legacy rectangle still spans the full nominal `Lx`/`Ly`
 * extent (it only clamps to those bounds, not the true parallelogram), so
 * clipping trims it down to the physical deck's skewed corners.
 *
 * Pure and total: returns `null` for a degenerate (zero-area) strip, a strip
 * that clips away entirely outside the deck, or if `model.geometry` is
 * momentarily invalid (guarded with try/catch, mirroring the SlabScene
 * pattern for a mid-edit geometry).
 */
export function computeSectionStripPolygon(model: SlabModel): Point2D[] | null {
  try {
    const Lx = model.geometry.lengthM;
    const Ly = model.geometry.widthM;
    const sectionAxisIsX =
      model.section.axis === "x" ||
      (model.section.axis === "auto" &&
        (model.placement.travelDirection === "x+" ||
          model.placement.travelDirection === "x-"));
    const halfStrip = model.section.widthM / 2;
    const sectionRect = sectionAxisIsX
      ? {
          xMin: 0,
          xMax: Lx,
          yMin: Math.max(0, model.section.centerPerpM - halfStrip),
          yMax: Math.min(Ly, model.section.centerPerpM + halfStrip),
        }
      : {
          xMin: Math.max(0, model.section.centerPerpM - halfStrip),
          xMax: Math.min(Lx, model.section.centerPerpM + halfStrip),
          yMin: 0,
          yMax: Ly,
        };

    const sectionWidth = sectionRect.xMax - sectionRect.xMin;
    const sectionHeight = sectionRect.yMax - sectionRect.yMin;
    if (sectionWidth <= 0 || sectionHeight <= 0) {
      return null;
    }

    const rectPolygon: Point2D[] = [
      { x: sectionRect.xMin, y: sectionRect.yMin },
      { x: sectionRect.xMax, y: sectionRect.yMin },
      { x: sectionRect.xMax, y: sectionRect.yMax },
      { x: sectionRect.xMin, y: sectionRect.yMax },
    ];

    const deckPolygon = buildDeckPolygon(model.geometry);
    return clipConvexPolygons(rectPolygon, deckPolygon);
  } catch {
    return null;
  }
}

/** Maps `{xM,yM}` overlay points (e.g. `WheelPatchOverlay` polygons) to the
 * `{x,y}` shape used by the viewer's polygon-fill builders. */
export function toXY(points: Array<{ xM: number; yM: number }>): Point2D[] {
  return points.map((point) => ({ x: point.xM, y: point.yM }));
}
