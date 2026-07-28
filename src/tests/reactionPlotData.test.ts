import { describe, expect, it } from "vitest";
import {
  REACTION_SERIES_OPTIONS,
  buildReactionPlotPoints,
  computeReactionPlotDomain,
  distanceOriginLabel,
  distributionHasSharedCorner,
  formatSupportAxisLabel,
  isSharedCornerSample,
  reactionSeriesOption,
  reactionSeriesUnits,
  reactionSeriesValue,
  sumDistributionSampleTotals,
  sumDistributionTotals,
  type ReactionSeriesKey,
} from "../app/reactionPlotData";
import {
  buildPhysicalReactions,
  buildReactionDistributions,
  type PayloadReactionRow,
} from "../app/reactionDistribution";
import type {
  ConstraintSet,
  EdgeSupport,
  LineSupport,
  SlabGeometry,
  Support,
  SupportReactionDistribution,
} from "../app/types";

// ---------------------------------------------------------------------------
// Local test-data builders, mirroring src/tests/reactionDistribution.test.ts
// (this file owns its own copies rather than importing from another test
// file). These drive the real WP-034 engine so the resulting
// `SupportReactionDistribution` objects are authentic, not hand-fabricated.
// ---------------------------------------------------------------------------

function row(
  overrides: Partial<PayloadReactionRow> &
    Pick<PayloadReactionRow, "supportId" | "nodeId" | "dof" | "type" | "value">,
): PayloadReactionRow {
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

function edgeSupport(id: string, edge: EdgeSupport["edge"]): EdgeSupport {
  return { id, name: id, kind: "edge", edge, constraints: allFixed() };
}

const GEOMETRY: SlabGeometry = { lengthM: 10, widthM: 5, thicknessM: 0.4, skewAngleDeg: 0 };

// ---------------------------------------------------------------------------
// reactionSeriesValue / reactionSeriesUnits / reactionSeriesOption
// ---------------------------------------------------------------------------

describe("reactionSeriesValue and reactionSeriesUnits", () => {
  const supports: Support[] = [lineSupport("A", 0, 0, 0, 5)];
  const rows = buildPhysicalReactions(
    [
      row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -12, xM: 0, yM: 2 }),
      row({ supportId: "A", nodeId: 1, dof: "rx", type: "fixed", value: 3, xM: 0, yM: 2 }),
      row({ supportId: "A", nodeId: 1, dof: "ry", type: "fixed", value: -4, xM: 0, yM: 2 }),
    ],
    supports,
    GEOMETRY,
  );
  const [dist] = buildReactionDistributions(rows, supports, GEOMETRY);
  const [sample] = dist.samples;

  it("maps forceZKn straight off sample.total.forceZKn, in kN", () => {
    expect(reactionSeriesValue(sample, "forceZKn")).toBe(sample.total.forceZKn);
    expect(reactionSeriesUnits("forceZKn")).toBe("kN");
  });

  it("maps coupleXKnm/coupleYKnm straight off sample.total, in kN*m", () => {
    expect(reactionSeriesValue(sample, "coupleXKnm")).toBe(sample.total.coupleXKnm);
    expect(reactionSeriesValue(sample, "coupleYKnm")).toBe(sample.total.coupleYKnm);
    expect(reactionSeriesUnits("coupleXKnm")).toBe("kN*m");
    expect(reactionSeriesUnits("coupleYKnm")).toBe("kN*m");
  });

  it("maps coupleNormalKnm/coupleTangentKnm off the sample's own support-axis fields, in kN*m", () => {
    expect(reactionSeriesValue(sample, "coupleNormalKnm")).toBe(sample.coupleNormalKnm);
    expect(reactionSeriesValue(sample, "coupleTangentKnm")).toBe(sample.coupleTangentKnm);
    expect(reactionSeriesUnits("coupleNormalKnm")).toBe("kN*m");
    expect(reactionSeriesUnits("coupleTangentKnm")).toBe("kN*m");
  });

  it("every declared series key has a matching option with the correct units", () => {
    const keys: ReactionSeriesKey[] = [
      "forceZKn",
      "coupleXKnm",
      "coupleYKnm",
      "coupleNormalKnm",
      "coupleTangentKnm",
    ];
    for (const key of keys) {
      const option = reactionSeriesOption(key);
      expect(option.key).toBe(key);
      expect(option.units).toBe(reactionSeriesUnits(key));
    }
    expect(REACTION_SERIES_OPTIONS).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// buildReactionPlotPoints / isSharedCornerSample / distributionHasSharedCorner
// ---------------------------------------------------------------------------

describe("buildReactionPlotPoints", () => {
  it("returns an empty array for a null/undefined distribution (graceful empty state)", () => {
    expect(buildReactionPlotPoints(null, "forceZKn")).toEqual([]);
    expect(buildReactionPlotPoints(undefined, "forceZKn")).toEqual([]);
  });

  it("returns an empty array for a distribution with zero samples (degenerate)", () => {
    const empty: SupportReactionDistribution = {
      supportId: "A",
      supportKind: "line",
      supportLengthM: 5,
      samples: [],
      sourceTotals: {
        fixedAttributed: { forceZKn: 0, coupleXKnm: 0, coupleYKnm: 0 },
        springDirect: { forceZKn: 0, coupleXKnm: 0, coupleYKnm: 0 },
      },
      totals: { forceZKn: 0, coupleXKnm: 0, coupleYKnm: 0 },
      distanceOrigin: "authored-line-start",
      frame: {
        frameKind: "authored-line-left-normal",
        tangent: { x: 1, y: 0 },
        normal: { x: 0, y: 1 },
      },
    };
    expect(buildReactionPlotPoints(empty, "forceZKn")).toEqual([]);
    expect(computeReactionPlotDomain(empty, [])).toBeNull();
  });

  it("maps one point per sample, in ascending distance order, carrying nodeId/isSharedCorner", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 10, 0)];
    const rows = buildPhysicalReactions(
      [
        row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: 2, yM: 0 }),
        row({ supportId: "A", nodeId: 2, dof: "uz", type: "fixed", value: -20, xM: 6, yM: 0 }),
      ],
      supports,
      GEOMETRY,
    );
    const [dist] = buildReactionDistributions(rows, supports, GEOMETRY);
    const points = buildReactionPlotPoints(dist, "forceZKn");
    expect(points).toHaveLength(2);
    expect(points.map((p) => p.distanceM)).toEqual([2, 6]);
    expect(points.map((p) => p.nodeId)).toEqual([1, 2]);
    expect(points.map((p) => p.value)).toEqual([-10, -20]);
    expect(points.every((p) => p.isSharedCorner === false)).toBe(true);
  });
});

