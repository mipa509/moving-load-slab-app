/**
 * Probe hit detection: find the nodal field value nearest to a pointer position.
 * Uses a simple spatial grid cache for O(1) average-case lookup instead of O(n) brute force.
 */

export interface MeshNode2D {
  id: number;
  xM: number;
  yM: number;
}

export interface NodalValuePoint {
  nodeId: number;
  value: number;
}

export interface ProbeGrid {
  nodes: MeshNode2D[];
  valueByNode: Map<number, number>;
  grid: Map<string, number>;
  cellSize: number;
}

/**
 * Build a spatial grid cache for fast nearest-node lookup.
 * Returns null if there are no nodes or no values.
 */
export function buildProbeGrid(
  nodes: MeshNode2D[],
  points: NodalValuePoint[],
): ProbeGrid | null {
  if (nodes.length === 0 || points.length === 0) return null;

  const valueByNode = new Map(points.map((p) => [p.nodeId, p.value]));

  const xMin = Math.min(...nodes.map((n) => n.xM));
  const xMax = Math.max(...nodes.map((n) => n.xM));
  const yMin = Math.min(...nodes.map((n) => n.yM));
  const yMax = Math.max(...nodes.map((n) => n.yM));
  const Lx = xMax - xMin;
  const Ly = yMax - yMin;
  const cellSize = Math.max(Lx, Ly) / Math.max(Math.sqrt(nodes.length), 2);

  const grid = new Map<string, number>();
  for (const node of nodes) {
    const gx = Math.floor((node.xM - xMin) / cellSize);
    const gy = Math.floor((node.yM - yMin) / cellSize);
    const key = `${gx},${gy}`;
    if (!grid.has(key)) {
      grid.set(key, node.id);
    }
  }

  return { nodes, valueByNode, grid, cellSize };
}

/**
 * Find the nodal value nearest to (x, y) using the spatial grid.
 * Checks the target cell and 8 neighbours first; falls back to brute-force scan.
 */
export function probeNearestValue(
  x: number,
  y: number,
  grid: ProbeGrid,
): number {
  const { nodes, valueByNode, cellSize } = grid;

  // Determine grid cell
  const xMin = Math.min(...nodes.map((n) => n.xM));
  const yMin = Math.min(...nodes.map((n) => n.yM));
  const gx = Math.floor((x - xMin) / cellSize);
  const gy = Math.floor((y - yMin) / cellSize);

  // Collect candidate node IDs from target cell + 8 neighbours
  const candidates = new Set<number>();
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const key = `${gx + dx},${gy + dy}`;
      const nodeId = grid.grid.get(key);
      if (nodeId !== undefined) candidates.add(nodeId);
    }
  }

  // If no candidates found, scan all nodes (fallback)
  const searchNodes = candidates.size > 0
    ? nodes.filter((n) => candidates.has(n.id))
    : nodes;

  let best = Infinity;
  let val = 0;
  for (const node of searchNodes) {
    const d2 = (node.xM - x) ** 2 + (node.yM - y) ** 2;
    if (d2 < best) {
      best = d2;
      val = valueByNode.get(node.id) ?? 0;
    }
  }
  return val;
}
