import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { AnalysisResults, SlabModel } from "../../app/types";

interface StructureOverlayProps {
  model: SlabModel;
  results: AnalysisResults;
  showSupports: boolean;
  showWheelPatches: boolean;
}

export const StructureOverlay = ({
  model,
  results,
  showSupports,
  showWheelPatches,
}: StructureOverlayProps) => {
  const Lx = model.geometry.lengthM;
  const Ly = model.geometry.widthM;

  const boundaryPoints = useMemo(() => {
    return [
      [0, 0, 0.01],
      [Lx, 0, 0.01],
      [Lx, Ly, 0.01],
      [0, Ly, 0.01],
      [0, 0, 0.01],
    ] as [number, number, number][];
  }, [Lx, Ly]);

  return (
    <>
      <Line points={boundaryPoints} color="#e0e6ef" lineWidth={1.5} />

      {showSupports &&
        model.supports.map((support) => {
          if (support.kind === "line") {
            const points = [
              [support.x1, support.y1, 0.02],
              [support.x2, support.y2, 0.02],
            ] as [number, number, number][];
            return (
              <Line key={support.id} points={points} color="#4fc3f7" lineWidth={2} />
            );
          }
          return null;
        })}

      {showSupports &&
        model.supports
          .filter((s) => s.kind === "point")
          .map((support) => {
            if (support.kind !== "point") return null;
            return (
              <mesh key={support.id} position={[support.x, support.y, 0.02]}>
                <sphereGeometry args={[Math.max(Lx, Ly) * 0.012, 12, 12]} />
                <meshBasicMaterial color="#4fc3f7" />
              </mesh>
            );
          })}

      {showWheelPatches &&
        (results.wheelPatches ?? []).map((patch, i) => {
          const w = patch.xMaxM - patch.xMinM;
          const h = patch.yMaxM - patch.yMinM;
          return (
            <mesh
              key={`wp-${i}`}
              position={[patch.xMinM + w / 2, patch.yMinM + h / 2, 0.02]}
            >
              <planeGeometry args={[w, h]} />
              <meshBasicMaterial color="#ffb300" transparent opacity={0.55} />
            </mesh>
          );
        })}
    </>
  );
};
