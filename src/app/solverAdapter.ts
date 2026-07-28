import type {
  AnalysisResults,
  ContourData,
  Dof,
  ElementFieldMap,
  ElementFieldPoint,
  FieldDataBase,
  FieldLocation,
  MeshQualityReport,
  NodalFieldMap,
  NodalFieldPoint,
  ResultField,
  ResultUnits,
  ReactionRow,
  SignedEquilibrium,
  SlabModel,
  StagedSkewAppContract,
  NodalContourData,
  VerificationEvidenceStatus,
  WheelPatchOverlay,
} from "./types";
import { errorResults } from "./defaults";
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
      min: toNumber(obj.min, Math.min(...points.map((p) => p.value))),
      max: toNumber(obj.max, Math.max(...points.map((p) => p.value))),
      units: typeof obj.units === "string" ? obj.units : defaultUnits[field],
    };
  });

  return result;
};

const normalizeNodalContours = (
  rawContours: unknown,
): AnalysisResults["nodalContours"] => {
  if (!rawContours || typeof rawContours !== "object") return {};
  const asRecord = rawContours as Record<string, unknown>;
  const result: AnalysisResults["nodalContours"] = {};

  contourFields.forEach((field) => {
    const rawField = asRecord[field];
    if (!rawField || typeof rawField !== "object") return;
    const obj = rawField as Partial<NodalContourData>;
    if (!Array.isArray(obj.points)) return;
    const points = obj.points.map((p) => ({
      nodeId: toNumber((p as { nodeId?: unknown }).nodeId),
      xM: toNumber((p as { xM?: unknown }).xM),
      yM: toNumber((p as { yM?: unknown }).yM),
      value: toNumber((p as { value?: unknown }).value),
    }));
    result[field] = {
      field,
      points,
      min: toNumber(obj.min, Math.min(...points.map((p) => p.value))),
      max: toNumber(obj.max, Math.max(...points.map((p) => p.value))),
      units: typeof obj.units === "string" ? obj.units : defaultUnits[field],
    };
  });

  return result;
};

// --- WP-032C: skew-general evidence normalization -------------------------
//
// These fields are all OPTIONAL on `AnalysisResults`. The rule throughout is:
//   - field ABSENT on the payload  -> leave the AnalysisResults field
//     undefined (a partial/mock payload may legitimately omit it).
//   - field PRESENT but malformed  -> throw, so the caller's try/catch turns
//     this into a clean error result instead of silently synthesizing
//     passed/zero evidence.

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const requireFiniteNumber = (value: unknown, message: string): number => {
  if (!isFiniteNumber(value)) {
    throw new Error(message);
  }
  return value;
};

const requirePoint2D = (
  value: unknown,
  message: string,
): { xM: number; yM: number } => {
  const obj = (value ?? {}) as { xM?: unknown; yM?: unknown };
  return {
    xM: requireFiniteNumber(obj.xM, message),
    yM: requireFiniteNumber(obj.yM, message),
  };
};

const requireBoundsRect = (
  value: unknown,
  message: string,
): { xMinM: number; xMaxM: number; yMinM: number; yMaxM: number } => {
  if (!value || typeof value !== "object") {
    throw new Error(message);
  }
  const obj = value as {
    xMinM?: unknown;
    xMaxM?: unknown;
    yMinM?: unknown;
    yMaxM?: unknown;
  };
  return {
    xMinM: requireFiniteNumber(obj.xMinM, message),
    xMaxM: requireFiniteNumber(obj.xMaxM, message),
    yMinM: requireFiniteNumber(obj.yMinM, message),
    yMaxM: requireFiniteNumber(obj.yMaxM, message),
  };
};

const requireNullable = <T,>(
  value: unknown,
  parse: (value: unknown) => T,
): T | null => {
  if (value === null) return null;
  return parse(value);
};

const normalizeDeckPolygon = (
  raw: unknown,
): Array<{ xM: number; yM: number }> | undefined => {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error("Solver deckPolygon is present but is not an array.");
  }
  return raw.map((p) =>
    requirePoint2D(p, "Solver deckPolygon contains a non-finite vertex."),
  );
};

const normalizeDeckBounds = (
  raw: unknown,
): { xMinM: number; xMaxM: number; yMinM: number; yMaxM: number } | undefined => {
  if (raw === undefined) return undefined;
  return requireBoundsRect(raw, "Solver deckBounds is present but is malformed.");
};

