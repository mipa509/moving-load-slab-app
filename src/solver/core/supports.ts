import type { DeckEdge, Point2D } from "../geometry/types";
import type {
  DofKey,
  GeneralizedSupportDof,
  InternalNormalizedSupport,
  MappedSupportResult,
  NormalizedGeneralizedDofConstraints,
  NormalizedSupportRestraint,
  StructuredMesh,
  SupportDefinition,
  SupportDofConstraint,
} from "../model/types";
import { DOF_INDEX_BY_KEY } from "../model/types";
import { findAxisCoordinateIndex } from "./mesh";

const DEFAULT_TOLERANCE = 1e-9;

/** Generalized rotation DOFs share DOF indices with the legacy rx/ry slots (WP-002 ADR). */
const GENERALIZED_DOF_TO_LEGACY: Record<GeneralizedSupportDof, DofKey> = {
  w: "w",
  betaX: "rx",
  betaY: "ry",
};

interface SupportMemberNode {
  nodeId: number;
  position: Point2D;
}

/**
 * Map normalized edge/line/point supports onto an already-generated structured
 * mesh. Edges map by topology, retained point supports by nearest-node physical
 * distance, and retained coordinate lines by exact point-to-segment membership.
 * Line/edge springs are distributed by Euclidean tributary so a total stiffness
 * is conserved under refinement. Shared corners are exposed once per support in
 * `assignments` while the solve DOF set is deduplicated.
 */
export function mapNormalizedSupportsToMesh(
  mesh: StructuredMesh,
  supports: InternalNormalizedSupport[],
  tolerance: number = DEFAULT_TOLERANCE,
): MappedSupportResult {
  const fixedDofs = new Set<number>();
  const springStiffnessByDof = new Map<number, number>();
  const assignments: MappedSupportResult["assignments"] = [];

  for (const support of supports) {
    const { members, tangent } = collectSupportMemberNodes(mesh, support, tolerance);
    const dofs = resolveGeneralizedDofs(support.restraint, support.id);
    const distributed = support.kind !== "point";
    const fractions = distributed
      ? euclideanTributaryFractions(members, tangent)
      : new Map(members.map((member) => [member.nodeId, 1]));

    for (const member of members) {
      for (const generalizedDof of ["w", "betaX", "betaY"] as GeneralizedSupportDof[]) {
        const constraint = dofs[generalizedDof];
        if (!constraint || constraint.kind === "free") {
          continue;
        }
        const legacyDof = GENERALIZED_DOF_TO_LEGACY[generalizedDof];
        const globalDof = member.nodeId * 3 + DOF_INDEX_BY_KEY[legacyDof];

        if (constraint.kind === "fixed") {
          fixedDofs.add(globalDof);
          assignments.push({
            supportId: support.id,
            nodeId: member.nodeId,
            dof: legacyDof,
            kind: "fixed",
          });
        } else {
          const stiffness = distributed
            ? constraint.stiffness * (fractions.get(member.nodeId) ?? 0)
            : constraint.stiffness;
          if (stiffness <= 0) {
            continue;
          }
          springStiffnessByDof.set(
            globalDof,
            (springStiffnessByDof.get(globalDof) ?? 0) + stiffness,
          );
          assignments.push({
            supportId: support.id,
            nodeId: member.nodeId,
            dof: legacyDof,
            kind: "spring",
            stiffness,
          });
        }
      }
    }
  }

  return { fixedDofs, springStiffnessByDof, assignments };
}

function collectSupportMemberNodes(
  mesh: StructuredMesh,
  support: InternalNormalizedSupport,
  tolerance: number,
): { members: SupportMemberNode[]; tangent: Point2D } {
  if (support.kind === "edge") {
    const nodeIds = getEdgeNodeIds(mesh, support.edge);
    const members = nodeIds.map((nodeId) => toMemberNode(mesh, nodeId));
    const tangent =
      members.length >= 2
        ? {
            x: members[members.length - 1].position.x - members[0].position.x,
            y: members[members.length - 1].position.y - members[0].position.y,
          }
        : { x: 1, y: 0 };
    return { members, tangent };
  }

  if (support.kind === "point") {
    const nodeId = findNearestNodeId(mesh, support.x, support.y, tolerance, support.id);
    return { members: [toMemberNode(mesh, nodeId)], tangent: { x: 1, y: 0 } };
  }

  const members = getLineMemberNodes(mesh, support, tolerance);
  return {
    members,
    tangent: { x: support.x2 - support.x1, y: support.y2 - support.y1 },
  };
}

function toMemberNode(mesh: StructuredMesh, nodeId: number): SupportMemberNode {
  const node = mesh.nodes[nodeId];
  return { nodeId, position: { x: node.x, y: node.y } };
}

