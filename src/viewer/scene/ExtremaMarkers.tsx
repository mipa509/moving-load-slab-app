import { useMemo } from "react";
import { findContourExtrema } from "../../components/viewportHelpers";
import type { NodalContourData } from "../../app/types";

interface ExtremaMarkersProps {
  contour: NodalContourData | undefined;
  size: number;
}

const Marker = ({
  x,
  y,
  size,
  color,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
}) => (
  <group position={[x, y, 0.06]}>
    <mesh>
      <ringGeometry args={[size * 0.48, size * 0.72, 28]} />
      <meshBasicMaterial color={color} />
    </mesh>
    <mesh>
      <planeGeometry args={[size * 1.4, size * 0.12]} />
      <meshBasicMaterial color={color} />
    </mesh>
    <mesh rotation={[0, 0, Math.PI * 0.5]}>
      <planeGeometry args={[size * 1.4, size * 0.12]} />
      <meshBasicMaterial color={color} />
    </mesh>
  </group>
);

export const ExtremaMarkers = ({ contour, size }: ExtremaMarkersProps) => {
  const extrema = useMemo(
    () => (contour ? findContourExtrema(contour.points) : null),
    [contour],
  );

  if (!extrema) {
    return null;
  }

  const { min, max, samePoint } = extrema;

  return (
    <>
      <Marker x={max.xM} y={max.yM} size={size} color="#d83b34" />
      {!samePoint && <Marker x={min.xM} y={min.yM} size={size} color="#2b6fb0" />}
    </>
  );
};
