import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { computeMindlinQ4ElementStiffness } from "../solver/core/element";
import { assembleWheelPatchLoads } from "../solver/loads/patch";
import { generateWheelPatches } from "../solver/loads/vehicle";
import { runFixedPositionAnalysis } from "../solver/runFixedPositionAnalysis";
import {
  ZERO_SKEW_CHARACTERIZATION_ELEMENT_NODES,
  ZERO_SKEW_CHARACTERIZATION_EXPECTED,
  ZERO_SKEW_CHARACTERIZATION_HASHES,
  ZERO_SKEW_CHARACTERIZATION_MATERIAL,
  ZERO_SKEW_CHARACTERIZATION_MODEL,
  ZERO_SKEW_PRE_MITC4_CHARACTERIZATION_EXPECTED,
} from "../solver/benchmarks/zeroSkewCharacterizationFixture";
import type {
  FixedPositionAnalysisModel,
  FixedPositionAnalysisResult,
} from "../solver/model/types";

const SOLVE_RELATIVE_TOLERANCE = 1e-9;
const ROUND_OFF_MULTIPLIER = 128;

function modelAt(divisions: number): FixedPositionAnalysisModel {
  return {
    ...ZERO_SKEW_CHARACTERIZATION_MODEL,
    mesh: {
      ...ZERO_SKEW_CHARACTERIZATION_MODEL.mesh,
      targetElementsX: divisions,
      targetElementsY: divisions,
    },
  };
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function expectRoundOffClose(actual: number, expected: number): void {
  const tolerance =
    ROUND_OFF_MULTIPLIER *
    Number.EPSILON *
    Math.max(Math.abs(expected), Number.MIN_VALUE);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function maxLocation(
  result: FixedPositionAnalysisResult,
  quantity: "momentX" | "shearX",
): { x: number; y: number } {
  const selected = result.elementResults.reduce((current, candidate) => {
    const currentValue =
      quantity === "momentX" ? current.moments.mx : current.shears.qx;
    const candidateValue =
      quantity === "momentX" ? candidate.moments.mx : candidate.shears.qx;
    return Math.abs(candidateValue) > Math.abs(currentValue)
      ? candidate
      : current;
  });
  return selected.center;
}

describe("EF-004 zero-skew MITC4 rebaseline", () => {
  it("retains the pre-MITC4 provenance and hashes every complete current array", () => {
    const old = ZERO_SKEW_PRE_MITC4_CHARACTERIZATION_EXPECTED;
    const oldHashes = ZERO_SKEW_CHARACTERIZATION_HASHES.preMitc4At352556d;
    expect(hash(old.elementStiffness)).toBe(oldHashes.elementStiffness);
    expect(hash(old.globalLoadVector)).toBe(oldHashes.globalLoadVector);
    expect(hash(old.nodalW)).toBe(oldHashes.nodalW);
    expect(hash(old.nodalRx)).toBe(oldHashes.nodalRx);
    expect(hash(old.nodalRy)).toBe(oldHashes.nodalRy);
    expect(hash(old.verticalReactions)).toBe(oldHashes.verticalReactions);
    expect(hash(old.summary)).toBe(oldHashes.summary);
    expect(hash(old.diagnostics)).toBe(oldHashes.diagnostics);

    const result = runFixedPositionAnalysis(ZERO_SKEW_CHARACTERIZATION_MODEL);
    const loads = assembleWheelPatchLoads(
      result.mesh,
      generateWheelPatches(
        ZERO_SKEW_CHARACTERIZATION_MODEL.vehicle,
        ZERO_SKEW_CHARACTERIZATION_MODEL.slab,
      ),
      result.diagnostics.totalDofs,
    );
    const elementStiffness = Array.from(
      computeMindlinQ4ElementStiffness(
        ZERO_SKEW_CHARACTERIZATION_ELEMENT_NODES,
        ZERO_SKEW_CHARACTERIZATION_MATERIAL,
        ZERO_SKEW_CHARACTERIZATION_MODEL.slab.thickness,
      ),
    );
    const currentHashes =
      ZERO_SKEW_CHARACTERIZATION_HASHES.mitc4From0088e11CapturedAt44084dd;
    expect(hash(elementStiffness)).toBe(currentHashes.elementStiffness);
    expect(hash(Array.from(loads.globalLoadVector))).toBe(
      currentHashes.globalLoadVector,
    );
    expect(hash(result.nodalDisplacements)).toBe(
      currentHashes.nodalDisplacements,
    );
    expect(hash(result.supportReactions)).toBe(currentHashes.supportReactions);
    expect(hash(result.summary)).toBe(currentHashes.summary);
    expect(hash(result.diagnostics)).toBe(currentHashes.diagnostics);

    expect(elementStiffness).toEqual(
      ZERO_SKEW_CHARACTERIZATION_EXPECTED.elementStiffness,
    );
    expect(Array.from(loads.globalLoadVector)).toEqual(
      ZERO_SKEW_CHARACTERIZATION_EXPECTED.globalLoadVector,
    );
  });

  it("records internal refinement behaviour without claiming benchmark validation", () => {
    const evidence = [2, 4, 8, 16].map((divisions) => {
      const result = runFixedPositionAnalysis(modelAt(divisions));
      const centre = result.nodalDisplacements.find(
        (node) => node.x === 1 && node.y === 1,
      );
      expect(centre, `missing centre node at ${divisions}x${divisions}`).toBeDefined();
      return {
        divisions,
        nodeCount: result.mesh.nodes.length,
        elementCount: result.mesh.elements.length,
        centreDeflection: centre?.w ?? Number.NaN,
        ...result.summary,
        converged: result.diagnostics.converged,
        iterations: result.diagnostics.iterations,
        residualNorm: result.diagnostics.residualNorm,
        initialResidualNorm: result.diagnostics.initialResidualNorm,
        totalDofs: result.diagnostics.totalDofs,
        freeDofs: result.diagnostics.freeDofs,
        fixedDofs: result.diagnostics.fixedDofs,
        equilibriumResidual:
          result.summary.totalAppliedLoadToSlab +
          result.summary.totalVerticalReaction,
        maxMomentXLocation: maxLocation(result, "momentX"),
        maxShearXLocation: maxLocation(result, "shearX"),
      };
    });

    for (const item of evidence) {
      const message = JSON.stringify(evidence);
      expect(item.nodeCount).toBe((item.divisions + 1) ** 2);
      expect(item.elementCount).toBe(item.divisions ** 2);
      expect(item.totalDofs).toBe(item.nodeCount * 3);
      expect(item.converged, message).toBe(true);
      expect(item.iterations, message).toBeGreaterThan(0);
      expect(item.iterations, message).toBeLessThanOrEqual(
        ZERO_SKEW_CHARACTERIZATION_MODEL.options?.cgMaxIterations ?? 3000,
      );
      expect(item.totalWheelLoad).toBe(100);
      expect(item.totalAppliedLoadToSlab).toBe(100);
      expect(item.totalVerticalReaction, message).toBeLessThan(0);
      expect(
        Math.abs(item.equilibriumResidual),
        message,
      ).toBeLessThanOrEqual(
        Math.max(
          ZERO_SKEW_CHARACTERIZATION_MODEL.options?.cgAbsoluteTolerance ?? 0,
          Math.sqrt(item.fixedDofs) * item.residualNorm,
        ),
      );
      expect(item.centreDeflection, message).toBeGreaterThan(0);
      expectRoundOffClose(item.maxDeflection, item.centreDeflection);
      for (const value of [
        item.maxAbsMomentX,
        item.maxAbsMomentY,
        item.maxAbsMomentXY,
        item.maxAbsShearX,
        item.maxAbsShearY,
      ]) {
        expect(Number.isFinite(value), message).toBe(true);
        expect(value, message).toBeGreaterThanOrEqual(0);
      }
      expect(
        Math.abs(item.maxAbsMomentX - item.maxAbsMomentY),
        message,
      ).toBeLessThanOrEqual(
        SOLVE_RELATIVE_TOLERANCE *
          Math.max(item.maxAbsMomentX, item.maxAbsMomentY, 1),
      );
      expect(
        Math.abs(item.maxAbsShearX - item.maxAbsShearY),
        message,
      ).toBeLessThanOrEqual(
        SOLVE_RELATIVE_TOLERANCE *
          Math.max(item.maxAbsShearX, item.maxAbsShearY, 1),
      );
    }

    const deflections = evidence.map((item) => item.centreDeflection);
    const deflectionChanges = deflections.slice(1).map(
      (value, index) =>
        Math.abs(value - deflections[index]) / Math.abs(value),
    );
    for (let index = 1; index < deflectionChanges.length; index += 1) {
      expect(
        deflectionChanges[index],
        JSON.stringify({ evidence, deflectionChanges }),
      ).toBeLessThan(deflectionChanges[index - 1]);
    }
    expect(
      deflectionChanges[deflectionChanges.length - 1],
      JSON.stringify({ evidence, deflectionChanges }),
    ).toBeLessThan(0.04);

    // Raw element-centre extrema are deliberately evidence, not release gates.
    // Their sample locations move with the mesh, and the shear maxima approach
    // the 0.75/1.25 m patch edges. The report records their non-converged trend.
  });
});
