/**
 * WP-034: per-support physical reaction ROWS and ordered DISTRIBUTIONS.
 *
 * Pure, total engine. Two exported entry points:
 *   - `buildPhysicalReactions`: raw solver-facade reaction records (per node,
 *     per raw DOF `uz/rx/ry`, fixed or spring) -> flat physical-action ROWS
 *     (`forceZ`/`coupleX`/`coupleY`) satisfying `SupportReactionRow` in
 *     "./types".
 *   - `buildReactionDistributions`: those rows (or the raw records directly)
 *     -> one ordered `SupportReactionDistribution` per edge/line support,
 *     satisfying "./types". Point supports never appear in a distribution
 *     (ADR-skew-data-api-contracts.md Sec. 9.1: "Only edge/line supports
 *     appear").
 *
 * Every sign and frame decision below reuses an already-accepted repository
 * convention rather than a fresh derivation; each is cited at its use site.
 * The two primary sources are:
 *   - docs/adr/ADR-skew-mathematical-conventions.md ("the math ADR"): the
 *     authoritative fixed/spring sign conversion (Sec. 7.3), the generalized
 *     Ru+beta couple mapping (Sec. 4.2), the support tangent/n+ convention
 *     (Sec. 9), and the tensor-vs-vector resolution rule (Sec. 10).
 *   - docs/adr/ADR-skew-data-api-contracts.md Sec. 9.1 ("the API ADR"): the
 *     exact `SupportReactionRow`/`SupportReactionDistribution` contract, the
 *     canonical-edge vs authored-line-left-normal frame definitions, and the
 *     equal shared-fixed-reporting attribution rule.
 *
 * Neither function throws on malformed or degenerate input; a raw reaction
 * or support that cannot be resolved to a location/frame is excluded, never
 * fabricated (WP-034 invariant 6, matching the existing app-adapter
 * "never synthesize evidence" pattern used throughout solverAdapter.ts).
 */
import type { Point2D } from "../solver/geometry/types";
import { getDeckEdgeSegment } from "../solver/geometry/deckCoordinates";
import { supportAxisFrame } from "../solver/post/momentTensor";
import { mapGeneralizedMomentToPhysicalCouple } from "../solver/post/reactionMomentMapping";
import type {
  AuthoredLineReactionFrame,
  CanonicalEdgeReactionFrame,
  Dof,
  FixedReactionAttribution,
  PhysicalActionTotals,
  SlabGeometry,
  Support,
  SupportReactionComponent,
  SupportReactionDistribution,
  SupportReactionDistributionSample,
  SupportReactionRow,
  SupportReactionSourceSubtotals,
  UnitPlanarDirection,
} from "./types";

/** A single raw restrained-DOF reaction record from the solver facade payload
 * (`SolverPayload["reactions"][number]` in `src/solver/index.ts`). Declared
 * locally because that facade type is not exported; the shape is the accepted
 * public contract regardless (`supportId/nodeId/dof/type/value/units` plus
 * the WP-032A `xM/yM` location fields). */
export interface PayloadReactionRow {
  supportId: string;
  nodeId: number;
  dof: Dof;
  type: "fixed" | "spring";
  value: number;
  units: string;
  xM: number;
  yM: number;
}

interface ResolvedSupportFrame {
  origin: Point2D;
  tangent: UnitPlanarDirection;
  normal: UnitPlanarDirection;
  supportLengthM: number;
}

function normalizeSignedZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function emptyTotals(): PhysicalActionTotals {
  return { forceZKn: 0, coupleXKnm: 0, coupleYKnm: 0 };
}

function addTotals(a: PhysicalActionTotals, b: PhysicalActionTotals): PhysicalActionTotals {
  return {
    forceZKn: normalizeSignedZero(a.forceZKn + b.forceZKn),
    coupleXKnm: normalizeSignedZero(a.coupleXKnm + b.coupleXKnm),
    coupleYKnm: normalizeSignedZero(a.coupleYKnm + b.coupleYKnm),
  };
}

function addComponent(
  totals: PhysicalActionTotals,
  component: SupportReactionComponent["component"],
  value: number,
): void {
  if (component === "forceZ") {
    totals.forceZKn += value;
  } else if (component === "coupleX") {
    totals.coupleXKnm += value;
  } else {
    totals.coupleYKnm += value;
  }
}

