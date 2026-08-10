import { computeMindlinQ4ElementStiffness } from "./core/element";
import { generateStructuredMesh } from "./core/mesh";
import { normalizeSolverGeometry } from "./model/fromAppModel";
import {
  assertEquilibriumWithinTolerance,
  assertFiniteNodalFieldValues,
  assertStableSupportConfiguration,
  assertValidSolverState,
} from "./analysisGuards";
import { mapNormalizedSupportsToMesh } from "./core/supports";
import {
  addElementStiffnessToSparse,
  addToSparseDiagonal,
  buildReducedSystem,
  createSparseMatrix,
  expandReducedSolution,
  multiplySparseMatrixVector,
  solveConjugateGradient,
} from "./core/sparse";
import { assemblePolygonPatchLoads } from "./loads/patch";
import { generateWheelPatches } from "./loads/vehicle";
import { recoverElementCenterResults } from "./post/recover";
import { recoverNodalFields } from "./post/recoverNodal";
import {
  computeSignedEquilibrium,
  type NodalVerticalLoad,
  type SupportActionInput,
} from "./core/equilibrium";
import {
  type SupportDofConstraint,
  DOF_INDEX_BY_KEY,
  type FixedPositionAnalysisModel,
  type FixedPositionAnalysisResult,
  type FixedPositionAnalysisSummary,
  type InternalNormalizedSupport,
  type NodalDisplacement,
  type NormalizedGeneralizedDofConstraints,
  type NormalizedSupportRestraint,
  type SignConventionDefinition,
  type StructuredMesh,
  type SupportDefinition,
  type SupportDofAssignment,
  type SupportReaction,
} from "./model/types";

const DEFAULT_SIGN_CONVENTION: SignConventionDefinition = {
  transverseDeflection: "Positive w is positive in element local +z convention.",
  rotationX: "Positive rx follows right-hand rule about +x.",
  rotationY: "Positive ry follows right-hand rule about +y.",
  momentX: "Mx = Db * curvature_x (engineering plate sign from selected kinematics).",
  momentY: "My = Db * curvature_y (engineering plate sign from selected kinematics).",
  momentXY: "Mxy = Db * curvature_xy.",
  shearX: "Qx = Ds * gamma_xz.",
  shearY: "Qy = Ds * gamma_yz.",
};

