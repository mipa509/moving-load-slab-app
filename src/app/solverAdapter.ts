import type {
  AnalysisResults,
  ContourData,
  Dof,
  ResultField,
  SlabModel,
} from "./types";

type SolverRunFn = (model: SlabModel) => Promise<unknown> | unknown;

interface SolverModuleLike {
  runFixedPositionAnalysis?: SolverRunFn;
}

declare global {
  interface Window {
    __slabSolver?: SolverModuleLike;
  }
}

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

const buildStubResults = (
  model: SlabModel,
  elapsedMs: number,
  warning?: string,
): AnalysisResults => {
  const pointsPerSide = 9;
  const dx = model.geometry.lengthM / (pointsPerSide - 1);
  const dy = model.geometry.widthM / (pointsPerSide - 1);
  const base = model.vehicle.mode === "axle"
    ? model.vehicle.axleInputs.reduce((sum, axle) => sum + axle.axleLoadKn, 0)
    : model.vehicle.directWheels.reduce((sum, wheel) => sum + wheel.loadKn, 0);

  const makeContour = (
    field: Exclude<ResultField, "reactions">,
    factor: number,
  ): ContourData => {
    const points = Array.from({ length: pointsPerSide * pointsPerSide }, (_, i) => {
      const xi = i % pointsPerSide;
      const yi = Math.floor(i / pointsPerSide);
      const xM = xi * dx;
      const yM = yi * dy;
      const xNorm = xM / Math.max(model.geometry.lengthM, 0.1);
      const yNorm = yM / Math.max(model.geometry.widthM, 0.1);
      const value = factor * base * Math.sin(Math.PI * xNorm) * Math.sin(Math.PI * yNorm);
      return { xM, yM, value };
    });
    return {
      field,
      points,
      min: Math.min(...points.map((p) => p.value)),
      max: Math.max(...points.map((p) => p.value)),
      units: defaultUnits[field],
    };
  };

  const contourMap = {
    deflection: makeContour("deflection", 0.02),
    mx: makeContour("mx", 0.004),
    my: makeContour("my", 0.0036),
    qx: makeContour("qx", 0.007),
    qy: makeContour("qy", 0.0065),
  };

  const reactionRows = model.supports.flatMap((support) =>
    (["uz", "rx", "ry"] as Dof[]).map((dof, idx) => ({
      supportId: support.id,
      dof,
      value: Number(((base / Math.max(model.supports.length, 1)) * (1 - idx * 0.25)).toFixed(3)),
      units: dof === "uz" ? "kN" : "kN*m",
    })),
  );

  return {
    status: "success",
    source: "stub",
    contours: contourMap,
    mesh: {
      xCoordsM: Array.from({ length: pointsPerSide }, (_, index) => index * dx),
      yCoordsM: Array.from({ length: pointsPerSide }, (_, index) => index * dy),
    },
    wheelPatches: [],
    reactions: reactionRows,
    summary: {
      maxDeflectionMm: Number(Math.abs(contourMap.deflection.max).toFixed(3)),
      maxAbsMomentKnmPerM: Number(
        Math.max(Math.abs(contourMap.mx.max), Math.abs(contourMap.my.max)).toFixed(3),
      ),
      maxAbsShearKnPerM: Number(
        Math.max(Math.abs(contourMap.qx.max), Math.abs(contourMap.qy.max)).toFixed(3),
      ),
    },
    elapsedMs,
    warning,
  };
};

export const runFixedAnalysis = async (model: SlabModel): Promise<AnalysisResults> => {
  const start = performance.now();
  let warning = "";

  let runFixedPositionAnalysis: SolverRunFn | undefined =
    window.__slabSolver?.runFixedPositionAnalysis;

  if (!runFixedPositionAnalysis) {
    try {
      const solverSpecifier = "../solver";
      const mod = (await import(/* @vite-ignore */ solverSpecifier)) as SolverModuleLike;
      runFixedPositionAnalysis = mod.runFixedPositionAnalysis;
    } catch {
      warning = "No solver module found yet; showing placeholder results.";
    }
  }

  if (!runFixedPositionAnalysis) {
    return buildStubResults(model, performance.now() - start, warning);
  }

  try {
    const raw = await runFixedPositionAnalysis(model);
    const elapsedMs = performance.now() - start;
    const payload = (raw ?? {}) as Record<string, unknown>;

    return {
      status: "success",
      source: "solver",
      contours: normalizeContours(payload.contours),
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
      reactions: Array.isArray(payload.reactions)
        ? payload.reactions.map((r) => ({
            supportId: String((r as { supportId?: unknown }).supportId ?? "unknown"),
            dof: (((r as { dof?: unknown }).dof as Dof) ?? "uz"),
            value: toNumber((r as { value?: unknown }).value),
            units: String((r as { units?: unknown }).units ?? "kN"),
          }))
        : [],
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
      warning: warning || (typeof payload.warning === "string" ? payload.warning : undefined),
    };
  } catch (error) {
    return {
      status: "error",
      source: "solver",
      contours: {},
      mesh: undefined,
      wheelPatches: [],
      reactions: [],
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