/**
 * External (support-on-slab) generalized value from the raw stored solver
 * reaction. Fixed records already store the external action (`K*u - f`
 * residual); spring records store the raw `+k*u` and must be sign-flipped to
 * the external `-k*u` action. Math ADR Sec. 7.1/7.3 (normative table) and the
 * identical rule already applied in `computeSignedEquilibrium`
 * (src/solver/core/equilibrium.ts: `action.kind === "fixed" ? action.value :
 * -action.value`) -- reused here rather than re-derived.
 */
function externalGeneralizedValue(type: "fixed" | "spring", rawValue: number): number {
  return type === "fixed" ? rawValue : -rawValue;
}

/**
 * Maps a single raw DOF reaction to its physical action component. Reuses
 * the WP-031A `mapGeneralizedMomentToPhysicalCouple` mapping (also the basis
 * of `computeSignedEquilibrium`'s `actionContribution`): a raw `rx` record is
 * the generalized moment conjugate to `betaX` only, and a raw `ry` record is
 * conjugate to `betaY` only, so each maps through with the other generalized
 * component held at zero. `uz` needs no couple mapping: physical `forceZ` is
 * exactly the external generalized value (math ADR Sec. 7.3 table, `w` row).
 */
function physicalComponentFromDof(
  dof: Dof,
  type: "fixed" | "spring",
  rawValue: number,
): { component: SupportReactionComponent["component"]; value: number } {
  const external = externalGeneralizedValue(type, rawValue);
  if (dof === "uz") {
    return { component: "forceZ", value: normalizeSignedZero(external) };
  }
  if (dof === "rx") {
    const couple = mapGeneralizedMomentToPhysicalCouple({
      conjugateToBetaX: external,
      conjugateToBetaY: 0,
    });
    return { component: "coupleY", value: couple.coupleY };
  }
  const couple = mapGeneralizedMomentToPhysicalCouple({
    conjugateToBetaX: 0,
    conjugateToBetaY: external,
  });
  return { component: "coupleX", value: couple.coupleX };
}

/**
 * Resolves a support's reporting frame, origin, and Euclidean length.
 *
 * Edge supports (`supportKind: 'edge'`): the canonical segment from
 * `getDeckEdgeSegment` (API ADR Sec. 3.2: start/end run lower-to-upper
 * increasing t; lower-/upper-side run start-to-end increasing s) feeds the
 * already-accepted `supportAxisFrame` (WP-031B, src/solver/post/momentTensor.ts:
 * normal = tangent rotated -90 degrees). For the start/end edges this
 * reproduces the math ADR Sec. 9 `n+ = (cos(theta), -sin(theta))`,
 * `tau = (sin(theta), cos(theta))` exactly and identically for BOTH start and
 * end (the segment tangent formula does not flip between them), matching the
 * API ADR's explicit statement that "start/end frames reproduce the accepted
 * n+ ... convention exactly" -- i.e. the same n+, not the direction-flipping
 * "inward" normal that `getSupportAxes` reports separately. The origin is the
 * segment's first point, i.e. `canonical-edge-start`.
 *
 * Line supports (`supportKind: 'line'`): origin is the authored `(x1,y1)`;
 * tangent is the normalized authored direction; normal is the fixed
 * "left normal" `(-tau.y, tau.x)` (API ADR Sec. 9.1, verbatim formula).
 *
 * Returns `null` for a degenerate (zero-length) or otherwise unresolvable
 * support so the caller can exclude it rather than fabricate a frame.
 */
function resolveSupportFrame(support: Support, geometry: SlabGeometry): ResolvedSupportFrame | null {
  if (support.kind === "edge") {
    let segment: readonly [Point2D, Point2D];
    try {
      segment = getDeckEdgeSegment(geometry, support.edge);
    } catch {
      return null;
    }
    const [start, end] = segment;
    const supportLengthM = Math.hypot(end.x - start.x, end.y - start.y);
    if (!Number.isFinite(supportLengthM) || supportLengthM === 0) {
      return null;
    }
    let axisFrame;
    try {
      axisFrame = supportAxisFrame(start, end);
    } catch {
      return null;
    }
    return { origin: start, tangent: axisFrame.tangent, normal: axisFrame.normal, supportLengthM };
  }

  if (support.kind === "line") {
    const dx = support.x2 - support.x1;
    const dy = support.y2 - support.y1;
    const supportLengthM = Math.hypot(dx, dy);
    if (!Number.isFinite(supportLengthM) || supportLengthM === 0) {
      return null;
    }
    const tangent: UnitPlanarDirection = { x: dx / supportLengthM, y: dy / supportLengthM };
    // Authored left normal, API ADR Sec. 9.1: "its fixed left normal is
    // n = (-tau.y, tau.x)".
    const normal: UnitPlanarDirection = { x: -tangent.y, y: tangent.x };
    return { origin: { x: support.x1, y: support.y1 }, tangent, normal, supportLengthM };
  }

  return null;
}

