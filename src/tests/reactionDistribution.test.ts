import { describe, expect, it } from "vitest";
import {
  buildPhysicalReactions,
  buildReactionDistributions,
  type PayloadReactionRow,
} from "../app/reactionDistribution";
import { createDefaultModel } from "../app/defaults";
import { runFixedPositionAnalysis } from "../solver";
import { getDeckEdgeSegment } from "../solver/geometry/deckCoordinates";
import { computeSignedEquilibrium, type SupportActionInput } from "../solver/core/equilibrium";
import type {
  ConstraintSet,
  EdgeSupport,
  LineSupport,
  PointSupport,
  SlabGeometry,
  SlabModel,
  Support,
  SupportReactionDistribution,
  SupportReactionRow,
} from "../app/types";

const DEG = Math.PI / 180;

function row(overrides: Partial<PayloadReactionRow> & Pick<PayloadReactionRow, "supportId" | "nodeId" | "dof" | "type" | "value">): PayloadReactionRow {
  return { units: overrides.dof === "uz" ? "kN" : "kN*m", xM: 0, yM: 0, ...overrides };
}

function allFixed(): ConstraintSet {
  return {
    uz: { type: "fixed" },
    rx: { type: "fixed" },
    ry: { type: "fixed" },
  };
}

function lineSupport(id: string, x1: number, y1: number, x2: number, y2: number): LineSupport {
  return { id, name: id, kind: "line", x1, y1, x2, y2, constraints: allFixed() };
}

function pointSupport(id: string, x: number, y: number): PointSupport {
  return { id, name: id, kind: "point", x, y, constraints: allFixed() };
}

function edgeSupport(id: string, edge: EdgeSupport["edge"]): EdgeSupport {
  return { id, name: id, kind: "edge", edge, constraints: allFixed() };
}

// ---------------------------------------------------------------------------
// buildPhysicalReactions
// ---------------------------------------------------------------------------

describe("buildPhysicalReactions: fixed/spring sign conversion (ADR-skew-mathematical-conventions.md Sec. 7.3)", () => {
  const supports: Support[] = [lineSupport("A", 0, 0, 0, 5)];

  it("maps a fixed uz to forceZ unchanged", () => {
    const rows = buildPhysicalReactions(
      [row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -42, xM: 0, yM: 2 })],
      supports,
      { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].component).toBe("forceZ");
    expect(rows[0].value).toBe(-42);
    expect(rows[0].units).toBe("kN");
  });

  it("maps a spring uz to forceZ negated", () => {
    const rows = buildPhysicalReactions(
      [row({ supportId: "A", nodeId: 1, dof: "uz", type: "spring", value: 30, xM: 0, yM: 2 })],
      supports,
      { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 },
    );
    expect(rows[0].value).toBe(-30);
  });

  it("maps a fixed rx to coupleY unchanged (G_X = v -> C_y = v)", () => {
    const rows = buildPhysicalReactions(
      [row({ supportId: "A", nodeId: 1, dof: "rx", type: "fixed", value: 7, xM: 0, yM: 2 })],
      supports,
      { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 },
    );
    expect(rows[0].component).toBe("coupleY");
    expect(rows[0].value).toBe(7);
    expect(rows[0].units).toBe("kN*m");
  });

  it("maps a spring rx to coupleY negated", () => {
    const rows = buildPhysicalReactions(
      [row({ supportId: "A", nodeId: 1, dof: "rx", type: "spring", value: 7, xM: 0, yM: 2 })],
      supports,
      { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 },
    );
    expect(rows[0].component).toBe("coupleY");
    expect(rows[0].value).toBe(-7);
  });

  it("maps a fixed ry to coupleX negated (G_Y = v -> C_x = -v)", () => {
    const rows = buildPhysicalReactions(
      [row({ supportId: "A", nodeId: 1, dof: "ry", type: "fixed", value: 9, xM: 0, yM: 2 })],
      supports,
      { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 },
    );
    expect(rows[0].component).toBe("coupleX");
    expect(rows[0].value).toBe(-9);
  });

  it("maps a spring ry to coupleX with the double sign flip cancelling out (net unchanged)", () => {
    // Same double-flip case as equilibrium.test.ts "balances a global moment
    // with a spring rotational reaction": external = -v, coupleX = -external = v.
    const rows = buildPhysicalReactions(
      [row({ supportId: "A", nodeId: 1, dof: "ry", type: "spring", value: -100, xM: 0, yM: 2 })],
      supports,
      { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 },
    );
    expect(rows[0].component).toBe("coupleX");
    expect(rows[0].value).toBe(-100);
  });
});

