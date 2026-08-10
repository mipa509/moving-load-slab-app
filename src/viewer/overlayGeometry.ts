import type { SlabModel } from "../app/types";
import { clipConvexPolygons } from "../solver/geometry/convexPolygon";
import { buildDeckPolygon, deckLocalToGlobal } from "../solver/geometry/deckCoordinates";
import type { DeckLocalPoint, Point2D } from "../solver/geometry/types";

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

/**
 * Deck-local (s/t) section-strip BAND polygon (WP-041A), mapped to global
 * `{x,y}` via `deckLocalToGlobal`. Unlike `computeSectionStripPolygon` above
 * (which clips a legacy global-XY rectangle to the deck), this builds the
 * strip band directly in deck-local coordinates first, then maps its four
 * corners to global XY — so at non-zero skew the strip follows the sheared
 * deck (its global-x corners shift with the skew offset) rather than staying
 * axis-aligned in global XY.
 *
 * - `mode: 'longitudinal'`: `t` ranges over `[centerTM - widthM/2, centerTM +
 *   widthM/2]` clamped to `[0, geometry.widthM]`, spanning the full deck-local
 *   `s` extent `[0, geometry.lengthM]`.
 * - `mode: 'transverse'`: `s` ranges over `[centerSM - widthM/2, centerSM +
 *   widthM/2]` clamped to `[0, geometry.lengthM]`, spanning the full
 *   deck-local `t` extent `[0, geometry.widthM]`.
 *
 * At zero skew `deckLocalToGlobal` is the identity map, so this reproduces
 * the same rectangle the legacy strip drew for an equivalent centre/width.
 *
 * Pure and total: returns `null` when `model.deckSection` is absent, the
 * requested band is degenerate (zero or negative width after clamping to the
 * deck's s/t extent), or the geometry/mapping is momentarily invalid
 * (guarded with try/catch, mirroring `computeSectionStripPolygon`).
 */
export function computeDeckSectionStripPolygon(model: SlabModel): Point2D[] | null {
  const deckSection = model.deckSection;
  if (!deckSection) {
    return null;
  }

  try {
    const lengthM = model.geometry.lengthM;
    const widthM = model.geometry.widthM;
    const halfStrip = deckSection.widthM / 2;

    let corners: DeckLocalPoint[];
    if (deckSection.mode === "longitudinal") {
      const tLo = Math.max(0, deckSection.centerTM - halfStrip);
      const tHi = Math.min(widthM, deckSection.centerTM + halfStrip);
      if (tHi - tLo <= 0) {
        return null;
      }
      corners = [
        { s: 0, t: tLo },
        { s: lengthM, t: tLo },
        { s: lengthM, t: tHi },
        { s: 0, t: tHi },
      ];
    } else {
      const sLo = Math.max(0, deckSection.centerSM - halfStrip);
      const sHi = Math.min(lengthM, deckSection.centerSM + halfStrip);
      if (sHi - sLo <= 0) {
        return null;
      }
      corners = [
        { s: sLo, t: 0 },
        { s: sHi, t: 0 },
        { s: sHi, t: widthM },
        { s: sLo, t: widthM },
      ];
    }

    return corners.map((corner) => deckLocalToGlobal(model.geometry, corner));
  } catch {
    return null;
  }
}

/** Maps `{xM,yM}` overlay points (e.g. `WheelPatchOverlay` polygons) to the
 * `{x,y}` shape used by the viewer's polygon-fill builders. */
export function toXY(points: Array<{ xM: number; yM: number }>): Point2D[] {
  return points.map((point) => ({ x: point.xM, y: point.yM }));
}