function distanceAlong(pointX: number, pointY: number, origin: Point2D, tangent: UnitPlanarDirection): number {
  return (pointX - origin.x) * tangent.x + (pointY - origin.y) * tangent.y;
}

/**
 * Resolves a physical couple `(coupleX, coupleY)` onto a frame's normal and
 * tangent as a plain orthonormal vector decomposition (`Cn = C.n`,
 * `Ct = C.t`). This is valid regardless of whether the frame is a proper
 * rotation or a reflection of the global axes: math ADR Sec. 9's
 * `v_n = c*v_x - s*v_y, v_t = s*v_x + c*v_y` is exactly this dot product for
 * the canonical-edge frame, and the same projection identity holds for any
 * orthonormal (n, t) pair because `C = Cn*n + Ct*t` is simply an orthogonal
 * decomposition of the fixed vector C -- it does not depend on the row
 * ordering/handedness of (n, t). (Math ADR Sec. 10's "axial rule under a
 * reflection" caveat concerns relating couples ACROSS the +theta/-theta
 * mirrored models of Sec. 11, a different operation from resolving one
 * already-known vector onto a single frame's own axes.)
 */
function resolveCoupleOntoFrame(
  coupleXKnm: number,
  coupleYKnm: number,
  frame: Pick<ResolvedSupportFrame, "normal" | "tangent">,
): { coupleNormalKnm: number; coupleTangentKnm: number } {
  return {
    coupleNormalKnm: normalizeSignedZero(coupleXKnm * frame.normal.x + coupleYKnm * frame.normal.y),
    coupleTangentKnm: normalizeSignedZero(coupleXKnm * frame.tangent.x + coupleYKnm * frame.tangent.y),
  };
}

function buildRow(
  entry: PayloadReactionRow,
  fraction: number,
  sharedBySupportIds: string[],
  source: "fixed" | "spring",
  supportsById: Map<string, Support>,
  geometry: SlabGeometry,
): SupportReactionRow | null {
  const support = supportsById.get(entry.supportId);
  if (!support) {
    // Never fabricate a location/frame for an unknown support id.
    return null;
  }
  if (!Number.isFinite(entry.xM) || !Number.isFinite(entry.yM)) {
    return null;
  }

  const { component, value: fullValue } = physicalComponentFromDof(entry.dof, entry.type, entry.value);
  const value = normalizeSignedZero(fullValue * fraction);

  const base = {
    supportId: entry.supportId,
    nodeId: entry.nodeId,
    source,
    attributionFraction: fraction,
    sharedBySupportIds,
  };

  const componentPart =
    component === "forceZ"
      ? ({ component: "forceZ", value, units: "kN" } as const)
      : ({ component, value, units: "kN*m" } as const);

  if (support.kind === "point") {
    return { ...base, ...componentPart, supportKind: "point", xM: entry.xM, yM: entry.yM };
  }

  const frame = resolveSupportFrame(support, geometry);
  if (!frame) {
    // Degenerate/unresolvable edge or line support: exclude rather than
    // invent a distance-along-support origin (WP-034 invariant 6).
    return null;
  }

  const distanceAlongSupportM = distanceAlong(entry.xM, entry.yM, frame.origin, frame.tangent);

  return {
    ...base,
    ...componentPart,
    supportKind: support.kind,
    xM: entry.xM,
    yM: entry.yM,
    distanceAlongSupportM,
  };
}

