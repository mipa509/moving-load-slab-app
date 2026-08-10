import { describe, expect, it } from "vitest";
import {
  deckSectionAxisLabel,
  deckSectionValueLabel,
  toSectionPlotCurve,
} from "../app/deckSectionView";
import type { EmptySectionCurve, PopulatedSectionCurve } from "../app/types";

/**
 * WP-041B coverage for the pure `src/app/deckSectionView.ts` adapter between
 * the app-level deck-local (s/t) `SectionCurve` (types.ts, produced by
 * `computeDeckSection`) and the LOCAL `SectionCurve` shape consumed by
 * `SectionPlot` (sectionCurve.ts). Pure-function tests only, per this
 * packet's constraints (no testing-library/component-render tests exist in
 * this repo).
 */

const populatedDeckCurve = (): PopulatedSectionCurve => ({
  ordinate: "mx",
  coordinateFrame: "deck-local",
  requestedCenterM: 2.5,
  requestedWidthM: 1,
  averaging: "piecewise-linear-width-average",
  units: "kN*m/m",
  mode: "longitudinal",
  stationAxis: "s",
  state: "populated",
  actualStripMinM: 2.1,
  actualStripMaxM: 2.9,
  samples: [
    { stationM: 0, value: 10 },
    { stationM: 1, value: 20 },
    { stationM: 2, value: -5 },
  ],
  min: -5,
  max: 20,
});

const emptyDeckCurve = (): EmptySectionCurve => ({
  ordinate: "mxy",
  coordinateFrame: "deck-local",
  requestedCenterM: 1000,
  requestedWidthM: 1,
  averaging: "piecewise-linear-width-average",
  units: "kN*m/m",
  mode: "transverse",
  stationAxis: "t",
  state: "empty",
  actualStripMinM: null,
  actualStripMaxM: null,
  samples: [],
  min: null,
  max: null,
});

describe("toSectionPlotCurve", () => {
  it("maps a populated deck-local curve onto the local SectionCurve shape", () => {
    const mapped = toSectionPlotCurve(populatedDeckCurve());

    expect(mapped).not.toBeNull();
    expect(mapped!.samples).toEqual([
      { distanceM: 0, value: 10 },
      { distanceM: 1, value: 20 },
      { distanceM: 2, value: -5 },
    ]);
    expect(mapped!.min).toBe(-5);
    expect(mapped!.max).toBe(20);
    expect(mapped!.units).toBe("kN*m/m");
    expect(mapped!.centerPerpM).toBe(2.5);
    expect(mapped!.widthM).toBe(1);
    expect(mapped!.axis).toBe("x");
  });

  it("maps stationAxis 't' onto the local 'y' axis", () => {
    const mapped = toSectionPlotCurve({ ...emptyDeckCurve(), state: "empty" });
    expect(mapped!.axis).toBe("y");
  });

  it("maps an empty deck-local curve to a local curve with empty samples and zeroed extents", () => {
    const mapped = toSectionPlotCurve(emptyDeckCurve());

    expect(mapped).not.toBeNull();
    expect(mapped!.samples).toEqual([]);
    expect(mapped!.min).toBe(0);
    expect(mapped!.max).toBe(0);
    expect(mapped!.units).toBe("kN*m/m");
    expect(mapped!.centerPerpM).toBe(1000);
    expect(mapped!.widthM).toBe(1);
  });

  it("maps null to null", () => {
    expect(toSectionPlotCurve(null)).toBeNull();
  });
});

describe("deckSectionAxisLabel", () => {
  it("labels the longitudinal mode by its s-station axis", () => {
    expect(deckSectionAxisLabel({ mode: "longitudinal" })).toBe("Distance along s (m)");
  });

  it("labels the transverse mode by its t-station axis", () => {
    expect(deckSectionAxisLabel({ mode: "transverse" })).toBe("Distance along t (m)");
  });
});

describe("deckSectionValueLabel", () => {
  it("labels mx as Mxx", () => {
    expect(deckSectionValueLabel("mx")).toBe("Mxx");
  });

  it("labels my as Myy", () => {
    expect(deckSectionValueLabel("my")).toBe("Myy");
  });

  it("labels mxy as Mxy", () => {
    expect(deckSectionValueLabel("mxy")).toBe("Mxy");
  });
});
