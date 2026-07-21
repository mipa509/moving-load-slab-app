import { describe, expect, it } from "vitest";
import { generateStructuredMesh } from "../solver/core/mesh";
import {
  assembleWheelPatchLoads,
  assemblePolygonPatchLoads,
  type PolygonWheelPatchInput,
} from "../solver/loads/patch";
import { generateWheelPatches } from "../solver/loads/vehicle";
import {
  getPolygonAabb,
  polygonArea,
  polygonFirstMoments,
} from "../solver/geometry/convexPolygon";
import type { Polygon2D } from "../solver/geometry/types";
import type { SlabGeometry, StructuredMesh } from "../solver/model/types";
import {
  ZERO_SKEW_CHARACTERIZATION_MODEL,
} from "../solver/benchmarks/zeroSkewCharacterizationFixture";

const ROUND_OFF = 1e-9;

function slab(skewAngleDeg: number): SlabGeometry {
  return { lengthX: 4, lengthY: 4, thickness: 0.3, skewAngleDeg };
}

function meshFor(skewAngleDeg: number) {
  return generateStructuredMesh(slab(skewAngleDeg), { targetElementsX: 2, targetElementsY: 2 }, []);
}

function polygonPatch(
  id: string,
  polygon: Polygon2D | null,
  pressure: number,
  load: number,
): PolygonWheelPatchInput {
  return {
    id,
    pressure,
    load,
    clippedPolygon: polygon,
    clippedArea: polygon ? polygonArea(polygon) : 0,
    clippedBounds: polygon ? getPolygonAabb(polygon) : null,
  };
}

/** Resultant vertical force and its first moments about the global axes. */
function verticalResultants(mesh: StructuredMesh, vector: Float64Array) {
  let force = 0;
  let integralX = 0; // sum(f * x) == integral(pressure * x dA)
  let integralY = 0; // sum(f * y) == integral(pressure * y dA)
  for (const node of mesh.nodes) {
    const f = vector[node.id * 3];
    force += f;
    integralX += f * node.x;
    integralY += f * node.y;
  }
  return { force, integralX, integralY };
}

