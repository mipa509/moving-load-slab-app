import { describe, it, expect } from "vitest";
import { buildVertexColors } from "../viewer/math/interpolateField";
import { createContourScale } from "../app/contourScale";

describe("buildVertexColors", () => {
  it("returns 3 floats per value entry", () => {
    const scale = createContourScale(0, 1);
    const colors = buildVertexColors(new Float32Array([0, 0.5, 1]), scale);
    expect(colors.length).toBe(9);
  });

  it("all color components are in the 0-1 range", () => {
    const scale = createContourScale(-10, 10);
    const colors = buildVertexColors(new Float32Array([-10, 0, 10]), scale);
    for (const c of colors) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1.001);
    }
  });

  it("uniform values produce identical colours at every vertex", () => {
    const scale = createContourScale(5, 5);
    const colors = buildVertexColors(new Float32Array([5, 5, 5]), scale);
    expect(colors[0]).toBeCloseTo(colors[3], 4);
    expect(colors[1]).toBeCloseTo(colors[4], 4);
    expect(colors[2]).toBeCloseTo(colors[5], 4);
  });
});
