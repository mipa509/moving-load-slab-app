import { getSupportAxes } from "../solver/geometry/deckCoordinates";
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

  // Physical skew-edge sizing policy:
  // - X retains the centreline span lengthM.
  // - Y follows the physical start/end support-edge length widthM/cos(theta).
  // WP-012's canonical edge utility remains the sole geometric implementation.
  // The existing 0.05 m minimum target size, nearest-integer count, and
  // minimum two elements per direction remain unchanged. cos(0)=1 preserves
  // exact rectangular counts, and cosine parity gives identical +/-skew counts.
  const physicalSupportEdgeLengthM =
    getSupportAxes(geometry, "start").lengthM;

  return {
    targetElementsX: Math.max(2, Math.round(geometry.lengthM / targetSize)),
    targetElementsY: Math.max(
      2,
      Math.round(physicalSupportEdgeLengthM / targetSize),
    ),
  };
}
