import { useMemo } from "react";
import type { SectionCurve } from "../app/sectionCurve";

interface SectionPlotProps {
  current: SectionCurve | null;
  envelopeMax?: SectionCurve | null;
  envelopeMin?: SectionCurve | null;
  axisLabel: string;
  valueUnits: string;
  valueLabel: string;
  title?: string;
  subtitle?: string;
  width?: number;
  height?: number;
  className?: string;
}

const PADDING = { top: 18, right: 18, bottom: 36, left: 56 };
const MAJOR_TICK_COUNT = 8;
const MINOR_PER_MAJOR = 5;

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

const formatValue = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  const absV = Math.abs(value);
  if (absV >= 100) return value.toFixed(1);
  if (absV >= 10) return value.toFixed(2);
  return value.toFixed(3);
};

interface PeakSample {
  distanceM: number;
  value: number;
}

const findPeak = (
  samples: { distanceM: number; value: number }[],
  mode: "max" | "min",
): PeakSample | null => {
  if (samples.length === 0) return null;
  let best = samples[0];
  for (let i = 1; i < samples.length; i += 1) {
    const candidate = samples[i];
    if (mode === "max" ? candidate.value > best.value : candidate.value < best.value) {
      best = candidate;
    }
  }
  return best;
};

interface CurveScale {
  toX: (distanceM: number) => number;
  toY: (value: number) => number;
}

const buildScale = (
  curves: SectionCurve[],
  width: number,
  height: number,
): CurveScale | null => {
  const samples = curves.flatMap((c) => c.samples);
  if (samples.length === 0) return null;
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const sample of samples) {
    if (sample.distanceM < xMin) xMin = sample.distanceM;
    if (sample.distanceM > xMax) xMax = sample.distanceM;
    if (sample.value < yMin) yMin = sample.value;
    if (sample.value > yMax) yMax = sample.value;
  }
  // Pad y-extent by 6% so curves don't touch borders. Always include 0.
  const spanY = Math.max(yMax - yMin, 1e-6);
  const padY = spanY * 0.08;
  let yLo = Math.min(yMin - padY, 0);
  let yHi = Math.max(yMax + padY, 0);
  if (yHi - yLo < 1e-9) {
    yLo -= 1;
    yHi += 1;
  }
  const innerWidth = width - PADDING.left - PADDING.right;
  const innerHeight = height - PADDING.top - PADDING.bottom;
  const xSpan = Math.max(xMax - xMin, 1e-6);
  const ySpan = yHi - yLo;
  // Structural engineering convention: positive (sagging) below, negative (hogging) above.
  // The plot axis is therefore inverted: smallest value (most negative) at the top,
  // largest value (most positive) at the bottom.
  return {
    toX: (distance: number) =>
      PADDING.left + ((distance - xMin) / xSpan) * innerWidth,
    toY: (value: number) => PADDING.top + ((value - yLo) / ySpan) * innerHeight,
  };
};

const polylinePath = (
  curve: SectionCurve,
  scale: CurveScale,
): string =>
  curve.samples
    .map((sample, i) => {
      const cmd = i === 0 ? "M" : "L";
      return `${cmd}${scale.toX(sample.distanceM).toFixed(2)},${scale
        .toY(sample.value)
        .toFixed(2)}`;
    })
    .join(" ");

const envelopeAreaPath = (
  upper: SectionCurve,
  lower: SectionCurve,
  scale: CurveScale,
): string => {
  if (upper.samples.length === 0 || lower.samples.length === 0) return "";
  const top = upper.samples
    .map((s, i) => {
      const cmd = i === 0 ? "M" : "L";
      return `${cmd}${scale.toX(s.distanceM).toFixed(2)},${scale
        .toY(s.value)
        .toFixed(2)}`;
    })
    .join(" ");
  const bottom = [...lower.samples]
    .reverse()
    .map((s) => `L${scale.toX(s.distanceM).toFixed(2)},${scale
      .toY(s.value)
      .toFixed(2)}`)
    .join(" ");
  return `${top} ${bottom} Z`;
};

