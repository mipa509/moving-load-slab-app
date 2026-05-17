import { runFixedAnalysis } from "./solverAdapter";
import { buildAutoRunSignature } from "./autoRun";
import type {
  AnalysisResults,
  EnvelopeData,
  EnvelopeField,
  EnvelopeFieldData,
  EnvelopePerNode,
  SlabModel,
} from "./types";

export interface EnvelopeProgress {
  current: number;
  total: number;
  station: number;
}

const ENVELOPE_FIELDS: EnvelopeField[] = ["mx", "my", "deflection"];

const enumerateStations = (start: number, end: number, step: number): number[] => {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const safeStep = Math.max(Math.abs(step), 1e-6);
  const span = hi - lo;
  if (span <= 1e-9) {
    return [lo];
  }
  const count = Math.max(1, Math.floor(span / safeStep + 1e-9)) + 1;
  const stations: number[] = [];
  for (let i = 0; i < count; i += 1) {
    stations.push(lo + Math.min(span, i * safeStep));
  }
  // Ensure final station equals hi exactly even with rounding drift.
  stations[stations.length - 1] = hi;
  return stations;
};

interface PerFieldAccum {
  units: string;
  max: Float64Array;
  min: Float64Array;
  xs: Float64Array;
  ys: Float64Array;
  nodeIds: Int32Array;
  initialized: boolean;
  nodeCount: number;
}

const ensureField = (
  accum: Map<EnvelopeField, PerFieldAccum>,
  field: EnvelopeField,
  contour: AnalysisResults["nodalContours"]["mx"],
) => {
  if (!contour) return;
  const existing = accum.get(field);
  if (existing && existing.initialized) {
    return;
  }
  const nodeCount = contour.points.length;
  const nodeIds = new Int32Array(nodeCount);
  const xs = new Float64Array(nodeCount);
  const ys = new Float64Array(nodeCount);
  const max = new Float64Array(nodeCount);
  const min = new Float64Array(nodeCount);
  for (let i = 0; i < nodeCount; i += 1) {
    const point = contour.points[i];
    nodeIds[i] = point.nodeId;
    xs[i] = point.xM;
    ys[i] = point.yM;
    max[i] = point.value;
    min[i] = point.value;
  }
  accum.set(field, {
    units: contour.units,
    max,
    min,
    xs,
    ys,
    nodeIds,
    nodeCount,
    initialized: true,
  });
};

const updateField = (
  accum: PerFieldAccum,
  contour: AnalysisResults["nodalContours"]["mx"],
) => {
  if (!contour) return;
  for (let i = 0; i < accum.nodeCount && i < contour.points.length; i += 1) {
    const v = contour.points[i].value;
    if (v > accum.max[i]) accum.max[i] = v;
    if (v < accum.min[i]) accum.min[i] = v;
  }
};

const buildFieldData = (
  field: EnvelopeField,
  accum: PerFieldAccum,
): EnvelopeFieldData => {
  const points: EnvelopePerNode[] = new Array(accum.nodeCount);
  let dataMin = Infinity;
  let dataMax = -Infinity;
  for (let i = 0; i < accum.nodeCount; i += 1) {
    const max = accum.max[i];
    const min = accum.min[i];
    points[i] = {
      nodeId: accum.nodeIds[i],
      xM: accum.xs[i],
      yM: accum.ys[i],
      max,
      min,
    };
    if (max > dataMax) dataMax = max;
    if (min < dataMin) dataMin = min;
  }
  if (!Number.isFinite(dataMax)) dataMax = 0;
  if (!Number.isFinite(dataMin)) dataMin = 0;
  return {
    field,
    points,
    max: dataMax,
    min: dataMin,
    absMax: Math.max(Math.abs(dataMax), Math.abs(dataMin)),
    units: accum.units,
  };
};

export const runPathEnvelope = async (
  baseModel: SlabModel,
  onProgress?: (progress: EnvelopeProgress) => void,
): Promise<EnvelopeData> => {
  const direction = baseModel.placement.travelDirection;
  const isXAxis = direction === "x+" || direction === "x-";
  const stations = enumerateStations(
    baseModel.placement.pathStartM,
    baseModel.placement.pathEndM,
    baseModel.placement.pathStepM,
  );
  const total = stations.length;
  const accum = new Map<EnvelopeField, PerFieldAccum>();

  for (let i = 0; i < total; i += 1) {
    const station = stations[i];
    const stationModel: SlabModel = {
      ...baseModel,
      placement: {
        ...baseModel.placement,
        ...(isXAxis ? { centerXM: station } : { centerYM: station }),
      },
    };
    const stepResult = await runFixedAnalysis(stationModel);
    if (stepResult.status !== "success") {
      throw new Error(
        stepResult.error ?? `Envelope station ${i + 1}/${total} failed to solve.`,
      );
    }
    for (const field of ENVELOPE_FIELDS) {
      const contour = stepResult.nodalContours[field];
      if (!contour) continue;
      ensureField(accum, field, contour);
      const accumField = accum.get(field);
      if (accumField) {
        updateField(accumField, contour);
      }
    }
    onProgress?.({ current: i + 1, total, station });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const mxAccum = accum.get("mx");
  const myAccum = accum.get("my");
  const deflectionAccum = accum.get("deflection");
  if (!mxAccum || !myAccum || !deflectionAccum) {
    throw new Error("Envelope analysis did not produce nodal contour data.");
  }

  return {
    stationsRun: total,
    pathStartM: baseModel.placement.pathStartM,
    pathEndM: baseModel.placement.pathEndM,
    pathStepM: baseModel.placement.pathStepM,
    travelDirection: direction,
    computedAtIso: new Date().toISOString(),
    signature: buildAutoRunSignature(baseModel),
    mx: buildFieldData("mx", mxAccum),
    my: buildFieldData("my", myAccum),
    deflection: buildFieldData("deflection", deflectionAccum),
  };
};
