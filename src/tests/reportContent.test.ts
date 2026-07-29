import { describe, expect, it } from "vitest";
import type { AnalysisResults, VerificationEvidenceStatus } from "../app/types";
import { createDefaultModel } from "../app/defaults";
import {
  REPORT_EXCLUDED_EFFECTS,
  REPORT_EXPERIMENTAL_WARNING,
  REPORT_THEORY_STATEMENT,
  reportShowsExperimentalWarning,
  reportSkewGeometry,
  reportVerificationLines,
} from "../app/reportContent";

describe("report experimental warning (safety-critical)", () => {
  it("shows the warning exactly when the result requires it", () => {
    expect(reportShowsExperimentalWarning({ warningRequired: true } as AnalysisResults)).toBe(true);
    expect(reportShowsExperimentalWarning({ warningRequired: false } as AnalysisResults)).toBe(false);
    expect(reportShowsExperimentalWarning({} as AnalysisResults)).toBe(false);
  });

  it("depends only on the result, so no display flag can clear it", () => {
    // The function's sole input is the analysis result; there is no display/UI
    // parameter it could read, so a non-zero-skew (warningRequired) result
    // always shows the warning regardless of any user toggle.
    const results = { warningRequired: true, display: undefined } as unknown as AnalysisResults;
    expect(reportShowsExperimentalWarning(results)).toBe(true);
  });

  it("states screening-only and not-for-design", () => {
    expect(REPORT_EXPERIMENTAL_WARNING).toMatch(/screening-only/i);
    expect(REPORT_EXPERIMENTAL_WARNING).toMatch(/must not be used for design/i);
  });
});

describe("report verification statuses (reported separately)", () => {
  it("returns three distinct lines mapping each status", () => {
    const v: VerificationEvidenceStatus = {
      formulation: "conditional",
      referenceStudy19Deg: "not-run",
      currentModelConvergence: "not-demonstrated",
      evidenceIds: [],
    };
    const lines = reportVerificationLines(v);
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.label)).toEqual([
      "Formulation",
      "Reference study (19°)",
      "Current-model convergence",
    ]);
    expect(lines.map((l) => l.status)).toEqual(["conditional", "not-run", "not-demonstrated"]);
  });

  it("uses conservative defaults when no verification evidence is present", () => {
    const lines = reportVerificationLines(undefined);
    expect(lines.map((l) => l.status)).toEqual(["not-checked", "not-run", "not-demonstrated"]);
  });
});

describe("report theory and excluded effects", () => {
  it("states Reissner-Mindlin / MITC4 and a conditional formulation status", () => {
    expect(REPORT_THEORY_STATEMENT).toMatch(/mindlin/i);
    expect(REPORT_THEORY_STATEMENT).toMatch(/mitc4/i);
    expect(REPORT_THEORY_STATEMENT).toMatch(/conditional/i);
  });

  it("lists the required excluded effects", () => {
    const joined = REPORT_EXCLUDED_EFFECTS.join(" | ").toLowerCase();
    for (const term of ["membrane", "soil", "abutment", "diaphragm", "beam", "thermal", "through-thickness"]) {
      expect(joined).toContain(term);
    }
  });
});

describe("report skew geometry", () => {
  it("flags zero skew as non-skew with equal centreline and normal span", () => {
    const model = createDefaultModel();
    const g = reportSkewGeometry(model);
    expect(g.isSkew).toBe(false);
    expect(g.skewAngleDeg).toBe(0);
    expect(g.normalSpanM).toBeCloseTo(g.centrelineSpanM, 6);
    expect(g.supportOffsetM).toBeCloseTo(0, 6);
  });

  it("reports a skewed deck with a shorter normal span and non-zero offset", () => {
    const model = createDefaultModel();
    const skewed = { ...model, geometry: { ...model.geometry, skewAngleDeg: 19 } };
    const g = reportSkewGeometry(skewed);
    expect(g.isSkew).toBe(true);
    expect(g.skewAngleDeg).toBe(19);
    expect(g.normalSpanM).toBeLessThan(g.centrelineSpanM);
    expect(Math.abs(g.supportOffsetM)).toBeGreaterThan(0);
  });
});