describe("buildPhysicalReactions: shared-corner attribution and never-fabricate exclusions", () => {
  it("splits a fixed DOF shared by two supports into two half-fraction rows that sum to the raw value", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 0, 5), lineSupport("B", 0, 0, 6, 0)];
    const rows = buildPhysicalReactions(
      [
        row({ supportId: "A", nodeId: 0, dof: "uz", type: "fixed", value: -100, xM: 0, yM: 0 }),
        row({ supportId: "B", nodeId: 0, dof: "uz", type: "fixed", value: -100, xM: 0, yM: 0 }),
      ],
      supports,
      { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 },
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.value).toBeCloseTo(-50, 12);
      expect(r.attributionFraction).toBeCloseTo(0.5, 12);
      expect(r.sharedBySupportIds).toEqual(["A", "B"]);
      expect(r.source).toBe("fixed");
    }
    const sum = rows.reduce((total, r) => total + r.value, 0);
    expect(sum).toBeCloseTo(-100, 12);
  });

  it("splits a fixed DOF shared by three supports into equal thirds", () => {
    const supports: Support[] = [
      lineSupport("A", 0, 0, 0, 5),
      lineSupport("B", 0, 0, 6, 0),
      pointSupport("C", 0, 0),
    ];
    const rows = buildPhysicalReactions(
      [
        row({ supportId: "A", nodeId: 0, dof: "uz", type: "fixed", value: -90, xM: 0, yM: 0 }),
        row({ supportId: "B", nodeId: 0, dof: "uz", type: "fixed", value: -90, xM: 0, yM: 0 }),
        row({ supportId: "C", nodeId: 0, dof: "uz", type: "fixed", value: -90, xM: 0, yM: 0 }),
      ],
      supports,
      { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 },
    );
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.attributionFraction).toBeCloseTo(1 / 3, 12);
      expect(r.sharedBySupportIds).toEqual(["A", "B", "C"]);
      expect(r.value).toBeCloseTo(-30, 12);
    }
  });

  it("drops a spring row on a DOF that is also claimed fixed by another support (fixed precedence)", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 0, 5), lineSupport("B", 0, 0, 6, 0)];
    const rows = buildPhysicalReactions(
      [
        row({ supportId: "A", nodeId: 0, dof: "uz", type: "fixed", value: -100, xM: 0, yM: 0 }),
        row({ supportId: "B", nodeId: 0, dof: "uz", type: "spring", value: 999, xM: 0, yM: 0 }),
      ],
      supports,
      { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].supportId).toBe("A");
    expect(rows[0].source).toBe("fixed");
    expect(rows[0].attributionFraction).toBe(1);
    expect(rows[0].sharedBySupportIds).toEqual(["A"]);
  });

  it("sums (never shares) two independent spring assignments on the same DOF", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 0, 5), lineSupport("B", 0, 0, 6, 0)];
    const rows = buildPhysicalReactions(
      [
        row({ supportId: "A", nodeId: 0, dof: "uz", type: "spring", value: 40, xM: 0, yM: 0 }),
        row({ supportId: "B", nodeId: 0, dof: "uz", type: "spring", value: 60, xM: 0, yM: 0 }),
      ],
      supports,
      { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 },
    );
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.supportId === "A")?.value).toBe(-40);
    expect(rows.find((r) => r.supportId === "B")?.value).toBe(-60);
    for (const r of rows) {
      expect(r.attributionFraction).toBe(1);
      expect(r.sharedBySupportIds).toEqual([r.supportId]);
    }
  });

  it("reports a point support row with no distanceAlongSupportM", () => {
    const supports: Support[] = [pointSupport("P", 3, 4)];
    const rows = buildPhysicalReactions(
      [row({ supportId: "P", nodeId: 5, dof: "uz", type: "fixed", value: -20, xM: 3, yM: 4 })],
      supports,
      { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].supportKind).toBe("point");
    expect("distanceAlongSupportM" in rows[0] ? rows[0].distanceAlongSupportM : undefined).toBeUndefined();
  });

  it("excludes a reaction with a non-finite location instead of fabricating one", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 0, 5)];
    const rows = buildPhysicalReactions(
      [row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: Number.NaN, yM: 2 })],
      supports,
      { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 },
    );
    expect(rows).toHaveLength(0);
  });

  it("excludes a reaction whose supportId is not among the model's supports", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 0, 5)];
    const rows = buildPhysicalReactions(
      [row({ supportId: "ghost", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: 0, yM: 2 })],
      supports,
      { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 },
    );
    expect(rows).toHaveLength(0);
  });

  it("excludes reactions on a degenerate zero-length line support without throwing", () => {
    const supports: Support[] = [lineSupport("A", 3, 3, 3, 3), lineSupport("B", 0, 0, 0, 5)];
    const rows = buildPhysicalReactions(
      [
        row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: 3, yM: 3 }),
        row({ supportId: "B", nodeId: 2, dof: "uz", type: "fixed", value: -20, xM: 0, yM: 1 }),
      ],
      supports,
      { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].supportId).toBe("B");
  });
});

describe("buildPhysicalReactions: distanceAlongSupportM", () => {
  it("computes the authored-line-start projection for an oblique line support", () => {
    // Line from (2,1) to (2,1)+3*(4,3)/5 = (2+2.4, 1+1.8) = (4.4, 2.8); a node
    // at t=2 along the tangent (4/5,3/5) sits at (2+1.6, 1+1.2)=(3.6, 2.2).
    const supports: Support[] = [lineSupport("A", 2, 1, 4.4, 2.8)];
    const rows = buildPhysicalReactions(
      [row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: 3.6, yM: 2.2 })],
      supports,
      { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 },
    );
    expect(rows[0].supportKind).toBe("line");
    if (rows[0].supportKind !== "line") throw new Error("expected line");
    expect(rows[0].distanceAlongSupportM).toBeCloseTo(2, 9);
  });

  it("computes the canonical-edge-start projection for a skewed 'start' edge", () => {
    const geometry: SlabGeometry = { lengthM: 6, widthM: 3, thicknessM: 0.4, skewAngleDeg: 19 };
    const supports: Support[] = [edgeSupport("E", "start")];
    const [origin] = getDeckEdgeSegment(geometry, "start");
    const theta = 19 * DEG;
    const tangent = { x: Math.sin(theta), y: Math.cos(theta) };
    const distanceWanted = 1.75;
    const point = { x: origin.x + distanceWanted * tangent.x, y: origin.y + distanceWanted * tangent.y };

    const rows = buildPhysicalReactions(
      [row({ supportId: "E", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: point.x, yM: point.y })],
      supports,
      geometry,
    );
    expect(rows[0].supportKind).toBe("edge");
    if (rows[0].supportKind !== "edge") throw new Error("expected edge");
    expect(rows[0].distanceAlongSupportM).toBeCloseTo(distanceWanted, 9);
  });
});

