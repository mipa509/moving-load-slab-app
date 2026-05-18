import { describe, expect, it } from "vitest";
import { createDefaultModel } from "../app/defaults";
import { runPathEnvelope } from "../app/runPathEnvelope";
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
    expect(envelope.mx.points.length).toBeGreaterThan(0);

    const single = await runFixedAnalysis({
      ...model,
      placement: { ...model.placement, centerXM: 5 },
    });
    expect(single.status).toBe("success");
    const singleByNode = new Map<number, number>();
    for (const point of single.nodalContours.mx?.points ?? []) {
      singleByNode.set(point.nodeId, point.value);
    }
    for (const point of envelope.mx.points) {
      const baseline = singleByNode.get(point.nodeId);
      if (baseline === undefined) continue;
      expect(point.max).toBeGreaterThanOrEqual(baseline - 1e-6);
      expect(point.min).toBeLessThanOrEqual(baseline + 1e-6);
    }

    expect(envelope.mx.absMax).toBeGreaterThan(0);
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
    expect(mxWorst.peakAbs).toBeGreaterThanOrEqual(envelope.mx.absMax - 1e-6);
    expect(myWorst.peakAbs).toBeGreaterThanOrEqual(envelope.my.absMax - 1e-6);
  }, 30_000);
});
