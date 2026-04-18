import { describe, expect, it } from "vitest";
import { buildSupportVisuals } from "../viewer/supportPresentation";
import type { Support } from "../app/types";

describe("support presentation", () => {
  it("builds point-support visuals with one glyph and chip states", () => {
    const supports: Support[] = [
      {
        id: "P1",
        name: "Point",
        kind: "point",
        x: 2,
        y: 3,
        constraints: {
          uz: { type: "fixed" },
          rx: { type: "spring", stiffness: 1000 },
          ry: { type: "free" },
        },
      },
    ];

    const visuals = buildSupportVisuals(supports);

    expect(visuals).toHaveLength(1);
    expect(visuals[0]).toMatchObject({
      id: "P1",
      kind: "point",
      anchor: [2, 3],
      glyphAnchors: [[2, 3]],
    });
    expect(visuals[0].chips).toEqual([
      { dof: "uz", label: "UZ", tone: "fixed" },
      { dof: "rx", label: "RX", tone: "spring" },
      { dof: "ry", label: "RY", tone: "free" },
    ]);
  });

  it("builds line-support visuals with repeated glyph anchors", () => {
    const supports: Support[] = [
      {
        id: "L1",
        name: "Line",
        kind: "line",
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 5,
        constraints: {
          uz: { type: "fixed" },
          rx: { type: "free" },
          ry: { type: "free" },
        },
      },
    ];

    const visuals = buildSupportVisuals(supports);

    expect(visuals[0].kind).toBe("line");
    expect(visuals[0].glyphAnchors.length).toBeGreaterThan(1);
    expect(visuals[0].linePoints).toEqual([
      [0, 0],
      [0, 5],
    ]);
  });
});
