import { useMemo, useRef, useCallback } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import { buildSurfaceGeometry } from "../math/buildSurfaceGeometry";
import { buildVertexColors } from "../math/interpolateField";
import type { ContourScale } from "../../app/contourScale";
import type { AnalysisResults, ResultField } from "../../app/types";
import type { ProbeHit } from "../hooks/useViewerState";

interface ResultSurfaceProps {
  results: AnalysisResults;
  selectedField: ResultField;
  contourScale: ContourScale;
  deformScale: number;
  onProbeHit: (hit: ProbeHit | null) => void;
}

export const ResultSurface = ({
  results,
  selectedField,
  contourScale,
  deformScale,
  onProbeHit,
}: ResultSurfaceProps) => {
  const nodalContour =
    selectedField !== "reactions" ? results.nodalContours[selectedField] : undefined;

  const geometry = useMemo(() => {
    if (!nodalContour || results.meshElements.length === 0) {
      return new BufferGeometry();
    }

    const nodeCount = results.meshNodes.length;
    const vals = new Float32Array(nodeCount);
    for (const pt of nodalContour.points) {
      if (pt.nodeId < 0 || pt.nodeId >= nodeCount) {
        console.warn(`ResultSurface: nodal point nodeId ${pt.nodeId} out of range [0, ${nodeCount})`);
        continue;
      }
      vals[pt.nodeId] = pt.value;
    }

    const zDisplacements = buildZDisplacements(
      nodeCount,
      deformScale,
      results.nodalDisplacements,
    );

    const topology = {
      nodes: results.meshNodes.map((n) => ({ id: n.id, x: n.xM, y: n.yM })),
      elements: results.meshElements.map((e) => ({ id: e.id, nodeIds: e.nodeIds })),
    };

    const { positions, indices } = buildSurfaceGeometry(topology, {
      zDisplacements,
      deformScale,
    });
    const colors = buildVertexColors(vals, contourScale);

    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    geo.setAttribute("color", new BufferAttribute(colors, 3));
    geo.setIndex(new BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [nodalContour, results.meshNodes, results.meshElements, results.nodalDisplacements, contourScale, deformScale]);

  // Spatial cache for nearest-node lookup (avoids O(n) scan on every pointer move)
  const probeCache = useRef<{
    nodes: { id: number; xM: number; yM: number }[];
    valueByNode: Map<number, number>;
    grid: Map<string, number>;
    cellSize: number;
  } | null>(null);

  const updateProbeCache = useCallback(() => {
    if (!nodalContour || results.meshNodes.length === 0) {
      probeCache.current = null;
      return;
    }
    const nodes = results.meshNodes;
    const valueByNode = new Map(nodalContour.points.map((p) => [p.nodeId, p.value]));

    // Build a simple spatial grid for faster nearest-node lookup
    const Lx = Math.max(...nodes.map((n) => n.xM)) - Math.min(...nodes.map((n) => n.xM));
    const Ly = Math.max(...nodes.map((n) => n.yM)) - Math.min(...nodes.map((n) => n.yM));
    const cellSize = Math.max(Lx, Ly) / Math.max(Math.sqrt(nodes.length), 2);
    const grid = new Map<string, number>();

    for (const node of nodes) {
      const gx = Math.floor(node.xM / cellSize);
      const gy = Math.floor(node.yM / cellSize);
      const key = `${gx},${gy}`;
      if (!grid.has(key)) {
        grid.set(key, node.id);
      }
    }

    probeCache.current = { nodes, valueByNode, grid, cellSize };
  }, [nodalContour, results.meshNodes]);

  const handlePointerMove = useCallback(
    (e: { point: { x: number; y: number } }) => {
      updateProbeCache();
      const cache = probeCache.current;
      if (!cache) {
        onProbeHit(null);
        return;
      }

      const { x, y } = e.point;
      const { nodes, valueByNode, grid, cellSize } = cache;

      // Check grid cell first, then fall back to nearby cells if needed
      const gx = Math.floor(x / cellSize);
      const gy = Math.floor(y / cellSize);
      const candidates: number[] = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${gx + dx},${gy + dy}`;
          const nodeId = grid.get(key);
          if (nodeId !== undefined) candidates.push(nodeId);
        }
      }

      // If no candidates found in nearby cells, scan all nodes (fallback)
      const searchNodes = candidates.length > 0
        ? nodes.filter((n) => candidates.includes(n.id))
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
      onProbeHit({ x, y, value: val });
    },
    [onProbeHit, updateProbeCache],
  );

  const handlePointerLeave = useCallback(() => {
    onProbeHit(null);
  }, [onProbeHit]);

  return (
    <mesh
      geometry={geometry}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <meshBasicMaterial vertexColors side={2} />
    </mesh>
  );
};

function buildZDisplacements(
  nodeCount: number,
  deformScale: number,
  nodalDisplacements: { nodeId: number; wM: number }[],
): Float32Array | undefined {
  if (deformScale <= 0 || nodalDisplacements.length === 0) {
    return undefined;
  }
  const zd = new Float32Array(nodeCount);
  for (const nd of nodalDisplacements) {
    if (nd.nodeId >= 0 && nd.nodeId < nodeCount) {
      zd[nd.nodeId] = nd.wM;
    }
  }
  return zd;
}
