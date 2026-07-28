import { describe, expect, it } from "vitest";
import {
  buildPresetSupports,
  describeSkewSign,
  presetConstraints,
} from "../app/supportPresets";
import { createDefaultModel } from "../app/defaults";
import { fromAppModel } from "../solver/model/fromAppModel";
import { getDeckEdgeSegment } from "../solver/geometry/deckCoordinates";
import type { SlabGeometry, SlabModel } from "../app/types";

function geometryAt(skewAngleDeg: number): SlabGeometry {
  return { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg };
}

describe("presetConstraints", () => {
  it("fixed-fixed fixes uz, rx and ry", () => {
    expect(presetConstraints("fixed-fixed")).toEqual({
      uz: { type: "fixed" },
      rx: { type: "fixed" },
      ry: { type: "fixed" },
    });
  });

  it("pinned-pinned fixes only uz, leaving rx/ry free", () => {
    expect(presetConstraints("pinned-pinned")).toEqual({
      uz: { type: "fixed" },
      rx: { type: "free" },
      ry: { type: "free" },
    });
  });
});

describe("buildPresetSupports", () => {
  it("at zero skew, builds two line supports at x=0 and x=lengthM spanning y 0..widthM", () => {
    const geometry = geometryAt(0);
    const supports = buildPresetSupports(geometry, "fixed-fixed");

    expect(supports).toHaveLength(2);
    const [start, end] = supports;

    expect(start.kind).toBe("line");
    expect(end.kind).toBe("line");
    if (start.kind !== "line" || end.kind !== "line") {
      throw new Error("expected line supports at zero skew");
    }

    expect(start.x1).toBe(0);
    expect(start.x2).toBe(0);
    expect(start.y1).toBe(0);
    expect(start.y2).toBe(geometry.widthM);

    expect(end.x1).toBe(geometry.lengthM);
    expect(end.x2).toBe(geometry.lengthM);
    expect(end.y1).toBe(0);
    expect(end.y2).toBe(geometry.widthM);

    expect(start.constraints).toEqual(presetConstraints("fixed-fixed"));
    expect(end.constraints).toEqual(presetConstraints("fixed-fixed"));
  });

  it("at 19 deg skew, builds two edge supports identified as 'start' and 'end'", () => {
    const geometry = geometryAt(19);
    const supports = buildPresetSupports(geometry, "pinned-pinned");

    expect(supports).toHaveLength(2);
    const [start, end] = supports;

    expect(start.kind).toBe("edge");
    expect(end.kind).toBe("edge");
    if (start.kind !== "edge" || end.kind !== "edge") {
      throw new Error("expected edge supports at non-zero skew");
    }

    expect(start.edge).toBe("start");
    expect(end.edge).toBe("end");
    expect(start.constraints).toEqual(presetConstraints("pinned-pinned"));
    expect(end.constraints).toEqual(presetConstraints("pinned-pinned"));
  });

  it("returns exactly 2 supports with fixed-fixed constraints matching the preset, at any skew", () => {
    for (const skewAngleDeg of [0, 19, -19]) {
      const supports = buildPresetSupports(geometryAt(skewAngleDeg), "fixed-fixed");
      expect(supports).toHaveLength(2);
      for (const support of supports) {
        expect(support.constraints).toEqual({
          uz: { type: "fixed" },
          rx: { type: "fixed" },
          ry: { type: "fixed" },
        });
      }
    }
  });

  it("returns exactly 2 supports with pinned-pinned constraints matching the preset, at any skew", () => {
    for (const skewAngleDeg of [0, 19, -19]) {
      const supports = buildPresetSupports(geometryAt(skewAngleDeg), "pinned-pinned");
      expect(supports).toHaveLength(2);
      for (const support of supports) {
        expect(support.constraints).toEqual({
          uz: { type: "fixed" },
          rx: { type: "free" },
          ry: { type: "free" },
        });
      }
    }
  });

  it("gives each preset support a distinct id/name (S1 start / S2 end)", () => {
    const supports = buildPresetSupports(geometryAt(19), "fixed-fixed");
    expect(supports[0].id).toBe("S1");
    expect(supports[0].name).toBe("Start edge");
    expect(supports[1].id).toBe("S2");
    expect(supports[1].name).toBe("End edge");
  });
});

describe("describeSkewSign", () => {
  it("returns distinct strings for positive, negative and zero skew", () => {
    const positive = describeSkewSign(19);
    const negative = describeSkewSign(-19);
    const zero = describeSkewSign(0);

    expect(positive).not.toBe(negative);
    expect(positive).not.toBe(zero);
    expect(negative).not.toBe(zero);
    expect(positive).toMatch(/positive/i);
    expect(negative).toMatch(/negative/i);
    expect(zero).toMatch(/no skew/i);
  });
});

describe("buildPresetSupports migration through fromAppModel (solvability)", () => {
  it("translates 19 deg edge presets to inclined line SupportDefinitions matching the canonical deck edges", () => {
    const base = createDefaultModel();
    const geometry = geometryAt(19);
    const model: SlabModel = {
      ...base,
      geometry,
      supports: buildPresetSupports(geometry, "fixed-fixed"),
    };

    const internalModel = fromAppModel(model);
    expect(internalModel.supports).toHaveLength(2);

    const [expectedStartP0, expectedStartP1] = getDeckEdgeSegment(geometry, "start");
    const [expectedEndP0, expectedEndP1] = getDeckEdgeSegment(geometry, "end");

    const [startDef, endDef] = internalModel.supports;

    expect(startDef.kind).toBe("line");
    expect(endDef.kind).toBe("line");
    if (startDef.kind !== "line" || endDef.kind !== "line") {
      throw new Error("expected line SupportDefinitions");
    }

    expect(startDef.x1).toBe(expectedStartP0.x);
    expect(startDef.y1).toBe(expectedStartP0.y);
    expect(startDef.x2).toBe(expectedStartP1.x);
    expect(startDef.y2).toBe(expectedStartP1.y);
    expect(startDef.behavior).toBe("custom");
    expect(startDef.dofs).toEqual({
      w: { kind: "fixed" },
      rx: { kind: "fixed" },
      ry: { kind: "fixed" },
    });

    expect(endDef.x1).toBe(expectedEndP0.x);
    expect(endDef.y1).toBe(expectedEndP0.y);
    expect(endDef.x2).toBe(expectedEndP1.x);
    expect(endDef.y2).toBe(expectedEndP1.y);
  });
});
