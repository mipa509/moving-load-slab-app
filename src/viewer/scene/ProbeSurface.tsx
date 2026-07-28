import { useCallback, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { MeshNodeOverlay, NodalContourData } from "../../app/types";
import type { ProbeHit } from "../hooks/useViewerState";
import type { DeckFraming } from "../math/deckFraming";
import { pointInConvexPolygon } from "../math/deckFraming";
import { buildProbeGrid, probeNearestValue } from "../math/probeHit";

interface ProbeSurfaceProps {
  framing: DeckFraming;
  deckPolygon: Array<{ x: number; y: number }>;
  meshNodes: MeshNodeOverlay[];
  contour: NodalContourData;
  onProbeHit: (hit: ProbeHit | null) => void;
}

export const ProbeSurface = ({
  framing,
  deckPolygon,
  meshNodes,
  contour,
  onProbeHit,
}: ProbeSurfaceProps) => {
  const probeGrid = useRef<ReturnType<typeof buildProbeGrid>>(null);

  const planePosition = useMemo(
    () => [framing.centerX, framing.centerY, 0.12] as [number, number, number],
    [framing.centerX, framing.centerY],
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

      if (!pointInConvexPolygon(event.point.x, event.point.y, deckPolygon)) {
        // Over the deck's bounding box but outside the actual (possibly
        // skewed) parallelogram: there is no slab here.
        onProbeHit(null);
        return;
      }

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
    [deckPolygon, onProbeHit, updateProbeGrid],
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
      <planeGeometry args={[framing.spanX, framing.spanY]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
};
