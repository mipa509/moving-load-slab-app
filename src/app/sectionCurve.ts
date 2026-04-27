import type {
  EnvelopeFieldData,
  EnvelopePerNode,
  NodalContourData,
  TravelDirection,
} from "./types";

export type SectionAxis = "x" | "y";

export interface SectionSample {
  distanceM: number;
  value: number;
}

export interface SectionCurve {
  axis: SectionAxis;
  centerPerpM: number;
  widthM: number;
  samples: SectionSample[];
  min: number;
  max: number;
  units: string;
}

export const resolveSectionAxis = (
  travelDirection: TravelDirection,
  override: "auto" | "x" | "y",
): SectionAxis => {
  if (override === "x" || override === "y") {
    return override;
  }
  return travelDirection === "x+" || travelDirection === "x-" ? "x" : "y";
};

const roundCoord = (value: number) => Math.round(value * 1e4) / 1e4;

interface PointLike {
  xM: number;
  yM: number;
}

interface ValueExtractor<T extends PointLike> {
  (point: T): number;
}

const buildSamples = <T extends PointLike>(
  points: readonly T[],
  axis: SectionAxis,
  centerPerpM: number,
  widthM: number,
  pickValue: ValueExtractor<T>,
): SectionSample[] => {
  const halfW = widthM / 2;
  const buckets = new Map<number, { sum: number; count: number }>();
  for (const point of points) {
    const longCoord = axis === "x" ? point.xM : point.yM;
    const perpCoord = axis === "x" ? point.yM : point.xM;
    if (Math.abs(perpCoord - centerPerpM) > halfW + 1e-9) {
      continue;
    }
    const key = roundCoord(longCoord);
    const bucket = buckets.get(key) ?? { sum: 0, count: 0 };
    bucket.sum += pickValue(point);
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([distanceM, bucket]) => ({
      distanceM,
      value: bucket.sum / bucket.count,
    }));
};

const buildExtents = (samples: SectionSample[]): { min: number; max: number } => {
  if (samples.length === 0) {
    return { min: 0, max: 0 };
  }
  let min = samples[0].value;
  let max = samples[0].value;
  for (let i = 1; i < samples.length; i += 1) {
    const v = samples[i].value;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
};

export const computeSectionCurve = (
  contour: NodalContourData,
  axis: SectionAxis,
  centerPerpM: number,
  widthM: number,
): SectionCurve => {
  const samples = buildSamples(
    contour.points,
    axis,
    centerPerpM,
    widthM,
    (p) => p.value,
  );
  const { min, max } = buildExtents(samples);
  return {
    axis,
    centerPerpM,
    widthM,
    samples,
    min,
    max,
    units: contour.units,
  };
};

export const computeEnvelopeSectionCurves = (
  field: EnvelopeFieldData,
  axis: SectionAxis,
  centerPerpM: number,
  widthM: number,
): { max: SectionCurve; min: SectionCurve } => {
  const maxSamples = buildSamples<EnvelopePerNode>(
    field.points,
    axis,
    centerPerpM,
    widthM,
    (p) => p.max,
  );
  const minSamples = buildSamples<EnvelopePerNode>(
    field.points,
    axis,
    centerPerpM,
    widthM,
    (p) => p.min,
  );
  return {
    max: {
      axis,
      centerPerpM,
      widthM,
      samples: maxSamples,
      ...buildExtents(maxSamples),
      units: field.units,
    },
    min: {
      axis,
      centerPerpM,
      widthM,
      samples: minSamples,
      ...buildExtents(minSamples),
      units: field.units,
    },
  };
};
