import type { NodalContourData } from "../../app/types";

interface ExtremaMarkersProps {
  contour: NodalContourData | undefined;
  radius: number;
}

export const ExtremaMarkers = ({ contour, radius }: ExtremaMarkersProps) => {
  if (!contour || contour.points.length === 0) return null;

  let minPt = contour.points[0];
  let maxPt = contour.points[0];
  for (const pt of contour.points) {
    if (pt.value < minPt.value) minPt = pt;
    if (pt.value > maxPt.value) maxPt = pt;
  }

  const samePoint = minPt.nodeId === maxPt.nodeId;

  return (
    <>
      <mesh position={[maxPt.xM, maxPt.yM, 0.04]}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      {!samePoint && (
        <mesh position={[minPt.xM, minPt.yM, 0.04]}>
          <sphereGeometry args={[radius, 16, 16]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
      )}
    </>
  );
};
