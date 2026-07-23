import type {
  AxisDirection,
  AxleBuilderVehicleDefinition,
  SlabGeometry,
  VehicleAxleDefinition,
  VehicleDefinition,
  WheelPatch,
} from "../model/types";

import { normalizeSolverGeometry } from "../model/fromAppModel";
import { buildDeckPolygon } from "../geometry/deckCoordinates";
import {
  clipConvexPolygons,
  getPolygonAabb,
  normalizeConvexPolygon,
  polygonArea,
  polygonCentroid,
} from "../geometry/convexPolygon";
import type { Polygon2D } from "../geometry/types";
import type { StagedSkewSolverContract } from "../model/types";

export type GeneratedWheelPatch =
  WheelPatch & StagedSkewSolverContract.WheelPatchV2;

export function generateWheelPatches(
  vehicle: VehicleDefinition,
  slab: SlabGeometry,
): GeneratedWheelPatch[] {
  if (vehicle.kind === "explicit-wheels") {
    return vehicle.wheels.map((wheel, index) =>
      createWheelPatch({
        id: wheel.id ?? `wheel-${index + 1}`,
        sourceWheelId: wheel.id ?? `wheel-${index + 1}`,
        direction: wheel.direction ?? vehicle.direction ?? "+x",
        centerX: wheel.x,
        centerY: wheel.y,
        load: wheel.load,
        patchLength: wheel.patchLength,
        patchWidth: wheel.patchWidth,
        slab,
      }));
  }

  return buildAxleWheelPatches(vehicle, slab);
}

function buildAxleWheelPatches(
  vehicle: AxleBuilderVehicleDefinition,
  slab: SlabGeometry,
): GeneratedWheelPatch[] {
  const patches: GeneratedWheelPatch[] = [];
  const vectors = getDirectionVectors(vehicle.direction);
  const baseCenterX = vehicle.reference.x + vectors.transverse.x * (vehicle.transverseOffset ?? 0);
  const baseCenterY = vehicle.reference.y + vectors.transverse.y * (vehicle.transverseOffset ?? 0);
  vehicle.axles.forEach((axle, axleIndex) => validateAxle(axle, axleIndex));
  const rawAxleOffsets = vehicle.axles.map((_, axleIndex) =>
    resolveAxleOffset(vehicle.axles, axleIndex),
  );
  const axleOffsets = normalizeAxleOffsets(
    rawAxleOffsets,
    vehicle.referenceKind ?? "lead-axle-center",
  );

  vehicle.axles.forEach((axle, axleIndex) => {
    const axleOffset = axleOffsets[axleIndex];
    const transverseSpacing = axle.transverseSpacing ?? vehicle.defaultTransverseSpacing;
    const patchLength = axle.patchLength ?? vehicle.defaultPatchLength;
    const patchWidth = axle.patchWidth ?? vehicle.defaultPatchWidth;
    const requestedWheelCount = axle.wheelCount ?? 2;
    const wheelCount = Math.max(1, Math.round(requestedWheelCount));
    if (!Number.isSafeInteger(wheelCount)) {
      throw new Error(`Axle ${axleIndex + 1} wheelCount rounds to an unsafe count.`);
    }

    if (
      !Number.isFinite(transverseSpacing)
      || !Number.isFinite(patchLength)
      || !Number.isFinite(patchWidth)
      || transverseSpacing <= 0
      || patchLength <= 0
      || patchWidth <= 0
    ) {
      throw new Error(
        `Axle ${axleIndex + 1} must have finite positive transverse wheel spacing and patch dimensions.`,
      );
    }

    const axleCenterX = baseCenterX + vectors.along.x * axleOffset;
    const axleCenterY = baseCenterY + vectors.along.y * axleOffset;
    const axleLabel = axle.id ?? `axle-${axleIndex + 1}`;
    const loadPerWheel = axle.axleLoad / wheelCount;
    if (!Number.isFinite(loadPerWheel) || loadPerWheel <= 0) {
      throw new Error(`Axle ${axleIndex + 1} produces a non-finite or non-positive load per wheel.`);
    }
    const offsets = buildTransverseOffsets(transverseSpacing, wheelCount);

    offsets.forEach((offset, wheelIndex) => {
      const centerX = axleCenterX + vectors.transverse.x * offset;
      const centerY = axleCenterY + vectors.transverse.y * offset;
      const label = `${axleLabel}-${wheelIndex + 1}`;
      patches.push(
        createWheelPatch({
          id: label,
          sourceWheelId: label,
          direction: vehicle.direction,
          centerX,
          centerY,
          load: loadPerWheel,
          patchLength,
          patchWidth,
          slab,
        }),
      );
    });
  });

  return patches;
}

function normalizeAxleOffsets(
  offsets: number[],
  referenceKind: AxleBuilderVehicleDefinition["referenceKind"],
): number[] {
  if (offsets.length === 0) {
    return offsets;
  }
  if (referenceKind !== "vehicle-center") {
    return offsets;
  }

  const minOffset = Math.min(...offsets);
  const maxOffset = Math.max(...offsets);
  const centerOffset = 0.5 * (minOffset + maxOffset);
  return offsets.map((offset) => offset - centerOffset);
}

function resolveAxleOffset(axles: VehicleAxleDefinition[], axleIndex: number): number {
  const explicitOffset = axles[axleIndex].offset;
  if (explicitOffset !== undefined) {
    return explicitOffset;
  }

  let offset = 0;
  for (let i = 0; i < axleIndex; i += 1) {
    offset += axles[i].spacingToNext ?? 0;
  }
  return offset;
}

