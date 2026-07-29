import { describe, expect, it } from "vitest";
import { createDefaultModel } from "../app/defaults";
import { buildPresetSupports } from "../app/supportPresets";
import { runFixedAnalysis } from "../app/solverAdapter";
import type { ResultField, SlabModel } from "../app/types";

// WP-050: exercise the integrated 19-degree user journey through the real
// solver + adapter (no mocks), asserting the analytical core of the acceptance
// journey — a 19-degree deck solves with every result field, reactions,
// equilibrium, verification statuses, and the mandatory experimental warning,
// while zero-skew stays unchanged. Camera/probe/print framing and the manual
// end-to-end workflow are evidenced separately by browser screenshots.

const skewModel = (skewAngleDeg: number, preset: "fixed-fixed" | "pinned-pinned"): SlabModel => {
  const base = createDefaultModel();
  const geometry = { ...base.geometry, skewAngleDeg };
  return { ...base, geometry, supports: buildPresetSupports(geometry, preset) };
};

const MOMENT_AND_SHEAR: Exclude<ResultField, "reactions">[] = [
  "deflection",
  "mx",
  "my",
  "mxy",
  "qx",
  "qy",
];

describe("WP-050 — integrated 19-degree user journey", () => {
  it("solves a 19-degree deck with all fields, reactions, equilibrium, verification, and the warning", async () => {
    const result = await runFixedAnalysis(skewModel(19, "fixed-fixed"));

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    // Step 5: every result field is populated as a nodal contour.
    for (const field of MOMENT_AND_SHEAR) {
      expect(result.nodalContours[field]?.points.length ?? 0).toBeGreaterThan(0);
    }

    // Step 8: support distributions and a signed-equilibrium check are present.
    expect(result.reactionDistributions?.length ?? 0).toBeGreaterThan(0);
    expect(Number.isFinite(result.equilibrium?.normalizedResidual.forceZ ?? Number.NaN)).toBe(true);
    expect(Math.abs(result.equilibrium?.normalizedResidual.forceZ ?? 1)).toBeLessThan(1e-3);

    // Step 11: non-zero skew requires the experimental warning, and all three
    // verification statuses are reported.
    expect(result.warningRequired).toBe(true);
    expect(typeof result.verification?.formulation).toBe("string");
    expect(typeof result.verification?.referenceStudy19Deg).toBe("string");
    expect(typeof result.verification?.currentModelConvergence).toBe("string");
  });

  it("reconciles reaction-distribution vertical totals against the applied load", async () => {
    const result = await runFixedAnalysis(skewModel(19, "pinned-pinned"));
    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    const distributions = result.reactionDistributions ?? [];
    expect(distributions.length).toBeGreaterThan(0);

    const totalReactionFz = distributions.reduce((sum, d) => sum + d.totals.forceZKn, 0);
    const appliedFz = result.equilibrium?.applied.forceZKn ?? 0;
    expect(appliedFz).toBeGreaterThan(0);
    // Reactions balance the applied vertical load (opposite sign); the pinned
    // edges carry every nodal reaction, so the distribution totals reconcile.
    const tolerance = Math.max(0.5, 0.01 * Math.abs(appliedFz));
    expect(Math.abs(totalReactionFz + appliedFz)).toBeLessThan(tolerance);
  });

  it("keeps zero-skew unchanged: solves without the experimental warning", async () => {
    const result = await runFixedAnalysis(createDefaultModel());
    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.warningRequired ?? false).toBe(false);
    expect(result.nodalContours.mxy?.points.length ?? 0).toBeGreaterThan(0);
  });
});