describe("isSharedCornerSample / distributionHasSharedCorner", () => {
  it("flags 'shared-fixed-attribution' and 'mixed-fixed-spring' samples, not unshared/spring-direct ones", () => {
    const supports: Support[] = [
      edgeSupport("start", "start"),
      edgeSupport("lower", "lower-side"),
    ];
    const geometry: SlabGeometry = { lengthM: 6, widthM: 3, thicknessM: 0.4, skewAngleDeg: 19 };
    const rows = buildPhysicalReactions(
      [
        row({ supportId: "start", nodeId: 0, dof: "uz", type: "fixed", value: -80, xM: 0, yM: 0 }),
        row({ supportId: "lower", nodeId: 0, dof: "uz", type: "fixed", value: -80, xM: 0, yM: 0 }),
      ],
      supports,
      geometry,
    );
    const distributions = buildReactionDistributions(rows, supports, geometry);
    for (const dist of distributions) {
      const [sample] = dist.samples;
      expect(isSharedCornerSample(sample)).toBe(true);
      expect(distributionHasSharedCorner(dist)).toBe(true);
    }
  });

  it("does not flag an unshared-fixed sample, and treats a null distribution as false", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 0, 5)];
    const rows = buildPhysicalReactions(
      [row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: 0, yM: 2 })],
      supports,
      GEOMETRY,
    );
    const [dist] = buildReactionDistributions(rows, supports, GEOMETRY);
    expect(isSharedCornerSample(dist.samples[0])).toBe(false);
    expect(distributionHasSharedCorner(dist)).toBe(false);
    expect(distributionHasSharedCorner(null)).toBe(false);
    expect(distributionHasSharedCorner(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeReactionPlotDomain
// ---------------------------------------------------------------------------

describe("computeReactionPlotDomain", () => {
  it("returns null when there is no distribution or no points", () => {
    expect(computeReactionPlotDomain(null, [])).toBeNull();
    const supports: Support[] = [lineSupport("A", 0, 0, 10, 0)];
    const rows = buildPhysicalReactions([], supports, GEOMETRY);
    const distributions = buildReactionDistributions(rows, supports, GEOMETRY);
    expect(distributions).toHaveLength(0);
  });

  it("spans x from 0 to the support's full physical length, not just the sampled extent", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 10, 0)];
    const rows = buildPhysicalReactions(
      [
        row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: 3, yM: 0 }),
        row({ supportId: "A", nodeId: 2, dof: "uz", type: "fixed", value: -5, xM: 7, yM: 0 }),
      ],
      supports,
      GEOMETRY,
    );
    const [dist] = buildReactionDistributions(rows, supports, GEOMETRY);
    const points = buildReactionPlotPoints(dist, "forceZKn");
    const domain = computeReactionPlotDomain(dist, points);
    expect(domain).not.toBeNull();
    expect(domain!.xMinM).toBe(0);
    expect(domain!.xMaxM).toBeCloseTo(10, 9); // full supportLengthM, not 7 (last sample)
  });

  it("falls back to the sampled distance extent when supportLengthM is non-positive", () => {
    const degenerate: SupportReactionDistribution = {
      supportId: "A",
      supportKind: "line",
      supportLengthM: 0,
      samples: [],
      sourceTotals: {
        fixedAttributed: { forceZKn: 0, coupleXKnm: 0, coupleYKnm: 0 },
        springDirect: { forceZKn: 0, coupleXKnm: 0, coupleYKnm: 0 },
      },
      totals: { forceZKn: 0, coupleXKnm: 0, coupleYKnm: 0 },
      distanceOrigin: "authored-line-start",
      frame: {
        frameKind: "authored-line-left-normal",
        tangent: { x: 1, y: 0 },
        normal: { x: 0, y: 1 },
      },
    };
    const points = [
      { nodeId: 1, distanceM: 2, value: -3, isSharedCorner: false },
      { nodeId: 2, distanceM: 4.5, value: 6, isSharedCorner: false },
    ];
    const domain = computeReactionPlotDomain(degenerate, points);
    expect(domain).not.toBeNull();
    expect(domain!.xMaxM).toBeCloseTo(4.5, 9);
  });

  it("always includes 0 in the y (value) domain even when all sample values share a sign", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 10, 0)];
    const rows = buildPhysicalReactions(
      [row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: 3, yM: 0 })],
      supports,
      GEOMETRY,
    );
    const [dist] = buildReactionDistributions(rows, supports, GEOMETRY);
    const points = buildReactionPlotPoints(dist, "forceZKn");
    const domain = computeReactionPlotDomain(dist, points);
    expect(domain!.yMin).toBeLessThanOrEqual(0);
    expect(domain!.yMax).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Reconciliation: sumDistributionSampleTotals / sumDistributionTotals