function validateAxle(axle: VehicleAxleDefinition, index: number): void {
  if (!Number.isFinite(axle.axleLoad) || axle.axleLoad <= 0) {
    throw new Error(`Axle ${index + 1} must have a positive axleLoad.`);
  }
  if (axle.wheelCount !== undefined && !Number.isFinite(axle.wheelCount)) {
    throw new Error(`Axle ${index + 1} wheelCount must be finite when provided.`);
  }
  if (
    axle.spacingToNext !== undefined
    && (!Number.isFinite(axle.spacingToNext) || axle.spacingToNext < 0)
  ) {
    throw new Error(`Axle ${index + 1} spacingToNext must be finite and non-negative when provided.`);
  }
  if (axle.offset !== undefined && !Number.isFinite(axle.offset)) {
    throw new Error(`Axle ${index + 1} offset must be finite when provided.`);
  }
}

function getDirectionVectors(direction: AxisDirection): {
  along: { x: number; y: number };
  transverse: { x: number; y: number };
} {
  if (direction === "+x") {
    return {
      along: { x: 1, y: 0 },
      transverse: { x: 0, y: 1 },
    };
  }
  if (direction === "-x") {
    return {
      along: { x: -1, y: 0 },
      transverse: { x: 0, y: 1 },
    };
  }
  if (direction === "+y") {
    return {
      along: { x: 0, y: 1 },
      transverse: { x: 1, y: 0 },
    };
  }
  return {
    along: { x: 0, y: -1 },
    transverse: { x: 1, y: 0 },
  };
}

function buildTransverseOffsets(transverseSpacing: number, wheelCount: number): number[] {
  if (wheelCount <= 1) {
    return [0];
  }
  return Array.from(
    { length: wheelCount },
    (_, index) => (index - 0.5 * (wheelCount - 1)) * transverseSpacing,
  );
}

function createWheelPatch(input: {
  id: string;
  sourceWheelId: string;
  direction: AxisDirection;
  centerX: number;
  centerY: number;
  load: number;
  patchLength: number;
  patchWidth: number;
  slab: SlabGeometry;
}): GeneratedWheelPatch {
  if (
    !Number.isFinite(input.patchLength)
    || !Number.isFinite(input.patchWidth)
    || input.patchLength <= 0
    || input.patchWidth <= 0
  ) {
    throw new Error(`Wheel patch "${input.id}" has non-positive dimensions.`);
  }
  if (!Number.isFinite(input.load) || input.load <= 0) {
    throw new Error(`Wheel patch "${input.id}" must have a positive load.`);
  }

  if (!Number.isFinite(input.centerX) || !Number.isFinite(input.centerY)) {
    throw new Error(`Wheel patch "${input.id}" has a non-finite center.`);
  }

  const originalAreaM2 = input.patchLength * input.patchWidth;
  if (!Number.isFinite(originalAreaM2) || originalAreaM2 <= 0) {
    throw new Error(`Wheel patch "${input.id}" has a non-finite or non-positive area.`);
  }
  const pressureKnPerM2 = input.load / originalAreaM2;
  if (!Number.isFinite(pressureKnPerM2) || pressureKnPerM2 <= 0) {
    throw new Error(`Wheel patch "${input.id}" has a non-finite or non-positive pressure.`);
  }

  const { dx, dy } = patchDimensionsForDirection(
    input.direction,
    input.patchLength,
    input.patchWidth,
  );

  const rectangle: Polygon2D = [
    { x: input.centerX - dx * 0.5, y: input.centerY - dy * 0.5 },
    { x: input.centerX + dx * 0.5, y: input.centerY - dy * 0.5 },
    { x: input.centerX + dx * 0.5, y: input.centerY + dy * 0.5 },
    { x: input.centerX - dx * 0.5, y: input.centerY + dy * 0.5 },
  ];
  const originalPolygon = normalizeConvexPolygon(rectangle);
  if (!originalPolygon) {
    throw new Error(`Wheel patch "${input.id}" does not define a finite physical polygon.`);
  }
  const originalBounds = getPolygonAabb(originalPolygon);
  if (!originalBounds) {
    throw new Error(`Wheel patch "${input.id}" does not define finite bounds.`);
  }

  const normalizedSlab = normalizeSolverGeometry(input.slab);
  const deckPolygon = buildDeckPolygon(normalizedSlab);
  const clippedPolygon = clipConvexPolygons(originalPolygon, deckPolygon);
  const clippedBounds = getPolygonAabb(clippedPolygon);
  const clippedAreaM2 = clippedPolygon ? polygonArea(clippedPolygon) : 0;
  const clippedCentroid = polygonCentroid(clippedPolygon);

  return {
    id: input.id,
    sourceWheelId: input.sourceWheelId,
    direction: input.direction,
    load: input.load,
    pressure: pressureKnPerM2,
    patchLength: input.patchLength,
    patchWidth: input.patchWidth,
    center: {
      x: input.centerX,
      y: input.centerY,
    },
    originalBounds,
    clippedBounds,
    clippedArea: clippedAreaM2,
    wheelLoadKn: input.load,
    pressureKnPerM2,
    patchLengthM: input.patchLength,
    patchWidthM: input.patchWidth,
    originalPolygon,
    clippedPolygon,
    originalAreaM2,
    clippedAreaM2,
    clippedCentroid,
  };
}

function patchDimensionsForDirection(
  direction: AxisDirection,
  patchLength: number,
  patchWidth: number,
): { dx: number; dy: number } {
  if (direction === "+x" || direction === "-x") {
    return { dx: patchLength, dy: patchWidth };
  }
  return { dx: patchWidth, dy: patchLength };
}