function getEdgeNodeIds(mesh: StructuredMesh, edge: DeckEdge): number[] {
  const lastI = mesh.sCoords.length - 1;
  const lastJ = mesh.tCoords.length - 1;
  switch (edge) {
    case "start":
      return mesh.nodeIdsByIJ.map((row) => row[0]);
    case "end":
      return mesh.nodeIdsByIJ.map((row) => row[lastI]);
    case "lower-side":
      return [...mesh.nodeIdsByIJ[0]];
    case "upper-side":
      return [...mesh.nodeIdsByIJ[lastJ]];
    default: {
      const exhaustive: never = edge;
      throw new Error(`Unknown deck edge "${String(exhaustive)}".`);
    }
  }
}

function findNearestNodeId(
  mesh: StructuredMesh,
  x: number,
  y: number,
  tolerance: number,
  supportId: string,
): number {
  let bestNodeId = -1;
  let bestDistance = Infinity;
  for (const node of mesh.nodes) {
    const distance = Math.hypot(node.x - x, node.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestNodeId = node.id;
    }
  }
  if (bestNodeId < 0 || bestDistance > tolerance) {
    throw new Error(
      `Point support "${supportId}" has no meshed node within tolerance (nearest distance ${bestDistance}).`,
    );
  }
  return bestNodeId;
}

function getLineMemberNodes(
  mesh: StructuredMesh,
  support: Extract<InternalNormalizedSupport, { kind: "line" }>,
  tolerance: number,
): SupportMemberNode[] {
  const ax = support.x1;
  const ay = support.y1;
  const dx = support.x2 - ax;
  const dy = support.y2 - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= tolerance * tolerance) {
    throw new Error(`Line support "${support.id}" is degenerate (zero length).`);
  }

  const members: SupportMemberNode[] = [];
  let startCovered = false;
  let endCovered = false;

  for (const node of mesh.nodes) {
    const wx = node.x - ax;
    const wy = node.y - ay;
    const projection = (wx * dx + wy * dy) / lengthSquared;
    const footX = ax + projection * dx;
    const footY = ay + projection * dy;
    const perpendicular = Math.hypot(node.x - footX, node.y - footY);
    const withinSpan =
      projection >= -tolerance / Math.sqrt(lengthSquared) &&
      projection <= 1 + tolerance / Math.sqrt(lengthSquared);
    if (perpendicular <= tolerance && withinSpan) {
      members.push({ nodeId: node.id, position: { x: node.x, y: node.y } });
      if (Math.hypot(node.x - ax, node.y - ay) <= tolerance) {
        startCovered = true;
      }
      if (Math.hypot(node.x - support.x2, node.y - support.y2) <= tolerance) {
        endCovered = true;
      }
    }
  }

  if (members.length < 2 || !startCovered || !endCovered) {
    throw new Error(
      `Line support "${support.id}" is not represented by meshed nodes (unsupported internal line).`,
    );
  }
  return members;
}

function euclideanTributaryFractions(
  members: SupportMemberNode[],
  tangent: Point2D,
): Map<number, number> {
  if (members.length <= 1) {
    return new Map(members.map((member) => [member.nodeId, 1]));
  }

  const tangentLength = Math.hypot(tangent.x, tangent.y);
  const unitX = tangentLength > 0 ? tangent.x / tangentLength : 1;
  const unitY = tangentLength > 0 ? tangent.y / tangentLength : 0;

  const ordered = members
    .map((member) => ({
      nodeId: member.nodeId,
      arcLength: member.position.x * unitX + member.position.y * unitY,
    }))
    .sort((a, b) => a.arcLength - b.arcLength);

  const tributaryByNode = new Map<number, number>();
  let tributaryTotal = 0;
  for (let i = 0; i < ordered.length; i += 1) {
    const current = ordered[i].arcLength;
    const previous = i > 0 ? ordered[i - 1].arcLength : undefined;
    const next = i < ordered.length - 1 ? ordered[i + 1].arcLength : undefined;

    let tributary = 0;
    if (previous === undefined && next !== undefined) {
      tributary = 0.5 * (next - current);
    } else if (previous !== undefined && next === undefined) {
      tributary = 0.5 * (current - previous);
    } else if (previous !== undefined && next !== undefined) {
      tributary = 0.5 * (next - previous);
    }

    const nonNegative = Math.max(0, tributary);
    tributaryByNode.set(ordered[i].nodeId, nonNegative);
    tributaryTotal += nonNegative;
  }

  if (tributaryTotal <= 0) {
    const uniform = 1 / members.length;
    return new Map(members.map((member) => [member.nodeId, uniform]));
  }

  const fractions = new Map<number, number>();
  for (const [nodeId, tributary] of tributaryByNode.entries()) {
    fractions.set(nodeId, tributary / tributaryTotal);
  }
  return fractions;
}

