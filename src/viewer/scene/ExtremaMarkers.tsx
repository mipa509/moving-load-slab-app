import { useMemo } from "react";
import { findContourExtrema } from "../../components/viewportHelpers";
import type { NodalContourData } from "../../app/types";

interface ExtremaMarkersProps {
  contour: NodalContourData | undefined;
  radius: number;
}

export const ExtremaMarkers = ({ contour, radius }: ExtremaMarkersProps) => {
  const extrema = useMemo(
    () => (contour ? findContourExtrema(contour.points) : null),
    [contour],
  );

  if (!extrema) return null;

  const { min, max, samePoint } = extrema;

  return (
    <>
      <mesh position={[max.xM, max.yM, 0.04]}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      {!samePoint && (
        <mesh position={[min.xM, min.yM, 0.04]}>
          <sphereGeometry args={[radius, 16, 16]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
      )}
    </>
  );
};
