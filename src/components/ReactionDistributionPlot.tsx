import { useMemo } from "react";
import type { SupportReactionDistribution } from "../app/types";
import {
  REACTION_SERIES_OPTIONS,
  buildReactionPlotPoints,
  computeReactionPlotDomain,
  formatSupportAxisLabel,
  reactionSeriesOption,
  reactionSeriesUnits,
  type ReactionPlotPoint,
  type ReactionSeriesKey,
} from "../app/reactionPlotData";

interface ReactionDistributionPlotProps {
  distribution: SupportReactionDistribution | null;
  seriesKey: ReactionSeriesKey;
  onSeriesKeyChange: (key: ReactionSeriesKey) => void;
  width?: number;
  height?: number;
  className?: string;
}

// ---------------------------------------------------------------------------
// Tick/scale idiom below is modelled directly on `SectionPlot.tsx` (same
// PADDING shape, same computeTickStep/enumerateTicks/niceTicks/formatTick
// helpers). `SectionPlot` does not export these as reusable functions, so
// they are duplicated here rather than imported — this component owns its
// own scale/axis math exactly like `SectionPlot` owns its own.
// ---------------------------------------------------------------------------

const PADDING = { top: 18, right: 18, bottom: 40, left: 60 };
const MAJOR_TICK_COUNT = 6;

interface TickStep {
  major: number;
  minor: number;
}

const computeTickStep = (min: number, max: number, count: number): TickStep => {
  const span = Math.max(max - min, 1e-9);
  const rough = span / Math.max(1, count - 1);
  const exp = Math.floor(Math.log10(rough));
  const base = Math.pow(10, exp);
  const candidates: { mult: number; minor: number }[] = [
    { mult: 1, minor: 5 },
    { mult: 2, minor: 4 },
    { mult: 2.5, minor: 5 },
    { mult: 5, minor: 5 },
    { mult: 10, minor: 5 },
  ];
  let major = base * 10;
  let minorDiv = 5;
  for (const c of candidates) {
    if (c.mult * base >= rough) {
      major = c.mult * base;
      minorDiv = c.minor;
      break;
    }
  }
  return { major, minor: major / Math.max(1, minorDiv) };
};

const enumerateTicks = (min: number, max: number, step: number): number[] => {
  if (!Number.isFinite(min) || !Number.isFinite(max) || step <= 0) return [];
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 1e-6; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
};

const niceTicks = (min: number, max: number, count: number): number[] => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (max - min < 1e-9) {
    return [min];
  }
  const { major } = computeTickStep(min, max, count);
  const ticks = enumerateTicks(min, max, major);
  return ticks.length > 0 ? ticks : [min, max];
};

const formatTick = (value: number, span: number): string => {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) < 1e-9 && span > 1e-9) return "0";
  if (span >= 200) return value.toFixed(0);
  if (span >= 20) return value.toFixed(1);
  if (span >= 2) return value.toFixed(2);
  return value.toFixed(3);
};

const formatSampleValue = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  const absV = Math.abs(value);
  if (absV >= 100) return value.toFixed(1);
  if (absV >= 10) return value.toFixed(2);
  return value.toFixed(3);
};

interface PlotScale {
  toX: (distanceM: number) => number;
  toY: (value: number) => number;
}

/**
 * Builds the plot scale for a reaction stem plot. Unlike `SectionPlot`
 * (which deliberately inverts its value axis to match the sagging-below /
 * hogging-above bending-moment convention), this is a plain Cartesian value
 * axis: larger values plot higher on the chart. There is no accepted
 * sign-inversion convention for reactions/support-axis couples, so inverting
 * here would only obscure the plain magnitude-vs-position reading this plot
 * is meant to give.
 */
