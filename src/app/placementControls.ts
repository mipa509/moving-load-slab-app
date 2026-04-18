import { generateWheelPatches } from "../solver/loads/vehicle";
import { fromAppModel } from "../solver/model/fromAppModel";
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
    return { min: 0, max: slabSpan };
  }

  return {
    min: -maxRelativeEdge,
    max: slabSpan - minRelativeEdge,
  };
}