/**
 * Raw payload reactions -> physical action rows (`forceZ`/`coupleX`/`coupleY`).
 *
 * Grouping and precedence per (nodeId, dof):
 *   - If any record at that DOF is `fixed`, every `spring` record at the same
 *     (nodeId, dof) is dropped: a fixed restraint takes precedence and a
 *     spring cannot also act on an already-fixed DOF (math ADR Sec. 7.3;
 *     identical to `computeSignedEquilibrium`'s `claimedFixedDofs` rule).
 *   - If the fixed DOF is claimed by exactly one support, its row is
 *     unshared: `attributionFraction = 1`. If claimed by N >= 2 supports
 *     (a skew-corner shared node), each of the N supports reports its OWN
 *     row scaled by `1/N` ("equal-shared-fixed-reporting", API ADR Sec.
 *     9.1/Sec. 6): the N rows are direct signed sums that reconcile to the
 *     single physical value exactly once, with no separate weighting step
 *     needed downstream.
 *   - Spring records are never deduplicated/split across supports: distinct
 *     spring assignments on the same DOF are genuinely separate physical
 *     actions and are simply summed (math ADR Sec. 7.3: "Multiple spring
 *     assignments on one DOF may be summed"). Each spring row therefore
 *     carries `attributionFraction = 1` and `sharedBySupportIds = [own id]`.
 */