// (acceptance criterion: plotted/tabulated totals equal the sum of that
// support's samples[i].total component-wise, and never double-count a
// shared fixed DOF across distributions).
// ---------------------------------------------------------------------------

describe("sumDistributionSampleTotals: reconciles a support's totals to a plain sum of its samples", () => {
  it("sums to dist.totals for a support with multiple mixed-DOF nodes", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 0, 5), lineSupport("B", 0, 0, 10, 0)];
    const rows = buildPhysicalReactions(
      [
        row({ supportId: "A", nodeId: 0, dof: "uz", type: "fixed", value: -100, xM: 0, yM: 0 }),
        row({ supportId: "B", nodeId: 0, dof: "uz", type: "fixed", value: -100, xM: 0, yM: 0 }),
        row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -40, xM: 0, yM: 2 }),
        row({ supportId: "A", nodeId: 1, dof: "ry", type: "fixed", value: 5, xM: 0, yM: 2 }),
        row({ supportId: "B", nodeId: 2, dof: "uz", type: "spring", value: 25, xM: 5, yM: 0 }),
      ],
      supports,
      GEOMETRY,
    );
    const distributions = buildReactionDistributions(rows, supports, GEOMETRY);
    for (const dist of distributions) {
      const summed = sumDistributionSampleTotals(dist);
      expect(summed.forceZKn).toBeCloseTo(dist.totals.forceZKn, 9);
      expect(summed.coupleXKnm).toBeCloseTo(dist.totals.coupleXKnm, 9);
      expect(summed.coupleYKnm).toBeCloseTo(dist.totals.coupleYKnm, 9);
    }
  });

  it("reconciles exactly (not merely approximately) for a single unshared-fixed sample", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 0, 5)];
    const rows = buildPhysicalReactions(
      [row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -42, xM: 0, yM: 2 })],
      supports,
      GEOMETRY,
    );
    const [dist] = buildReactionDistributions(rows, supports, GEOMETRY);
    expect(sumDistributionSampleTotals(dist)).toEqual(dist.totals);
  });
});

