import { describe, expect, it } from "vitest";
import { generateStructuredMesh } from "../solver/core/mesh";
import { mapNormalizedSupportsToMesh } from "../solver/core/supports";
import type {
  InternalNormalizedSupport,
  MappedSupportResult,
  MeshSettings,
  SlabGeometry,
} from "../solver/model/types";

const RECT_SLAB: SlabGeometry = {
  lengthX: 10,
  lengthY: 5,
  thickness: 0.4,
  skewAngleDeg: 0,
};

function meshFor(slab: SlabGeometry, settings: MeshSettings) {
  return generateStructuredMesh(slab, settings, []);
}

function skewSlab(skewAngleDeg: number): SlabGeometry {
  return { ...RECT_SLAB, skewAngleDeg };
}

function sumVerticalSpringStiffness(mapped: MappedSupportResult): number {
  let sum = 0;
  for (const [globalDof, stiffness] of mapped.springStiffnessByDof.entries()) {
    if (globalDof % 3 === 0) {
      sum += stiffness;
    }
  }
  return sum;
}

describe("normalized edge support mapping", () => {
  it.each([0, 19, -19])(
    "maps each deck edge to its topological node set at %d° skew",
    (skewAngleDeg) => {
      const mesh = meshFor(skewSlab(skewAngleDeg), {
        targetElementsX: 4,
        targetElementsY: 3,
      });
      const lastI = mesh.sCoords.length - 1;
      const lastJ = mesh.tCoords.length - 1;

      const collect = (edge: InternalNormalizedSupport & { kind: "edge" }) => {
        const mapped = mapNormalizedSupportsToMesh(mesh, [edge]);
        return new Set(
          mapped.assignments
            .filter((assignment) => assignment.dof === "w")
            .map((assignment) => assignment.nodeId),
        );
      };

      expect(
        collect({ id: "start", kind: "edge", edge: "start", restraint: { behavior: "fixed" } }),
      ).toEqual(new Set(mesh.nodeIdsByIJ.map((row) => row[0])));
      expect(
        collect({ id: "end", kind: "edge", edge: "end", restraint: { behavior: "fixed" } }),
      ).toEqual(new Set(mesh.nodeIdsByIJ.map((row) => row[lastI])));
      expect(
        collect({ id: "lower", kind: "edge", edge: "lower-side", restraint: { behavior: "fixed" } }),
      ).toEqual(new Set(mesh.nodeIdsByIJ[0]));
      expect(
        collect({ id: "upper", kind: "edge", edge: "upper-side", restraint: { behavior: "fixed" } }),
      ).toEqual(new Set(mesh.nodeIdsByIJ[lastJ]));
    },
  );

  it("resolves fixed, pinned, and custom presets to generalized DOF constraints", () => {
    const mesh = meshFor(RECT_SLAB, { targetElementsX: 2, targetElementsY: 2 });
    const startNodeCount = mesh.tCoords.length;

    const fixed = mapNormalizedSupportsToMesh(mesh, [
      { id: "f", kind: "edge", edge: "start", restraint: { behavior: "fixed" } },
    ]);
    expect(fixed.fixedDofs.size).toBe(3 * startNodeCount);
    expect(new Set(fixed.assignments.map((a) => a.dof))).toEqual(new Set(["w", "rx", "ry"]));

    const pinned = mapNormalizedSupportsToMesh(mesh, [
      { id: "p", kind: "edge", edge: "start", restraint: { behavior: "pinned" } },
    ]);
    expect(pinned.fixedDofs.size).toBe(startNodeCount);
    expect(new Set(pinned.assignments.map((a) => a.dof))).toEqual(new Set(["w"]));

    const custom = mapNormalizedSupportsToMesh(mesh, [
      {
        id: "c",
        kind: "edge",
        edge: "start",
        restraint: {
          behavior: "custom",
          dofs: {
            w: { kind: "spring", stiffness: 8000 },
            betaX: { kind: "fixed" },
            betaY: { kind: "free" },
          },
        },
      },
    ]);
    expect(custom.fixedDofs.size).toBe(startNodeCount); // only betaX -> rx fixed
    expect(new Set(custom.assignments.filter((a) => a.kind === "fixed").map((a) => a.dof))).toEqual(
      new Set(["rx"]),
    );
    expect(new Set(custom.assignments.filter((a) => a.kind === "spring").map((a) => a.dof))).toEqual(
      new Set(["w"]),
    );
    expect(sumVerticalSpringStiffness(custom)).toBeCloseTo(8000, 6);
  });
});