const normalizeMeshNodeOverlaysV2 = (
  raw: unknown,
): StagedSkewAppContract.MeshNodeOverlayV2[] | undefined => {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error("Solver meshNodeOverlays is present but is not an array.");
  }
  return raw.map((entry) => {
    const obj = (entry ?? {}) as Record<string, unknown>;
    return {
      id: requireFiniteNumber(obj.id, "Solver meshNodeOverlays entry has a non-finite id."),
      xM: requireFiniteNumber(obj.xM, "Solver meshNodeOverlays entry has a non-finite xM."),
      yM: requireFiniteNumber(obj.yM, "Solver meshNodeOverlays entry has a non-finite yM."),
      sM: requireFiniteNumber(
        obj.sM,
        "Solver meshNodeOverlays entry has a non-finite sM (skew topology).",
      ),
      tM: requireFiniteNumber(
        obj.tM,
        "Solver meshNodeOverlays entry has a non-finite tM (skew topology).",
      ),
    };
  });
};

const normalizeMeshElementOverlaysV2 = (
  raw: unknown,
): StagedSkewAppContract.MeshElementOverlayV2[] | undefined => {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error("Solver meshElementOverlays is present but is not an array.");
  }
  return raw.map((entry) => {
    const obj = (entry ?? {}) as Record<string, unknown>;

    const rawNodeIds = obj.nodeIds;
    if (!Array.isArray(rawNodeIds) || rawNodeIds.length !== 4) {
      throw new Error(
        "Solver meshElementOverlays entry does not have exactly 4 nodeIds.",
      );
    }
    const nodeIds = rawNodeIds.map((v) =>
      requireFiniteNumber(v, "Solver meshElementOverlays entry has a non-finite nodeId."),
    ) as [number, number, number, number];

    const rawPolygon = obj.polygon;
    if (!Array.isArray(rawPolygon) || rawPolygon.length !== 4) {
      throw new Error(
        "Solver meshElementOverlays entry does not have exactly 4 polygon vertices.",
      );
    }
    const polygon = rawPolygon.map((p) =>
      requirePoint2D(
        p,
        "Solver meshElementOverlays entry has a non-finite polygon vertex.",
      ),
    );

    return {
      id: requireFiniteNumber(obj.id, "Solver meshElementOverlays entry has a non-finite id."),
      nodeIds,
      polygon,
      bounds: requireBoundsRect(
        obj.bounds,
        "Solver meshElementOverlays entry has non-finite bounds.",
      ),
    };
  });
};

const normalizeWheelPatchOverlays = (
  raw: unknown,
): WheelPatchOverlay[] | undefined => {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error("Solver wheelPatchOverlays is present but is not an array.");
  }
  return raw.map((entry) => {
    const obj = (entry ?? {}) as Record<string, unknown>;

    const rawOriginalPolygon = obj.originalPolygon;
    if (!Array.isArray(rawOriginalPolygon)) {
      throw new Error("Solver wheelPatchOverlays entry is missing originalPolygon.");
    }
    const originalPolygon = rawOriginalPolygon.map((p) =>
      requirePoint2D(
        p,
        "Solver wheelPatchOverlays entry has a non-finite originalPolygon vertex.",
      ),
    );

    const clippedPolygon = requireNullable(obj.clippedPolygon, (value) => {
      if (!Array.isArray(value)) {
        throw new Error("Solver wheelPatchOverlays entry has an invalid clippedPolygon.");
      }
      return value.map((p) =>
        requirePoint2D(
          p,
          "Solver wheelPatchOverlays entry has a non-finite clippedPolygon vertex.",
        ),
      );
    });

    const clippedBounds = requireNullable(obj.clippedBounds, (value) =>
      requireBoundsRect(
        value,
        "Solver wheelPatchOverlays entry has non-finite clippedBounds.",
      ),
    );

    const clippedCentroidM = requireNullable(obj.clippedCentroidM, (value) =>
      requirePoint2D(
        value,
        "Solver wheelPatchOverlays entry has a non-finite clippedCentroidM.",
      ),
    );

    return {
      id: typeof obj.id === "string" ? obj.id : String(obj.id ?? "unknown"),
      sourceWheelId:
        typeof obj.sourceWheelId === "string" ? obj.sourceWheelId : String(obj.sourceWheelId ?? "unknown"),
      originalPolygon,
      clippedPolygon,
      originalBounds: requireBoundsRect(
        obj.originalBounds,
        "Solver wheelPatchOverlays entry has non-finite originalBounds.",
      ),
      clippedBounds,
      originalAreaM2: requireFiniteNumber(
        obj.originalAreaM2,
        "Solver wheelPatchOverlays entry has a non-finite originalAreaM2.",
      ),
      clippedAreaM2: requireFiniteNumber(
        obj.clippedAreaM2,
        "Solver wheelPatchOverlays entry has a non-finite clippedAreaM2.",
      ),
      clippedCentroidM,
      wheelLoadKn: requireFiniteNumber(
        obj.wheelLoadKn,
        "Solver wheelPatchOverlays entry has a non-finite wheelLoadKn.",
      ),
      pressureKnPerM2: requireFiniteNumber(
        obj.pressureKnPerM2,
        "Solver wheelPatchOverlays entry has a non-finite pressureKnPerM2.",
      ),
    };
  });
};