export function runFixedPositionAnalysis(
  model: FixedPositionAnalysisModel,
): FixedPositionAnalysisResult {
  validateModel(model);

  const geometry = normalizeSolverGeometry(model.slab);
  const mesh = generateStructuredMesh(model.slab, model.mesh, model.supports);
  const totalDofs = mesh.nodes.length * 3;
  const globalK = createSparseMatrix(totalDofs);
  assembleGlobalStiffness(globalK, mesh, model);

  const normalizedSupports = model.supports.map(toNormalizedSupport);
  const mappedSupports = mapNormalizedSupportsToMesh(
    mesh,
    normalizedSupports,
    model.mesh.tolerance,
  );
  assertStableSupportConfiguration(mappedSupports.assignments);
  for (const [globalDof, stiffness] of mappedSupports.springStiffnessByDof) {
    addToSparseDiagonal(globalK, globalDof, stiffness);
  }

  const wheelPatches = generateWheelPatches(model.vehicle, model.slab);
  const loadAssembly = assemblePolygonPatchLoads(mesh, wheelPatches, totalDofs);

  const reduced = buildReducedSystem(
    globalK,
    loadAssembly.globalLoadVector,
    mappedSupports.fixedDofs,
  );

  const solveResult = solveConjugateGradient(reduced.matrix, reduced.rhs, {
    tolerance: model.options?.cgTolerance,
    absoluteTolerance: model.options?.cgAbsoluteTolerance,
    maxIterations: model.options?.cgMaxIterations,
  });

  const fullDisplacements = expandReducedSolution(
    solveResult.solution,
    reduced.freeToFull,
    totalDofs,
  );
  const residual = multiplySparseMatrixVector(globalK, fullDisplacements);
  for (let i = 0; i < residual.length; i += 1) {
    residual[i] -= loadAssembly.globalLoadVector[i];
  }

  const nodalDisplacements = buildNodalDisplacements(mesh, fullDisplacements);
  const supportReactions = buildSupportReactions(
    mesh,
    mappedSupports.assignments,
    fullDisplacements,
    residual,
  );
  const elementResults = recoverElementCenterResults(
    mesh,
    model.material,
    model.slab.thickness,
    fullDisplacements,
  );
  const nodalFields = recoverNodalFields(
    mesh,
    model.material,
    model.slab.thickness,
    fullDisplacements,
  );
  assertFiniteNodalFieldValues(nodalFields);

  // Signed global force/moment equilibrium about the ADR reporting origin (the
  // start-support centre). Consistent transverse patch loads are work-conjugate
  // to `w` only, so applied couples are zero; reactions carry the couples.
  const equilibrium = computeSignedEquilibrium({
    appliedLoads: buildAppliedVerticalLoads(mesh, loadAssembly.globalLoadVector),
    supportActions: buildSupportActions(supportReactions),
    origin: { x: 0, y: geometry.widthM / 2 },
    characteristicLengthM: Math.max(geometry.lengthM, geometry.widthM),
  });
  // Tolerance tied to the iterative-solver precision (never an arbitrary display
  // percentage); a sign/assembly inconsistency yields an O(1) normalized residual.
  const relativeSolverResidual =
    solveResult.initialResidualNorm > 0
      ? solveResult.residualNorm / solveResult.initialResidualNorm
      : solveResult.residualNorm;
  assertEquilibriumWithinTolerance(
    equilibrium,
    Math.max(1e-5, 1e3 * relativeSolverResidual),
  );

  const summary = buildSummary(loadAssembly.totalWheelLoad, loadAssembly.totalAppliedLoadToSlab, nodalDisplacements, elementResults, supportReactions);
  assertValidSolverState({
    converged: solveResult.converged,
    residualNorm: solveResult.residualNorm,
    initialResidualNorm: solveResult.initialResidualNorm,
    nodalDisplacements,
    elementResults,
    supportReactions,
    summary,
  });
  const warnings = collectWarnings(model, geometry.skewAngleDeg);

  return {
    units: {
      force: "kN",
      length: "m",
      stress: "MPa",
    },
    signConvention: DEFAULT_SIGN_CONVENTION,
    mesh,
    wheelPatches,
    nodalDisplacements,
    elementResults,
    nodalFields,
    supportReactions,
    equilibrium,
    summary,
    diagnostics: {
      converged: solveResult.converged,
      iterations: solveResult.iterations,
      residualNorm: solveResult.residualNorm,
      initialResidualNorm: solveResult.initialResidualNorm,
      totalDofs,
      freeDofs: reduced.freeToFull.length,
      fixedDofs: mappedSupports.fixedDofs.size,
    },
    warnings,
  };
}

function validateModel(model: FixedPositionAnalysisModel): void {
  if (model.slab.lengthX <= 0 || model.slab.lengthY <= 0 || model.slab.thickness <= 0) {
    throw new Error("Slab geometry must have positive dimensions and thickness.");
  }
  if (model.material.elasticModulusMPa <= 0) {
    throw new Error("Material elasticModulusMPa must be positive.");
  }
  if (
    !Number.isFinite(model.material.poissonRatio) ||
    model.material.poissonRatio <= -1 ||
    model.material.poissonRatio >= 0.5
  ) {
    throw new Error("Material poissonRatio must be between -1 and 0.5 (exclusive).");
  }
  if (model.mesh.targetElementsX < 1 || model.mesh.targetElementsY < 1) {
    throw new Error("Mesh targetElementsX and targetElementsY must be at least 1.");
  }
  if (model.vehicle.kind === "axle-builder" && model.vehicle.axles.length === 0) {
    throw new Error("Axle-builder vehicle requires at least one axle.");
  }
  if (model.vehicle.kind === "explicit-wheels" && model.vehicle.wheels.length === 0) {
    throw new Error("Explicit wheel vehicle requires at least one wheel.");
  }
}

