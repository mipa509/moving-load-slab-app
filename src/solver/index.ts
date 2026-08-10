import type { NodalFieldValues } from "./model/types";
import type {
  ContourData,
  ElementCenterPlateResult,
  MeshQualityReport,
  NodalContourData,
  NodalRecoveredPlateResult,
  RectOverlay,
  SignedEquilibrium,
  SlabModel,
  StagedSkewAppContract,
  VerificationEvidenceStatus,
  WheelPatchOverlay,
} from "../app/types";
import { fromAppModel, normalizeSolverGeometry } from "./model/fromAppModel";
import {
  buildDeckPolygon,
  getDeckBounds,
  globalToDeckLocal,
} from "./geometry/deckCoordinates";
import { evaluateStructuredMeshQuality } from "./core/meshQuality";
import type { GeneratedWheelPatch } from "./loads/vehicle";
import { runFixedPositionAnalysis as runInternalFixedPositionAnalysis } from "./runFixedPositionAnalysis";

type SolverPayload = {
  contours: Record<string, ContourData>;
  nodalContours: Record<string, NodalContourData>;
  /** @deprecated Local (non-global) rectangular axes; use meshNodeOverlays/meshElementOverlays for skew-general geometry. */
  mesh: { xCoordsM: number[]; yCoordsM: number[] };
  meshNodes: { id: number; xM: number; yM: number }[];
  meshElements: { id: number; nodeIds: [number, number, number, number] }[];
  nodalDisplacements: { nodeId: number; wM: number }[];
  /** @deprecated Rectangular AABB overlay; use wheelPatchOverlays for full clipped-polygon evidence. */
  wheelPatches: RectOverlay[];
  reactions: {
    supportId: string;
    nodeId: number;
    dof: "uz" | "rx" | "ry";
    type: "fixed" | "spring";
    value: number;
    units: string;
    /** Added by WP-032A; optional so existing narrower payload literals (e.g. mocks) remain valid. */
    xM?: number;
    yM?: number;
  }[];
  summary: {
    maxDeflectionMm: number;
    maxAbsMomentKnmPerM: number;
    maxAbsShearKnPerM: number;
  };
  warning?: string;

  // WP-032A evidence fields. The real facade always populates every one of
  // these; they are typed optional only so pre-existing narrower payload
  // literals (e.g. mocked solver results in solverAdapter.test.ts, outside
  // this packet's file lease) remain valid without being edited.
  deckPolygon?: Array<{ xM: number; yM: number }>;
  deckBounds?: { xMinM: number; xMaxM: number; yMinM: number; yMaxM: number };
  meshNodeOverlays?: StagedSkewAppContract.MeshNodeOverlayV2[];
  meshElementOverlays?: StagedSkewAppContract.MeshElementOverlayV2[];
  wheelPatchOverlays?: WheelPatchOverlay[];
  nodalRecovery?: NodalRecoveredPlateResult[];
  elementResultsFull?: ElementCenterPlateResult[];
  equilibrium?: SignedEquilibrium;
  meshQuality?: MeshQualityReport;
  verification?: VerificationEvidenceStatus;
  warningRequired?: boolean;
};

