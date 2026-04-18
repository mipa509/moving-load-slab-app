import { useCallback, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { MeshNodeOverlay, NodalContourData } from "../../app/types";
import type { ProbeHit } from "../hooks/useViewerState";
import { buildProbeGrid, probeNearestValue } from "../math/probeHit";

interface ProbeSurfaceProps {
  slabLengthM: number;
  slabWidthM: number;
  meshNodes: MeshNodeOverlay[];
  contour: NodalContourData;
  onProbeHit: (hit: ProbeHit | null) => void;
}

export const ProbeSurface = ({
  slabLengthM,
  slabWidthM,
  meshNodes,
  contour,
  onProbeHit,
}: ProbeSurfaceProps) => {
  const probeGrid = useRef<ReturnType<typeof buildProbeGrid>>(null);

  const planePosition = useMemo(
    () => [slabLengthM * 0.5, slabWidthM * 0.5, 0.12] as [number, number, number],
    [slabLengthM, slabWidthM],
  );

  const updateProbeGrid = useCallback(() => {
    if (meshNodes.length === 0 || contour.points.length === 0) {
      probeGrid.current = null;
      return;
    }
    const nodes = meshNodes.map((node) => ({
      id: node.id,
      xM: node.xM,
      yM: node.yM,
    }));
    const points = contour.points.map((point) => ({
      nodeId: point.nodeId,
      value: point.value,
    }));
    probeGrid.current = buildProbeGrid(nodes, points);
  }, [contour.points, meshNodes]);

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      updateProbeGrid();
      const grid = probeGrid.current;
      if (!grid) {
        onProbeHit(null);
        return;
      }

      const value = probeNearestValue(event.point.x, event.point.y, grid);
      onProbeHit({
        x: event.point.x,
        y: event.point.y,
        value,
        screenX: event.nativeEvent.offsetX,
        screenY: event.nativeEvent.offsetY,
      });
    },
    [onProbeHit, updateProbeGrid],
  );

  const handlePointerLeave = useCallback(() => {
    onProbeHit(null);
  }, [onProbeHit]);

  return (
    <mesh
      position={planePosition}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <planeGeometry args={[slabLengthM, slabWidthM]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
};
