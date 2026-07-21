import { describe, expect, it } from "vitest";
import { createDefaultModel } from "../app/defaults";
import { deriveMeshResolution } from "../app/meshSizing";
import {
  fromAppModel,
  normalizeSolverGeometry,
} from "../solver/model/fromAppModel";

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
        skewAngleDeg: 0,
      },
      2,
    );
    const fine = deriveMeshResolution(
      {
        lengthM: 10,
        widthM: 5,
        thicknessM: 0.4,
        skewAngleDeg: 0,
      },
      0.5,
    );

    expect(coarse).toEqual({ targetElementsX: 5, targetElementsY: 3 });
    expect(fine).toEqual({ targetElementsX: 20, targetElementsY: 10 });
  });

  it("normalizes legacy solver geometry to the canonical names and values", () => {
    expect(
      normalizeSolverGeometry({
        lengthX: 12,
        lengthY: 6,
        thickness: 0.35,
        skewAngleDeg: -19,
      }),
    ).toEqual({
      lengthM: 12,
      widthM: 6,
      thicknessM: 0.35,
      skewAngleDeg: -19,
    });
  });

  it("normalizes absent legacy skew to exact positive zero", () => {
    const normalized = normalizeSolverGeometry({
      lengthX: 12,
      lengthY: 6,
      thickness: 0.35,
    });

    expect(normalized.skewAngleDeg).toBe(0);
    expect(Object.is(normalized.skewAngleDeg, 0)).toBe(true);
    expect(Object.is(normalized.skewAngleDeg, -0)).toBe(false);
  });

  it.each([0, 19, -19, 45, -45])(
    "propagates app skew %s degrees through the canonical normalization path",
    (skewAngleDeg) => {
      const model = createDefaultModel();
      model.geometry.skewAngleDeg = skewAngleDeg;

      const analysisModel = fromAppModel(model);

      expect(analysisModel.slab).toEqual({
        lengthX: model.geometry.lengthM,
        lengthY: model.geometry.widthM,
        thickness: model.geometry.thicknessM,
        skewAngleDeg,
      });
    },
  );

  it.each([
    [0, { targetElementsX: 7, targetElementsY: 3 }],
    [19, { targetElementsX: 7, targetElementsY: 4 }],
    [-19, { targetElementsX: 7, targetElementsY: 4 }],
    [45, { targetElementsX: 7, targetElementsY: 5 }],
    [-45, { targetElementsX: 7, targetElementsY: 5 }],
  ] as const)(
    "uses physical support-edge sizing at %s degrees",
    (skewAngleDeg, expected) => {
      expect(
        deriveMeshResolution(
          {
            lengthM: 10,
            widthM: 5,
            thicknessM: 0.4,
            skewAngleDeg,
          },
          1.45,
        ),
      ).toEqual(expected);
    },
  );

  it("changes skew-edge counts with target size under the retained policy", () => {
    const geometry = {
      lengthM: 10,
      widthM: 5,
      thicknessM: 0.4,
      skewAngleDeg: 19,
    };

    expect(deriveMeshResolution(geometry, 2)).toEqual({
      targetElementsX: 5,
      targetElementsY: 3,
    });
    expect(deriveMeshResolution(geometry, 0.5)).toEqual({
      targetElementsX: 20,
      targetElementsY: 11,
    });
  });

  it("retains the minimum target-size and minimum-count policy", () => {
    expect(
      deriveMeshResolution(
        {
          lengthM: 0.01,
          widthM: 0.01,
          thicknessM: 0.001,
          skewAngleDeg: 45,
        },
        0.001,
      ),
    ).toEqual({ targetElementsX: 2, targetElementsY: 2 });
  });

  it.each([
    ["x+", 0],
    ["x-", 19],
    ["y+", 90],
    ["y-", 271],
  ] as const)(
    "keeps mesh sizing independent of travel %s and heading %s degrees",
    (travelDirection, headingDeg) => {
      const model = createDefaultModel();
      model.geometry.skewAngleDeg = 45;
      model.mesh.autoTargetElementM = 1.45;
      model.placement.travelDirection = travelDirection;
      model.placement.headingDeg = headingDeg;

      expect(fromAppModel(model).mesh).toEqual({
        targetElementsX: 7,
        targetElementsY: 5,
      });
    },
  );
});