const normalizeEquilibrium = (raw: unknown): SignedEquilibrium | undefined => {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object") {
    throw new Error("Solver equilibrium is present but is not an object.");
  }
  const normalizedResidual = (raw as { normalizedResidual?: unknown }).normalizedResidual;
  if (!normalizedResidual || typeof normalizedResidual !== "object") {
    throw new Error("Solver equilibrium.normalizedResidual is missing or malformed.");
  }
  const nr = normalizedResidual as Record<string, unknown>;
  requireFiniteNumber(nr.forceZ, "Solver equilibrium.normalizedResidual.forceZ is not finite.");
  requireFiniteNumber(nr.momentX, "Solver equilibrium.normalizedResidual.momentX is not finite.");
  requireFiniteNumber(nr.momentY, "Solver equilibrium.normalizedResidual.momentY is not finite.");
  return raw as SignedEquilibrium;
};

const normalizeMeshQuality = (raw: unknown): MeshQualityReport | undefined => {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object") {
    throw new Error("Solver meshQuality is present but is not an object.");
  }
  const obj = raw as Record<string, unknown>;
  if (obj.status !== "ok" && obj.status !== "warning") {
    throw new Error("Solver meshQuality.status is missing or invalid.");
  }
  if (!Array.isArray(obj.elements)) {
    throw new Error("Solver meshQuality.elements is missing or not an array.");
  }
  return raw as MeshQualityReport;
};

const normalizeVerification = (
  raw: unknown,
): VerificationEvidenceStatus | undefined => {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object") {
    throw new Error("Solver verification is present but is not an object.");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.currentModelConvergence !== "string") {
    // Never fabricate a passed/demonstrated status when the solver did not
    // report one.
    throw new Error("Solver verification.currentModelConvergence is missing.");
  }
  return raw as VerificationEvidenceStatus;
};

const buildFieldData = <
  F extends "deflection" | "mx" | "my" | "mxy" | "qx" | "qy",
  L extends FieldLocation,
  U extends ResultUnits,
  P,
>(
  field: F,
  location: L,
  units: U,
  points: P[],
  values: number[],
): FieldDataBase<F, L, U, P> => ({
  field,
  location,
  points,
  min: values.length > 0 ? Math.min(...values) : 0,
  max: values.length > 0 ? Math.max(...values) : 0,
  units,
});

interface RawNodalRecoveryEntry {
  nodeId: number;
  xM: number;
  yM: number;
  sM: number;
  tM: number;
  deflectionMm: number;
  mxKnmPerM: number;
  myKnmPerM: number;
  mxyKnmPerM: number;
}

const parseNodalRecoveryEntry = (entry: unknown): RawNodalRecoveryEntry => {
  const obj = (entry ?? {}) as Record<string, unknown>;
  return {
    nodeId: requireFiniteNumber(obj.nodeId, "Solver nodalRecovery entry has a non-finite nodeId."),
    xM: requireFiniteNumber(obj.xM, "Solver nodalRecovery entry has a non-finite xM."),
    yM: requireFiniteNumber(obj.yM, "Solver nodalRecovery entry has a non-finite yM."),
    sM: requireFiniteNumber(
      obj.sM,
      "Solver nodalRecovery entry has a non-finite sM (skew topology).",
    ),
    tM: requireFiniteNumber(
      obj.tM,
      "Solver nodalRecovery entry has a non-finite tM (skew topology).",
    ),
    deflectionMm: requireFiniteNumber(
      obj.deflectionMm,
      "Solver nodalRecovery entry has a non-finite deflectionMm.",
    ),
    mxKnmPerM: requireFiniteNumber(
      obj.mxKnmPerM,
      "Solver nodalRecovery entry has a non-finite mxKnmPerM.",
    ),
    myKnmPerM: requireFiniteNumber(
      obj.myKnmPerM,
      "Solver nodalRecovery entry has a non-finite myKnmPerM.",
    ),
    mxyKnmPerM: requireFiniteNumber(
      obj.mxyKnmPerM,
      "Solver nodalRecovery entry has a non-finite mxyKnmPerM.",
    ),
  };
};

