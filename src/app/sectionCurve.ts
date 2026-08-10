import type {
  EnvelopeFieldData,
  EnvelopePerNode,
  NodalContourData,
  TravelDirection,
} from "./types";

// WP-033 additions below use the app-level deck-local section contract from
// "./types". That module already exports its own `SectionCurve`/`SectionSample`
// names which collide with the local ones declared just above in this file
// (used by the legacy global-bucket engine); the app-level ones are imported
// under aliases (`DeckSectionCurve`/`DeckSectionSample`) and referred to only
// through those aliases below. Do not rename the pre-existing local types.
import type {
  DeckSectionSettings,
  EmptySectionCurve,
  NodalFieldMap,
  PopulatedSectionCurve,
  SectionCurve as DeckSectionCurve,
  SectionOrdinate,
  SectionSample as DeckSectionSample,
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

// ---------------------------------------------------------------------------
// WP-033: deck-local (s/t) section engine — ADDITIVE.
//
// Everything above buckets by rounded GLOBAL x/y and is retained UNCHANGED for
// its existing consumers (ReportNote, Viewport, SectionPlot). The engine below
// instead cuts sections in the DECK-LOCAL (s, t) frame carried on
// `NodalFieldPoint`: `s` is the longitudinal station measured between the
// skew end lines and `t` is the transverse offset from the deck centreline.
// Because s/t are defined relative to the deck's own skew geometry (not
// global x/y), a given station always identifies the same physical cut
// regardless of the plan-skew angle — this is the skew-robust replacement
// path; it does not alter or replace the global-bucket engine above.
// ---------------------------------------------------------------------------

/** Tolerance (m) applied to the strip half-width comparison, to absorb
 * floating-point noise when a point sits exactly on the strip boundary. */
const DECK_SECTION_TOL_M = 1e-9;

/** Rounds a deck-local station coordinate so that repeated stations coming
 * out of a structured mesh (which should coincide exactly) coalesce into one
 * bucket even in the presence of tiny floating-point drift. Mirrors the
 * `roundCoord` policy used by the legacy global-bucket engine above, but at a
 * finer resolution (1e-6 m) appropriate to deck-local s/t coordinates. */
const roundStation = (value: number) => Math.round(value * 1e6) / 1e6;

interface DeckLocalPointLike {
  sM: number;
  tM: number;
}

interface DeckSectionCoreOptions {
  ordinate: SectionOrdinate;
  mode: "longitudinal" | "transverse";
  stationAxis: "s" | "t";
  centerM: number;
  widthM: number;
}

const emptyDeckSectionCurve = (opts: DeckSectionCoreOptions): EmptySectionCurve => {
  const modeAxis =
    opts.mode === "longitudinal"
      ? ({ mode: "longitudinal", stationAxis: "s" } as const)
      : ({ mode: "transverse", stationAxis: "t" } as const);
  return {
    ordinate: opts.ordinate,
    coordinateFrame: "deck-local",
    requestedCenterM: opts.centerM,
    requestedWidthM: opts.widthM,
    averaging: "piecewise-linear-width-average",
    units: "kN*m/m",
    ...modeAxis,
    state: "empty",
    actualStripMinM: null,
    actualStripMaxM: null,
    samples: [],
    min: null,
    max: null,
  };
};

/**
 * Private, reusable core of the deck-local section engine: selects the
 * points whose perpendicular (off-station) coordinate falls within the
 * requested strip, then width-averages the picked value per coalesced
 * station. Generic over the point type and value picker so the same logic
 * can be reused for envelope nodal points (min/max per node) in a later
 * packet (WP-035/WP-041A) without duplicating the selection/averaging
 * arithmetic — only `computeDeckSection` is exported for now.
 */
function sectionFromNodalPoints<T extends DeckLocalPointLike>(
  points: readonly T[],
  pickValue: (point: T) => number,
  opts: DeckSectionCoreOptions,
): DeckSectionCurve {
  const halfWidthM = opts.widthM / 2;
  const tolHalfWidthM = halfWidthM + DECK_SECTION_TOL_M;

  const selected: { stationM: number; perpM: number; value: number }[] = [];
  for (const point of points) {
    const stationM = opts.stationAxis === "s" ? point.sM : point.tM;
    const perpM = opts.stationAxis === "s" ? point.tM : point.sM;
    if (Math.abs(perpM - opts.centerM) <= tolHalfWidthM) {
      selected.push({ stationM, perpM, value: pickValue(point) });
    }
  }

  if (selected.length === 0) {
    return emptyDeckSectionCurve(opts);
  }

  const buckets = new Map<number, { sum: number; count: number }>();
  let actualStripMinM = selected[0].perpM;
  let actualStripMaxM = selected[0].perpM;
  for (const point of selected) {
    if (point.perpM < actualStripMinM) actualStripMinM = point.perpM;
    if (point.perpM > actualStripMaxM) actualStripMaxM = point.perpM;
    const key = roundStation(point.stationM);
    const bucket = buckets.get(key) ?? { sum: 0, count: 0 };
    bucket.sum += point.value;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const sampleList = Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([stationM, bucket]) => ({ stationM, value: bucket.sum / bucket.count }));
  // `buckets` is non-empty because `selected` is non-empty (each selected
  // point contributes to exactly one bucket), so this cast to the
  // app-level non-empty-tuple shape is sound.
  const samples = sampleList as [DeckSectionSample, ...DeckSectionSample[]];

  let min = samples[0].value;
  let max = samples[0].value;
  for (let i = 1; i < samples.length; i += 1) {
    const v = samples[i].value;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const modeAxis =
    opts.mode === "longitudinal"
      ? ({ mode: "longitudinal", stationAxis: "s" } as const)
      : ({ mode: "transverse", stationAxis: "t" } as const);

  const populated: PopulatedSectionCurve = {
    ordinate: opts.ordinate,
    coordinateFrame: "deck-local",
    requestedCenterM: opts.centerM,
    requestedWidthM: opts.widthM,
    averaging: "piecewise-linear-width-average",
    units: "kN*m/m",
    ...modeAxis,
    state: "populated",
    actualStripMinM,
    actualStripMaxM,
    samples,
    min,
    max,
  };
  return populated;
}

/**
 * Deck-local (s/t) section cut through a nodal result field (WP-033).
 *
 * For `mode: 'longitudinal'`, the station axis is `s` (running along the
 * deck between the skew end lines) and the strip is centred on `t =
 * centerTM`. For `mode: 'transverse'`, the station axis is `t` and the strip
 * is centred on `s = centerSM`. Points within `widthM / 2` (plus a small
 * floating-point tolerance) of the strip centre are width-averaged per
 * coalesced station. Pure and total: an out-of-range or empty selection
 * yields an `EmptySectionCurve` rather than throwing.
 */
export function computeDeckSection(
  nodalFields: NodalFieldMap,
  settings: DeckSectionSettings,
): DeckSectionCurve {
  const points = nodalFields[settings.ordinate].points;
  if (settings.mode === "longitudinal") {
    return sectionFromNodalPoints(points, (point) => point.value, {
      ordinate: settings.ordinate,
      mode: "longitudinal",
      stationAxis: "s",
      centerM: settings.centerTM,
      widthM: settings.widthM,
    });
  }
  return sectionFromNodalPoints(points, (point) => point.value, {
    ordinate: settings.ordinate,
    mode: "transverse",
    stationAxis: "t",
    centerM: settings.centerSM,
    widthM: settings.widthM,
  });
}
