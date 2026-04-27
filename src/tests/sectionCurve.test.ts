import { describe, expect, it } from "vitest";
import { computeSectionCurve, resolveSectionAxis } from "../app/sectionCurve";
import type { NodalContourData } from "../app/types";

const buildContour = (): NodalContourData => {
  const points: NodalContourData["points"] = [];
  let nodeId = 0;
  const xs = [0, 1, 2, 3, 4];
  const ys = [0, 1, 2, 3];
  for (const y of ys) {
    for (const x of xs) {
      points.push({
        nodeId: nodeId++,
        xM: x,
        yM: y,
        value: x + y * 10,
      });
    }
  }
  return { field: "mx", points, min: 0, max: 34, units: "kN*m/m" };
};

describe("resolveSectionAxis", () => {
  it("auto follows travel direction", () => {
    expect(resolveSectionAxis("x+", "auto")).toBe("x");
    expect(resolveSectionAxis("x-", "auto")).toBe("x");
    expect(resolveSectionAxis("y+", "auto")).toBe("y");
    expect(resolveSectionAxis("y-", "auto")).toBe("y");
  });

  it("override wins over auto", () => {
    expect(resolveSectionAxis("y+", "x")).toBe("x");
    expect(resolveSectionAxis("x+", "y")).toBe("y");
  });
});

describe("computeSectionCurve", () => {
  it("averages values in a 1m strip along the x-axis at y=2", () => {
    const contour = buildContour();
    const curve = computeSectionCurve(contour, "x", 2, 1);
    // strip captures y in [1.5, 2.5] → only y=2 row
    expect(curve.samples).toHaveLength(5);
    expect(curve.samples.map((s) => s.distanceM)).toEqual([0, 1, 2, 3, 4]);
    expect(curve.samples.map((s) => s.value)).toEqual([20, 21, 22, 23, 24]);
    expect(curve.min).toBe(20);
    expect(curve.max).toBe(24);
  });

  it("averages two rows when the strip spans them", () => {
    const contour = buildContour();
    const curve = computeSectionCurve(contour, "x", 2.5, 1.0);
    // strip captures y in [2.0, 3.0] → y=2 (value=x+20) and y=3 (value=x+30)
    expect(curve.samples).toHaveLength(5);
    expect(curve.samples[0].value).toBeCloseTo((20 + 30) / 2, 6);
    expect(curve.samples[4].value).toBeCloseTo((24 + 34) / 2, 6);
  });

  it("returns empty samples when strip is outside the slab", () => {
    const contour = buildContour();
    const curve = computeSectionCurve(contour, "x", 100, 1);
    expect(curve.samples).toHaveLength(0);
    expect(curve.min).toBe(0);
    expect(curve.max).toBe(0);
  });

  it("works on the y-axis too", () => {
    const contour = buildContour();
    const curve = computeSectionCurve(contour, "y", 2, 1);
    // strip captures x in [1.5, 2.5] → only x=2 column → value = 2 + 10*y
    expect(curve.samples).toHaveLength(4);
    expect(curve.samples.map((s) => s.distanceM)).toEqual([0, 1, 2, 3]);
    expect(curve.samples.map((s) => s.value)).toEqual([2, 12, 22, 32]);
  });
});