describe("sumDistributionTotals: never double-counts a shared fixed DOF across distributions", () => {
  it("sums two shared-corner supports' pre-scaled totals back to the single raw shared value", () => {
    const supports: Support[] = [
      edgeSupport("start", "start"),
      edgeSupport("lower", "lower-side"),
    ];
    const geometry: SlabGeometry = { lengthM: 6, widthM: 3, thicknessM: 0.4, skewAngleDeg: 19 };
    const rows = buildPhysicalReactions(
      [
        row({ supportId: "start", nodeId: 0, dof: "uz", type: "fixed", value: -80, xM: 0, yM: 0 }),
        row({ supportId: "lower", nodeId: 0, dof: "uz", type: "fixed", value: -80, xM: 0, yM: 0 }),
      ],
      supports,
      geometry,
    );
    const distributions = buildReactionDistributions(rows, supports, geometry);
    expect(distributions).toHaveLength(2);
    // Each support reports its own pre-scaled half (-40); a plain sum across
    // the two distributions must reconcile to the single raw value (-80),
    // not double it (-160).
    const grand = sumDistributionTotals(distributions);
    expect(grand.forceZKn).toBeCloseTo(-80, 9);

    // And each distribution's own samples-vs-totals reconciliation holds too.
    for (const dist of distributions) {
      expect(sumDistributionSampleTotals(dist).forceZKn).toBeCloseTo(dist.totals.forceZKn, 9);
    }
  });
});

// ---------------------------------------------------------------------------
// formatSupportAxisLabel / distanceOriginLabel
// ---------------------------------------------------------------------------

describe("formatSupportAxisLabel / distanceOriginLabel", () => {
  it("names the authored-line-start origin and the support length for a line support", () => {
    const supports: Support[] = [lineSupport("A", 0, 0, 0, 5)];
    const rows = buildPhysicalReactions(
      [row({ supportId: "A", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: 0, yM: 2 })],
      supports,
      GEOMETRY,
    );
    const [dist] = buildReactionDistributions(rows, supports, GEOMETRY);
    expect(distanceOriginLabel(dist.distanceOrigin)).toBe("authored line start");
    const label = formatSupportAxisLabel(dist);
    expect(label).toContain("5.00 m");
    expect(label).toContain("authored line start");
  });

  it("names the canonical-edge-start origin for an edge support", () => {
    const geometry: SlabGeometry = { lengthM: 6, widthM: 3, thicknessM: 0.4, skewAngleDeg: 19 };
    const supports: Support[] = [edgeSupport("E", "start")];
    const rows = buildPhysicalReactions(
      [row({ supportId: "E", nodeId: 1, dof: "uz", type: "fixed", value: -10, xM: 0, yM: 0 })],
      supports,
      geometry,
    );
    const [dist] = buildReactionDistributions(rows, supports, geometry);
    expect(distanceOriginLabel(dist.distanceOrigin)).toBe("canonical edge start");
    const label = formatSupportAxisLabel(dist);
    expect(label).toContain("canonical edge start");
    expect(label).toContain(`${dist.supportLengthM.toFixed(2)} m`);
  });
});
