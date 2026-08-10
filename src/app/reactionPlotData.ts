// WP-044: pure, dependency-free helpers backing the reaction DISTRIBUTION plot
// (`../components/ReactionDistributionPlot.tsx`) and the reaction block of
// `Viewport.tsx`. Everything here is a pure function over the WP-034 contract
// (`SupportReactionDistribution` / `SupportReactionDistributionSample` in
// `./types`) so it can be unit-tested without rendering React.
//
// Reconciliation note (WP-034 guarantee, reused verbatim — not re-derived
// here): each sample's `total` is already correctly attributed (a shared
// fixed corner is pre-scaled by 1/N across the supports that share it), so a
// plain component-wise SUM of `samples[i].total` across one distribution
// equals that distribution's own `totals`, and summing across DISTINCT
// distributions never double-counts a shared fixed DOF. `sumDistributionSampleTotals`
// below is therefore a plain summation and must never re-weight/re-scale.
import type {
  PhysicalActionTotals,
  SupportReactionDistribution,
  SupportReactionDistributionSample,
} from "./types";

/**
 * The five plottable reaction quantities named in WP-044: the physical
 * vertical reaction, the two GLOBAL-axis couples, and the two SUPPORT-axis
 * (normal/tangent) couples. All are nodal-integrated values already carried
 * on each sample — no density/derivative is computed here.
 */
export type ReactionSeriesKey =
  | "forceZKn"
  | "coupleXKnm"
  | "coupleYKnm"
  | "coupleNormalKnm"
  | "coupleTangentKnm";

export type ReactionSeriesUnits = "kN" | "kN*m";

export interface ReactionSeriesOption {
  key: ReactionSeriesKey;
  label: string;
  units: ReactionSeriesUnits;
}

/** Ordered options for the series selector UI. Order is display order. */
export const REACTION_SERIES_OPTIONS: ReactionSeriesOption[] = [
  { key: "forceZKn", label: "Vertical reaction (Fz)", units: "kN" },
  { key: "coupleXKnm", label: "Global moment (Cx)", units: "kN*m" },
  { key: "coupleYKnm", label: "Global moment (Cy)", units: "kN*m" },
  { key: "coupleNormalKnm", label: "Support-axis moment (normal)", units: "kN*m" },
  { key: "coupleTangentKnm", label: "Support-axis moment (tangent)", units: "kN*m" },
];

export function reactionSeriesOption(key: ReactionSeriesKey): ReactionSeriesOption {
  const found = REACTION_SERIES_OPTIONS.find((option) => option.key === key);
  // Every ReactionSeriesKey has a matching option above; this fallback only
  // satisfies the type checker's "possibly undefined" narrowing.
  return found ?? REACTION_SERIES_OPTIONS[0];
}

export function reactionSeriesUnits(key: ReactionSeriesKey): ReactionSeriesUnits {
  return key === "forceZKn" ? "kN" : "kN*m";
}

/**
 * Maps one sample to the plotted value for the selected series. `forceZKn`/
 * `coupleXKnm`/`coupleYKnm` come straight off `sample.total` (the global-axis
 * physical action totals); `coupleNormalKnm`/`coupleTangentKnm` come off the
 * sample's own support-axis-resolved fields. No unit conversion or rescaling
 * happens here — each field is already in the units `reactionSeriesUnits`
 * reports for its key.
 */
export function reactionSeriesValue(
  sample: SupportReactionDistributionSample,
  key: ReactionSeriesKey,
): number {
  switch (key) {
    case "forceZKn":
      return sample.total.forceZKn;
    case "coupleXKnm":
      return sample.total.coupleXKnm;
    case "coupleYKnm":
      return sample.total.coupleYKnm;
    case "coupleNormalKnm":
      return sample.coupleNormalKnm;
    case "coupleTangentKnm":
      return sample.coupleTangentKnm;
    default:
      return 0;
  }
}

/**
 * True when a sample's reaction includes ANY fixed-DOF contribution shared
 * across two or more supports at a skew corner (`shared-fixed-attribution`)
 * or a mix of a shared/unshared fixed contribution with a spring contribution
 * (`mixed-fixed-spring`). Both cases are flagged with the distinct
 * shared-corner marker in the plot, and both are mesh-sensitive: the shared
 * fixed DOF's value depends on how the mesh resolves the corner node.
 */
export function isSharedCornerSample(sample: SupportReactionDistributionSample): boolean {
  return (
    sample.sourceCase === "shared-fixed-attribution" || sample.sourceCase === "mixed-fixed-spring"
  );
}

/** True when ANY sample in the distribution is a shared/mixed fixed-corner
 * sample. Used to emphasize the mesh-sensitivity caution for the selected
 * support. `null`/`undefined` (no support selected, or none available) is
 * treated as false rather than throwing. */
export function distributionHasSharedCorner(
  distribution: SupportReactionDistribution | null | undefined,
): boolean {
  if (!distribution) return false;
  return distribution.samples.some(isSharedCornerSample);
}

