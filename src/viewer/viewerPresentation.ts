import type {
  AnalysisResults,
  DisplayToggles,
  NodalContourData,
  NodalDisplacementOverlay,
  PlotMode,
  ResultField,
} from "../app/types";
import {
  deriveViewportLayerVisibility,
  type ViewportLayerVisibility,
} from "../components/viewportHelpers";

export const DEFORM_MULTIPLIER_MIN = 0.25;
export const DEFORM_MULTIPLIER_MAX = 4;

export interface ViewerDeformationState {
  maxAbsW: number;
  minW: number;
  maxW: number;
  baseExaggeration: number;
  effectiveExaggeration: number;
  hasFiniteDisplacements: boolean;
  hasVisibleDeformation: boolean;
  centerZ: number;
  zSpan: number;
}

export interface ViewerProbePosition {
  left: number;
  top: number;
}

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
  return (
    (plotMode === "results" || plotMode === "deformed") &&
    display.contours &&
    Boolean(contour)
  );
}

export function shouldShowViewerProbe(
  plotMode: PlotMode,
  contour: NodalContourData | undefined,
): boolean {
  return plotMode !== "deformed" && Boolean(contour);
}

export function deriveViewerLayerVisibility(
  plotMode: PlotMode,
  display: DisplayToggles,
  contour: NodalContourData | undefined,
): ViewportLayerVisibility {
  return deriveViewportLayerVisibility(plotMode, display, Boolean(contour));
}

export function clampDeformMultiplier(multiplier: number): number {
  return clamp(multiplier, DEFORM_MULTIPLIER_MIN, DEFORM_MULTIPLIER_MAX);
}

export function deriveViewerDeformation(
  nodalDisplacements: NodalDisplacementOverlay[],
  maxSpan: number,
  multiplier: number,
): ViewerDeformationState {
  const wValues = nodalDisplacements
    .map((item) => item.wM)
    .filter((value) => Number.isFinite(value));
  if (wValues.length === 0) {
    return emptyDeformationState();
  }

  const minW = Math.min(...wValues);
  const maxW = Math.max(...wValues);
  const maxAbsW = Math.max(Math.abs(minW), Math.abs(maxW));
  if (!(maxAbsW > 0)) {
    return {
      ...emptyDeformationState(),
      hasFiniteDisplacements: true,
      minW,
      maxW,
      maxAbsW,
    };
  }

  const baseExaggeration = clamp((0.08 * Math.max(maxSpan, 1e-6)) / maxAbsW, 1, 10000);
  const effectiveExaggeration = baseExaggeration * clampDeformMultiplier(multiplier);
  const zMin = -maxW * effectiveExaggeration;
  const zMax = -minW * effectiveExaggeration;

  return {
    maxAbsW,
    minW,
    maxW,
    baseExaggeration,
    effectiveExaggeration,
    hasFiniteDisplacements: true,
    hasVisibleDeformation: Number.isFinite(zMin) && Number.isFinite(zMax),
    centerZ: 0.5 * (zMin + zMax),
    zSpan: Math.abs(zMax - zMin),
  };
}

export function clampViewerProbePosition(
  screenX: number,
  screenY: number,
  wrapWidth: number,
  wrapHeight: number,
): ViewerProbePosition {
  const tooltipWidth = 198;
  const tooltipHeight = 44;
  const padding = 10;

  return {
    left: clamp(screenX + 14, padding, Math.max(padding, wrapWidth - tooltipWidth - padding)),
    top: clamp(
      screenY - tooltipHeight - 12,
      padding,
      Math.max(padding, wrapHeight - tooltipHeight - padding),
    ),
  };
}

function emptyDeformationState(): ViewerDeformationState {
  return {
    maxAbsW: 0,
    minW: 0,
    maxW: 0,
    baseExaggeration: 0,
    effectiveExaggeration: 0,
    hasFiniteDisplacements: false,
    hasVisibleDeformation: false,
    centerZ: 0,
    zSpan: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
