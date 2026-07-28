import { describe, expect, it } from "vitest";
import { computeDeckSection } from "../app/sectionCurve";
import { createDefaultModel } from "../app/defaults";
import { runFixedPositionAnalysis } from "../solver";
import { deckLocalToGlobal } from "../solver/geometry/deckCoordinates";
import { normalizeSolverGeometry } from "../solver/model/fromAppModel";
import type {
  DeckSectionSettings,
  NodalFieldMap,
  NodalFieldPoint,
  NodalRecoveredPlateResult,
  SlabModel,
} from "../app/types";

/**
 * WP-033 coverage for the deck-local (s/t) section engine added to
 * `src/app/sectionCurve.ts`. These tests build small synthetic `NodalFieldMap`s
 * directly (unit cases) plus one real-solve integration case that exercises
 * the public solver facade at 0deg, +19deg and -19deg skew to demonstrate
 * the s/t selection is skew-robust.
 */

// ---------------------------------------------------------------------------
// Synthetic NodalFieldMap helper
// ---------------------------------------------------------------------------

interface SyntheticPoint {
  nodeId: number;
  xM: number;
  yM: number;
  sM: number;
  tM: number;
  value: number;
}

const extentOf = (values: number[]): { min: number; max: number } =>
  values.length > 0
    ? { min: Math.min(...values), max: Math.max(...values) }
    : { min: 0, max: 0 };

/** Fills deflection/mx/my/mxy field-data with the same set of synthetic
 * points. Tests only ever read `nodalFields[settings.ordinate]`, so reusing
 * one point set across all four fields keeps the fixtures small. */
const makeNodalFieldMap = (points: SyntheticPoint[]): NodalFieldMap => {
  const fieldPoints: NodalFieldPoint[] = points.map((p) => ({
    nodeId: p.nodeId,
    xM: p.xM,
    yM: p.yM,
    sM: p.sM,
    tM: p.tM,
    value: p.value,
  }));
  const { min, max } = extentOf(fieldPoints.map((p) => p.value));

  return {
    deflection: { field: "deflection", location: "node", points: fieldPoints, min, max, units: "mm" },
    mx: { field: "mx", location: "node", points: fieldPoints, min, max, units: "kN*m/m" },
    my: { field: "my", location: "node", points: fieldPoints, min, max, units: "kN*m/m" },
    mxy: { field: "mxy", location: "node", points: fieldPoints, min, max, units: "kN*m/m" },
  };
};

// ---------------------------------------------------------------------------
// Unit tests: longitudinal strip
// ---------------------------------------------------------------------------

