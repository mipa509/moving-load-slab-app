import { describe, expect, it } from "vitest";
import {
  mapGeneralizedBetaToPhysicalRotation,
  mapGeneralizedMomentToPhysicalCouple,
  mapPhysicalCoupleToGeneralizedMoment,
  mapPhysicalRotationToGeneralizedBeta,
  type GeneralizedBetaComponents,
  type GeneralizedNodalMomentComponents,
} from "../solver/post/reactionMomentMapping";

function dot(left: readonly [number, number], right: readonly [number, number]): number {
  return left[0] * right[0] + left[1] * right[1];
}

describe("generalized nodal moment to physical global couple mapping", () => {
  it.each([
    [1, 0, 0, 1],
    [0, 1, -1, 0],
    [-1, 0, 0, -1],
    [0, -1, 1, 0],
  ] as const)(
    "maps generalized unit/sign case (%s, %s) to physical couple (%s, %s)",
    (generalizedX, generalizedY, expectedCoupleX, expectedCoupleY) => {
      expect(
        mapGeneralizedMomentToPhysicalCouple({
          conjugateToBetaX: generalizedX,
          conjugateToBetaY: generalizedY,
        }),
      ).toEqual({ coupleX: expectedCoupleX, coupleY: expectedCoupleY });
    },
  );

  it("maps the corresponding 90-degree director axes for kinematics and actions", () => {
    expect(mapGeneralizedBetaToPhysicalRotation({ betaX: 1, betaY: 0 })).toEqual({
      rotationX: 0,
      rotationY: 1,
    });
    expect(mapGeneralizedBetaToPhysicalRotation({ betaX: 0, betaY: 1 })).toEqual({
      rotationX: -1,
      rotationY: 0,
    });
    expect(
      mapGeneralizedMomentToPhysicalCouple({
        conjugateToBetaX: 1,
        conjugateToBetaY: 0,
      }),
    ).toEqual({ coupleX: 0, coupleY: 1 });
    expect(
      mapGeneralizedMomentToPhysicalCouple({
        conjugateToBetaX: 0,
        conjugateToBetaY: 1,
      }),
    ).toEqual({ coupleX: -1, coupleY: 0 });
  });

  it("preserves asymmetric virtual work under the independent rotation and action maps", () => {
    const deltaBeta: GeneralizedBetaComponents = { betaX: 0.37, betaY: -0.81 };
    const generalizedMoment: GeneralizedNodalMomentComponents = {
      conjugateToBetaX: 12.4,
      conjugateToBetaY: -7.8,
    };
    const deltaRotation = mapGeneralizedBetaToPhysicalRotation(deltaBeta);
    const physicalCouple = mapGeneralizedMomentToPhysicalCouple(generalizedMoment);

    const generalizedWork = dot(
      [deltaBeta.betaX, deltaBeta.betaY],
      [generalizedMoment.conjugateToBetaX, generalizedMoment.conjugateToBetaY],
    );
    const physicalWork = dot(
      [deltaRotation.rotationX, deltaRotation.rotationY],
      [physicalCouple.coupleX, physicalCouple.coupleY],
    );

    expect(physicalWork).toBe(generalizedWork);
  });

  it.each([
    { betaX: 0, betaY: 0 },
    { betaX: 3.25, betaY: -9.5 },
    { betaX: -Number.MAX_VALUE, betaY: Number.MAX_VALUE },
  ])("round-trips finite generalized rotations: $betaX, $betaY", (generalized) => {
    const physical = mapGeneralizedBetaToPhysicalRotation(generalized);
    expect(Number.isFinite(physical.rotationX)).toBe(true);
    expect(Number.isFinite(physical.rotationY)).toBe(true);
    expect(mapPhysicalRotationToGeneralizedBeta(physical)).toEqual(generalized);
  });

  it.each([
    { conjugateToBetaX: 0, conjugateToBetaY: 0 },
    { conjugateToBetaX: -14.75, conjugateToBetaY: 2.125 },
    { conjugateToBetaX: Number.MAX_VALUE, conjugateToBetaY: -Number.MAX_VALUE },
  ])(
    "round-trips finite generalized moments: $conjugateToBetaX, $conjugateToBetaY",
    (generalized) => {
      const physical = mapGeneralizedMomentToPhysicalCouple(generalized);
      expect(Number.isFinite(physical.coupleX)).toBe(true);
      expect(Number.isFinite(physical.coupleY)).toBe(true);
      expect(mapPhysicalCoupleToGeneralizedMoment(physical)).toEqual(generalized);
    },
  );

  it("normalizes independent negative-zero inputs on both axes in every mapping", () => {
    const mappedComponentPairs = [
      Object.values(mapGeneralizedBetaToPhysicalRotation({ betaX: -0, betaY: 0 })),
      Object.values(mapGeneralizedBetaToPhysicalRotation({ betaX: 0, betaY: -0 })),
      Object.values(mapPhysicalRotationToGeneralizedBeta({ rotationX: -0, rotationY: 0 })),
      Object.values(mapPhysicalRotationToGeneralizedBeta({ rotationX: 0, rotationY: -0 })),
      Object.values(
        mapGeneralizedMomentToPhysicalCouple({
          conjugateToBetaX: -0,
          conjugateToBetaY: 0,
        }),
      ),
      Object.values(
        mapGeneralizedMomentToPhysicalCouple({
          conjugateToBetaX: 0,
          conjugateToBetaY: -0,
        }),
      ),
      Object.values(mapPhysicalCoupleToGeneralizedMoment({ coupleX: -0, coupleY: 0 })),
      Object.values(mapPhysicalCoupleToGeneralizedMoment({ coupleX: 0, coupleY: -0 })),
    ];

    for (const components of mappedComponentPairs) {
      for (const value of components) {
        expect(Object.is(value, 0)).toBe(true);
        expect(Object.is(value, -0)).toBe(false);
      }
    }
  });
});
