import { describe, expect, it, vi } from "vitest";
import * as DeckCoordinates from "../solver/geometry/deckCoordinates";
import {
  buildDeckPolygon,
  deckLocalToGlobal,
  getDeckBounds,
  getDeckEdgeSegment,
  getNormalSpan,
  getSupportAxes,
  getSupportOffset,
  globalToDeckLocal,
} from "../solver/geometry/deckCoordinates";
import type {
  DeckEdge,
  DeckLocalPoint,
  Point2D,
  Polygon2D,
  SlabGeometry,
} from "../solver/geometry/types";

const ANGLES_DEG = [0, 19, -19, 45, -45, 60, -60] as const;
const EDGES: DeckEdge[] = ["start", "end", "lower-side", "upper-side"];
const LENGTH_M = 12.5;
const WIDTH_M = 7.25;
const THICKNESS_M = 0.32;
const ROUND_OFF_FACTOR = 100;
const SIGNED_POINT_ORACLES = [
  {
    skewAngleDeg: 19,
    expectedForwardX: 3.152210842891921,
    expectedInverseS: [-4.394164353458152, 14.41520475830604, 6.069427223556405],
  },
  {
    skewAngleDeg: -19,
    expectedForwardX: 1.4477891571080785,
    expectedInverseS: [-1.1058356465418484, 13.98479524169396, 4.330572776443596],
  },
] as const;
const GLOBAL_INVERSE_ORACLES = [
  { x: -2.75, y: 8.4 },
  { x: 14.2, y: 3 },
  { x: 5.2, y: 1.1 },
] as const;
const CORNER_ORACLES = [
  {
    skewAngleDeg: 19,
    vertices: [
      { x: -1.2481875981750363, y: 0 },
      { x: 11.251812401824964, y: 0 },
      { x: 13.748187598175036, y: 7.25 },
      { x: 1.2481875981750363, y: 7.25 },
    ],
  },
  {
    skewAngleDeg: -19,
    vertices: [
      { x: 1.2481875981750363, y: 0 },
      { x: 13.748187598175036, y: 0 },
      { x: 11.251812401824964, y: 7.25 },
      { x: -1.2481875981750363, y: 7.25 },
    ],
  },
] as const;
const UNIFORM_SCALE_CASES = [
  { name: "micro", multiplier: 1e-6 },
  { name: "unit", multiplier: 1 },
  { name: "large", multiplier: 1e6 },
] as const;

function geometry(skewAngleDeg: number): SlabGeometry {
  return {
    lengthM: LENGTH_M,
    widthM: WIDTH_M,
    thicknessM: THICKNESS_M,
    skewAngleDeg,
  };
}

function lengthTolerance(value: SlabGeometry = geometry(0)): number {
  return (
    ROUND_OFF_FACTOR *
    Number.EPSILON *
    Math.max(value.lengthM, value.widthM)
  );
}

function scalarTolerance(scale = 1): number {
  return ROUND_OFF_FACTOR * Number.EPSILON * scale;
}

function expectWithin(actual: number, expected: number, tolerance: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function expectPointWithin(
  actual: Point2D,
  expected: Point2D,
  tolerance: number,
): void {
  expectWithin(actual.x, expected.x, tolerance);
  expectWithin(actual.y, expected.y, tolerance);
}

function signedArea(polygon: Polygon2D): number {
  let twiceArea = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return twiceArea / 2;
}

function polygonCentroid(polygon: Polygon2D): Point2D {
  let crossSum = 0;
  let xSum = 0;
  let ySum = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const cross = current.x * next.y - next.x * current.y;
    crossSum += cross;
    xSum += (current.x + next.x) * cross;
    ySum += (current.y + next.y) * cross;
  }
  return {
    x: xSum / (3 * crossSum),
    y: ySum / (3 * crossSum),
  };
}

function createDeterministicRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function mirrorPoint(point: Point2D): Point2D {
  return { x: point.x, y: WIDTH_M - point.y };
}

function mirrorVector(point: Point2D): Point2D {
  return { x: point.x, y: -point.y };
}

function negate(point: Point2D): Point2D {
  return { x: -point.x, y: -point.y };
}

