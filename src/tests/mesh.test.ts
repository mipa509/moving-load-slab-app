import { describe, expect, it } from "vitest";
import {
  generateStructuredMesh,
  getMeshElementCenter,
  resolveMeshElementGeometry,
} from "../solver/core/mesh";
import {
  evaluateStructuredMeshQuality,
  MESH_QUALITY_DEFINITION_ID,
  MeshQualityError,
} from "../solver/core/meshQuality";
import { deckLocalToGlobal } from "../solver/geometry/deckCoordinates";
import { isAffineParallelogramQ4 } from "../solver/core/q4Geometry";
import type {
  MeshNode,
  SlabGeometry,
  StructuredMesh,
} from "../solver/model/types";

const ZERO_SKEW: SlabGeometry = {
  lengthX: 4,
  lengthY: 2,
  thickness: 0.2,
  skewAngleDeg: 0,
};

function makeMesh(
  skewAngleDeg = 0,
  targetElementsX = 2,
  targetElementsY = 2,
): StructuredMesh {
  return generateStructuredMesh(
    { ...ZERO_SKEW, skewAngleDeg },
    { targetElementsX, targetElementsY },
    [],
  );
}

function makeSingleElementMesh(
  coordinates: ReadonlyArray<readonly [number, number]>,
  nodeIds: [number, number, number, number] = [0, 1, 2, 3],
): StructuredMesh {
  const nodes: MeshNode[] = coordinates.map(([x, y], id) => ({
    id,
    x,
    y,
    s: x,
    t: y,
  }));
  const polygon = nodeIds.map((nodeId) => nodes[nodeId]);
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  const sCoords = [0, 1];
  const tCoords = [0, 1];
  return {
    sCoords,
    tCoords,
    xCoords: sCoords,
    yCoords: tCoords,
    nodes,
    elements: [
      {
        id: 0,
        nodeIds,
        polygon,
        bounds: {
          xMin: Math.min(...xs),
          xMax: Math.max(...xs),
          yMin: Math.min(...ys),
          yMax: Math.max(...ys),
        },
      },
    ],
    nodeIdsByIJ: [[0, 1], [3, 2]],
    elementCountS: 1,
    elementCountT: 1,
  };
}