function expectClose(actual: number, expected: number, scale: number): void {
  const tolerance = ROUND_OFF * Math.max(1, Math.abs(expected), Math.abs(scale));
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe("polygon patch load integration", () => {
  it.each([0, 19])(
    "distributes a full-element uniform pressure as pA/4 per node at %d° skew",
    (skewAngleDeg) => {
      const mesh = meshFor(skewAngleDeg);
      const element = mesh.elements[0];
      const elementPolygon = element.polygon.map((p) => ({ x: p.x, y: p.y }));
      const area = polygonArea(elementPolygon);
      const pressure = 10;

      const assembly = assemblePolygonPatchLoads(
        mesh,
        [polygonPatch("full", elementPolygon, pressure, pressure * area)],
        mesh.nodes.length * 3,
      );

      const expectedPerNode = (pressure * area) / 4;
      for (const nodeId of element.nodeIds) {
        expectClose(assembly.globalLoadVector[nodeId * 3], expectedPerNode, pressure * area);
      }
      expectClose(assembly.totalAppliedLoadToSlab, pressure * area, pressure * area);
    },
  );

  it.each([
    ["triangle", [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }]],
    ["trapezoid", [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1.5, y: 1 }, { x: 0.5, y: 1 }]],
    ["rectangle", [{ x: 0.25, y: 0.25 }, { x: 1.75, y: 0.25 }, { x: 1.75, y: 1.5 }, { x: 0.25, y: 1.5 }]],
  ] as const)(
    "conserves force and first moments for a %s partial patch",
    (_name, polygon) => {
      const mesh = meshFor(0);
      const pressure = 7;
      const area = polygonArea(polygon);
      const moments = polygonFirstMoments(polygon);
      expect(moments).not.toBeNull();

      const assembly = assemblePolygonPatchLoads(
        mesh,
        [polygonPatch("partial", polygon as unknown as Polygon2D, pressure, pressure * area)],
        mesh.nodes.length * 3,
      );
      const resultants = verticalResultants(mesh, assembly.globalLoadVector);

      expectClose(resultants.force, pressure * area, pressure * area);
      expectClose(resultants.integralX, pressure * moments!.integralX, pressure * area * 4);
      expectClose(resultants.integralY, pressure * moments!.integralY, pressure * area * 4);
    },
  );

  it("treats a null clipped polygon (patch outside the deck) as zero applied load", () => {
    // A patch fully off the deck is clipped to null by upstream deck clipping.
    const mesh = meshFor(0);
    const assembly = assemblePolygonPatchLoads(
      mesh,
      [polygonPatch("null", null, 5, 33)],
      mesh.nodes.length * 3,
    );
    expect(assembly.totalWheelLoad).toBe(33);
    expect(assembly.totalAppliedLoadToSlab).toBe(0);
    expect(assembly.globalLoadVector.every((value) => value === 0)).toBe(true);
  });

  it("rejects a non-null clipped polygon that claims contact off the meshed deck", () => {
    // A clipped polygon with real area but no overlap with any element is a
    // load-geometry error: the assembly-time conservation self-check must catch it.
    const mesh = meshFor(0);
    const away: Polygon2D = [
      { x: 10, y: 10 },
      { x: 12, y: 10 },
      { x: 12, y: 12 },
      { x: 10, y: 12 },
    ];
    expect(() =>
      assemblePolygonPatchLoads(mesh, [polygonPatch("off", away, 5, 20)], mesh.nodes.length * 3),
    ).toThrow(/conservation failed/i);
  });

  it("applies pressure over the on-deck area only for a partially off-deck patch", () => {
    // Deck extent is [0,4] x [0,4]; clippedPolygon is the on-deck part of a wheel
    // whose full contact spans [3,5] x [1,2]. The wheel load reflects the full
    // patch, but only pressure x on-deck-area is applied.
    const mesh = meshFor(0);
    const pressure = 8;
    const fullArea = 2 * 1; // full [3,5] x [1,2]
    const clipped: Polygon2D = [
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
      { x: 3, y: 2 },
    ];
    const onDeckArea = polygonArea(clipped); // 1

    const assembly = assemblePolygonPatchLoads(
      mesh,
      [polygonPatch("straddle", clipped, pressure, pressure * fullArea)],
      mesh.nodes.length * 3,
    );

    expect(assembly.totalWheelLoad).toBeCloseTo(pressure * fullArea, 9); // 16
    expectClose(assembly.totalAppliedLoadToSlab, pressure * onDeckArea, pressure * fullArea); // 8
    expect(assembly.totalAppliedLoadToSlab).toBeGreaterThan(0);
    expect(assembly.totalAppliedLoadToSlab).toBeLessThan(assembly.totalWheelLoad);
    expectClose(assembly.analyticAppliedLoad ?? NaN, pressure * onDeckArea, pressure * fullArea);
  });

  it("gives zero contribution from elements touched only along an edge or at a vertex", () => {
    // A patch equal to element 3 ([2,4]x[2,4]) shares only a vertex with element 0
    // and only edges with elements 1 and 2, so only element 3 is loaded.
    const mesh = meshFor(0);
    const element3 = mesh.elements[3];
    const polygon = element3.polygon.map((p) => ({ x: p.x, y: p.y }));
    const area = polygonArea(polygon);
    const pressure = 5;

    const assembly = assemblePolygonPatchLoads(
      mesh,
      [polygonPatch("corner", polygon, pressure, pressure * area)],
      mesh.nodes.length * 3,
    );

    expect(assembly.contributions.map((c) => c.elementId)).toEqual([element3.id]);
    for (const nodeId of element3.nodeIds) {
      expectClose(assembly.globalLoadVector[nodeId * 3], (pressure * area) / 4, pressure * area);
    }
  });

  it("varies smoothly across an internal element boundary and stays analytically conserved", () => {
    const mesh = meshFor(0);
    const pressure = 6;
    const half = 0.5;

    let previousForce: number | null = null;
    for (const cx of [1.5, 1.8, 2.0, 2.2, 2.5]) {
      const square: Polygon2D = [
        { x: cx - half, y: 2 - half },
        { x: cx + half, y: 2 - half },
        { x: cx + half, y: 2 + half },
        { x: cx - half, y: 2 + half },
      ];
      const area = polygonArea(square);
      const moments = polygonFirstMoments(square)!;

      const assembly = assemblePolygonPatchLoads(
        mesh,
        [polygonPatch("sweep", square, pressure, pressure * area)],
        mesh.nodes.length * 3,
      );
      const resultants = verticalResultants(mesh, assembly.globalLoadVector);

      expectClose(resultants.force, pressure * area, pressure * area);
      expectClose(resultants.integralX, pressure * moments.integralX, pressure * area * 4);
      expectClose(resultants.integralY, pressure * moments.integralY, pressure * area * 4);

      if (previousForce !== null) {
        // Total load never jumps as the patch crosses the boundary.
        expectClose(resultants.force, previousForce, pressure * area);
      }
      previousForce = resultants.force;
    }
  });

  it("rejects a patch that maps to a non-affine element, naming the patch and element", () => {
    // A self-consistent single-element mesh whose only element is a non-affine
    // convex trapezoid (p0 + p2 != p1 + p3): polygon/bounds match its nodes so
    // the mesh invariant passes and the affine-parallelogram guard is exercised.
    const nodes = [
      { id: 0, x: 0, y: 0, s: 0, t: 0 },
      { id: 1, x: 2, y: 0, s: 2, t: 0 },
      { id: 2, x: 3, y: 2, s: 2, t: 2 },
      { id: 3, x: 0, y: 2, s: 0, t: 2 },
    ];
    const polygon = nodes.map((node) => ({ x: node.x, y: node.y }));
    const nonAffineMesh: StructuredMesh = {
      sCoords: [0, 2],
      tCoords: [0, 2],
      xCoords: [0, 2],
      yCoords: [0, 2],
      nodes,
      elements: [{ id: 0, nodeIds: [0, 1, 2, 3], polygon, bounds: getPolygonAabb(polygon)! }],
      nodeIdsByIJ: [
        [0, 1],
        [3, 2],
      ],
      elementCountS: 1,
      elementCountT: 1,
    };

    const patch = polygonPatch(
      "warp",
      [
        { x: 0.2, y: 0.2 },
        { x: 1.5, y: 0.2 },
        { x: 1.5, y: 1.5 },
        { x: 0.2, y: 1.5 },
      ],
      4,
      16,
    );

    expect(() =>
      assemblePolygonPatchLoads(nonAffineMesh, [patch], nonAffineMesh.nodes.length * 3),
    ).toThrow(/patch "warp".*non-affine element 0/i);
  });
});

