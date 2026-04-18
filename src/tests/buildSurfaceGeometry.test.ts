import { describe, it, expect } from "vitest";
import { buildSurfaceGeometry } from "../viewer/math/buildSurfaceGeometry";
import type { MeshTopology } from "../viewer/math/buildSurfaceGeometry";

function singleQuad(): MeshTopology {
  return {
    nodes: [
      { id: 0, x: 0, y: 0 },
      { id: 1, x: 1, y: 0 },
      { id: 2, x: 1, y: 1 },
      { id: 3, x: 0, y: 1 },
    ],
    elements: [{ id: 0, nodeIds: [0, 1, 2, 3] }],
  };
}

describe("buildSurfaceGeometry", () => {
  it("produces 3 position floats per node", () => {
    const { positions } = buildSurfaceGeometry(singleQuad());
    expect(positions.length).toBe(4 * 3);
  });

  it("node coordinates appear at correct offsets (z=0 default)", () => {
    const { positions } = buildSurfaceGeometry(singleQuad());
    expect(positions[0]).toBeCloseTo(0); // node0 x
    expect(positions[1]).toBeCloseTo(0); // node0 y
    expect(positions[2]).toBeCloseTo(0); // node0 z
    expect(positions[3]).toBeCloseTo(1); // node1 x
    expect(positions[4]).toBeCloseTo(0); // node1 y
  });

  it("produces 6 indices per element (2 triangles per quad)", () => {
    const { indices } = buildSurfaceGeometry(singleQuad());
    expect(indices.length).toBe(6);
  });

  it("all indices reference valid node positions", () => {
    const { indices } = buildSurfaceGeometry(singleQuad());
    for (const idx of indices) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(4);
    }
  });

  it("applies z-displacement when provided", () => {
    const zDisplacements = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const { positions } = buildSurfaceGeometry(singleQuad(), { zDisplacements, deformScale: 1 });
    expect(positions[2]).toBeCloseTo(0.1); // node0 z
    expect(positions[5]).toBeCloseTo(0.2); // node1 z
  });

  it("deformScale multiplies z-displacement", () => {
    const zDisplacements = new Float32Array([0.1, 0, 0, 0]);
    const { positions } = buildSurfaceGeometry(singleQuad(), { zDisplacements, deformScale: 10 });
    expect(positions[2]).toBeCloseTo(1.0);
  });

  it("scales to a 2-element mesh", () => {
    const mesh: MeshTopology = {
      nodes: [
        { id: 0, x: 0, y: 0 }, { id: 1, x: 1, y: 0 }, { id: 2, x: 2, y: 0 },
        { id: 3, x: 0, y: 1 }, { id: 4, x: 1, y: 1 }, { id: 5, x: 2, y: 1 },
      ],
      elements: [
        { id: 0, nodeIds: [0, 1, 4, 3] },
        { id: 1, nodeIds: [1, 2, 5, 4] },
      ],
    };
    const { positions, indices } = buildSurfaceGeometry(mesh);
    expect(positions.length).toBe(6 * 3);
    expect(indices.length).toBe(2 * 6);
  });

  it("throws when zDisplacements is shorter than node count", () => {
    const zDisplacements = new Float32Array([0.1, 0.2]); // only 2 values for 4 nodes
    expect(() => buildSurfaceGeometry(singleQuad(), { zDisplacements })).toThrow(
      /zDisplacements length/,
    );
  });
});
