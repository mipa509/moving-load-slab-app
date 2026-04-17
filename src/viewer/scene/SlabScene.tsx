import {
  MapControls,
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
} from "@react-three/drei";
import type { ContourScale } from "../../app/contourScale";
import type { AnalysisResults, ResultField, SlabModel } from "../../app/types";
import type { ProbeHit } from "../hooks/useViewerState";

interface SlabSceneProps {
  model: SlabModel;
  results: AnalysisResults;
  selectedField: ResultField;
  contourScale: ContourScale | null;
  deformScale: number;
  onProbeHit: (hit: ProbeHit | null) => void;
}

export const SlabScene = ({
  model,
  results,
  selectedField,
  contourScale,
  deformScale,
  onProbeHit,
}: SlabSceneProps) => {
  const { plotMode } = model.display;
  const Lx = model.geometry.lengthM;
  const Ly = model.geometry.widthM;
  const cx = Lx / 2;
  const cy = Ly / 2;
  const maxDim = Math.max(Lx, Ly);
  const is3D = plotMode === "deformed";

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[Lx, Ly, maxDim]} intensity={0.6} />

      {is3D ? (
        <>
          <PerspectiveCamera
            makeDefault
            position={[cx, cy - maxDim * 0.7, maxDim * 0.6]}
            fov={50}
          />
          <OrbitControls target={[cx, cy, 0]} />
        </>
      ) : (
        <>
          <OrthographicCamera
            makeDefault
            position={[cx, cy, 100]}
            zoom={Math.min(580 / Lx, 380 / Ly)}
            near={-200}
            far={200}
          />
          <MapControls screenSpacePanning />
        </>
      )}

      {/* Layers mounted in subsequent tasks */}
    </>
  );
};
