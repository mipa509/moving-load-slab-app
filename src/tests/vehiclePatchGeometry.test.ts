import { describe, expect, it } from "vitest";
import {
  buildDeckPolygon,
  getDeckEdgeSegment,
} from "../solver/geometry/deckCoordinates";
import {
  classifyPointInConvexPolygon,
  getGeometryTolerance,
  normalizeConvexPolygon,
  polygonArea,
  polygonFirstMoments,
  signedPolygonArea,
} from "../solver/geometry/convexPolygon";
import type { Point2D, Polygon2D } from "../solver/geometry/types";
import {
  generateWheelPatches,
  type GeneratedWheelPatch,
} from "../solver/loads/vehicle";
import type {
  AxisDirection,
  SlabGeometry,
  VehicleDefinition,
} from "../solver/model/types";

const LENGTH = 10;
const WIDTH = 6;
const ROUND_OFF_MULTIPLIER = 256;

function slab(skewAngleDeg = 0): SlabGeometry {
  return {
    lengthX: LENGTH,
    lengthY: WIDTH,
    thickness: 0.3,
    skewAngleDeg,
  };
}

function normalizedSlab(skewAngleDeg = 0) {
  return {
    lengthM: LENGTH,
    widthM: WIDTH,
    thicknessM: 0.3,
    skewAngleDeg,
  };
}

function explicitVehicle(input: {
  x: number;
  y: number;
  direction?: AxisDirection;
  load?: number;
  patchLength?: number;
  patchWidth?: number;
}): VehicleDefinition {
  const direction = input.direction ?? "+x";
  return {
    kind: "explicit-wheels",
    coordinateSystem: "global-slab",
    direction,
    wheels: [
      {
        id: "W1",
        x: input.x,
        y: input.y,
        load: input.load ?? 120,
        patchLength: input.patchLength ?? 2,
        patchWidth: input.patchWidth ?? 1,
        direction,
      },
    ],
  };
}

function patchAt(
  x: number,
  y: number,
  skewAngleDeg = 0,
  options: Omit<Parameters<typeof explicitVehicle>[0], "x" | "y"> = {},
): GeneratedWheelPatch {
  return generateWheelPatches(
    explicitVehicle({ x, y, ...options }),
    slab(skewAngleDeg),
  )[0];
}

function expectRoundOffClose(actual: number, expected: number, scale = 1): void {
  const tolerance = ROUND_OFF_MULTIPLIER
    * Number.EPSILON
    * Math.max(Math.abs(expected), Math.abs(scale), Number.MIN_VALUE);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function expectPolygonClose(actual: Polygon2D, expected: Polygon2D): void {
  const normalizedActual = normalizeConvexPolygon(actual);
  const normalizedExpected = normalizeConvexPolygon(expected);
  expect(normalizedActual).not.toBeNull();
  expect(normalizedExpected).not.toBeNull();
  if (!normalizedActual || !normalizedExpected) {
    return;
  }
  expect(normalizedActual).toHaveLength(normalizedExpected.length);
  const tolerance = getGeometryTolerance([
    ...normalizedActual,
    ...normalizedExpected,
  ]).length * 8;
  normalizedExpected.forEach((point, index) => {
    expect(Math.abs(normalizedActual[index].x - point.x)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(normalizedActual[index].y - point.y)).toBeLessThanOrEqual(tolerance);
  });
}

function independentPolygonMeasures(polygon: Polygon2D): {
  area: number;
  integralX: number;
  integralY: number;
  centroid: Point2D;
} {
  let twiceSignedArea = 0;
  let sixSignedIntegralX = 0;
  let sixSignedIntegralY = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const cross = current.x * next.y - next.x * current.y;
    twiceSignedArea += cross;
    sixSignedIntegralX += (current.x + next.x) * cross;
    sixSignedIntegralY += (current.y + next.y) * cross;
  }
  const orientation = Math.sign(twiceSignedArea);
  const area = Math.abs(twiceSignedArea) / 2;
  const integralX = orientation * sixSignedIntegralX / 6;
  const integralY = orientation * sixSignedIntegralY / 6;
  return {
    area,
    integralX,
    integralY,
    centroid: { x: integralX / area, y: integralY / area },
  };
}