export function runFixedPositionAnalysis(model: SlabModel): SolverPayload {
  const internalModel = fromAppModel(model);
  const result = runInternalFixedPositionAnalysis(internalModel);
  const geometry = normalizeSolverGeometry(internalModel.slab);

  const nodalContours: Record<string, NodalContourData> = {
    deflection: toNodalContour("deflection", result.nodalFields, (n) => n.deflection * 1000, "mm"),
    mx: toNodalContour("mx", result.nodalFields, (n) => n.mx, "kN*m/m"),
    my: toNodalContour("my", result.nodalFields, (n) => n.my, "kN*m/m"),
    mxy: toNodalContour("mxy", result.nodalFields, (n) => n.mxy, "kN*m/m"),
    qx: toNodalContour("qx", result.nodalFields, (n) => n.qx, "kN/m"),
    qy: toNodalContour("qy", result.nodalFields, (n) => n.qy, "kN/m"),
  };

  const nodesById = new Map(result.mesh.nodes.map((node) => [node.id, node]));
  const wheelPatchesV2 = result.wheelPatches as GeneratedWheelPatch[];
  const deckBounds = getDeckBounds(geometry);

  return {
    contours: {
      deflection: toContour("deflection", result, (item) => item.deflection * 1000, "mm"),
      mx: toContour("mx", result, (item) => item.moments.mx, "kN*m/m"),
      my: toContour("my", result, (item) => item.moments.my, "kN*m/m"),
      mxy: toContour("mxy", result, (item) => item.moments.mxy, "kN*m/m"),
      qx: toContour("qx", result, (item) => item.shears.qx, "kN/m"),
      qy: toContour("qy", result, (item) => item.shears.qy, "kN/m"),
    },
    nodalContours,
    mesh: {
      xCoordsM: result.mesh.xCoords,
      yCoordsM: result.mesh.yCoords,
    },
    meshNodes: result.mesh.nodes.map((n) => ({ id: n.id, xM: n.x, yM: n.y })),
    meshElements: result.mesh.elements.map((e) => ({
      id: e.id,
      nodeIds: e.nodeIds,
    })),
    nodalDisplacements: result.nodalDisplacements.map((nd) => ({
      nodeId: nd.nodeId,
      wM: nd.w,
    })),
    wheelPatches: result.wheelPatches
      .filter((patch) => patch.clippedBounds)
      .map((patch) => ({
        xMinM: patch.originalBounds.xMin,
        xMaxM: patch.originalBounds.xMax,
        yMinM: patch.originalBounds.yMin,
        yMaxM: patch.originalBounds.yMax,
      })),
    reactions: result.supportReactions.map((reaction) => {
      const mappedDof = reaction.dof === "w" ? "uz" : reaction.dof;
      if (mappedDof !== "uz" && mappedDof !== "rx" && mappedDof !== "ry") {
        throw new Error(`Unexpected DOF key from solver: "${reaction.dof}"`);
      }
      return {
        supportId: reaction.supportId,
        nodeId: reaction.nodeId,
        dof: mappedDof,
        type: reaction.type,
        value: reaction.value,
        units: mappedDof === "uz" ? "kN" : "kN*m",
        xM: reaction.x,
        yM: reaction.y,
      };
    }),
    summary: {
      maxDeflectionMm:
        Math.max(Math.abs(result.summary.minDeflection), Math.abs(result.summary.maxDeflection)) *
        1000,
      maxAbsMomentKnmPerM: Math.max(result.summary.maxAbsMomentX, result.summary.maxAbsMomentY),
      maxAbsShearKnPerM: Math.max(result.summary.maxAbsShearX, result.summary.maxAbsShearY),
    },
    warning: result.warnings.length > 0 ? result.warnings.join(" ") : undefined,

    deckPolygon: buildDeckPolygon(geometry).map((p) => ({ xM: p.x, yM: p.y })),
    deckBounds: {
      xMinM: deckBounds.xMin,
      xMaxM: deckBounds.xMax,
      yMinM: deckBounds.yMin,
      yMaxM: deckBounds.yMax,
    },
    meshNodeOverlays: result.mesh.nodes.map((n) => ({
      id: n.id,
      xM: n.x,
      yM: n.y,
      sM: n.s,
      tM: n.t,
    })),
    meshElementOverlays: result.mesh.elements.map((e) => ({
      id: e.id,
      nodeIds: e.nodeIds,
      polygon: e.polygon.map((p) => ({ xM: p.x, yM: p.y })),
      bounds: {
        xMinM: e.bounds.xMin,
        xMaxM: e.bounds.xMax,
        yMinM: e.bounds.yMin,
        yMaxM: e.bounds.yMax,
      },
    })),
    wheelPatchOverlays: wheelPatchesV2.map((patch) => ({
      id: patch.id,
      sourceWheelId: patch.sourceWheelId,
      originalPolygon: patch.originalPolygon.map((p) => ({ xM: p.x, yM: p.y })),
      clippedPolygon: patch.clippedPolygon
        ? patch.clippedPolygon.map((p) => ({ xM: p.x, yM: p.y }))
        : null,
      originalBounds: {
        xMinM: patch.originalBounds.xMin,
        xMaxM: patch.originalBounds.xMax,
        yMinM: patch.originalBounds.yMin,
        yMaxM: patch.originalBounds.yMax,
      },
      clippedBounds: patch.clippedBounds
        ? {
            xMinM: patch.clippedBounds.xMin,
            xMaxM: patch.clippedBounds.xMax,
            yMinM: patch.clippedBounds.yMin,
            yMaxM: patch.clippedBounds.yMax,
          }
        : null,
      originalAreaM2: patch.originalAreaM2,
      clippedAreaM2: patch.clippedAreaM2,
      clippedCentroidM: patch.clippedCentroid
        ? { xM: patch.clippedCentroid.x, yM: patch.clippedCentroid.y }
        : null,
      wheelLoadKn: patch.wheelLoadKn,
      pressureKnPerM2: patch.pressureKnPerM2,
    })),
    nodalRecovery: result.nodalFields.map((field) => {
      const node = nodesById.get(field.nodeId);
      if (!node) {
        throw new Error(`Nodal field references unknown mesh node id ${field.nodeId}.`);
      }
      return {
        nodeId: field.nodeId,
        xM: field.x,
        yM: field.y,
        sM: node.s,
        tM: node.t,
        deflectionMm: field.deflection * 1000,
        mxKnmPerM: field.mx,
        myKnmPerM: field.my,
        mxyKnmPerM: field.mxy,
      };
    }),
    elementResultsFull: result.elementResults.map((e) => {
      const st = globalToDeckLocal(geometry, { x: e.center.x, y: e.center.y });
      return {
        elementId: e.elementId,
        xM: e.center.x,
        yM: e.center.y,
        sM: st.s,
        tM: st.t,
        deflectionMm: e.deflection * 1000,
        mxKnmPerM: e.moments.mx,
        myKnmPerM: e.moments.my,
        mxyKnmPerM: e.moments.mxy,
        qxKnPerM: e.shears.qx,
        qyKnPerM: e.shears.qy,
      };
    }),
    equilibrium: {
      originM: { xM: result.equilibrium.origin.x, yM: result.equilibrium.origin.y },
      applied: {
        forceZKn: result.equilibrium.applied.fz,
        momentXKnm: result.equilibrium.applied.momentX,
        momentYKnm: result.equilibrium.applied.momentY,
      },
      reactions: {
        forceZKn: result.equilibrium.reaction.fz,
        momentXKnm: result.equilibrium.reaction.momentX,
        momentYKnm: result.equilibrium.reaction.momentY,
      },
      residual: {
        forceZKn: result.equilibrium.residual.fz,
        momentXKnm: result.equilibrium.residual.momentX,
        momentYKnm: result.equilibrium.residual.momentY,
      },
      absoluteResidual: {
        forceZKn: Math.abs(result.equilibrium.residual.fz),
        momentXKnm: Math.abs(result.equilibrium.residual.momentX),
        momentYKnm: Math.abs(result.equilibrium.residual.momentY),
      },
      normalizedResidual: {
        forceZ: result.equilibrium.normalizedResidual.fz,
        momentX: result.equilibrium.normalizedResidual.momentX,
        momentY: result.equilibrium.normalizedResidual.momentY,
      },
      normalization: {
        characteristicLengthM: result.equilibrium.scales.characteristicLengthM,
        forceScaleKn: Math.max(result.equilibrium.scales.sumAbsAppliedForce, 1),
        momentScaleKnm: Math.max(
          result.equilibrium.scales.sumAbsAppliedForce * result.equilibrium.scales.characteristicLengthM +
            Math.max(
              result.equilibrium.scales.sumAbsAppliedMomentX,
              result.equilibrium.scales.sumAbsAppliedMomentY,
            ),
          1,
        ),
      },
    },
    meshQuality: evaluateStructuredMeshQuality(result.mesh, internalModel.slab.thickness),
    verification: {
      formulation: "conditional",
      referenceStudy19Deg: "not-run",
      currentModelConvergence: "not-demonstrated",
      evidenceIds: [],
    },
    warningRequired: geometry.skewAngleDeg !== 0,
  };
}