export function buildPhysicalReactions(
  payloadReactions: readonly PayloadReactionRow[],
  supports: readonly Support[],
  geometry: SlabGeometry,
): SupportReactionRow[] {
  const supportsById = new Map(supports.map((support) => [support.id, support] as const));

  const groups = new Map<string, PayloadReactionRow[]>();
  for (const entry of payloadReactions) {
    const key = `${entry.nodeId}:${entry.dof}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }

  const rows: SupportReactionRow[] = [];

  for (const group of groups.values()) {
    const fixedEntries = group.filter((entry) => entry.type === "fixed");

    if (fixedEntries.length > 0) {
      const distinctSupportIds = [...new Set(fixedEntries.map((entry) => entry.supportId))].sort();
      const fraction = 1 / distinctSupportIds.length;
      for (const entry of fixedEntries) {
        const row = buildRow(entry, fraction, distinctSupportIds, "fixed", supportsById, geometry);
        if (row) {
          rows.push(row);
        }
      }
      continue;
    }

    for (const entry of group) {
      const row = buildRow(entry, 1, [entry.supportId], "spring", supportsById, geometry);
      if (row) {
        rows.push(row);
      }
    }
  }

  return rows;
}

function isPhysicalReactionRows(
  reactions: readonly SupportReactionRow[] | readonly PayloadReactionRow[],
): reactions is readonly SupportReactionRow[] {
  return reactions.length === 0 || "component" in reactions[0];
}

function buildSample(
  nodeId: number,
  rows: readonly SupportReactionRow[],
  frame: ResolvedSupportFrame,
): SupportReactionDistributionSample {
  const first = rows[0];
  const fixedAttributed = emptyTotals();
  const springDirect = emptyTotals();

  let hasFixed = false;
  let hasSpring = false;
  const fixedSharedIds: string[] = [];

  for (const row of rows) {
    if (row.source === "fixed") {
      hasFixed = true;
      fixedSharedIds.push(...row.sharedBySupportIds);
      addComponent(fixedAttributed, row.component, row.value);
    } else {
      hasSpring = true;
      addComponent(springDirect, row.component, row.value);
    }
  }

  const total = addTotals(fixedAttributed, springDirect);
  const { coupleNormalKnm, coupleTangentKnm } = resolveCoupleOntoFrame(
    total.coupleXKnm,
    total.coupleYKnm,
    frame,
  );

  const base = {
    nodeId,
    xM: first.xM,
    yM: first.yM,
    // Edge/line rows always carry this field (see SupportReactionLocation);
    // the `?? 0` only satisfies the TS optional-field type, it is never used
    // for a point row since distributions never contain point supports.
    distanceAlongSupportM: first.distanceAlongSupportM ?? 0,
    sourceSubtotals: { fixedAttributed, springDirect },
    total,
    coupleNormalKnm,
    coupleTangentKnm,
  };

  if (!hasFixed) {
    return { ...base, sourceCase: "spring-direct" };
  }

  const mergedSharedIds = [...new Set(fixedSharedIds)].sort();
  const fixedAttribution: FixedReactionAttribution =
    mergedSharedIds.length > 1
      ? {
          method: "equal-shared-fixed-reporting",
          attributionFraction: 1 / mergedSharedIds.length,
          sharedBySupportIds: mergedSharedIds as [string, string, ...string[]],
        }
      : {
          method: "unshared-fixed",
          attributionFraction: 1,
          sharedBySupportIds: mergedSharedIds as [string],
        };

  if (hasSpring) {
    return { ...base, sourceCase: "mixed-fixed-spring", fixedAttribution };
  }
  if (fixedAttribution.method === "unshared-fixed") {
    return { ...base, sourceCase: "unshared-fixed", fixedAttribution };
  }
  return { ...base, sourceCase: "shared-fixed-attribution", fixedAttribution };
}

/**
 * Physical reaction rows (or raw payload reactions, normalized internally via
 * `buildPhysicalReactions`) -> one ordered `SupportReactionDistribution` per
 * edge/line support. Point supports are excluded (API ADR Sec. 9.1: "Only
 * edge/line supports appear").
 *
 * Samples combine every row at a given (support, node) into one entry, are
 * ordered strictly by increasing `distanceAlongSupportM` with `nodeId` as the
 * deterministic tie-breaker (API ADR Sec. 9.1), and support/global totals are
 * plain componentwise sums of the samples/rows -- no separate weighting step,
 * since shared-fixed rows already carry their pre-scaled `1/N` value.
 */
export function buildReactionDistributions(
  reactions: readonly SupportReactionRow[] | readonly PayloadReactionRow[],
  supports: readonly Support[],
  geometry: SlabGeometry,
): SupportReactionDistribution[] {
  const rows = isPhysicalReactionRows(reactions)
    ? reactions
    : buildPhysicalReactions(reactions, supports, geometry);

  const supportsById = new Map(supports.map((support) => [support.id, support] as const));

  const bySupport = new Map<string, SupportReactionRow[]>();
  for (const row of rows) {
    if (row.supportKind === "point") {
      continue;
    }
    const existing = bySupport.get(row.supportId);
    if (existing) {
      existing.push(row);
    } else {
      bySupport.set(row.supportId, [row]);
    }
  }

  const distributions: SupportReactionDistribution[] = [];

  for (const [supportId, supportRows] of bySupport) {
    const support = supportsById.get(supportId);
    if (!support || support.kind === "point") {
      continue;
    }
    const frame = resolveSupportFrame(support, geometry);
    if (!frame) {
      // Degenerate/unresolvable support: never fabricate a distribution.
      continue;
    }

    const byNode = new Map<number, SupportReactionRow[]>();
    for (const row of supportRows) {
      const existing = byNode.get(row.nodeId);
      if (existing) {
        existing.push(row);
      } else {
        byNode.set(row.nodeId, [row]);
      }
    }

    const samples: SupportReactionDistributionSample[] = [];
    for (const [nodeId, nodeRows] of byNode) {
      samples.push(buildSample(nodeId, nodeRows, frame));
    }
    samples.sort(
      (a, b) => a.distanceAlongSupportM - b.distanceAlongSupportM || a.nodeId - b.nodeId,
    );

    const sourceTotals: SupportReactionSourceSubtotals = {
      fixedAttributed: samples.reduce(
        (sum, sample) => addTotals(sum, sample.sourceSubtotals.fixedAttributed),
        emptyTotals(),
      ),
      springDirect: samples.reduce(
        (sum, sample) => addTotals(sum, sample.sourceSubtotals.springDirect),
        emptyTotals(),
      ),
    };
    const totals = addTotals(sourceTotals.fixedAttributed, sourceTotals.springDirect);

    const base = {
      supportId,
      supportLengthM: frame.supportLengthM,
      samples,
      sourceTotals,
      totals,
    };

    if (support.kind === "edge") {
      const edgeFrame: CanonicalEdgeReactionFrame = {
        frameKind: "canonical-edge",
        tangent: frame.tangent,
        normal: frame.normal,
      };
      distributions.push({
        ...base,
        supportKind: "edge",
        edge: support.edge,
        distanceOrigin: "canonical-edge-start",
        frame: edgeFrame,
      });
    } else {
      const lineFrame: AuthoredLineReactionFrame = {
        frameKind: "authored-line-left-normal",
        tangent: frame.tangent,
        normal: frame.normal,
      };
      distributions.push({
        ...base,
        supportKind: "line",
        distanceOrigin: "authored-line-start",
        frame: lineFrame,
      });
    }
  }

  distributions.sort((a, b) => a.supportId.localeCompare(b.supportId));
  return distributions;
}