function independentConvexClip(subject: Polygon2D, clip: Polygon2D): Polygon2D {
  let output = subject.map((point) => ({ ...point }));
  const side = (start: Point2D, end: Point2D, point: Point2D) =>
    (end.x - start.x) * (point.y - start.y)
    - (end.y - start.y) * (point.x - start.x);

  for (let edgeIndex = 0; edgeIndex < clip.length; edgeIndex += 1) {
    const edgeStart = clip[edgeIndex];
    const edgeEnd = clip[(edgeIndex + 1) % clip.length];
    const input = output;
    output = [];
    if (input.length === 0) break;
    let previous = input[input.length - 1];
    let previousSide = side(edgeStart, edgeEnd, previous);
    for (const current of input) {
      const currentSide = side(edgeStart, edgeEnd, current);
      const previousInside = previousSide >= 0;
      const currentInside = currentSide >= 0;
      if (previousInside !== currentInside) {
        const ratio = previousSide / (previousSide - currentSide);
        output.push({
          x: previous.x + ratio * (current.x - previous.x),
          y: previous.y + ratio * (current.y - previous.y),
        });
      }
      if (currentInside) output.push({ ...current });
      previous = current;
      previousSide = currentSide;
    }
  }
  return output;
}

function axleVehicle(overrides: Record<string, unknown> = {}): VehicleDefinition {
  return {
    kind: "axle-builder",
    direction: "+x",
    reference: { x: 5, y: 3 },
    defaultTransverseSpacing: 2,
    defaultPatchLength: 1,
    defaultPatchWidth: 0.5,
    axles: [{ id: "A1", axleLoad: 100, wheelCount: 2 }],
    ...overrides,
  } as VehicleDefinition;
}
function legacyRectangleClip(input: {
  centerX: number;
  centerY: number;
  direction: AxisDirection;
  patchLength: number;
  patchWidth: number;
}): {
  originalBounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  clippedBounds: { xMin: number; xMax: number; yMin: number; yMax: number } | null;
  clippedArea: number;
} {
  const xDirected = input.direction === "+x" || input.direction === "-x";
  const dx = xDirected ? input.patchLength : input.patchWidth;
  const dy = xDirected ? input.patchWidth : input.patchLength;
  const originalBounds = {
    xMin: input.centerX - dx / 2,
    xMax: input.centerX + dx / 2,
    yMin: input.centerY - dy / 2,
    yMax: input.centerY + dy / 2,
  };
  const clippedBounds = {
    xMin: Math.max(originalBounds.xMin, 0),
    xMax: Math.min(originalBounds.xMax, LENGTH),
    yMin: Math.max(originalBounds.yMin, 0),
    yMax: Math.min(originalBounds.yMax, WIDTH),
  };
  if (
    clippedBounds.xMax <= clippedBounds.xMin
    || clippedBounds.yMax <= clippedBounds.yMin
  ) {
    return { originalBounds, clippedBounds: null, clippedArea: 0 };
  }
  return {
    originalBounds,
    clippedBounds,
    clippedArea:
      (clippedBounds.xMax - clippedBounds.xMin)
      * (clippedBounds.yMax - clippedBounds.yMin),
  };
}

