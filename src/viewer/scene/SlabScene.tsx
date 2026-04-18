import {
  MapControls,
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
} from "@react-three/drei";
import type { ContourScale } from "../../app/contourScale";
import type { AnalysisResults, NodalContourData, ResultField, SlabModel } from "../../app/types";
import type { ProbeHit } from "../hooks/useViewerState";
import type { ViewerDeformationState } from "../viewerPresentation";
import { ExtremaMarkers } from "./ExtremaMarkers";
import { MeshOverlay } from "./MeshOverlay";
import { ProbeSurface } from "./ProbeSurface";
import { ResultSurface } from "./ResultSurface";
import { StructureOverlay } from "./StructureOverlay";

interface SlabSceneProps {
  model: SlabModel;
  results: AnalysisResults;
  selectedField: ResultField;
  contour: NodalContourData | undefined;
  contourScale: ContourScale | null;
  deformation: ViewerDeformationState;
  showContours: boolean;
  showMesh: boolean;
  showSupports: boolean;
  showWheelPatches: boolean;
  showProbe: boolean;
  onProbeHit: (hit: ProbeHit | null) => void;
}

export const SlabScene = ({
  model,
  results,
  selectedField,
  contour,
  contourScale,
  deformation,
  showContours,
  showMesh,
  showSupports,
  showWheelPatches,
  showProbe,
  onProbeHit,
}: SlabSceneProps) => {
  const { plotMode } = model.display;
  const Lx = model.geometry.lengthM;
  const Ly = model.geometry.widthM;
  const cx = Lx * 0.5;
  const cy = Ly * 0.5;
  const maxDim = Math.max(Lx, Ly);
  const is3D = plotMode === "deformed";

  const cameraDistance = Math.max(maxDim * 1.15, deformation.zSpan * 3.4, maxDim * 0.55);
  const cameraTarget: [number, number, number] = [cx, cy, deformation.centerZ];
  const perspectivePosition: [number, number, number] = [
    cx + maxDim * 0.48,
    cy - maxDim * 0.92,
    deformation.centerZ + cameraDistance,
  ];

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[Lx, Ly, maxDim]} intensity={0.6} />

      {is3D ? (
        <>
          <PerspectiveCamera makeDefault position={perspectivePosition} fov={48} />
          <OrbitControls target={cameraTarget} />
        </>
      ) : (
        <>
          <OrthographicCamera
            makeDefault
            position={[cx, cy, 100]}
            zoom={Math.min(580 / Lx, 380 / Ly)}
            near={-400}
            far={400}
          />
          <MapControls screenSpacePanning />
        </>
      )}

      {showContours && contourScale !== null && results.meshElements.length > 0 && (
        <ResultSurface
          results={results}
          selectedField={selectedField}
          contourScale={contourScale}
          deformScale={is3D ? deformation.effectiveExaggeration : 0}
        />
      )}

      {showProbe && contour && results.meshNodes.length > 0 && (
        <ProbeSurface
          slabLengthM={Lx}
          slabWidthM={Ly}
          meshNodes={results.meshNodes}
          contour={contour}
          onProbeHit={onProbeHit}
        />
      )}

      <StructureOverlay
        model={model}
        results={results}
        showSupports={showSupports}
        showWheelPatches={showWheelPatches}
        showRestraintChips={plotMode === "structure" && showSupports}
      />

      {showMesh && results.meshNodes.length > 0 && (
        <MeshOverlay
          meshNodes={results.meshNodes}
          meshElements={results.meshElements}
          nodalDisplacements={is3D ? results.nodalDisplacements : undefined}
          deformScale={is3D ? deformation.effectiveExaggeration : 0}
          color={plotMode === "results" ? "#51657d" : "#6280a3"}
          opacity={plotMode === "results" ? 0.32 : plotMode === "deformed" ? 0.42 : 0.54}
        />
      )}

      {plotMode === "results" && showContours && (
        <ExtremaMarkers contour={contour} size={maxDim * 0.008} />
      )}
    </>
  );
};
