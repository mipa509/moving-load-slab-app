import { describe, expect, it } from "vitest";
import {
  computeDeckFraming,
  pointInConvexPolygon,
  type DeckBounds,
} from "../viewer/math/deckFraming";
import { buildDeckPolygon, getDeckBounds } from "../solver/geometry/deckCoordinates";
import { normalizeSolverGeometry } from "../solver/model/fromAppModel";
import { deckLocalToGlobal } from "../solver/geometry/deckCoordinates";
import { createDefaultModel } from "../app/defaults";
import { runFixedPositionAnalysis } from "../solver";
import type { SlabGeometry, SlabModel } from "../app/types";

/**
 * WP-042 coverage: the 3D viewer's camera/probe framing must be based on the
 * deck's real (possibly skewed) bounds/polygon rather than the
 * `lengthM x widthM` rectangle, which under-covers a skewed deck.
 */

describe("computeDeckFraming", () => {
  it("frames a zero-skew rectangle: centre, spans and maxSpan", () => {
    const bounds: DeckBounds = { xMin: 0, xMax: 10, yMin: 0, yMax: 5 };
    const framing = computeDeckFraming(bounds);

    expect(framing.centerX).toBe(5);
    expect(framing.centerY).toBe(2.5);
    expect(framing.spanX).toBe(10);
    expect(framing.spanY).toBe(5);
    expect(framing.maxSpan).toBe(10);
  });

  it("widens spanX for a skewed deck's bounding box relative to lengthM", () => {
    const geometry: SlabGeometry = {
      lengthM: 10,
      widthM: 5,
      thicknessM: 0.4,
      skewAngleDeg: 19,
    };
    const bounds = getDeckBounds(geometry);
    const framing = computeDeckFraming(bounds);

    // spanX = lengthM + widthM * |tan(theta)| > lengthM at non-zero skew.
    expect(framing.spanX).toBeGreaterThan(geometry.lengthM);
    expect(framing.spanX).toBeCloseTo(
      geometry.lengthM + geometry.widthM * Math.abs(Math.tan((19 * Math.PI) / 180)),
      10,
    );
    expect(framing.spanY).toBe(geometry.widthM);
    expect(framing.maxSpan).toBe(framing.spanX);
  });

  it("frames a long, narrow deck (spanX dominates maxSpan)", () => {
    const bounds: DeckBounds = { xMin: 0, xMax: 40, yMin: 0, yMax: 4 };
    const framing = computeDeckFraming(bounds);

    expect(framing.maxSpan).toBe(40);
    expect(framing.centerX).toBe(20);
    expect(framing.centerY).toBe(2);
  });

  it("frames a wide, short deck (spanY dominates maxSpan)", () => {
    const bounds: DeckBounds = { xMin: 0, xMax: 4, yMin: 0, yMax: 40 };
    const framing = computeDeckFraming(bounds);

    expect(framing.maxSpan).toBe(40);
  });

  it("reproduces the exact pre-WP-042 zero-skew framing values", () => {
    const lengthM = 10;
    const widthM = 5;
    const geometry: SlabGeometry = { lengthM, widthM, thicknessM: 0.4, skewAngleDeg: 0 };
    const framing = computeDeckFraming(getDeckBounds(geometry));

    expect(framing.centerX).toBe(lengthM / 2);
    expect(framing.centerY).toBe(widthM / 2);
    expect(framing.maxSpan).toBe(Math.max(lengthM, widthM));
  });
});