const buildScale = (
  domain: { xMinM: number; xMaxM: number; yMin: number; yMax: number },
  width: number,
  height: number,
): PlotScale => {
  const innerWidth = width - PADDING.left - PADDING.right;
  const innerHeight = height - PADDING.top - PADDING.bottom;
  const spanY = Math.max(domain.yMax - domain.yMin, 1e-6);
  const padY = spanY * 0.12;
  let yLo = Math.min(domain.yMin - padY, 0);
  let yHi = Math.max(domain.yMax + padY, 0);
  if (yHi - yLo < 1e-9) {
    yLo -= 1;
    yHi += 1;
  }
  const xSpan = Math.max(domain.xMaxM - domain.xMinM, 1e-6);
  const ySpan = yHi - yLo;
  return {
    toX: (distanceM: number) => PADDING.left + ((distanceM - domain.xMinM) / xSpan) * innerWidth,
    toY: (value: number) => PADDING.top + innerHeight - ((value - yLo) / ySpan) * innerHeight,
  };
};

/**
 * Reaction DISTRIBUTION plot (WP-044): plots the per-node NODAL-INTEGRATED
 * reaction values of one support's `SupportReactionDistribution` against
 * `distanceAlongSupportM`, as a discrete stem/'+marker' series (one mark per
 * sample) — NOT a smooth/interpolated density curve, because these values
 * are discrete nodal-integrated reactions, not a continuous field. A sample
 * whose reaction includes a shared or mixed fixed-corner contribution
 * (`shared-fixed-attribution` / `mixed-fixed-spring`) is drawn with a
 * distinct diamond marker instead of the plain cross, with a legend note
 * beneath the plot.
 */
