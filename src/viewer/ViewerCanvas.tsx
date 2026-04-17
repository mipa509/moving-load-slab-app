import { useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { createContourScale } from "../app/contourScale";
import type { AnalysisResults, ResultField, SlabModel } from "../app/types";
import { useViewerState } from "./hooks/useViewerState";
import { SlabScene } from "./scene/SlabScene";
import { ViewerToolbar } from "./ViewerToolbar";
import { LegendDock } from "./LegendDock";
import {
  deriveViewerLayerVisibility,
  getViewerContour,
  shouldShowViewerContours,
} from "./viewerPresentation";

interface ViewerCanvasProps {
  model: SlabModel;
  results: AnalysisResults;
  selectedField: ResultField;
  onModelChange: (model: SlabModel) => void;
}

export const ViewerCanvas = ({
  model,
  results,
  selectedField,
  onModelChange,
}: ViewerCanvasProps) => {
  const { deformScale, setDeformScale, probeHit, setProbeHit } = useViewerState();
  const contour = getViewerContour(results, selectedField);
  const { showContours, showMesh, showSupports, showWheelPatches } = deriveViewerLayerVisibility(
    model.display.plotMode,
    model.display,
    contour,
  );
  const contourScale = useMemo(
    () => (contour ? createContourScale(contour.min, contour.max) : null),
    [contour?.min, contour?.max],
  );

  useEffect(() => {
    setProbeHit(null);
  }, [selectedField, model.display.contours, model.display.plotMode, setProbeHit]);

  return (
    <div className="viewer-shell">
      <ViewerToolbar
        model={model}
        onModelChange={onModelChange}
        deformScale={deformScale}
        onDeformScaleChange={setDeformScale}
      />
      <div className="viewer-canvas-wrap">
        <Canvas style={{ background: "#1b2027" }}>
          <SlabScene
            model={model}
            results={results}
            selectedField={selectedField}
            contour={contour}
            contourScale={contourScale}
            deformScale={deformScale}
            showContours={showContours}
            showMesh={showMesh}
            showSupports={showSupports}
            showWheelPatches={showWheelPatches}
            onProbeHit={setProbeHit}
          />
        </Canvas>
        {showContours && contourScale && contour && (
          <LegendDock contourScale={contourScale} units={contour.units} />
        )}
        {showContours && probeHit && contour && (
          <div className="viewer-probe-overlay">
            x {probeHit.x.toFixed(2)} m, y {probeHit.y.toFixed(2)} m —{" "}
            {probeHit.value.toFixed(4)} {contour.units}
          </div>
        )}
      </div>
    </div>
  );
};
