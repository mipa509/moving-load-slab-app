import { useMemo } from "react";
import { buildLegendTicks } from "../components/viewportHelpers";
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

  return (
    <div className="viewer-legend-dock" aria-label="Colour scale legend">
      <div className="viewer-legend-title">{units}</div>
      <div className="viewer-legend-bar-wrap">
        <div
          className="viewer-legend-bar"
          style={{ background: contourScale.gradientCss }}
        />
        <div className="viewer-legend-ticks">
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
