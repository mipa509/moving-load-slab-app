import {
  computeSideElevationLayout,
  type SideElevationLayout,
} from "../app/vehicleSideElevation";
import type { VehicleDefinition } from "../app/types";

interface VehicleSideElevationProps {
  vehicle: VehicleDefinition;
  className?: string;
}

const VIEWBOX_HEIGHT = 160;
const TOP_MARGIN = 10;
const BOTTOM_MARGIN = 40;
const SIDE_MARGIN = 60;
const BASELINE_Y = VIEWBOX_HEIGHT - BOTTOM_MARGIN;
const ARROW_LENGTH = 60;
const WHEEL_RX = 9;
const WHEEL_RY = 6;
const MIN_AXLE_PIXELS = 80;

const buildScale = (layout: SideElevationLayout, drawableWidth: number) => {
  const span = Math.max(layout.totalLengthM, 0);
  if (layout.axles.length <= 1 || span <= 1e-6) {
    return (xM: number) => SIDE_MARGIN + drawableWidth / 2 + xM * 0;
  }
  const pxPerM = drawableWidth / span;
  return (xM: number) => SIDE_MARGIN + xM * pxPerM;
};

export const VehicleSideElevation = ({
  vehicle,
  className,
}: VehicleSideElevationProps) => {
  const layout = computeSideElevationLayout(vehicle);
  if (layout.axles.length === 0) {
    return (
      <p className="vehicle-side-elevation-empty">
        No axles defined — add at least one axle (or one wheel cluster) to see the
        elevation.
      </p>
    );
  }

  const baseWidth = Math.max(
    MIN_AXLE_PIXELS * Math.max(layout.axles.length - 1, 1) + 2 * SIDE_MARGIN,
    320,
  );
  const drawableWidth = baseWidth - 2 * SIDE_MARGIN;
  const scaleX = buildScale(layout, drawableWidth);

  const axlesWithPx = layout.axles.map((axle) => ({
    ...axle,
    px: scaleX(axle.xM),
  }));

  return (
    <figure className={`vehicle-side-elevation ${className ?? ""}`.trim()}>
      <svg
        role="img"
        aria-label="Vehicle side elevation"
        viewBox={`0 0 ${baseWidth} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* baseline */}
        <line
          x1={SIDE_MARGIN - 20}
          x2={baseWidth - SIDE_MARGIN + 20}
          y1={BASELINE_Y}
          y2={BASELINE_Y}
          stroke="currentColor"
          strokeWidth={1.2}
        />
        {/* spacings */}
        {axlesWithPx.slice(1).map((axle, i) => {
          const prev = axlesWithPx[i];
          const y = BASELINE_Y + 22;
          const mid = (prev.px + axle.px) / 2;
          const dist = axle.xM - prev.xM;
          return (
            <g key={`dim-${prev.id}-${axle.id}`} stroke="currentColor" fill="currentColor">
              <line x1={prev.px} x2={axle.px} y1={y} y2={y} strokeWidth={0.8} />
              <line x1={prev.px} x2={prev.px} y1={y - 4} y2={y + 4} strokeWidth={0.8} />
              <line x1={axle.px} x2={axle.px} y1={y - 4} y2={y + 4} strokeWidth={0.8} />
              <text
                x={mid}
                y={y - 4}
                textAnchor="middle"
                fontSize="11"
                stroke="none"
              >
                {dist.toFixed(2)} m
              </text>
            </g>
          );
        })}
        {/* axles + arrows */}
        {axlesWithPx.map((axle) => {
          const arrowTopY = BASELINE_Y - ARROW_LENGTH;
          return (
            <g key={axle.id}>
              <ellipse
                cx={axle.px}
                cy={BASELINE_Y}
                rx={WHEEL_RX}
                ry={WHEEL_RY}
                fill="#ffffff"
                stroke="currentColor"
                strokeWidth={1}
              />
              <line
                x1={axle.px}
                x2={axle.px}
                y1={arrowTopY}
                y2={BASELINE_Y - WHEEL_RY - 2}
                stroke="currentColor"
                strokeWidth={1.4}
              />
              <polygon
                points={`${axle.px - 4},${BASELINE_Y - WHEEL_RY - 2} ${axle.px + 4},${BASELINE_Y - WHEEL_RY - 2} ${axle.px},${BASELINE_Y - WHEEL_RY + 4}`}
                fill="currentColor"
              />
              <text
                x={axle.px}
                y={arrowTopY - 4}
                textAnchor="middle"
                fontSize="12"
                fontWeight={600}
                fill="currentColor"
              >
                {axle.loadKn.toFixed(1)} kN
              </text>
            </g>
          );
        })}
        {/* total length */}
        {axlesWithPx.length > 1 ? (
          <g stroke="currentColor" fill="currentColor">
            <line
              x1={axlesWithPx[0].px}
              x2={axlesWithPx[axlesWithPx.length - 1].px}
              y1={TOP_MARGIN}
              y2={TOP_MARGIN}
              strokeWidth={0.8}
            />
            <text
              x={(axlesWithPx[0].px + axlesWithPx[axlesWithPx.length - 1].px) / 2}
              y={TOP_MARGIN - 2}
              textAnchor="middle"
              fontSize="11"
              stroke="none"
            >
              total {layout.totalLengthM.toFixed(2)} m
            </text>
          </g>
        ) : null}
      </svg>
      <figcaption>
        Side elevation — {axlesWithPx.length} axle{axlesWithPx.length === 1 ? "" : "s"},
        total length {layout.totalLengthM.toFixed(2)} m.
      </figcaption>
    </figure>
  );
};
