import type {
  AnalysisResults,
  ConstraintSet,
  ConstraintSetting,
  DisplayToggles,
  LegacyConstraintSet,
  MeshSettings,
  PersistedModelV2SkewLegacySupports,
  SectionAxisMode,
  SectionSettings,
  SlabGeometry,
  MaterialProps,
  SlabModel,
  Support,
  TravelDirection,
  VehicleDefinition,
  VehiclePlacement,
} from "./types";

const isPlotMode = (input: unknown): input is DisplayToggles["plotMode"] =>
  input === "results" || input === "structure" || input === "deformed";

const isLegacyMeshPlotMode = (input: unknown): input is "mesh" => input === "mesh";

const defaultConstraintSet = (): ConstraintSet => ({
  uz: { type: "fixed" },
  rx: { type: "free" },
  ry: { type: "free" },
});

const defaultSupports = (widthM: number): Support[] => [
  {
    id: "S1",
    name: "Left edge line support",
    kind: "line",
    x1: 0,
    y1: 0,
    x2: 0,
    y2: widthM,
    constraints: defaultConstraintSet(),
  },
  {
    id: "S2",
    name: "Corner point spring",
    kind: "point",
    x: 10,
    y: widthM,
    constraints: {
      uz: { type: "spring", stiffness: 50000 },
      rx: { type: "free" },
      ry: { type: "free" },
    },
  },
];

const DEFAULT_DESCRIPTION =
  "Linear-elastic plate analysis of a slab subjected to vehicular wheel loads. Maximum reactions, moments and deflections are extracted from a parametric sweep of the load along the defined travel path.";

const DEFAULT_ASSUMPTIONS =
  "Kirchhoff thin-plate theory; small deformations; linear-elastic isotropic material; rigid supports at restrained DOFs as defined; self-weight excluded unless added explicitly; wheel patches modelled as uniformly distributed pressure over the contact rectangle.";

export const createDefaultModel = (): SlabModel => ({
  projectName: "Moving Load Slab V1",
  description: DEFAULT_DESCRIPTION,
  assumptions: DEFAULT_ASSUMPTIONS,
  geometry: {
    lengthM: 10,
    widthM: 5,
    thicknessM: 0.4,
    skewAngleDeg: 0,
  },
  material: {
    elasticModulusMPa: 32000,
    poisson: 0.2,
    densityKnPerM3: 25,
  },
  mesh: {
    density: 10,
    autoTargetElementM: 0.5,
  },
  supports: defaultSupports(5),
  vehicle: {
    name: "Default 2-Axle Vehicle",
    mode: "axle",
    transverseSpacingM: 2.0,
    wheelsPerAxle: 2,
    wheelPatchLongM: 0.4,
    wheelPatchTransM: 0.25,
    axleInputs: [
      { id: "A1", spacingFromPreviousM: 0, axleLoadKn: 90 },
      { id: "A2", spacingFromPreviousM: 4, axleLoadKn: 140 },
    ],
    directWheels: [
      { id: "W1", xM: 2, yM: 1.5, loadKn: 65, patchLongM: 0.4, patchTransM: 0.25 },
      { id: "W2", xM: 2, yM: 3.5, loadKn: 65, patchLongM: 0.4, patchTransM: 0.25 },
    ],
  },
  placement: {
    centerXM: 5,
    centerYM: 2.5,
    headingDeg: 0,
    transverseOffsetM: 0,
    travelDirection: "x+",
    pathStartM: 0,
    pathEndM: 10,
    pathStepM: 1,
  },
  display: {
    plotMode: "results",
    mesh: true,
    supports: true,
    wheelPatches: true,
    contours: true,
    tables: true,
  },
  section: {
    axis: "auto",
    centerPerpM: 2.5,
    widthM: 1.0,
  },
});

export const idleResults = (): AnalysisResults => ({
  status: "idle",
  source: "solver",
  contours: {},
  nodalContours: {},
  meshNodes: [],
  meshElements: [],
  nodalDisplacements: [],
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
  elapsedMs: 0,
});