function callsForEveryUtility(candidate: SlabGeometry): Array<() => unknown> {
  return [
    () => deckLocalToGlobal(candidate, { s: 0, t: 0 }),
    () => globalToDeckLocal(candidate, { x: 0, y: 0 }),
    () => buildDeckPolygon(candidate),
    () => getDeckEdgeSegment(candidate, "start"),
    () => getDeckBounds(candidate),
    () => getSupportOffset(candidate),
    () => getNormalSpan(candidate),
    () => getSupportAxes(candidate, "start"),
  ];
}

function assertSignedPointOracle(
  oracle: (typeof SIGNED_POINT_ORACLES)[number],
): void {
  const slab = geometry(oracle.skewAngleDeg);
  const tolerance = lengthTolerance(slab);
  expectPointWithin(
    deckLocalToGlobal(slab, { s: 2.3, t: 6.1 }),
    { x: oracle.expectedForwardX, y: 6.1 },
    tolerance,
  );
  GLOBAL_INVERSE_ORACLES.forEach((global, index) => {
    const local = globalToDeckLocal(slab, global);
    expectWithin(local.s, oracle.expectedInverseS[index], tolerance);
    expect(local.t).toBe(global.y);
  });
}

function assertCornerOracle(oracle: (typeof CORNER_ORACLES)[number]): void {
  const slab = geometry(oracle.skewAngleDeg);
  const tolerance = lengthTolerance(slab);
  const localCorners = [
    { s: 0, t: 0 },
    { s: LENGTH_M, t: 0 },
    { s: LENGTH_M, t: WIDTH_M },
    { s: 0, t: WIDTH_M },
  ];
  const polygon = buildDeckPolygon(slab);
  localCorners.forEach((local, index) => {
    expectPointWithin(
      deckLocalToGlobal(slab, local),
      oracle.vertices[index],
      tolerance,
    );
    expectPointWithin(polygon[index], oracle.vertices[index], tolerance);
  });
}

function assertUniformScale(
  scaleCase: (typeof UNIFORM_SCALE_CASES)[number],
): void {
  for (const oracle of SIGNED_POINT_ORACLES) {
    const factor = scaleCase.multiplier;
    const slab: SlabGeometry = {
      lengthM: LENGTH_M * factor,
      widthM: WIDTH_M * factor,
      thicknessM: THICKNESS_M * factor,
      skewAngleDeg: oracle.skewAngleDeg,
    };
    const tolerance = lengthTolerance(slab);
    expectPointWithin(
      deckLocalToGlobal(slab, { s: 2.3 * factor, t: 6.1 * factor }),
      { x: oracle.expectedForwardX * factor, y: 6.1 * factor },
      tolerance,
    );
    const local = globalToDeckLocal(slab, {
      x: 5.2 * factor,
      y: 1.1 * factor,
    });
    expectWithin(local.s, oracle.expectedInverseS[2] * factor, tolerance);
    expectWithin(local.t, 1.1 * factor, tolerance);
  }
}