function assembleGlobalStiffness(
  globalK: ReturnType<typeof createSparseMatrix>,
  mesh: StructuredMesh,
  model: FixedPositionAnalysisModel,
): void {
  for (const element of mesh.elements) {
    const elementNodes = element.nodeIds.map((nodeId) => mesh.nodes[nodeId]) as [
      StructuredMesh["nodes"][number],
      StructuredMesh["nodes"][number],
      StructuredMesh["nodes"][number],
      StructuredMesh["nodes"][number],
    ];
    const ke = computeMindlinQ4ElementStiffness(
      elementNodes,
      model.material,
      model.slab.thickness,
    );
    const dofIndices = buildElementDofIndices(element.nodeIds);
    addElementStiffnessToSparse(globalK, dofIndices, ke);
  }
}

function buildElementDofIndices(nodeIds: readonly [number, number, number, number]): number[] {
  const indices: number[] = [];
  for (const nodeId of nodeIds) {
    indices.push(nodeId * 3 + 0, nodeId * 3 + 1, nodeId * 3 + 2);
  }
  return indices;
}

function buildNodalDisplacements(
  mesh: StructuredMesh,
  fullDisplacements: Float64Array,
): NodalDisplacement[] {
  return mesh.nodes.map((node) => {
    const base = node.id * 3;
    return {
      nodeId: node.id,
      x: node.x,
      y: node.y,
      w: fullDisplacements[base + 0],
      rx: fullDisplacements[base + 1],
      ry: fullDisplacements[base + 2],
    };
  });
}

function buildSupportReactions(
  mesh: StructuredMesh,
  assignments: SupportDofAssignment[],
  fullDisplacements: Float64Array,
  residual: Float64Array,
): SupportReaction[] {
  const reactions: SupportReaction[] = [];
  for (const assignment of assignments) {
    const dofIndex = assignment.nodeId * 3 + DOF_INDEX_BY_KEY[assignment.dof];
    const node = mesh.nodes[assignment.nodeId];
    const displacement = fullDisplacements[dofIndex];
    const value =
      assignment.kind === "fixed"
        ? residual[dofIndex]
        : (assignment.stiffness ?? 0) * displacement;
    reactions.push({
      supportId: assignment.supportId,
      nodeId: assignment.nodeId,
      x: node.x,
      y: node.y,
      dof: assignment.dof,
      type: assignment.kind,
      value,
      displacement,
      springStiffness: assignment.stiffness,
    });
  }
  return reactions;
}

function buildSummary(
  totalWheelLoad: number,
  totalAppliedLoadToSlab: number,
  nodalDisplacements: NodalDisplacement[],
  elementResults: FixedPositionAnalysisResult["elementResults"],
  reactions: SupportReaction[],
): FixedPositionAnalysisSummary {
  const wValues = nodalDisplacements.map((node) => node.w);
  const minDeflection = wValues.length > 0 ? Math.min(...wValues) : 0;
  const maxDeflection = wValues.length > 0 ? Math.max(...wValues) : 0;

  let maxAbsMomentX = 0;
  let maxAbsMomentY = 0;
  let maxAbsMomentXY = 0;
  let maxAbsShearX = 0;
  let maxAbsShearY = 0;
  for (const element of elementResults) {
    maxAbsMomentX = Math.max(maxAbsMomentX, Math.abs(element.moments.mx));
    maxAbsMomentY = Math.max(maxAbsMomentY, Math.abs(element.moments.my));
    maxAbsMomentXY = Math.max(maxAbsMomentXY, Math.abs(element.moments.mxy));
    maxAbsShearX = Math.max(maxAbsShearX, Math.abs(element.shears.qx));
    maxAbsShearY = Math.max(maxAbsShearY, Math.abs(element.shears.qy));
  }

  let totalVerticalReaction = 0;
  const fixedVerticalByNode = new Map<number, number>();
  const springVerticalByNode = new Map<number, number>();
  for (const reaction of reactions) {
    if (reaction.dof !== "w") {
      continue;
    }
    if (reaction.type === "fixed") {
      if (!fixedVerticalByNode.has(reaction.nodeId)) {
        fixedVerticalByNode.set(reaction.nodeId, reaction.value);
      }
      continue;
    }
    springVerticalByNode.set(
      reaction.nodeId,
      (springVerticalByNode.get(reaction.nodeId) ?? 0) + reaction.value,
    );
  }
  for (const value of fixedVerticalByNode.values()) {
    totalVerticalReaction += value;
  }
  for (const value of springVerticalByNode.values()) {
    totalVerticalReaction += value;
  }

  return {
    totalWheelLoad,
    totalAppliedLoadToSlab,
    totalVerticalReaction,
    minDeflection,
    maxDeflection,
    maxAbsMomentX,
    maxAbsMomentY,
    maxAbsMomentXY,
    maxAbsShearX,
    maxAbsShearY,
  };
}