describe("zero-skew equivalence with legacy AABB integration", () => {
  it("reproduces the legacy zero-skew global load vector within scaled roundoff", () => {
    const model = ZERO_SKEW_CHARACTERIZATION_MODEL;
    const mesh = generateStructuredMesh(model.slab, model.mesh, model.supports);
    const patches = generateWheelPatches(model.vehicle, model.slab);
    const totalDofs = mesh.nodes.length * 3;

    const legacy = assembleWheelPatchLoads(mesh, patches, totalDofs);
    const polygon = assemblePolygonPatchLoads(mesh, patches, totalDofs);

    expect(polygon.globalLoadVector.length).toBe(legacy.globalLoadVector.length);
    const scale = Math.max(...Array.from(legacy.globalLoadVector, Math.abs), 1);
    for (let i = 0; i < legacy.globalLoadVector.length; i += 1) {
      expect(Math.abs(polygon.globalLoadVector[i] - legacy.globalLoadVector[i])).toBeLessThanOrEqual(
        1e-9 * scale,
      );
    }
    expect(Math.abs(polygon.totalAppliedLoadToSlab - legacy.totalAppliedLoadToSlab)).toBeLessThanOrEqual(
      1e-9 * Math.max(1, Math.abs(legacy.totalAppliedLoadToSlab)),
    );
  });
});