describe("affine deck-coordinate kernel", () => {
  it("exports only the frozen deck-coordinate utilities", () => {
    expect(Object.keys(DeckCoordinates).sort()).toEqual(
      [
        "buildDeckPolygon",
        "deckLocalToGlobal",
        "getDeckBounds",
        "getDeckEdgeSegment",
        "getNormalSpan",
        "getSupportAxes",
        "getSupportOffset",
        "globalToDeckLocal",
      ].sort(),
    );
  });

  it.each(SIGNED_POINT_ORACLES)(
    "matches independent asymmetric positive and negative sign oracles",
    assertSignedPointOracle,
  );

  it.each(CORNER_ORACLES)(
    "maps all local corners to independent canonical polygon vertices",
    assertCornerOracle,
  );

  it.each(UNIFORM_SCALE_CASES)(
    "meets the 100 eps characteristic-length bound at uniform scale",
    assertUniformScale,
  );

  it.each(ANGLES_DEG)(
    "round trips corners and deterministic interior points at %s degrees",
    (skewAngleDeg) => {
      const slab = geometry(skewAngleDeg);
      const tolerance = lengthTolerance(slab);
      const random = createDeterministicRandom(0x5f3759df);
      const points: DeckLocalPoint[] = [
        { s: 0, t: 0 },
        { s: slab.lengthM, t: 0 },
        { s: slab.lengthM, t: slab.widthM },
        { s: 0, t: slab.widthM },
      ];

      for (let index = 0; index < 32; index += 1) {
        points.push({
          s: random() * slab.lengthM,
          t: random() * slab.widthM,
        });
      }

      for (const local of points) {
        const global = deckLocalToGlobal(slab, local);
        const recoveredLocal = globalToDeckLocal(slab, global);
        expectWithin(recoveredLocal.s, local.s, tolerance);
        expectWithin(recoveredLocal.t, local.t, tolerance);

        const recoveredGlobal = deckLocalToGlobal(slab, recoveredLocal);
        expectPointWithin(recoveredGlobal, global, tolerance);
      }
    },
  );

  it.each(ANGLES_DEG)(
    "matches analytic vertices, area, centroid, bounds, and dimensions at %s degrees",
    (skewAngleDeg) => {
      const slab = geometry(skewAngleDeg);
      const angleRad = (skewAngleDeg * Math.PI) / 180;
      const offset = slab.widthM * Math.tan(angleRad);
      const halfOffset = offset / 2;
      const expectedVertices = [
        { x: -halfOffset, y: 0 },
        { x: slab.lengthM - halfOffset, y: 0 },
        { x: slab.lengthM + halfOffset, y: slab.widthM },
        { x: halfOffset, y: slab.widthM },
      ];
      const polygon = buildDeckPolygon(slab);
      const tolerance = lengthTolerance(slab);

      polygon.forEach((point, index) => {
        expectPointWithin(point, expectedVertices[index], tolerance);
      });
      expectWithin(
        signedArea(polygon),
        slab.lengthM * slab.widthM,
        scalarTolerance(Math.max(slab.lengthM, slab.widthM) ** 2),
      );
      expectPointWithin(
        polygonCentroid(polygon),
        { x: slab.lengthM / 2, y: slab.widthM / 2 },
        tolerance,
      );
      expectWithin(getSupportOffset(slab), offset, tolerance);
      expectWithin(
        getNormalSpan(slab),
        slab.lengthM * Math.cos(angleRad),
        tolerance,
      );

      const bounds = getDeckBounds(slab);
      expectWithin(bounds.xMin, -Math.abs(halfOffset), tolerance);
      expectWithin(bounds.xMax, slab.lengthM + Math.abs(halfOffset), tolerance);
      expect(bounds.yMin).toBe(0);
      expect(bounds.yMax).toBe(slab.widthM);
    },
  );

  it.each(ANGLES_DEG)(
    "returns canonical signed frames for all four edges at %s degrees",
    (skewAngleDeg) => {
      const slab = geometry(skewAngleDeg);
      const polygon = buildDeckPolygon(slab);
      const angleRad = (skewAngleDeg * Math.PI) / 180;
      const nPlus = { x: Math.cos(angleRad), y: -Math.sin(angleRad) };
      const supportTangent = {
        x: Math.sin(angleRad),
        y: Math.cos(angleRad),
      };
      const expected = {
        start: {
          segment: [polygon[0], polygon[3]],
          tangent: supportTangent,
          inward: nPlus,
          lengthM: slab.widthM / Math.cos(angleRad),
        },
        end: {
          segment: [polygon[1], polygon[2]],
          tangent: supportTangent,
          inward: negate(nPlus),
          lengthM: slab.widthM / Math.cos(angleRad),
        },
        "lower-side": {
          segment: [polygon[0], polygon[1]],
          tangent: { x: 1, y: 0 },
          inward: { x: 0, y: 1 },
          lengthM: slab.lengthM,
        },
        "upper-side": {
          segment: [polygon[3], polygon[2]],
          tangent: { x: 1, y: 0 },
          inward: { x: 0, y: -1 },
          lengthM: slab.lengthM,
        },
      } satisfies Record<
        DeckEdge,
        {
          segment: Point2D[];
          tangent: Point2D;
          inward: Point2D;
          lengthM: number;
        }
      >;

      for (const edge of EDGES) {
        const frame = getSupportAxes(slab, edge);
        const edgeExpected = expected[edge];
        const vectorTolerance = scalarTolerance();

        expect(frame.edge).toBe(edge);
        expect(frame.segment).toEqual(edgeExpected.segment);
        expect(getDeckEdgeSegment(slab, edge)).toEqual(edgeExpected.segment);
        expectPointWithin(frame.tangent, edgeExpected.tangent, vectorTolerance);
        expectPointWithin(frame.inwardNormal, edgeExpected.inward, vectorTolerance);
        expectPointWithin(
          frame.outwardNormal,
          negate(edgeExpected.inward),
          vectorTolerance,
        );
        expectWithin(frame.lengthM, edgeExpected.lengthM, lengthTolerance(slab));
        expectWithin(
          Math.hypot(frame.tangent.x, frame.tangent.y),
          1,
          vectorTolerance,
        );
        expectWithin(
          Math.hypot(frame.inwardNormal.x, frame.inwardNormal.y),
          1,
          vectorTolerance,
        );
        expectWithin(
          frame.tangent.x * frame.inwardNormal.x +
            frame.tangent.y * frame.inwardNormal.y,
          0,
          vectorTolerance,
        );
      }
    },
  );

  it("uses the exact direct branch for zero and normalized negative-zero skew", () => {
    const slab = geometry(-0);
    const sinSpy = vi.spyOn(Math, "sin");
    const cosSpy = vi.spyOn(Math, "cos");
    const tanSpy = vi.spyOn(Math, "tan");

    try {
      expect(deckLocalToGlobal(slab, { s: -0, t: -0 })).toEqual({ x: 0, y: 0 });
      expect(globalToDeckLocal(slab, { x: -0, y: -0 })).toEqual({ s: 0, t: 0 });
      expect(buildDeckPolygon(slab)).toEqual([
        { x: 0, y: 0 },
        { x: LENGTH_M, y: 0 },
        { x: LENGTH_M, y: WIDTH_M },
        { x: 0, y: WIDTH_M },
      ]);
      expect(getDeckBounds(slab)).toEqual({
        xMin: 0,
        xMax: LENGTH_M,
        yMin: 0,
        yMax: WIDTH_M,
      });
      expect(getSupportOffset(slab)).toBe(0);
      expect(Object.is(getSupportOffset(slab), -0)).toBe(false);
      expect(getNormalSpan(slab)).toBe(LENGTH_M);
      for (const edge of EDGES) {
        getDeckEdgeSegment(slab, edge);
        getSupportAxes(slab, edge);
      }
      expect(sinSpy).not.toHaveBeenCalled();
      expect(cosSpy).not.toHaveBeenCalled();
      expect(tanSpy).not.toHaveBeenCalled();
    } finally {
      sinSpy.mockRestore();
      cosSpy.mockRestore();
      tanSpy.mockRestore();
    }
  });

  it("obeys the exact positive/negative skew point, polygon, and frame mirrors", () => {
    const positive = geometry(19);
    const negative = geometry(-19);
    const tolerance = lengthTolerance(positive);
    const vectorTolerance = scalarTolerance();
    const local = { s: 4.75, t: 1.25 };
    const mirroredLocal = { s: local.s, t: WIDTH_M - local.t };

    expectPointWithin(
      deckLocalToGlobal(negative, mirroredLocal),
      mirrorPoint(deckLocalToGlobal(positive, local)),
      tolerance,
    );

    const positivePolygon = buildDeckPolygon(positive);
    const negativePolygon = buildDeckPolygon(negative);
    const reversedIndices = [3, 2, 1, 0];
    positivePolygon.forEach((point, index) => {
      expectPointWithin(
        mirrorPoint(point),
        negativePolygon[reversedIndices[index]],
        tolerance,
      );
    });

    for (const edge of ["start", "end"] as const) {
      const positiveFrame = getSupportAxes(positive, edge);
      const negativeFrame = getSupportAxes(negative, edge);
      expectPointWithin(
        negativeFrame.tangent,
        negate(mirrorVector(positiveFrame.tangent)),
        vectorTolerance,
      );
      expectPointWithin(
        negativeFrame.inwardNormal,
        mirrorVector(positiveFrame.inwardNormal),
        vectorTolerance,
      );
      expectWithin(negativeFrame.lengthM, positiveFrame.lengthM, tolerance);
    }

    for (const [positiveEdge, negativeEdge] of [
      ["lower-side", "upper-side"],
      ["upper-side", "lower-side"],
    ] as const) {
      const positiveFrame = getSupportAxes(positive, positiveEdge);
      const negativeFrame = getSupportAxes(negative, negativeEdge);
      expectPointWithin(
        negativeFrame.tangent,
        mirrorVector(positiveFrame.tangent),
        vectorTolerance,
      );
      expectPointWithin(
        negativeFrame.inwardNormal,
        mirrorVector(positiveFrame.inwardNormal),
        vectorTolerance,
      );
      expectWithin(negativeFrame.lengthM, positiveFrame.lengthM, tolerance);
    }
  });

  it("rejects non-finite, non-positive, and out-of-range canonical geometry", () => {
    for (const field of [
      "lengthM",
      "widthM",
      "thicknessM",
      "skewAngleDeg",
    ] as const) {
      for (const invalidValue of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        const candidate = { ...geometry(0), [field]: invalidValue };
        for (const call of callsForEveryUtility(candidate)) {
          expect(call).toThrow(new RegExp(`${field} must be finite`, "i"));
        }
      }
    }

    for (const field of ["lengthM", "widthM", "thicknessM"] as const) {
      for (const invalidValue of [0, -1]) {
        const candidate = { ...geometry(0), [field]: invalidValue };
        for (const call of callsForEveryUtility(candidate)) {
          expect(call).toThrow(new RegExp(`${field} must be greater than 0`, "i"));
        }
      }
    }

    for (const skewAngleDeg of [-91, -90, 90, 91]) {
      for (const call of callsForEveryUtility(geometry(skewAngleDeg))) {
        expect(call).toThrow(/skewAngleDeg must be greater than -90 and less than 90/i);
      }
    }

    for (const skewAngleDeg of [-89.999999, -60, -45, 45, 60, 89.999999]) {
      expect(() =>
        callsForEveryUtility(geometry(skewAngleDeg)).forEach((call) => call()),
      ).not.toThrow();
    }
  });

  it("rejects non-finite transform coordinates", () => {
    const slab = geometry(19);
    expect(() => deckLocalToGlobal(slab, { s: Number.NaN, t: 0 })).toThrow(
      /coordinate s must be finite/i,
    );
    expect(() => deckLocalToGlobal(slab, { s: 0, t: Number.POSITIVE_INFINITY }))
      .toThrow(/coordinate t must be finite/i);
    expect(() => globalToDeckLocal(slab, { x: Number.NEGATIVE_INFINITY, y: 0 }))
      .toThrow(/coordinate x must be finite/i);
    expect(() => globalToDeckLocal(slab, { x: 0, y: Number.NaN })).toThrow(
      /coordinate y must be finite/i,
    );

  });

  it("maps finite off-deck points affinely without containment or clamping", () => {
    const slab = geometry(19);
    const tolerance = lengthTolerance(slab);
    const isContained = (local: DeckLocalPoint): boolean =>
      local.s >= 0 &&
      local.s <= slab.lengthM &&
      local.t >= 0 &&
      local.t <= slab.widthM;

    const outsideLocal = { s: -2.75, t: 8.4 };
    expect(isContained(outsideLocal)).toBe(false);
    expectPointWithin(
      deckLocalToGlobal(slab, outsideLocal),
      { x: -1.1058356465418484, y: 8.4 },
      tolerance,
    );

    const mappedLocal = globalToDeckLocal(slab, { x: -2.75, y: 8.4 });
    expectWithin(mappedLocal.s, -4.394164353458152, tolerance);
    expect(mappedLocal.t).toBe(8.4);
    expect(isContained(mappedLocal)).toBe(false);
  });
});
