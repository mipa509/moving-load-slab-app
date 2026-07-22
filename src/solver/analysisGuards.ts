import type {
  ElementCenterResult,
  FixedPositionAnalysisSummary,
  NodalFieldValues,
  NodalDisplacement,
  SupportDofAssignment,
  SupportReaction,
} from "./model/types";
import type { SignedEquilibriumReport } from "./core/equilibrium";

export function assertStableSupportConfiguration(assignments: SupportDofAssignment[]): void {
  if (assignments.length === 0) {
    throw new Error(
      "Analysis could not start because no supports were mapped to the mesh. Add at least one support with a vertical uz restraint or spring.",
    );
  }

  if (!assignments.some((assignment) => assignment.dof === "w")) {
    throw new Error(
      "Analysis could not start because no vertical uz restraints were mapped to the mesh. Add at least one support with a vertical uz fixed or spring restraint.",
    );
  }
}

export function assertValidSolverState(input: {
  converged: boolean;
  residualNorm: number;
  initialResidualNorm: number;
  nodalDisplacements: NodalDisplacement[];
  elementResults: ElementCenterResult[];
  supportReactions: SupportReaction[];
  summary: FixedPositionAnalysisSummary;
}): void {
  if (!input.converged) {
    throw new Error(
      "Analysis did not converge. Check that the slab has enough vertical restraints and rotational stability before using Results 2D or Deformed 3D.",
    );
  }

  assertFiniteNumber(input.residualNorm, "solver residual norm");
  assertFiniteNumber(input.initialResidualNorm, "initial solver residual norm");

  input.nodalDisplacements.forEach((node, index) => {
    assertFiniteNumber(node.x, `nodal displacement ${index} x`);
    assertFiniteNumber(node.y, `nodal displacement ${index} y`);
    assertFiniteNumber(node.w, `nodal displacement ${index} w`);
    assertFiniteNumber(node.rx, `nodal displacement ${index} rx`);
    assertFiniteNumber(node.ry, `nodal displacement ${index} ry`);
  });

  input.elementResults.forEach((element, index) => {
    assertFiniteNumber(element.center.x, `element result ${index} center x`);
    assertFiniteNumber(element.center.y, `element result ${index} center y`);
    assertFiniteNumber(element.deflection, `element result ${index} deflection`);
    assertFiniteNumber(element.moments.mx, `element result ${index} mx`);
    assertFiniteNumber(element.moments.my, `element result ${index} my`);
    assertFiniteNumber(element.moments.mxy, `element result ${index} mxy`);
    assertFiniteNumber(element.shears.qx, `element result ${index} qx`);
    assertFiniteNumber(element.shears.qy, `element result ${index} qy`);
  });

  input.supportReactions.forEach((reaction, index) => {
    assertFiniteNumber(reaction.x, `support reaction ${index} x`);
    assertFiniteNumber(reaction.y, `support reaction ${index} y`);
    assertFiniteNumber(reaction.value, `support reaction ${index} value`);
    assertFiniteNumber(reaction.displacement, `support reaction ${index} displacement`);
    if (reaction.springStiffness !== undefined) {
      assertFiniteNumber(reaction.springStiffness, `support reaction ${index} spring stiffness`);
    }
  });

  assertFiniteNumber(input.summary.totalWheelLoad, "summary total wheel load");
  assertFiniteNumber(input.summary.totalAppliedLoadToSlab, "summary total applied load");
  assertFiniteNumber(input.summary.totalVerticalReaction, "summary total vertical reaction");
  assertFiniteNumber(input.summary.minDeflection, "summary min deflection");
  assertFiniteNumber(input.summary.maxDeflection, "summary max deflection");
  assertFiniteNumber(input.summary.maxAbsMomentX, "summary max abs moment x");
  assertFiniteNumber(input.summary.maxAbsMomentY, "summary max abs moment y");
  assertFiniteNumber(input.summary.maxAbsMomentXY, "summary max abs moment xy");
  assertFiniteNumber(input.summary.maxAbsShearX, "summary max abs shear x");
  assertFiniteNumber(input.summary.maxAbsShearY, "summary max abs shear y");
}

export function assertFiniteNodalFieldValues(nodalFields: NodalFieldValues[]): void {
  nodalFields.forEach((node, index) => {
    assertFiniteNumber(node.x, `nodal field ${index} x`);
    assertFiniteNumber(node.y, `nodal field ${index} y`);
    assertFiniteNumber(node.deflection, `nodal field ${index} deflection`);
    assertFiniteNumber(node.mx, `nodal field ${index} mx`);
    assertFiniteNumber(node.my, `nodal field ${index} my`);
    assertFiniteNumber(node.mxy, `nodal field ${index} mxy`);
    assertFiniteNumber(node.qx, `nodal field ${index} qx`);
    assertFiniteNumber(node.qy, `nodal field ${index} qy`);
  });
}

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Analysis produced a non-finite ${label}. Check the support restraints and rerun.`);
  }
}

/**
 * Reject a solve whose signed global equilibrium residual exceeds a tolerance
 * that the caller ties to the integration precision and iterative solver
 * residual (never an arbitrary display percentage). All three normalized
 * residuals (vertical force and both global moments) must be within tolerance.
 */
export function assertEquilibriumWithinTolerance(
  report: SignedEquilibriumReport,
  normalizedTolerance: number,
): void {
  const worst = Math.max(
    report.normalizedResidual.fz,
    report.normalizedResidual.momentX,
    report.normalizedResidual.momentY,
  );
  if (!Number.isFinite(worst) || worst > normalizedTolerance) {
    throw new Error(
      `Global equilibrium residual ${worst} exceeds tolerance ${normalizedTolerance}. ` +
        "The assembled load, support reactions, or their signs are inconsistent; do not rely on the results.",
    );
  }
}