// ---------------------------------------------------------------------------
// buildReactionDistributions: frames (ADR-skew-mathematical-conventions.md
// Sec. 9; ADR-skew-data-api-contracts.md Sec. 9.1)
// ---------------------------------------------------------------------------

describe("buildReactionDistributions: canonical-edge frame", () => {
  const geometryFor = (skewAngleDeg: number): SlabGeometry => ({
    lengthM: 6,
    widthM: 3,
    thicknessM: 0.4,
    skewAngleDeg,
  });

  it.each([0, 19, -19])(
    "reproduces n+ = (cos theta, -sin theta) and tau = (sin theta, cos theta) for 'start' and 'end' at skew %s deg",
    (skewAngleDeg) => {
      const geometry = geometryFor(skewAngleDeg);
      const theta = skewAngleDeg * DEG;
      const expectedTangent = { x: Math.sin(theta), y: Math.cos(theta) };
      const expectedNormal = { x: Math.cos(theta), y: -Math.sin(theta) };

      for (const edge of ["start", "end"] as const) {
        const supports: Support[] = [edgeSupport("E", edge)];
        const [origin] = getDeckEdgeSegment(geometry, edge);
        const rows = buildPhysicalReactions(
          [row({ supportId: "E", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: origin.x, yM: origin.y })],
          supports,
          geometry,
        );
        const [dist] = buildReactionDistributions(rows, supports, geometry);
        expect(dist.supportKind).toBe("edge");
        if (dist.supportKind !== "edge") throw new Error("expected edge");
        expect(dist.frame.frameKind).toBe("canonical-edge");
        expect(dist.frame.tangent.x).toBeCloseTo(expectedTangent.x, 12);
        expect(dist.frame.tangent.y).toBeCloseTo(expectedTangent.y, 12);
        expect(dist.frame.normal.x).toBeCloseTo(expectedNormal.x, 12);
        expect(dist.frame.normal.y).toBeCloseTo(expectedNormal.y, 12);
        // Same n+/tau for both start and end (not the direction-flipping inward
        // normal): the frame must not depend on which edge it came from.
        expect(dist.distanceOrigin).toBe("canonical-edge-start");
      }
    },
  );

  it("gives lower-side and upper-side the same canonical tangent/normal (not a flipping inward normal)", () => {
    const geometry = geometryFor(19);
    for (const edge of ["lower-side", "upper-side"] as const) {
      const supports: Support[] = [edgeSupport("E", edge)];
      const [origin] = getDeckEdgeSegment(geometry, edge);
      const rows = buildPhysicalReactions(
        [row({ supportId: "E", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: origin.x, yM: origin.y })],
        supports,
        geometry,
      );
      const [dist] = buildReactionDistributions(rows, supports, geometry);
      if (dist.supportKind !== "edge") throw new Error("expected edge");
      expect(dist.frame.tangent).toEqual({ x: 1, y: 0 });
      expect(dist.frame.normal).toEqual({ x: 0, y: -1 });
    }
  });

  it("keeps every canonical-edge frame orthonormal at both signs of skew", () => {
    for (const skewAngleDeg of [0, 19, -19]) {
      const geometry = geometryFor(skewAngleDeg);
      for (const edge of ["start", "end", "lower-side", "upper-side"] as const) {
        const supports: Support[] = [edgeSupport("E", edge)];
        const [origin] = getDeckEdgeSegment(geometry, edge);
        const rows = buildPhysicalReactions(
          [row({ supportId: "E", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: origin.x, yM: origin.y })],
          supports,
          geometry,
        );
        const [dist] = buildReactionDistributions(rows, supports, geometry);
        if (dist.supportKind !== "edge") throw new Error("expected edge");
        const { normal, tangent } = dist.frame;
        expect(Math.hypot(normal.x, normal.y)).toBeCloseTo(1, 12);
        expect(Math.hypot(tangent.x, tangent.y)).toBeCloseTo(1, 12);
        expect(normal.x * tangent.x + normal.y * tangent.y).toBeCloseTo(0, 12);
      }
    }
  });
});

