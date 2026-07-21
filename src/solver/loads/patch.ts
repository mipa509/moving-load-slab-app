import { resolveMeshElementGeometry } from "../core/mesh";
import {
  evaluateQ4ShapeFunctions,
  inverseQ4Point,
  isAffineParallelogramQ4,
} from "../core/q4Geometry";
import {
  clipConvexPolygons,
  getPolygonAabb,
  triangleQuadratureDegreeTwo,
  triangulateConvexPolygon,
} from "../geometry/convexPolygon";
import type { Aabb, Polygon2D } from "../geometry/types";
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

/**
 * Minimal polygon patch contract consumed by WP-024 consistent-load
 * integration. The deck-clipped polygon carries the full-contact `pressure`
 * (never recomputed from the clipped area) and `load` is the total wheel load.
 */
export interface PolygonWheelPatchInput {
  id: string;
  pressure: number;
  load: number;
  clippedPolygon: Polygon2D | null;
  clippedArea: number;
  clippedBounds: Aabb | null;
}

/**
 * Assemble consistent nodal patch loads by clipping each deck-clipped wheel
 * patch against actual element polygons, triangulating the intersection, and
 * integrating `pressure * N_i` with the degree-two triangle rule evaluated
 * globally and inverse-mapped to natural coordinates. Element/patch AABBs are
 * used for broad phase only. Release elements must be affine parallelograms.
 */
export function assemblePolygonPatchLoads(
  mesh: StructuredMesh,
  wheelPatches: PolygonWheelPatchInput[],
  totalDofs: number,
): PatchLoadAssembly {
  const globalLoadVector = new Float64Array(totalDofs);
  const contributions: ElementPatchLoadContribution[] = [];
  let totalWheelLoad = 0;
  let totalAppliedLoadToSlab = 0;

  for (const patch of wheelPatches) {
    totalWheelLoad += patch.load;
    if (!patch.clippedPolygon || patch.clippedArea <= 0) {
      continue;
    }
    const patchBounds = patch.clippedBounds ?? getPolygonAabb(patch.clippedPolygon);
    if (!patchBounds) {
      continue;
    }

    for (const element of mesh.elements) {
      const resolved = resolveMeshElementGeometry(mesh, element);
      if (!aabbsOverlap(resolved.bounds, patchBounds)) {
        continue;
      }

      const intersection = clipConvexPolygons(patch.clippedPolygon, resolved.polygon);
      if (!intersection) {
        continue;
      }

      // Release load integration is exact only for affine parallelogram Q4
      // elements; reject any variable-Jacobian element up front.
      if (!isAffineParallelogramQ4(resolved.nodes)) {
        throw new Error(
          `Patch "${patch.id}" overlaps non-affine element ${element.id}; release load integration requires affine parallelogram elements.`,
        );
      }

      const triangles = triangulateConvexPolygon(intersection);
      if (!triangles) {
        continue;
      }

      const nodalForcesW: [number, number, number, number] = [0, 0, 0, 0];
      let overlapArea = 0;
      for (const triangle of triangles) {
        const quadrature = triangleQuadratureDegreeTwo(triangle);
        if (!quadrature) {
          continue;
        }
        for (const sample of quadrature) {
          overlapArea += sample.weight;
          const inverse = inverseQ4Point(resolved.nodes, sample.point);
          if (!inverse.converged || inverse.jacobianFailed) {
            throw new Error(
              `Patch "${patch.id}" quadrature point could not be inverse-mapped into element ${element.id}.`,
            );
          }
          const shapeFunctions = evaluateQ4ShapeFunctions(inverse.xi, inverse.eta);
          for (let localNode = 0; localNode < 4; localNode += 1) {
            nodalForcesW[localNode] += patch.pressure * shapeFunctions[localNode] * sample.weight;
          }
        }
      }

      if (overlapArea <= 0) {
        continue;
      }

      let applied = 0;
      for (let localNode = 0; localNode < 4; localNode += 1) {
        const nodeId = element.nodeIds[localNode];
        globalLoadVector[nodeId * 3] += nodalForcesW[localNode];
        applied += nodalForcesW[localNode];
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

function aabbsOverlap(a: Aabb, b: Aabb): boolean {
  return a.xMax >= b.xMin && b.xMax >= a.xMin && a.yMax >= b.yMin && b.yMax >= a.yMin;
}

export function assembleWheelPatchLoads(
  mesh: StructuredMesh,
  wheelPatches: WheelPatch[],
  totalDofs: number,
): PatchLoadAssembly {
  for (const element of mesh.elements) {
    assertLegacyRectangularElement(mesh, element);
  }

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

function assertLegacyRectangularElement(
  mesh: StructuredMesh,
  element: StructuredMesh["elements"][number],
): void {
  const resolved = resolveMeshElementGeometry(mesh, element);
  const { xMin, xMax, yMin, yMax } = resolved.bounds;
  const expected = [
    [xMin, yMin],
    [xMax, yMin],
    [xMax, yMax],
    [xMin, yMax],
  ] as const;
  const exactRectangle =
    resolved.polygon.length === expected.length &&
    resolved.polygon.every(
      (point, index) =>
        point.x === expected[index][0] && point.y === expected[index][1],
    );
  if (!exactRectangle) {
    throw new Error(
      `Legacy AABB patch integration rejects non-rectangular mesh element ${element.id}; WP-024 polygon integration is required.`,
    );
  }
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