const buildNodalPoints = (
  entries: RawNodalRecoveryEntry[],
  pick: (entry: RawNodalRecoveryEntry) => number,
): NodalFieldPoint[] =>
  entries.map((e) => ({ nodeId: e.nodeId, xM: e.xM, yM: e.yM, sM: e.sM, tM: e.tM, value: pick(e) }));

const buildNodalFieldMap = (raw: unknown): NodalFieldMap | undefined => {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error("Solver nodalRecovery is present but is not an array.");
  }
  const entries = raw.map(parseNodalRecoveryEntry);

  return {
    deflection: buildFieldData(
      "deflection",
      "node",
      "mm",
      buildNodalPoints(entries, (e) => e.deflectionMm),
      entries.map((e) => e.deflectionMm),
    ),
    mx: buildFieldData(
      "mx",
      "node",
      "kN*m/m",
      buildNodalPoints(entries, (e) => e.mxKnmPerM),
      entries.map((e) => e.mxKnmPerM),
    ),
    my: buildFieldData(
      "my",
      "node",
      "kN*m/m",
      buildNodalPoints(entries, (e) => e.myKnmPerM),
      entries.map((e) => e.myKnmPerM),
    ),
    mxy: buildFieldData(
      "mxy",
      "node",
      "kN*m/m",
      buildNodalPoints(entries, (e) => e.mxyKnmPerM),
      entries.map((e) => e.mxyKnmPerM),
    ),
  };
};

interface RawElementResultEntry {
  elementId: number;
  xM: number;
  yM: number;
  sM: number;
  tM: number;
  deflectionMm: number;
  mxKnmPerM: number;
  myKnmPerM: number;
  mxyKnmPerM: number;
  qxKnPerM: number;
  qyKnPerM: number;
}

const parseElementResultEntry = (entry: unknown): RawElementResultEntry => {
  const obj = (entry ?? {}) as Record<string, unknown>;
  return {
    elementId: requireFiniteNumber(
      obj.elementId,
      "Solver elementResultsFull entry has a non-finite elementId.",
    ),
    xM: requireFiniteNumber(obj.xM, "Solver elementResultsFull entry has a non-finite xM."),
    yM: requireFiniteNumber(obj.yM, "Solver elementResultsFull entry has a non-finite yM."),
    sM: requireFiniteNumber(
      obj.sM,
      "Solver elementResultsFull entry has a non-finite sM (skew topology).",
    ),
    tM: requireFiniteNumber(
      obj.tM,
      "Solver elementResultsFull entry has a non-finite tM (skew topology).",
    ),
    deflectionMm: requireFiniteNumber(
      obj.deflectionMm,
      "Solver elementResultsFull entry has a non-finite deflectionMm.",
    ),
    mxKnmPerM: requireFiniteNumber(
      obj.mxKnmPerM,
      "Solver elementResultsFull entry has a non-finite mxKnmPerM.",
    ),
    myKnmPerM: requireFiniteNumber(
      obj.myKnmPerM,
      "Solver elementResultsFull entry has a non-finite myKnmPerM.",
    ),
    mxyKnmPerM: requireFiniteNumber(
      obj.mxyKnmPerM,
      "Solver elementResultsFull entry has a non-finite mxyKnmPerM.",
    ),
    qxKnPerM: requireFiniteNumber(
      obj.qxKnPerM,
      "Solver elementResultsFull entry has a non-finite qxKnPerM.",
    ),
    qyKnPerM: requireFiniteNumber(
      obj.qyKnPerM,
      "Solver elementResultsFull entry has a non-finite qyKnPerM.",
    ),
  };
};

const buildElementPoints = (
  entries: RawElementResultEntry[],
  pick: (entry: RawElementResultEntry) => number,
): ElementFieldPoint[] =>
  entries.map((e) => ({
    elementId: e.elementId,
    xM: e.xM,
    yM: e.yM,
    sM: e.sM,
    tM: e.tM,
    value: pick(e),
  }));

