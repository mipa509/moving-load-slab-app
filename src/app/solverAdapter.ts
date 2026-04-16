import type {
  AnalysisResults,
  ContourData,
  Dof,
  ResultField,
  ReactionRow,
  SlabModel,
} from "./types";
import { summarizeReactions } from "./reactionSummary";
import { runFixedPositionAnalysis } from "../solver";

const contourFields: Exclude<ResultField, "reactions">[] = [
  "deflection",
  "mx",
  "my",
  "qx",
  "qy",
];

const defaultUnits: Record<Exclude<ResultField, "reactions">, string> = {
  deflection: "mm",
  mx: "kN*m/m",
  my: "kN*m/m",
  qx: "kN/m",
  qy: "kN/m",
};

const toNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const isDof = (value: unknown): value is Dof =>
  value === "uz" || value === "rx" || value === "ry";

const parseReactionType = (value: unknown): ReactionRow["type"] =>
  value === "fixed" || value === "spring" ? value : undefined;

const normalizeContours = (
  rawContours: unknown,
): AnalysisResults["contours"] => {
  if (!rawContours || typeof rawContours !== "object") {
    return {};
  }
  const asRecord = rawContours as Record<string, unknown>;
  const result: AnalysisResults["contours"] = {};

  contourFields.forEach((field) => {
    const rawField = asRecord[field];
    if (!rawField || typeof rawField !== "object") {
      return;
    }
    const obj = rawField as Partial<ContourData>;
    if (!Array.isArray(obj.points)) {
      return;
    }
    const points = obj.points.map((p) => ({
      xM: toNumber((p as { xM?: unknown }).xM),
      yM: toNumber((p as { yM?: unknown }).yM),
      value: toNumber((p as { value?: unknown }).value),
    }));
    result[field] = {
      field,
      points,
      min: toNumber(obj.min, Math.min(...points.map((p) => p.value), 0)),
      max: toNumber(obj.max, Math.max(...points.map((p) => p.value), 0)),
      units: typeof obj.units === "string" ? obj.units : defaultUnits[field],
    };
  });

  return result;
};

export const runFixedAnalysis = async (model: SlabModel): Promise<AnalysisResults> => {
  const start = performance.now();

  try {
    const raw = await runFixedPositionAnalysis(model);
    const elapsedMs = performance.now() - start;
    const payload = (raw ?? {}) as Record<string, unknown>;
    const contours = normalizeContours(payload.contours);
    const hasContourData = contourFields.some(
      (field) => (contours[field]?.points.length ?? 0) > 0,
    );
    if (!hasContourData) {
      throw new Error("Solver returned no contour field data.");
    }

    const reactions: ReactionRow[] = Array.isArray(payload.reactions)
      ? payload.reactions.map((r) => ({
          supportId: String((r as { supportId?: unknown }).supportId ?? "unknown"),
          nodeId:
            typeof (r as { nodeId?: unknown }).nodeId === "number" &&
            Number.isFinite((r as { nodeId?: unknown }).nodeId)
              ? ((r as { nodeId?: unknown }).nodeId as number)
              : undefined,
          dof: isDof((r as { dof?: unknown }).dof)
            ? (r as { dof: Dof }).dof
            : "uz",
          type: parseReactionType((r as { type?: unknown }).type),
          value: toNumber((r as { value?: unknown }).value),
          units: String((r as { units?: unknown }).units ?? "kN"),
        }))
      : [];
    const reactionSummary = summarizeReactions(reactions);

    return {
      status: "success",
      source: "solver",
      contours,
      mesh:
        payload.mesh && typeof payload.mesh === "object"
          ? {
              xCoordsM: Array.isArray((payload.mesh as { xCoordsM?: unknown }).xCoordsM)
                ? (payload.mesh as { xCoordsM: unknown[] }).xCoordsM.map((value) =>
                    toNumber(value),
                  )
                : [],
              yCoordsM: Array.isArray((payload.mesh as { yCoordsM?: unknown }).yCoordsM)
                ? (payload.mesh as { yCoordsM: unknown[] }).yCoordsM.map((value) =>
                    toNumber(value),
                  )
                : [],
            }
          : undefined,
      wheelPatches: Array.isArray(payload.wheelPatches)
        ? payload.wheelPatches.map((item) => ({
            xMinM: toNumber((item as { xMinM?: unknown }).xMinM),
            xMaxM: toNumber((item as { xMaxM?: unknown }).xMaxM),
            yMinM: toNumber((item as { yMinM?: unknown }).yMinM),
            yMaxM: toNumber((item as { yMaxM?: unknown }).yMaxM),
          }))
        : [],
      reactions,
      reactionSummaryBySupport: reactionSummary.reactionSummaryBySupport,
      reactionTotals: reactionSummary.reactionTotals,
      summary: {
        maxDeflectionMm: toNumber(
          (payload.summary as { maxDeflectionMm?: unknown } | undefined)?.maxDeflectionMm,
        ),
        maxAbsMomentKnmPerM: toNumber(
          (payload.summary as { maxAbsMomentKnmPerM?: unknown } | undefined)
            ?.maxAbsMomentKnmPerM,
        ),
        maxAbsShearKnPerM: toNumber(
          (payload.summary as { maxAbsShearKnPerM?: unknown } | undefined)?.maxAbsShearKnPerM,
        ),
      },
      elapsedMs,
      warning: typeof payload.warning === "string" ? payload.warning : undefined,
    };
  } catch (error) {
    return {
      status: "error",
      source: "solver",
      contours: {},
      mesh: undefined,
      wheelPatches: [],
      reactions: [],
      reactionSummaryBySupport: [],
      reactionTotals: {
        uz: 0,
        rx: 0,
        ry: 0,
      },
      summary: {
        maxDeflectionMm: 0,
        maxAbsMomentKnmPerM: 0,
        maxAbsShearKnPerM: 0,
      },
      elapsedMs: performance.now() - start,
      error: error instanceof Error ? error.message : "Unknown solver error",
    };
  }
};
