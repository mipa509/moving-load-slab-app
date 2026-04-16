import type { StructuredMesh, WheelPatch } from "../model/types";

export interface ElementPatchLoadContribution {
  elementId: number;
  wheelPatchId: string;
  overlapArea: number;
  pressure: number;
  nodalForcesW: [number, number, number, number];
  totalAppliedLoad: number;
}

export interface PatchLoadAssembly {
  globalLoadVector: Float64Array;
  totalWheelLoad: number;
  totalAppliedLoadToSlab: number;
  contributions: ElementPatchLoadContribution[];
}

export function assembleWheelPatchLoads(
  mesh: StructuredMesh,
  wheelPatches: WheelPatch[],
  totalDofs: number,
): PatchLoadAssembly {
  const globalLoadVector = new Float64Array(totalDofs);
  const contributions: ElementPatchLoadContribution[] = [];
  let totalWheelLoad = 0;
  let totalAppliedLoadToSlab = 0;

  for (const patch of wheelPatches) {
    totalWheelLoad += patch.load;
    if (!patch.clippedBounds || patch.clippedArea <= 0) {
      continue;
    }

    for (const element of mesh.elements) {
      const overlap = intersectRectangles(element.bounds, patch.clippedBounds);
      if (!overlap) {
        continue;
      }

      const overlapArea = rectangleArea(overlap);
      if (overlapArea <= 0) {
        continue;
      }

      const nodalForcesW = integrateNodalForcesForRectangularOverlap(
        element.bounds,
        overlap,
        patch.pressure,
      );

      let applied = 0;
      for (let localNode = 0; localNode < 4; localNode += 1) {
        const nodeId = element.nodeIds[localNode];
        const dofW = nodeId * 3;
        const force = nodalForcesW[localNode];
        globalLoadVector[dofW] += force;
        applied += force;
      }

      contributions.push({
        elementId: element.id,
        wheelPatchId: patch.id,
        overlapArea,
        pressure: patch.pressure,
        nodalForcesW,
        totalAppliedLoad: applied,
      });
      totalAppliedLoadToSlab += applied;
    }
  }

  return {
    globalLoadVector,
    totalWheelLoad,
    totalAppliedLoadToSlab,
    contributions,
  };
}

function integrateNodalForcesForRectangularOverlap(
  elementBounds: { xMin: number; xMax: number; yMin: number; yMax: number },
  overlapBounds: { xMin: number; xMax: number; yMin: number; yMax: number },
  pressure: number,
): [number, number, number, number] {
  const { xMin: ex1, xMax: ex2, yMin: ey1, yMax: ey2 } = elementBounds;
  const { xMin: xa, xMax: xb, yMin: ya, yMax: yb } = overlapBounds;

  const dx = ex2 - ex1;
  const dy = ey2 - ey1;
  if (dx <= 0 || dy <= 0) {
    throw new Error("Element bounds are invalid; expected positive area element.");
  }

  const ixLeft = ex2 * (xb - xa) - 0.5 * (xb * xb - xa * xa);
  const ixRight = 0.5 * (xb * xb - xa * xa) - ex1 * (xb - xa);
  const iyTop = ey2 * (yb - ya) - 0.5 * (yb * yb - ya * ya);
  const iyBottom = 0.5 * (yb * yb - ya * ya) - ey1 * (yb - ya);
  const scale = pressure / (dx * dy);

  const f1 = scale * ixLeft * iyTop;
  const f2 = scale * ixRight * iyTop;
  const f3 = scale * ixRight * iyBottom;
  const f4 = scale * ixLeft * iyBottom;

  return [f1, f2, f3, f4];
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
