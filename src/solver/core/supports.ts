import type {
  DofKey,
  MappedSupportResult,
  StructuredMesh,
  SupportDefinition,
  SupportDofConstraint,
} from "../model/types";
import { DOF_INDEX_BY_KEY } from "../model/types";
import { findAxisCoordinateIndex } from "./mesh";

const DEFAULT_TOLERANCE = 1e-9;

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
