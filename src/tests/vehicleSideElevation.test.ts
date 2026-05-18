import { describe, expect, it } from "vitest";
import { computeSideElevationLayout } from "../app/vehicleSideElevation";
import type { VehicleDefinition } from "../app/types";

const baseVehicle: VehicleDefinition = {
  name: "Test vehicle",
  mode: "axle",
  transverseSpacingM: 1.8,
  wheelsPerAxle: 2,
  wheelPatchLongM: 0.3,
  wheelPatchTransM: 0.2,
  axleInputs: [
    { id: "a1", spacingFromPreviousM: 0, axleLoadKn: 60 },
    { id: "a2", spacingFromPreviousM: 1.5, axleLoadKn: 80 },
    { id: "a3", spacingFromPreviousM: 1.5, axleLoadKn: 80 },
  ],
  directWheels: [],
};

describe("computeSideElevationLayout — axle mode", () => {
  it("places axles at cumulative spacings starting at zero", () => {
    const layout = computeSideElevationLayout(baseVehicle);
    expect(layout.axles.map((a) => Number(a.xM.toFixed(3)))).toEqual([0, 1.5, 3.0]);
    expect(layout.totalLengthM).toBeCloseTo(3.0, 6);
  });

  it("labels each axle with its axle load in kN", () => {
    const layout = computeSideElevationLayout(baseVehicle);
    expect(layout.axles.map((a) => a.loadKn)).toEqual([60, 80, 80]);
  });

  it("returns an empty layout for a vehicle with no axles", () => {
    const empty: VehicleDefinition = {
      ...baseVehicle,
      axleInputs: [],
    };
    const layout = computeSideElevationLayout(empty);
    expect(layout.axles).toEqual([]);
    expect(layout.totalLengthM).toBe(0);
  });
});

describe("computeSideElevationLayout — direct mode", () => {
  const directVehicle: VehicleDefinition = {
    ...baseVehicle,
    mode: "direct",
    axleInputs: [],
    directWheels: [
      { id: "w1", xM: 0.0, yM: -0.9, loadKn: 30, patchLongM: 0.3, patchTransM: 0.2 },
      { id: "w2", xM: 0.02, yM: 0.9, loadKn: 30, patchLongM: 0.3, patchTransM: 0.2 },
      { id: "w3", xM: 2.0, yM: -0.9, loadKn: 40, patchLongM: 0.3, patchTransM: 0.2 },
      { id: "w4", xM: 2.0, yM: 0.9, loadKn: 40, patchLongM: 0.3, patchTransM: 0.2 },
    ],
  };

  it("clusters wheels by longitudinal position and sums loads", () => {
    const layout = computeSideElevationLayout(directVehicle);
    expect(layout.axles).toHaveLength(2);
    expect(layout.axles[0].loadKn).toBeCloseTo(60, 6);
    expect(layout.axles[1].loadKn).toBeCloseTo(80, 6);
    expect(layout.axles[0].xM).toBeLessThan(0.05);
    expect(layout.axles[1].xM).toBeCloseTo(2.0, 6);
    expect(layout.totalLengthM).toBeCloseTo(2.0, 6);
  });
});