export const ReactionDistributionPlot = ({
  distribution,
  seriesKey,
  onSeriesKeyChange,
  width = 520,
  height = 240,
  className,
}: ReactionDistributionPlotProps) => {
  const points = useMemo(
    () => buildReactionPlotPoints(distribution, seriesKey),
    [distribution, seriesKey],
  );
  const domain = useMemo(
    () => computeReactionPlotDomain(distribution, points),
    [distribution, points],
  );
  const hasData = domain !== null && points.length > 0;
  const scale = useMemo(() => (hasData && domain ? buildScale(domain, width, height) : null), [
    hasData,
    domain,
    width,
    height,
  ]);

  const xMajorTicks = useMemo(
    () => (domain ? niceTicks(domain.xMinM, domain.xMaxM, MAJOR_TICK_COUNT) : []),
    [domain],
  );
  const xStep = useMemo(
    () => (domain ? computeTickStep(domain.xMinM, domain.xMaxM, MAJOR_TICK_COUNT) : null),
    [domain],
  );
  const xMinorTicks = useMemo(
    () => (domain && xStep ? enumerateTicks(domain.xMinM, domain.xMaxM, xStep.minor) : []),
    [domain, xStep],
  );

  // The y (value) domain used for ticks mirrors the padded domain the scale
  // itself derives, so gridlines land exactly on the drawn axis extent.
  const paddedYDomain = useMemo(() => {
    if (!domain) return null;
    const spanY = Math.max(domain.yMax - domain.yMin, 1e-6);
    const padY = spanY * 0.12;
    let yLo = Math.min(domain.yMin - padY, 0);
    let yHi = Math.max(domain.yMax + padY, 0);
    if (yHi - yLo < 1e-9) {
      yLo -= 1;
      yHi += 1;
    }
    return { yLo, yHi };
  }, [domain]);
  const yMajorTicks = useMemo(
    () => (paddedYDomain ? niceTicks(paddedYDomain.yLo, paddedYDomain.yHi, MAJOR_TICK_COUNT) : []),
    [paddedYDomain],
  );
  const yStep = useMemo(
    () =>
      paddedYDomain ? computeTickStep(paddedYDomain.yLo, paddedYDomain.yHi, MAJOR_TICK_COUNT) : null,
    [paddedYDomain],
  );
  const yMinorTicks = useMemo(
    () =>
      paddedYDomain && yStep
        ? enumerateTicks(paddedYDomain.yLo, paddedYDomain.yHi, yStep.minor)
        : [],
    [paddedYDomain, yStep],
  );

  const xSpan = domain ? domain.xMaxM - domain.xMinM : 0;
  const ySpan = paddedYDomain ? paddedYDomain.yHi - paddedYDomain.yLo : 0;
  const isMajor = (value: number, majors: number[]) =>
    majors.some((m) => Math.abs(m - value) < 1e-6);

  const innerLeft = PADDING.left;
  const innerRight = width - PADDING.right;
  const innerTop = PADDING.top;
  const innerBottom = height - PADDING.bottom;

  const option = reactionSeriesOption(seriesKey);
  const units = reactionSeriesUnits(seriesKey);
  const hasSharedCorner = points.some((p) => p.isSharedCorner);
  const axisLabel = distribution ? formatSupportAxisLabel(distribution) : "Distance along support (m)";

  return (
    <figure className={`section-plot reaction-distribution-plot${className ? ` ${className}` : ""}`}>
      <div className="reaction-distribution-plot-controls">
        <label className="field reaction-distribution-plot-series">
          <span>Plotted quantity</span>
          <select
            value={seriesKey}
            onChange={(event) => onSeriesKeyChange(event.target.value as ReactionSeriesKey)}
          >
            {REACTION_SERIES_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label} ({opt.units})
              </option>
            ))}
          </select>
        </label>
      </div>
      <figcaption className="section-plot-caption">
        <strong>
          {option.label} — nodal-integrated reactions ({units})
        </strong>
        {distribution ? <span>{distribution.supportKind === "edge" ? `Edge support: ${distribution.supportId}` : `Line support: ${distribution.supportId}`}</span> : null}
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="section-plot-svg"
        role="img"
        aria-label={`${option.label} reaction distribution plot`}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect
          x={innerLeft}
          y={innerTop}
          width={innerRight - innerLeft}
          height={innerBottom - innerTop}
          fill="#ffffff"
          stroke="#11161d"
          strokeWidth={0.6}
        />
        {scale &&
          xMinorTicks.map((tick) => {
            if (isMajor(tick, xMajorTicks)) return null;
            const x = scale.toX(tick);
            if (x < innerLeft - 0.1 || x > innerRight + 0.1) return null;
            return (
              <line
                key={`rxtm-${tick}`}
                x1={x}
                x2={x}
                y1={innerTop}
                y2={innerBottom}
                stroke="#eef2f7"
                strokeWidth={0.4}
              />
            );
          })}
        {scale &&
          yMinorTicks.map((tick) => {
            if (isMajor(tick, yMajorTicks)) return null;
            const y = scale.toY(tick);
            if (y < innerTop - 0.1 || y > innerBottom + 0.1) return null;
            return (
              <line
                key={`rytm-${tick}`}
                x1={innerLeft}
                x2={innerRight}
                y1={y}
                y2={y}
                stroke="#eef2f7"
                strokeWidth={0.4}
              />
            );
          })}
        {scale &&
          xMajorTicks.map((tick) => {
            const x = scale.toX(tick);
            if (x < innerLeft - 0.1 || x > innerRight + 0.1) return null;
            return (
              <g key={`rxt-${tick}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={innerTop}
                  y2={innerBottom}
                  stroke="#cad2dc"
                  strokeWidth={0.5}
                />
                <line
                  x1={x}
                  x2={x}
                  y1={innerBottom}
                  y2={innerBottom + 4}
                  stroke="#11161d"
                  strokeWidth={0.6}
                />
                <text x={x} y={innerBottom + 14} fontSize={10} textAnchor="middle" fill="#11161d">
                  {formatTick(tick, xSpan)}
                </text>
              </g>
            );
          })}
        {scale &&
          yMajorTicks.map((tick) => {
            const y = scale.toY(tick);
            if (y < innerTop - 0.1 || y > innerBottom + 0.1) return null;
            return (
              <g key={`ryt-${tick}`}>
                <line
                  x1={innerLeft}
                  x2={innerRight}
                  y1={y}
                  y2={y}
                  stroke="#cad2dc"
                  strokeWidth={0.5}
                />
                <line x1={innerLeft - 4} x2={innerLeft} y1={y} y2={y} stroke="#11161d" strokeWidth={0.6} />
                <text x={innerLeft - 6} y={y + 3} fontSize={10} textAnchor="end" fill="#11161d">
                  {formatTick(tick, ySpan)}
                </text>
              </g>
            );
          })}
        {scale && paddedYDomain && paddedYDomain.yLo <= 0 && paddedYDomain.yHi >= 0 ? (
          <line
            x1={innerLeft}
            x2={innerRight}
            y1={scale.toY(0)}
            y2={scale.toY(0)}
            stroke="#11161d"
            strokeWidth={0.8}
          />
        ) : null}
        {scale
          ? points.map((point: ReactionPlotPoint) => {
              const x = scale.toX(point.distanceM);
              const y = scale.toY(point.value);
              const y0 = scale.toY(0);
              const color = point.isSharedCorner ? "#a46c1e" : "#153a63";
              return (
                <g key={`rp-${point.nodeId}`}>
                  <line x1={x} x2={x} y1={y0} y2={y} stroke={color} strokeWidth={1.1} strokeOpacity={0.65} />
                  {point.isSharedCorner ? (
                    <rect
                      x={x - 4.2}
                      y={y - 4.2}
                      width={8.4}
                      height={8.4}
                      fill="#fff7ea"
                      stroke={color}
                      strokeWidth={1.3}
                      transform={`rotate(45 ${x} ${y})`}
                    >
                      <title>
                        Node {point.nodeId}: {formatSampleValue(point.value)} {units} at{" "}
                        {point.distanceM.toFixed(3)} m (shared/mixed fixed-corner — mesh-sensitive)
                      </title>
                    </rect>
                  ) : (
                    <g>
                      <line x1={x - 4.4} x2={x + 4.4} y1={y} y2={y} stroke={color} strokeWidth={1.4} />
                      <line x1={x} x2={x} y1={y - 4.4} y2={y + 4.4} stroke={color} strokeWidth={1.4} />
                      <title>
                        Node {point.nodeId}: {formatSampleValue(point.value)} {units} at{" "}
                        {point.distanceM.toFixed(3)} m
                      </title>
                    </g>
                  )}
                </g>
              );
            })
          : null}
        <text x={(innerLeft + innerRight) / 2} y={height - 6} fontSize={10.5} textAnchor="middle" fill="#11161d">
          {axisLabel}
        </text>
        <text
          x={14}
          y={(innerTop + innerBottom) / 2}
          fontSize={11}
          textAnchor="middle"
          fill="#11161d"
          transform={`rotate(-90 14 ${(innerTop + innerBottom) / 2})`}
        >
          {option.label} ({units})
        </text>
        {!hasData ? (
          <text
            x={(innerLeft + innerRight) / 2}
            y={(innerTop + innerBottom) / 2}
            fontSize={12}
            textAnchor="middle"
            fill="#5a6573"
            fontStyle="italic"
          >
            No reaction samples available for this support
          </text>
        ) : null}
      </svg>
      <p className="reaction-distribution-plot-legend field-note">
        <span
          className="reaction-distribution-plot-legend-marker reaction-distribution-plot-legend-marker-normal"
          aria-hidden="true"
        />
        node sample
        <span
          className="reaction-distribution-plot-legend-marker reaction-distribution-plot-legend-marker-shared"
          aria-hidden="true"
        />
        shared/mixed fixed-corner sample (mesh-sensitive){hasSharedCorner ? " — present on this support" : ""}
      </p>
    </figure>
  );
};
