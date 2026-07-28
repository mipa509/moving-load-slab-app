import { describe, expect, it } from "vitest";
import { createDefaultModel } from "../app/defaults";
import type { DeckSectionSettings, SlabModel } from "../app/types";
import {
  computeDeckSectionStripPolygon,
  computeSectionStripPolygon,
  toXY,
} from "../viewer/overlayGeometry";
import { classifyPointInConvexPolygon, polygonArea } from "../solver/geometry/convexPolygon";
import { buildDeckPolygon, deckLocalToGlobal } from "../solver/geometry/deckCoordinates";

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

describe("computeDeckSectionStripPolygon - zero skew", () => {
  it("returns the expected longitudinal rectangle band from model.deckSection", () => {
    const model = createDefaultModel();
    // createDefaultModel(): deckSection {longitudinal, mx, centerTM 2.5, widthM 1},
    // geometry 10x5, skew 0 -> deckLocalToGlobal is the identity map, so the
    // band is s in [0, lengthM], t in [centerTM - 0.5, centerTM + 0.5].
    const deckSection = model.deckSection as Extract<
      DeckSectionSettings,
      { mode: "longitudinal" }
    >;
    const lengthM = model.geometry.lengthM;
    const halfStrip = deckSection.widthM / 2;
    const tLo = deckSection.centerTM - halfStrip;
    const tHi = deckSection.centerTM + halfStrip;

    const polygon = computeDeckSectionStripPolygon(model);

    expect(polygon).not.toBeNull();
    expect(polygon).toHaveLength(4);
    const expectedCorners = [
      { x: 0, y: tLo },
      { x: lengthM, y: tLo },
      { x: lengthM, y: tHi },
      { x: 0, y: tHi },
    ];
    for (let index = 0; index < expectedCorners.length; index += 1) {
      expect(polygon![index].x).toBeCloseTo(expectedCorners[index].x, 9);
      expect(polygon![index].y).toBeCloseTo(expectedCorners[index].y, 9);
    }
    expect(polygonArea(polygon)).toBeCloseTo(lengthM * (tHi - tLo), 1e-9);
  });

  it("returns the expected transverse rectangle band from model.deckSection", () => {
    const base = createDefaultModel();
    const model: SlabModel = {
      ...base,
      deckSection: {
        mode: "transverse",
        ordinate: "my",
        centerSM: 5,
        widthM: 2,
      },
    };
    const widthM = model.geometry.widthM;

    const polygon = computeDeckSectionStripPolygon(model);

    expect(polygon).not.toBeNull();
    expect(polygon).toHaveLength(4);
    const expectedCorners = [
      { x: 4, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: widthM },
      { x: 4, y: widthM },
    ];
    for (let index = 0; index < expectedCorners.length; index += 1) {
      expect(polygon![index].x).toBeCloseTo(expectedCorners[index].x, 9);
      expect(polygon![index].y).toBeCloseTo(expectedCorners[index].y, 9);
    }
  });
});

describe("computeDeckSectionStripPolygon - 19deg skew", () => {
  it("produces a non-null band whose vertices lie on/inside the skewed deck and follow the skew", () => {
    const base = createDefaultModel();
    const model: SlabModel = {
      ...base,
      geometry: { ...base.geometry, skewAngleDeg: 19 },
    };
    const deckSection = model.deckSection as Extract<
      DeckSectionSettings,
      { mode: "longitudinal" }
    >;
    const lengthM = model.geometry.lengthM;
    const halfStrip = deckSection.widthM / 2;
    const tLo = deckSection.centerTM - halfStrip;
    const tHi = deckSection.centerTM + halfStrip;

    const polygon = computeDeckSectionStripPolygon(model);

    expect(polygon).not.toBeNull();
    expect(polygon).toHaveLength(4);

    const deckPolygon = buildDeckPolygon(model.geometry);
    for (const vertex of polygon!) {
      const location = classifyPointInConvexPolygon(vertex, deckPolygon);
      expect(location).not.toBe("outside");
    }

    // The strip follows the skewed deck: corners map via deckLocalToGlobal
    // rather than staying axis-aligned, so the bottom edge (t = tLo) and top
    // edge (t = tHi) of the band are shifted by different global-x offsets.
    const expectedBottomLeft = deckLocalToGlobal(model.geometry, { s: 0, t: tLo });
    const expectedBottomRight = deckLocalToGlobal(model.geometry, { s: lengthM, t: tLo });
    const expectedTopRight = deckLocalToGlobal(model.geometry, { s: lengthM, t: tHi });
    const expectedTopLeft = deckLocalToGlobal(model.geometry, { s: 0, t: tHi });

    expect(polygon![0].x).toBeCloseTo(expectedBottomLeft.x, 9);
    expect(polygon![1].x).toBeCloseTo(expectedBottomRight.x, 9);
    expect(polygon![2].x).toBeCloseTo(expectedTopRight.x, 9);
    expect(polygon![3].x).toBeCloseTo(expectedTopLeft.x, 9);

    // The skew shears the band: the top edge is offset from the bottom edge
    // by a nonzero amount driven by the skew angle.
    expect(polygon![3].x - polygon![0].x).not.toBeCloseTo(0, 6);
    expect(polygon![3].x - polygon![0].x).toBeCloseTo(polygon![2].x - polygon![1].x, 9);
  });
});

describe("computeDeckSectionStripPolygon - degenerate/absent input", () => {
  it("returns null when model.deckSection is absent", () => {
    const base = createDefaultModel();
    const model: SlabModel = { ...base, deckSection: undefined };

    expect(computeDeckSectionStripPolygon(model)).toBeNull();
  });

  it("returns null for a zero-width longitudinal strip", () => {
    const base = createDefaultModel();
    const model: SlabModel = {
      ...base,
      deckSection: { mode: "longitudinal", ordinate: "mx", centerTM: 2.5, widthM: 0 },
    };

    expect(computeDeckSectionStripPolygon(model)).toBeNull();
  });

  it("returns null for a zero-width transverse strip", () => {
    const base = createDefaultModel();
    const model: SlabModel = {
      ...base,
      deckSection: { mode: "transverse", ordinate: "my", centerSM: 5, widthM: 0 },
    };

    expect(computeDeckSectionStripPolygon(model)).toBeNull();
  });

  it("returns null when the requested strip centre is far outside the deck extent", () => {
    const base = createDefaultModel();
    const model: SlabModel = {
      ...base,
      deckSection: { mode: "longitudinal", ordinate: "mx", centerTM: 1000, widthM: 1 },
    };

    expect(computeDeckSectionStripPolygon(model)).toBeNull();
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
