import { useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { createContourScale } from "../app/contourScale";
import type { AnalysisResults, ResultField, SlabModel } from "../app/types";
import { getDeckBounds } from "../solver/geometry/deckCoordinates";
import { useViewerState } from "./hooks/useViewerState";
import { computeDeckFraming } from "./math/deckFraming";
import { SlabScene } from "./scene/SlabScene";
import { ViewerToolbar } from "./ViewerToolbar";
import { LegendDock } from "./LegendDock";
import {
  clampViewerProbePosition,
  deriveViewerDeformation,
  deriveViewerLayerVisibility,
  getViewerContour,
  shouldShowViewerProbe,
  shouldShowViewerContours,
} from "./viewerPresentation";

interface ViewerCanvasProps {
  model: SlabModel;
  results: AnalysisResults;
  selectedField: ResultField;
  onModelChange: (model: SlabModel) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

/**
 * Reference span (metres) used to scale the deformation exaggeration.
 * Uses the deck's actual (possibly skewed) bounds rather than
 * `max(lengthM, widthM)`, which under-covers a skewed deck. Falls back to
 * the zero-skew rectangle bounds if the geometry is momentarily degenerate
 * (mid-edit).
 */
function getDeformationReferenceSpanM(geometry: SlabModel["geometry"]): number {
  try {
    return computeDeckFraming(getDeckBounds(geometry)).maxSpan;
  } catch {
    return computeDeckFraming({
      xMin: 0,
      xMax: geometry.lengthM,
      yMin: 0,
      yMax: geometry.widthM,
    }).maxSpan;
  }
}

export const ViewerCanvas = ({
  model,
  results,
  selectedField,
  onModelChange,
  onCanvasReady,
}: ViewerCanvasProps) => {
  const { deformScale, setDeformScale, probeHit, setProbeHit } = useViewerState();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const contour = getViewerContour(results, selectedField);
  const { showContours, showMesh, showSupports, showWheelPatches } = deriveViewerLayerVisibility(
    model.display.plotMode,
    model.display,
    contour,
  );
  const showProbe = shouldShowViewerProbe(model.display.plotMode, contour);
  const contourScale = useMemo(
    () => (contour ? createContourScale(contour.min, contour.max) : null),
    [contour?.min, contour?.max],
  );
  const deformation = useMemo(
    () =>
      deriveViewerDeformation(
        results.nodalDisplacements,
        getDeformationReferenceSpanM(model.geometry),
        deformScale,
      ),
    [
      deformScale,
      model.geometry.lengthM,
      model.geometry.widthM,
      model.geometry.skewAngleDeg,
      results.nodalDisplacements,
    ],
  );
  const probePosition =
    probeHit && wrapRef.current
      ? clampViewerProbePosition(
          probeHit.screenX,
          probeHit.screenY,
          wrapRef.current.clientWidth,
          wrapRef.current.clientHeight,
        )
      : null;

  useEffect(() => {
    setProbeHit(null);
  }, [selectedField, model.display.contours, model.display.plotMode, setProbeHit]);

  return (
    <div className="viewer-shell">
      <ViewerToolbar
        model={model}
        onModelChange={onModelChange}
        deformScale={deformScale}
        effectiveExaggeration={deformation.effectiveExaggeration}
        hasVisibleDeformation={deformation.hasVisibleDeformation}
        onDeformScaleChange={setDeformScale}
      />
      <div ref={wrapRef} className="viewer-canvas-wrap">
        <Canvas
          style={{ background: "#1b2027" }}
          gl={{ preserveDrawingBuffer: true }}
          onCreated={({ gl }) => {
            onCanvasReady?.(gl.domElement);
          }}
        >
          <SlabScene
            model={model}
            results={results}
            selectedField={selectedField}
            contour={contour}
            contourScale={contourScale}
            deformation={deformation}
            showContours={showContours}
            showMesh={showMesh}
            showSupports={showSupports}
            showWheelPatches={showWheelPatches}
            showProbe={showProbe}
            onProbeHit={setProbeHit}
          />
        </Canvas>
        {showContours &&
          shouldShowViewerContours(model.display.plotMode, model.display, contour) &&
          contourScale &&
          contour && <LegendDock contourScale={contourScale} units={contour.units} />}
        {showProbe && probeHit && contour && probePosition && (
          <div
            className="viewer-probe-overlay"
            style={{ left: `${probePosition.left}px`, top: `${probePosition.top}px` }}
          >
            x {probeHit.x.toFixed(2)} m, y {probeHit.y.toFixed(2)} m
            <br />
            {probeHit.value.toFixed(4)} {contour.units}
          </div>
        )}
        {results.status === "error" && results.error ? (
          <div className="viewer-error-overlay" role="alert">
            <strong>Analysis blocked</strong>
            <span>{results.error}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
