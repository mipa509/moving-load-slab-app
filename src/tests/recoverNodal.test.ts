import { describe, it, expect } from "vitest";
import { recoverNodalFields } from "../solver/post/recoverNodal";
import type { MaterialDefinition, StructuredMesh } from "../solver/model/types";

const MATERIAL: MaterialDefinition = { elasticModulusMPa: 30000, poissonRatio: 0.2 };
const THICKNESS = 0.25;

function singleElementMesh(): StructuredMesh {
  return {
    xCoords: [0, 1],
    yCoords: [0, 1],
    nodes: [
      { id: 0, x: 0, y: 0 },
      { id: 1, x: 1, y: 0 },
      { id: 2, x: 1, y: 1 },
      { id: 3, x: 0, y: 1 },
    ],
    elements: [
      {
        id: 0,
        nodeIds: [0, 1, 2, 3],
        bounds: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
      },
    ],
    nodeIdsByIJ: [[0, 3], [1, 2]],
    elementCountX: 1,
    elementCountY: 1,
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
