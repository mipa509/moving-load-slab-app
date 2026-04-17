import { useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import type { MeshElementOverlay, MeshNodeOverlay } from "../../app/types";

interface MeshOverlayProps {
  meshNodes: MeshNodeOverlay[];
  meshElements: MeshElementOverlay[];
}

export const MeshOverlay = ({ meshNodes, meshElements }: MeshOverlayProps) => {
  const geometry = useMemo(() => {
    if (meshNodes.length === 0) return new BufferGeometry();

    // Build a unique set of edges from the quad elements
    const edgeSet = new Set<number>();
    const edgePairs: [number, number][] = [];

    for (const el of meshElements) {
      const [n0, n1, n2, n3] = el.nodeIds;
      const quads: [number, number][] = [
        [n0, n1], [n1, n2], [n2, n3], [n3, n0],
      ];
      for (const [a, b] of quads) {
        const key = a < b ? a * 100000 + b : b * 100000 + a;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edgePairs.push([a, b]);
        }
      }
    }

    const nodeById = new Map(meshNodes.map((n) => [n.id, n]));
    const verts = new Float32Array(edgePairs.length * 6);
    for (let i = 0; i < edgePairs.length; i++) {
      const [a, b] = edgePairs[i];
      const na = nodeById.get(a)!;
      const nb = nodeById.get(b)!;
      verts[i * 6] = na.xM;
      verts[i * 6 + 1] = na.yM;
      verts[i * 6 + 2] = 0.015;
      verts[i * 6 + 3] = nb.xM;
      verts[i * 6 + 4] = nb.yM;
      verts[i * 6 + 5] = 0.015;
    }

    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(verts, 3));
    return geo;
  }, [meshNodes, meshElements]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#4a5568" transparent opacity={0.6} />
    </lineSegments>
  );
};