describe("buildReactionDistributions: authored-line-left-normal frame", () => {
  it("uses tau = normalize(x2-x1,y2-y1) and left normal n = (-tau.y, tau.x)", () => {
    const supports: Support[] = [lineSupport("A", 1, 1, 1 + 4, 1 + 3)]; // 3-4-5 triangle
    const rows = buildPhysicalReactions(
      [row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: 1, yM: 1 })],
      supports,
      { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 },
    );
    const [dist] = buildReactionDistributions(rows, supports, {
      lengthM: 10,
      widthM: 5,
      thicknessM: 0.4,
      skewAngleDeg: 0,
    });
    if (dist.supportKind !== "line") throw new Error("expected line");
    expect(dist.frame.frameKind).toBe("authored-line-left-normal");
    expect(dist.frame.tangent.x).toBeCloseTo(4 / 5, 12);
    expect(dist.frame.tangent.y).toBeCloseTo(3 / 5, 12);
    expect(dist.frame.normal.x).toBeCloseTo(-3 / 5, 12);
    expect(dist.frame.normal.y).toBeCloseTo(4 / 5, 12);
    expect(dist.supportLengthM).toBeCloseTo(5, 12);
    expect(dist.distanceOrigin).toBe("authored-line-start");
  });

  it("reverses both axes when the authored endpoints are reversed", () => {
    const forwardSupports: Support[] = [lineSupport("A", 0, 0, 4, 3)];
    const reversedSupports: Support[] = [lineSupport("A", 4, 3, 0, 0)];
    const geometry: SlabGeometry = { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 };

    const forwardRows = buildPhysicalReactions(
      [row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: 0, yM: 0 })],
      forwardSupports,
      geometry,
    );
    const reversedRows = buildPhysicalReactions(
      [row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: 4, yM: 3 })],
      reversedSupports,
      geometry,
    );
    const [forward] = buildReactionDistributions(forwardRows, forwardSupports, geometry);
    const [reversed] = buildReactionDistributions(reversedRows, reversedSupports, geometry);
    if (forward.supportKind !== "line" || reversed.supportKind !== "line") {
      throw new Error("expected line supports");
    }
    expect(reversed.frame.tangent.x).toBeCloseTo(-forward.frame.tangent.x, 12);
    expect(reversed.frame.tangent.y).toBeCloseTo(-forward.frame.tangent.y, 12);
    expect(reversed.frame.normal.x).toBeCloseTo(-forward.frame.normal.x, 12);
    expect(reversed.frame.normal.y).toBeCloseTo(-forward.frame.normal.y, 12);
  });
});

// ---------------------------------------------------------------------------
// buildReactionDistributions: couple resolution onto the frozen frame
// ---------------------------------------------------------------------------

describe("buildReactionDistributions: coupleNormal/coupleTangent resolution", () => {
  it("resolves a known couple onto a 45-degree line frame by plain dot product", () => {
    // Tangent at 45 degrees: (1,1)/sqrt(2); left normal (-1,1)/sqrt(2).
    const supports: Support[] = [lineSupport("A", 0, 0, 1, 1)];
    const geometry: SlabGeometry = { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 };
    const rows = buildPhysicalReactions(
      [
        // fixed rx=1 -> coupleY=1; fixed ry=0 -> coupleX=0. Then flip ry to get
        // a non-trivial coupleX too, using a distinct node isn't possible (one
        // sample per node), so use rx and ry together on the same node.
        row({ supportId: "A", nodeId: 1, dof: "rx", type: "fixed", value: 1, xM: 0, yM: 0 }),
        row({ supportId: "A", nodeId: 1, dof: "ry", type: "fixed", value: -1, xM: 0, yM: 0 }),
      ],
      supports,
      geometry,
    );
    // coupleY = 1 (from rx=1), coupleX = -(-1) = 1 (from ry=-1) -> C=(1,1).
    const [dist] = buildReactionDistributions(rows, supports, geometry);
    const [sample] = dist.samples;
    expect(sample.total.coupleXKnm).toBeCloseTo(1, 12);
    expect(sample.total.coupleYKnm).toBeCloseTo(1, 12);
    const sqrt2 = Math.SQRT2;
    // Ct = C.t = (1,1).(1,1)/sqrt2 = 2/sqrt2 = sqrt2; Cn = C.n = (1,1).(-1,1)/sqrt2 = 0.
    expect(sample.coupleTangentKnm).toBeCloseTo(sqrt2, 9);
    expect(sample.coupleNormalKnm).toBeCloseTo(0, 9);
  });

  it("resolves the same style of couple onto a canonical-edge frame consistently with ADR Sec. 9 v_n/v_t", () => {
    const geometry: SlabGeometry = { lengthM: 6, widthM: 3, thicknessM: 0.4, skewAngleDeg: 19 };
    const supports: Support[] = [edgeSupport("E", "start")];
    const [origin] = getDeckEdgeSegment(geometry, "start");
    const rows = buildPhysicalReactions(
      [
        row({ supportId: "E", nodeId: 1, dof: "rx", type: "fixed", value: 4, xM: origin.x, yM: origin.y }),
        row({ supportId: "E", nodeId: 1, dof: "ry", type: "fixed", value: 6, xM: origin.x, yM: origin.y }),
      ],
      supports,
      geometry,
    );
    const [dist] = buildReactionDistributions(rows, supports, geometry);
    const [sample] = dist.samples;
    // coupleY = 4 (rx=4), coupleX = -6 (ry=6).
    const cx = sample.total.coupleXKnm;
    const cy = sample.total.coupleYKnm;
    expect(cx).toBeCloseTo(-6, 12);
    expect(cy).toBeCloseTo(4, 12);
    const theta = 19 * DEG;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    // ADR Sec. 9: v_n = c*v_x - s*v_y, v_t = s*v_x + c*v_y.
    expect(sample.coupleNormalKnm).toBeCloseTo(c * cx - s * cy, 9);
    expect(sample.coupleTangentKnm).toBeCloseTo(s * cx + c * cy, 9);
  });
});

// ---------------------------------------------------------------------------
// buildReactionDistributions: ordering (invariant 3)
// ---------------------------------------------------------------------------

