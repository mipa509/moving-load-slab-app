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
    expect(result.error).toMatch(/no nodal contour field data/i);
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
      nodalContours: {
        deflection: {
          field: "deflection",
          points: [{ nodeId: 0, xM: 0.5, yM: 0.5, value: -2 }],
          min: -2,
          max: -2,
          units: "mm",
        },
      },
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

  it("populates skew-general evidence fields from a real (zero-skew) solve", async () => {
    // Delegate the mocked facade to the real implementation for this test only,
    // so we exercise actual solver output rather than a hand-written payload.
    const actualSolver = await vi.importActual<typeof import("../solver")>("../solver");
    runFixedPositionAnalysisMock.mockImplementation(actualSolver.runFixedPositionAnalysis);

    const result = await runFixedAnalysis(createDefaultModel());

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.equilibrium).toBeDefined();
    expect(Number.isFinite(result.equilibrium?.normalizedResidual.forceZ)).toBe(true);
    expect(Number.isFinite(result.equilibrium?.normalizedResidual.momentX)).toBe(true);
    expect(Number.isFinite(result.equilibrium?.normalizedResidual.momentY)).toBe(true);

    expect(["ok", "warning"]).toContain(result.meshQuality?.status);

    expect(typeof result.verification?.currentModelConvergence).toBe("string");

    expect(result.nodalFields?.mxy.points.length).toBeGreaterThan(0);
    result.nodalFields?.mxy.points.forEach((p) => {
      expect(Number.isFinite(p.value)).toBe(true);
    });

    expect(result.elementFields?.qx.location).toBe("element-center");

    expect(result.meshNodeOverlays?.[0]).toBeDefined();
    expect(Number.isFinite(result.meshNodeOverlays?.[0]?.sM)).toBe(true);
    expect(Number.isFinite(result.meshNodeOverlays?.[0]?.tM)).toBe(true);

    expect(result.meshElementOverlays?.[0]?.polygon.length).toBe(4);

    expect((result.wheelPatchOverlays?.length ?? 0)).toBeGreaterThan(0);
  });

  it("rejects a malformed meshElementOverlays polygon instead of synthesizing evidence", async () => {
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
      nodalContours: {
        deflection: {
          field: "deflection",
          points: [{ nodeId: 0, xM: 0.5, yM: 0.5, value: -2 }],
          min: -2,
          max: -2,
          units: "mm",
        },
      },
      meshNodes: [],
      meshElements: [],
      nodalDisplacements: [],
      mesh: { xCoordsM: [0, 1], yCoordsM: [0, 1] },
      wheelPatches: [],
      reactions: [],
      summary: { maxDeflectionMm: 2, maxAbsMomentKnmPerM: 0, maxAbsShearKnPerM: 0 },
      meshElementOverlays: [
        {
          id: 0,
          nodeIds: [0, 1, 2, 3],
          // Malformed: only 3 vertices instead of the required 4.
          polygon: [
            { xM: 0, yM: 0 },
            { xM: 1, yM: 0 },
            { xM: 1, yM: 1 },
          ],
          bounds: { xMinM: 0, xMaxM: 1, yMinM: 0, yMaxM: 1 },
        },
      ],
    });

    const result = await runFixedAnalysis(createDefaultModel());

    expect(result.status).toBe("error");
    expect(result.error).toMatch(/meshElementOverlays/i);
  });

  it("rejects a malformed equilibrium payload instead of synthesizing zero residual", async () => {
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
      nodalContours: {
        deflection: {
          field: "deflection",
          points: [{ nodeId: 0, xM: 0.5, yM: 0.5, value: -2 }],
          min: -2,
          max: -2,
          units: "mm",
        },
      },
      meshNodes: [],
      meshElements: [],
      nodalDisplacements: [],
      mesh: { xCoordsM: [0, 1], yCoordsM: [0, 1] },
      wheelPatches: [],
      reactions: [],
      summary: { maxDeflectionMm: 2, maxAbsMomentKnmPerM: 0, maxAbsShearKnPerM: 0 },
      equilibrium: {
        originM: { xM: 0, yM: 0 },
        applied: { forceZKn: 0, momentXKnm: 0, momentYKnm: 0 },
        reactions: { forceZKn: 0, momentXKnm: 0, momentYKnm: 0 },
        residual: { forceZKn: 0, momentXKnm: 0, momentYKnm: 0 },
        absoluteResidual: { forceZKn: 0, momentXKnm: 0, momentYKnm: 0 },
        // Malformed: non-finite normalized residual.
        normalizedResidual: { forceZ: Number.NaN, momentX: 0, momentY: 0 },
        normalization: { characteristicLengthM: 1, forceScaleKn: 1, momentScaleKnm: 1 },
      },
    });

    const result = await runFixedAnalysis(createDefaultModel());

    expect(result.status).toBe("error");
    expect(result.error).toMatch(/equilibrium/i);
  });
});
