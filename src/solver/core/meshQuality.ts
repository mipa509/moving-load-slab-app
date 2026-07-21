import type {
  ElementQualityMetrics,
  MeshQualityDiagnostic,
  MeshQualityErrorDiagnostic,
  MeshQualityReport,
} from "../../app/types";
import type { MeshNode, StructuredMesh } from "../model/types";
import {
  MeshElementGeometryInvariantError,
  resolveMeshElementGeometry,
} from "./mesh";
import { evaluateQ4Jacobian } from "./q4Geometry";

export const MESH_QUALITY_DEFINITION_ID = "q4-structured-mesh-quality-v1";

/**
 * Frozen warning thresholds for the first skew release.
 *
 * Scaled Jacobian is det(J)/(|J_xi| |J_eta|) at the four natural corners.
 * Aspect ratio is longest/shortest physical edge. Interior angles use adjacent
 * physical edge vectors. The thickness indicator is thickness/max edge.
 *
 * The numerical limits are internal engineering screens chosen to flag severe
 * Q4 distortion (scaled Jacobian/angles/aspect) and unusually coarse
 * thickness-relative sizing before solve. They are advisory heuristics, not a
 * design-code, product, or verification acceptance criterion, and remain
 * subject to Chartered Engineer and end-stage verification review. Only
 * non-finite, collapsed, or non-positive-Jacobian geometry is a hard failure.
 */
export const MESH_QUALITY_THRESHOLDS = Object.freeze({
  scaledJacobianMin: 0.3,
  interiorAngleMinDeg: 30,
  interiorAngleMaxDeg: 150,
  aspectRatioMax: 5,
  thicknessToMaxEdgeRatioMin: 0.02,
});

const JACOBIAN_SAMPLE_POINTS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
  [0, 0],
];

const WARNING_ORDER = [
  "MESH_SCALED_JACOBIAN_LOW",
  "MESH_INTERIOR_ANGLE_OUTSIDE_RANGE",
  "MESH_ASPECT_RATIO_HIGH",
  "MESH_THICKNESS_TO_EDGE_LOW",
] as const;

type MeshQualityWarningCode = (typeof WARNING_ORDER)[number];

const WARNING_MESSAGES: Record<MeshQualityWarningCode, string> = {
  MESH_SCALED_JACOBIAN_LOW:
    `Minimum scaled Jacobian is below ${MESH_QUALITY_THRESHOLDS.scaledJacobianMin}.`,
  MESH_INTERIOR_ANGLE_OUTSIDE_RANGE:
    `An interior angle is outside ${MESH_QUALITY_THRESHOLDS.interiorAngleMinDeg}-${MESH_QUALITY_THRESHOLDS.interiorAngleMaxDeg} degrees.`,
  MESH_ASPECT_RATIO_HIGH:
    `Edge-length aspect ratio exceeds ${MESH_QUALITY_THRESHOLDS.aspectRatioMax}.`,
  MESH_THICKNESS_TO_EDGE_LOW:
    `Thickness/max-edge ratio is below ${MESH_QUALITY_THRESHOLDS.thicknessToMaxEdgeRatioMin}.`,
};

export class MeshQualityError extends Error {
  readonly diagnostics: MeshQualityErrorDiagnostic[];

  constructor(diagnostic: MeshQualityErrorDiagnostic) {
    super(diagnostic.message);
    this.name = "MeshQualityError";
    this.diagnostics = [diagnostic];
  }
}

export function evaluateStructuredMeshQuality(
  mesh: StructuredMesh,
  thicknessM: number,
): MeshQualityReport {
  if (!Number.isFinite(thicknessM) || thicknessM <= 0) {
    throwQualityError(
      "MESH_INVALID_THICKNESS",
      "Mesh-quality thickness must be finite and strictly positive.",
      [],
    );
  }

  const elements = mesh.elements.map((element) => {
    let nodes: [MeshNode, MeshNode, MeshNode, MeshNode];
    try {
      nodes = resolveMeshElementGeometry(mesh, element).nodes;
    } catch (error) {
      if (error instanceof MeshElementGeometryInvariantError) {
        throwQualityError(error.code, error.message, [error.elementId]);
      }
      throw error;
    }
    return evaluateElementQuality(element.id, nodes, thicknessM);
  });

  const diagnostics: MeshQualityDiagnostic[] = [];
  for (const code of WARNING_ORDER) {
    const elementIds = elements
      .filter((element) => element.diagnosticCodes.includes(code))
      .map((element) => element.elementId);
    if (elementIds.length > 0) {
      diagnostics.push({
        code,
        severity: "warning",
        message: WARNING_MESSAGES[code],
        elementIds,
      });
    }
  }

  return {
    definitionId: MESH_QUALITY_DEFINITION_ID,
    elements,
    status: diagnostics.length === 0 ? "ok" : "warning",
    diagnostics,
  };
}

