import { describe, expect, it } from "vitest";
import {
  assertFiniteNodalFieldValues,
  assertStableSupportConfiguration,
  assertValidSolverState,
} from "../solver/analysisGuards";
import type { SupportDofAssignment } from "../solver/model/types";

describe("analysis guards", () => {
  it("rejects runs with no mapped supports", () => {
    expect(() => assertStableSupportConfiguration([])).toThrow(/no supports were mapped/i);
  });

  it("rejects runs with no mapped vertical restraint path", () => {
    const assignments: SupportDofAssignment[] = [
      { supportId: "S1", nodeId: 0, dof: "rx", kind: "fixed" },
      { supportId: "S1", nodeId: 0, dof: "ry", kind: "fixed" },
    ];

    expect(() => assertStableSupportConfiguration(assignments)).toThrow(/vertical uz restraints/i);
  });

  it("rejects non-converged solver states", () => {
    expect(() =>
      assertValidSolverState({
        converged: false,
        residualNorm: 1,
        initialResidualNorm: 2,
        nodalDisplacements: [],
        elementResults: [],
        supportReactions: [],
        summary: {
          totalWheelLoad: 0,
          totalAppliedLoadToSlab: 0,
          totalVerticalReaction: 0,
          minDeflection: 0,
          maxDeflection: 0,
          maxAbsMomentX: 0,
          maxAbsMomentY: 0,
          maxAbsMomentXY: 0,
          maxAbsShearX: 0,
          maxAbsShearY: 0,
        },
      }),
    ).toThrow(/did not converge/i);
  });

  it("rejects non-finite recovered fields", () => {
    expect(() =>
      assertFiniteNodalFieldValues([
        {
          nodeId: 0,
          x: 0,
          y: 0,
          deflection: Number.NaN,
          mx: 0,
          my: 0,
          qx: 0,
          qy: 0,
        },
      ]),
    ).toThrow(/non-finite nodal field 0 deflection/i);
  });
});
