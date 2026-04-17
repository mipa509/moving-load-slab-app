import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { createContourScale } from "../app/contourScale";
import type { AnalysisResults, ResultField, SlabModel } from "../app/types";
import { useViewerState } from "./hooks/useViewerState";
import { SlabScene } from "./scene/SlabScene";
import { ViewerToolbar } from "./ViewerToolbar";
import { LegendDock } from "./LegendDock";

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
  const contour =
    selectedField === "reactions" ? undefined : results.nodalContours[selectedField];
  const contourScale = useMemo(
    () => (contour ? createContourScale(contour.min, contour.max) : null),
    [contour?.min, contour?.max],
  );

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
            // TODO: results used by ResultSurface layer in Task 7
            results={results}
            selectedField={selectedField}
            contourScale={contourScale}
            deformScale={deformScale}
            onProbeHit={setProbeHit}
          />
        </Canvas>
        {contourScale && contour && (
          <LegendDock contourScale={contourScale} units={contour.units} />
        )}
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
