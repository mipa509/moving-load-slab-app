import { runFixedAnalysis } from "./solverAdapter";
import { buildAutoRunSignature } from "./autoRun";
import type {
  EnvelopeData,
  EnvelopeField,
  EnvelopeFieldData,
  EnvelopeFieldMap,
  EnvelopePerNode,
  EnvelopeWorstStation,
  MomentField,
  NodalFieldMap,
  SlabModel,
  StagedSkewAppContract,
} from "./types";

export interface EnvelopeProgress {
  current: number;
  total: number;
  station: number;
}

type EnvelopeFieldV2 = StagedSkewAppContract.EnvelopeFieldV2;
type AnyNodalFieldData = NodalFieldMap[keyof NodalFieldMap];

const ENVELOPE_FIELDS_V2: EnvelopeFieldV2[] = ["deflection", "mx", "my", "mxy"];

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

interface PerFieldAccumV2 {
  units: string;
  max: Float64Array;
  min: Float64Array;
  xs: Float64Array;
  ys: Float64Array;
  ss: Float64Array;
  ts: Float64Array;
  nodeIds: Int32Array;
  nodeCount: number;
}

const initFieldAccum = (fieldData: AnyNodalFieldData): PerFieldAccumV2 => {
  const nodeCount = fieldData.points.length;
  const nodeIds = new Int32Array(nodeCount);
  const xs = new Float64Array(nodeCount);
  const ys = new Float64Array(nodeCount);
  const ss = new Float64Array(nodeCount);
  const ts = new Float64Array(nodeCount);
  const max = new Float64Array(nodeCount);
  const min = new Float64Array(nodeCount);
  for (let i = 0; i < nodeCount; i += 1) {
    const point = fieldData.points[i];
    nodeIds[i] = point.nodeId;
    xs[i] = point.xM;
    ys[i] = point.yM;
    ss[i] = point.sM;
    ts[i] = point.tM;
    max[i] = point.value;
    min[i] = point.value;
  }
  return { units: fieldData.units, max, min, xs, ys, ss, ts, nodeIds, nodeCount };
};

const updateFieldAccum = (accum: PerFieldAccumV2, fieldData: AnyNodalFieldData): void => {
  for (let i = 0; i < accum.nodeCount && i < fieldData.points.length; i += 1) {
    const v = fieldData.points[i].value;
    if (v > accum.max[i]) accum.max[i] = v;
    if (v < accum.min[i]) accum.min[i] = v;
  }
};