describe("skew structured mesh", () => {
  it("preserves exact zero-skew axes, topology, numbering, and aliases", () => {
    const mesh = makeMesh();

    expect(mesh.sCoords).toEqual([0, 2, 4]);
    expect(mesh.tCoords).toEqual([0, 1, 2]);
    expect(mesh.xCoords).toBe(mesh.sCoords);
    expect(mesh.yCoords).toBe(mesh.tCoords);
    expect(mesh.elementCountS).toBe(2);
    expect(mesh.elementCountT).toBe(2);
    expect(mesh.nodeIdsByIJ).toEqual([
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
    ]);
    expect(mesh.nodes[4]).toEqual({ id: 4, x: 2, y: 1, s: 2, t: 1 });
    expect(mesh.elements.map((element) => element.nodeIds)).toEqual([
      [0, 1, 4, 3],
      [1, 2, 5, 4],
      [3, 4, 7, 6],
      [4, 5, 8, 7],
    ]);
  });

  it("maps positive and negative 19-degree meshes with opposite shear signs", () => {
    const positive = makeMesh(19, 3, 2);
    const negative = makeMesh(-19, 3, 2);
    const tangent = Math.tan((19 * Math.PI) / 180);

    expect(negative.nodeIdsByIJ).toEqual(positive.nodeIdsByIJ);
    positive.nodes.forEach((node, index) => {
      const mirror = negative.nodes[index];
      expect(node.x).toBeCloseTo(
        node.s + (node.t - ZERO_SKEW.lengthY / 2) * tangent,
        13,
      );
      expect(node.y).toBe(node.t);
      expect(mirror.s).toBe(node.s);
      expect(mirror.t).toBe(node.t);
      expect(mirror.x + node.x).toBeCloseTo(2 * node.s, 13);
      expect(mirror.y).toBe(node.y);
    });
  });

  it("obeys the exact accepted 19-degree mirror with reversed t rows", () => {
    const positive = makeMesh(19, 3, 2);
    const negative = makeMesh(-19, 3, 2);
    const lastJ = positive.tCoords.length - 1;

    for (let j = 0; j <= lastJ; j += 1) {
      for (let i = 0; i < positive.sCoords.length; i += 1) {
        const positiveNode = positive.nodes[positive.nodeIdsByIJ[j][i]];
        const negativeNode = negative.nodes[negative.nodeIdsByIJ[lastJ - j][i]];
        expect(negativeNode.s).toBe(positiveNode.s);
        expect(negativeNode.t).toBeCloseTo(
          ZERO_SKEW.lengthY - positiveNode.t,
          14,
        );
        expect(negativeNode.x).toBeCloseTo(positiveNode.x, 13);
        expect(negativeNode.y).toBeCloseTo(
          ZERO_SKEW.lengthY - positiveNode.y,
          14,
        );
      }
    }
  });

  it("inverse-maps a retained point support and forces both local axes", () => {
    const canonical = {
      lengthM: ZERO_SKEW.lengthX,
      widthM: ZERO_SKEW.lengthY,
      thicknessM: ZERO_SKEW.thickness,
      skewAngleDeg: 19,
    };
    const local = { s: 1.3, t: 0.7 };
    const global = deckLocalToGlobal(canonical, local);
    const mesh = generateStructuredMesh(
      { ...ZERO_SKEW, skewAngleDeg: 19 },
      { targetElementsX: 2, targetElementsY: 2 },
      [{ kind: "point", id: "P1", x: global.x, y: global.y }],
    );

    expect(mesh.sCoords.some((value) => Math.abs(value - local.s) < 1e-12)).toBe(true);
    expect(mesh.tCoords.some((value) => Math.abs(value - local.t) < 1e-12)).toBe(true);
    const node = mesh.nodes.find(
      (candidate) =>
        Math.abs(candidate.s - local.s) < 1e-12 &&
        Math.abs(candidate.t - local.t) < 1e-12,
    );
    expect(node).toBeDefined();
    expect(node?.x).toBeCloseTo(global.x, 13);
    expect(node?.y).toBeCloseTo(global.y, 13);
  });

  it("creates finite strictly ordered nonuniform and refined local grids", () => {
    const mesh = generateStructuredMesh(
      ZERO_SKEW,
      {
        targetElementsX: 8,
        targetElementsY: 5,
        forcedX: [0.37, 2.61],
        forcedY: [0.44, 1.63],
      },
      [],
    );

    for (const axis of [mesh.sCoords, mesh.tCoords]) {
      expect(axis.every(Number.isFinite)).toBe(true);
      expect(axis.every((value, index) => index === 0 || value > axis[index - 1]))
        .toBe(true);
    }
    expect(
      mesh.nodes.every((node) =>
        [node.x, node.y, node.s, node.t].every(Number.isFinite),
      ),
    ).toBe(true);
    expect(mesh.sCoords).toContain(0.37);
    expect(mesh.sCoords).toContain(2.61);
    expect(mesh.tCoords).toContain(0.44);
    expect(mesh.tCoords).toContain(1.63);
    expect(mesh.elementCountS).toBeGreaterThan(2);
    expect(mesh.elementCountT).toBeGreaterThan(2);
  });

  it("stores polygons as the exact referenced nodes and containing AABBs", () => {
    const mesh = makeMesh(19, 3, 2);

    for (const element of mesh.elements) {
      element.nodeIds.forEach((nodeId, localIndex) => {
        expect(element.polygon[localIndex]).toBe(mesh.nodes[nodeId]);
      });
      for (const point of element.polygon) {
        expect(point.x).toBeGreaterThanOrEqual(element.bounds.xMin);
        expect(point.x).toBeLessThanOrEqual(element.bounds.xMax);
        expect(point.y).toBeGreaterThanOrEqual(element.bounds.yMin);
        expect(point.y).toBeLessThanOrEqual(element.bounds.yMax);
      }
    }
  });

  it("uses Q4 interpolation for a non-affine centre, not the AABB midpoint", () => {
    const mesh = makeSingleElementMesh([
      [0, 0],
      [4, 0],
      [3, 2],
      [0, 1],
    ]);

    const center = getMeshElementCenter(mesh, mesh.elements[0]);
    expect(center).toEqual({ x: 1.75, y: 0.75 });
    expect(center).not.toEqual({ x: 2, y: 1 });
  });

  it("emits affine parallelogram elements everywhere for a skew mesh", () => {
    // WP-026 release load integration is exact only for affine parallelogram Q4
    // elements; the structured skew generator must emit them everywhere so the
    // polygon load path never rejects a loaded element.
    const mesh = makeMesh(19, 3, 3);
    for (const element of mesh.elements) {
      const resolved = resolveMeshElementGeometry(mesh, element);
      expect(isAffineParallelogramQ4(resolved.nodes)).toBe(true);
    }
  });

  it("rejects forged rectangular metadata over skew physical nodeIds", () => {
    const mesh = makeMesh(19, 1, 1);
    const element = mesh.elements[0];
    const { xMin, xMax, yMin, yMax } = element.bounds;
    element.polygon = [
      { x: xMin, y: yMin },
      { x: xMax, y: yMin },
      { x: xMax, y: yMax },
      { x: xMin, y: yMax },
    ];

    expect(() => resolveMeshElementGeometry(mesh, element)).toThrow(
      /polygon does not exactly match its indexed nodes/i,
    );
  });

  it("rejects unsupported skew internal line forcing explicitly", () => {
    expect(() =>
      generateStructuredMesh(
        { ...ZERO_SKEW, skewAngleDeg: 19 },
        { targetElementsX: 2, targetElementsY: 2 },
        [
          {
            kind: "line",
            id: "internal-diagonal",
            x1: 0.2,
            y1: 0.2,
            x2: 2.7,
            y2: 1.4,
          },
        ],
      ),
    ).toThrow(/internal-diagonal.*unsupported.*deck-local coordinate line/i);
  });

  it("rejects non-finite forced coordinates before axis generation", () => {
    expect(() =>
      generateStructuredMesh(
        ZERO_SKEW,
        { targetElementsX: 2, targetElementsY: 2, forcedX: [Number.NaN] },
        [],
      ),
    ).toThrow(/forced mesh coordinates must be finite/i);
  });
});

