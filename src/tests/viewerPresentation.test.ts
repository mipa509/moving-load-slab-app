import { describe, expect, it } from "vitest";
import { idleResults } from "../app/defaults";
import { PLOT_MODES } from "../app/plotModes";
import {
  deriveViewerLayerVisibility,
  getViewerContour,
  shouldShowViewerContours,
} from "../viewer/viewerPresentation";

describe("viewer presentation", () => {
  it("uses nodal contour data for the active viewer field", () => {
    const results = idleResults();
    results.contours.deflection = {
      field: "deflection",
      min: -5,
      max: 5,
      units: "mm",
      points: [{ xM: 0.5, yM: 0.5, value: -5 }],
    };
    results.nodalContours.deflection = {
      field: "deflection",
      min: -2,
      max: 3,
      units: "mm",
      points: [
        { nodeId: 0, xM: 0, yM: 0, value: -2 },
        { nodeId: 1, xM: 1, yM: 0, value: 3 },
      ],
    };

    const contour = getViewerContour(results, "deflection");

    expect(contour?.min).toBe(-2);
    expect(contour?.max).toBe(3);
  });

  it("returns no contour for the reactions view", () => {
    const results = idleResults();
    results.nodalContours.deflection = {
      field: "deflection",
      min: -1,
      max: 1,
      units: "mm",
      points: [{ nodeId: 0, xM: 0, yM: 0, value: -1 }],
    };

    expect(getViewerContour(results, "reactions")).toBeUndefined();
  });

  it("shows contour-driven viewer overlays only in result-bearing modes with contours enabled", () => {
    const contour = {
      field: "deflection" as const,
      min: -1,
      max: 2,
      units: "mm",
      points: [{ nodeId: 0, xM: 0, yM: 0, value: -1 }],
    };
    const display = {
      plotMode: "results" as const,
      mesh: true,
      supports: true,
      wheelPatches: true,
      contours: true,
      tables: true,
    };

    expect(shouldShowViewerContours("results", display, contour)).toBe(true);
    expect(shouldShowViewerContours("deformed", display, contour)).toBe(true);
    expect(shouldShowViewerContours("structure", display, contour)).toBe(false);
    expect(shouldShowViewerContours("mesh", display, contour)).toBe(false);
    expect(
      shouldShowViewerContours("results", { ...display, contours: false }, contour),
    ).toBe(false);
    expect(shouldShowViewerContours("results", display, undefined)).toBe(false);
  });

  it("derives scene layer visibility from the shared viewport helper rules", () => {
    const contour = {
      field: "deflection" as const,
      min: -1,
      max: 2,
      units: "mm",
      points: [{ nodeId: 0, xM: 0, yM: 0, value: -1 }],
    };
    const display = {
      plotMode: "mesh" as const,
      mesh: false,
      supports: false,
      wheelPatches: false,
      contours: true,
      tables: true,
    };

    expect(deriveViewerLayerVisibility("mesh", display, contour)).toEqual({
      showContours: false,
      showMesh: true,
      showSupports: true,
      showWheelPatches: false,
    });
    expect(deriveViewerLayerVisibility("deformed", display, contour)).toEqual({
      showContours: true,
      showMesh: true,
      showSupports: true,
      showWheelPatches: true,
    });
  });
});

describe("plot modes", () => {
  it("includes the deformed mode in the shared UI options", () => {
    expect(PLOT_MODES).toEqual(["structure", "mesh", "results", "deformed"]);
  });
});
