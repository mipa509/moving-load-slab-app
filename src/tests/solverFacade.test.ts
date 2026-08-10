import { describe, expect, it } from "vitest";
import { createDefaultModel } from "../app/defaults";
import { runFixedPositionAnalysis } from "../solver";
import { deckLocalToGlobal } from "../solver/geometry/deckCoordinates";
import { normalizeSolverGeometry } from "../solver/model/fromAppModel";
import type { SlabModel } from "../app/types";

/**
 * WP-032A facade coverage: `runFixedPositionAnalysis` (the public facade in
 * `src/solver/index.ts`) must transport the full skew-general evidence the
 * internal solver already produces (nodal recovery incl. mxy, signed
 * equilibrium, mesh quality, deck geometry, wheel-patch polygons) while
 * keeping every pre-existing (deprecated) payload field intact.
 */

const EXPECTED_DEFAULT_WHEEL_COUNT = 4; // 2 axles x 2 wheels/axle (see app/defaults.ts)

/** A minimal, proven-convergent 19-degree skew model: fixed-fixed end edges,
 * inclined to follow the actual skew edges, with a single interior wheel.
 * Mirrors the model-building pattern in src/tests/skewSolverIntegration.test.ts
 * (which builds the same geometry directly against the internal solver),
 * translated to the app-level SlabModel the facade accepts. */
function buildSkewModel(): SlabModel {
  const base = createDefaultModel();
  const skewAngleDeg = 19;
  const lengthM = 6;
  const widthM = 3;
  const thicknessM = 0.4;

  const geometry = normalizeSolverGeometry({
    lengthX: lengthM,
    lengthY: widthM,
    thickness: thicknessM,
    skewAngleDeg,
  });

  const startLower = deckLocalToGlobal(geometry, { s: 0, t: 0 });
  const startUpper = deckLocalToGlobal(geometry, { s: 0, t: widthM });
  const endLower = deckLocalToGlobal(geometry, { s: lengthM, t: 0 });
  const endUpper = deckLocalToGlobal(geometry, { s: lengthM, t: widthM });
  const wheel = deckLocalToGlobal(geometry, { s: lengthM / 2, t: widthM / 2 });

  const fixedConstraints = {
    uz: { type: "fixed" as const },
    rx: { type: "fixed" as const },
    ry: { type: "fixed" as const },
  };

  return {
    ...base,
    geometry: { lengthM, widthM, thicknessM, skewAngleDeg },
    supports: [
      {
        id: "S1",
        name: "Start edge",
        kind: "line",
        x1: startLower.x,
        y1: startLower.y,
        x2: startUpper.x,
        y2: startUpper.y,
        constraints: fixedConstraints,
      },
      {
        id: "S2",
        name: "End edge",
        kind: "line",
        x1: endLower.x,
        y1: endLower.y,
        x2: endUpper.x,
        y2: endUpper.y,
        constraints: fixedConstraints,
      },
    ],
    vehicle: {
      ...base.vehicle,
      mode: "direct",
      directWheels: [
        { id: "W1", xM: wheel.x, yM: wheel.y, loadKn: 100, patchLongM: 0.4, patchTransM: 0.4 },
      ],
    },
  };
}

describe("solver facade (WP-032A evidence transport)", () => {
  it("returns a fully populated, well-formed payload for a zero-skew solve", () => {
    const payload = runFixedPositionAnalysis(createDefaultModel());

    expect(payload.deckPolygon).toBeDefined();
    expect(payload.deckPolygon!.length).toBeGreaterThan(0);

    expect(payload.meshNodeOverlays).toBeDefined();
    const firstNode = payload.meshNodeOverlays![0];
    expect(Number.isFinite(firstNode.sM)).toBe(true);
    expect(Number.isFinite(firstNode.tM)).toBe(true);

    expect(payload.meshElementOverlays).toBeDefined();
    expect(payload.meshElementOverlays![0].polygon).toHaveLength(4);

    expect(payload.wheelPatchOverlays).toBeDefined();
    expect(payload.wheelPatchOverlays).toHaveLength(EXPECTED_DEFAULT_WHEEL_COUNT);

    expect(payload.nodalRecovery).toBeDefined();
    expect(payload.nodalRecovery).toHaveLength(payload.meshNodeOverlays!.length);
    for (const node of payload.nodalRecovery!) {
      expect(Number.isFinite(node.mxyKnmPerM)).toBe(true);
    }

    expect(payload.elementResultsFull).toBeDefined();
    for (const element of payload.elementResultsFull!) {
      expect(Number.isFinite(element.sM)).toBe(true);
      expect(Number.isFinite(element.tM)).toBe(true);
      expect(Number.isFinite(element.mxyKnmPerM)).toBe(true);
    }

    expect(payload.meshQuality).toBeDefined();
    expect(["ok", "warning"]).toContain(payload.meshQuality!.status);

    expect(payload.reactions.length).toBeGreaterThan(0);
    for (const row of payload.reactions) {
      expect(Number.isFinite(row.xM)).toBe(true);
      expect(Number.isFinite(row.yM)).toBe(true);
    }
  });

  it("reports a signed, balanced global equilibrium about a finite origin", () => {
    const payload = runFixedPositionAnalysis(createDefaultModel());

    expect(payload.equilibrium).toBeDefined();
    expect(payload.equilibrium!.normalizedResidual.forceZ).toBeLessThan(1e-5);
    expect(Number.isFinite(payload.equilibrium!.originM.xM)).toBe(true);
    expect(Number.isFinite(payload.equilibrium!.originM.yM)).toBe(true);
  });

  it("defaults verification to conditional/not-run/not-demonstrated and warningRequired to false at zero skew", () => {
    const payload = runFixedPositionAnalysis(createDefaultModel());

    expect(payload.verification).toEqual({
      formulation: "conditional",
      referenceStudy19Deg: "not-run",
      currentModelConvergence: "not-demonstrated",
      evidenceIds: [],
    });
    expect(payload.verification!.currentModelConvergence).toBe("not-demonstrated");
    expect(payload.warningRequired).toBe(false);
  });

  it("flags warningRequired for a solved 19-degree skew model", () => {
    const payload = runFixedPositionAnalysis(buildSkewModel());

    expect(payload.warningRequired).toBe(true);
    expect(payload.equilibrium!.normalizedResidual.forceZ).toBeLessThan(1e-5);
  });

  it("keeps legacy (deprecated) fields intact for back-compat", () => {
    const payload = runFixedPositionAnalysis(createDefaultModel());

    expect(payload.mesh.xCoordsM.length).toBeGreaterThan(0);
    expect(payload.nodalContours.mx.points.length).toBeGreaterThan(0);
  });
});