function collectWarnings(
  model: FixedPositionAnalysisModel,
  skewAngleDeg: number,
): string[] {
  const warnings: string[] = [];
  if (skewAngleDeg !== 0) {
    warnings.push(
      "EXPERIMENTAL: non-zero-skew analysis is screening-only. The formulation, " +
        "published-benchmark, and independent Chartered-Engineer reviews are not yet " +
        "complete; do not rely on these results for design.",
    );
  }
  if (model.slab.thickness < 0.1) {
    warnings.push("Very thin slab thickness may require a finer mesh for stable Mindlin behavior.");
  }
  return warnings;
}

/**
 * Convert a legacy point/line solver support into the normalized edge/line/point
 * support consumed by `mapNormalizedSupportsToMesh`. The generalized rotation
 * constraints map `rx -> betaX` and `ry -> betaY` (WP-002 ADR). Behaviour and
 * per-DOF overrides are resolved with the same base+overlay rule as the legacy
 * mapper so zero-skew restraint semantics are preserved exactly; a non-zero-skew
 * edge is expressed as an inclined deck-local coordinate line until WP-027
 * activates the ergonomic `EdgeSupport` union.
 */
function toNormalizedSupport(
  support: SupportDefinition,
): InternalNormalizedSupport {
  const id = support.id ?? "support";
  const restraint = toNormalizedRestraint(support);
  if (support.kind === "point") {
    return { id, kind: "point", x: support.x, y: support.y, restraint };
  }
  return {
    id,
    kind: "line",
    x1: support.x1,
    y1: support.y1,
    x2: support.x2,
    y2: support.y2,
    restraint,
  };
}

function toNormalizedRestraint(
  support: SupportDefinition,
): NormalizedSupportRestraint {
  const free: SupportDofConstraint = { kind: "free" };
  const fixed: SupportDofConstraint = { kind: "fixed" };
  const base: NormalizedGeneralizedDofConstraints =
    support.behavior === "fixed"
      ? { w: fixed, betaX: fixed, betaY: fixed }
      : support.behavior === "pinned"
        ? { w: fixed, betaX: free, betaY: free }
        : { w: free, betaX: free, betaY: free };
  return {
    behavior: "custom",
    dofs: {
      w: support.dofs?.w ?? base.w,
      betaX: support.dofs?.rx ?? base.betaX,
      betaY: support.dofs?.ry ?? base.betaY,
    },
  };
}

/** Assembled downward-positive vertical nodal loads (kN) for equilibrium. */
function buildAppliedVerticalLoads(
  mesh: StructuredMesh,
  globalLoadVector: Float64Array,
): NodalVerticalLoad[] {
  const loads: NodalVerticalLoad[] = [];
  for (const node of mesh.nodes) {
    const fz = globalLoadVector[node.id * 3];
    if (fz !== 0) {
      loads.push({ nodeId: node.id, x: node.x, y: node.y, fz });
    }
  }
  return loads;
}

/**
 * Raw restrained-DOF support actions for equilibrium. `value` is the stored
 * reaction (fixed: residual `K*u - f`, already an external action; spring:
 * `+k*u`, normalized to `-k*u` inside `computeSignedEquilibrium`). Fixed-DOF
 * de-duplication and fixed-over-spring precedence are handled there.
 */
function buildSupportActions(
  supportReactions: SupportReaction[],
): SupportActionInput[] {
  return supportReactions.map((reaction) => ({
    supportId: reaction.supportId,
    nodeId: reaction.nodeId,
    x: reaction.x,
    y: reaction.y,
    dof: reaction.dof,
    kind: reaction.type,
    value: reaction.value,
  }));
}
