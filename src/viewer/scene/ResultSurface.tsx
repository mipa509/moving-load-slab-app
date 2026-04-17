import { useMemo, useRef, useCallback } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import { buildSurfaceGeometry } from "../math/buildSurfaceGeometry";
import { buildVertexColors } from "../math/interpolateField";
import { buildZDisplacements } from "../math/deformGeometry";
import { buildProbeGrid, probeNearestValue } from "../math/probeHit";
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
  const probeGrid = useRef<ReturnType<typeof buildProbeGrid>>(null);

  const updateProbeGrid = useCallback(() => {
    if (!nodalContour || results.meshNodes.length === 0) {
      probeGrid.current = null;
      return;
    }
    const nodes = results.meshNodes.map((n) => ({ id: n.id, xM: n.xM, yM: n.yM }));
    const points = nodalContour.points.map((p) => ({ nodeId: p.nodeId, value: p.value }));
    probeGrid.current = buildProbeGrid(nodes, points);
  }, [nodalContour, results.meshNodes]);

  const handlePointerMove = useCallback(
    (e: { point: { x: number; y: number } }) => {
      updateProbeGrid();
      const grid = probeGrid.current;
      if (!grid) {
        onProbeHit(null);
        return;
      }
      const { x, y } = e.point;
      const val = probeNearestValue(x, y, grid);
      onProbeHit({ x, y, value: val });
    },
    [onProbeHit, updateProbeGrid],
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

