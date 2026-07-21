import { deckLocalToGlobal, globalToDeckLocal } from "../geometry/deckCoordinates";
import { getPolygonAabb } from "../geometry/convexPolygon";
import type {
  Aabb,
  DeckLocalPoint,
  Point2D,
  Polygon2D,
} from "../geometry/types";
import { normalizeSolverGeometry } from "../model/fromAppModel";
import type {
  MeshElement,
  MeshNode,
  MeshSettings,
  SlabGeometry,
  StructuredMesh,
  SupportDefinition,
} from "../model/types";
import { interpolateQ4Point } from "./q4Geometry";

const DEFAULT_TOLERANCE = 1e-9;

interface SkewLineCheck {
  id: string;
  start: DeckLocalPoint;
  end: DeckLocalPoint;
}

export type MeshElementGeometryInvariantCode =
  | "MESH_ELEMENT_INVALID_TOPOLOGY"
  | "MESH_ELEMENT_NON_FINITE_NODE"
  | "MESH_ELEMENT_INVALID_NODE_POLYGON"
  | "MESH_ELEMENT_POLYGON_MISMATCH"
  | "MESH_ELEMENT_BOUNDS_MISMATCH";

export class MeshElementGeometryInvariantError extends Error {
  readonly code: MeshElementGeometryInvariantCode;
  readonly elementId: number;

  constructor(
    code: MeshElementGeometryInvariantCode,
    elementId: number,
    message: string,
  ) {
    super(message);
    this.name = "MeshElementGeometryInvariantError";
    this.code = code;
    this.elementId = elementId;
  }
}

export interface ResolvedMeshElementGeometry {
  nodes: [MeshNode, MeshNode, MeshNode, MeshNode];
  polygon: Polygon2D;
  bounds: Aabb;
}

export function generateStructuredMesh(
  slab: SlabGeometry,
  mesh: MeshSettings,
  supports: SupportDefinition[],
): StructuredMesh {
  const geometry = normalizeSolverGeometry(slab);
  validateGeometryAndMesh(geometry, mesh);
  const tolerance = mesh.tolerance ?? DEFAULT_TOLERANCE;

  const supportControl = collectSupportControlCoordinates(
    geometry,
    supports,
    tolerance,
  );
  const sCoords = buildAxisCoordinates(
    geometry.lengthM,
    mesh.targetElementsX,
    [...(mesh.forcedX ?? []), ...supportControl.s],
    tolerance,
  );
  const tCoords = buildAxisCoordinates(
    geometry.widthM,
    mesh.targetElementsY,
    [...(mesh.forcedY ?? []), ...supportControl.t],
    tolerance,
  );
  assertStrictFiniteAxis("sCoords", sCoords, geometry.lengthM);
  assertStrictFiniteAxis("tCoords", tCoords, geometry.widthM);
  validateSkewLinesAlreadyMeshed(
    supportControl.skewLines,
    sCoords,
    tCoords,
    tolerance,
  );

  const nodeIdsByIJ: number[][] = Array.from(
    { length: tCoords.length },
    () => Array.from({ length: sCoords.length }, () => -1),
  );

  const nodes: StructuredMesh["nodes"] = [];
  let nextNodeId = 0;
  for (let j = 0; j < tCoords.length; j += 1) {
    for (let i = 0; i < sCoords.length; i += 1) {
      const s = sCoords[i];
      const t = tCoords[j];
      const global = deckLocalToGlobal(geometry, { s, t });
      nodes.push({
        id: nextNodeId,
        x: global.x,
        y: global.y,
        s,
        t,
      });
      nodeIdsByIJ[j][i] = nextNodeId;
      nextNodeId += 1;
    }
  }

  const elements: StructuredMesh["elements"] = [];
  let nextElementId = 0;
  for (let j = 0; j < tCoords.length - 1; j += 1) {
    for (let i = 0; i < sCoords.length - 1; i += 1) {
      const nodeIds: [number, number, number, number] = [
        nodeIdsByIJ[j][i],
        nodeIdsByIJ[j][i + 1],
        nodeIdsByIJ[j + 1][i + 1],
        nodeIdsByIJ[j + 1][i],
      ];
      const polygon = nodeIds.map((nodeId) => nodes[nodeId]);
      const bounds = getPolygonAabb(polygon);
      if (!bounds) {
        throw new Error(
          `Mesh element ${nextElementId} does not form a valid counter-clockwise Q4 polygon.`,
        );
      }
      elements.push({
        id: nextElementId,
        nodeIds,
        polygon,
        bounds,
      });
      nextElementId += 1;
    }
  }

  return {
    sCoords,
    tCoords,
    // Compatibility aliases intentionally preserve object identity.
    xCoords: sCoords,
    yCoords: tCoords,
    nodes,
    elements,
    nodeIdsByIJ,
    elementCountS: sCoords.length - 1,
    elementCountT: tCoords.length - 1,
  };
}

/** Physical Q4 centre at natural coordinates (0, 0); never an AABB midpoint. */
export function getMeshElementCenter(
  mesh: StructuredMesh,
  element: MeshElement,
): Point2D {
  return interpolateQ4Point(
    resolveMeshElementGeometry(mesh, element).nodes,
    0,
    0,
  );
}