export const errorResults = (
  error: string,
  options: { elapsedMs?: number; warning?: string } = {},
): AnalysisResults => ({
  ...idleResults(),
  status: "error",
  elapsedMs: options.elapsedMs ?? 0,
  error,
  warning: options.warning,
});

export const sanitizeLoadedModel = (input: unknown): SlabModel => {
  const defaults = createDefaultModel();
  const candidate = parsePersistedModel(input);
  const geometry = sanitizeGeometry(candidate.geometry, defaults.geometry);

  return {
    ...defaults,
    projectName:
      typeof candidate.projectName === "string" && candidate.projectName.trim().length > 0
        ? candidate.projectName
        : defaults.projectName,
    description:
      typeof candidate.description === "string" ? candidate.description : defaults.description,
    assumptions:
      typeof candidate.assumptions === "string" ? candidate.assumptions : defaults.assumptions,
    geometry,
    material: sanitizeMaterial(candidate.material, defaults.material),
    mesh: sanitizeMesh(candidate.mesh, defaults.mesh),
    vehicle: sanitizeVehicle(candidate.vehicle, defaults.vehicle),
    placement: sanitizePlacement(candidate.placement, defaults.placement),
    display: sanitizeDisplay(candidate.display, defaults.display),
    supports: sanitizeSupports(candidate.supports, defaultSupports(geometry.widthM)),
    section: sanitizeSection(candidate.section, defaults.section),
  };
};

export const serializeModelForSave = (model: SlabModel): string => {
  const snapshot: PersistedModelV2SkewLegacySupports = {
    schemaVersion: 2,
    supportSchema: "legacy-generalized-v1",
    projectName: model.projectName,
    description: model.description,
    assumptions: model.assumptions,
    geometry: {
      lengthM: model.geometry.lengthM,
      widthM: model.geometry.widthM,
      thicknessM: model.geometry.thicknessM,
      skewAngleDeg: sanitizeSkewAngle(model.geometry.skewAngleDeg, 0),
    },
    material: {
      elasticModulusMPa: model.material.elasticModulusMPa,
      poisson: model.material.poisson,
      densityKnPerM3: model.material.densityKnPerM3,
    },
    mesh: {
      density: model.mesh.density,
      autoTargetElementM: model.mesh.autoTargetElementM,
    },
    supports: model.supports.map((support) =>
      support.kind === "line"
        ? {
            id: support.id,
            name: support.name,
            kind: "line" as const,
            constraints: copyConstraintSet(support.constraints),
            x1: support.x1,
            y1: support.y1,
            x2: support.x2,
            y2: support.y2,
          }
        : {
            id: support.id,
            name: support.name,
            kind: "point" as const,
            constraints: copyConstraintSet(support.constraints),
            x: support.x,
            y: support.y,
          },
    ),
    vehicle: {
      name: model.vehicle.name,
      mode: model.vehicle.mode,
      transverseSpacingM: model.vehicle.transverseSpacingM,
      wheelsPerAxle: model.vehicle.wheelsPerAxle,
      wheelPatchLongM: model.vehicle.wheelPatchLongM,
      wheelPatchTransM: model.vehicle.wheelPatchTransM,
      axleInputs: model.vehicle.axleInputs.map((axle) => ({
        id: axle.id,
        spacingFromPreviousM: axle.spacingFromPreviousM,
        axleLoadKn: axle.axleLoadKn,
      })),
      directWheels: model.vehicle.directWheels.map((wheel) => ({
        id: wheel.id,
        xM: wheel.xM,
        yM: wheel.yM,
        loadKn: wheel.loadKn,
        patchLongM: wheel.patchLongM,
        patchTransM: wheel.patchTransM,
      })),
    },
    placement: {
      centerXM: model.placement.centerXM,
      centerYM: model.placement.centerYM,
      headingDeg: model.placement.headingDeg,
      transverseOffsetM: model.placement.transverseOffsetM,
      travelDirection: model.placement.travelDirection,
      pathStartM: model.placement.pathStartM,
      pathEndM: model.placement.pathEndM,
      pathStepM: model.placement.pathStepM,
    },
    display: {
      plotMode: model.display.plotMode,
      mesh: model.display.mesh,
      supports: model.display.supports,
      wheelPatches: model.display.wheelPatches,
      contours: model.display.contours,
      tables: model.display.tables,
    },
    section: {
      axis: model.section.axis,
      centerPerpM: model.section.centerPerpM,
      widthM: model.section.widthM,
    },
  };

  return JSON.stringify(snapshot, null, 2);
};