function edgeMidpoint(skewAngleDeg: number, edge: Parameters<typeof getDeckEdgeSegment>[1]) {
  const [start, end] = getDeckEdgeSegment(normalizedSlab(skewAngleDeg), edge);
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

function reflectAcrossDeckMidline(point: Point2D): Point2D {
  return { x: point.x, y: WIDTH - point.y };
}

describe("wheel-patch polygon geometry", () => {
  it("retains the complete polygon and exact measures when fully inside a skew deck", () => {
    const patch = patchAt(5, 3, 19);

    expect(patch.originalPolygon).toEqual([
      { x: 4, y: 2.5 },
      { x: 6, y: 2.5 },
      { x: 6, y: 3.5 },
      { x: 4, y: 3.5 },
    ]);
    expect(patch.clippedPolygon).toEqual(patch.originalPolygon);
    expect(patch.originalBounds).toEqual({ xMin: 4, xMax: 6, yMin: 2.5, yMax: 3.5 });
    expect(patch.clippedBounds).toEqual(patch.originalBounds);
    expect(patch.originalAreaM2).toBe(2);
    expect(patch.clippedAreaM2).toBe(2);
    expect(patch.clippedCentroid).toEqual({ x: 5, y: 3 });
    expect(signedPolygonArea(patch.originalPolygon)).toBeGreaterThan(0);
    expect(signedPolygonArea(patch.clippedPolygon)).toBeGreaterThan(0);

    const moments = polygonFirstMoments(patch.clippedPolygon);
    expect(moments).not.toBeNull();
    expect(moments?.integralX).toBe(10);
    expect(moments?.integralY).toBe(6);
  });

  it.each(["start", "end", "lower-side", "upper-side"] as const)(
    "clips a centered square at the actual %s deck edge",
    (edge) => {
      const skewAngleDeg = 19;
      const center = edgeMidpoint(skewAngleDeg, edge);
      const patch = patchAt(center.x, center.y, skewAngleDeg, {
        patchLength: 1,
        patchWidth: 1,
      });
      const deck = buildDeckPolygon(normalizedSlab(skewAngleDeg));

      expect(patch.clippedPolygon).not.toBeNull();
      expectRoundOffClose(patch.clippedAreaM2, 0.5, 1);
      expect(patch.clippedAreaM2).toBeLessThan(patch.originalAreaM2);
      expect(patch.originalPolygon.some(
        (point) => classifyPointInConvexPolygon(point, deck) === "outside",
      )).toBe(true);
      expect(patch.clippedPolygon?.every(
        (point) => classifyPointInConvexPolygon(point, deck) !== "outside",
      )).toBe(true);

      const independentClip = independentConvexClip(patch.originalPolygon, deck);
      const independentMeasures = independentPolygonMeasures(independentClip);
      expectRoundOffClose(
        patch.clippedAreaM2,
        independentMeasures.area,
        patch.originalAreaM2,
      );
      expectRoundOffClose(
        patch.clippedCentroid?.x ?? Number.NaN,
        independentMeasures.centroid.x,
        LENGTH,
      );
      expectRoundOffClose(
        patch.clippedCentroid?.y ?? Number.NaN,
        independentMeasures.centroid.y,
        WIDTH,
      );
    },
  );

  it("returns null clipped geometry for exact edge and vertex tangency", () => {
    const tangentEdge = patchAt(5, -0.5, 0, {
      patchLength: 1,
      patchWidth: 1,
    });
    const tangentVertex = patchAt(-0.5, -0.5, 0, {
      patchLength: 1,
      patchWidth: 1,
    });

    for (const patch of [tangentEdge, tangentVertex]) {
      expect(patch.originalPolygon).toHaveLength(4);
      expect(patch.originalAreaM2).toBe(1);
      expect(patch.clippedPolygon).toBeNull();
      expect(patch.clippedBounds).toBeNull();
      expect(patch.clippedAreaM2).toBe(0);
      expect(patch.clippedArea).toBe(0);
      expect(patch.clippedCentroid).toBeNull();
    }
  });

  it("retains complete original data when wholly outside the deck", () => {
    const patch = patchAt(30, -20, 19);

    expect(patch.originalPolygon).toEqual([
      { x: 29, y: -20.5 },
      { x: 31, y: -20.5 },
      { x: 31, y: -19.5 },
      { x: 29, y: -19.5 },
    ]);
    expect(patch.originalBounds).toEqual({
      xMin: 29,
      xMax: 31,
      yMin: -20.5,
      yMax: -19.5,
    });
    expect(patch.originalAreaM2).toBe(2);
    expect(patch.clippedPolygon).toBeNull();
    expect(patch.clippedBounds).toBeNull();
    expect(patch.clippedAreaM2).toBe(0);
    expect(patch.clippedCentroid).toBeNull();
    expect(patch.pressureKnPerM2).toBe(60);
  });

  it("maps +19 and -19 degree clipped polygons by the accepted point mirror", () => {
    const plusCenter = edgeMidpoint(19, "start");
    const plus = patchAt(plusCenter.x, plusCenter.y, 19, {
      patchLength: 2,
      patchWidth: 1,
    });
    const minus = patchAt(plusCenter.x, WIDTH - plusCenter.y, -19, {
      patchLength: 2,
      patchWidth: 1,
    });
    expect(plus.clippedPolygon).not.toBeNull();
    expect(minus.clippedPolygon).not.toBeNull();
    if (!plus.clippedPolygon || !minus.clippedPolygon) {
      return;
    }

    const reflectedPlus = normalizeConvexPolygon(
      plus.clippedPolygon.map(reflectAcrossDeckMidline),
    );
    expect(reflectedPlus).not.toBeNull();
    if (!reflectedPlus) {
      return;
    }
    expectPolygonClose(minus.clippedPolygon, reflectedPlus);
    expectRoundOffClose(minus.clippedAreaM2, plus.clippedAreaM2, 2);
    expectRoundOffClose(
      minus.clippedCentroid?.x ?? Number.NaN,
      plus.clippedCentroid?.x ?? Number.NaN,
      LENGTH,
    );
    expectRoundOffClose(
      minus.clippedCentroid?.y ?? Number.NaN,
      WIDTH - (plus.clippedCentroid?.y ?? Number.NaN),
      WIDTH,
    );
  });

  it.each([
    ["+x", { xMin: 4, xMax: 6, yMin: 2.5, yMax: 3.5 }],
    ["-x", { xMin: 4, xMax: 6, yMin: 2.5, yMax: 3.5 }],
    ["+y", { xMin: 4.5, xMax: 5.5, yMin: 2, yMax: 4 }],
    ["-y", { xMin: 4.5, xMax: 5.5, yMin: 2, yMax: 4 }],
  ] as const)(
    "keeps %s direction dimensions axis-aligned with counter-clockwise winding",
    (direction, expectedBounds) => {
      const patch = patchAt(5, 3, 0, { direction });

      expect(patch.originalBounds).toEqual(expectedBounds);
      expect(patch.clippedBounds).toEqual(expectedBounds);
      expect(patch.patchLengthM).toBe(2);
      expect(patch.patchWidthM).toBe(1);
      expect(patch.originalAreaM2).toBe(2);
      expect(signedPolygonArea(patch.originalPolygon)).toBe(2);
      expect(signedPolygonArea(patch.clippedPolygon)).toBe(2);
    },
  );

  it("keeps analytic area, centroid, AABB, and first moments mutually consistent", () => {
    const patch = patchAt(4.25, 2.75, 0, {
      direction: "+y",
      patchLength: 2,
      patchWidth: 1,
    });
    const originalMoments = polygonFirstMoments(patch.originalPolygon);
    const clippedMoments = polygonFirstMoments(patch.clippedPolygon);

    expect(patch.originalBounds).toEqual({ xMin: 3.75, xMax: 4.75, yMin: 1.75, yMax: 3.75 });
    expect(patch.clippedBounds).toEqual(patch.originalBounds);
    expect(polygonArea(patch.originalPolygon)).toBe(2);
    expect(patch.clippedAreaM2).toBe(2);
    expect(patch.clippedCentroid).toEqual({ x: 4.25, y: 2.75 });
    expect(originalMoments).toEqual({ integralX: 8.5, integralY: 5.5 });
    expect(clippedMoments).toEqual(originalMoments);

    const partial = patchAt(0.25, 3, 19, {
      patchLength: 2,
      patchWidth: 1,
    });
    const partialMoments = polygonFirstMoments(partial.clippedPolygon);
    const independentMoments = independentPolygonMeasures(partial.clippedPolygon ?? []);
    expect(partialMoments).not.toBeNull();
    expectRoundOffClose(
      partialMoments?.integralX ?? Number.NaN,
      independentMoments.integralX,
      LENGTH,
    );
    expectRoundOffClose(
      partialMoments?.integralY ?? Number.NaN,
      independentMoments.integralY,
      WIDTH,
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite axle wheelCount %s rather than silently emitting no patches",
    (wheelCount) => {
      const vehicle = axleVehicle({
        axles: [{ id: "A1", axleLoad: 100, wheelCount }],
      });
      expect(() => generateWheelPatches(vehicle, slab(0))).toThrow(/wheelCount must be finite/);
    },
  );

  it("rejects a finite wheelCount that rounds to an unsafe array count", () => {
    const vehicle = axleVehicle({
      axles: [{ id: "A1", axleLoad: 100, wheelCount: Number.MAX_VALUE }],
    });
    expect(() => generateWheelPatches(vehicle, slab(0))).toThrow(/unsafe count/);
  });

  it.each([
    ["zero", 0],
    ["negative", -3],
    ["fractional below one", 0.49],
    ["fractional above one", 1.6],
  ] as const)(
    "preserves clamping and rounding behavior for %s axle wheelCount",
    (_label, wheelCount) => {
      const patches = generateWheelPatches(
        axleVehicle({ axles: [{ id: "A1", axleLoad: 100, wheelCount }] }),
        slab(0),
      );
      const expectedCount = Math.max(1, Math.round(wheelCount));
      expect(patches).toHaveLength(expectedCount);
      expect(patches.every((patch) => patch.load === 100 / expectedCount)).toBe(true);
      expect(patches.every((patch) => Number.isFinite(patch.load) && patch.load > 0)).toBe(true);
    },
  );

  it.each([
    ["spacingToNext", { axles: [
      { id: "A1", axleLoad: 100, spacingToNext: Number.NaN },
      { id: "A2", axleLoad: 100 },
    ] }],
    ["offset", { axles: [{ id: "A1", axleLoad: 100, offset: Number.POSITIVE_INFINITY }] }],
    ["resolved transverseSpacing", { defaultTransverseSpacing: Number.NaN }],
    ["resolved patchLength", { defaultPatchLength: Number.POSITIVE_INFINITY }],
    ["resolved patchWidth", { defaultPatchWidth: Number.NaN }],
  ] as const)(
    "rejects non-finite axle-derived %s",
    (_label, overrides) => {
      expect(() => generateWheelPatches(axleVehicle(overrides), slab(0))).toThrow();
    },
  );

  it("rejects an axle load that underflows to zero per wheel", () => {
    const vehicle = axleVehicle({
      axles: [{ id: "A1", axleLoad: Number.MIN_VALUE, wheelCount: 2 }],
    });
    expect(() => generateWheelPatches(vehicle, slab(0))).toThrow(/load per wheel/);
  });

  it.each([
    ["overflowed area", { x: 5, y: 3, patchLength: Number.MAX_VALUE, patchWidth: 2 }, /area/],
    ["underflowed area", { x: 5, y: 3, patchLength: Number.MIN_VALUE, patchWidth: Number.MIN_VALUE }, /area/],
    ["overflowed pressure", { x: 5, y: 3, load: Number.MAX_VALUE, patchLength: Number.MIN_VALUE, patchWidth: 1 }, /pressure/],
  ] as const)(
    "rejects %s derived patch values",
    (_label, input, expectedError) => {
      expect(() => generateWheelPatches(explicitVehicle(input), slab(0))).toThrow(expectedError);
    },
  );
  it.each([
    { centerX: 5, centerY: 3, direction: "+x" as const },
    { centerX: 0.5, centerY: 3, direction: "-x" as const },
    { centerX: 5, centerY: 0.25, direction: "+y" as const },
    { centerX: 5, centerY: -1, direction: "-y" as const },
  ])(
    "preserves zero-skew legacy bounds, area, and pressure for $direction at $centerX,$centerY",
    ({ centerX, centerY, direction }) => {
      const patchLength = 2;
      const patchWidth = 1;
      const load = 120;
      const legacy = legacyRectangleClip({
        centerX,
        centerY,
        direction,
        patchLength,
        patchWidth,
      });
      const patch = patchAt(centerX, centerY, 0, {
        direction,
        load,
        patchLength,
        patchWidth,
      });

      expect(patch.originalBounds).toEqual(legacy.originalBounds);
      expect(patch.clippedBounds).toEqual(legacy.clippedBounds);
      expectRoundOffClose(patch.clippedArea, legacy.clippedArea, 2);
      expectRoundOffClose(patch.clippedAreaM2, legacy.clippedArea, 2);
      expect(patch.load).toBe(load);
      expect(patch.wheelLoadKn).toBe(load);
      expect(patch.pressure).toBe(load / (patchLength * patchWidth));
      expect(patch.pressureKnPerM2).toBe(patch.pressure);
    },
  );

  it("keeps full-contact pressure unchanged for inside, clipped, tangent, and outside patches", () => {
    const patches = [
      patchAt(5, 3, 19),
      patchAt(0, 3, 19),
      patchAt(5, -0.5, 0),
      patchAt(30, 30, 19),
    ];

    expect(patches.map((patch) => patch.pressureKnPerM2)).toEqual([60, 60, 60, 60]);
    expect(patches.map((patch) => patch.originalAreaM2)).toEqual([2, 2, 2, 2]);
    expect(patches[1].clippedAreaM2).toBeLessThan(2);
    expect(patches[2].clippedAreaM2).toBe(0);
    expect(patches[3].clippedAreaM2).toBe(0);
  });

  it("is deterministic, does not mutate inputs, and ignores non-contract heading metadata", () => {
    const vehicle = explicitVehicle({
      x: 0,
      y: 3,
      direction: "+y",
      load: 97,
      patchLength: 1.7,
      patchWidth: 0.6,
    });
    const sourceSlab = slab(-19);
    const vehicleBefore = structuredClone(vehicle);
    const slabBefore = structuredClone(sourceSlab);

    const first = generateWheelPatches(vehicle, sourceSlab);
    const second = generateWheelPatches(vehicle, sourceSlab);
    const withHeading = { ...vehicle, headingDeg: 37 };
    const headingResult = generateWheelPatches(withHeading, sourceSlab);

    expect(first).toEqual(second);
    expect(headingResult).toEqual(first);
    expect(vehicle).toEqual(vehicleBefore);
    expect(sourceSlab).toEqual(slabBefore);
  });

  it.each([
    ["non-finite x", { x: Number.NaN, y: 3 }],
    ["non-finite y", { x: 5, y: Number.POSITIVE_INFINITY }],
    ["non-finite load", { x: 5, y: 3, load: Number.NaN }],
    ["non-finite length", { x: 5, y: 3, patchLength: Number.POSITIVE_INFINITY }],
    ["non-finite width", { x: 5, y: 3, patchWidth: Number.NaN }],
    ["zero length", { x: 5, y: 3, patchLength: 0 }],
    ["negative load", { x: 5, y: 3, load: -1 }],
  ] as const)("rejects %s rather than emitting invalid geometry", (_label, input) => {
    expect(() => generateWheelPatches(explicitVehicle(input), slab(0))).toThrow();
  });
});
