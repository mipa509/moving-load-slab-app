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
    expect(result.error).toMatch(/solver unavailable/i);
  });

  it("rejects empty contour payloads instead of inventing fallback results", async () => {
    runFixedPositionAnalysisMock.mockResolvedValue({
      contours: {},
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
          dof: "uz",
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
    expect(result.wheelPatches).toEqual([]);
  });
});