/**
 * Resolve the physical Q4 exclusively from indexed nodes and verify that all
 * stored polygon/AABB metadata is an exact representation of that geometry.
 */
export function resolveMeshElementGeometry(
  mesh: StructuredMesh,
  element: MeshElement,
): ResolvedMeshElementGeometry {
  if (element.nodeIds.length !== 4) {
    throw new MeshElementGeometryInvariantError(
      "MESH_ELEMENT_INVALID_TOPOLOGY",
      element.id,
      `Mesh element ${element.id} must reference exactly four node IDs; received ${element.nodeIds.length}.`,
    );
  }
  const nodes = element.nodeIds.map((nodeId) => {
    const node = mesh.nodes[nodeId];
    if (!node || node.id !== nodeId) {
      throw new MeshElementGeometryInvariantError(
        "MESH_ELEMENT_INVALID_TOPOLOGY",
        element.id,
        `Mesh element ${element.id} references missing or non-indexed node ${nodeId}.`,
      );
    }
    if (
      !Number.isFinite(node.x) ||
      !Number.isFinite(node.y) ||
      !Number.isFinite(node.s) ||
      !Number.isFinite(node.t)
    ) {
      throw new MeshElementGeometryInvariantError(
        "MESH_ELEMENT_NON_FINITE_NODE",
        element.id,
        `Mesh element ${element.id} contains a non-finite node coordinate.`,
      );
    }
    return node;
  }) as [MeshNode, MeshNode, MeshNode, MeshNode];
  const polygon: Polygon2D = [...nodes];
  const bounds = getPolygonAabb(polygon);
  if (!bounds) {
    throw new MeshElementGeometryInvariantError(
      "MESH_ELEMENT_INVALID_NODE_POLYGON",
      element.id,
      `Mesh element ${element.id} indexed nodes do not form a valid physical Q4 polygon.`,
    );
  }

  const polygonMatches =
    element.polygon.length === nodes.length &&
    element.polygon.every(
      (point, index) =>
        point.x === nodes[index].x && point.y === nodes[index].y,
    );
  if (!polygonMatches) {
    throw new MeshElementGeometryInvariantError(
      "MESH_ELEMENT_POLYGON_MISMATCH",
      element.id,
      `Mesh element ${element.id} polygon does not exactly match its indexed nodes in local Q4 order.`,
    );
  }

  const boundsMatch =
    element.bounds.xMin === bounds.xMin &&
    element.bounds.xMax === bounds.xMax &&
    element.bounds.yMin === bounds.yMin &&
    element.bounds.yMax === bounds.yMax;
  if (!boundsMatch) {
    throw new MeshElementGeometryInvariantError(
      "MESH_ELEMENT_BOUNDS_MISMATCH",
      element.id,
      `Mesh element ${element.id} bounds do not exactly match the indexed-node polygon AABB.`,
    );
  }

  return { nodes, polygon, bounds };
}

export function findAxisCoordinateIndex(
  axis: readonly number[],
  value: number,
  tolerance: number = DEFAULT_TOLERANCE,
): number {
  for (let i = 0; i < axis.length; i += 1) {
    if (Math.abs(axis[i] - value) <= tolerance) {
      return i;
    }
  }
  return -1;
}

function validateGeometryAndMesh(
  geometry: ReturnType<typeof normalizeSolverGeometry>,
  mesh: MeshSettings,
): void {
  if (
    !Number.isFinite(geometry.lengthM) ||
    !Number.isFinite(geometry.widthM) ||
    !Number.isFinite(geometry.thicknessM) ||
    geometry.lengthM <= 0 ||
    geometry.widthM <= 0 ||
    geometry.thicknessM <= 0
  ) {
    throw new Error("Slab geometry must have finite positive dimensions.");
  }
  if (
    !Number.isInteger(mesh.targetElementsX) ||
    !Number.isInteger(mesh.targetElementsY) ||
    mesh.targetElementsX < 1 ||
    mesh.targetElementsY < 1
  ) {
    throw new Error("Mesh target elements must be positive integers.");
  }
  const tolerance = mesh.tolerance ?? DEFAULT_TOLERANCE;
  if (
    !Number.isFinite(tolerance) ||
    tolerance <= 0 ||
    tolerance >= Math.min(geometry.lengthM, geometry.widthM)
  ) {
    throw new Error(
      "Mesh tolerance must be finite, positive, and smaller than both deck dimensions.",
    );
  }
}

