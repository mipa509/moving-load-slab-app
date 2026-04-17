import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { createContourScale } from "../app/contourScale";
import type { AnalysisResults, ResultField, SlabModel } from "../app/types";
import { useViewerState } from "./hooks/useViewerState";
import { SlabScene } from "./scene/SlabScene";

interface ViewerCanvasProps {
  model: SlabModel;
  results: AnalysisResults;
  selectedField: ResultField;
  // TODO: used by toolbar in Task 7+ for model updates (e.g. display toggles)
  onModelChange?: (model: SlabModel) => void;
}

export const ViewerCanvas = ({
  model,
  results,
  selectedField,
}: ViewerCanvasProps) => {
  const { deformScale, setDeformScale, probeHit, setProbeHit } = useViewerState();
  const contour =
    selectedField === "reactions" ? undefined : results.nodalContours[selectedField];
  const contourScale = useMemo(
    () => (contour ? createContourScale(contour.min, contour.max) : null),
    [contour?.min, contour?.max],
  );

  return (
    <div className="viewer-shell">
      <div className="viewer-canvas-wrap">
        <Canvas className="viewer-canvas">
          <SlabScene
            model={model}
            // TODO: results used by ResultSurface layer in Task 7
            results={results}
            selectedField={selectedField}
            contourScale={contourScale}
            deformScale={deformScale}
            onProbeHit={setProbeHit}
          />
        </Canvas>
        {probeHit && contour && (
          <div className="viewer-probe-overlay">
            x {probeHit.x.toFixed(2)} m, y {probeHit.y.toFixed(2)} m —{" "}
            {probeHit.value.toFixed(4)} {contour.units}
          </div>
        )}
      </div>
    </div>
  );
};
