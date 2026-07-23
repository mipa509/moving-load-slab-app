import { mapGeneralizedMomentToPhysicalCouple } from "../post/reactionMomentMapping";

/**
 * Signed global force/moment equilibrium for the fixed-position analysis.
 *
 * Sign convention (frozen by the mathematical ADR): the right-handed global
 * frame has +z, transverse deflection w, wheel force, and pressure all pointing
 * downward. Applied vertical loads and reactions are therefore positive
 * downward, and global moments about the x/y axes follow r x F. Fixed support
 * actions are stored as the residual `K*u - f`, which already carries the
 * external-action sign; raw spring actions are stored as `+k*u` and are
 * normalized here to the external action `-k*u`.
 *
 * This module is pure. WP-026 integrates its report into the solver result and
 * calls the guard; nothing here mutates solver state or shared result types.
 */

/**
 * Applied vertical (downward-positive) nodal load, kN. Consistent wheel/patch
 * loads are work-conjugate to `w` only (a transverse pressure produces no nodal
 * `betaX/betaY` moment), so applied couples are intentionally not represented
 * here; couples enter only on the reaction side. A future applied-load type that
 * carries nodal moments would need an applied-couple channel added.
 */
export interface NodalVerticalLoad {
  nodeId: number;
  x: number;
  y: number;
  fz: number;
}

/**
 * A single restrained-DOF support action. `value` is the raw stored reaction:
 * for `fixed` it is the residual (already an external action); for `spring` it
 * is `+k*u` and is normalized to `-k*u` here.
 */
export interface SupportActionInput {
  supportId: string;
  nodeId: number;
  x: number;
  y: number;
  dof: "w" | "rx" | "ry";
  kind: "fixed" | "spring";
  value: number;
}

export interface EquilibriumOrigin {
  x: number;
  y: number;
}

export interface EquilibriumResultant {
  fz: number;
  momentX: number;
  momentY: number;
}

export interface SupportEquilibriumContribution {
  supportId: string;
  fz: number;
  momentX: number;
  momentY: number;
}

export interface SignedEquilibriumReport {
  origin: EquilibriumOrigin;
  applied: EquilibriumResultant;
  reaction: EquilibriumResultant;
  bySupport: SupportEquilibriumContribution[];
  /** Signed absolute residual `applied + reaction`; zero for a balanced model. */
  residual: EquilibriumResultant;
  /** Dimensionless residual normalized by the applied force/moment scale. */
  normalizedResidual: EquilibriumResultant;
  scales: {
    sumAbsAppliedForce: number;
    sumAbsAppliedMomentX: number;
    sumAbsAppliedMomentY: number;
    characteristicLengthM: number;
  };
}

export interface EquilibriumInput {
  appliedLoads: NodalVerticalLoad[];
  supportActions: SupportActionInput[];
  origin: EquilibriumOrigin;
  characteristicLengthM: number;
}

