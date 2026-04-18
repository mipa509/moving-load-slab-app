export interface MeshTopology {
  /**
   * Nodes must have dense, contiguous ids starting at 0.
   * i.e. node.id === index in the nodes array.
   * This is guaranteed by the solver's mesh builder (mesh.ts).
   */
  nodes: { id: number; x: number; y: number }[];
  elements: { id: number; nodeIds: [number, number, number, number] }[];
}

export interface SurfaceGeometryOptions {
  zDisplacements?: Float32Array;
  deformScale?: number;
}

export interface SurfaceGeometryResult {
  positions: Float32Array;
  indices: Uint32Array;
}

export function buildSurfaceGeometry(
  mesh: MeshTopology,
  options: SurfaceGeometryOptions = {},
): SurfaceGeometryResult {
  const { zDisplacements, deformScale = 1 } = options;
  const nodeCount = mesh.nodes.length;
  const elementCount = mesh.elements.length;

  if (zDisplacements && zDisplacements.length < nodeCount) {
    throw new Error(
      `zDisplacements length (${zDisplacements.length}) < node count (${nodeCount})`,
    );
  }

  const positions = new Float32Array(nodeCount * 3);
  for (const node of mesh.nodes) {
    const base = node.id * 3;
    positions[base] = node.x;
    positions[base + 1] = node.y;
    positions[base + 2] = zDisplacements ? zDisplacements[node.id] * deformScale : 0;
  }

  const indices = new Uint32Array(elementCount * 6);
  for (let e = 0; e < elementCount; e++) {
    const { nodeIds } = mesh.elements[e];
    const base = e * 6;
    // Triangle 1: nodes 0, 1, 2
    indices[base] = nodeIds[0];
    indices[base + 1] = nodeIds[1];
    indices[base + 2] = nodeIds[2];
    // Triangle 2: nodes 0, 2, 3
    indices[base + 3] = nodeIds[0];
    indices[base + 4] = nodeIds[2];
    indices[base + 5] = nodeIds[3];
  }

  return { positions, indices };
}
