// Advisory for high plan-skew, where the sheared structured quadrilateral mesh
// becomes distorted enough that results are unreliable for anything beyond very
// rough screening. This is INTENTIONALLY stricter than the internal mesh-quality
// screen (src/solver/core/meshQuality.ts): a uniform sheared-quad mesh only
// trips that screen's scaled-Jacobian/interior-angle thresholds at ~60 deg skew,
// whereas established practice moves to triangular / mixed / refined meshing well
// before that. So this advisory fires on the SKEW ANGLE directly, independent of
// the Jacobian screen, to warn the engineer where practice — not just numerics —
// says the sheared-quad idealisation is questionable.
//
// It is advisory only: it does not block analysis and does not, on its own,
// change the mandatory non-zero-skew experimental warning (which stays for ALL
// non-zero skew until G7 / CEng sign-off).

/** Skew magnitude (degrees) at/above which the sheared-quad mesh advisory fires. */
export const SKEW_MESH_ADVISORY_DEG = 30;

/**
 * Returns the high-skew mesh advisory message when `|skewAngleDeg|` is at or
 * above `SKEW_MESH_ADVISORY_DEG`, otherwise `null`. Non-finite input is treated
 * as no advisory.
 */
export function skewMeshAdvisory(skewAngleDeg: number): string | null {
  if (!Number.isFinite(skewAngleDeg)) {
    return null;
  }
  if (Math.abs(skewAngleDeg) < SKEW_MESH_ADVISORY_DEG) {
    return null;
  }
  return (
    `Skew ${SKEW_MESH_ADVISORY_DEG} deg or more: the sheared quadrilateral mesh is ` +
    `strongly distorted at this angle and its results are unreliable — treat them as ` +
    `very rough screening only. A triangular or refined mesh is recommended for skew ` +
    `this high; this tool does not provide one.`
  );
}
