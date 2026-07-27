import { describe, expect, it } from "vitest";
import { runFixedPositionAnalysis } from "../solver/runFixedPositionAnalysis";
import { deckLocalToGlobal } from "../solver/geometry/deckCoordinates";
import { normalizeSolverGeometry } from "../solver/model/fromAppModel";
import type {
  FixedPositionAnalysisModel,
  SupportBehavior,
  SupportDefinition,
} from "../solver/model/types";

/**
 * WP-026 integration coverage: the first point a non-zero-skew slab is solvable
 * through the public solver path (unified skew-general mesh/support/load/
 * equilibrium/recovery pipeline). Skew end supports are expressed as inclined
 * deck-local coordinate lines along the actual skew edges; the ergonomic
 * `EdgeSupport` union arrives later at WP-027.
 */

const LENGTH_X = 6;
const LENGTH_Y = 3;
const THICKNESS = 0.4;
const WHEEL_LOAD = 200;

function globalPoint(skewAngleDeg: number, s: number, t: number): { x: number; y: number } {
  const geometry = normalizeSolverGeometry({
    lengthX: LENGTH_X,
    lengthY: LENGTH_Y,
    thickness: THICKNESS,
    skewAngleDeg,
  });
  return deckLocalToGlobal(geometry, { s, t });
}

function edgeSupports(
  skewAngleDeg: number,
  behavior: SupportBehavior,
): SupportDefinition[] {
  const startLower = globalPoint(skewAngleDeg, 0, 0);
  const startUpper = globalPoint(skewAngleDeg, 0, LENGTH_Y);
  const endLower = globalPoint(skewAngleDeg, LENGTH_X, 0);
  const endUpper = globalPoint(skewAngleDeg, LENGTH_X, LENGTH_Y);
  return [
    { kind: "line", id: "start", behavior, x1: startLower.x, y1: startLower.y, x2: startUpper.x, y2: startUpper.y },
    { kind: "line", id: "end", behavior, x1: endLower.x, y1: endLower.y, x2: endUpper.x, y2: endUpper.y },
  ];
}

function buildSkewModel(options: {
  skewAngleDeg: number;
  behavior: SupportBehavior;
  wheelLocal: { s: number; t: number };
}): FixedPositionAnalysisModel {
  const wheel = globalPoint(options.skewAngleDeg, options.wheelLocal.s, options.wheelLocal.t);
  return {
    slab: { lengthX: LENGTH_X, lengthY: LENGTH_Y, thickness: THICKNESS, skewAngleDeg: options.skewAngleDeg },
    material: { elasticModulusMPa: 30000, poissonRatio: 0.2 },
    mesh: { targetElementsX: 8, targetElementsY: 6 },
    supports: edgeSupports(options.skewAngleDeg, options.behavior),
    vehicle: {
      kind: "explicit-wheels",
      coordinateSystem: "global-slab",
      direction: "+x",
      wheels: [
        { id: "W1", x: wheel.x, y: wheel.y, load: WHEEL_LOAD, patchLength: 0.4, patchWidth: 0.4, direction: "+x" },
      ],
    },
    options: { cgTolerance: 1e-10, cgAbsoluteTolerance: 1e-12, cgMaxIterations: 5000 },
  };
}