describe("buildReactionDistributions: ordering", () => {
  it("orders samples by increasing distanceAlongSupportM for nonuniform node spacing", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 10, 0)];
    const geometry: SlabGeometry = { lengthM: 20, widthM: 10, thicknessM: 0.4, skewAngleDeg: 0 };
    // Deliberately nonuniform, out-of-order x positions.
    const positions = [
      { nodeId: 30, xM: 7.25 },
      { nodeId: 10, xM: 0.1 },
      { nodeId: 20, xM: 3.6 },
      { nodeId: 40, xM: 9.999 },
      { nodeId: 5, xM: 1.0 },
    ];
    const rows = buildPhysicalReactions(
      positions.map((p) =>
        row({ supportId: "A", nodeId: p.nodeId, dof: "uz", type: "fixed", value: -1, xM: p.xM, yM: 0 }),
      ),
      supports,
      geometry,
    );
    const [dist] = buildReactionDistributions(rows, supports, geometry);
    const distances = dist.samples.map((s) => s.distanceAlongSupportM);
    const sorted = [...distances].sort((a, b) => a - b);
    expect(distances).toEqual(sorted);
    expect(dist.samples.map((s) => s.nodeId)).toEqual([10, 5, 20, 30, 40]);
  });

  it("uses nodeId as a deterministic tie-breaker for equal distanceAlongSupportM", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 10, 0)];
    const geometry: SlabGeometry = { lengthM: 20, widthM: 10, thicknessM: 0.4, skewAngleDeg: 0 };
    const rows = buildPhysicalReactions(
      [
        row({ supportId: "A", nodeId: 9, dof: "uz", type: "fixed", value: -1, xM: 3, yM: 0 }),
        row({ supportId: "A", nodeId: 2, dof: "uz", type: "fixed", value: -1, xM: 3, yM: 0 }),
      ],
      supports,
      geometry,
    );
    const [dist] = buildReactionDistributions(rows, supports, geometry);
    expect(dist.samples.map((s) => s.nodeId)).toEqual([2, 9]);
  });

  it("orders correctly for a canonical edge frame at both signs of skew", () => {
    for (const skewAngleDeg of [19, -19]) {
      const geometry: SlabGeometry = { lengthM: 6, widthM: 3, thicknessM: 0.4, skewAngleDeg };
      const supports: Support[] = [edgeSupport("E", "start")];
      const [origin] = getDeckEdgeSegment(geometry, "start");
      const theta = skewAngleDeg * DEG;
      const tangent = { x: Math.sin(theta), y: Math.cos(theta) };
      const tValues = [2.4, 0.1, 1.7, 0.9];
      const rows = buildPhysicalReactions(
        tValues.map((t, index) =>
          row({
            supportId: "E",
            nodeId: index,
            dof: "uz",
            type: "fixed",
            value: -1,
            xM: origin.x + t * tangent.x,
            yM: origin.y + t * tangent.y,
          }),
        ),
        supports,
        geometry,
      );
      const [dist] = buildReactionDistributions(rows, supports, geometry);
      const distances = dist.samples.map((s) => s.distanceAlongSupportM);
      expect(distances).toEqual([...distances].sort((a, b) => a - b));
      expect(dist.samples.map((s) => s.nodeId)).toEqual([1, 3, 2, 0]);
    }
  });
});

// ---------------------------------------------------------------------------
// buildReactionDistributions: source cases and reconciliation
// ---------------------------------------------------------------------------

