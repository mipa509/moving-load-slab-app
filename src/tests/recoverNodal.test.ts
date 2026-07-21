import { describe, it, expect } from "vitest";
import { recoverElementCenterResults } from "../solver/post/recover";
import { recoverNodalFields } from "../solver/post/recoverNodal";
import type { MaterialDefinition, StructuredMesh } from "../solver/model/types";

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

  it("uniform deflection gives equal deflection at every node", () => {
    const mesh = singleElementMesh();
    const result = recoverNodalFields(mesh, MATERIAL, THICKNESS, uniformDeflectionDisp(0.001));
    for (const node of result) {
      expect(node.deflection).toBeCloseTo(0.001, 8);
    }
  });

  it("uniform deflection gives near-zero moments and shears", () => {
    const mesh = singleElementMesh();
    const result = recoverNodalFields(mesh, MATERIAL, THICKNESS, uniformDeflectionDisp(0.001));
    for (const node of result) {
      expect(Math.abs(node.mx)).toBeLessThan(1e-6);
      expect(Math.abs(node.my)).toBeLessThan(1e-6);
      expect(Math.abs(node.qx)).toBeLessThan(1e-6);
      expect(Math.abs(node.qy)).toBeLessThan(1e-6);
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