export { TRANSFER_SLAB_BENCHMARK_FIXTURE } from "./benchmarks/transferSlabFixture";
export type {
  AnalysisOptions,
  AxisDirection,
  BenchmarkFixtureMetadata,
  ElementCenterResult,
  FixedPositionAnalysisModel,
  FixedPositionAnalysisResult,
  LineSupportDefinition,
  MaterialDefinition,
  MeshSettings,
  PointSupportDefinition,
  SlabGeometry,
  StructuredMesh,
  SupportDefinition,
  SupportDofConstraint,
  SupportReaction,
  UnitSystem,
  VehicleDefinition,
  WheelPatch,
} from "./model/types";

function toContour(
  field: ContourData["field"],
  result: ReturnType<typeof runInternalFixedPositionAnalysis>,
  pick: (item: ReturnType<typeof runInternalFixedPositionAnalysis>["elementResults"][number]) => number,
  units: string,
): ContourData {
  const points = result.elementResults.map((item) => ({
    xM: item.center.x,
    yM: item.center.y,
    value: pick(item),
  }));

  return {
    field,
    points,
    min: Math.min(...points.map((point) => point.value)),
    max: Math.max(...points.map((point) => point.value)),
    units,
  };
}

function toNodalContour(
  field: NodalContourData["field"],
  nodes: NodalFieldValues[],
  pick: (node: NodalFieldValues) => number,
  units: string,
): NodalContourData {
  const points = nodes.map((node) => ({
    nodeId: node.nodeId,
    xM: node.x,
    yM: node.y,
    value: pick(node),
  }));
  if (points.length === 0) {
    return { field, points, min: 0, max: 0, units };
  }
  return {
    field,
    points,
    min: Math.min(...points.map((p) => p.value)),
    max: Math.max(...points.map((p) => p.value)),
    units,
  };
}
