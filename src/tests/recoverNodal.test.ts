import { describe, it, expect } from "vitest";
import { computeMindlinConstitutive } from "../solver/core/element";
import { generateStructuredMesh } from "../solver/core/mesh";
import { recoverElementCenterResults } from "../solver/post/recover";
import { recoverNodalFields } from "../solver/post/recoverNodal";
import type { MaterialDefinition, MeshNode, SlabGeometry, StructuredMesh } from "../solver/model/types";

const MATERIAL: MaterialDefinition = { elasticModulusMPa: 30000, poissonRatio: 0.2 };
const THICKNESS = 0.25;

function singleElementMesh(): StructuredMesh {
  const sCoords = [0, 1];
  const tCoords = [0, 1];
  const nodes: StructuredMesh["nodes"] = [
    { id: 0, x: 0, y: 0, s: 0, t: 0 },
    { id: 1, x: 1, y: 0, s: 1, t: 0 },
    { id: 2, x: 1, y: 1, s: 1, t: 1 },
    { id: 3, x: 0, y: 1, s: 0, t: 1 },
  ];
  return {
    sCoords,
    tCoords,
    xCoords: sCoords,
    yCoords: tCoords,
    nodes,
    elements: [
      {
        id: 0,
        nodeIds: [0, 1, 2, 3],
        polygon: nodes,
        bounds: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
      },
    ],
    nodeIdsByIJ: [[0, 1], [3, 2]],
    elementCountS: 1,
    elementCountT: 1,
  };
}

function uniformDeflectionDisp(wM: number): Float64Array {
  // 4 nodes × 3 DOFs = 12; DOF order per node: w, rx, ry
  const d = new Float64Array(12);
  for (let i = 0; i < 4; i++) d[i * 3] = wM;
  return d;
}

/**
 * Manufactured constant-curvature displacement (curvatures kappa = [kx, ky, kxy])
 * whose MITC4 evaluation reproduces `kappa` exactly with zero shear everywhere.
 */
function constantCurvatureDisplacement(
  nodes: readonly MeshNode[],
  kappa: readonly [number, number, number],
): Float64Array {
  const d = new Float64Array(nodes.length * 3);
  for (const node of nodes) {
    const base = node.id * 3;
    d[base] =
      -0.5 * kappa[0] * node.x * node.x -
      0.5 * kappa[1] * node.y * node.y -
      0.5 * kappa[2] * node.x * node.y;
    d[base + 1] = kappa[0] * node.x + 0.5 * kappa[2] * node.y;
    d[base + 2] = kappa[1] * node.y + 0.5 * kappa[2] * node.x;
  }
  return d;
}

function expectedMoments(kappa: readonly [number, number, number]): [number, number, number] {
  const { db } = computeMindlinConstitutive(MATERIAL, THICKNESS);
  return [
    db[0] * kappa[0] + db[1] * kappa[1] + db[2] * kappa[2],
    db[3] * kappa[0] + db[4] * kappa[1] + db[5] * kappa[2],
    db[6] * kappa[0] + db[7] * kappa[1] + db[8] * kappa[2],
  ];
}

function nonuniformMesh(skewAngleDeg: number): StructuredMesh {
  const slab: SlabGeometry = { lengthX: 4, lengthY: 3, thickness: THICKNESS, skewAngleDeg };
  return generateStructuredMesh(slab, { targetElementsX: 2, targetElementsY: 2, forcedX: [1.5], forcedY: [1] }, []);
}

