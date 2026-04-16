import type { ContourData, RectOverlay, SlabModel } from "../app/types";
import { fromAppModel } from "./model/fromAppModel";
import { runFixedPositionAnalysis as runInternalFixedPositionAnalysis } from "./runFixedPositionAnalysis";

type SolverPayload = {
  contours: Record<string, ContourData>;
  mesh: { xCoordsM: number[]; yCoordsM: number[] };
  wheelPatches: RectOverlay[];
  reactions: { supportId: string; dof: "uz" | "rx" | "ry"; value: number; units: string }[];
  summary: {
    maxDeflectionMm: number;
    maxAbsMomentKnmPerM: number;
    maxAbsShearKnPerM: number;
  };
  warning?: string;
};

export function runFixedPositionAnalysis(model: SlabModel): SolverPayload {
  const result = runInternalFixedPositionAnalysis(fromAppModel(model));

  return {
    contours: {
      deflection: toContour("deflection", result, (item) => item.deflection * 1000, "mm"),
      mx: toContour("mx", result, (item) => item.moments.mx, "kN*m/m"),
      my: toContour("my", result, (item) => item.moments.my, "kN*m/m"),
      qx: toContour("qx", result, (item) => item.shears.qx, "kN/m"),
      qy: toContour("qy", result, (item) => item.shears.qy, "kN/m"),
    },
    mesh: {
      xCoordsM: result.mesh.xCoords,
      yCoordsM: result.mesh.yCoords,
    },
    wheelPatches: result.wheelPatches
      .filter((patch) => patch.clippedBounds)
      .map((patch) => ({
        xMinM: patch.originalBounds.xMin,
        xMaxM: patch.originalBounds.xMax,
        yMinM: patch.originalBounds.yMin,
        yMaxM: patch.originalBounds.yMax,
      })),
    reactions: result.supportReactions.map((reaction) => ({
      supportId: reaction.supportId,
      dof: reaction.dof === "w" ? "uz" : reaction.dof,
      value: reaction.value,
      units: reaction.dof === "w" ? "kN" : "kN*m",
    })),
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