const buildFieldDataV2 = <F extends EnvelopeFieldV2, U extends "mm" | "kN*m/m">(
  field: F,
  accum: PerFieldAccumV2,
  units: U,
): StagedSkewAppContract.EnvelopeFieldDataV2<F, U> => {
  const points: StagedSkewAppContract.EnvelopePerNodeV2[] = new Array(accum.nodeCount);
  let dataMin = Infinity;
  let dataMax = -Infinity;
  for (let i = 0; i < accum.nodeCount; i += 1) {
    const max = accum.max[i];
    const min = accum.min[i];
    points[i] = {
      nodeId: accum.nodeIds[i],
      xM: accum.xs[i],
      yM: accum.ys[i],
      sM: accum.ss[i],
      tM: accum.ts[i],
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
    units,
  };
};

interface WorstAccumV2<F extends MomentField> {
  field: F;
  stationM: number;
  peakValue: number;
  peakAbs: number;
  nodeId: number;
}

const initWorstV2 = <F extends MomentField>(field: F): WorstAccumV2<F> => ({
  field,
  stationM: 0,
  peakValue: 0,
  peakAbs: -Infinity,
  nodeId: -1,
});

const updateWorstV2 = <F extends MomentField>(
  worst: WorstAccumV2<F>,
  fieldData: AnyNodalFieldData,
  stationM: number,
): void => {
  for (const point of fieldData.points) {
    const abs = Math.abs(point.value);
    if (abs > worst.peakAbs) {
      worst.peakAbs = abs;
      worst.peakValue = point.value;
      worst.stationM = stationM;
      worst.nodeId = point.nodeId;
    }
  }
};

const finalizeWorstV2 = <F extends MomentField>(
  worst: WorstAccumV2<F>,
): StagedSkewAppContract.EnvelopeWorstStationV2<F> => ({
  field: worst.field,
  stationM: worst.stationM,
  peakValue: Number.isFinite(worst.peakValue) ? worst.peakValue : 0,
  peakAbs: Number.isFinite(worst.peakAbs) ? worst.peakAbs : 0,
  nodeId: worst.nodeId,
  units: "kN*m/m",
});

/**
 * Pure mapper: derive the legacy (mx/my/deflection-only) EnvelopeData shape
 * from a StagedSkewAppContract.EnvelopeDataV2, for the existing
 * ReportNote/Viewport consumers of `results.envelope`. Drops mxy and the
 * `field`/`units` tags on the worst-station entries; everything else carries
 * through unchanged.
 */
export const toLegacyEnvelopeData = (
  v2: StagedSkewAppContract.EnvelopeDataV2,
): EnvelopeData => {
  const toLegacyField = <F extends EnvelopeField, U extends "mm" | "kN*m/m">(
    fieldData: StagedSkewAppContract.EnvelopeFieldDataV2<F, U>,
  ): EnvelopeFieldData => ({
    field: fieldData.field,
    points: fieldData.points.map(
      ({ nodeId, xM, yM, max, min }): EnvelopePerNode => ({
        nodeId,
        xM,
        yM,
        max,
        min,
      }),
    ),
    max: fieldData.max,
    min: fieldData.min,
    absMax: fieldData.absMax,
    units: fieldData.units,
  });

  const toLegacyWorst = <F extends MomentField>(
    worst: StagedSkewAppContract.EnvelopeWorstStationV2<F>,
  ): EnvelopeWorstStation => ({
    stationM: worst.stationM,
    peakValue: worst.peakValue,
    peakAbs: worst.peakAbs,
    nodeId: worst.nodeId,
  });

  return {
    stationsRun: v2.stationsRun,
    pathStartM: v2.pathStartM,
    pathEndM: v2.pathEndM,
    pathStepM: v2.pathStepM,
    travelDirection: v2.travelDirection,
    computedAtIso: v2.computedAtIso,
    signature: v2.signature,
    mx: toLegacyField(v2.fields.mx),
    my: toLegacyField(v2.fields.my),
    deflection: toLegacyField(v2.fields.deflection),
    worstStations: {
      mx: toLegacyWorst(v2.worstStations.mx),
      my: toLegacyWorst(v2.worstStations.my),
    },
  };
};

export const runPathEnvelope = async (
  baseModel: SlabModel,
  onProgress?: (progress: EnvelopeProgress) => void,
): Promise<StagedSkewAppContract.EnvelopeDataV2> => {
  const direction = baseModel.placement.travelDirection;
  const isXAxis = direction === "x+" || direction === "x-";
  const stations = enumerateStations(
    baseModel.placement.pathStartM,
    baseModel.placement.pathEndM,
    baseModel.placement.pathStepM,
  );
  const total = stations.length;
  const accum = new Map<EnvelopeFieldV2, PerFieldAccumV2>();
  const worstMx = initWorstV2("mx");
  const worstMy = initWorstV2("my");
  const worstMxy = initWorstV2("mxy");

  // Topology guard: per-index accumulation across stations is only valid if
  // every station's mesh produces the same node-id sequence. Record the
  // first station's sequence and assert every later station matches it.
  let topologyNodeIds: Int32Array | null = null;

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
    if (!stepResult.nodalFields) {
      throw new Error("Envelope station produced no nodal field data.");
    }
    const nodalFields = stepResult.nodalFields;

    const stationNodeIds = nodalFields.deflection.points.map((point) => point.nodeId);
    if (topologyNodeIds === null) {
      topologyNodeIds = Int32Array.from(stationNodeIds);
    } else {
      const sameLength = topologyNodeIds.length === stationNodeIds.length;
      const sameOrder =
        sameLength && stationNodeIds.every((id, idx) => id === topologyNodeIds![idx]);
      if (!sameOrder) {
        throw new Error(
          `Envelope station ${i + 1}/${total} produced a different mesh topology ` +
            "(node-id sequence changed) than the first station; per-node envelope " +
            "accumulation is invalid across a changing mesh.",
        );
      }
    }

    for (const field of ENVELOPE_FIELDS_V2) {
      const fieldData = nodalFields[field];
      const existing = accum.get(field);
      if (!existing) {
        accum.set(field, initFieldAccum(fieldData));
      } else {
        updateFieldAccum(existing, fieldData);
      }
    }

    updateWorstV2(worstMx, nodalFields.mx, station);
    updateWorstV2(worstMy, nodalFields.my, station);
    updateWorstV2(worstMxy, nodalFields.mxy, station);

    onProgress?.({ current: i + 1, total, station });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const deflectionAccum = accum.get("deflection");
  const mxAccum = accum.get("mx");
  const myAccum = accum.get("my");
  const mxyAccum = accum.get("mxy");
  if (!deflectionAccum || !mxAccum || !myAccum || !mxyAccum) {
    throw new Error("Envelope analysis did not produce nodal field data.");
  }

  const fields: EnvelopeFieldMap = {
    deflection: buildFieldDataV2("deflection", deflectionAccum, "mm"),
    mx: buildFieldDataV2("mx", mxAccum, "kN*m/m"),
    my: buildFieldDataV2("my", myAccum, "kN*m/m"),
    mxy: buildFieldDataV2("mxy", mxyAccum, "kN*m/m"),
  };

  return {
    stationsRun: total,
    pathStartM: baseModel.placement.pathStartM,
    pathEndM: baseModel.placement.pathEndM,
    pathStepM: baseModel.placement.pathStepM,
    travelDirection: direction,
    computedAtIso: new Date().toISOString(),
    signature: buildAutoRunSignature(baseModel),
    fields,
    worstStations: {
      mx: finalizeWorstV2(worstMx),
      my: finalizeWorstV2(worstMy),
      mxy: finalizeWorstV2(worstMxy),
    },
  };
};
