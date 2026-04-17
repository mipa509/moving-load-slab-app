import type {
  AnalysisResults,
  DisplayToggles,
  NodalContourData,
  PlotMode,
  ResultField,
} from "../app/types";
import {
  deriveViewportLayerVisibility,
  type ViewportLayerVisibility,
} from "../components/viewportHelpers";

export function getViewerContour(
  results: AnalysisResults,
  selectedField: ResultField,
): NodalContourData | undefined {
  return selectedField === "reactions" ? undefined : results.nodalContours[selectedField];
}

export function shouldShowViewerContours(
  plotMode: PlotMode,
  display: DisplayToggles,
  contour: NodalContourData | undefined,
): boolean {
  return (plotMode === "results" || plotMode === "deformed") && display.contours && Boolean(contour);
}

export function deriveViewerLayerVisibility(
  plotMode: PlotMode,
  display: DisplayToggles,
  contour: NodalContourData | undefined,
): ViewportLayerVisibility {
  return deriveViewportLayerVisibility(plotMode, display, Boolean(contour));
}
