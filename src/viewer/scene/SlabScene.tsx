import {
  MapControls,
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
} from "@react-three/drei";
import type { ContourScale } from "../../app/contourScale";
import type { AnalysisResults, ResultField, SlabModel } from "../../app/types";
import type { ProbeHit } from "../hooks/useViewerState";
import { ResultSurface } from "./ResultSurface";
import { StructureOverlay } from "./StructureOverlay";
import { MeshOverlay } from "./MeshOverlay";
import { ExtremaMarkers } from "./ExtremaMarkers";

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

  // Position camera above and behind the slab for a 3/4 view
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

      {/* Layers mounted in subsequent tasks */}
      {(plotMode === "results" || plotMode === "deformed") &&
        contourScale !== null &&
        results.meshElements.length > 0 && (
          <ResultSurface
            results={results}
            selectedField={selectedField}
            contourScale={contourScale}
            deformScale={plotMode === "deformed" ? deformScale : 0}
            onProbeHit={onProbeHit}
          />
        )}

      {(plotMode === "structure" || plotMode === "deformed") && (
        <StructureOverlay model={model} results={results} />
      )}

      {(plotMode === "mesh" || model.display.mesh) &&
        results.meshNodes.length > 0 && (
          <MeshOverlay
            meshNodes={results.meshNodes}
            meshElements={results.meshElements}
          />
        )}

      {(plotMode === "results" || plotMode === "deformed") &&
        selectedField !== "reactions" && (
          <ExtremaMarkers
            contour={results.nodalContours[selectedField]}
            radius={maxDim * 0.013}
          />
        )}
    </>
  );
};
