import { describe, expect, it } from "vitest";
import { idleResults } from "../app/defaults";
import { PLOT_MODES } from "../app/plotModes";
import {
  clampViewerProbePosition,
  deriveViewerDeformation,
  deriveViewerLayerVisibility,
  getViewerContour,
  shouldShowViewerContours,
  shouldShowViewerProbe,
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
    expect(
      shouldShowViewerContours("results", { ...display, contours: false }, contour),
    ).toBe(false);
    expect(shouldShowViewerContours("results", display, undefined)).toBe(false);
  });

  it("allows probing in structure and results but not in deformed mode", () => {
    const contour = {
      field: "deflection" as const,
      min: -1,
      max: 2,
      units: "mm",
      points: [{ nodeId: 0, xM: 0, yM: 0, value: -1 }],
    };

    expect(shouldShowViewerProbe("structure", contour)).toBe(true);
    expect(shouldShowViewerProbe("results", contour)).toBe(true);
    expect(shouldShowViewerProbe("deformed", contour)).toBe(false);
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
      plotMode: "structure" as const,
      mesh: false,
      supports: true,
      wheelPatches: false,
      contours: true,
      tables: true,
    };

    expect(deriveViewerLayerVisibility("structure", display, contour)).toEqual({
      showContours: false,
      showMesh: false,
      showSupports: true,
      showWheelPatches: false,
    });
    expect(deriveViewerLayerVisibility("deformed", display, contour)).toEqual({
      showContours: true,
      showMesh: false,
      showSupports: true,
      showWheelPatches: false,
    });
  });

  it("derives auto-fit deformation exaggeration from actual nodal deflection", () => {
    const deformation = deriveViewerDeformation(
      [
        { nodeId: 0, wM: -0.01 },
        { nodeId: 1, wM: 0.02 },
      ],
      12,
      1.5,
    );

    expect(deformation.hasVisibleDeformation).toBe(true);
    expect(deformation.baseExaggeration).toBeCloseTo(48, 8);
    expect(deformation.effectiveExaggeration).toBeCloseTo(72, 8);
    expect(deformation.centerZ).toBeCloseTo(-0.36, 8);
    expect(deformation.zSpan).toBeCloseTo(2.16, 8);
  });

  it("keeps the slab flat when there is no finite positive deflection", () => {
    const deformation = deriveViewerDeformation(
      [
        { nodeId: 0, wM: 0 },
        { nodeId: 1, wM: Number.NaN },
      ],
      12,
      2,
    );

    expect(deformation.hasVisibleDeformation).toBe(false);
    expect(deformation.effectiveExaggeration).toBe(0);
  });

  it("clamps the cursor-follow tooltip inside the canvas bounds", () => {
    expect(clampViewerProbePosition(20, 18, 640, 520)).toEqual({
      left: 34,
      top: 10,
    });
    expect(clampViewerProbePosition(620, 500, 640, 520)).toEqual({
      left: 432,
      top: 444,
    });
  });
});

describe("plot modes", () => {
  it("keeps only structure, results, and deformed in the shared UI options", () => {
    expect(PLOT_MODES).toEqual(["structure", "results", "deformed"]);
  });
});
