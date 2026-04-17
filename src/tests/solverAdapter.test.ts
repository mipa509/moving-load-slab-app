import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultModel } from "../app/defaults";
import { runFixedAnalysis } from "../app/solverAdapter";
import { runFixedPositionAnalysis } from "../solver";

vi.mock("../solver", () => ({
  runFixedPositionAnalysis: vi.fn(),
}));

const runFixedPositionAnalysisMock = vi.mocked(runFixedPositionAnalysis);

describe("solver adapter", () => {
  beforeEach(() => {
    runFixedPositionAnalysisMock.mockReset();
  });

  it("returns an explicit error state when the solver throws", async () => {
    runFixedPositionAnalysisMock.mockRejectedValue(new Error("solver unavailable"));

    const result = await runFixedAnalysis(createDefaultModel());

    expect(result.status).toBe("error");
    expect(result.source).toBe("solver");
    expect(result.contours).toEqual({});
    expect(result.mesh).toBeUndefined();
    expect(result.wheelPatches).toEqual([]);
    expect(result.reactions).toEqual([]);
    expect(result.reactionSummaryBySupport).toEqual([]);
    expect(result.reactionTotals).toEqual({ uz: 0, rx: 0, ry: 0 });
    expect(result.error).toMatch(/solver unavailable/i);
  });

  it("rejects empty contour payloads instead of inventing fallback results", async () => {
    runFixedPositionAnalysisMock.mockResolvedValue({
      contours: {},
      nodalContours: {},
      meshNodes: [],
      meshElements: [],
      nodalDisplacements: [],
      mesh: {
        xCoordsM: [0, 1],
        yCoordsM: [0, 1],
      },
      wheelPatches: [
        {
          xMinM: 0.2,
          xMaxM: 0.6,
          yMinM: 0.2,
          yMaxM: 0.6,
        },
      ],
      reactions: [
        {
          supportId: "S1",
          nodeId: 0,
          dof: "uz",
          type: "fixed",
          value: 100,
          units: "kN",
        },
      ],
      summary: {
        maxDeflectionMm: 0,
        maxAbsMomentKnmPerM: 0,
        maxAbsShearKnPerM: 0,
      },
    });

    const result = await runFixedAnalysis(createDefaultModel());

    expect(result.status).toBe("error");
    expect(result.error).toMatch(/no contour field data/i);
    expect(result.reactions).toEqual([]);
    expect(result.reactionSummaryBySupport).toEqual([]);
    expect(result.reactionTotals).toEqual({ uz: 0, rx: 0, ry: 0 });
    expect(result.wheelPatches).toEqual([]);
  });

  it("builds aggregated reaction summaries from solver payload reactions", async () => {
    runFixedPositionAnalysisMock.mockResolvedValue({
      contours: {
        deflection: {
          field: "deflection",
          points: [{ xM: 0.5, yM: 0.5, value: -2 }],
          min: -2,
          max: -2,
          units: "mm",
        },
      },
      nodalContours: {},
      meshNodes: [],
      meshElements: [],
      nodalDisplacements: [],
      mesh: {
        xCoordsM: [0, 1],
        yCoordsM: [0, 1],
      },
      wheelPatches: [],
      reactions: [
        { supportId: "S1", nodeId: 1, dof: "uz", type: "fixed", value: 60, units: "kN" },
        { supportId: "S1", nodeId: 2, dof: "uz", type: "fixed", value: 40, units: "kN" },
        { supportId: "S2", nodeId: 2, dof: "rx", type: "fixed", value: 12, units: "kN*m" },
      ],
      summary: {
        maxDeflectionMm: 2,
        maxAbsMomentKnmPerM: 0,
        maxAbsShearKnPerM: 0,
      },
    });

    const result = await runFixedAnalysis(createDefaultModel());

    expect(result.status).toBe("success");
    expect(result.reactionSummaryBySupport).toEqual([
      { supportId: "S1", uz: 100, rx: 0, ry: 0 },
      { supportId: "S2", uz: 0, rx: 12, ry: 0 },
    ]);
    expect(result.reactionTotals).toEqual({ uz: 100, rx: 12, ry: 0 });
  });
});
