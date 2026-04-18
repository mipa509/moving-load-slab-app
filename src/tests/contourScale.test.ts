import { describe, expect, it } from "vitest";
import { createContourScale } from "../app/contourScale";

describe("contour scale", () => {
  it("keeps the true mixed-sign range and places zero proportionally", () => {
    const scale = createContourScale(-3, 7);

    expect(scale.domainMin).toBe(-3);
    expect(scale.domainMax).toBe(7);
    expect(scale.hasZeroTick).toBe(true);
    expect(scale.zeroOffsetPercent).toBeCloseTo(30, 8);
    expect(scale.gradientCss).toContain("30.000%");
    expect(scale.getColor(-3)).not.toBe(scale.getColor(-0.1));
    expect(scale.getColor(0)).not.toBe(scale.getColor(7));
  });

  it("uses only the positive half of the palette for positive-only ranges", () => {
    const scale = createContourScale(2, 8);

    expect(scale.domainMin).toBe(2);
    expect(scale.domainMax).toBe(8);
    expect(scale.hasZeroTick).toBe(false);
    expect(scale.gradientCss).not.toContain("#2166ac");
    expect(scale.getColor(2)).not.toBe(scale.getColor(8));
  });
});
