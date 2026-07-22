import { describe, expect, it } from "vitest";
import {
  computeSignedEquilibrium,
  type EquilibriumInput,
  type SupportActionInput,
} from "../solver/core/equilibrium";
import { assertEquilibriumWithinTolerance } from "../solver/analysisGuards";

const ORIGIN = { x: 0, y: 0 };
const LCHAR = 4;

function fixedW(
  supportId: string,
  nodeId: number,
  x: number,
  y: number,
  value: number,
): SupportActionInput {
  return { supportId, nodeId, x, y, dof: "w", kind: "fixed", value };
}

function baseInput(overrides: Partial<EquilibriumInput> = {}): EquilibriumInput {
  return {
    appliedLoads: [{ nodeId: 0, x: 2, y: 1, fz: 100 }],
    supportActions: [
      fixedW("A", 1, 0, 0, -50),
      fixedW("B", 2, 4, 2, -50),
    ],
    origin: ORIGIN,
    characteristicLengthM: LCHAR,
    ...overrides,
  };
}

describe("signed force/moment equilibrium", () => {
  it("balances an eccentric vertical load with asymmetric fixed reactions", () => {
    const report = computeSignedEquilibrium(baseInput());

    expect(report.applied.fz).toBeCloseTo(100, 9);
    expect(report.applied.momentX).toBeCloseTo(100, 9); // (y - 0) * fz
    expect(report.applied.momentY).toBeCloseTo(-200, 9); // -(x - 0) * fz
    expect(report.reaction.fz).toBeCloseTo(-100, 9);
    expect(report.reaction.momentX).toBeCloseTo(-100, 9);
    expect(report.reaction.momentY).toBeCloseTo(200, 9);

    expect(report.residual.fz).toBeCloseTo(0, 9);
    expect(report.residual.momentX).toBeCloseTo(0, 9);
    expect(report.residual.momentY).toBeCloseTo(0, 9);
    expect(report.normalizedResidual.fz).toBeLessThan(1e-12);
    expect(report.normalizedResidual.momentX).toBeLessThan(1e-12);
    expect(report.normalizedResidual.momentY).toBeLessThan(1e-12);
  });

  it("normalizes a raw spring reaction (+k*u) to the external action (-k*u)", () => {
    // Same balance, but reactions are stored as raw +k*u (positive) spring values.
    const report = computeSignedEquilibrium(
      baseInput({
        supportActions: [
          { supportId: "A", nodeId: 0, x: 0, y: 0, dof: "w", kind: "spring", value: 50 },
          { supportId: "B", nodeId: 1, x: 4, y: 2, dof: "w", kind: "spring", value: 50 },
        ],
      }),
    );
    expect(report.reaction.fz).toBeCloseTo(-100, 9);
    expect(report.residual.fz).toBeCloseTo(0, 9);
    expect(report.residual.momentX).toBeCloseTo(0, 9);
    expect(report.residual.momentY).toBeCloseTo(0, 9);
  });

  it("balances a mixed fixed and spring support set", () => {
    const report = computeSignedEquilibrium(
      baseInput({
        supportActions: [
          { supportId: "A", nodeId: 0, x: 0, y: 0, dof: "w", kind: "fixed", value: -50 },
          { supportId: "B", nodeId: 1, x: 4, y: 2, dof: "w", kind: "spring", value: 50 },
        ],
      }),
    );
    expect(report.reaction.fz).toBeCloseTo(-100, 9);
    expect(report.residual.fz).toBeCloseTo(0, 9);
  });

  it("deduplicates a fixed DOF claimed by two supports and attributes it once", () => {
    const report = computeSignedEquilibrium({
      appliedLoads: [{ nodeId: 5, x: 1, y: 1, fz: 100 }],
      supportActions: [
        { supportId: "A", nodeId: 5, x: 1, y: 1, dof: "w", kind: "fixed", value: -100 },
        { supportId: "B", nodeId: 5, x: 1, y: 1, dof: "w", kind: "fixed", value: -100 },
      ],
      origin: ORIGIN,
      characteristicLengthM: LCHAR,
    });

    // The shared fixed DOF residual is counted once, not doubled.
    expect(report.reaction.fz).toBeCloseTo(-100, 9);
    expect(report.residual.fz).toBeCloseTo(0, 9);
    const totalBySupport = report.bySupport.reduce((sum, entry) => sum + entry.fz, 0);
    expect(totalBySupport).toBeCloseTo(report.reaction.fz, 9);
  });

  it("balances a global moment with a generalized rotational reaction via WP-031A mapping", () => {
    // Load on the y-axis (x = 0) needs a couple, not just a vertical reaction.
    const report = computeSignedEquilibrium({
      appliedLoads: [{ nodeId: 0, x: 0, y: 1, fz: 100 }],
      supportActions: [
        { supportId: "A", nodeId: 1, x: 0, y: 0, dof: "w", kind: "fixed", value: -100 },
        // conjugateToBetaY = 100 -> coupleX = -100 (balances applied momentX = +100)
        { supportId: "A", nodeId: 1, x: 0, y: 0, dof: "ry", kind: "fixed", value: 100 },
      ],
      origin: ORIGIN,
      characteristicLengthM: LCHAR,
    });

    expect(report.applied.momentX).toBeCloseTo(100, 9);
    expect(report.reaction.momentX).toBeCloseTo(-100, 9);
    expect(report.residual.fz).toBeCloseTo(0, 9);
    expect(report.residual.momentX).toBeCloseTo(0, 9);
    expect(report.residual.momentY).toBeCloseTo(0, 9);
  });

  it("handles zero applied moment without dividing by zero in normalization", () => {
    const report = computeSignedEquilibrium({
      appliedLoads: [{ nodeId: 0, x: 0, y: 0, fz: 100 }],
      supportActions: [{ supportId: "A", nodeId: 1, x: 0, y: 0, dof: "w", kind: "fixed", value: -100 }],
      origin: ORIGIN,
      characteristicLengthM: LCHAR,
    });
    expect(report.applied.momentX).toBeCloseTo(0, 9);
    expect(report.applied.momentY).toBeCloseTo(0, 9);
    expect(Number.isFinite(report.normalizedResidual.momentX)).toBe(true);
    expect(Number.isFinite(report.normalizedResidual.momentY)).toBe(true);
    expect(report.normalizedResidual.momentX).toBeLessThan(1e-12);
  });

  it("reports a nonzero normalized residual for an unbalanced reaction set", () => {
    const report = computeSignedEquilibrium(
      baseInput({
        supportActions: [fixedW("A", 1, 0, 0, -50), fixedW("B", 2, 4, 2, 0)],
      }),
    );
    // Missing 50 kN of reaction against 100 kN of applied load.
    expect(report.residual.fz).toBeCloseTo(50, 9);
    expect(report.normalizedResidual.fz).toBeCloseTo(0.5, 9);
  });

  it("gives fixed restraint precedence over a spring on the same DOF", () => {
    const report = computeSignedEquilibrium({
      appliedLoads: [{ nodeId: 0, x: 0, y: 0, fz: 100 }],
      supportActions: [
        { supportId: "A", nodeId: 1, x: 0, y: 0, dof: "w", kind: "fixed", value: -100 },
        // Spring on the same DOF must be ignored (the DOF is held by the fixed support).
        { supportId: "B", nodeId: 1, x: 0, y: 0, dof: "w", kind: "spring", value: 999 },
      ],
      origin: ORIGIN,
      characteristicLengthM: LCHAR,
    });
    expect(report.reaction.fz).toBeCloseTo(-100, 9);
    expect(report.residual.fz).toBeCloseTo(0, 9);
  });

  it("keeps the moment residual origin-independent for a force-balanced system", () => {
    const atOrigin = computeSignedEquilibrium(baseInput({ origin: { x: 0, y: 0 } }));
    const shifted = computeSignedEquilibrium(baseInput({ origin: { x: -3, y: 2.5 } }));
    expect(shifted.residual.momentX).toBeCloseTo(atOrigin.residual.momentX, 9);
    expect(shifted.residual.momentY).toBeCloseTo(atOrigin.residual.momentY, 9);
    expect(shifted.residual.momentX).toBeCloseTo(0, 9);
  });

  it("attributes per-support totals that sum to the global reaction resultant", () => {
    const report = computeSignedEquilibrium(baseInput());
    expect(report.bySupport.map((entry) => entry.supportId).sort()).toEqual(["A", "B"]);
    const totalFz = report.bySupport.reduce((sum, entry) => sum + entry.fz, 0);
    const totalMx = report.bySupport.reduce((sum, entry) => sum + entry.momentX, 0);
    expect(totalFz).toBeCloseTo(report.reaction.fz, 9);
    expect(totalMx).toBeCloseTo(report.reaction.momentX, 9);
  });
});

describe("equilibrium guard", () => {
  it("passes a balanced system and rejects an unbalanced one", () => {
    const balanced = computeSignedEquilibrium(baseInput());
    expect(() => assertEquilibriumWithinTolerance(balanced, 1e-6)).not.toThrow();

    const unbalanced = computeSignedEquilibrium(
      baseInput({ supportActions: [fixedW("A", 1, 0, 0, -50), fixedW("B", 2, 4, 2, 0)] }),
    );
    expect(() => assertEquilibriumWithinTolerance(unbalanced, 1e-6)).toThrow(/equilibrium residual/i);
  });
});