const COMMON_SNAPSHOT_KEYS = [
  "projectName",
  "description",
  "assumptions",
  "geometry",
  "material",
  "mesh",
  "supports",
  "vehicle",
  "placement",
  "display",
  "section",
] as const;

function parsePersistedModel(input: unknown): Record<string, unknown> {
  const candidate = expectRecord(input, "model", "unknown");
  if (!hasOwn(candidate, "schemaVersion")) {
    expectExactKeys(candidate, COMMON_SNAPSHOT_KEYS, "model", "V1");
    validateCommonSnapshot(candidate, "V1", false);
    return candidate;
  }

  if (candidate.schemaVersion !== 2) {
    throw migrationError(
      `schemaVersion ${String(candidate.schemaVersion)}`,
      "only implicit V1 and schemaVersion 2 are supported",
    );
  }
  if (candidate.supportSchema !== "legacy-generalized-v1") {
    throw migrationError("V2", "supportSchema must be legacy-generalized-v1");
  }
  expectExactKeys(
    candidate,
    [...COMMON_SNAPSHOT_KEYS, "schemaVersion", "supportSchema"],
    "model",
    "V2",
  );
  validateCommonSnapshot(candidate, "V2", true);
  return candidate;
}

function validateCommonSnapshot(
  candidate: Record<string, unknown>,
  version: "V1" | "V2",
  requiresSkew: boolean,
): void {
  expectString(candidate.projectName, "projectName", version);
  expectString(candidate.description, "description", version);
  expectString(candidate.assumptions, "assumptions", version);

  expectExactKeys(
    expectRecord(candidate.geometry, "geometry", version),
    requiresSkew
      ? ["lengthM", "widthM", "thicknessM", "skewAngleDeg"]
      : ["lengthM", "widthM", "thicknessM"],
    "geometry",
    version,
  );
  expectExactKeys(
    expectRecord(candidate.material, "material", version),
    ["elasticModulusMPa", "poisson", "densityKnPerM3"],
    "material",
    version,
  );
  expectExactKeys(
    expectRecord(candidate.mesh, "mesh", version),
    ["density", "autoTargetElementM"],
    "mesh",
    version,
  );
  validateSupports(candidate.supports, version);
  validateVehicle(candidate.vehicle, version);
  validatePlacement(candidate.placement, version);
  validateDisplay(candidate.display, version);
  validateSection(candidate.section, version);
}

function validateSupports(input: unknown, version: "V1" | "V2"): void {
  if (!Array.isArray(input)) {
    throw migrationError(version, "supports must be an array");
  }
  input.forEach((item, index) => {
    const support = expectRecord(item, `supports[${index}]`, version);
    expectString(support.id, `supports[${index}].id`, version);
    expectString(support.name, `supports[${index}].name`, version);
    if (support.kind === "line") {
      expectExactKeys(
        support,
        ["id", "name", "kind", "constraints", "x1", "y1", "x2", "y2"],
        `supports[${index}]`,
        version,
      );
    } else if (support.kind === "point") {
      expectExactKeys(
        support,
        ["id", "name", "kind", "constraints", "x", "y"],
        `supports[${index}]`,
        version,
      );
    } else {
      throw migrationError(version, `supports[${index}] is not a legacy coordinate support`);
    }
    validateConstraintSet(support.constraints, `supports[${index}].constraints`, version);
  });
}