describe("buildReactionDistributions: source cases", () => {
  it("labels an unshared fixed sample 'unshared-fixed'", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 0, 5)];
    const geometry: SlabGeometry = { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 };
    const rows = buildPhysicalReactions(
      [row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: 0, yM: 2 })],
      supports,
      geometry,
    );
    const [dist] = buildReactionDistributions(rows, supports, geometry);
    const [sample] = dist.samples;
    expect(sample.sourceCase).toBe("unshared-fixed");
    if (sample.sourceCase !== "unshared-fixed") throw new Error("unexpected case");
    expect(sample.fixedAttribution).toEqual({
      method: "unshared-fixed",
      attributionFraction: 1,
      sharedBySupportIds: ["A"],
    });
  });

  it("labels a spring-only sample 'spring-direct' with no fixedAttribution", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 0, 5)];
    const geometry: SlabGeometry = { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 };
    const rows = buildPhysicalReactions(
      [row({ supportId: "A", nodeId: 1, dof: "uz", type: "spring", value: 10, xM: 0, yM: 2 })],
      supports,
      geometry,
    );
    const [dist] = buildReactionDistributions(rows, supports, geometry);
    const [sample] = dist.samples;
    expect(sample.sourceCase).toBe("spring-direct");
    expect(sample.fixedAttribution).toBeUndefined();
  });

  it("labels a mixed fixed(w)/spring(rotation) sample 'mixed-fixed-spring'", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 0, 5)];
    const geometry: SlabGeometry = { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 };
    const rows = buildPhysicalReactions(
      [
        row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: 0, yM: 2 }),
        row({ supportId: "A", nodeId: 1, dof: "rx", type: "spring", value: 3, xM: 0, yM: 2 }),
      ],
      supports,
      geometry,
    );
    const [dist] = buildReactionDistributions(rows, supports, geometry);
    const [sample] = dist.samples;
    expect(sample.sourceCase).toBe("mixed-fixed-spring");
    if (sample.sourceCase !== "mixed-fixed-spring") throw new Error("unexpected case");
    expect(sample.fixedAttribution).toEqual({
      method: "unshared-fixed",
      attributionFraction: 1,
      sharedBySupportIds: ["A"],
    });
    expect(sample.sourceSubtotals.fixedAttributed.forceZKn).toBe(-10);
    expect(sample.sourceSubtotals.springDirect.coupleYKnm).toBe(-3);
  });

  it("labels a shared-corner sample 'shared-fixed-attribution' on both sharing distributions, with no double count", () => {
    const supports: Support[] = [edgeSupport("start", "start"), edgeSupport("lower", "lower-side")];
    const geometry: SlabGeometry = { lengthM: 6, widthM: 3, thicknessM: 0.4, skewAngleDeg: 19 };
    const [corner] = getDeckEdgeSegment(geometry, "start"); // start-lower corner
    const rows = buildPhysicalReactions(
      [
        row({ supportId: "start", nodeId: 0, dof: "uz", type: "fixed", value: -80, xM: corner.x, yM: corner.y }),
        row({ supportId: "lower", nodeId: 0, dof: "uz", type: "fixed", value: -80, xM: corner.x, yM: corner.y }),
      ],
      supports,
      geometry,
    );
    const distributions = buildReactionDistributions(rows, supports, geometry);
    expect(distributions).toHaveLength(2);
    let total = 0;
    for (const dist of distributions) {
      const [sample] = dist.samples;
      expect(sample.sourceCase).toBe("shared-fixed-attribution");
      if (sample.sourceCase !== "shared-fixed-attribution") throw new Error("unexpected case");
      expect(sample.fixedAttribution.attributionFraction).toBeCloseTo(0.5, 12);
      expect(sample.fixedAttribution.sharedBySupportIds).toEqual(["lower", "start"]);
      expect(sample.total.forceZKn).toBeCloseTo(-40, 12);
      total += sample.total.forceZKn;
    }
    expect(total).toBeCloseTo(-80, 12);
  });

  it("never builds a distribution for a point support", () => {
    const supports: Support[] = [pointSupport("P", 1, 1), lineSupport("A", 0, 0, 0, 5)];
    const geometry: SlabGeometry = { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 };
    const rows = buildPhysicalReactions(
      [
        row({ supportId: "P", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: 1, yM: 1 }),
        row({ supportId: "A", nodeId: 2, dof: "uz", type: "fixed", value: -10, xM: 0, yM: 3 }),
      ],
      supports,
      geometry,
    );
    const distributions = buildReactionDistributions(rows, supports, geometry);
    expect(distributions.map((d) => d.supportId)).toEqual(["A"]);
  });
});

describe("buildReactionDistributions: totals reconciliation (invariant 1)", () => {
  it("sums sample totals to support totals and support totals to the grand total", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 0, 5), lineSupport("B", 0, 0, 10, 0)];
    const geometry: SlabGeometry = { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 };
    const rows = buildPhysicalReactions(
      [
        row({ supportId: "A", nodeId: 0, dof: "uz", type: "fixed", value: -100, xM: 0, yM: 0 }),
        row({ supportId: "B", nodeId: 0, dof: "uz", type: "fixed", value: -100, xM: 0, yM: 0 }),
        row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -40, xM: 0, yM: 2 }),
        row({ supportId: "A", nodeId: 1, dof: "ry", type: "fixed", value: 5, xM: 0, yM: 2 }),
        row({ supportId: "B", nodeId: 2, dof: "uz", type: "spring", value: 25, xM: 5, yM: 0 }),
      ],
      supports,
      geometry,
    );
    const distributions = buildReactionDistributions(rows, supports, geometry);

    for (const dist of distributions) {
      const sumFromSamples = dist.samples.reduce(
        (acc, sample) => ({
          forceZKn: acc.forceZKn + sample.total.forceZKn,
          coupleXKnm: acc.coupleXKnm + sample.total.coupleXKnm,
          coupleYKnm: acc.coupleYKnm + sample.total.coupleYKnm,
        }),
        { forceZKn: 0, coupleXKnm: 0, coupleYKnm: 0 },
      );
      expect(sumFromSamples.forceZKn).toBeCloseTo(dist.totals.forceZKn, 9);
      expect(sumFromSamples.coupleXKnm).toBeCloseTo(dist.totals.coupleXKnm, 9);
      expect(sumFromSamples.coupleYKnm).toBeCloseTo(dist.totals.coupleYKnm, 9);
      expect(dist.totals.forceZKn).toBeCloseTo(
        dist.sourceTotals.fixedAttributed.forceZKn + dist.sourceTotals.springDirect.forceZKn,
        9,
      );
    }

    const grandForceZ = distributions.reduce((sum, d) => sum + d.totals.forceZKn, 0);
    // Row-level reference: shared uz at node 0 is -100 total (once), unshared
    // -40 at A/node1, and spring +25 (raw) -> external -25 at B/node2.
    expect(grandForceZ).toBeCloseTo(-100 - 40 - 25, 9);
  });

  it("gives identical output whether fed pre-built physicalReactions rows or raw payload reactions", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 0, 5)];
    const geometry: SlabGeometry = { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 };
    const raw: PayloadReactionRow[] = [
      row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: 0, yM: 2 }),
      row({ supportId: "A", nodeId: 2, dof: "uz", type: "fixed", value: -20, xM: 0, yM: 4 }),
    ];
    const preBuilt = buildPhysicalReactions(raw, supports, geometry);
    const fromRows = buildReactionDistributions(preBuilt, supports, geometry);
    const fromRaw = buildReactionDistributions(raw, supports, geometry);
    expect(fromRaw).toEqual(fromRows);
  });
});