describe("recoverNodalFields", () => {
  it("returns one entry per mesh node", () => {
    const mesh = singleElementMesh();
    const result = recoverNodalFields(mesh, MATERIAL, THICKNESS, uniformDeflectionDisp(0.001));
    expect(result).toHaveLength(4);
  });

  it("node ids match the mesh node ids", () => {
    const mesh = singleElementMesh();
    const result = recoverNodalFields(mesh, MATERIAL, THICKNESS, uniformDeflectionDisp(0.001));
    const ids = result.map((n) => n.nodeId).sort((a, b) => a - b);
    expect(ids).toEqual([0, 1, 2, 3]);
  });

  it("coordinates match the mesh nodes", () => {
    const mesh = singleElementMesh();
    const result = recoverNodalFields(mesh, MATERIAL, THICKNESS, uniformDeflectionDisp(0.001));
    const node0 = result.find((n) => n.nodeId === 0)!;
    expect(node0.x).toBeCloseTo(0);
    expect(node0.y).toBeCloseTo(0);
  });

  it("takes deflection from the exact nodal DOF", () => {
    const mesh = singleElementMesh();
    const result = recoverNodalFields(mesh, MATERIAL, THICKNESS, uniformDeflectionDisp(0.001));
    for (const node of result) {
      expect(node.deflection).toBeCloseTo(0.001, 12);
    }
  });

  it("uniform deflection gives near-zero moments (including mxy) and shears", () => {
    const mesh = singleElementMesh();
    const result = recoverNodalFields(mesh, MATERIAL, THICKNESS, uniformDeflectionDisp(0.001));
    for (const node of result) {
      expect(Math.abs(node.mx)).toBeLessThan(1e-6);
      expect(Math.abs(node.my)).toBeLessThan(1e-6);
      expect(Math.abs(node.mxy)).toBeLessThan(1e-6);
      expect(Math.abs(node.qx)).toBeLessThan(1e-6);
      expect(Math.abs(node.qy)).toBeLessThan(1e-6);
    }
  });

  it.each([0, 19])(
    "recovers a constant-curvature state exactly at every node on a nonuniform %d-degree mesh",
    (skewAngleDeg) => {
      const mesh = nonuniformMesh(skewAngleDeg);
      const kappa: [number, number, number] = [0.002, 0.001, 0.0015];
      const displacement = constantCurvatureDisplacement(mesh.nodes, kappa);
      const [expMx, expMy, expMxy] = expectedMoments(kappa);

      const result = recoverNodalFields(mesh, MATERIAL, THICKNESS, displacement);
      expect(result).toHaveLength(mesh.nodes.length);
      for (const node of result) {
        expect(node.mx).toBeCloseTo(expMx, 6);
        expect(node.my).toBeCloseTo(expMy, 6);
        expect(node.mxy).toBeCloseTo(expMxy, 6);
        expect(Math.abs(node.qx)).toBeLessThan(1e-6);
        expect(Math.abs(node.qy)).toBeLessThan(1e-6);
      }
    },
  );

  it("nodal moments equal the surrounding element-centre value for a constant-curvature field", () => {
    // Area weighting of equal element-centre values must return that value; the
    // nodal recovery therefore matches the element-centre recovery here.
    const mesh = nonuniformMesh(0);
    const kappa: [number, number, number] = [0.001, -0.0008, 0.0012];
    const displacement = constantCurvatureDisplacement(mesh.nodes, kappa);

    const centres = recoverElementCenterResults(mesh, MATERIAL, THICKNESS, displacement);
    const nodal = recoverNodalFields(mesh, MATERIAL, THICKNESS, displacement);

    for (const node of nodal) {
      expect(node.mxy).toBeCloseTo(centres[0].moments.mxy, 6);
    }
  });

  it("area-weights differing element-centre values (distinguishable from a count average)", () => {
    // A spatially varying (bilinear rotation) field makes each surrounding
    // element's centre moment different, so area weighting and a plain count
    // average give different node values. The node must match the AREA-weighted
    // mean computed by hand from the independent element-centre recovery.
    const mesh = nonuniformMesh(0);
    const displacement = new Float64Array(mesh.nodes.length * 3);
    for (const node of mesh.nodes) {
      const base = node.id * 3;
      displacement[base + 1] = 0.001 * node.x * node.y; // rx
      displacement[base + 2] = 0.0008 * node.x * node.y; // ry
    }

    const centres = recoverElementCenterResults(mesh, MATERIAL, THICKNESS, displacement);
    const nodal = recoverNodalFields(mesh, MATERIAL, THICKNESS, displacement);

    const interiorNodeId = mesh.nodeIdsByIJ[1][1];
    const touching = mesh.elements.filter((element) => element.nodeIds.includes(interiorNodeId));
    expect(touching.length).toBe(4);

    const elementArea = (element: (typeof mesh.elements)[number]): number => {
      const ns = element.nodeIds.map((id) => mesh.nodes[id]);
      let a = 0;
      for (let i = 0; i < 4; i++) {
        const p = ns[i];
        const q = ns[(i + 1) % 4];
        a += p.x * q.y - q.x * p.y;
      }
      return Math.abs(a) / 2;
    };

    let sumArea = 0;
    let sumWeighted = 0;
    let sumPlain = 0;
    for (const element of touching) {
      const centre = centres.find((c) => c.elementId === element.id)!;
      const area = elementArea(element);
      sumArea += area;
      sumWeighted += area * centre.moments.mxy;
      sumPlain += centre.moments.mxy;
    }
    const areaWeighted = sumWeighted / sumArea;
    const countAverage = sumPlain / touching.length;
    const nodeValue = nodal.find((n) => n.nodeId === interiorNodeId)!.mxy;

    expect(Math.abs(areaWeighted - countAverage)).toBeGreaterThan(1e-6);
    expect(nodeValue).toBeCloseTo(areaWeighted, 9);
    expect(nodeValue).not.toBeCloseTo(countAverage, 6);
  });

  it("recovers a constant transverse-shear state (zero curvature) at every node", () => {
    // w = c*x, rx = ry = 0 gives a constant raw transverse shear and zero
    // curvature, so qx is a nonzero constant, qy and all moments are ~zero.
    const mesh = nonuniformMesh(0);
    const c = 0.001;
    const displacement = new Float64Array(mesh.nodes.length * 3);
    for (const node of mesh.nodes) {
      displacement[node.id * 3] = c * node.x;
    }

    const centres = recoverElementCenterResults(mesh, MATERIAL, THICKNESS, displacement);
    const expectedQx = centres[0].shears.qx;
    expect(Math.abs(expectedQx)).toBeGreaterThan(1e-3);
    for (const centre of centres) {
      expect(centre.shears.qx).toBeCloseTo(expectedQx, 6);
      expect(Math.abs(centre.shears.qy)).toBeLessThan(1e-6);
      expect(Math.abs(centre.moments.mx)).toBeLessThan(1e-6);
    }

    const nodal = recoverNodalFields(mesh, MATERIAL, THICKNESS, displacement);
    for (const node of nodal) {
      expect(node.qx).toBeCloseTo(expectedQx, 6);
      expect(Math.abs(node.qy)).toBeLessThan(1e-6);
      expect(Math.abs(node.mx)).toBeLessThan(1e-6);
      expect(Math.abs(node.mxy)).toBeLessThan(1e-6);
    }
  });
});

describe("recoverElementCenterResults", () => {
  it("reports the Q4 natural centre rather than the element AABB midpoint", () => {
    const mesh = singleElementMesh();
    mesh.nodes[0] = { id: 0, x: 0, y: 0, s: 0, t: 0 };
    mesh.nodes[1] = { id: 1, x: 4, y: 0, s: 4, t: 0 };
    mesh.nodes[2] = { id: 2, x: 3, y: 2, s: 3, t: 2 };
    mesh.nodes[3] = { id: 3, x: 0, y: 1, s: 0, t: 1 };
    mesh.elements[0].polygon = mesh.nodes;
    mesh.elements[0].bounds = { xMin: 0, xMax: 4, yMin: 0, yMax: 2 };

    const [result] = recoverElementCenterResults(
      mesh,
      MATERIAL,
      THICKNESS,
      new Float64Array(12),
    );

    expect(result.center).toEqual({ x: 1.75, y: 0.75 });
    expect(result.center).not.toEqual({ x: 2, y: 1 });
  });
});
