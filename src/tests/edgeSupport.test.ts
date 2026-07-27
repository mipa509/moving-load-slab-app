import { describe, expect, it } from "vitest";
import { createDefaultModel, sanitizeLoadedModel, serializeModelForSave } from "../app/defaults";
import { fromAppModel } from "../solver/model/fromAppModel";
import { getDeckEdgeSegment } from "../solver/geometry/deckCoordinates";
import type { DeckEdge } from "../solver/geometry/types";
import { runFixedPositionAnalysis } from "../solver";
import { buildSupportVisuals } from "../viewer/supportPresentation";
import type { ConstraintSet, SlabGeometry, SlabModel, Support } from "../app/types";

/**
 * WP-027 coverage: the app-level `EdgeSupport` variant (deck edge identity +
 * the existing ConstraintSet model) translates to an inclined solver line at
 * every deck edge/skew combination, persists and rejects invalid identities
 * through the existing V2 schema, renders through the shared overlay
 * geometry, and solves end-to-end through the public facade.
 */

const ALL_EDGES: DeckEdge[] = ["start", "end", "lower-side", "upper-side"];

const allFixedConstraints = (): ConstraintSet => ({
  uz: { type: "fixed" },
  rx: { type: "fixed" },
  ry: { type: "fixed" },
});

function edgeGeometry(skewAngleDeg: number): SlabGeometry {
  return { lengthM: 6, widthM: 3, thicknessM: 0.4, skewAngleDeg };
}

function buildEdgeModel(edge: DeckEdge, skewAngleDeg: number): SlabModel {
  const base = createDefaultModel();
  return {
    ...base,
    geometry: edgeGeometry(skewAngleDeg),
    supports: [
      {
        id: "E1",
        name: "Edge support",
        kind: "edge",
        edge,
        constraints: allFixedConstraints(),
      },
    ],
  };
}

describe("EdgeSupport (WP-027)", () => {
  describe("fromAppModel translation", () => {
    for (const skewAngleDeg of [0, 19, -19]) {
      for (const edge of ALL_EDGES) {
        it(`translates the '${edge}' deck edge to the exact solver line at skew ${skewAngleDeg} deg`, () => {
          const model = buildEdgeModel(edge, skewAngleDeg);
          const internalModel = fromAppModel(model);
          const [expectedP0, expectedP1] = getDeckEdgeSegment(model.geometry, edge);

          expect(internalModel.supports).toHaveLength(1);
          const support = internalModel.supports[0];
          expect(support.kind).toBe("line");
          if (support.kind !== "line") {
            throw new Error("expected a line support");
          }
          expect(support.x1).toBe(expectedP0.x);
          expect(support.y1).toBe(expectedP0.y);
          expect(support.x2).toBe(expectedP1.x);
          expect(support.y2).toBe(expectedP1.y);
          expect(support.behavior).toBe("custom");
          expect(support.dofs).toEqual({
            w: { kind: "fixed" },
            rx: { kind: "fixed" },
            ry: { kind: "fixed" },
          });
        });
      }
    }
  });

  it("round-trips an edge support through save/load unchanged", () => {
    const model = buildEdgeModel("upper-side", 19);

    const persisted = JSON.parse(serializeModelForSave(model));
    const loaded = sanitizeLoadedModel(persisted);

    expect(loaded.supports).toHaveLength(1);
    const support = loaded.supports[0];
    expect(support.kind).toBe("edge");
    if (support.kind !== "edge") {
      throw new Error("expected an edge support");
    }
    expect(support.edge).toBe("upper-side");
    expect(support.constraints).toEqual(allFixedConstraints());
    expect(support.id).toBe("E1");
    expect(support.name).toBe("Edge support");
  });

  it("keeps a legacy line/point-only model loading byte-identical (back-compat)", () => {
    const base = createDefaultModel();

    const persisted = JSON.parse(serializeModelForSave(base));
    const loaded = sanitizeLoadedModel(persisted);

    expect(loaded).toEqual(base);
    expect(loaded.supports.map((s) => s.kind)).toEqual(["line", "point"]);
  });

  it("rejects a persisted edge support with an invalid deck edge identity", () => {
    const base = createDefaultModel();
    const persisted = JSON.parse(serializeModelForSave(base)) as Record<string, unknown>;

    persisted.supports = [
      {
        id: "E1",
        name: "Bogus edge",
        kind: "edge",
        constraints: {
          uz: { type: "fixed" },
          rx: { type: "free" },
          ry: { type: "free" },
        },
        edge: "bogus-edge",
      },
    ];

    expect(() => sanitizeLoadedModel(persisted)).toThrow(/migration error/i);
  });

  it("builds an overlay visual whose linePoints match the canonical edge segment at 19 deg skew", () => {
    const geometry = edgeGeometry(19);
    const support: Support = {
      id: "E1",
      name: "Edge support",
      kind: "edge",
      edge: "lower-side",
      constraints: allFixedConstraints(),
    };

    const visuals = buildSupportVisuals([support], geometry);
    const [p0, p1] = getDeckEdgeSegment(geometry, "lower-side");

    expect(visuals).toHaveLength(1);
    expect(visuals[0].linePoints).toEqual([
      [p0.x, p0.y],
      [p1.x, p1.y],
    ]);
  });

  it("solves end-to-end through the public facade with both end supports expressed as edges", () => {
    const base = createDefaultModel();
    const skewAngleDeg = 19;
    const geometry = edgeGeometry(skewAngleDeg);
    const [wheelStart] = getDeckEdgeSegment(geometry, "start");
    const [wheelEnd] = getDeckEdgeSegment(geometry, "end");
    const wheelX = 0.5 * (wheelStart.x + wheelEnd.x);
    const wheelY = geometry.widthM / 2;

    const model: SlabModel = {
      ...base,
      geometry,
      supports: [
        {
          id: "S1",
          name: "Start edge",
          kind: "edge",
          edge: "start",
          constraints: allFixedConstraints(),
        },
        {
          id: "S2",
          name: "End edge",
          kind: "edge",
          edge: "end",
          constraints: allFixedConstraints(),
        },
      ],
      vehicle: {
        ...base.vehicle,
        mode: "direct",
        directWheels: [
          { id: "W1", xM: wheelX, yM: wheelY, loadKn: 100, patchLongM: 0.4, patchTransM: 0.4 },
        ],
      },
    };

    const payload = runFixedPositionAnalysis(model);

    expect(payload.equilibrium).toBeDefined();
    expect(payload.equilibrium!.normalizedResidual.forceZ).toBeLessThan(1e-5);
  });
});