// ---------------------------------------------------------------------------
// Real-solve integration (facade), skew 0 / +19 / -19
// ---------------------------------------------------------------------------

function edgeModel(
  edges: Array<EdgeSupport["edge"]>,
  skewAngleDeg: number,
  extra: Partial<SlabModel> = {},
): SlabModel {
  const base = createDefaultModel();
  const geometry: SlabGeometry = { lengthM: 6, widthM: 3, thicknessM: 0.4, skewAngleDeg };
  return {
    ...base,
    geometry,
    supports: edges.map((edge) => edgeSupport(edge, edge)),
    vehicle: {
      ...base.vehicle,
      mode: "direct",
      directWheels: [{ id: "W1", xM: 3, yM: 1.5, loadKn: 80, patchLongM: 0.4, patchTransM: 0.4 }],
    },
    ...extra,
  };
}

/** Independent reference totals from the already-accepted WP-025 equilibrium
 * engine (src/solver/core/equilibrium.ts), used as ground truth rather than a
 * second hand-rolled sign implementation. Vertical total comes from feeding
 * only `w`-dof actions (lever arms are irrelevant to the plain fz sum); pure
 * (lever-free) couple totals come from feeding only `rx`/`ry`-dof actions,
 * whose contribution never includes a lever-arm term. Both reuse the SAME
 * fixed-over-spring / fixed-dedup precedence this engine's equal-split
 * attribution must reconcile with (equal-split sums to the identical total
 * because its fractions sum to 1 across the sharing supports).
 */
function referenceGlobalTotals(rawReactions: PayloadReactionRow[]): {
  forceZKn: number;
  coupleXKnm: number;
  coupleYKnm: number;
} {
  const toAction = (r: PayloadReactionRow): SupportActionInput => ({
    supportId: r.supportId,
    nodeId: r.nodeId,
    x: r.xM,
    y: r.yM,
    dof: r.dof === "uz" ? "w" : r.dof,
    kind: r.type,
    value: r.value,
  });

  const verticalReport = computeSignedEquilibrium({
    appliedLoads: [],
    supportActions: rawReactions.filter((r) => r.dof === "uz").map(toAction),
    origin: { x: 0, y: 0 },
    characteristicLengthM: 1,
  });
  const coupleReport = computeSignedEquilibrium({
    appliedLoads: [],
    supportActions: rawReactions.filter((r) => r.dof === "rx" || r.dof === "ry").map(toAction),
    origin: { x: 0, y: 0 },
    characteristicLengthM: 1,
  });

  return {
    forceZKn: verticalReport.reaction.fz,
    coupleXKnm: coupleReport.reaction.momentX,
    coupleYKnm: coupleReport.reaction.momentY,
  };
}

function toPayloadReactionRows(payload: { reactions: unknown }): PayloadReactionRow[] {
  const raw = payload.reactions as Array<{
    supportId: string;
    nodeId: number;
    dof: "uz" | "rx" | "ry";
    type: "fixed" | "spring";
    value: number;
    xM?: number;
    yM?: number;
  }>;
  return raw.map((r) => ({
    supportId: r.supportId,
    nodeId: r.nodeId,
    dof: r.dof,
    type: r.type,
    value: r.value,
    units: r.dof === "uz" ? "kN" : "kN*m",
    xM: r.xM ?? Number.NaN,
    yM: r.yM ?? Number.NaN,
  }));
}

function sumDistributions(distributions: SupportReactionDistribution[]) {
  return distributions.reduce(
    (acc, dist) => ({
      forceZKn: acc.forceZKn + dist.totals.forceZKn,
      coupleXKnm: acc.coupleXKnm + dist.totals.coupleXKnm,
      coupleYKnm: acc.coupleYKnm + dist.totals.coupleYKnm,
    }),
    { forceZKn: 0, coupleXKnm: 0, coupleYKnm: 0 },
  );
}

