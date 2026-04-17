import { recoverNodalFields } from "./post/recoverNodal";
import type { NodalFieldValues } from "./model/types";
import type { ContourData, NodalContourData, RectOverlay, SlabModel } from "../app/types";
import { fromAppModel } from "./model/fromAppModel";
import { runFixedPositionAnalysis as runInternalFixedPositionAnalysis } from "./runFixedPositionAnalysis";

type SolverPayload = {
  contours: Record<string, ContourData>;
  nodalContours: Record<string, NodalContourData>;
  mesh: { xCoordsM: number[]; yCoordsM: number[] };
  meshNodes: { id: number; xM: number; yM: number }[];
  meshElements: { id: number; nodeIds: [number, number, number, number] }[];
  nodalDisplacements: { nodeId: number; wM: number }[];
  wheelPatches: RectOverlay[];
  reactions: {
    supportId: string;
    nodeId: number;
    dof: "uz" | "rx" | "ry";
    type: "fixed" | "spring";
    value: number;
    units: string;
  }[];
  summary: {
    maxDeflectionMm: number;
    maxAbsMomentKnmPerM: number;
    maxAbsShearKnPerM: number;
  };
  warning?: string;
};

export function runFixedPositionAnalysis(model: SlabModel): SolverPayload {
  const internalModel = fromAppModel(model);
  const result = runInternalFixedPositionAnalysis(internalModel);

  // Reconstruct the full global displacement vector from per-node data
  const nodeCount = result.mesh.nodes.length;
  const fullDisp = new Float64Array(nodeCount * 3);
  for (const nd of result.nodalDisplacements) {
    fullDisp[nd.nodeId * 3] = nd.w;
    fullDisp[nd.nodeId * 3 + 1] = nd.rx;
    fullDisp[nd.nodeId * 3 + 2] = nd.ry;
  }

  const nodalFields = recoverNodalFields(
    result.mesh,
    internalModel.material,
    internalModel.slab.thickness,
    fullDisp,
  );

  const nodalContours: Record<string, NodalContourData> = {
    deflection: toNodalContour("deflection", nodalFields, (n) => n.deflection * 1000, "mm"),
    mx: toNodalContour("mx", nodalFields, (n) => n.mx, "kN*m/m"),
    my: toNodalContour("my", nodalFields, (n) => n.my, "kN*m/m"),
    qx: toNodalContour("qx", nodalFields, (n) => n.qx, "kN/m"),
    qy: toNodalContour("qy", nodalFields, (n) => n.qy, "kN/m"),
  };

  return {
    contours: {
      deflection: toContour("deflection", result, (item) => item.deflection * 1000, "mm"),
      mx: toContour("mx", result, (item) => item.moments.mx, "kN*m/m"),
      my: toContour("my", result, (item) => item.moments.my, "kN*m/m"),
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
