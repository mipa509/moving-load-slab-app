import type { SlabModel } from "./types";

export function buildAutoRunSignature(model: SlabModel): string {
  return JSON.stringify({
    geometry: model.geometry,
    material: model.material,
    mesh: model.mesh,
    supports: model.supports,
    vehicle: model.vehicle,
    placement: model.placement,
  });
}