export function computeSignedEquilibrium(input: EquilibriumInput): SignedEquilibriumReport {
  const { origin, characteristicLengthM } = input;

  const applied: EquilibriumResultant = { fz: 0, momentX: 0, momentY: 0 };
  let sumAbsAppliedForce = 0;
  let sumAbsAppliedMomentX = 0;
  let sumAbsAppliedMomentY = 0;
  for (const load of input.appliedLoads) {
    const leverX = load.x - origin.x;
    const leverY = load.y - origin.y;
    applied.fz += load.fz;
    applied.momentX += leverY * load.fz;
    applied.momentY += -leverX * load.fz;
    sumAbsAppliedForce += Math.abs(load.fz);
    sumAbsAppliedMomentX += Math.abs(leverY * load.fz);
    sumAbsAppliedMomentY += Math.abs(leverX * load.fz);
  }

  const reaction: EquilibriumResultant = { fz: 0, momentX: 0, momentY: 0 };
  const bySupportMap = new Map<string, SupportEquilibriumContribution>();
  const claimedFixedDofs = new Set<string>();
  for (const action of input.supportActions) {
    if (action.kind === "fixed") {
      claimedFixedDofs.add(dofKey(action));
    }
  }

  const countedFixedDofs = new Set<string>();
  for (const action of input.supportActions) {
    // A fixed DOF residual is a property of the DOF, not of a support, so count
    // it once even if several supports claim it. A spring on a DOF that is also
    // fixed does not act; the fixed restraint takes precedence.
    if (action.kind === "fixed") {
      if (countedFixedDofs.has(dofKey(action))) {
        continue;
      }
      countedFixedDofs.add(dofKey(action));
    } else if (claimedFixedDofs.has(dofKey(action))) {
      continue;
    }

    const external = action.kind === "fixed" ? action.value : -action.value;
    const contribution = actionContribution(action, external, origin);
    reaction.fz += contribution.fz;
    reaction.momentX += contribution.momentX;
    reaction.momentY += contribution.momentY;
    accumulateSupport(bySupportMap, action.supportId, contribution);
  }

  // Surface every support that submitted an action, even one whose only action
  // was a deduplicated (redundant) fixed DOF absorbed by another support: it
  // appears with a zero contribution rather than silently vanishing, so a
  // per-support report can still see it and detect the duplication.
  for (const action of input.supportActions) {
    if (!bySupportMap.has(action.supportId)) {
      bySupportMap.set(action.supportId, { supportId: action.supportId, fz: 0, momentX: 0, momentY: 0 });
    }
  }

  const residual: EquilibriumResultant = {
    fz: applied.fz + reaction.fz,
    momentX: applied.momentX + reaction.momentX,
    momentY: applied.momentY + reaction.momentY,
  };

  const forceScale = Math.max(sumAbsAppliedForce, 1);
  // The moment-scale denominators use per-axis applied-moment magnitudes, which
  // are origin-dependent. The moment residual numerator is origin-independent
  // only for a force-balanced system; a force imbalance trips the force residual
  // regardless, so the origin-sensitivity of the normalized moment threshold is
  // not exploitable. The caller fixes the origin (the ADR reporting origin).
  const momentScaleX = Math.max(sumAbsAppliedForce * characteristicLengthM + sumAbsAppliedMomentX, 1);
  const momentScaleY = Math.max(sumAbsAppliedForce * characteristicLengthM + sumAbsAppliedMomentY, 1);
  const normalizedResidual: EquilibriumResultant = {
    fz: Math.abs(residual.fz) / forceScale,
    momentX: Math.abs(residual.momentX) / momentScaleX,
    momentY: Math.abs(residual.momentY) / momentScaleY,
  };

  return {
    origin,
    applied,
    reaction,
    bySupport: [...bySupportMap.values()],
    residual,
    normalizedResidual,
    scales: {
      sumAbsAppliedForce,
      sumAbsAppliedMomentX,
      sumAbsAppliedMomentY,
      characteristicLengthM,
    },
  };
}

function dofKey(action: SupportActionInput): string {
  return `${action.nodeId}:${action.dof}`;
}

function actionContribution(
  action: SupportActionInput,
  external: number,
  origin: EquilibriumOrigin,
): EquilibriumResultant {
  if (action.dof === "w") {
    const leverX = action.x - origin.x;
    const leverY = action.y - origin.y;
    return { fz: external, momentX: leverY * external, momentY: -leverX * external };
  }

  // Rotational restraints contribute a physical couple (no vertical force) via
  // the WP-031A generalized-moment mapping [coupleX, coupleY] = [-G_betaY, G_betaX].
  const generalized =
    action.dof === "rx"
      ? { conjugateToBetaX: external, conjugateToBetaY: 0 }
      : { conjugateToBetaX: 0, conjugateToBetaY: external };
  const couple = mapGeneralizedMomentToPhysicalCouple(generalized);
  return { fz: 0, momentX: couple.coupleX, momentY: couple.coupleY };
}

function accumulateSupport(
  bySupport: Map<string, SupportEquilibriumContribution>,
  supportId: string,
  contribution: EquilibriumResultant,
): void {
  const existing = bySupport.get(supportId);
  if (existing) {
    existing.fz += contribution.fz;
    existing.momentX += contribution.momentX;
    existing.momentY += contribution.momentY;
    return;
  }
  bySupport.set(supportId, {
    supportId,
    fz: contribution.fz,
    momentX: contribution.momentX,
    momentY: contribution.momentY,
  });
}