function validateConstraintSet(
  input: unknown,
  path: string,
  version: "V1" | "V2",
): void {
  const constraints = expectRecord(input, path, version);
  expectExactKeys(constraints, ["uz", "rx", "ry"], path, version);
  (["uz", "rx", "ry"] as const).forEach((dof) => {
    const setting = expectRecord(constraints[dof], `${path}.${dof}`, version);
    if (setting.type === "spring") {
      expectExactKeys(setting, ["type", "stiffness"], `${path}.${dof}`, version);
    } else if (
      setting.type === "free" ||
      setting.type === "fixed" ||
      setting.type === "pinned"
    ) {
      expectExactKeys(setting, ["type"], `${path}.${dof}`, version);
    } else {
      throw migrationError(version, `${path}.${dof}.type is invalid`);
    }
  });
}

function validateVehicle(input: unknown, version: "V1" | "V2"): void {
  const vehicle = expectRecord(input, "vehicle", version);
  expectExactKeys(
    vehicle,
    [
      "name",
      "mode",
      "transverseSpacingM",
      "wheelsPerAxle",
      "wheelPatchLongM",
      "wheelPatchTransM",
      "axleInputs",
      "directWheels",
    ],
    "vehicle",
    version,
  );
  expectString(vehicle.name, "vehicle.name", version);
  if (vehicle.mode !== "axle" && vehicle.mode !== "direct") {
    throw migrationError(version, "vehicle.mode is invalid");
  }
  if (!Array.isArray(vehicle.axleInputs) || !Array.isArray(vehicle.directWheels)) {
    throw migrationError(version, "vehicle axleInputs/directWheels must be arrays");
  }
  vehicle.axleInputs.forEach((item, index) => {
    const axle = expectRecord(item, `vehicle.axleInputs[${index}]`, version);
    expectExactKeys(
      axle,
      ["id", "spacingFromPreviousM", "axleLoadKn"],
      `vehicle.axleInputs[${index}]`,
      version,
    );
    expectString(axle.id, `vehicle.axleInputs[${index}].id`, version);
  });
  vehicle.directWheels.forEach((item, index) => {
    const wheel = expectRecord(item, `vehicle.directWheels[${index}]`, version);
    expectExactKeys(
      wheel,
      ["id", "xM", "yM", "loadKn", "patchLongM", "patchTransM"],
      `vehicle.directWheels[${index}]`,
      version,
    );
    expectString(wheel.id, `vehicle.directWheels[${index}].id`, version);
  });
}

function validatePlacement(input: unknown, version: "V1" | "V2"): void {
  const placement = expectRecord(input, "placement", version);
  expectExactKeys(
    placement,
    [
      "centerXM",
      "centerYM",
      "headingDeg",
      "transverseOffsetM",
      "travelDirection",
      "pathStartM",
      "pathEndM",
      "pathStepM",
    ],
    "placement",
    version,
  );
  if (!isTravelDirection(placement.travelDirection)) {
    throw migrationError(version, "placement.travelDirection is invalid");
  }
}

function validateDisplay(input: unknown, version: "V1" | "V2"): void {
  const display = expectRecord(input, "display", version);
  expectExactKeys(
    display,
    ["plotMode", "mesh", "supports", "wheelPatches", "contours", "tables"],
    "display",
    version,
  );
  if (!isPlotMode(display.plotMode)) {
    throw migrationError(version, "display.plotMode is invalid");
  }
  ["mesh", "supports", "wheelPatches", "contours", "tables"].forEach((key) => {
    if (typeof display[key] !== "boolean") {
      throw migrationError(version, `display.${key} must be boolean`);
    }
  });
}

function validateSection(input: unknown, version: "V1" | "V2"): void {
  const section = expectRecord(input, "section", version);
  expectExactKeys(section, ["axis", "centerPerpM", "widthM"], "section", version);
  if (section.axis !== "auto" && section.axis !== "x" && section.axis !== "y") {
    throw migrationError(version, "section.axis is invalid");
  }
}

function copyConstraintSet(input: ConstraintSet): LegacyConstraintSet {
  const copySetting = (
    setting: ConstraintSetting,
  ): LegacyConstraintSet[keyof LegacyConstraintSet] =>
    setting.type === "spring"
      ? { type: "spring", stiffness: finiteNumber(setting.stiffness, 0) }
      : { type: setting.type };

  return {
    uz: copySetting(input.uz),
    rx: copySetting(input.rx),
    ry: copySetting(input.ry),
  };
}

