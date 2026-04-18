import { useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import { buildSurfaceGeometry } from "../math/buildSurfaceGeometry";
import { buildVertexColors } from "../math/interpolateField";
import { buildZDisplacements } from "../math/deformGeometry";
import type { ContourScale } from "../../app/contourScale";
import type { AnalysisResults, ResultField } from "../../app/types";

interface ResultSurfaceProps {
  results: AnalysisResults;
  selectedField: ResultField;
  contourScale: ContourScale;
  deformScale: number;
}

export const ResultSurface = ({
  results,
  selectedField,
  contourScale,
  deformScale,
}: ResultSurfaceProps) => {
  const nodalContour =
    selectedField !== "reactions" ? results.nodalContours[selectedField] : undefined;

  const geometry = useMemo(() => {
    if (!nodalContour || results.meshElements.length === 0) {
      return new BufferGeometry();
    }

    const nodeCount = results.meshNodes.length;
    const vals = new Float32Array(nodeCount);
    for (const point of nodalContour.points) {
      if (point.nodeId < 0 || point.nodeId >= nodeCount) {
        console.warn(
          `ResultSurface: nodal point nodeId ${point.nodeId} out of range [0, ${nodeCount})`,
        );
        continue;
      }
      vals[point.nodeId] = point.value;
    }

    const zDisplacements = buildZDisplacements(
      nodeCount,
      deformScale,
      results.nodalDisplacements,
      -1,
    );

    const topology = {
      nodes: results.meshNodes.map((node) => ({ id: node.id, x: node.xM, y: node.yM })),
      elements: results.meshElements.map((element) => ({
        id: element.id,
        nodeIds: element.nodeIds,
      })),
    };

    const { positions, indices } = buildSurfaceGeometry(topology, {
      zDisplacements,
      deformScale,
    });
    const colors = buildVertexColors(vals, contourScale);

    const nextGeometry = new BufferGeometry();
    nextGeometry.setAttribute("position", new BufferAttribute(positions, 3));
    nextGeometry.setAttribute("color", new BufferAttribute(colors, 3));
    nextGeometry.setIndex(new BufferAttribute(indices, 1));
    nextGeometry.computeVertexNormals();
    return nextGeometry;
  }, [
    contourScale,
    deformScale,
    nodalContour,
    results.meshElements,
    results.meshNodes,
    results.nodalDisplacements,
  ]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial vertexColors side={2} />
    </mesh>
  );
};
