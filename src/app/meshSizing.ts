import type { SlabGeometry } from "./types";

export interface DerivedMeshResolution {
  targetElementsX: number;
  targetElementsY: number;
}

export function deriveMeshResolution(
  geometry: SlabGeometry,
  autoTargetElementM: number,
): DerivedMeshResolution {
  const targetSize = Math.max(autoTargetElementM, 0.05);

  return {
    targetElementsX: Math.max(2, Math.round(geometry.lengthM / targetSize)),
    targetElementsY: Math.max(2, Math.round(geometry.widthM / targetSize)),
  };
}
