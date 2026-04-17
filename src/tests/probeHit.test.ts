import { describe, it, expect } from "vitest";
import { buildProbeGrid, probeNearestValue } from "../viewer/math/probeHit";
import type { MeshNode2D, NodalValuePoint } from "../viewer/math/probeHit";

function singleQuadNodes(): MeshNode2D[] {
  return [
    { id: 0, xM: 0, yM: 0 },
    { id: 1, xM: 1, yM: 0 },
    { id: 2, xM: 1, yM: 1 },
    { id: 3, xM: 0, yM: 1 },
  ];
}

function uniformValues(): NodalValuePoint[] {
  return [
    { nodeId: 0, value: 5 },
    { nodeId: 1, value: 5 },
    { nodeId: 2, value: 5 },
    { nodeId: 3, value: 5 },
  ];
}

function gradientValues(): NodalValuePoint[] {
  return [
    { nodeId: 0, value: 0 },
    { nodeId: 1, value: 10 },
    { nodeId: 2, value: 20 },
    { nodeId: 3, value: 10 },
  ];
}

describe("buildProbeGrid", () => {
  it("returns null for empty nodes", () => {
    expect(buildProbeGrid([], uniformValues())).toBeNull();
  });

  it("returns null for empty points", () => {
    expect(buildProbeGrid(singleQuadNodes(), [])).toBeNull();
  });

  it("returns a grid with correct node count", () => {
    const grid = buildProbeGrid(singleQuadNodes(), uniformValues());
    expect(grid).not.toBeNull();
    expect(grid!.nodes).toHaveLength(4);
  });

  it("valueByNode maps all node ids", () => {
    const grid = buildProbeGrid(singleQuadNodes(), gradientValues());
    expect(grid!.valueByNode.get(0)).toBe(0);
    expect(grid!.valueByNode.get(1)).toBe(10);
    expect(grid!.valueByNode.get(2)).toBe(20);
    expect(grid!.valueByNode.get(3)).toBe(10);
  });

  it("cellSize is positive", () => {
    const grid = buildProbeGrid(singleQuadNodes(), uniformValues());
    expect(grid!.cellSize).toBeGreaterThan(0);
  });
});

describe("probeNearestValue", () => {
  it("returns the value of the nearest node", () => {
    const grid = buildProbeGrid(singleQuadNodes(), gradientValues())!;
    // Near node 0 (value=0)
    const val = probeNearestValue(0.05, 0.05, grid);
    expect(val).toBe(0);
  });

  it("returns the value of the nearest node (corner 2)", () => {
    const grid = buildProbeGrid(singleQuadNodes(), gradientValues())!;
    // Near node 2 (value=20)
    const val = probeNearestValue(0.95, 0.95, grid);
    expect(val).toBe(20);
  });

  it("uniform values return the same value everywhere", () => {
    const grid = buildProbeGrid(singleQuadNodes(), uniformValues())!;
    expect(probeNearestValue(0.1, 0.1, grid)).toBe(5);
    expect(probeNearestValue(0.9, 0.9, grid)).toBe(5);
    expect(probeNearestValue(0.5, 0.5, grid)).toBe(5);
  });

  it("falls back to brute-force when outside grid cells", () => {
    const grid = buildProbeGrid(singleQuadNodes(), gradientValues())!;
    // Far outside the slab — should still find nearest node
    const val = probeNearestValue(-10, -10, grid);
    expect(val).toBe(0); // nearest is node 0
  });

  it("works with a 2-element mesh", () => {
    const nodes: MeshNode2D[] = [
      { id: 0, xM: 0, yM: 0 },
      { id: 1, xM: 2, yM: 0 },
      { id: 2, xM: 4, yM: 0 },
      { id: 3, xM: 0, yM: 2 },
      { id: 4, xM: 2, yM: 2 },
      { id: 5, xM: 4, yM: 2 },
    ];
    const values: NodalValuePoint[] = nodes.map((n) => ({
      nodeId: n.id,
      value: n.xM * 10,
    }));
    const grid = buildProbeGrid(nodes, values)!;
    expect(probeNearestValue(0.1, 0.1, grid)).toBe(0);
    expect(probeNearestValue(3.9, 0.1, grid)).toBe(40);
    expect(probeNearestValue(0.1, 1.9, grid)).toBe(0);
  });
});
