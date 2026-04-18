import { describe, it, expect, vi } from "vitest";
import { buildZDisplacements } from "../viewer/math/deformGeometry";

describe("buildZDisplacements", () => {
  it("returns undefined when deformScale is 0", () => {
    const result = buildZDisplacements(4, 0, [{ nodeId: 0, wM: 0.001 }]);
    expect(result).toBeUndefined();
  });

  it("returns undefined when deformScale is negative", () => {
    const result = buildZDisplacements(4, -5, [{ nodeId: 0, wM: 0.001 }]);
    expect(result).toBeUndefined();
  });

  it("returns undefined when no displacements provided", () => {
    const result = buildZDisplacements(4, 10, []);
    expect(result).toBeUndefined();
  });

  it("returns Float32Array with correct length", () => {
    const result = buildZDisplacements(4, 1, [{ nodeId: 0, wM: 0.001 }]);
    expect(result).toBeInstanceOf(Float32Array);
    expect(result!.length).toBe(4);
  });

  it("maps displacements to correct node indices", () => {
    const displacements = [
      { nodeId: 0, wM: 0.001 },
      { nodeId: 1, wM: 0.002 },
      { nodeId: 2, wM: 0.003 },
      { nodeId: 3, wM: 0.004 },
    ];
    const result = buildZDisplacements(4, 1, displacements);
    expect(result![0]).toBeCloseTo(0.001);
    expect(result![1]).toBeCloseTo(0.002);
    expect(result![2]).toBeCloseTo(0.003);
    expect(result![3]).toBeCloseTo(0.004);
  });

  it("can invert displacement sign for viewer-space deformation", () => {
    const result = buildZDisplacements(2, 1, [{ nodeId: 0, wM: 0.002 }], -1);
    expect(result![0]).toBeCloseTo(-0.002);
    expect(result![1]).toBe(0);
  });

  it("unmapped nodes remain zero", () => {
    const displacements = [{ nodeId: 0, wM: 0.005 }];
    const result = buildZDisplacements(4, 1, displacements);
    expect(result![0]).toBeCloseTo(0.005);
    expect(result![1]).toBe(0);
    expect(result![2]).toBe(0);
    expect(result![3]).toBe(0);
  });

  it("skips out-of-range nodeIds with warning", () => {
    const displacements = [
      { nodeId: 0, wM: 0.001 },
      { nodeId: 99, wM: 0.999 }, // out of range
    ];
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = buildZDisplacements(4, 1, displacements);
    expect(result![0]).toBeCloseTo(0.001);
    expect(result![1]).toBe(0);
    expect(result![2]).toBe(0);
    expect(result![3]).toBe(0);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