describe("computeDeckSection - longitudinal strip", () => {
  it("returns samples ordered by s, strip-averaged across the covered t-rows", () => {
    // Two t-rows (0 and 0.4) fall inside the requested strip; a third row
    // (t=-1) sits well outside it and must be excluded. Insertion order is
    // deliberately jumbled to confirm the engine sorts by station itself.
    const points: SyntheticPoint[] = [
      { nodeId: 3, xM: 2, yM: 0, sM: 2, tM: 0, value: 30 },
      { nodeId: 9, xM: 0, yM: -1, sM: 0, tM: -1, value: 999 }, // excluded row
      { nodeId: 6, xM: 1, yM: 0.4, sM: 1, tM: 0.4, value: 24 },
      { nodeId: 1, xM: 0, yM: 0, sM: 0, tM: 0, value: 10 },
      { nodeId: 8, xM: 3, yM: 0.4, sM: 3, tM: 0.4, value: 44 },
      { nodeId: 2, xM: 1, yM: 0, sM: 1, tM: 0, value: 20 },
      { nodeId: 5, xM: 0, yM: 0.4, sM: 0, tM: 0.4, value: 14 },
      { nodeId: 4, xM: 3, yM: 0, sM: 3, tM: 0, value: 40 },
      { nodeId: 7, xM: 2, yM: 0.4, sM: 2, tM: 0.4, value: 34 },
    ];
    const nodalFields = makeNodalFieldMap(points);
    const settings: DeckSectionSettings = {
      mode: "longitudinal",
      ordinate: "mx",
      centerTM: 0.2,
      widthM: 1.0,
    };

    const result = computeDeckSection(nodalFields, settings);

    expect(result.state).toBe("populated");
    expect(result.mode).toBe("longitudinal");
    expect(result.stationAxis).toBe("s");
    expect(result.ordinate).toBe("mx");
    expect(result.coordinateFrame).toBe("deck-local");
    expect(result.requestedCenterM).toBe(0.2);
    expect(result.requestedWidthM).toBe(1.0);
    if (result.state !== "populated") throw new Error("expected populated result");

    expect(result.samples.map((s) => s.stationM)).toEqual([0, 1, 2, 3]);
    expect(result.samples.map((s) => s.value)).toEqual([12, 22, 32, 42]);
    expect(result.actualStripMinM).toBeCloseTo(0, 9);
    expect(result.actualStripMaxM).toBeCloseTo(0.4, 9);
    expect(result.min).toBe(12);
    expect(result.max).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: transverse strip (symmetric to the longitudinal case)
// ---------------------------------------------------------------------------

describe("computeDeckSection - transverse strip", () => {
  it("returns samples ordered by t, strip-averaged across the covered s-columns", () => {
    const points: SyntheticPoint[] = [
      { nodeId: 1, xM: 0, yM: 0, sM: 0, tM: 0, value: 10 },
      { nodeId: 2, xM: 0, yM: 1, sM: 0, tM: 1, value: 20 },
      { nodeId: 3, xM: 0, yM: 2, sM: 0, tM: 2, value: 30 },
      { nodeId: 4, xM: 0, yM: 3, sM: 0, tM: 3, value: 40 },
      { nodeId: 5, xM: 0.4, yM: 0, sM: 0.4, tM: 0, value: 14 },
      { nodeId: 6, xM: 0.4, yM: 1, sM: 0.4, tM: 1, value: 24 },
      { nodeId: 7, xM: 0.4, yM: 2, sM: 0.4, tM: 2, value: 34 },
      { nodeId: 8, xM: 0.4, yM: 3, sM: 0.4, tM: 3, value: 44 },
      { nodeId: 9, xM: -1, yM: 0, sM: -1, tM: 0, value: 999 }, // excluded column
    ];
    const nodalFields = makeNodalFieldMap(points);
    const settings: DeckSectionSettings = {
      mode: "transverse",
      ordinate: "my",
      centerSM: 0.2,
      widthM: 1.0,
    };

    const result = computeDeckSection(nodalFields, settings);

    expect(result.state).toBe("populated");
    expect(result.mode).toBe("transverse");
    expect(result.stationAxis).toBe("t");
    expect(result.ordinate).toBe("my");
    if (result.state !== "populated") throw new Error("expected populated result");

    expect(result.samples.map((s) => s.stationM)).toEqual([0, 1, 2, 3]);
    expect(result.samples.map((s) => s.value)).toEqual([12, 22, 32, 42]);
    expect(result.actualStripMinM).toBeCloseTo(0, 9);
    expect(result.actualStripMaxM).toBeCloseTo(0.4, 9);
  });
});

// ---------------------------------------------------------------------------
// Analytic field: mx = sM everywhere -> strip-average reproduces sM exactly.
// ---------------------------------------------------------------------------

describe("computeDeckSection - analytic field", () => {
  it("a wide longitudinal strip reproduces the s-station values when value = sM", () => {
    const tRows = [-1, -0.5, 0, 0.5, 1];
    const sStations = [0, 1, 2, 3, 4, 5];
    const points: SyntheticPoint[] = [];
    let nodeId = 0;
    for (const t of tRows) {
      for (const s of sStations) {
        points.push({ nodeId: nodeId++, xM: s, yM: t, sM: s, tM: t, value: s });
      }
    }
    const nodalFields = makeNodalFieldMap(points);
    const settings: DeckSectionSettings = {
      mode: "longitudinal",
      ordinate: "mx",
      centerTM: 0,
      widthM: 3, // half-width 1.5 covers all five rows (-1..1)
    };

    const result = computeDeckSection(nodalFields, settings);

    expect(result.state).toBe("populated");
    if (result.state !== "populated") throw new Error("expected populated result");

    expect(result.samples.map((s) => s.stationM)).toEqual(sStations);
    for (const sample of result.samples) {
      expect(sample.value).toBeCloseTo(sample.stationM, 9);
    }
    expect(result.actualStripMinM).toBeCloseTo(-1, 9);
    expect(result.actualStripMaxM).toBeCloseTo(1, 9);
  });
});

// ---------------------------------------------------------------------------
// Strip width / bounds
// ---------------------------------------------------------------------------

describe("computeDeckSection - strip width and bounds", () => {
  it("a narrow strip selects only the rows within width/2 and reports their true perpendicular extent", () => {
    // Five t-rows, each carrying a constant value = t * 100 so the selected
    // subset is easy to identify from the averaged sample value.
    const tRows = [-2, -1, 0, 1, 2];
    const sStations = [0, 1, 2];
    const points: SyntheticPoint[] = [];
    let nodeId = 0;
    for (const t of tRows) {
      for (const s of sStations) {
        points.push({ nodeId: nodeId++, xM: s, yM: t, sM: s, tM: t, value: t * 100 });
      }
    }
    const nodalFields = makeNodalFieldMap(points);
    const settings: DeckSectionSettings = {
      mode: "longitudinal",
      ordinate: "mx",
      centerTM: 0,
      widthM: 2, // half-width 1 -> selects t in {-1, 0, 1}; excludes {-2, 2}
    };

    const result = computeDeckSection(nodalFields, settings);

    expect(result.state).toBe("populated");
    if (result.state !== "populated") throw new Error("expected populated result");

    // Extent must reflect the SELECTED rows (-1..1), not the full deck (-2..2).
    expect(result.actualStripMinM).toBeCloseTo(-1, 9);
    expect(result.actualStripMaxM).toBeCloseTo(1, 9);

    // Average of -100, 0, 100 at every station is 0; the excluded +/-200 rows
    // must not pull the average away from 0.
    for (const sample of result.samples) {
      expect(sample.value).toBeCloseTo(0, 9);
    }
  });
});

// ---------------------------------------------------------------------------
// Empty / edge strip
// ---------------------------------------------------------------------------

describe("computeDeckSection - empty strip", () => {
  it("returns an empty state with null extents when the strip is entirely outside the deck", () => {
    const points: SyntheticPoint[] = [
      { nodeId: 1, xM: 0, yM: 0, sM: 0, tM: 0, value: 10 },
      { nodeId: 2, xM: 1, yM: 0, sM: 1, tM: 0, value: 20 },
      { nodeId: 3, xM: 0, yM: 1, sM: 0, tM: 1, value: 30 },
    ];
    const nodalFields = makeNodalFieldMap(points);
    const settings: DeckSectionSettings = {
      mode: "longitudinal",
      ordinate: "mxy",
      centerTM: 1000,
      widthM: 1,
    };

    const result = computeDeckSection(nodalFields, settings);

    expect(result.state).toBe("empty");
    expect(result.mode).toBe("longitudinal");
    expect(result.stationAxis).toBe("s");
    expect(result.ordinate).toBe("mxy");
    expect(result.coordinateFrame).toBe("deck-local");
    expect(result.requestedCenterM).toBe(1000);
    expect(result.requestedWidthM).toBe(1);
    expect(result.samples).toEqual([]);
    expect(result.min).toBeNull();
    expect(result.max).toBeNull();
    expect(result.actualStripMinM).toBeNull();
    expect(result.actualStripMaxM).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Union discrimination
// ---------------------------------------------------------------------------

describe("computeDeckSection - union discrimination", () => {
  it("a populated result carries state:'populated' and a non-empty samples array", () => {
    const points: SyntheticPoint[] = [
      { nodeId: 1, xM: 0, yM: 0, sM: 0, tM: 0, value: 5 },
      { nodeId: 2, xM: 1, yM: 0, sM: 1, tM: 0, value: 7 },
    ];
    const nodalFields = makeNodalFieldMap(points);
    const settings: DeckSectionSettings = {
      mode: "longitudinal",
      ordinate: "mx",
      centerTM: 0,
      widthM: 1,
    };

    const result = computeDeckSection(nodalFields, settings);

    expect(result.state).toBe("populated");
    if (result.state === "populated") {
      // TS narrows `samples` to the non-empty tuple shape here.
      expect(result.samples.length).toBeGreaterThan(0);
      expect(result.samples[0]).toBeDefined();
    } else {
      throw new Error("expected populated result");
    }
  });
});

// ---------------------------------------------------------------------------
// Skew invariance: 0 / +19 / -19 degrees, via the public solver facade
// ---------------------------------------------------------------------------

/** Converts the solver facade's `nodalRecovery` evidence array into the
 * app-level `NodalFieldMap` shape `computeDeckSection` consumes. This
 * mirrors (without importing, per this packet's file lease) the conversion
 * `buildNodalFieldMap` performs in `src/app/solverAdapter.ts`. */
function nodalFieldMapFromRecovery(entries: NodalRecoveredPlateResult[]): NodalFieldMap {
  const toPoints = (pick: (e: NodalRecoveredPlateResult) => number): NodalFieldPoint[] =>
    entries.map((e) => ({ nodeId: e.nodeId, xM: e.xM, yM: e.yM, sM: e.sM, tM: e.tM, value: pick(e) }));

  const deflectionPoints = toPoints((e) => e.deflectionMm);
  const mxPoints = toPoints((e) => e.mxKnmPerM);
  const myPoints = toPoints((e) => e.myKnmPerM);
  const mxyPoints = toPoints((e) => e.mxyKnmPerM);

  return {
    deflection: {
      field: "deflection",
      location: "node",
      points: deflectionPoints,
      ...extentOf(deflectionPoints.map((p) => p.value)),
      units: "mm",
    },
    mx: {
      field: "mx",
      location: "node",
      points: mxPoints,
      ...extentOf(mxPoints.map((p) => p.value)),
      units: "kN*m/m",
    },
    my: {
      field: "my",
      location: "node",
      points: myPoints,
      ...extentOf(myPoints.map((p) => p.value)),
      units: "kN*m/m",
    },
    mxy: {
      field: "mxy",
      location: "node",
      points: mxyPoints,
      ...extentOf(mxyPoints.map((p) => p.value)),
      units: "kN*m/m",
    },
  };
}

/** A minimal, proven-convergent skew model: fixed-fixed end edges inclined to
 * follow the actual skew edges, with a single interior wheel. Mirrors
 * `buildSkewModel` in `src/tests/solverFacade.test.ts`, parametrized on the
 * skew angle so the same geometry can be solved at 0deg, +19deg and -19deg. */
function buildSkewModel(skewAngleDeg: number): SlabModel {
  const base = createDefaultModel();
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

/** A centre longitudinal section of `mx`: t-centre at the deck's mid-width,
 * a strip narrow enough (well under the ~0.5m node spacing) to select only
 * the centreline row of nodes, deck-width identically. Because the strip is
 * chosen by deck-local (s, t), the same settings apply verbatim to the
 * 0deg/+19deg/-19deg models even though their global geometry differs. */
const CENTRE_SECTION_SETTINGS: DeckSectionSettings = {
  mode: "longitudinal",
  ordinate: "mx",
  centerTM: 1.5, // widthM / 2 for the 3m-wide model built by buildSkewModel
  widthM: 0.4,
};

describe("computeDeckSection - skew invariance (real solve)", () => {
  it.each([0, 19, -19])(
    "produces a finite, populated centre section of mx at %d degrees skew",
    (skewAngleDeg) => {
      const model = buildSkewModel(skewAngleDeg);
      const payload = runFixedPositionAnalysis(model);

      expect(payload.nodalRecovery).toBeDefined();
      expect(payload.nodalRecovery!.length).toBeGreaterThan(0);

      const nodalFields = nodalFieldMapFromRecovery(payload.nodalRecovery!);
      const result = computeDeckSection(nodalFields, CENTRE_SECTION_SETTINGS);

      expect(result.state).toBe("populated");
      expect(result.mode).toBe("longitudinal");
      expect(result.stationAxis).toBe("s");
      expect(result.ordinate).toBe("mx");
      if (result.state !== "populated") throw new Error("expected populated result");

      expect(result.samples.length).toBeGreaterThan(0);
      for (const sample of result.samples) {
        expect(Number.isFinite(sample.stationM)).toBe(true);
        expect(Number.isFinite(sample.value)).toBe(true);
      }
      expect(Number.isFinite(result.min)).toBe(true);
      expect(Number.isFinite(result.max)).toBe(true);
    },
  );

  it("+19 and -19 degree skew centre sections are sign-consistent (mirror-symmetric loading)", () => {
    const positive = runFixedPositionAnalysis(buildSkewModel(19));
    const negative = runFixedPositionAnalysis(buildSkewModel(-19));

    const positiveSection = computeDeckSection(
      nodalFieldMapFromRecovery(positive.nodalRecovery!),
      CENTRE_SECTION_SETTINGS,
    );
    const negativeSection = computeDeckSection(
      nodalFieldMapFromRecovery(negative.nodalRecovery!),
      CENTRE_SECTION_SETTINGS,
    );

    expect(positiveSection.state).toBe("populated");
    expect(negativeSection.state).toBe("populated");
    if (positiveSection.state !== "populated" || negativeSection.state !== "populated") {
      throw new Error("expected populated results");
    }

    // A single interior wheel at the deck's own centre (s = lengthM/2,
    // t = widthM/2) loads both the +19deg and -19deg models identically in
    // deck-local terms, so their centreline mx samples should match closely
    // in both count and sign pattern (mirroring the skew does not change the
    // deck-local load position or support conditions).
    expect(positiveSection.samples.length).toBe(negativeSection.samples.length);
    for (let i = 0; i < positiveSection.samples.length; i += 1) {
      expect(positiveSection.samples[i].stationM).toBeCloseTo(negativeSection.samples[i].stationM, 6);
      const p = positiveSection.samples[i].value;
      const n = negativeSection.samples[i].value;
      // Same sign (or both ~0) and comparable magnitude.
      expect(Math.sign(p) === Math.sign(n) || (Math.abs(p) < 1e-6 && Math.abs(n) < 1e-6)).toBe(true);
      expect(Math.abs(p - n)).toBeLessThan(Math.max(1e-6, 0.05 * Math.max(Math.abs(p), Math.abs(n))));
    }
  });
});