const buildElementFieldMap = (raw: unknown): ElementFieldMap | undefined => {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error("Solver elementResultsFull is present but is not an array.");
  }
  const entries = raw.map(parseElementResultEntry);

  return {
    deflection: buildFieldData(
      "deflection",
      "element-center",
      "mm",
      buildElementPoints(entries, (e) => e.deflectionMm),
      entries.map((e) => e.deflectionMm),
    ),
    mx: buildFieldData(
      "mx",
      "element-center",
      "kN*m/m",
      buildElementPoints(entries, (e) => e.mxKnmPerM),
      entries.map((e) => e.mxKnmPerM),
    ),
    my: buildFieldData(
      "my",
      "element-center",
      "kN*m/m",
      buildElementPoints(entries, (e) => e.myKnmPerM),
      entries.map((e) => e.myKnmPerM),
    ),
    mxy: buildFieldData(
      "mxy",
      "element-center",
      "kN*m/m",
      buildElementPoints(entries, (e) => e.mxyKnmPerM),
      entries.map((e) => e.mxyKnmPerM),
    ),
    qx: buildFieldData(
      "qx",
      "element-center",
      "kN/m",
      buildElementPoints(entries, (e) => e.qxKnPerM),
      entries.map((e) => e.qxKnPerM),
    ),
    qy: buildFieldData(
      "qy",
      "element-center",
      "kN/m",
      buildElementPoints(entries, (e) => e.qyKnPerM),
      entries.map((e) => e.qyKnPerM),
    ),
  };
};

export const runFixedAnalysis = async (model: SlabModel): Promise<AnalysisResults> => {
  const start = performance.now();

  try {
    const raw = await runFixedPositionAnalysis(model);
    const elapsedMs = performance.now() - start;
    const payload = (raw ?? {}) as Record<string, unknown>;
    const contours = normalizeContours(payload.contours);
    const nodalContours = normalizeNodalContours(payload.nodalContours);
    const hasContourData = contourFields.some(
      (field) => (nodalContours[field]?.points.length ?? 0) > 0,
    );
    if (!hasContourData) {
      throw new Error("Solver returned no nodal contour field data.");
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

    // WP-032C: skew-general evidence. Each is optional on AnalysisResults —
    // absent on the payload stays undefined here; present-but-malformed
    // throws (caught below -> error result).
    const deckPolygon = normalizeDeckPolygon(payload.deckPolygon);
    const deckBounds = normalizeDeckBounds(payload.deckBounds);
    const meshNodeOverlays = normalizeMeshNodeOverlaysV2(payload.meshNodeOverlays);
    const meshElementOverlays = normalizeMeshElementOverlaysV2(payload.meshElementOverlays);
    const wheelPatchOverlays = normalizeWheelPatchOverlays(payload.wheelPatchOverlays);
    const nodalFields = buildNodalFieldMap(payload.nodalRecovery);
    const elementFields = buildElementFieldMap(payload.elementResultsFull);
    const equilibrium = normalizeEquilibrium(payload.equilibrium);
    const meshQuality = normalizeMeshQuality(payload.meshQuality);
    const verification = normalizeVerification(payload.verification);
    const warningRequired =
      typeof payload.warningRequired === "boolean" ? payload.warningRequired : false;

    return {
      status: "success",
      source: "solver",
      contours,
      nodalContours,
      meshNodes: Array.isArray(payload.meshNodes)
        ? payload.meshNodes.map((n) => ({
            id: toNumber((n as { id?: unknown }).id),
            xM: toNumber((n as { xM?: unknown }).xM),
            yM: toNumber((n as { yM?: unknown }).yM),
          }))
        : [],
      meshElements: Array.isArray(payload.meshElements)
        ? payload.meshElements.map((e) => {
            const rawIds = (e as { nodeIds?: unknown }).nodeIds;
            const ids = Array.isArray(rawIds) ? rawIds.map((v) => toNumber(v)) : [];
            return {
              id: toNumber((e as { id?: unknown }).id),
              nodeIds: ids.length === 4 ? (ids as [number, number, number, number]) : [0, 0, 0, 0],
            };
          })
        : [],
      nodalDisplacements: Array.isArray(payload.nodalDisplacements)
        ? payload.nodalDisplacements.map((nd) => ({
            nodeId: toNumber((nd as { nodeId?: unknown }).nodeId),
            wM: toNumber((nd as { wM?: unknown }).wM),
          }))
        : [],
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

      deckPolygon,
      deckBounds,
      meshNodeOverlays,
      meshElementOverlays,
      wheelPatchOverlays,
      nodalFields,
      elementFields,
      equilibrium,
      meshQuality,
      verification,
      warningRequired,
    };
  } catch (error) {
    return errorResults(
      error instanceof Error ? error.message : "Unknown solver error",
      { elapsedMs: performance.now() - start },
    );
  }
};
