import { describe, expect, it } from "vitest";
import { clusterDirectWheelsByLongitudinal } from "../app/vehicleClustering";
import type { DirectWheelInput } from "../app/types";

const wheel = (id: string, xM: number, loadKn = 10, yM = 0): DirectWheelInput => ({
  id,
  xM,
  yM,
  loadKn,
  patchLongM: 0.3,
  patchTransM: 0.2,
});

describe("clusterDirectWheelsByLongitudinal", () => {
  it("returns an empty array for no wheels", () => {
    expect(clusterDirectWheelsByLongitudinal([], 0.05)).toEqual([]);
  });

  it("returns one cluster per wheel when wheels are well separated", () => {
    const clusters = clusterDirectWheelsByLongitudinal(
      [wheel("a", 0, 10), wheel("b", 1.5, 12), wheel("c", 3.0, 15)],
      0.05,
    );
    expect(clusters).toHaveLength(3);
    expect(clusters[0].xM).toBeCloseTo(0, 6);
    expect(clusters[1].xM).toBeCloseTo(1.5, 6);
    expect(clusters[2].xM).toBeCloseTo(3.0, 6);
    expect(clusters.map((c) => c.totalLoadKn)).toEqual([10, 12, 15]);
    expect(clusters.map((c) => c.wheelCount)).toEqual([1, 1, 1]);
  });

  it("merges wheels within the tolerance and sums their loads", () => {
    const clusters = clusterDirectWheelsByLongitudinal(
      [
        wheel("a", 1.0, 10),
        wheel("b", 1.02, 11),
        wheel("c", 1.04, 12),
        wheel("d", 2.0, 13),
      ],
      0.05,
    );
    expect(clusters).toHaveLength(2);
    expect(clusters[0].totalLoadKn).toBeCloseTo(33, 6);
    expect(clusters[0].wheelCount).toBe(3);
    expect(clusters[0].xM).toBeGreaterThan(0.99);
    expect(clusters[0].xM).toBeLessThan(1.05);
    expect(clusters[1].xM).toBeCloseTo(2.0, 6);
    expect(clusters[1].totalLoadKn).toBeCloseTo(13, 6);
  });

  it("outputs clusters sorted ascending by xM regardless of input order", () => {
    const clusters = clusterDirectWheelsByLongitudinal(
      [wheel("a", 3.0, 10), wheel("b", 1.0, 11), wheel("c", 2.0, 12)],
      0.05,
    );
    expect(clusters.map((c) => Number(c.xM.toFixed(3)))).toEqual([1, 2, 3]);
  });
});