describe("pointInConvexPolygon", () => {
  it("treats a zero-skew rectangle's corners as inside and an outside point as outside", () => {
    const geometry: SlabGeometry = { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 };
    const polygon = buildDeckPolygon(geometry);

    for (const corner of polygon) {
      expect(pointInConvexPolygon(corner.x, corner.y, polygon)).toBe(true);
    }
    expect(pointInConvexPolygon(-1, 2, polygon)).toBe(false);
  });

  it("accepts the centre and all four vertices of a 19-degree deck polygon", () => {
    const geometry: SlabGeometry = { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 19 };
    const polygon = buildDeckPolygon(geometry);
    const framing = computeDeckFraming(getDeckBounds(geometry));

    expect(pointInConvexPolygon(framing.centerX, framing.centerY, polygon)).toBe(true);

    for (const vertex of polygon) {
      expect(pointInConvexPolygon(vertex.x, vertex.y, polygon)).toBe(true);
    }
  });

  it("rejects a point over the bounding box but outside the inclined start edge", () => {
    const geometry: SlabGeometry = { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 19 };
    const polygon = buildDeckPolygon(geometry);

    // The "start" edge runs from (s=0,t=0) to (s=0,t=widthM); at a given y
    // it sits well inside the deck's overall bounding-box x-extent because
    // the polygon is a parallelogram, not a rectangle. Probe a point a
    // fixed distance to the left of the edge's x-position at that height,
    // guaranteed outside the polygon but inside the AABB for interior y.
    const start = deckLocalToGlobal(geometry, { s: 0, t: 1 });
    const outside = { x: start.x - 0.5, y: start.y };
    expect(pointInConvexPolygon(outside.x, outside.y, polygon)).toBe(false);

    // Sanity: the same y just to the right of the edge is inside.
    const inside = { x: start.x + 0.1, y: start.y };
    expect(pointInConvexPolygon(inside.x, inside.y, polygon)).toBe(true);
  });

  it("rejects a point far outside any deck", () => {
    const geometry: SlabGeometry = { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 19 };
    const polygon = buildDeckPolygon(geometry);

    expect(pointInConvexPolygon(-100, -100, polygon)).toBe(false);
  });

  it("treats a clockwise-wound polygon identically to its counter-clockwise twin", () => {
    const geometry: SlabGeometry = { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 19 };
    const ccw = buildDeckPolygon(geometry);
    const cw = [...ccw].reverse();
    const framing = computeDeckFraming(getDeckBounds(geometry));

    expect(pointInConvexPolygon(framing.centerX, framing.centerY, cw)).toBe(true);
    expect(pointInConvexPolygon(-100, -100, cw)).toBe(false);
  });
});

describe("every mesh node lands within the deck bounds and polygon (19-degree skew)", () => {
  /** Mirrors src/tests/solverFacade.test.ts's buildSkewModel, which itself
   * mirrors the support geometry in src/tests/skewSolverIntegration.test.ts,
   * translated to the app-level SlabModel the public facade accepts. */
  function buildSkewModel(): SlabModel {
    const base = createDefaultModel();
    const skewAngleDeg = 19;
    const lengthM = 6;
    const widthM = 3;
    const thicknessM = 0.4;

    const geometry = normalizeSolverGeometry({
      lengthX: lengthM,
      lengthY: widthM,
      thickness: thicknessM,
      skewAngleDeg,
    });

    const startLower = deckLocalToGlobal(geometry, { s: 0, t: 0 });
    const startUpper = deckLocalToGlobal(geometry, { s: 0, t: widthM });
    const endLower = deckLocalToGlobal(geometry, { s: lengthM, t: 0 });
    const endUpper = deckLocalToGlobal(geometry, { s: lengthM, t: widthM });
    const wheel = deckLocalToGlobal(geometry, { s: lengthM / 2, t: widthM / 2 });

    const fixedConstraints = {
      uz: { type: "fixed" as const },
      rx: { type: "fixed" as const },
      ry: { type: "fixed" as const },
    };

    return {
      ...base,
      geometry: { lengthM, widthM, thicknessM, skewAngleDeg },
      supports: [
        {
          id: "S1",
          name: "Start edge",
          kind: "line",
          x1: startLower.x,
          y1: startLower.y,
          x2: startUpper.x,
          y2: startUpper.y,
          constraints: fixedConstraints,
        },
        {
          id: "S2",
          name: "End edge",
          kind: "line",
          x1: endLower.x,
          y1: endLower.y,
          x2: endUpper.x,
          y2: endUpper.y,
          constraints: fixedConstraints,
        },
      ],
      vehicle: {
        ...base.vehicle,
        mode: "direct",
        directWheels: [
          { id: "W1", xM: wheel.x, yM: wheel.y, loadKn: 100, patchLongM: 0.4, patchTransM: 0.4 },
        ],
      },
    };
  }

  it("keeps every meshNodeOverlays point within the deck bounds and polygon", () => {
    const model = buildSkewModel();
    const payload = runFixedPositionAnalysis(model);

    expect(payload.meshNodeOverlays).toBeDefined();
    expect(payload.meshNodeOverlays!.length).toBeGreaterThan(0);

    const bounds = getDeckBounds(model.geometry);
    const polygon = buildDeckPolygon(model.geometry);
    const tolerance = 1e-8;

    for (const node of payload.meshNodeOverlays!) {
      expect(node.xM).toBeGreaterThanOrEqual(bounds.xMin - tolerance);
      expect(node.xM).toBeLessThanOrEqual(bounds.xMax + tolerance);
      expect(node.yM).toBeGreaterThanOrEqual(bounds.yMin - tolerance);
      expect(node.yM).toBeLessThanOrEqual(bounds.yMax + tolerance);
      expect(pointInConvexPolygon(node.xM, node.yM, polygon, 1e-6)).toBe(true);
    }
  });
});
