import type {
  AxisDirection,
  AxleBuilderVehicleDefinition,
  SlabGeometry,
  VehicleAxleDefinition,
  VehicleDefinition,
  WheelPatch,
} from "../model/types";

export function generateWheelPatches(
  vehicle: VehicleDefinition,
  slab: SlabGeometry,
): WheelPatch[] {
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
): WheelPatch[] {
  const patches: WheelPatch[] = [];
  const vectors = getDirectionVectors(vehicle.direction);
  const baseCenterX = vehicle.reference.x + vectors.transverse.x * (vehicle.transverseOffset ?? 0);
  const baseCenterY = vehicle.reference.y + vectors.transverse.y * (vehicle.transverseOffset ?? 0);

  vehicle.axles.forEach((axle, axleIndex) => {
    validateAxle(axle, axleIndex);
    const axleOffset = resolveAxleOffset(vehicle.axles, axleIndex);
    const track = axle.wheelTrack ?? vehicle.defaultWheelTrack;
    const patchLength = axle.patchLength ?? vehicle.defaultPatchLength;
    const patchWidth = axle.patchWidth ?? vehicle.defaultPatchWidth;
    const wheelCount = Math.max(1, Math.round(axle.wheelCount ?? 2));

    if (track <= 0 || patchLength <= 0 || patchWidth <= 0) {
      throw new Error(`Axle ${axleIndex + 1} has non-positive wheel track or patch dimensions.`);
    }

    const axleCenterX = baseCenterX + vectors.along.x * axleOffset;
    const axleCenterY = baseCenterY + vectors.along.y * axleOffset;
    const axleLabel = axle.id ?? `axle-${axleIndex + 1}`;
    const loadPerWheel = axle.axleLoad / wheelCount;
    const offsets = buildTransverseOffsets(track, wheelCount);

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
  if (axle.spacingToNext !== undefined && axle.spacingToNext < 0) {
    throw new Error(`Axle ${index + 1} spacingToNext must be non-negative when provided.`);
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

function buildTransverseOffsets(track: number, wheelCount: number): number[] {
  if (wheelCount <= 1) {
    return [0];
  }
  const spacing = track / Math.max(wheelCount - 1, 1);
  return Array.from(
    { length: wheelCount },
    (_, index) => -0.5 * track + index * spacing,
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
}): WheelPatch {
  if (input.patchLength <= 0 || input.patchWidth <= 0) {
    throw new Error(`Wheel patch "${input.id}" has non-positive dimensions.`);
  }
  if (input.load <= 0) {
    throw new Error(`Wheel patch "${input.id}" must have a positive load.`);
  }

  const { dx, dy } = patchDimensionsForDirection(
    input.direction,
    input.patchLength,
    input.patchWidth,
  );

  const originalBounds = {
    xMin: input.centerX - dx * 0.5,
    xMax: input.centerX + dx * 0.5,
    yMin: input.centerY - dy * 0.5,
    yMax: input.centerY + dy * 0.5,
  };

  const slabBounds = {
    xMin: 0,
    xMax: input.slab.lengthX,
    yMin: 0,
    yMax: input.slab.lengthY,
  };
  const clippedBounds = intersectRectangles(originalBounds, slabBounds);
  const clippedArea = clippedBounds ? rectangleArea(clippedBounds) : 0;
  const area = dx * dy;

  return {
    id: input.id,
    sourceWheelId: input.sourceWheelId,
    direction: input.direction,
    load: input.load,
    pressure: input.load / area,
    patchLength: input.patchLength,
    patchWidth: input.patchWidth,
    center: {
      x: input.centerX,
      y: input.centerY,
    },
    originalBounds,
    clippedBounds,
    clippedArea,
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

function intersectRectangles(
  a: { xMin: number; xMax: number; yMin: number; yMax: number },
  b: { xMin: number; xMax: number; yMin: number; yMax: number },
): { xMin: number; xMax: number; yMin: number; yMax: number } | null {
  const xMin = Math.max(a.xMin, b.xMin);
  const xMax = Math.min(a.xMax, b.xMax);
  const yMin = Math.max(a.yMin, b.yMin);
  const yMax = Math.min(a.yMax, b.yMax);
  if (xMax <= xMin || yMax <= yMin) {
    return null;
  }
  return { xMin, xMax, yMin, yMax };
}

function rectangleArea(rect: {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}): number {
  return Math.max(0, rect.xMax - rect.xMin) * Math.max(0, rect.yMax - rect.yMin);
}