describe("normalized point and line support mapping", () => {
  it("maps a point support to the nearest meshed node with physical-distance confirmation", () => {
    const mesh = meshFor(skewSlab(19), { targetElementsX: 4, targetElementsY: 4 });
    const target = mesh.nodes[13];

    const mapped = mapNormalizedSupportsToMesh(mesh, [
      { id: "p", kind: "point", x: target.x, y: target.y, restraint: { behavior: "fixed" } },
    ]);

    expect(new Set(mapped.assignments.map((a) => a.nodeId))).toEqual(new Set([target.id]));
    expect(mapped.fixedDofs.size).toBe(3);
  });

  it("rejects a point support with no meshed node within tolerance", () => {
    const mesh = meshFor(RECT_SLAB, { targetElementsX: 4, targetElementsY: 4 });
    expect(() =>
      mapNormalizedSupportsToMesh(mesh, [
        { id: "off", kind: "point", x: 2.8, y: 1.25, restraint: { behavior: "fixed" } },
      ]),
    ).toThrow(/no meshed node/i);
  });

  it("collects point-to-segment member nodes for a line along meshed nodes", () => {
    const mesh = meshFor(RECT_SLAB, {
      targetElementsX: 4,
      targetElementsY: 4,
      forcedX: [2.5],
    });

    const mapped = mapNormalizedSupportsToMesh(mesh, [
      { id: "L", kind: "line", x1: 2.5, y1: 0, x2: 2.5, y2: 5, restraint: { behavior: "pinned" } },
    ]);
    const memberNodes = mapped.assignments
      .filter((a) => a.dof === "w")
      .map((a) => a.nodeId);

    expect(memberNodes.length).toBe(mesh.tCoords.length);
    for (const nodeId of memberNodes) {
      expect(mesh.nodes[nodeId].x).toBeCloseTo(2.5, 9);
    }
  });

  it("rejects an internal line whose endpoints are not meshed nodes", () => {
    const mesh = meshFor(RECT_SLAB, { targetElementsX: 4, targetElementsY: 4 });
    expect(() =>
      mapNormalizedSupportsToMesh(mesh, [
        { id: "D", kind: "line", x1: 0.7, y1: 0.3, x2: 3.1, y2: 2.2, restraint: { behavior: "fixed" } },
      ]),
    ).toThrow(/not represented by meshed nodes/i);
  });

  it("accepts an inclined constant-s line on a skewed mesh via point-to-segment membership", () => {
    const mesh = meshFor(skewSlab(19), { targetElementsX: 4, targetElementsY: 3 });
    const columnNodeIds = mesh.nodeIdsByIJ.map((row) => row[1]); // constant-s column i=1
    const first = mesh.nodes[columnNodeIds[0]];
    const last = mesh.nodes[columnNodeIds[columnNodeIds.length - 1]];
    // The column is inclined in global coordinates at skew (not axis-aligned).
    expect(first.x).not.toBeCloseTo(last.x, 6);

    const mapped = mapNormalizedSupportsToMesh(mesh, [
      {
        id: "incline",
        kind: "line",
        x1: first.x,
        y1: first.y,
        x2: last.x,
        y2: last.y,
        restraint: { behavior: "pinned" },
      },
    ]);

    const memberNodes = new Set(
      mapped.assignments.filter((a) => a.dof === "w").map((a) => a.nodeId),
    );
    expect(memberNodes).toEqual(new Set(columnNodeIds));
  });
});

describe("normalized support spring conservation and duplicate exposure", () => {
  it("conserves total edge spring stiffness independent of refinement using Euclidean tributaries", () => {
    const targetStiffness = 12000;
    const support: InternalNormalizedSupport = {
      id: "e",
      kind: "edge",
      edge: "start",
      restraint: {
        behavior: "custom",
        dofs: {
          w: { kind: "spring", stiffness: targetStiffness },
          betaX: { kind: "free" },
          betaY: { kind: "free" },
        },
      },
    };

    const coarse = mapNormalizedSupportsToMesh(
      meshFor(skewSlab(19), { targetElementsX: 4, targetElementsY: 3 }),
      [support],
    );
    const fine = mapNormalizedSupportsToMesh(
      meshFor(skewSlab(19), { targetElementsX: 4, targetElementsY: 12 }),
      [support],
    );

    expect(sumVerticalSpringStiffness(coarse)).toBeCloseTo(targetStiffness, 6);
    expect(sumVerticalSpringStiffness(fine)).toBeCloseTo(targetStiffness, 6);
  });

  it("exposes a duplicate corner restraint per support while deduplicating the solve DOF set", () => {
    const mesh = meshFor(RECT_SLAB, { targetElementsX: 3, targetElementsY: 3 });
    const cornerNode = mesh.nodeIdsByIJ[0][0];

    const mapped = mapNormalizedSupportsToMesh(mesh, [
      { id: "start", kind: "edge", edge: "start", restraint: { behavior: "fixed" } },
      { id: "lower", kind: "edge", edge: "lower-side", restraint: { behavior: "fixed" } },
    ]);

    const cornerW = mapped.assignments.filter(
      (a) => a.nodeId === cornerNode && a.dof === "w",
    );
    expect(cornerW.length).toBe(2);
    expect(cornerW.map((a) => a.supportId).sort()).toEqual(["lower", "start"]);
    expect(mapped.fixedDofs.has(cornerNode * 3)).toBe(true);
  });

  it("sums spring stiffness from two edges sharing a corner node", () => {
    const mesh = meshFor(RECT_SLAB, { targetElementsX: 3, targetElementsY: 3 });
    const cornerNode = mesh.nodeIdsByIJ[0][0];
    const startStiffness = 9000;
    const lowerStiffness = 6000;

    const springEdge = (
      id: string,
      edge: "start" | "lower-side",
      stiffness: number,
    ): InternalNormalizedSupport => ({
      id,
      kind: "edge",
      edge,
      restraint: {
        behavior: "custom",
        dofs: {
          w: { kind: "spring", stiffness },
          betaX: { kind: "free" },
          betaY: { kind: "free" },
        },
      },
    });

    const mapped = mapNormalizedSupportsToMesh(mesh, [
      springEdge("start", "start", startStiffness),
      springEdge("lower", "lower-side", lowerStiffness),
    ]);

    // Both edges have 3 uniform segments, so the shared end corner takes a
    // 0.5/3 = 1/6 tributary fraction of each edge's total stiffness.
    const expected = startStiffness / 6 + lowerStiffness / 6;
    expect(mapped.springStiffnessByDof.get(cornerNode * 3)).toBeCloseTo(expected, 6);

    const cornerSprings = mapped.assignments.filter(
      (a) => a.nodeId === cornerNode && a.dof === "w" && a.kind === "spring",
    );
    expect(cornerSprings.map((a) => a.supportId).sort()).toEqual(["lower", "start"]);
  });
});
