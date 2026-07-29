// WP-045: pure, testable content derivations for the printable engineering
// note (`../components/ReportNote.tsx`). Kept out of the component so the
// safety-critical text — the non-zero-skew experimental warning, the three
// SEPARATE verification statuses, the theory statement, and the excluded
// effects — can be unit-tested without rendering React.
//
// Safety intent: the experimental warning is derived ONLY from the analysis
// result (`warningRequired`, set by the solver from geometry), never from any
// `model.display.*` flag or user setting, so no UI toggle can clear it.
import type { AnalysisResults, SlabModel, VerificationEvidenceStatus } from "./types";
import { getNormalSpan, getSupportOffset } from "../solver/geometry/deckCoordinates";

/** The mandatory non-zero-skew experimental warning shown in the report. */
export const REPORT_EXPERIMENTAL_WARNING =
  "EXPERIMENTAL — non-zero-skew analysis is screening-only. The formulation, " +
  "published-benchmark, and independent Chartered-Engineer reviews are not yet " +
  "complete; these results have no G7 checking or CEng sign-off and must not be " +
  "used for design.";

/**
 * Whether the report must show the experimental warning. Derived SOLELY from
 * the analysis result's `warningRequired` (the solver sets it from a non-zero
 * skew angle). It takes no display/UI argument, so it is structurally
 * impossible for any user toggle to clear the warning.
 */
export function reportShowsExperimentalWarning(results: AnalysisResults): boolean {
  return results.warningRequired === true;
}

export const REPORT_THEORY_STATEMENT =
  "Reissner–Mindlin plate bending, discretised with the MITC4 element " +
  "(assumed transverse-shear strain, mitigating shear locking), solved with a " +
  "sparse conjugate-gradient solver. Formulation verification is CONDITIONAL " +
  "and has not been independently reviewed.";

/** Effects the plate solver does not represent — stated so the reader does not
 * assume they are covered. */
export const REPORT_EXCLUDED_EFFECTS: readonly string[] = [
  "In-plane (membrane) action and compositely-acting edge beams",
  "Soil / foundation stiffness and settlement",
  "Abutment, bearing, and diaphragm stiffness",
  "Beam, bar, and rigid-link elements (kerbs, edge beams, plinths)",
  "Thermal, shrinkage, and creep effects",
  "Through-thickness / local effects under the tyre contact patch",
];

export interface ReportVerificationLine {
  label: string;
  status: string;
}

/**
 * The three verification statuses reported SEPARATELY (never collapsed into a
 * single figure): formulation, the stored 19° reference study, and the
 * current-model convergence. When the result carries no verification evidence
 * (idle/error), the conservative defaults are reported.
 */
export function reportVerificationLines(
  verification: VerificationEvidenceStatus | undefined,
): [ReportVerificationLine, ReportVerificationLine, ReportVerificationLine] {
  return [
    { label: "Formulation", status: verification?.formulation ?? "not-checked" },
    {
      label: "Reference study (19°)",
      status: verification?.referenceStudy19Deg ?? "not-run",
    },
    {
      label: "Current-model convergence",
      status: verification?.currentModelConvergence ?? "not-demonstrated",
    },
  ];
}

export interface ReportSkewGeometry {
  isSkew: boolean;
  skewAngleDeg: number;
  centrelineSpanM: number;
  normalSpanM: number;
  widthM: number;
  supportOffsetM: number;
}

/**
 * Skew geometry summary for the structure section: the skew angle, the
 * centreline span (the deck length along the travel/centreline direction), the
 * normal (perpendicular) span between supports, the width, and the support
 * offset that the skew introduces. Reuses the accepted geometry helpers rather
 * than re-deriving.
 */
export function reportSkewGeometry(model: SlabModel): ReportSkewGeometry {
  const skewAngleDeg = model.geometry.skewAngleDeg;
  return {
    isSkew: skewAngleDeg !== 0,
    skewAngleDeg,
    centrelineSpanM: model.geometry.lengthM,
    normalSpanM: getNormalSpan(model.geometry),
    widthM: model.geometry.widthM,
    supportOffsetM: getSupportOffset(model.geometry),
  };
}

export interface ReportEquilibriumStatus {
  available: boolean;
  normalizedForceZ?: number;
  normalizedMomentX?: number;
  normalizedMomentY?: number;
}

/** Equilibrium status line for the report: the normalized signed-equilibrium
 * residuals when available, flagged as a self-consistency (not accuracy)
 * check by the caller. */
export function reportEquilibriumStatus(results: AnalysisResults): ReportEquilibriumStatus {
  const eq = results.equilibrium;
  if (!eq) return { available: false };
  return {
    available: true,
    normalizedForceZ: eq.normalizedResidual.forceZ,
    normalizedMomentX: eq.normalizedResidual.momentX,
    normalizedMomentY: eq.normalizedResidual.momentY,
  };
}

export interface ReportMeshQualityStatus {
  available: boolean;
  status?: "ok" | "warning";
  elementCount?: number;
  diagnosticCount?: number;
}

export function reportMeshQualityStatus(results: AnalysisResults): ReportMeshQualityStatus {
  const mq = results.meshQuality;
  if (!mq) return { available: false };
  return {
    available: true,
    status: mq.status,
    elementCount: mq.elements.length,
    diagnosticCount: mq.diagnostics.length,
  };
}
