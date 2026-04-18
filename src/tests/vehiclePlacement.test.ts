import { describe, expect, it } from "vitest";
import { getTravelAxisSliderConfig } from "../app/placementControls";
import type { SlabModel } from "../app/types";
import { generateWheelPatches } from "../solver/loads/vehicle";
import { fromAppModel } from "../solver/model/fromAppModel";

function buildBaseAppModel(): SlabModel {
  return {
    projectName: "test",
    geometry: {
      lengthM: 10,
      widthM: 5,
      thicknessM: 0.4,
    },
    material: {
      elasticModulusMPa: 32000,
      poisson: 0.2,
      densityKnPerM3: 25,
    },
    mesh: {
      density: 10,
      autoTargetElementM: 0.5,
    },
    supports: [],
    vehicle: {
      name: "test vehicle",
      mode: "axle",
      transverseSpacingM: 2,
      wheelsPerAxle: 2,
      wheelPatchLongM: 0.4,
      wheelPatchTransM: 0.25,
      axleInputs: [
        { id: "A1", spacingFromPreviousM: 0, axleLoadKn: 90 },
        { id: "A2", spacingFromPreviousM: 4, axleLoadKn: 140 },
      ],
      directWheels: [],
    },
    placement: {
      centerXM: 5,
      centerYM: 2.5,
      headingDeg: 0,
      transverseOffsetM: 0,
      travelDirection: "x+",
      pathStartM: 0,
      pathEndM: 10,
      pathStepM: 1,
    },
    display: {
      plotMode: "results",
      mesh: true,
      supports: true,
      wheelPatches: true,
      contours: true,
      tables: true,
    },
  };
}

describe("vehicle placement semantics", () => {
  it("treats axle-builder placement center as vehicle center", () => {
    const appModel = buildBaseAppModel();
    const analysisModel = fromAppModel(appModel);
    expect(analysisModel.vehicle.kind).toBe("axle-builder");
    if (analysisModel.vehicle.kind !== "axle-builder") {
      throw new Error("Expected axle-builder vehicle");
    }
    expect(analysisModel.vehicle.referenceKind).toBe("vehicle-center");

    const patches = generateWheelPatches(analysisModel.vehicle, analysisModel.slab);
    const uniqueAxleCentersX = [...new Set(patches.map((patch) => patch.center.x))]
      .sort((a, b) => a - b);

    expect(uniqueAxleCentersX.length).toBe(2);
    expect(uniqueAxleCentersX[0]).toBeCloseTo(3, 8);
    expect(uniqueAxleCentersX[1]).toBeCloseTo(7, 8);
    const axleMidpoint = 0.5 * (uniqueAxleCentersX[0] + uniqueAxleCentersX[1]);
    expect(axleMidpoint).toBeCloseTo(appModel.placement.centerXM, 8);
  });

  it("keeps direct wheel coordinates in global slab coordinates", () => {
    const appModel = buildBaseAppModel();
    appModel.vehicle.mode = "direct";
    appModel.vehicle.directWheels = [
      {
        id: "W1",
        xM: 1.2,
        yM: 0.8,
        loadKn: 50,
        patchLongM: 0.4,
        patchTransM: 0.25,
      },
    ];
    appModel.placement.centerXM = 8;
    appModel.placement.centerYM = 4;
    appModel.placement.transverseOffsetM = 1.5;

    const analysisModel = fromAppModel(appModel);
    expect(analysisModel.vehicle.kind).toBe("explicit-wheels");
    if (analysisModel.vehicle.kind !== "explicit-wheels") {
      throw new Error("Expected explicit-wheels vehicle");
    }
    expect(analysisModel.vehicle.coordinateSystem).toBe("global-slab");

    const patches = generateWheelPatches(analysisModel.vehicle, analysisModel.slab);
    expect(patches.length).toBe(1);
    expect(patches[0].center.x).toBeCloseTo(1.2, 8);
    expect(patches[0].center.y).toBeCloseTo(0.8, 8);
  });

  it("uses adjacent transverse spacing for multi-wheel axles", () => {
    const appModel = buildBaseAppModel();
    appModel.vehicle.wheelsPerAxle = 4;
    appModel.vehicle.transverseSpacingM = 1;
    appModel.vehicle.axleInputs = [{ id: "A1", spacingFromPreviousM: 0, axleLoadKn: 120 }];

    const analysisModel = fromAppModel(appModel);
    if (analysisModel.vehicle.kind !== "axle-builder") {
      throw new Error("Expected axle-builder vehicle");
    }

    const patches = generateWheelPatches(analysisModel.vehicle, analysisModel.slab);
    const centersY = patches.map((patch) => patch.center.y).sort((a, b) => a - b);

    expect(centersY).toEqual([1, 2, 3, 4]);
  });

  it("maps the live slider to X when travel runs along the x axis", () => {
    const appModel = buildBaseAppModel();
    appModel.placement.travelDirection = "x-";

    const slider = getTravelAxisSliderConfig(appModel);

    expect(slider?.axis).toBe("x");
    expect(slider?.field).toBe("centerXM");
    expect(slider?.min).toBeCloseTo(-2.2, 8);
    expect(slider?.max).toBeCloseTo(12.2, 8);
    expect(slider?.value).toBe(appModel.placement.centerXM);
  });

  it("maps the live slider to Y when travel runs along the y axis", () => {
    const appModel = buildBaseAppModel();
    appModel.placement.travelDirection = "y+";

    const slider = getTravelAxisSliderConfig(appModel);

    expect(slider?.axis).toBe("y");
    expect(slider?.field).toBe("centerYM");
    expect(slider?.min).toBeCloseTo(-2.2, 8);
    expect(slider?.max).toBeCloseTo(7.2, 8);
    expect(slider?.value).toBe(appModel.placement.centerYM);
  });

  it("does not expose the travel-axis slider in direct-wheel mode", () => {
    const appModel = buildBaseAppModel();
    appModel.vehicle.mode = "direct";

    expect(getTravelAxisSliderConfig(appModel)).toBeNull();
  });
});