function expectRecord(
  input: unknown,
  path: string,
  version: string,
): Record<string, unknown> {
  if (!isRecord(input) || Array.isArray(input)) {
    throw migrationError(version, `${path} must be an object`);
  }
  return input;
}

function expectExactKeys(
  input: Record<string, unknown>,
  expected: readonly string[],
  path: string,
  version: string,
): void {
  const actual = Object.keys(input).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw migrationError(version, `${path} has an invalid snapshot shape`);
  }
}

function expectString(input: unknown, path: string, version: string): void {
  if (typeof input !== "string") {
    throw migrationError(version, `${path} must be a string`);
  }
}

function hasOwn(input: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function migrationError(version: string, detail: string): Error {
  return new Error(`Model migration error (${version}): ${detail}.`);
}

export const sanitizeVehicleDefinition = (
  input: unknown,
  fallback: VehicleDefinition = createDefaultModel().vehicle,
): VehicleDefinition => sanitizeVehicle(input, fallback);

export const validateModelForRun = (model: SlabModel): string[] => {
  const issues: string[] = [];

  model.supports.forEach((support) => {
    if (support.kind === "line" && support.x1 !== support.x2 && support.y1 !== support.y2) {
      issues.push(
        `Support "${support.name}" is not axis-aligned. Line supports must be horizontal or vertical in v1.`,
      );
    }
  });

  if (model.vehicle.mode === "axle" && model.vehicle.axleInputs.length === 0) {
    issues.push("At least one axle is required in axle-based vehicle mode.");
  }

  if (model.vehicle.mode === "direct" && model.vehicle.directWheels.length === 0) {
    issues.push("At least one wheel is required in direct-wheel vehicle mode.");
  }

  return issues;
};

function sanitizeGeometry(input: unknown, fallback: SlabGeometry): SlabGeometry {
  if (!isRecord(input)) {
    return fallback;
  }
  return {
    lengthM: positiveNumber(input.lengthM, fallback.lengthM),
    widthM: positiveNumber(input.widthM, fallback.widthM),
    thicknessM: positiveNumber(input.thicknessM, fallback.thicknessM),
    skewAngleDeg: sanitizeSkewAngle(input.skewAngleDeg, fallback.skewAngleDeg),
  };
}

function sanitizeSkewAngle(input: unknown, fallback: number): number {
  if (
    typeof input !== "number" ||
    !Number.isFinite(input) ||
    input < -45 ||
    input > 45
  ) {
    return fallback === 0 ? 0 : fallback;
  }
  return input === 0 ? 0 : input;
}

function sanitizeMaterial(input: unknown, fallback: MaterialProps): MaterialProps {
  if (!isRecord(input)) {
    return fallback;
  }
  return {
    elasticModulusMPa: positiveNumber(input.elasticModulusMPa, fallback.elasticModulusMPa),
    poisson: finiteNumberInRange(input.poisson, -0.99, 0.49, fallback.poisson),
    densityKnPerM3: positiveNumber(input.densityKnPerM3, fallback.densityKnPerM3),
  };
}

function sanitizeMesh(input: unknown, fallback: MeshSettings): MeshSettings {
  if (!isRecord(input)) {
    return fallback;
  }
  return {
    density: Math.max(2, Math.round(positiveNumber(input.density, fallback.density))),
    autoTargetElementM: positiveNumber(input.autoTargetElementM, fallback.autoTargetElementM),
  };
}

function sanitizeVehicle(input: unknown, fallback: VehicleDefinition): VehicleDefinition {
  if (!isRecord(input)) {
    return fallback;
  }

  const wheelsPerAxle = Math.max(
    1,
    Math.round(positiveNumber(input.wheelsPerAxle, fallback.wheelsPerAxle)),
  );
  const legacyTrackFactor = Math.max(wheelsPerAxle - 1, 1);
  const legacyTransverseSpacingM =
    positiveNumber(input.trackM, fallback.transverseSpacingM * legacyTrackFactor) / legacyTrackFactor;
  const axleInputs = Array.isArray(input.axleInputs)
    ? input.axleInputs
        .map((item, index) => sanitizeAxleInput(item, fallback.axleInputs[index] ?? fallback.axleInputs[0], index))
        .filter((item): item is VehicleDefinition["axleInputs"][number] => item !== null)
    : [];
  const directWheels = Array.isArray(input.directWheels)
    ? input.directWheels
        .map((item, index) =>
          sanitizeDirectWheel(item, fallback.directWheels[index] ?? fallback.directWheels[0], index),
        )
        .filter((item): item is VehicleDefinition["directWheels"][number] => item !== null)
    : [];

  return {
    name:
      typeof input.name === "string" && input.name.trim().length > 0
        ? input.name
        : fallback.name,
    mode: input.mode === "direct" ? "direct" : "axle",
    transverseSpacingM: positiveNumber(input.transverseSpacingM, legacyTransverseSpacingM),
    wheelsPerAxle,
    wheelPatchLongM: positiveNumber(input.wheelPatchLongM, fallback.wheelPatchLongM),
    wheelPatchTransM: positiveNumber(input.wheelPatchTransM, fallback.wheelPatchTransM),
    axleInputs: axleInputs.length > 0 ? axleInputs : fallback.axleInputs,
    directWheels: directWheels.length > 0 ? directWheels : fallback.directWheels,
  };
}

function sanitizePlacement(input: unknown, fallback: VehiclePlacement): VehiclePlacement {
  if (!isRecord(input)) {
    return fallback;
  }
  return {
    centerXM: finiteNumber(input.centerXM, fallback.centerXM),
    centerYM: finiteNumber(input.centerYM, fallback.centerYM),
    headingDeg: finiteNumber(input.headingDeg, fallback.headingDeg),
    transverseOffsetM: finiteNumber(input.transverseOffsetM, fallback.transverseOffsetM),
    travelDirection: isTravelDirection(input.travelDirection) ? input.travelDirection : fallback.travelDirection,
    pathStartM: finiteNumber(input.pathStartM, fallback.pathStartM),
    pathEndM: finiteNumber(input.pathEndM, fallback.pathEndM),
    pathStepM: positiveNumber(input.pathStepM, fallback.pathStepM),
  };
}

function sanitizeDisplay(input: unknown, fallback: DisplayToggles): DisplayToggles {
  if (!isRecord(input)) {
    return fallback;
  }
  const legacyMeshMode = isLegacyMeshPlotMode(input.plotMode);
  return {
    plotMode:
      legacyMeshMode
        ? "structure"
        : isPlotMode(input.plotMode)
          ? input.plotMode
          : fallback.plotMode,
    mesh: legacyMeshMode ? true : booleanValue(input.mesh, fallback.mesh),
    supports: booleanValue(input.supports, fallback.supports),
    wheelPatches: booleanValue(input.wheelPatches, fallback.wheelPatches),
    contours: booleanValue(input.contours, fallback.contours),
    tables: booleanValue(input.tables, fallback.tables),
  };
}

function sanitizeSection(input: unknown, fallback: SectionSettings): SectionSettings {
  if (!isRecord(input)) {
    return fallback;
  }
  const axis: SectionAxisMode =
    input.axis === "x" || input.axis === "y" || input.axis === "auto" ? input.axis : fallback.axis;
  return {
    axis,
    centerPerpM: finiteNumber(input.centerPerpM, fallback.centerPerpM),
    widthM: positiveNumber(input.widthM, fallback.widthM),
  };
}

function sanitizeSupports(input: unknown, fallback: Support[]): Support[] {
  if (!Array.isArray(input)) {
    return fallback;
  }

  const sanitized = input.map((item, index) =>
    sanitizeSupport(item, fallback[index] ?? fallback[0], index),
  );
  if (sanitized.some((item) => item === null)) {
    return fallback;
  }

  const supports = sanitized.filter((item): item is Support => item !== null);

  return supports.length > 0 ? supports : fallback;
}

function sanitizeSupport(input: unknown, fallback: Support, index: number): Support | null {
  if (!isRecord(input)) {
    return null;
  }

  const constraints = sanitizeConstraintSet(input.constraints, fallback.constraints);
  const id =
    typeof input.id === "string" && input.id.trim().length > 0 ? input.id : `S${index + 1}`;
  const name =
    typeof input.name === "string" && input.name.trim().length > 0 ? input.name : fallback.name;

  if (input.kind === "point") {
    return {
      id,
      name,
      kind: "point",
      x: finiteNumber(input.x, fallback.kind === "point" ? fallback.x : 0),
      y: finiteNumber(input.y, fallback.kind === "point" ? fallback.y : 0),
      constraints,
    };
  }

  if (input.kind === "line") {
    return {
      id,
      name,
      kind: "line",
      x1: finiteNumber(input.x1, fallback.kind === "line" ? fallback.x1 : 0),
      y1: finiteNumber(input.y1, fallback.kind === "line" ? fallback.y1 : 0),
      x2: finiteNumber(input.x2, fallback.kind === "line" ? fallback.x2 : 0),
      y2: finiteNumber(input.y2, fallback.kind === "line" ? fallback.y2 : 0),
      constraints,
    };
  }

  return null;
}

function sanitizeConstraintSet(input: unknown, fallback: ConstraintSet): ConstraintSet {
  if (!isRecord(input)) {
    return fallback;
  }

  return {
    uz: sanitizeConstraintSetting(input.uz, fallback.uz, "uz"),
    rx: sanitizeConstraintSetting(input.rx, fallback.rx, "rx"),
    ry: sanitizeConstraintSetting(input.ry, fallback.ry, "ry"),
  };
}

function sanitizeConstraintSetting(
  input: unknown,
  fallback: ConstraintSetting,
  dof: keyof ConstraintSet,
): ConstraintSetting {
  if (!isRecord(input)) {
    return fallback;
  }

  if (input.type === "spring") {
    return {
      type: "spring",
      stiffness: positiveNumber(input.stiffness, fallback.stiffness ?? 10000),
    };
  }

  if (input.type === "fixed" || input.type === "free") {
    return { type: input.type };
  }

  if (input.type === "pinned") {
    return { type: dof === "uz" ? "fixed" : "free" };
  }

  return fallback;
}

function sanitizeAxleInput(
  input: unknown,
  fallback: VehicleDefinition["axleInputs"][number],
  index: number,
): VehicleDefinition["axleInputs"][number] | null {
  if (!isRecord(input)) {
    return null;
  }
  return {
    id:
      typeof input.id === "string" && input.id.trim().length > 0
        ? input.id
        : `A${index + 1}`,
    spacingFromPreviousM: Math.max(0, finiteNumber(input.spacingFromPreviousM, fallback.spacingFromPreviousM)),
    axleLoadKn: positiveNumber(input.axleLoadKn, fallback.axleLoadKn),
  };
}

function sanitizeDirectWheel(
  input: unknown,
  fallback: VehicleDefinition["directWheels"][number],
  index: number,
): VehicleDefinition["directWheels"][number] | null {
  if (!isRecord(input)) {
    return null;
  }
  return {
    id:
      typeof input.id === "string" && input.id.trim().length > 0
        ? input.id
        : `W${index + 1}`,
    xM: finiteNumber(input.xM, fallback.xM),
    yM: finiteNumber(input.yM, fallback.yM),
    loadKn: positiveNumber(input.loadKn, fallback.loadKn),
    patchLongM: positiveNumber(input.patchLongM, fallback.patchLongM),
    patchTransM: positiveNumber(input.patchTransM, fallback.patchTransM),
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object";
}

function finiteNumber(input: unknown, fallback: number): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === "string") {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function positiveNumber(input: unknown, fallback: number): number {
  const parsed = finiteNumber(input, Number.NaN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function finiteNumberInRange(
  input: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const parsed = finiteNumber(input, Number.NaN);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function booleanValue(input: unknown, fallback: boolean): boolean {
  return typeof input === "boolean" ? input : fallback;
}

function isTravelDirection(input: unknown): input is TravelDirection {
  return input === "x+" || input === "x-" || input === "y+" || input === "y-";
}