export const SectionPlot = ({
  current,
  envelopeMax,
  envelopeMin,
  axisLabel,
  valueUnits,
  valueLabel,
  title,
  subtitle,
  width = 520,
  height = 240,
  className,
}: SectionPlotProps) => {
  const curves = useMemo(
    () => [current, envelopeMax, envelopeMin].filter((c): c is SectionCurve => Boolean(c)),
    [current, envelopeMax, envelopeMin],
  );
  const hasData = curves.some((c) => c.samples.length > 0);
  const scale = useMemo(
    () => (hasData ? buildScale(curves, width, height) : null),
    [curves, hasData, width, height],
  );

  const xRange = useMemo(() => {
    if (curves.length === 0) return { min: 0, max: 1 };
    const allXs = curves.flatMap((c) => c.samples.map((s) => s.distanceM));
    if (allXs.length === 0) return { min: 0, max: 1 };
    return { min: Math.min(...allXs), max: Math.max(...allXs) };
  }, [curves]);

  const yRange = useMemo(() => {
    if (curves.length === 0) return { min: 0, max: 1 };
    const allYs = curves.flatMap((c) => c.samples.map((s) => s.value));
    if (allYs.length === 0) return { min: 0, max: 1 };
    const min = Math.min(0, ...allYs);
    const max = Math.max(0, ...allYs);
    return { min, max };
  }, [curves]);

  const xStep = useMemo(
    () => computeTickStep(xRange.min, xRange.max, MAJOR_TICK_COUNT),
    [xRange],
  );
  const yStep = useMemo(
    () => computeTickStep(yRange.min, yRange.max, MAJOR_TICK_COUNT),
    [yRange],
  );
  const xMajorTicks = useMemo(
    () => niceTicks(xRange.min, xRange.max, MAJOR_TICK_COUNT),
    [xRange],
  );
  const yMajorTicks = useMemo(
    () => niceTicks(yRange.min, yRange.max, MAJOR_TICK_COUNT),
    [yRange],
  );
  const xMinorTicks = useMemo(
    () => enumerateTicks(xRange.min, xRange.max, xStep.minor),
    [xRange, xStep.minor],
  );
  const yMinorTicks = useMemo(
    () => enumerateTicks(yRange.min, yRange.max, yStep.minor),
    [yRange, yStep.minor],
  );
  const xSpan = xRange.max - xRange.min;
  const ySpan = yRange.max - yRange.min;
  const isMajor = (value: number, majors: number[]) =>
    majors.some((m) => Math.abs(m - value) < 1e-6);

  const innerLeft = PADDING.left;
  const innerRight = width - PADDING.right;
  const innerTop = PADDING.top;
  const innerBottom = height - PADDING.bottom;

  return (
    <figure className={`section-plot${className ? ` ${className}` : ""}`}>
      {title || subtitle ? (
        <figcaption className="section-plot-caption">
          {title ? <strong>{title}</strong> : null}
          {subtitle ? <span>{subtitle}</span> : null}
        </figcaption>
      ) : null}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="section-plot-svg"
        role="img"
        aria-label={title ?? "Section plot"}
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
                key={`xtm-${tick}`}
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
                key={`ytm-${tick}`}
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
              <g key={`xt-${tick}`}>
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
                <text
                  x={x}
                  y={innerBottom + 14}
                  fontSize={10}
                  textAnchor="middle"
                  fill="#11161d"
                >
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
              <g key={`yt-${tick}`}>
                <line
                  x1={innerLeft}
                  x2={innerRight}
                  y1={y}
                  y2={y}
                  stroke="#cad2dc"
                  strokeWidth={0.5}
                />
                <line
                  x1={innerLeft - 4}
                  x2={innerLeft}
                  y1={y}
                  y2={y}
                  stroke="#11161d"
                  strokeWidth={0.6}
                />
                <text
                  x={innerLeft - 6}
                  y={y + 3}
                  fontSize={10}
                  textAnchor="end"
                  fill="#11161d"
                >
                  {formatTick(tick, ySpan)}
                </text>
              </g>
            );
          })}
        {scale && yRange.min <= 0 && yRange.max >= 0 ? (
          <line
            x1={innerLeft}
            x2={innerRight}
            y1={scale.toY(0)}
            y2={scale.toY(0)}
            stroke="#11161d"
            strokeWidth={0.8}
          />
        ) : null}
        {scale && envelopeMax && envelopeMin ? (
          <path
            d={envelopeAreaPath(envelopeMax, envelopeMin, scale)}
            fill="#e85d2c"
            fillOpacity={0.18}
            stroke="none"
          />
        ) : null}
        {scale && envelopeMax && envelopeMax.samples.length > 0 ? (
          <path
            d={polylinePath(envelopeMax, scale)}
            fill="none"
            stroke="#b04a3a"
            strokeWidth={1.1}
            strokeDasharray="4 3"
          />
        ) : null}
        {scale && envelopeMin && envelopeMin.samples.length > 0 ? (
          <path
            d={polylinePath(envelopeMin, scale)}
            fill="none"
            stroke="#23507a"
            strokeWidth={1.1}
            strokeDasharray="4 3"
          />
        ) : null}
        {scale && current && current.samples.length > 0 ? (
          <path
            d={polylinePath(current, scale)}
            fill="none"
            stroke="#11161d"
            strokeWidth={1.6}
          />
        ) : null}
        {scale && current && current.samples.length > 0
          ? (() => {
              const peakMax = findPeak(current.samples, "max");
              const peakMin = findPeak(current.samples, "min");
              const labels: JSX.Element[] = [];
              const drawMarker = (
                peak: PeakSample,
                color: string,
                anchor: "max" | "min",
                key: string,
              ) => {
                const x = scale.toX(peak.distanceM);
                const y = scale.toY(peak.value);
                // Position label above the peak when sagging-positive (which renders below
                // the zero line) and below the peak otherwise. With the inverted y-axis,
                // "above the peak" means lower y in SVG.
                const dy = anchor === "max" ? 14 : -8;
                const labelY = y + dy;
                const labelText = `${anchor === "max" ? "max" : "min"} ${formatValue(peak.value)} @ ${peak.distanceM.toFixed(2)} m`;
                const textWidth = Math.max(64, labelText.length * 5.4);
                const clampedX = Math.min(
                  Math.max(x, innerLeft + textWidth / 2 + 2),
                  innerRight - textWidth / 2 - 2,
                );
                labels.push(
                  <g key={key}>
                    <line
                      x1={x}
                      x2={x}
                      y1={scale.toY(0)}
                      y2={y}
                      stroke={color}
                      strokeWidth={0.6}
                      strokeDasharray="2 2"
                    />
                    <circle cx={x} cy={y} r={3} fill={color} stroke="#ffffff" strokeWidth={0.8} />
                    <rect
                      x={clampedX - textWidth / 2}
                      y={labelY - 9}
                      width={textWidth}
                      height={13}
                      fill="#ffffff"
                      stroke={color}
                      strokeWidth={0.5}
                      rx={2}
                    />
                    <text
                      x={clampedX}
                      y={labelY + 1}
                      fontSize={9.5}
                      fontWeight={600}
                      textAnchor="middle"
                      fill={color}
                    >
                      {labelText}
                    </text>
                  </g>,
                );
              };
              if (peakMax && peakMax.value > 0) drawMarker(peakMax, "#b04a3a", "max", "peak-max");
              if (peakMin && peakMin.value < 0) drawMarker(peakMin, "#23507a", "min", "peak-min");
              if (
                peakMax &&
                peakMax.value <= 0 &&
                peakMin &&
                peakMin.value < 0 &&
                peakMax !== peakMin
              ) {
                drawMarker(peakMax, "#b04a3a", "max", "peak-max-neg");
              }
              if (
                peakMin &&
                peakMin.value >= 0 &&
                peakMax &&
                peakMax.value > 0 &&
                peakMax !== peakMin
              ) {
                drawMarker(peakMin, "#23507a", "min", "peak-min-pos");
              }
              return <>{labels}</>;
            })()
          : null}
        <text
          x={(innerLeft + innerRight) / 2}
          y={height - 6}
          fontSize={11}
          textAnchor="middle"
          fill="#11161d"
        >
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
          {valueLabel} ({valueUnits})
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
            No nodes in section band
          </text>
        ) : null}
      </svg>
    </figure>
  );
};
