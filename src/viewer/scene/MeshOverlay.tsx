import { useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import type {
  MeshElementOverlay,
  MeshNodeOverlay,
  NodalDisplacementOverlay,
} from "../../app/types";

interface MeshOverlayProps {
  meshNodes: MeshNodeOverlay[];
  meshElements: MeshElementOverlay[];
  nodalDisplacements?: NodalDisplacementOverlay[];
  deformScale?: number;
  color?: string;
  opacity?: number;
}

export const MeshOverlay = ({
  meshNodes,
  meshElements,
  nodalDisplacements = [],
  deformScale = 0,
  color = "#4f6480",
  opacity = 0.45,
}: MeshOverlayProps) => {
  const geometry = useMemo(() => {
    if (meshNodes.length === 0) {
      return new BufferGeometry();
    }

    const edgeSet = new Set<number>();
    const edgePairs: [number, number][] = [];

    for (const element of meshElements) {
      const [n0, n1, n2, n3] = element.nodeIds;
      const quads: [number, number][] = [
        [n0, n1],
        [n1, n2],
        [n2, n3],
        [n3, n0],
      ];
      for (const [a, b] of quads) {
        const key = a < b ? a * 100000 + b : b * 100000 + a;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edgePairs.push([a, b]);
        }
      }
    }

    const nodeById = new Map(meshNodes.map((node) => [node.id, node]));
    const zById = new Map(
      nodalDisplacements
        .filter((item) => Number.isFinite(item.wM))
        .map((item) => [item.nodeId, -item.wM * deformScale]),
    );

    const verts = new Float32Array(edgePairs.length * 6);
    for (let index = 0; index < edgePairs.length; index += 1) {
      const [a, b] = edgePairs[index];
      const nodeA = nodeById.get(a);
      const nodeB = nodeById.get(b);
      if (!nodeA || !nodeB) {
        continue;
      }
      verts[index * 6] = nodeA.xM;
      verts[index * 6 + 1] = nodeA.yM;
      verts[index * 6 + 2] = (zById.get(a) ?? 0) + 0.012;
      verts[index * 6 + 3] = nodeB.xM;
      verts[index * 6 + 4] = nodeB.yM;
      verts[index * 6 + 5] = (zById.get(b) ?? 0) + 0.012;
    }

    const nextGeometry = new BufferGeometry();
    nextGeometry.setAttribute("position", new BufferAttribute(verts, 3));
    return nextGeometry;
  }, [deformScale, meshElements, meshNodes, nodalDisplacements]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineSegments>
  );
};