function resolveGeneralizedDofs(
  restraint: NormalizedSupportRestraint,
  supportId: string,
): NormalizedGeneralizedDofConstraints {
  if (restraint.behavior === "fixed") {
    return { w: { kind: "fixed" }, betaX: { kind: "fixed" }, betaY: { kind: "fixed" } };
  }
  if (restraint.behavior === "pinned") {
    return { w: { kind: "fixed" }, betaX: { kind: "free" }, betaY: { kind: "free" } };
  }
  return {
    w: normalizeGeneralizedConstraint("w", restraint.dofs.w, supportId),
    betaX: normalizeGeneralizedConstraint("betaX", restraint.dofs.betaX, supportId),
    betaY: normalizeGeneralizedConstraint("betaY", restraint.dofs.betaY, supportId),
  };
}

function normalizeGeneralizedConstraint(
  label: GeneralizedSupportDof,
  constraint: SupportDofConstraint,
  supportId: string,
): SupportDofConstraint {
  if (constraint.kind !== "spring") {
    return constraint;
  }
  if (!Number.isFinite(constraint.stiffness) || constraint.stiffness <= 0) {
    throw new Error(
      `Spring stiffness for ${label} on support "${supportId}" must be positive.`,
    );
  }
  return constraint;
}

export function mapSupportsToMesh(
  mesh: StructuredMesh,
  supports: SupportDefinition[],
  tolerance: number = DEFAULT_TOLERANCE,
): MappedSupportResult {
  const fixedDofs = new Set<number>();
  const springStiffnessByDof = new Map<number, number>();
  const assignments: MappedSupportResult["assignments"] = [];

  for (const support of supports) {
    const nodes = getSupportNodeIds(mesh, support, tolerance);
    const dofs = resolveSupportDofs(support);
    const springFractionsByNode =
      support.kind === "line"
        ? getLineSpringFractionsByNode(mesh, nodes, support, tolerance)
        : undefined;

    for (const nodeId of nodes) {
      for (const key of ["w", "rx", "ry"] as DofKey[]) {
        const constraint = dofs[key];
        if (!constraint || constraint.kind === "free") {
          continue;
        }
        const globalDof = nodeId * 3 + DOF_INDEX_BY_KEY[key];
        if (constraint.kind === "fixed") {
          fixedDofs.add(globalDof);
          assignments.push({
            supportId: support.id ?? "support",
            nodeId,
            dof: key,
            kind: "fixed",
          });
        } else if (constraint.kind === "spring") {
          const distributedStiffness =
            support.kind === "line"
              ? constraint.stiffness * (springFractionsByNode?.get(nodeId) ?? 0)
              : constraint.stiffness;
          if (distributedStiffness <= 0) {
            continue;
          }
          springStiffnessByDof.set(
            globalDof,
            (springStiffnessByDof.get(globalDof) ?? 0) + distributedStiffness,
          );
          assignments.push({
            supportId: support.id ?? "support",
            nodeId,
            dof: key,
            kind: "spring",
            stiffness: distributedStiffness,
          });
        }
      }
    }
  }

  return {
    fixedDofs,
    springStiffnessByDof,
    assignments,
  };
}

function getSupportNodeIds(
  mesh: StructuredMesh,
  support: SupportDefinition,
  tolerance: number,
): number[] {
  if (support.kind === "point") {
    const ix = findAxisCoordinateIndex(mesh.xCoords, support.x, tolerance);
    const iy = findAxisCoordinateIndex(mesh.yCoords, support.y, tolerance);
    if (ix < 0 || iy < 0) {
      throw new Error(`Point support "${support.id ?? "support"}" could not be mapped to a node.`);
    }
    return [mesh.nodeIdsByIJ[iy][ix]];
  }

  const horizontal = Math.abs(support.y1 - support.y2) <= tolerance;
  const vertical = Math.abs(support.x1 - support.x2) <= tolerance;
  if (!horizontal && !vertical) {
    throw new Error(
      `Line support "${support.id ?? "support"}" must be axis-aligned for v1 (x1==x2 or y1==y2).`,
    );
  }

  const nodeIds: number[] = [];
  if (vertical) {
    const ix = findAxisCoordinateIndex(mesh.xCoords, support.x1, tolerance);
    if (ix < 0) {
      throw new Error(`Line support "${support.id ?? "support"}" x-coordinate is not on the mesh.`);
    }
    const yMin = Math.min(support.y1, support.y2) - tolerance;
    const yMax = Math.max(support.y1, support.y2) + tolerance;
    for (let iy = 0; iy < mesh.yCoords.length; iy += 1) {
      if (mesh.yCoords[iy] >= yMin && mesh.yCoords[iy] <= yMax) {
        nodeIds.push(mesh.nodeIdsByIJ[iy][ix]);
      }
    }
    return nodeIds;
  }

  const iy = findAxisCoordinateIndex(mesh.yCoords, support.y1, tolerance);
  if (iy < 0) {
    throw new Error(`Line support "${support.id ?? "support"}" y-coordinate is not on the mesh.`);
  }
  const xMin = Math.min(support.x1, support.x2) - tolerance;
  const xMax = Math.max(support.x1, support.x2) + tolerance;
  for (let ix = 0; ix < mesh.xCoords.length; ix += 1) {
    if (mesh.xCoords[ix] >= xMin && mesh.xCoords[ix] <= xMax) {
      nodeIds.push(mesh.nodeIdsByIJ[iy][ix]);
    }
  }
  return nodeIds;
}