function evaluateElementQuality(
  elementId: number,
  nodes: [MeshNode, MeshNode, MeshNode, MeshNode],
  thicknessM: number,
): ElementQualityMetrics {
  const edgeLengths = nodes.map((node, index) =>
    distance(node, nodes[(index + 1) % nodes.length]),
  );
  if (edgeLengths.some((length) => !Number.isFinite(length) || length <= 0)) {
    throwQualityError(
      "MESH_COLLAPSED_EDGE",
      `Mesh element ${elementId} has a collapsed or non-finite edge.`,
      [elementId],
    );
  }

  const determinants: number[] = [];
  const scaledJacobians: number[] = [];
  for (const [xi, eta] of JACOBIAN_SAMPLE_POINTS) {
    let jacobian: ReturnType<typeof evaluateQ4Jacobian>;
    try {
      jacobian = evaluateQ4Jacobian(nodes, xi, eta);
    } catch {
      throwQualityError(
        "MESH_NON_POSITIVE_JACOBIAN",
        `Mesh element ${elementId} has a non-finite or non-positive Q4 Jacobian.`,
        [elementId],
      );
    }
    determinants.push(jacobian.determinant);
    if (Math.abs(xi) === 1 && Math.abs(eta) === 1) {
      const xiLength = Math.hypot(jacobian.matrix[0], jacobian.matrix[2]);
      const etaLength = Math.hypot(jacobian.matrix[1], jacobian.matrix[3]);
      const denominator = xiLength * etaLength;
      if (!Number.isFinite(denominator) || denominator <= 0) {
        throwQualityError(
          "MESH_COLLAPSED_JACOBIAN_AXIS",
          `Mesh element ${elementId} has a collapsed Jacobian axis.`,
          [elementId],
        );
      }
      scaledJacobians.push(jacobian.determinant / denominator);
    }
  }

  const interiorAngles = nodes.map((node, index) => {
    const previous = nodes[(index + nodes.length - 1) % nodes.length];
    const next = nodes[(index + 1) % nodes.length];
    const ax = previous.x - node.x;
    const ay = previous.y - node.y;
    const bx = next.x - node.x;
    const by = next.y - node.y;
    const denominator = Math.hypot(ax, ay) * Math.hypot(bx, by);
    const cosine = Math.max(-1, Math.min(1, (ax * bx + ay * by) / denominator));
    return (Math.acos(cosine) * 180) / Math.PI;
  });

  const minEdgeLengthM = Math.min(...edgeLengths);
  const maxEdgeLengthM = Math.max(...edgeLengths);
  const minInteriorAngleDeg = Math.min(...interiorAngles);
  const maxInteriorAngleDeg = Math.max(...interiorAngles);
  const aspectRatio = maxEdgeLengthM / minEdgeLengthM;
  const thicknessToMaxEdgeRatio = thicknessM / maxEdgeLengthM;
  const scaledJacobianMin = Math.min(...scaledJacobians);
  const diagnosticCodes: string[] = [];

  if (scaledJacobianMin < MESH_QUALITY_THRESHOLDS.scaledJacobianMin) {
    diagnosticCodes.push("MESH_SCALED_JACOBIAN_LOW");
  }
  if (
    minInteriorAngleDeg < MESH_QUALITY_THRESHOLDS.interiorAngleMinDeg ||
    maxInteriorAngleDeg > MESH_QUALITY_THRESHOLDS.interiorAngleMaxDeg
  ) {
    diagnosticCodes.push("MESH_INTERIOR_ANGLE_OUTSIDE_RANGE");
  }
  if (aspectRatio > MESH_QUALITY_THRESHOLDS.aspectRatioMax) {
    diagnosticCodes.push("MESH_ASPECT_RATIO_HIGH");
  }
  if (
    thicknessToMaxEdgeRatio <
    MESH_QUALITY_THRESHOLDS.thicknessToMaxEdgeRatioMin
  ) {
    diagnosticCodes.push("MESH_THICKNESS_TO_EDGE_LOW");
  }

  return {
    elementId,
    determinantMin: Math.min(...determinants),
    determinantMax: Math.max(...determinants),
    scaledJacobianMin,
    minEdgeLengthM,
    maxEdgeLengthM,
    minInteriorAngleDeg,
    maxInteriorAngleDeg,
    aspectRatio,
    thicknessToMaxEdgeRatio,
    severity: diagnosticCodes.length === 0 ? "ok" : "warning",
    diagnosticCodes,
  };
}

function distance(a: MeshNode, b: MeshNode): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function throwQualityError(
  code: string,
  message: string,
  elementIds: number[],
): never {
  throw new MeshQualityError({
    code,
    severity: "error",
    message,
    elementIds,
  });
}