function collectSupportControlCoordinates(
  geometry: ReturnType<typeof normalizeSolverGeometry>,
  supports: SupportDefinition[],
  tolerance: number,
): { s: number[]; t: number[]; skewLines: SkewLineCheck[] } {
  const s: number[] = [];
  const t: number[] = [];
  const skewLines: SkewLineCheck[] = [];

  for (const support of supports) {
    const id = support.id ?? "<unassigned>";
    if (support.kind === "point") {
      const local = globalToDeckLocal(geometry, { x: support.x, y: support.y });
      s.push(requireInside(local.s, 0, geometry.lengthM, tolerance, id, "s"));
      t.push(requireInside(local.t, 0, geometry.widthM, tolerance, id, "t"));
      continue;
    }

    if (geometry.skewAngleDeg === 0) {
      const horizontal = Math.abs(support.y1 - support.y2) <= tolerance;
      const vertical = Math.abs(support.x1 - support.x2) <= tolerance;
      if (!horizontal && !vertical) {
        throw new Error(
          `Line support "${id}" must be axis-aligned for zero-skew mesh forcing.`,
        );
      }
      s.push(support.x1, support.x2);
      t.push(support.y1, support.y2);
      continue;
    }

    const start = globalToDeckLocal(geometry, {
      x: support.x1,
      y: support.y1,
    });
    const end = globalToDeckLocal(geometry, {
      x: support.x2,
      y: support.y2,
    });
    const constantS = Math.abs(start.s - end.s) <= tolerance;
    const constantT = Math.abs(start.t - end.t) <= tolerance;
    if (!constantS && !constantT) {
      throw new Error(
        `Line support "${id}" is unsupported for skew mesh forcing: endpoints do not form a deck-local coordinate line.`,
      );
    }
    // Inclined/internal lines do not force an arbitrary mesh axis. WP-021
    // accepts them only when this independently generated mesh already has
    // every required endpoint/member node.
    skewLines.push({ id, start, end });
  }

  return { s, t, skewLines };
}

function validateSkewLinesAlreadyMeshed(
  lines: readonly SkewLineCheck[],
  sCoords: readonly number[],
  tCoords: readonly number[],
  tolerance: number,
): void {
  for (const line of lines) {
    const constantS = Math.abs(line.start.s - line.end.s) <= tolerance;
    const member =
      constantS
        ? findAxisCoordinateIndex(sCoords, line.start.s, tolerance) >= 0 &&
          findAxisCoordinateIndex(tCoords, line.start.t, tolerance) >= 0 &&
          findAxisCoordinateIndex(tCoords, line.end.t, tolerance) >= 0
        : findAxisCoordinateIndex(tCoords, line.start.t, tolerance) >= 0 &&
          findAxisCoordinateIndex(sCoords, line.start.s, tolerance) >= 0 &&
          findAxisCoordinateIndex(sCoords, line.end.s, tolerance) >= 0;
    if (!member) {
      throw new Error(
        `Line support "${line.id}" is unsupported for skew mesh forcing: the existing local mesh does not contain its exact endpoint nodes.`,
      );
    }
  }
}

function buildAxisCoordinates(
  length: number,
  targetElements: number,
  forcedCoords: number[],
  tolerance: number,
): number[] {
  for (const coordinate of forcedCoords) {
    if (!Number.isFinite(coordinate)) {
      throw new Error("Forced mesh coordinates must be finite.");
    }
  }
  const forced = sortAndUniqueWithTolerance(
    [0, length, ...forcedCoords]
      .map((coord) => clampInside(coord, 0, length, tolerance))
      .filter((coord): coord is number => coord !== null),
    tolerance,
  );

  const baseStep = length / targetElements;
  const coords: number[] = [0];
  for (let i = 0; i < forced.length - 1; i += 1) {
    const a = forced[i];
    const b = forced[i + 1];
    const span = b - a;
    if (span <= tolerance) {
      continue;
    }
    const divisions = Math.max(1, Math.round(span / baseStep));
    for (let k = 1; k <= divisions; k += 1) {
      coords.push(a + (span * k) / divisions);
    }
  }
  coords[0] = 0;
  coords[coords.length - 1] = length;
  return sortAndUniqueWithTolerance(coords, tolerance);
}

function sortAndUniqueWithTolerance(values: number[], tolerance: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const unique: number[] = [];
  for (const value of sorted) {
    if (
      unique.length === 0 ||
      Math.abs(value - unique[unique.length - 1]) > tolerance
    ) {
      unique.push(value);
    }
  }
  return unique;
}

function clampInside(
  value: number,
  min: number,
  max: number,
  tolerance: number,
): number | null {
  if (value < min - tolerance || value > max + tolerance) {
    return null;
  }
  return Math.min(max, Math.max(min, value));
}

function requireInside(
  value: number,
  min: number,
  max: number,
  tolerance: number,
  supportId: string,
  axis: "s" | "t",
): number {
  const clamped = clampInside(value, min, max, tolerance);
  if (clamped === null) {
    throw new Error(
      `Point support "${supportId}" is outside the deck in local ${axis} coordinate.`,
    );
  }
  return clamped;
}

function assertStrictFiniteAxis(
  name: string,
  axis: readonly number[],
  exactEnd: number,
): void {
  if (axis.length < 2 || axis[0] !== 0 || axis[axis.length - 1] !== exactEnd) {
    throw new Error(`${name} must contain the exact deck limits.`);
  }
  for (let index = 0; index < axis.length; index += 1) {
    if (!Number.isFinite(axis[index])) {
      throw new Error(`${name} must contain only finite coordinates.`);
    }
    if (index > 0 && axis[index] <= axis[index - 1]) {
      throw new Error(`${name} must be strictly increasing.`);
    }
  }
}