describe("Q4 mesh quality", () => {
  it("matches the analytic scaled Jacobian for a 19-degree affine skew", () => {
    const mesh = makeMesh(19, 1, 1);
    const report = evaluateStructuredMeshQuality(mesh, ZERO_SKEW.thickness);

    expect(report.elements[0].scaledJacobianMin).toBeCloseTo(
      Math.cos((19 * Math.PI) / 180),
      13,
    );
  });

  it("reports exact affine rectangle metrics as ok", () => {
    const mesh = makeSingleElementMesh([
      [0, 0],
      [2, 0],
      [2, 1],
      [0, 1],
    ]);
    const report = evaluateStructuredMeshQuality(mesh, 0.2);

    expect(report.definitionId).toBe(MESH_QUALITY_DEFINITION_ID);
    expect(report.status).toBe("ok");
    expect(report.diagnostics).toEqual([]);
    expect(report.elements[0]).toMatchObject({
      determinantMin: 0.5,
      determinantMax: 0.5,
      scaledJacobianMin: 1,
      minEdgeLengthM: 1,
      maxEdgeLengthM: 2,
      minInteriorAngleDeg: 90,
      maxInteriorAngleDeg: 90,
      aspectRatio: 2,
      thicknessToMaxEdgeRatio: 0.1,
      severity: "ok",
      diagnosticCodes: [],
    });
  });

  it("reports poor-but-valid warnings in frozen deterministic order", () => {
    const mesh = makeSingleElementMesh([
      [0, 0],
      [10, 0],
      [10.19, 0.02],
      [0.19, 0.02],
    ]);
    const report = evaluateStructuredMeshQuality(mesh, 0.1);

    expect(report.status).toBe("warning");
    expect(report.elements[0].severity).toBe("warning");
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "MESH_SCALED_JACOBIAN_LOW",
      "MESH_INTERIOR_ANGLE_OUTSIDE_RANGE",
      "MESH_ASPECT_RATIO_HIGH",
      "MESH_THICKNESS_TO_EDGE_LOW",
    ]);
    expect(report.diagnostics.every((diagnostic) => diagnostic.severity === "warning"))
      .toBe(true);
    expect(report.diagnostics.every((diagnostic) => diagnostic.elementIds[0] === 0))
      .toBe(true);
  });

  it("hard-rejects non-positive Jacobians with an error diagnostic", () => {
    const mesh = makeSingleElementMesh(
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      [0, 3, 2, 1],
    );

    try {
      evaluateStructuredMeshQuality(mesh, 0.2);
      throw new Error("Expected mesh quality to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(MeshQualityError);
      expect((error as MeshQualityError).diagnostics).toEqual([
        {
          code: "MESH_NON_POSITIVE_JACOBIAN",
          severity: "error",
          message: "Mesh element 0 has a non-finite or non-positive Q4 Jacobian.",
          elementIds: [0],
        },
      ]);
    }
  });

  it("hard-rejects stale stored polygon metadata", () => {
    const mesh = makeMesh(19, 1, 1);
    const first = mesh.elements[0].polygon[0];
    mesh.elements[0].polygon = [
      { x: first.x + 0.01, y: first.y },
      ...mesh.elements[0].polygon.slice(1),
    ];

    try {
      evaluateStructuredMeshQuality(mesh, ZERO_SKEW.thickness);
      throw new Error("Expected stale polygon metadata to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(MeshQualityError);
      expect((error as MeshQualityError).diagnostics[0]).toMatchObject({
        code: "MESH_ELEMENT_POLYGON_MISMATCH",
        severity: "error",
        elementIds: [0],
      });
    }
  });

  it("hard-rejects stale stored bounds metadata", () => {
    const mesh = makeMesh(19, 1, 1);
    mesh.elements[0].bounds = {
      ...mesh.elements[0].bounds,
      xMax: mesh.elements[0].bounds.xMax + 0.01,
    };

    try {
      evaluateStructuredMeshQuality(mesh, ZERO_SKEW.thickness);
      throw new Error("Expected stale bounds metadata to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(MeshQualityError);
      expect((error as MeshQualityError).diagnostics[0]).toMatchObject({
        code: "MESH_ELEMENT_BOUNDS_MISMATCH",
        severity: "error",
        elementIds: [0],
      });
    }
  });

  it.each([
    ["three", [0, 1, 2]],
    ["five", [0, 1, 2, 3, 0]],
  ])("hard-rejects a runtime %s-ID element topology", (_label, nodeIds) => {
    const mesh = makeMesh(0, 1, 1);
    (mesh.elements[0] as unknown as { nodeIds: number[] }).nodeIds = nodeIds;

    try {
      evaluateStructuredMeshQuality(mesh, ZERO_SKEW.thickness);
      throw new Error("Expected invalid runtime topology to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(MeshQualityError);
      expect((error as MeshQualityError).diagnostics[0]).toMatchObject({
        code: "MESH_ELEMENT_INVALID_TOPOLOGY",
        severity: "error",
        elementIds: [0],
      });
    }
  });
});