export interface ReactionPlotPoint {
  nodeId: number;
  distanceM: number;
  value: number;
  isSharedCorner: boolean;
}

/**
 * Distribution samples -> plot points for the selected series. Pure and
 * total: a missing distribution (no support selected / none available) maps
 * to an empty array, which the plot component renders as its graceful empty
 * state rather than throwing. Order follows the distribution's own sample
 * order (already `distanceAlongSupportM`-then-`nodeId` sorted by WP-034).
 */
export function buildReactionPlotPoints(
  distribution: SupportReactionDistribution | null | undefined,
  seriesKey: ReactionSeriesKey,
): ReactionPlotPoint[] {
  if (!distribution) return [];
  return distribution.samples.map((sample) => ({
    nodeId: sample.nodeId,
    distanceM: sample.distanceAlongSupportM,
    value: reactionSeriesValue(sample, seriesKey),
    isSharedCorner: isSharedCornerSample(sample),
  }));
}

export interface ReactionPlotDomain {
  xMinM: number;
  xMaxM: number;
  yMin: number;
  yMax: number;
}

/**
 * Plot-axis domain for a distribution's selected-series points. The distance
 * (x) axis always starts at 0 and runs to the support's own physical length
 * (`supportLengthM`) so the plot reads as "position along the whole support",
 * not just the span between the first and last sampled node; a non-positive
 * `supportLengthM` (degenerate support) falls back to the samples' own
 * distance extent. The value (y) axis always includes 0 so the stem baseline
 * is always drawn. Returns `null` when there is nothing to plot.
 */
export function computeReactionPlotDomain(
  distribution: SupportReactionDistribution | null | undefined,
  points: readonly ReactionPlotPoint[],
): ReactionPlotDomain | null {
  if (!distribution || points.length === 0) return null;
  const sampledMax = points.reduce((max, p) => Math.max(max, p.distanceM), 0);
  const xMaxM = distribution.supportLengthM > 0 ? distribution.supportLengthM : sampledMax;
  let yMin = 0;
  let yMax = 0;
  for (const point of points) {
    if (point.value < yMin) yMin = point.value;
    if (point.value > yMax) yMax = point.value;
  }
  return { xMinM: 0, xMaxM, yMin, yMax };
}

const EMPTY_TOTALS: PhysicalActionTotals = { forceZKn: 0, coupleXKnm: 0, coupleYKnm: 0 };

/**
 * Reconciles a distribution's reported `totals` against a plain
 * component-wise SUM of its own `samples[i].total`. This MUST stay a simple
 * summation: the WP-034 contract guarantees each sample's `total` is already
 * correctly attributed (a shared fixed corner is pre-scaled by 1/N across the
 * supports that share it), so summing plainly reconciles exactly and re-
 * weighting here would double-count or under-count a shared fixed DOF.
 */
export function sumDistributionSampleTotals(
  distribution: SupportReactionDistribution,
): PhysicalActionTotals {
  return distribution.samples.reduce(
    (acc, sample) => ({
      forceZKn: acc.forceZKn + sample.total.forceZKn,
      coupleXKnm: acc.coupleXKnm + sample.total.coupleXKnm,
      coupleYKnm: acc.coupleYKnm + sample.total.coupleYKnm,
    }),
    EMPTY_TOTALS,
  );
}

/**
 * Component-wise sum of `totals` across MULTIPLE distributions (e.g. every
 * support in the model). Combined with `sumDistributionSampleTotals`, this
 * lets a caller reconcile "all samples across every support" against the
 * grand total by plain summation at both levels, with no separate weighting
 * step and no double-count of a shared fixed DOF (WP-034 invariant).
 */
export function sumDistributionTotals(
  distributions: readonly SupportReactionDistribution[],
): PhysicalActionTotals {
  return distributions.reduce(
    (acc, dist) => ({
      forceZKn: acc.forceZKn + dist.totals.forceZKn,
      coupleXKnm: acc.coupleXKnm + dist.totals.coupleXKnm,
      coupleYKnm: acc.coupleYKnm + dist.totals.coupleYKnm,
    }),
    EMPTY_TOTALS,
  );
}

/** Human-readable label for a distribution's `distanceOrigin` discriminant. */
export function distanceOriginLabel(
  distanceOrigin: SupportReactionDistribution["distanceOrigin"],
): string {
  return distanceOrigin === "canonical-edge-start" ? "canonical edge start" : "authored line start";
}

/** X-axis label text: names the physical support length and the origin the
 * `distanceAlongSupportM` samples are measured from, per WP-044 task 1. */
export function formatSupportAxisLabel(distribution: SupportReactionDistribution): string {
  return `Distance along support (m) — length ${distribution.supportLengthM.toFixed(2)} m, origin: ${distanceOriginLabel(
    distribution.distanceOrigin,
  )}`;
}