describe("skew fixed-position solver integration (WP-026)", () => {
  it("solves a 19-degree fixed-fixed slab and satisfies signed equilibrium", () => {
    const result = runFixedPositionAnalysis(
      buildSkewModel({ skewAngleDeg: 19, behavior: "fixed", wheelLocal: { s: LENGTH_X / 2, t: LENGTH_Y / 2 } }),
    );

    expect(result.diagnostics.converged).toBe(true);
    // A fully interior patch delivers the whole wheel load to the slab.
    expect(result.summary.totalAppliedLoadToSlab).toBeCloseTo(WHEEL_LOAD, 6);

    // Signed global force and both global moment residuals are at solver noise.
    expect(result.equilibrium.normalizedResidual.fz).toBeLessThan(1e-5);
    expect(result.equilibrium.normalizedResidual.momentX).toBeLessThan(1e-5);
    expect(result.equilibrium.normalizedResidual.momentY).toBeLessThan(1e-5);
    expect(result.equilibrium.applied.fz).toBeCloseTo(WHEEL_LOAD, 6);
    expect(result.equilibrium.reaction.fz).toBeCloseTo(-WHEEL_LOAD, 4);

    // Total support reaction balances the applied load.
    expect(Math.abs(result.summary.totalVerticalReaction)).toBeCloseTo(
      result.summary.totalAppliedLoadToSlab,
      4,
    );

    // Twisting moment is recovered at every node and everything is finite.
    expect(result.nodalFields).toHaveLength(result.mesh.nodes.length);
    for (const node of result.nodalFields) {
      expect(Number.isFinite(node.mxy)).toBe(true);
    }

    // The non-zero-skew experimental warning is present until release evidence.
    expect(result.warnings.some((warning) => /experimental/i.test(warning))).toBe(true);
  });

  it("solves a stable 19-degree pinned-pinned slab", () => {
    const result = runFixedPositionAnalysis(
      buildSkewModel({ skewAngleDeg: 19, behavior: "pinned", wheelLocal: { s: LENGTH_X / 2, t: LENGTH_Y / 2 } }),
    );

    expect(result.diagnostics.converged).toBe(true);
    expect(result.equilibrium.normalizedResidual.fz).toBeLessThan(1e-5);
    expect(result.summary.maxDeflection).toBeGreaterThan(0);
  });

  it("mirrors the deflection response under skew sign reversal", () => {
    const plus = runFixedPositionAnalysis(
      buildSkewModel({ skewAngleDeg: 19, behavior: "fixed", wheelLocal: { s: LENGTH_X / 2, t: LENGTH_Y / 2 } }),
    );
    const minus = runFixedPositionAnalysis(
      buildSkewModel({ skewAngleDeg: -19, behavior: "fixed", wheelLocal: { s: LENGTH_X / 2, t: LENGTH_Y / 2 } }),
    );

    // A centrally loaded, symmetrically restrained deck mirrors about y = W/2, so
    // the extreme deflection magnitude is invariant under theta -> -theta.
    expect(minus.summary.minDeflection).toBeCloseTo(plus.summary.minDeflection, 8);
  });

  it("clips a partial wheel patch on the skew lower edge and stays in equilibrium", () => {
    const result = runFixedPositionAnalysis(
      buildSkewModel({ skewAngleDeg: 19, behavior: "fixed", wheelLocal: { s: LENGTH_X / 2, t: 0 } }),
    );

    expect(result.diagnostics.converged).toBe(true);
    // The patch straddles the y = 0 lower edge, so exactly half of it lands on
    // the deck; pressure uses the full contact area (never the clipped area).
    expect(result.summary.totalAppliedLoadToSlab).toBeLessThan(WHEEL_LOAD);
    expect(result.summary.totalAppliedLoadToSlab).toBeCloseTo(WHEEL_LOAD / 2, 6);

    expect(result.equilibrium.normalizedResidual.fz).toBeLessThan(1e-5);
    expect(result.equilibrium.normalizedResidual.momentX).toBeLessThan(1e-5);
    expect(Math.abs(result.summary.totalVerticalReaction)).toBeCloseTo(
      result.summary.totalAppliedLoadToSlab,
      4,
    );
  });

  it("rejects a skew model with no vertical restraint (mechanism)", () => {
    const model = buildSkewModel({ skewAngleDeg: 19, behavior: "custom", wheelLocal: { s: LENGTH_X / 2, t: LENGTH_Y / 2 } });
    // Restrain only the rotational DOFs: no vertical uz restraint anywhere.
    model.supports = model.supports.map((support) => ({
      ...support,
      behavior: "custom",
      dofs: { rx: { kind: "fixed" }, ry: { kind: "fixed" } },
    }));

    expect(() => runFixedPositionAnalysis(model)).toThrow(/vertical uz/i);
  });
});
