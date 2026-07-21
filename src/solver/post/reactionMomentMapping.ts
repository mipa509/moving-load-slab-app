/** Generalized director parameters in the solver's [betaX, betaY] basis. */
export interface GeneralizedBetaComponents {
  betaX: number;
  betaY: number;
}

/** Physical right-hand rotations about the global x and y axes. */
export interface PhysicalRotationComponents {
  rotationX: number;
  rotationY: number;
}

/** Generalized nodal moments work-conjugate to betaX and betaY. */
export interface GeneralizedNodalMomentComponents {
  conjugateToBetaX: number;
  conjugateToBetaY: number;
}

/** Physical right-hand nodal couples about the global x and y axes. */
export interface PhysicalGlobalCoupleComponents {
  coupleX: number;
  coupleY: number;
}

/**
 * Maps the solver director parameters to physical right-hand rotations:
 * [rotationX, rotationY] = [-betaY, betaX].
 */
export function mapGeneralizedBetaToPhysicalRotation(
  generalized: GeneralizedBetaComponents,
): PhysicalRotationComponents {
  return {
    rotationX: normalizeSignedZero(-generalized.betaY),
    rotationY: normalizeSignedZero(generalized.betaX),
  };
}

/** Inverse of mapGeneralizedBetaToPhysicalRotation. */
export function mapPhysicalRotationToGeneralizedBeta(
  physical: PhysicalRotationComponents,
): GeneralizedBetaComponents {
  return {
    betaX: normalizeSignedZero(physical.rotationY),
    betaY: normalizeSignedZero(-physical.rotationX),
  };
}

/**
 * Maps generalized moments to their virtual-work-conjugate physical couples:
 * [coupleX, coupleY] = [-G_betaY, G_betaX].
 *
 * This is a vector-basis mapping. It must not be used to transform the
 * symmetric plate-moment tensor.
 */
export function mapGeneralizedMomentToPhysicalCouple(
  generalized: GeneralizedNodalMomentComponents,
): PhysicalGlobalCoupleComponents {
  return {
    coupleX: normalizeSignedZero(-generalized.conjugateToBetaY),
    coupleY: normalizeSignedZero(generalized.conjugateToBetaX),
  };
}

/** Inverse of mapGeneralizedMomentToPhysicalCouple. */
export function mapPhysicalCoupleToGeneralizedMoment(
  physical: PhysicalGlobalCoupleComponents,
): GeneralizedNodalMomentComponents {
  return {
    conjugateToBetaX: normalizeSignedZero(physical.coupleY),
    conjugateToBetaY: normalizeSignedZero(-physical.coupleX),
  };
}

function normalizeSignedZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
