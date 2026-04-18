import { useMemo } from "react";
import { buildLegendTicks, formatViewportValue } from "../components/viewportHelpers";
import type { ContourScale } from "../app/contourScale";

interface LegendDockProps {
  contourScale: ContourScale;
  units: string;
}

export const LegendDock = ({ contourScale, units }: LegendDockProps) => {
  const ticks = useMemo(
    () => buildLegendTicks(contourScale.domainMin, contourScale.domainMax),
    [contourScale.domainMin, contourScale.domainMax],
  );
  const zeroLabel = useMemo(
    () =>
      formatViewportValue(
        0,
        Math.abs(contourScale.domainMax - contourScale.domainMin),
      ),
    [contourScale.domainMax, contourScale.domainMin],
  );

  return (
    <div className="viewer-legend-dock" aria-label="Colour scale legend">
      <div className="viewer-legend-title">{units}</div>
      <div className="viewer-legend-bar-wrap">
        <div
          className="viewer-legend-bar"
          style={{ background: contourScale.gradientCss }}
        >
          {contourScale.hasZeroTick && contourScale.zeroOffsetPercent !== null && (
            <div
              className="viewer-legend-zero-line"
              style={{ bottom: `${contourScale.zeroOffsetPercent}%` }}
            />
          )}
        </div>
        <div className="viewer-legend-ticks">
          {contourScale.hasZeroTick && contourScale.zeroOffsetPercent !== null && (
            <div
              className="viewer-legend-tick viewer-legend-tick-zero"
              style={{ top: `${100 - contourScale.zeroOffsetPercent}%` }}
            >
              {zeroLabel}
            </div>
          )}
          {ticks.map((tick) => (
            <div
              key={tick.key}
              className="viewer-legend-tick"
              style={{ top: `${tick.y}%` }}
            >
              {tick.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
