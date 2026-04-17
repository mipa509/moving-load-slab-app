import {
  MapControls,
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
} from "@react-three/drei";
import type { ContourScale } from "../../app/contourScale";
import type { AnalysisResults, NodalContourData, ResultField, SlabModel } from "../../app/types";
import type { ProbeHit } from "../hooks/useViewerState";
import { ResultSurface } from "./ResultSurface";
import { StructureOverlay } from "./StructureOverlay";
import { MeshOverlay } from "./MeshOverlay";
import { ExtremaMarkers } from "./ExtremaMarkers";

interface SlabSceneProps {
  model: SlabModel;
  results: AnalysisResults;
  selectedField: ResultField;
  contour: NodalContourData | undefined;
  contourScale: ContourScale | null;
  deformScale: number;
  showContours: boolean;
  showMesh: boolean;
  showSupports: boolean;
  showWheelPatches: boolean;
  onProbeHit: (hit: ProbeHit | null) => void;
}

export const SlabScene = ({
  model,
  results,
  selectedField,
  contour,
  contourScale,
  deformScale,
  showContours,
  showMesh,
  showSupports,
  showWheelPatches,
  onProbeHit,
}: SlabSceneProps) => {
  const { plotMode } = model.display;
  const Lx = model.geometry.lengthM;
  const Ly = model.geometry.widthM;
  const cx = Lx / 2;
  const cy = Ly / 2;
  const maxDim = Math.max(Lx, Ly);
  const is3D = plotMode === "deformed";

  const cameraZ = Math.max(model.geometry.thicknessM * deformScale * 3, maxDim * 0.4);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[Lx, Ly, maxDim]} intensity={0.6} />

      {is3D ? (
        <>
          <PerspectiveCamera
            makeDefault
            position={[cx, cy - maxDim * 0.7, cameraZ + maxDim * 0.5]}
            fov={50}
          />
          <OrbitControls target={[cx, cy, cameraZ / 4]} />
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

      {showContours && contourScale !== null && results.meshElements.length > 0 && (
        <ResultSurface
          results={results}
          selectedField={selectedField}
          contourScale={contourScale}
          deformScale={plotMode === "deformed" ? deformScale : 0}
          onProbeHit={onProbeHit}
        />
      )}

      <StructureOverlay
        model={model}
        results={results}
        showSupports={showSupports}
        showWheelPatches={showWheelPatches}
      />

      {showMesh && results.meshNodes.length > 0 && (
        <MeshOverlay
          meshNodes={results.meshNodes}
          meshElements={results.meshElements}
        />
      )}

      {showContours && (
        <ExtremaMarkers contour={contour} radius={maxDim * 0.013} />
      )}
    </>
  );
};
