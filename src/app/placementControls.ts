import { generateWheelPatches } from "../solver/loads/vehicle";
import { fromAppModel } from "../solver/model/fromAppModel";
import { getDeckBounds } from "../solver/geometry/deckCoordinates";
import type { SlabModel } from "./types";

export interface TravelAxisSliderConfig {
  axis: "x" | "y";
  field: "centerXM" | "centerYM";
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

export function getTravelAxisSliderConfig(
  model: SlabModel,
): TravelAxisSliderConfig | null {
  if (model.vehicle.mode !== "axle") {
    return null;
  }

  const envelope = getVehicleTravelEnvelope(model);
  switch (model.placement.travelDirection) {
    case "x+":
    case "x-":
      return {
        axis: "x",
        field: "centerXM",
        label: "Vehicle crossing range along X (m)",
        min: envelope.min,
        max: envelope.max,
        step: 0.05,
        value: model.placement.centerXM,
      };
    case "y+":
    case "y-":
      return {
        axis: "y",
        field: "centerYM",
        label: "Vehicle crossing range along Y (m)",
        min: envelope.min,
        max: envelope.max,
        step: 0.05,
        value: model.placement.centerYM,
      };
  }
}

function getVehicleTravelEnvelope(model: SlabModel): { min: number; max: number } {
  const analysisModel = fromAppModel(model);
  if (analysisModel.vehicle.kind !== "axle-builder") {
    return { min: 0, max: model.geometry.lengthM };
  }

  const patches = generateWheelPatches(analysisModel.vehicle, analysisModel.slab);
  if (patches.length === 0) {
    return { min: 0, max: model.geometry.lengthM };
  }

  const alongX =
    model.placement.travelDirection === "x+" || model.placement.travelDirection === "x-";
  const reference = alongX ? analysisModel.vehicle.reference.x : analysisModel.vehicle.reference.y;
  const slabSpan = alongX ? model.geometry.lengthM : model.geometry.widthM;

  // Skew-aware deck extent along the travel axis. A skewed deck's global-x
  // span exceeds lengthM by widthM*|tan(skew)| (its y-span is unaffected), so
  // using the plain rectangle bounds would under-cover the deck and clip the
  // vehicle's entry/exit across the skewed start/end edges. Fall back to the
  // zero-skew rectangle on any geometry error; at zero skew getDeckBounds
  // returns exactly {0, lengthM} / {0, widthM}, so this reduces to the
  // pre-skew formula unchanged.
  let deckMin = 0;
  let deckMax = slabSpan;
  try {
    const deckBounds = getDeckBounds(model.geometry);
    deckMin = alongX ? deckBounds.xMin : deckBounds.yMin;
    deckMax = alongX ? deckBounds.xMax : deckBounds.yMax;
  } catch {
    deckMin = 0;
    deckMax = slabSpan;
  }

  let minRelativeEdge = Infinity;
  let maxRelativeEdge = -Infinity;

  for (const patch of patches) {
    const edges = alongX
      ? [patch.originalBounds.xMin, patch.originalBounds.xMax]
      : [patch.originalBounds.yMin, patch.originalBounds.yMax];
    for (const edge of edges) {
      const relativeEdge = edge - reference;
      minRelativeEdge = Math.min(minRelativeEdge, relativeEdge);
      maxRelativeEdge = Math.max(maxRelativeEdge, relativeEdge);
    }
  }

  if (!Number.isFinite(minRelativeEdge) || !Number.isFinite(maxRelativeEdge)) {
    return { min: deckMin, max: deckMax };
  }

  return {
    min: deckMin - maxRelativeEdge,
    max: deckMax - minRelativeEdge,
  };
}
