import { describe, expect, expectTypeOf, it } from "vitest";
import { errorResults, idleResults } from "../app/defaults";
import type {
  AnalysisResults,
  ElementFieldMap,
  MeshQualityReport,
  NodalFieldMap,
  NodalKinematics,
  PhysicalActionTotals,
  SectionCurve,
  SignedEquilibrium,
  StagedSkewAppContract,
  SupportReactionDistribution,
  SupportReactionRow,
  VerificationEvidenceStatus,
  WheelPatchOverlay,
} from "../app/types";

describe("WP-032B: live AnalysisResults evidence contract", () => {
  it("declares the new evidence fields as optional on the flat live interface", () => {
    expectTypeOf<AnalysisResults["deckPolygon"]>().toEqualTypeOf<
      Array<{ xM: number; yM: number }> | undefined
    >();
    expectTypeOf<AnalysisResults["deckBounds"]>().toEqualTypeOf<
      { xMinM: number; xMaxM: number; yMinM: number; yMaxM: number } | undefined
    >();
    expectTypeOf<AnalysisResults["meshNodeOverlays"]>().toEqualTypeOf<
      StagedSkewAppContract.MeshNodeOverlayV2[] | undefined
    >();
    expectTypeOf<AnalysisResults["meshElementOverlays"]>().toEqualTypeOf<
      StagedSkewAppContract.MeshElementOverlayV2[] | undefined
    >();
    expectTypeOf<AnalysisResults["wheelPatchOverlays"]>().toEqualTypeOf<
      WheelPatchOverlay[] | undefined
    >();
    expectTypeOf<AnalysisResults["nodalKinematics"]>().toEqualTypeOf<
      NodalKinematics[] | undefined
    >();
    expectTypeOf<AnalysisResults["nodalFields"]>().toEqualTypeOf<
      NodalFieldMap | undefined
    >();
    expectTypeOf<AnalysisResults["elementFields"]>().toEqualTypeOf<
      ElementFieldMap | undefined
    >();
    expectTypeOf<AnalysisResults["physicalReactions"]>().toEqualTypeOf<
      SupportReactionRow[] | undefined
    >();
    expectTypeOf<AnalysisResults["physicalReactionSummaryBySupport"]>().toEqualTypeOf<
      Array<PhysicalActionTotals & { supportId: string }> | undefined
    >();
    expectTypeOf<AnalysisResults["physicalReactionTotals"]>().toEqualTypeOf<
      PhysicalActionTotals | undefined
    >();
    expectTypeOf<AnalysisResults["reactionDistributions"]>().toEqualTypeOf<
      SupportReactionDistribution[] | undefined
    >();
    expectTypeOf<AnalysisResults["sections"]>().toEqualTypeOf<SectionCurve[] | undefined>();
    expectTypeOf<AnalysisResults["envelopeV2"]>().toEqualTypeOf<
      StagedSkewAppContract.EnvelopeDataV2 | undefined
    >();
    expectTypeOf<AnalysisResults["equilibrium"]>().toEqualTypeOf<
      SignedEquilibrium | undefined
    >();
    expectTypeOf<AnalysisResults["meshQuality"]>().toEqualTypeOf<
      MeshQualityReport | undefined
    >();
    expectTypeOf<AnalysisResults["verification"]>().toEqualTypeOf<
      VerificationEvidenceStatus | undefined
    >();
    expectTypeOf<AnalysisResults["warningRequired"]>().toEqualTypeOf<boolean | undefined>();
  });

  it("keeps AnalysisResults spreadable/synthesizable as a flat interface (App.tsx pattern)", () => {
    const running: AnalysisResults = { ...idleResults(), status: "running" };
    expect(running.status).toBe("running");
    // Optional fields remain unset without violating the type.
    expect(running.equilibrium).toBeUndefined();
    expect(running.meshQuality).toBeUndefined();
  });
});

describe("WP-032B: idle/error default verification evidence", () => {
  it("idleResults() reports non-demonstrated convergence and no warning by default", () => {
    const results = idleResults();

    expect(results.verification?.currentModelConvergence).toBe("not-demonstrated");
    expect(results.verification?.formulation).toBe("conditional");
    expect(results.verification?.referenceStudy19Deg).toBe("not-run");
    expect(results.verification?.evidenceIds).toEqual([]);
    expect(results.warningRequired).toBe(false);
  });

  it("errorResults() inherits the same conservative verification evidence", () => {
    const results = errorResults("x");

    expect(results.verification?.currentModelConvergence).toBe("not-demonstrated");
    expect(results.warningRequired).toBe(false);
    expect(results.status).toBe("error");
    expect(results.error).toBe("x");
  });
});
