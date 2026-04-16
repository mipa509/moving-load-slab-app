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

  switch (model.placement.travelDirection) {
    case "x+":
    case "x-":
      return {
        axis: "x",
        field: "centerXM",
        label: "Vehicle center X slider (m)",
        min: 0,
        max: model.geometry.lengthM,
        step: 0.05,
        value: model.placement.centerXM,
      };
    case "y+":
    case "y-":
      return {
        axis: "y",
        field: "centerYM",
        label: "Vehicle center Y slider (m)",
        min: 0,
        max: model.geometry.widthM,
        step: 0.05,
        value: model.placement.centerYM,
      };
  }
}
