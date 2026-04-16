import { describe, expect, it } from "vitest";
import { generateStructuredMesh } from "../solver/core/mesh";
import { mapSupportsToMesh } from "../solver/core/supports";
import type {
  MappedSupportResult,
  MeshSettings,
  SlabGeometry,
  SupportDefinition,
} from "../solver/model/types";

const SLAB: SlabGeometry = {
  lengthX: 10,
  lengthY: 5,
  thickness: 0.4,
};

function createMesh(
  mesh: MeshSettings,
  supports: SupportDefinition[] = [],
) {
  return generateStructuredMesh(SLAB, mesh, supports);
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

describe("support mapping", () => {
  it("maps axis-aligned line support nodes and fixed w dofs", () => {
    const support: SupportDefinition = {
      kind: "line",
      id: "L1",
      behavior: "pinned",
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 5,
    };

    const mesh = createMesh(
      {
        targetElementsX: 4,
        targetElementsY: 4,
      },
      [support],
    );
    const mapped = mapSupportsToMesh(mesh, [support]);
    const fixedW = mapped.assignments.filter(
      (assignment) => assignment.kind === "fixed" && assignment.dof === "w",
    );

    expect(fixedW.length).toBe(mesh.yCoords.length);
    expect(mapped.fixedDofs.size).toBe(mesh.yCoords.length);
  });

  it("throws an explicit axis-aligned error for non-axis line supports", () => {
    const mesh = createMesh({
      targetElementsX: 4,
      targetElementsY: 3,
    });

    const diagonalSupport: SupportDefinition = {
      kind: "line",
      id: "diag",
      behavior: "fixed",
      x1: 0,
      y1: 0,
      x2: 2,
      y2: 1,
    };

    expect(() => mapSupportsToMesh(mesh, [diagonalSupport])).toThrow(
      /axis-aligned for v1/i,
    );
  });

  it("distributes line spring stiffness independently of mesh refinement", () => {
    const targetStiffness = 12000;
    const springLine: SupportDefinition = {
      kind: "line",
      id: "spring-x0",
      behavior: "custom",
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 5,
      dofs: {
        w: { kind: "spring", stiffness: targetStiffness },
        rx: { kind: "free" },
        ry: { kind: "free" },
      },
    };

    const coarseMesh = createMesh(
      {
        targetElementsX: 4,
        targetElementsY: 4,
      },
      [springLine],
    );
    const fineMesh = createMesh(
      {
        targetElementsX: 4,
        targetElementsY: 20,
      },
      [springLine],
    );

    const mappedCoarse = mapSupportsToMesh(coarseMesh, [springLine]);
    const mappedFine = mapSupportsToMesh(fineMesh, [springLine]);
    const coarseTotal = sumVerticalSpringStiffness(mappedCoarse);
    const fineTotal = sumVerticalSpringStiffness(mappedFine);

    expect(coarseTotal).toBeCloseTo(targetStiffness, 8);
    expect(fineTotal).toBeCloseTo(targetStiffness, 8);
    expect(fineTotal).toBeCloseTo(coarseTotal, 8);
  });
});