function resolveSupportDofs(
  support: SupportDefinition,
): Record<DofKey, SupportDofConstraint> {
  const basePinned: Record<DofKey, SupportDofConstraint> = {
    w: { kind: "fixed" },
    rx: { kind: "free" },
    ry: { kind: "free" },
  };
  const baseFixed: Record<DofKey, SupportDofConstraint> = {
    w: { kind: "fixed" },
    rx: { kind: "fixed" },
    ry: { kind: "fixed" },
  };
  const baseCustom: Record<DofKey, SupportDofConstraint> = {
    w: { kind: "free" },
    rx: { kind: "free" },
    ry: { kind: "free" },
  };
  const base =
    support.behavior === "fixed"
      ? baseFixed
      : support.behavior === "pinned"
        ? basePinned
        : baseCustom;

  return {
    w: normalizeConstraint("w", support.dofs?.w ?? base.w),
    rx: normalizeConstraint("rx", support.dofs?.rx ?? base.rx),
    ry: normalizeConstraint("ry", support.dofs?.ry ?? base.ry),
  };
}

function normalizeConstraint(
  dof: DofKey,
  constraint: SupportDofConstraint,
): SupportDofConstraint {
  if (constraint.kind !== "spring") {
    return constraint;
  }
  if (!Number.isFinite(constraint.stiffness) || constraint.stiffness <= 0) {
    throw new Error(`Spring stiffness for ${dof} must be positive.`);
  }
  return constraint;
}

function getLineSpringFractionsByNode(
  mesh: StructuredMesh,
  nodeIds: number[],
  support: Extract<SupportDefinition, { kind: "line" }>,
  tolerance: number,
): Map<number, number> {
  if (nodeIds.length === 0) {
    throw new Error(`Line support "${support.id ?? "support"}" did not map to any nodes.`);
  }
  if (nodeIds.length === 1) {
    return new Map([[nodeIds[0], 1]]);
  }

  const vertical = Math.abs(support.x1 - support.x2) <= tolerance;
  const ordered = nodeIds
    .map((nodeId) => ({
      nodeId,
      axisCoord: vertical ? mesh.nodes[nodeId].y : mesh.nodes[nodeId].x,
    }))
    .sort((a, b) => a.axisCoord - b.axisCoord);

  const tributaryByNode = new Map<number, number>();
  let tributaryTotal = 0;

  for (let i = 0; i < ordered.length; i += 1) {
    const current = ordered[i].axisCoord;
    const prev = i > 0 ? ordered[i - 1].axisCoord : undefined;
    const next = i < ordered.length - 1 ? ordered[i + 1].axisCoord : undefined;

    let tributary = 0;
    if (prev === undefined && next !== undefined) {
      tributary = 0.5 * (next - current);
    } else if (prev !== undefined && next === undefined) {
      tributary = 0.5 * (current - prev);
    } else if (prev !== undefined && next !== undefined) {
      tributary = 0.5 * (next - prev);
    }

    const nonNegativeTributary = Math.max(0, tributary);
    tributaryByNode.set(ordered[i].nodeId, nonNegativeTributary);
    tributaryTotal += nonNegativeTributary;
  }

  if (tributaryTotal <= tolerance) {
    const uniformShare = 1 / nodeIds.length;
    return new Map(nodeIds.map((nodeId) => [nodeId, uniformShare]));
  }

  const fractionsByNode = new Map<number, number>();
  for (const nodeId of nodeIds) {
    const tributary = tributaryByNode.get(nodeId) ?? 0;
    fractionsByNode.set(nodeId, tributary / tributaryTotal);
  }
  return fractionsByNode;
}
