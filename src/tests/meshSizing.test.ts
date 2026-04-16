import { describe, expect, it } from "vitest";
import { createDefaultModel } from "../app/defaults";
import { deriveMeshResolution } from "../app/meshSizing";
import { fromAppModel } from "../solver/model/fromAppModel";

describe("mesh sizing", () => {
  it("derives solver target counts from target element size", () => {
    const model = createDefaultModel();
    model.mesh.density = 99;
    model.mesh.autoTargetElementM = 2;

    const analysisModel = fromAppModel(model);

    expect(analysisModel.mesh.targetElementsX).toBe(5);
    expect(analysisModel.mesh.targetElementsY).toBe(3);
  });

  it("changes solver mesh counts when the target element size changes", () => {
    const coarse = deriveMeshResolution(
      {
        lengthM: 10,
        widthM: 5,
        thicknessM: 0.4,
      },
      2,
    );
    const fine = deriveMeshResolution(
      {
        lengthM: 10,
        widthM: 5,
        thicknessM: 0.4,
      },
      0.5,
    );

    expect(coarse).toEqual({ targetElementsX: 5, targetElementsY: 3 });
    expect(fine).toEqual({ targetElementsX: 20, targetElementsY: 10 });
  });
});
