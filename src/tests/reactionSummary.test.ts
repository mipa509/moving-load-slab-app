import { describe, expect, it } from "vitest";
import { summarizeReactions } from "../app/reactionSummary";

describe("reaction summary", () => {
  it("collapses multiple nodal rows into per-support sums", () => {
    const result = summarizeReactions([
      { supportId: "Line-1", nodeId: 10, dof: "uz", type: "fixed", value: 30, units: "kN" },
      { supportId: "Line-1", nodeId: 11, dof: "uz", type: "fixed", value: 45, units: "kN" },
      { supportId: "Line-1", nodeId: 11, dof: "ry", type: "fixed", value: 8, units: "kN*m" },
      { supportId: "Point-2", nodeId: 17, dof: "rx", type: "fixed", value: 5, units: "kN*m" },
    ]);

    expect(result.reactionSummaryBySupport).toEqual([
      { supportId: "Line-1", uz: 75, rx: 0, ry: 8 },
      { supportId: "Point-2", uz: 0, rx: 5, ry: 0 },
    ]);
  });

  it("returns grand totals that match the summed support rows", () => {
    const result = summarizeReactions([
      { supportId: "S1", nodeId: 1, dof: "uz", type: "fixed", value: 20, units: "kN" },
      { supportId: "S2", nodeId: 2, dof: "uz", type: "fixed", value: 35, units: "kN" },
      { supportId: "S2", nodeId: 3, dof: "rx", type: "fixed", value: 9, units: "kN*m" },
      { supportId: "S3", nodeId: 4, dof: "ry", type: "fixed", value: -4, units: "kN*m" },
    ]);

    expect(result.reactionTotals).toEqual({ uz: 55, rx: 9, ry: -4 });
  });

  it("deduplicates fixed-node totals while preserving per-support sums", () => {
    const result = summarizeReactions([
      { supportId: "x0", nodeId: 8, dof: "uz", type: "fixed", value: 14, units: "kN" },
      { supportId: "y0", nodeId: 8, dof: "uz", type: "fixed", value: 14, units: "kN" },
    ]);

    expect(result.reactionSummaryBySupport).toEqual([
      { supportId: "x0", uz: 14, rx: 0, ry: 0 },
      { supportId: "y0", uz: 14, rx: 0, ry: 0 },
    ]);
    expect(result.reactionTotals).toEqual({ uz: 14, rx: 0, ry: 0 });
  });
});
