import { describe, expect, it } from "vitest";
import { createDefaultModel, sanitizeLoadedModel, validateModelForRun } from "../app/defaults";

describe("app model sanitization", () => {
  it("normalizes legacy pinned constraints and parses numeric strings", () => {
    const model = sanitizeLoadedModel({
      geometry: {
        lengthM: "12",
        widthM: "6",
        thicknessM: "0.35",
      },
      supports: [
        {
          id: "S1",
          name: "Legacy line",
          kind: "line",
          x1: "0",
          y1: "0",
          x2: "0",
          y2: "6",
          constraints: {
            uz: { type: "pinned" },
            rx: { type: "pinned" },
            ry: { type: "pinned" },
          },
        },
      ],
      vehicle: {
        name: "Legacy vehicle",
        mode: "axle",
        trackM: "2.5",
        wheelsPerAxle: "4",
        wheelPatchLongM: "0.45",
        wheelPatchTransM: "0.3",
        axleInputs: [{ id: "A1", spacingFromPreviousM: "0", axleLoadKn: "120" }],
        directWheels: [],
      },
      display: {
        plotMode: "mesh",
      },
    });

    expect(model.geometry.lengthM).toBe(12);
    expect(model.geometry.widthM).toBe(6);
    expect(model.geometry.thicknessM).toBe(0.35);
    expect(model.supports[0].constraints.uz.type).toBe("fixed");
    expect(model.supports[0].constraints.rx.type).toBe("free");
    expect(model.supports[0].constraints.ry.type).toBe("free");
    expect(model.vehicle.trackM).toBe(2.5);
    expect(model.vehicle.wheelsPerAxle).toBe(4);
    expect(model.vehicle.axleInputs[0].axleLoadKn).toBe(120);
    expect(model.display.plotMode).toBe("mesh");
  });

  it("falls back safely when nested arrays contain malformed items", () => {
    const defaults = createDefaultModel();
    const model = sanitizeLoadedModel({
      geometry: {
        widthM: "7.5",
      },
      supports: [null, { kind: "point" }],
      vehicle: {
        mode: "direct",
        directWheels: [null],
      },
    });

    expect(model.geometry.widthM).toBe(7.5);
    expect(model.supports.length).toBeGreaterThan(0);
    expect(model.supports[0].kind).toBe("line");
    if (model.supports[0].kind !== "line") {
      throw new Error("Expected default line support.");
    }
    expect(model.supports[0].y2).toBe(7.5);
    expect(model.vehicle.directWheels).toEqual(defaults.vehicle.directWheels);
    expect(model.display.plotMode).toBe(defaults.display.plotMode);
  });
});

describe("run validation", () => {
  it("rejects non-axis-aligned line supports and empty direct-wheel models", () => {
    const model = createDefaultModel();
    model.supports = [
      {
        id: "S1",
        name: "Diagonal",
        kind: "line",
        x1: 0,
        y1: 0,
        x2: 2,
        y2: 1,
        constraints: {
          uz: { type: "fixed" },
          rx: { type: "free" },
          ry: { type: "free" },
        },
      },
    ];
    model.vehicle.mode = "direct";
    model.vehicle.directWheels = [];

    const issues = validateModelForRun(model);

    expect(issues.some((issue) => /axis-aligned/i.test(issue))).toBe(true);
    expect(issues.some((issue) => /at least one wheel/i.test(issue))).toBe(true);
  });
});
