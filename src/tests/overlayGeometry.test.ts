import { describe, expect, it } from "vitest";
import { createDefaultModel } from "../app/defaults";
import type { SlabModel } from "../app/types";
import { computeSectionStripPolygon, toXY } from "../viewer/overlayGeometry";
import { classifyPointInConvexPolygon, polygonArea } from "../solver/geometry/convexPolygon";
import { buildDeckPolygon } from "../solver/geometry/deckCoordinates";

describe("computeSectionStripPolygon - zero skew", () => {
  it("returns a rectangle strip equal to the legacy sectionRect corners", () => {
    const model = createDefaultModel();
    // createDefaultModel(): geometry 10x5, skew 0, section {auto, centerPerpM 2.5, widthM 1.0},
    // placement.travelDirection "x+" -> the legacy axis-auto selection picks the
    // longitudinal (x-axis) strip: xMin=0, xMax=Lx, y clamped to [centerPerpM-0.5, centerPerpM+0.5].
    const Lx = model.geometry.lengthM;
    const halfStrip = model.section.widthM / 2;
    const expectedYMin = Math.max(0, model.section.centerPerpM - halfStrip);
    const expectedYMax = Math.min(model.geometry.widthM, model.section.centerPerpM + halfStrip);

    const polygon = computeSectionStripPolygon(model);

    expect(polygon).not.toBeNull();
    expect(polygon).toHaveLength(4);
    const tolerance = 1e-9;
    const expectedCorners = [
      { x: 0, y: expectedYMin },
      { x: Lx, y: expectedYMin },
      { x: Lx, y: expectedYMax },
      { x: 0, y: expectedYMax },
    ];
    for (let index = 0; index < expectedCorners.length; index += 1) {
      expect(polygon![index].x).toBeCloseTo(expectedCorners[index].x, 9);
      expect(polygon![index].y).toBeCloseTo(expectedCorners[index].y, 9);
    }
    expect(polygonArea(polygon)).toBeCloseTo(Lx * (expectedYMax - expectedYMin), tolerance);
  });
});

describe("computeSectionStripPolygon - 19deg skew", () => {
  it("clips a longitudinal (x-axis) strip to the physical skewed deck polygon", () => {
    const base = createDefaultModel();
    const model: SlabModel = {
      ...base,
      geometry: { ...base.geometry, skewAngleDeg: 19 },
    };
    // Same longitudinal strip settings as the zero-skew case (axis auto,
    // travelDirection x+), so the unclipped legacy rectangle is unchanged:
    // x in [0, Lx], y in [centerPerpM-0.5, centerPerpM+0.5].
    const Lx = model.geometry.lengthM;
    const halfStrip = model.section.widthM / 2;
    const unclippedYMin = Math.max(0, model.section.centerPerpM - halfStrip);
    const unclippedYMax = Math.min(model.geometry.widthM, model.section.centerPerpM + halfStrip);
    const unclippedArea = Lx * (unclippedYMax - unclippedYMin);

    const polygon = computeSectionStripPolygon(model);

    expect(polygon).not.toBeNull();
    expect(polygon!.length).toBeGreaterThanOrEqual(3);

    const deckPolygon = buildDeckPolygon(model.geometry);
    for (const vertex of polygon!) {
      const location = classifyPointInConvexPolygon(vertex, deckPolygon);
      expect(location).not.toBe("outside");
    }

    expect(polygonArea(polygon)).toBeLessThanOrEqual(unclippedArea + 1e-9);
  });
});

describe("computeSectionStripPolygon - strip far outside the deck", () => {
  it("returns null when the requested strip centre is far outside the deck extent", () => {
    const base = createDefaultModel();
    const model: SlabModel = {
      ...base,
      section: { ...base.section, centerPerpM: 1000 },
    };

    expect(computeSectionStripPolygon(model)).toBeNull();
  });
});

describe("toXY", () => {
  it("maps xM/yM overlay points to x/y points", () => {
    expect(
      toXY([
        { xM: 1, yM: 2 },
        { xM: 3.5, yM: -4.25 },
      ]),
    ).toEqual([
      { x: 1, y: 2 },
      { x: 3.5, y: -4.25 },
    ]);
  });

  it("returns an empty array for an empty input", () => {
    expect(toXY([])).toEqual([]);
  });
});
