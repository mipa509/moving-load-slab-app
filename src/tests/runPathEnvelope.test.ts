import { describe, expect, it } from "vitest";
import { createDefaultModel } from "../app/defaults";
import { runPathEnvelope, toLegacyEnvelopeData } from "../app/runPathEnvelope";
import { runFixedAnalysis } from "../app/solverAdapter";

describe("runPathEnvelope", () => {
  it("envelope max ≥ single-position values at every node and runs all stations", async () => {
    const model = createDefaultModel();
    model.placement = {
      ...model.placement,
      pathStartM: 4,
      pathEndM: 6,
      pathStepM: 1,
      travelDirection: "x+",
    };

    const stationsCalled: number[] = [];
    const envelope = await runPathEnvelope(model, (progress) => {
      stationsCalled.push(progress.station);
    });

    expect(envelope.stationsRun).toBe(3);
    expect(stationsCalled).toHaveLength(3);
    expect(envelope.fields.mx.points.length).toBeGreaterThan(0);

    const single = await runFixedAnalysis({
      ...model,
      placement: { ...model.placement, centerXM: 5 },
    });
    expect(single.status).toBe("success");
    const singleByNode = new Map<number, number>();
    for (const point of single.nodalFields?.mx.points ?? []) {
      singleByNode.set(point.nodeId, point.value);
    }
    for (const point of envelope.fields.mx.points) {
      const baseline = singleByNode.get(point.nodeId);
      if (baseline === undefined) continue;
      expect(point.max).toBeGreaterThanOrEqual(baseline - 1e-6);
      expect(point.min).toBeLessThanOrEqual(baseline + 1e-6);
    }

    expect(envelope.fields.mx.absMax).toBeGreaterThan(0);
    expect(envelope.signature.length).toBeGreaterThan(0);
  }, 30_000);

  it("records worst Mxx/Myy stations within the sweep range", async () => {
    const model = createDefaultModel();
    model.placement = {
      ...model.placement,
      pathStartM: 3,
      pathEndM: 7,
      pathStepM: 1,
      travelDirection: "x+",
    };

    const envelope = await runPathEnvelope(model);

    const mxWorst = envelope.worstStations.mx;
    const myWorst = envelope.worstStations.my;

    expect(mxWorst.stationM).toBeGreaterThanOrEqual(3);
    expect(mxWorst.stationM).toBeLessThanOrEqual(7);
    expect(myWorst.stationM).toBeGreaterThanOrEqual(3);
    expect(myWorst.stationM).toBeLessThanOrEqual(7);

    expect(mxWorst.peakAbs).toBeGreaterThan(0);
    expect(myWorst.peakAbs).toBeGreaterThan(0);
    expect(Math.abs(mxWorst.peakValue)).toBeCloseTo(mxWorst.peakAbs, 6);
    expect(Math.abs(myWorst.peakValue)).toBeCloseTo(myWorst.peakAbs, 6);

    // The worst |Mxx| seen at the worst station must be >= the field's overall absMax-ε
    // (it should equal it, but allow tiny FP slack).
    expect(mxWorst.peakAbs).toBeGreaterThanOrEqual(envelope.fields.mx.absMax - 1e-6);
    expect(myWorst.peakAbs).toBeGreaterThanOrEqual(envelope.fields.my.absMax - 1e-6);
  }, 30_000);

  it("envelopes mxy (worst twist) alongside mx/my/deflection", async () => {
    const model = createDefaultModel();
    model.placement = {
      ...model.placement,
      pathStartM: 3,
      pathEndM: 7,
      pathStepM: 1,
      travelDirection: "x+",
    };

    const envelope = await runPathEnvelope(model);

    expect(envelope.fields.mxy).toBeDefined();
    expect(envelope.fields.mxy.field).toBe("mxy");
    expect(envelope.fields.mxy.units).toBe("kN*m/m");
    expect(envelope.fields.mxy.points.length).toBeGreaterThan(0);
    for (const point of envelope.fields.mxy.points) {
      expect(Number.isFinite(point.max)).toBe(true);
      expect(Number.isFinite(point.min)).toBe(true);
    }

    const mxyWorst = envelope.worstStations.mxy;
    expect(mxyWorst.field).toBe("mxy");
    expect(mxyWorst.units).toBe("kN*m/m");
    expect(mxyWorst.nodeId).toBeGreaterThanOrEqual(0);
    expect(mxyWorst.stationM).toBeGreaterThanOrEqual(3);
    expect(mxyWorst.stationM).toBeLessThanOrEqual(7);
    expect(mxyWorst.peakAbs).toBeGreaterThanOrEqual(envelope.fields.mxy.absMax - 1e-6);
  }, 30_000);

  it("carries finite deck-local sM/tM on every enveloped node", async () => {
    const model = createDefaultModel();
    model.placement = {
      ...model.placement,
      pathStartM: 4,
      pathEndM: 6,
      pathStepM: 1,
      travelDirection: "x+",
    };

    const envelope = await runPathEnvelope(model);

    for (const field of [
      envelope.fields.deflection,
      envelope.fields.mx,
      envelope.fields.my,
      envelope.fields.mxy,
    ]) {
      expect(field.points.length).toBeGreaterThan(0);
      for (const point of field.points) {
        expect(Number.isFinite(point.sM)).toBe(true);
        expect(Number.isFinite(point.tM)).toBe(true);
      }
    }
  }, 30_000);

  it("re-solving at the worst-Mx station reproduces the envelope's worst-Mx peak", async () => {
    const model = createDefaultModel();
    model.placement = {
      ...model.placement,
      pathStartM: 3,
      pathEndM: 7,
      pathStepM: 1,
      travelDirection: "x+",
    };

    const envelope = await runPathEnvelope(model);
    const mxWorst = envelope.worstStations.mx;

    const single = await runFixedAnalysis({
      ...model,
      placement: { ...model.placement, centerXM: mxWorst.stationM },
    });
    expect(single.status).toBe("success");

    const peakAbsAtStation = (single.nodalFields?.mx.points ?? []).reduce(
      (max, point) => Math.max(max, Math.abs(point.value)),
      0,
    );

    expect(peakAbsAtStation).toBeCloseTo(mxWorst.peakAbs, 6);
  }, 30_000);

  it("toLegacyEnvelopeData maps mx/my/deflection and worst mx/my, omitting mxy", async () => {
    const model = createDefaultModel();
    model.placement = {
      ...model.placement,
      pathStartM: 3,
      pathEndM: 7,
      pathStepM: 1,
      travelDirection: "x+",
    };

    const envelope = await runPathEnvelope(model);
    const legacy = toLegacyEnvelopeData(envelope);

    expect(legacy.stationsRun).toBe(envelope.stationsRun);
    expect(legacy.pathStartM).toBe(envelope.pathStartM);
    expect(legacy.pathEndM).toBe(envelope.pathEndM);
    expect(legacy.pathStepM).toBe(envelope.pathStepM);
    expect(legacy.travelDirection).toBe(envelope.travelDirection);
    expect(legacy.computedAtIso).toBe(envelope.computedAtIso);
    expect(legacy.signature).toBe(envelope.signature);

    expect(legacy.mx.field).toBe("mx");
    expect(legacy.mx.units).toBe(envelope.fields.mx.units);
    expect(legacy.mx.max).toBe(envelope.fields.mx.max);
    expect(legacy.mx.min).toBe(envelope.fields.mx.min);
    expect(legacy.mx.absMax).toBe(envelope.fields.mx.absMax);
    expect(legacy.mx.points.length).toBe(envelope.fields.mx.points.length);
    expect(legacy.mx.points[0]).toEqual({
      nodeId: envelope.fields.mx.points[0].nodeId,
      xM: envelope.fields.mx.points[0].xM,
      yM: envelope.fields.mx.points[0].yM,
      max: envelope.fields.mx.points[0].max,
      min: envelope.fields.mx.points[0].min,
    });
    expect((legacy.mx.points[0] as { sM?: number }).sM).toBeUndefined();

    expect(legacy.my.field).toBe("my");
    expect(legacy.deflection.field).toBe("deflection");

    expect(legacy.worstStations.mx).toEqual({
      stationM: envelope.worstStations.mx.stationM,
      peakValue: envelope.worstStations.mx.peakValue,
      peakAbs: envelope.worstStations.mx.peakAbs,
      nodeId: envelope.worstStations.mx.nodeId,
    });
    expect(legacy.worstStations.my).toEqual({
      stationM: envelope.worstStations.my.stationM,
      peakValue: envelope.worstStations.my.peakValue,
      peakAbs: envelope.worstStations.my.peakAbs,
      nodeId: envelope.worstStations.my.nodeId,
    });

    expect((legacy.worstStations as { mxy?: unknown }).mxy).toBeUndefined();
    expect((legacy as { fields?: unknown }).fields).toBeUndefined();
  }, 30_000);
});
