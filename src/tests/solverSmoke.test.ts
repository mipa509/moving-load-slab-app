import { describe, expect, it } from "vitest";
import { summarizeReactions } from "../app/reactionSummary";
import { runFixedPositionAnalysis } from "../solver/runFixedPositionAnalysis";
import type { FixedPositionAnalysisModel } from "../solver/model/types";

function buildSmokeModel(): FixedPositionAnalysisModel {
  return {
    slab: {
      lengthX: 4,
      lengthY: 2,
      thickness: 0.3,
    },
    material: {
      elasticModulusMPa: 30000,
      poissonRatio: 0.2,
    },
    mesh: {
      targetElementsX: 8,
      targetElementsY: 4,
    },
    supports: [
      { kind: "line", id: "x0", behavior: "fixed", x1: 0, y1: 0, x2: 0, y2: 2 },
      { kind: "line", id: "x4", behavior: "fixed", x1: 4, y1: 0, x2: 4, y2: 2 },
      { kind: "line", id: "y0", behavior: "fixed", x1: 0, y1: 0, x2: 4, y2: 0 },
      { kind: "line", id: "y2", behavior: "fixed", x1: 0, y1: 2, x2: 4, y2: 2 },
    ],
    vehicle: {
      kind: "explicit-wheels",
      coordinateSystem: "global-slab",
      direction: "+x",
      wheels: [
        {
          id: "W1",
          x: 2,
          y: 1,
          load: 100,
          patchLength: 0.4,
          patchWidth: 0.4,
          direction: "+x",
        },
      ],
    },
    options: {
      cgTolerance: 1e-10,
      cgAbsoluteTolerance: 1e-12,
      cgMaxIterations: 3000,
    },
  };
}

describe("solver smoke", () => {
  it("converges and maintains basic vertical load-reaction equilibrium", () => {
    const result = runFixedPositionAnalysis(buildSmokeModel());

    expect(result.diagnostics.converged).toBe(true);
    expect(result.wheelPatches.length).toBe(1);
    expect(result.summary.totalWheelLoad).toBeCloseTo(100, 8);
    expect(result.summary.totalAppliedLoadToSlab).toBeCloseTo(100, 6);

    const imbalance = Math.abs(
      Math.abs(result.summary.totalVerticalReaction) - result.summary.totalAppliedLoadToSlab,
    );
    expect(imbalance).toBeLessThan(1e-4);

    const reactionSummary = summarizeReactions(
      result.supportReactions.map((reaction) => ({
        supportId: reaction.supportId,
        nodeId: reaction.nodeId,
        dof: reaction.dof === "w" ? "uz" : reaction.dof,
        type: reaction.type,
        value: reaction.value,
        units: reaction.dof === "w" ? "kN" : "kN*m",
      })),
    );
    const aggregatedImbalance = Math.abs(
      Math.abs(reactionSummary.reactionTotals.uz) - result.summary.totalAppliedLoadToSlab,
    );

    expect(aggregatedImbalance).toBeLessThan(1e-4);
  });
});
