import type {
  MeshSettings,
  SlabGeometry,
  StructuredMesh,
  SupportDefinition,
} from "../model/types";

const DEFAULT_TOLERANCE = 1e-9;

export function generateStructuredMesh(
  slab: SlabGeometry,
  mesh: MeshSettings,
  supports: SupportDefinition[],
): StructuredMesh {
  validateGeometryAndMesh(slab, mesh);
  const tolerance = mesh.tolerance ?? DEFAULT_TOLERANCE;

  const supportControl = collectSupportControlCoordinates(supports, tolerance);
  const xControls = [
    ...(mesh.forcedX ?? []),
    ...supportControl.x,
  ];
  const yControls = [
    ...(mesh.forcedY ?? []),
    ...supportControl.y,
  ];

  const xCoords = buildAxisCoordinates(
    slab.lengthX,
    mesh.targetElementsX,
    xControls,
    tolerance,
  );
  const yCoords = buildAxisCoordinates(
    slab.lengthY,
    mesh.targetElementsY,
    yControls,
    tolerance,
  );

  const nodeIdsByIJ: number[][] = Array.from(
    { length: yCoords.length },
    () => Array.from({ length: xCoords.length }, () => -1),
  );

  const nodes: StructuredMesh["nodes"] = [];
  let nextNodeId = 0;
  for (let j = 0; j < yCoords.length; j += 1) {
    for (let i = 0; i < xCoords.length; i += 1) {
      nodes.push({
        id: nextNodeId,
        x: xCoords[i],
        y: yCoords[j],
      });
      nodeIdsByIJ[j][i] = nextNodeId;
      nextNodeId += 1;
    }
  }

  const elements: StructuredMesh["elements"] = [];
  let nextElementId = 0;
  for (let j = 0; j < yCoords.length - 1; j += 1) {
    for (let i = 0; i < xCoords.length - 1; i += 1) {
      const n1 = nodeIdsByIJ[j][i];
      const n2 = nodeIdsByIJ[j][i + 1];
      const n3 = nodeIdsByIJ[j + 1][i + 1];
      const n4 = nodeIdsByIJ[j + 1][i];
      elements.push({
        id: nextElementId,
        nodeIds: [n1, n2, n3, n4] as [number, number, number, number],
        bounds: {
          xMin: xCoords[i],
          xMax: xCoords[i + 1],
          yMin: yCoords[j],
          yMax: yCoords[j + 1],
        },
      });
      nextElementId += 1;
    }
  }

  return {
    xCoords,
    yCoords,
    nodes,
    elements,
    nodeIdsByIJ,
    elementCountX: xCoords.length - 1,
    elementCountY: yCoords.length - 1,
  };
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

function validateGeometryAndMesh(slab: SlabGeometry, mesh: MeshSettings): void {
  if (slab.lengthX <= 0 || slab.lengthY <= 0 || slab.thickness <= 0) {
    throw new Error("Slab geometry must have positive lengthX, lengthY, and thickness.");
  }
  if (mesh.targetElementsX < 1 || mesh.targetElementsY < 1) {
    throw new Error("Mesh target elements must be at least 1 in each direction.");
  }
}

function collectSupportControlCoordinates(
  supports: SupportDefinition[],
  tolerance: number,
): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];

  for (const support of supports) {
    if (support.kind === "point") {
      x.push(support.x);
      y.push(support.y);
      continue;
    }

    const horizontal = Math.abs(support.y1 - support.y2) <= tolerance;
    const vertical = Math.abs(support.x1 - support.x2) <= tolerance;
    if (!horizontal && !vertical) {
      throw new Error(
        `Line support "${support.id ?? "<unassigned>"}" is not axis-aligned.`,
      );
    }

    x.push(support.x1, support.x2);
    y.push(support.y1, support.y2);
  }

  return { x, y };
}

function buildAxisCoordinates(
  length: number,
  targetElements: number,
  forcedCoords: number[],
  tolerance: number,
): number[] {
  const forced = sortAndUniqueWithTolerance(
    [0, length, ...forcedCoords]
      .map((coord) => clampInside(coord, 0, length, tolerance))
      .filter((coord): coord is number => coord !== null),
    tolerance,
  );

  const baseStep = length / Math.max(1, targetElements);
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

  return sortAndUniqueWithTolerance(coords, tolerance);
}

function sortAndUniqueWithTolerance(values: number[], tolerance: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const unique: number[] = [];
  for (const value of sorted) {
    if (unique.length === 0) {
      unique.push(value);
      continue;
    }
    if (Math.abs(value - unique[unique.length - 1]) > tolerance) {
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
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}
