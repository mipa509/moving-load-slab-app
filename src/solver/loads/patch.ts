import { resolveMeshElementGeometry } from "../core/mesh";
import {
  evaluateQ4ShapeFunctions,
  inverseQ4Point,
  isAffineParallelogramQ4,
} from "../core/q4Geometry";
import {
  clipConvexPolygons,
  getPolygonAabb,
  polygonArea,
  polygonFirstMoments,
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
  /**
   * WP-024 polygon integration only. Analytic pressure integrals over every
   * clipped patch polygon: `sum(pressure * clippedArea)` and the first moments
   * `sum(pressure * integral(x dA))` / `sum(pressure * integral(y dA))`. The
   * legacy AABB assembler leaves these undefined.
   */
  analyticAppliedLoad?: number;
  analyticFirstMomentX?: number;
  analyticFirstMomentY?: number;
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
  // Resolve and validate each element's geometry once, not once per patch.
  const resolvedByElement = mesh.elements.map((element) =>
    resolveMeshElementGeometry(mesh, element),
  );

  const globalLoadVector = new Float64Array(totalDofs);
  const contributions: ElementPatchLoadContribution[] = [];
  let totalWheelLoad = 0;
  let totalAppliedLoadToSlab = 0;
  let analyticAppliedLoad = 0;
  let analyticFirstMomentX = 0;
  let analyticFirstMomentY = 0;

  for (const patch of wheelPatches) {
    totalWheelLoad += patch.load;
    if (!patch.clippedPolygon || patch.clippedArea <= 0) {
      continue;
    }
    const patchBounds = patch.clippedBounds ?? getPolygonAabb(patch.clippedPolygon);
    if (!patchBounds) {
      continue;
    }

    let assembledForce = 0;
    let assembledMomentX = 0;
    let assembledMomentY = 0;

    for (let elementIndex = 0; elementIndex < mesh.elements.length; elementIndex += 1) {
      const element = mesh.elements[elementIndex];
      const resolved = resolvedByElement[elementIndex];
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
        const node = resolved.nodes[localNode];
        const force = nodalForcesW[localNode];
        globalLoadVector[node.id * 3] += force;
        applied += force;
        assembledMomentX += force * node.x;
        assembledMomentY += force * node.y;
      }
      assembledForce += applied;

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

    // Load-geometry conservation self-check (plan WP-024 requirement 7): the
    // shape-function assembly over element pieces must equal the analytic
    // pressure integral over the whole clipped polygon. A mismatch means the
    // clipped polygon is not fully covered by the mesh — a load-geometry error
    // that a solver residual must never excuse.
    const analyticForce = patch.pressure * polygonArea(patch.clippedPolygon);
    const moments = polygonFirstMoments(patch.clippedPolygon);
    const analyticMomentX = moments ? patch.pressure * moments.integralX : Number.NaN;
    const analyticMomentY = moments ? patch.pressure * moments.integralY : Number.NaN;
    assertPatchLoadConserved(
      patch.id,
      patchBounds,
      { force: assembledForce, momentX: assembledMomentX, momentY: assembledMomentY },
      { force: analyticForce, momentX: analyticMomentX, momentY: analyticMomentY },
    );

    analyticAppliedLoad += analyticForce;
    if (moments) {
      analyticFirstMomentX += analyticMomentX;
      analyticFirstMomentY += analyticMomentY;
    }
  }

  return {
    globalLoadVector,
    totalWheelLoad,
    totalAppliedLoadToSlab,
    contributions,
    analyticAppliedLoad,
    analyticFirstMomentX,
    analyticFirstMomentY,
  };
}

function aabbsOverlap(a: Aabb, b: Aabb): boolean {
  return a.xMax >= b.xMin && b.xMax >= a.xMin && a.yMax >= b.yMin && b.yMax >= a.yMin;
}

interface PatchLoadTotals {
  force: number;
  momentX: number;
  momentY: number;
}

function assertPatchLoadConserved(
  patchId: string,
  bounds: Aabb,
  assembled: PatchLoadTotals,
  analytic: PatchLoadTotals,
): void {
  const forceScale = Math.max(Math.abs(analytic.force), Math.abs(assembled.force), 1);
  const forceTolerance = 1e-7 * forceScale;
  if (Math.abs(assembled.force - analytic.force) > forceTolerance) {
    throw new Error(
      `Patch "${patchId}" load-geometry conservation failed: assembled vertical force ${assembled.force} does not match analytic ${analytic.force} (tolerance ${forceTolerance}). The clipped polygon is not fully covered by the mesh.`,
    );
  }

  if (!Number.isFinite(analytic.momentX) || !Number.isFinite(analytic.momentY)) {
    return;
  }
  const coordScale = Math.max(
    Math.abs(bounds.xMin),
    Math.abs(bounds.xMax),
    Math.abs(bounds.yMin),
    Math.abs(bounds.yMax),
    1,
  );
  const momentTolerance =
    1e-7 * (forceScale * coordScale + Math.abs(analytic.momentX) + Math.abs(analytic.momentY));
  if (
    Math.abs(assembled.momentX - analytic.momentX) > momentTolerance ||
    Math.abs(assembled.momentY - analytic.momentY) > momentTolerance
  ) {
    throw new Error(
      `Patch "${patchId}" load-geometry first-moment conservation failed (tolerance ${momentTolerance}).`,
    );
  }
}

/**
 * Legacy axis-aligned-AABB patch integrator, retained only as a zero-skew
 * reference oracle for the frozen characterization/rebaseline fixtures. The
 * public solver path uses {@link assemblePolygonPatchLoads}; callers here must
 * pass a rectangular zero-skew mesh. The temporary non-rectangular fail-closed
 * guard was removed at WP-026 once the solver stopped routing skew meshes here.
 */
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
