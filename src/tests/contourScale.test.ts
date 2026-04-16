import { describe, expect, it } from "vitest";
import { createContourScale } from "../app/contourScale";

describe("contour scale", () => {
  it("centers zero for mixed-sign result ranges", () => {
    const scale = createContourScale(-3, 7);

    expect(scale.domainMin).toBe(-7);
    expect(scale.domainMax).toBe(7);
    expect(scale.hasZeroTick).toBe(true);
    expect(scale.zeroOffsetPercent).toBeCloseTo(50, 8);
  });

  it("uses only the positive half of the palette for positive-only ranges", () => {
    const scale = createContourScale(2, 8);

    expect(scale.domainMin).toBe(2);
    expect(scale.domainMax).toBe(8);
    expect(scale.hasZeroTick).toBe(false);
    expect(scale.getColor(2)).not.toBe(scale.getColor(8));
  });
});
