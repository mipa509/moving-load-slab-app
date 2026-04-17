import type { ContourPoint, DisplayToggles, PlotMode } from "../app/types";

export type LegendTick = {
  key: string;
  label: string;
  y: number;
};

export type ContourExtrema = {
  min: ContourPoint;
  max: ContourPoint;
  samePoint: boolean;
};

export type ViewportLayerVisibility = {
  showContours: boolean;
  showMesh: boolean;
  showSupports: boolean;
  showWheelPatches: boolean;
};

export function deriveViewportLayerVisibility(
  plotMode: PlotMode,
  display: DisplayToggles,
  hasContour: boolean,
): ViewportLayerVisibility {
  return {
    showContours:
      (plotMode === "results" || plotMode === "deformed") && display.contours && hasContour,
    showMesh:
      plotMode === "mesh" || plotMode === "deformed" ? true : display.mesh,
    showSupports:
      plotMode === "structure" || plotMode === "mesh" || plotMode === "deformed"
        ? true
        : display.supports,
    showWheelPatches:
      plotMode === "structure" || plotMode === "deformed" ? true : display.wheelPatches,
  };
}

export function buildLegendTicks(
  domainMin: number,
  domainMax: number,
  tickCount: number = 5,
): LegendTick[] {
  const span = Math.abs(domainMax - domainMin);
  if (tickCount < 2 || span < 1e-12) {
    return [
      {
        key: "legend-tick-single",
        label: formatViewportValue(domainMax, Math.max(Math.abs(domainMax), 1)),
        y: 50,
      },
    ];
  }

  return Array.from({ length: tickCount }, (_, index) => {
    const fraction = index / (tickCount - 1);
    const value = domainMax - (domainMax - domainMin) * fraction;
    return {
      key: `legend-tick-${index}`,
      label: formatViewportValue(value, span),
      y: 1 + fraction * 98,
    };
  });
}

export function findContourExtrema(points: ContourPoint[]): ContourExtrema | null {
  if (points.length === 0) {
    return null;
  }

  let min = points[0];
  let max = points[0];

  for (const point of points) {
    if (point.value < min.value) {
      min = point;
    }
    if (point.value > max.value) {
      max = point;
    }
  }

  return {
    min,
    max,
    samePoint: min.xM === max.xM && min.yM === max.yM,
  };
}

export function formatViewportValue(value: number, span: number): string {
  const safeSpan = Math.max(Math.abs(span), 1e-12);
  const decimals = Math.min(12, Math.max(0, Math.ceil(-Math.log10(safeSpan)) + 2));
  const rounded = Number(value.toFixed(decimals));
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return normalized.toFixed(decimals);
}