describe("real-solve reconciliation via the solver facade", () => {
  it.each([0, 19, -19])(
    "reconciles start+end edge distributions with the WP-025 reference totals at skew %s deg",
    (skewAngleDeg) => {
      const model = edgeModel(["start", "end"], skewAngleDeg);
      const payload = runFixedPositionAnalysis(model);
      expect(payload.equilibrium?.normalizedResidual.forceZ).toBeLessThan(1e-5);

      const rawRows = toPayloadReactionRows(payload);
      const physicalReactions = buildPhysicalReactions(rawRows, model.supports, model.geometry);
      const distributions = buildReactionDistributions(physicalReactions, model.supports, model.geometry);

      expect(distributions).toHaveLength(2);
      for (const dist of distributions) {
        const distances = dist.samples.map((s) => s.distanceAlongSupportM);
        expect(distances).toEqual([...distances].sort((a, b) => a - b));
        expect(dist.samples.length).toBeGreaterThan(1);
      }

      const reference = referenceGlobalTotals(rawRows);
      const actual = sumDistributions(distributions);
      const scale = Math.max(Math.abs(reference.forceZKn), 1);
      expect(Math.abs(actual.forceZKn - reference.forceZKn) / scale).toBeLessThan(1e-9);
      const momentScale = Math.max(
        Math.abs(reference.coupleXKnm),
        Math.abs(reference.coupleYKnm),
        1,
      );
      expect(Math.abs(actual.coupleXKnm - reference.coupleXKnm) / momentScale).toBeLessThan(1e-9);
      expect(Math.abs(actual.coupleYKnm - reference.coupleYKnm) / momentScale).toBeLessThan(1e-9);

      // Also compare against the equilibrium reaction resultant directly for
      // the vertical (force) total, per invariant 1 ("...especially vertical").
      expect(
        Math.abs(actual.forceZKn - (payload.equilibrium?.reactions.forceZKn ?? Number.NaN)) / scale,
      ).toBeLessThan(1e-9);
    },
  );

  it.each([19, -19])(
    "does not double-count any of the four shared perimeter corners at skew %s deg",
    (skewAngleDeg) => {
      const model = edgeModel(["start", "end", "lower-side", "upper-side"], skewAngleDeg);
      const payload = runFixedPositionAnalysis(model);
      expect(payload.equilibrium?.normalizedResidual.forceZ).toBeLessThan(1e-5);

      const rawRows = toPayloadReactionRows(payload);
      const physicalReactions = buildPhysicalReactions(rawRows, model.supports, model.geometry);
      const distributions = buildReactionDistributions(physicalReactions, model.supports, model.geometry);
      expect(distributions).toHaveLength(4);

      const sharedSamples = distributions
        .flatMap((dist) => dist.samples)
        .filter(
          (
            sample,
          ): sample is typeof sample & {
            sourceCase: "shared-fixed-attribution";
          } => sample.sourceCase === "shared-fixed-attribution",
        );
      // Each of the 4 corners is shared by exactly 2 adjacent edges, so 8
      // shared-attribution sample rows are expected (2 per corner).
      expect(sharedSamples.length).toBe(8);
      for (const sample of sharedSamples) {
        expect(sample.fixedAttribution.attributionFraction).toBeCloseTo(0.5, 9);
        expect(sample.fixedAttribution.sharedBySupportIds).toHaveLength(2);
      }

      const reference = referenceGlobalTotals(rawRows);
      const actual = sumDistributions(distributions);
      const scale = Math.max(Math.abs(reference.forceZKn), 1);
      expect(Math.abs(actual.forceZKn - reference.forceZKn) / scale).toBeLessThan(1e-9);
    },
  );

  it("reconciles a mixed fixed/spring perimeter (start fixed, end vertical-spring)", () => {
    const base = createDefaultModel();
    const geometry: SlabGeometry = { lengthM: 6, widthM: 3, thicknessM: 0.4, skewAngleDeg: 19 };
    const model: SlabModel = {
      ...base,
      geometry,
      supports: [
        edgeSupport("start", "start"),
        {
          id: "end",
          name: "end",
          kind: "edge",
          edge: "end",
          constraints: {
            uz: { type: "spring", stiffness: 200000 },
            rx: { type: "free" },
            ry: { type: "free" },
          },
        },
      ],
      vehicle: {
        ...base.vehicle,
        mode: "direct",
        directWheels: [{ id: "W1", xM: 3, yM: 1.5, loadKn: 80, patchLongM: 0.4, patchTransM: 0.4 }],
      },
    };
    const payload = runFixedPositionAnalysis(model);
    expect(payload.equilibrium?.normalizedResidual.forceZ).toBeLessThan(1e-5);

    const rawRows = toPayloadReactionRows(payload);
    expect(rawRows.some((r) => r.supportId === "end" && r.type === "spring")).toBe(true);

    const physicalReactions = buildPhysicalReactions(rawRows, model.supports, model.geometry);
    const distributions = buildReactionDistributions(physicalReactions, model.supports, model.geometry);
    expect(distributions.map((d) => d.supportId).sort()).toEqual(["end", "start"]);

    const endDist = distributions.find((d) => d.supportId === "end");
    expect(endDist?.samples.every((s) => s.sourceCase === "spring-direct")).toBe(true);
    expect(endDist?.sourceTotals.fixedAttributed.forceZKn).toBe(0);

    const reference = referenceGlobalTotals(rawRows);
    const actual = sumDistributions(distributions);
    const scale = Math.max(Math.abs(reference.forceZKn), 1);
    expect(Math.abs(actual.forceZKn - reference.forceZKn) / scale).toBeLessThan(1e-9);
  });
});

describe("zero-skew behaviour is unaffected (invariant 5)", () => {
  it("still lets the default zero-skew model solve and reconcile through the new engine", () => {
    const model = createDefaultModel();
    const payload = runFixedPositionAnalysis(model);
    expect(payload.equilibrium?.normalizedResidual.forceZ).toBeLessThan(1e-5);

    const rawRows = toPayloadReactionRows(payload);
    const physicalReactions = buildPhysicalReactions(rawRows, model.supports, model.geometry);
    const distributions = buildReactionDistributions(physicalReactions, model.supports, model.geometry);

    // createDefaultModel has one line support (S1) and one point support (S2);
    // only the line support gets a distribution.
    expect(distributions.map((d) => d.supportId)).toEqual(["S1"]);
    expect(physicalReactions.some((r) => r.supportId === "S2" && r.supportKind === "point")).toBe(
      true,
    );

    const reference = referenceGlobalTotals(rawRows);
    const actual = sumDistributions(distributions);
    // Point-support (S2) rows are not part of any distribution but must still
    // be included when reconciling the grand total against the reference.
    const pointForceZ = physicalReactions
      .filter((r) => r.supportKind === "point" && r.component === "forceZ")
      .reduce((sum, r) => sum + r.value, 0);
    const scale = Math.max(Math.abs(reference.forceZKn), 1);
    expect(Math.abs(actual.forceZKn + pointForceZ - reference.forceZKn) / scale).toBeLessThan(1e-9);
  });
});
