import { describe, expect, it } from "vitest";
import type { DisplayToggles } from "../app/types";
import {
  buildLegendTicks,
  deriveViewportLayerVisibility,
  findContourExtrema,
  formatViewportValue,
} from "../components/viewportHelpers";

const baseDisplay: DisplayToggles = {
  plotMode: "results",
  mesh: true,
  supports: true,
  wheelPatches: true,
  contours: true,
  tables: true,
};

describe("viewport helpers", () => {
  it("derives layer visibility for structure and mesh modes", () => {
    expect(
      deriveViewportLayerVisibility(
        "structure",
        { ...baseDisplay, mesh: false, supports: false, wheelPatches: false },
        true,
      ),
    ).toEqual({
      showContours: false,
      showMesh: false,
      showSupports: true,
      showWheelPatches: true,
    });

    expect(
      deriveViewportLayerVisibility(
        "mesh",
        { ...baseDisplay, mesh: false, supports: false, wheelPatches: false },
        true,
      ),
    ).toEqual({
      showContours: false,
      showMesh: true,
      showSupports: true,
      showWheelPatches: false,
    });
  });

  it("formats tiny values without collapsing labels to repeated zeroes", () => {
    const ticks = buildLegendTicks(0.00012, 0.00018);
    const labels = ticks.map((tick) => tick.label);

    expect(new Set(labels).size).toBeGreaterThan(1);
    expect(labels.some((label) => label.includes("-0.000"))).toBe(false);
    expect(formatViewportValue(-0.0000002, 0.00001)).not.toContain("-0.000");
  });

  it("finds sampled extrema from contour points", () => {
    const extrema = findContourExtrema([
      { xM: 1, yM: 1, value: 2.5 },
      { xM: 2, yM: 1, value: -1.2 },
      { xM: 3, yM: 2, value: 4.1 },
    ]);

    expect(extrema).not.toBeNull();
    expect(extrema?.min.value).toBe(-1.2);
    expect(extrema?.max.value).toBe(4.1);
    expect(extrema?.samePoint).toBe(false);
  });
});
