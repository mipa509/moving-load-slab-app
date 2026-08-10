import { describe, expect, it } from "vitest";
import {
  createDefaultModel,
  errorResults,
  sanitizeDeckSection,
  sanitizeLoadedModel,
  serializeModelForSave,
  validateModelForRun,
} from "../app/defaults";
import type { DeckSectionSettings } from "../app/types";

const IMPLICIT_V1_SNAPSHOT = {
  projectName: "Legacy slab",
  description: "Legacy description",
  assumptions: "Legacy assumptions",
  geometry: {
    lengthM: "12",
    widthM: "6",
    thicknessM: "0.35",
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
  supports: [
    {
      id: "S1",
      name: "Legacy line",
      kind: "line",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "6",
      constraints: {
        uz: { type: "pinned" },
        rx: { type: "pinned" },
        ry: { type: "pinned" },
      },
    },
  ],
  vehicle: {
    name: "Legacy vehicle",
    mode: "axle",
    transverseSpacingM: "1.2",
    wheelsPerAxle: "4",
    wheelPatchLongM: "0.45",
    wheelPatchTransM: "0.3",
    axleInputs: [{ id: "A1", spacingFromPreviousM: "0", axleLoadKn: "120" }],
    directWheels: [],
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
    plotMode: "structure",
    mesh: true,
    supports: true,
    wheelPatches: true,
    contours: true,
    tables: true,
  },
  section: {
    axis: "auto",
    centerPerpM: 2.5,
    widthM: 1,
  },
} as const;

const implicitV1Snapshot = (): Record<string, any> =>
  structuredClone(IMPLICIT_V1_SNAPSHOT);

const v2Snapshot = (skewAngleDeg: unknown): Record<string, any> => {
  const v1 = implicitV1Snapshot();
  return {
    ...v1,
    schemaVersion: 2,
    supportSchema: "legacy-generalized-v1",
    geometry: {
      ...v1.geometry,
      skewAngleDeg,
    },
  };
};

const EXPECTED_DISTINCT_V2_SNAPSHOT = {
  schemaVersion: 2,
  supportSchema: "legacy-generalized-v1",
  projectName: "Distinct V2 project",
  description: "Distinct persisted description",
  assumptions: "Distinct persisted assumptions",
  geometry: {
    lengthM: 13.25,
    widthM: 7.75,
    thicknessM: 0.42,
    skewAngleDeg: -19,
  },
  material: {
    elasticModulusMPa: 31001,
    poisson: 0.23,
    densityKnPerM3: 24.5,
  },
  mesh: {
    density: 17,
    autoTargetElementM: 0.37,
  },
  supports: [
    {
      id: "LINE-distinct",
      name: "Distinct legacy line",
      kind: "line",
      constraints: {
        uz: { type: "fixed" },
        rx: { type: "spring", stiffness: 1234 },
        ry: { type: "free" },
      },
      x1: 1.1,
      y1: 2.2,
      x2: 3.3,
      y2: 4.4,
    },
    {
      id: "POINT-distinct",
      name: "Distinct legacy point",
      kind: "point",
      constraints: {
        uz: { type: "spring", stiffness: 9876 },
        rx: { type: "free" },
        ry: { type: "fixed" },
      },
      x: 5.5,
      y: 6.6,
    },
  ],
  vehicle: {
    name: "Distinct vehicle",
    mode: "direct",
    transverseSpacingM: 1.31,
    wheelsPerAxle: 3,
    wheelPatchLongM: 0.46,
    wheelPatchTransM: 0.27,
    axleInputs: [
      { id: "AX-distinct", spacingFromPreviousM: 2.7, axleLoadKn: 111 },
    ],
    directWheels: [
      {
        id: "WH-distinct",
        xM: 7.1,
        yM: 3.2,
        loadKn: 61,
        patchLongM: 0.41,
        patchTransM: 0.22,
      },
    ],
  },
  placement: {
    centerXM: 8.1,
    centerYM: 3.7,
    headingDeg: 31,
    transverseOffsetM: -0.8,
    travelDirection: "y-",
    pathStartM: -1.2,
    pathEndM: 11.4,
    pathStepM: 0.6,
  },
  display: {
    plotMode: "deformed",
    mesh: false,
    supports: true,
    wheelPatches: false,
    contours: true,
    tables: false,
  },
  section: {
    axis: "y",
    centerPerpM: 4.3,
    widthM: 1.6,
  },
} as const;

const distinctV2Snapshot = (): Record<string, any> =>
  structuredClone(EXPECTED_DISTINCT_V2_SNAPSHOT);

type InvalidSnapshotCase = {
  name: string;
  expectedError: string;
  mutate: (snapshot: Record<string, any>) => void;
};

const INVALID_SNAPSHOT_CASES: InvalidSnapshotCase[] = [
  {
    name: "top-level extra key",
    expectedError: "Model migration error (V2): model has an invalid snapshot shape.",
    mutate: (snapshot) => { snapshot.unexpected = true; },
  },
  {
    name: "geometry extra key",
    expectedError: "Model migration error (V2): geometry has an invalid snapshot shape.",
    mutate: (snapshot) => { snapshot.geometry.unexpected = true; },
  },
  {
    name: "geometry missing required field",
    expectedError: "Model migration error (V2): geometry has an invalid snapshot shape.",
    mutate: (snapshot) => { delete snapshot.geometry.widthM; },
  },
  {
    name: "geometry wrong container",
    expectedError: "Model migration error (V2): geometry must be an object.",
    mutate: (snapshot) => { snapshot.geometry = []; },
  },
  {
    name: "material extra key",
    expectedError: "Model migration error (V2): material has an invalid snapshot shape.",
    mutate: (snapshot) => { snapshot.material.unexpected = 1; },
  },
  {
    name: "material missing required field",
    expectedError: "Model migration error (V2): material has an invalid snapshot shape.",
    mutate: (snapshot) => { delete snapshot.material.poisson; },
  },
  {
    name: "material wrong container",
    expectedError: "Model migration error (V2): material must be an object.",
    mutate: (snapshot) => { snapshot.material = null; },
  },
  {
    name: "mesh extra key",
    expectedError: "Model migration error (V2): mesh has an invalid snapshot shape.",
    mutate: (snapshot) => { snapshot.mesh.unexpected = 1; },
  },
  {
    name: "mesh missing required field",
    expectedError: "Model migration error (V2): mesh has an invalid snapshot shape.",
    mutate: (snapshot) => { delete snapshot.mesh.density; },
  },
  {
    name: "mesh wrong container",
    expectedError: "Model migration error (V2): mesh must be an object.",
    mutate: (snapshot) => { snapshot.mesh = "mesh"; },
  },
  {
    name: "supports wrong array container",
    expectedError: "Model migration error (V2): supports must be an array.",
    mutate: (snapshot) => { snapshot.supports = {}; },
  },
  {
    name: "null support array entry",
    expectedError: "Model migration error (V2): supports[0] must be an object.",
    mutate: (snapshot) => { snapshot.supports[0] = null; },
  },
  {
    name: "support extra key",
    expectedError: "Model migration error (V2): supports[0] has an invalid snapshot shape.",
    mutate: (snapshot) => { snapshot.supports[0].unexpected = 1; },
  },
  {
    name: "support missing coordinate",
    expectedError: "Model migration error (V2): supports[1] has an invalid snapshot shape.",
    mutate: (snapshot) => { delete snapshot.supports[1].x; },
  },
  {
    name: "support constraints wrong container",
    expectedError: "Model migration error (V2): supports[0].constraints must be an object.",
    mutate: (snapshot) => { snapshot.supports[0].constraints = []; },
  },
  {
    name: "support constraints extra key",
    expectedError: "Model migration error (V2): supports[0].constraints has an invalid snapshot shape.",
    mutate: (snapshot) => { snapshot.supports[0].constraints.unexpected = {}; },
  },
  {
    name: "support constraint missing DOF",
    expectedError: "Model migration error (V2): supports[0].constraints has an invalid snapshot shape.",
    mutate: (snapshot) => { delete snapshot.supports[0].constraints.ry; },
  },
  {
    name: "null support constraint setting",
    expectedError: "Model migration error (V2): supports[0].constraints.uz must be an object.",
    mutate: (snapshot) => { snapshot.supports[0].constraints.uz = null; },
  },
  {
    name: "vehicle extra key",
    expectedError: "Model migration error (V2): vehicle has an invalid snapshot shape.",
    mutate: (snapshot) => { snapshot.vehicle.unexpected = 1; },
  },
  {
    name: "vehicle missing required field",
    expectedError: "Model migration error (V2): vehicle has an invalid snapshot shape.",
    mutate: (snapshot) => { delete snapshot.vehicle.mode; },
  },
  {
    name: "vehicle wrong container",
    expectedError: "Model migration error (V2): vehicle must be an object.",
    mutate: (snapshot) => { snapshot.vehicle = []; },
  },
  {
    name: "axle array wrong container",
    expectedError: "Model migration error (V2): vehicle axleInputs/directWheels must be arrays.",
    mutate: (snapshot) => { snapshot.vehicle.axleInputs = {}; },
  },
  {
    name: "null axle array entry",
    expectedError: "Model migration error (V2): vehicle.axleInputs[0] must be an object.",
    mutate: (snapshot) => { snapshot.vehicle.axleInputs[0] = null; },
  },
  {
    name: "axle extra key",
    expectedError: "Model migration error (V2): vehicle.axleInputs[0] has an invalid snapshot shape.",
    mutate: (snapshot) => { snapshot.vehicle.axleInputs[0].unexpected = 1; },
  },
  {
    name: "axle missing required field",
    expectedError: "Model migration error (V2): vehicle.axleInputs[0] has an invalid snapshot shape.",
    mutate: (snapshot) => { delete snapshot.vehicle.axleInputs[0].axleLoadKn; },
  },
  {
    name: "direct-wheel array wrong container",
    expectedError: "Model migration error (V2): vehicle axleInputs/directWheels must be arrays.",
    mutate: (snapshot) => { snapshot.vehicle.directWheels = null; },
  },
  {
    name: "null direct-wheel array entry",
    expectedError: "Model migration error (V2): vehicle.directWheels[0] must be an object.",
    mutate: (snapshot) => { snapshot.vehicle.directWheels[0] = null; },
  },
  {
    name: "direct-wheel extra key",
    expectedError: "Model migration error (V2): vehicle.directWheels[0] has an invalid snapshot shape.",
    mutate: (snapshot) => { snapshot.vehicle.directWheels[0].unexpected = 1; },
  },
  {
    name: "direct-wheel missing required field",
    expectedError: "Model migration error (V2): vehicle.directWheels[0] has an invalid snapshot shape.",
    mutate: (snapshot) => { delete snapshot.vehicle.directWheels[0].loadKn; },
  },
  {
    name: "placement extra key",
    expectedError: "Model migration error (V2): placement has an invalid snapshot shape.",
    mutate: (snapshot) => { snapshot.placement.unexpected = 1; },
  },
  {
    name: "placement missing required field",
    expectedError: "Model migration error (V2): placement has an invalid snapshot shape.",
    mutate: (snapshot) => { delete snapshot.placement.headingDeg; },
  },
  {
    name: "placement wrong container",
    expectedError: "Model migration error (V2): placement must be an object.",
    mutate: (snapshot) => { snapshot.placement = null; },
  },
  {
    name: "display extra key",
    expectedError: "Model migration error (V2): display has an invalid snapshot shape.",
    mutate: (snapshot) => { snapshot.display.unexpected = true; },
  },
  {
    name: "display missing required field",
    expectedError: "Model migration error (V2): display has an invalid snapshot shape.",
    mutate: (snapshot) => { delete snapshot.display.tables; },
  },
  {
    name: "display wrong container",
    expectedError: "Model migration error (V2): display must be an object.",
    mutate: (snapshot) => { snapshot.display = []; },
  },
  {
    name: "section extra key",
    expectedError: "Model migration error (V2): section has an invalid snapshot shape.",
    mutate: (snapshot) => { snapshot.section.unexpected = 1; },
  },
  {
    name: "section missing required field",
    expectedError: "Model migration error (V2): section has an invalid snapshot shape.",
    mutate: (snapshot) => { delete snapshot.section.widthM; },
  },
  {
    name: "section wrong container",
    expectedError: "Model migration error (V2): section must be an object.",
    mutate: (snapshot) => { snapshot.section = null; },
  },
];

describe("app model sanitization", () => {
  it("creates the live default with exact positive zero skew", () => {
    const model = createDefaultModel();

    expect(model.geometry.skewAngleDeg).toBe(0);
    expect(Object.is(model.geometry.skewAngleDeg, -0)).toBe(false);
  });

  it("migrates a complete implicit V1 snapshot to exact positive zero", () => {
    const model = sanitizeLoadedModel(implicitV1Snapshot());

    expect(model.geometry.lengthM).toBe(12);
    expect(model.geometry.widthM).toBe(6);
    expect(model.geometry.thicknessM).toBe(0.35);
    expect(model.geometry.skewAngleDeg).toBe(0);
    expect(Object.is(model.geometry.skewAngleDeg, -0)).toBe(false);
    expect(model.supports[0].constraints.uz.type).toBe("fixed");
    expect(model.supports[0].constraints.rx.type).toBe("free");
    expect(model.supports[0].constraints.ry.type).toBe("free");
    expect(model.vehicle.transverseSpacingM).toBe(1.2);
    expect(model.vehicle.wheelsPerAxle).toBe(4);
    expect(model.vehicle.axleInputs[0].axleLoadKn).toBe(120);
    expect(model.display.plotMode).toBe("structure");
    expect(model.display.mesh).toBe(true);
  });

  it.each([0, -0, 19, -19, 45, -45, 45 - 1e-10, -45 + 1e-10])(
    "accepts an in-range V2 skew angle of %s degrees",
    (skewAngleDeg) => {
      const model = sanitizeLoadedModel(v2Snapshot(skewAngleDeg));

      if (skewAngleDeg === 0) {
        expect(model.geometry.skewAngleDeg).toBe(0);
        expect(Object.is(model.geometry.skewAngleDeg, -0)).toBe(false);
      } else {
        expect(model.geometry.skewAngleDeg).toBe(skewAngleDeg);
      }
    },
  );

  it.each([45 + 1e-10, -45 - 1e-10, Number.NaN, Infinity, -Infinity, "19", null, {}])(
    "falls back to zero without clamping invalid skew input %s",
    (skewAngleDeg) => {
      const model = sanitizeLoadedModel(v2Snapshot(skewAngleDeg));

      expect(model.geometry.skewAngleDeg).toBe(0);
      expect(Object.is(model.geometry.skewAngleDeg, -0)).toBe(false);
    },
  );

  it("keeps structural skew independent from vehicle heading", () => {
    const snapshot = v2Snapshot(19);
    snapshot.placement.headingDeg = -33;

    const model = sanitizeLoadedModel(snapshot);

    expect(model.geometry.skewAngleDeg).toBe(19);
    expect(model.placement.headingDeg).toBe(-33);
  });

  it("rejects partial, unsupported, and discriminator/shape-mismatched snapshots", () => {
    const v1WithV2Field = implicitV1Snapshot();
    v1WithV2Field.supportSchema = "legacy-generalized-v1";
    const v1WithSkew = implicitV1Snapshot();
    v1WithSkew.geometry.skewAngleDeg = 19;
    const v2MissingSkew = v2Snapshot(19);
    delete v2MissingSkew.geometry.skewAngleDeg;
    const wrongSupportSchema = v2Snapshot(19);
    wrongSupportSchema.supportSchema = "physical-v1";
    const wrongSectionSchema = v2Snapshot(19);
    wrongSectionSchema.sectionSchema = "deck-local-v1";
    const physicalSupport = v2Snapshot(19);
    physicalSupport.supports = [
      {
        id: "E1",
        name: "Physical edge",
        kind: "edge",
        edge: "start",
        restraint: { w: { type: "fixed" } },
      },
    ];
    const wrongSection = v2Snapshot(19);
    wrongSection.section = { mode: "longitudinal", centerTM: 2, widthM: 1 };

    [
      {},
      { ...v2Snapshot(19), schemaVersion: 3 },
      v1WithV2Field,
      v1WithSkew,
      v2MissingSkew,
      wrongSupportSchema,
      wrongSectionSchema,
      physicalSupport,
      wrongSection,
    ].forEach((snapshot) => {
      expect(() => sanitizeLoadedModel(snapshot)).toThrow(/migration error/i);
    });
  });

  it("serializes exact V2 fields and round-trips V1 and V2 snapshots", () => {
    const fromV1 = sanitizeLoadedModel(implicitV1Snapshot());
    const fromV2 = sanitizeLoadedModel(v2Snapshot(-19));
    fromV2.placement.headingDeg = 27;

    const persisted = JSON.parse(serializeModelForSave(fromV2)) as Record<string, any>;

    expect(Object.keys(persisted).sort()).toEqual(
      [
        "schemaVersion",
        "supportSchema",
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
      ].sort(),
    );
    expect(persisted.schemaVersion).toBe(2);
    expect(persisted.supportSchema).toBe("legacy-generalized-v1");
    expect(persisted).not.toHaveProperty("sectionSchema");
    expect(persisted.geometry.skewAngleDeg).toBe(-19);
    expect(persisted.placement.headingDeg).toBe(27);
    expect(sanitizeLoadedModel(persisted)).toEqual(fromV2);
    expect(sanitizeLoadedModel(JSON.parse(serializeModelForSave(fromV1)))).toEqual(fromV1);
  });

  it("matches an independently constructed complete V2 serialization oracle", () => {
    const model = createDefaultModel();
    model.projectName = "Distinct V2 project";
    model.description = "Distinct persisted description";
    model.assumptions = "Distinct persisted assumptions";
    model.geometry = {
      lengthM: 13.25,
      widthM: 7.75,
      thicknessM: 0.42,
      skewAngleDeg: -19,
    };
    model.material = {
      elasticModulusMPa: 31001,
      poisson: 0.23,
      densityKnPerM3: 24.5,
    };
    model.mesh = { density: 17, autoTargetElementM: 0.37 };
    model.supports = [
      {
        id: "LINE-distinct",
        name: "Distinct legacy line",
        kind: "line",
        constraints: {
          uz: { type: "fixed" },
          rx: { type: "spring", stiffness: 1234 },
          ry: { type: "free" },
        },
        x1: 1.1,
        y1: 2.2,
        x2: 3.3,
        y2: 4.4,
      },
      {
        id: "POINT-distinct",
        name: "Distinct legacy point",
        kind: "point",
        constraints: {
          uz: { type: "spring", stiffness: 9876 },
          rx: { type: "free" },
          ry: { type: "fixed" },
        },
        x: 5.5,
        y: 6.6,
      },
    ];
    model.vehicle = {
      name: "Distinct vehicle",
      mode: "direct",
      transverseSpacingM: 1.31,
      wheelsPerAxle: 3,
      wheelPatchLongM: 0.46,
      wheelPatchTransM: 0.27,
      axleInputs: [
        { id: "AX-distinct", spacingFromPreviousM: 2.7, axleLoadKn: 111 },
      ],
      directWheels: [
        {
          id: "WH-distinct",
          xM: 7.1,
          yM: 3.2,
          loadKn: 61,
          patchLongM: 0.41,
          patchTransM: 0.22,
        },
      ],
    };
    model.placement = {
      centerXM: 8.1,
      centerYM: 3.7,
      headingDeg: 31,
      transverseOffsetM: -0.8,
      travelDirection: "y-",
      pathStartM: -1.2,
      pathEndM: 11.4,
      pathStepM: 0.6,
    };
    model.display = {
      plotMode: "deformed",
      mesh: false,
      supports: true,
      wheelPatches: false,
      contours: true,
      tables: false,
    };
    model.section = { axis: "y", centerPerpM: 4.3, widthM: 1.6 };

    const serialized = JSON.parse(serializeModelForSave(model));

    expect(serialized).toEqual(EXPECTED_DISTINCT_V2_SNAPSHOT);
    expect(serialized.supports).toEqual([
      EXPECTED_DISTINCT_V2_SNAPSHOT.supports[0],
      EXPECTED_DISTINCT_V2_SNAPSHOT.supports[1],
    ]);
  });

  it.each(INVALID_SNAPSHOT_CASES)(
    "rejects $name before numeric sanitization",
    ({ mutate, expectedError }) => {
      const snapshot = distinctV2Snapshot();
      snapshot.geometry.skewAngleDeg = Number.POSITIVE_INFINITY;
      mutate(snapshot);

      let thrown: unknown;
      try {
        sanitizeLoadedModel(snapshot);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe(expectedError);
    },
  );
});

describe("deck-local section settings (WP-041A, live-only)", () => {
  const DEFAULT_DECK_SECTION: DeckSectionSettings = {
    mode: "longitudinal",
    ordinate: "mx",
    centerTM: 2.5,
    widthM: 1,
  };

  it("creates the live default deckSection with the expected shape", () => {
    const model = createDefaultModel();

    expect(model.deckSection).toEqual(DEFAULT_DECK_SECTION);
  });

  it("sanitizeDeckSection accepts a valid longitudinal input", () => {
    const result = sanitizeDeckSection(
      { mode: "longitudinal", ordinate: "my", centerTM: 1.5, widthM: 0.75 },
      DEFAULT_DECK_SECTION,
    );

    expect(result).toEqual({
      mode: "longitudinal",
      ordinate: "my",
      centerTM: 1.5,
      widthM: 0.75,
    });
  });

  it("sanitizeDeckSection accepts a valid transverse input", () => {
    const result = sanitizeDeckSection(
      { mode: "transverse", ordinate: "mxy", centerSM: 4, widthM: 2 },
      DEFAULT_DECK_SECTION,
    );

    expect(result).toEqual({
      mode: "transverse",
      ordinate: "mxy",
      centerSM: 4,
      widthM: 2,
    });
  });

  it.each([
    "not-a-mode",
    undefined,
    null,
    123,
  ])("sanitizeDeckSection falls back to the default on an invalid mode %s", (mode) => {
    const result = sanitizeDeckSection(
      { mode, ordinate: "mx", centerTM: 1, widthM: 1 },
      DEFAULT_DECK_SECTION,
    );

    expect(result).toEqual(DEFAULT_DECK_SECTION);
  });

  it.each([
    "not-an-ordinate",
    undefined,
    null,
    "MX",
  ])("sanitizeDeckSection falls back to the default on an invalid ordinate %s", (ordinate) => {
    const result = sanitizeDeckSection(
      { mode: "longitudinal", ordinate, centerTM: 1, widthM: 1 },
      DEFAULT_DECK_SECTION,
    );

    expect(result).toEqual(DEFAULT_DECK_SECTION);
  });

  it("sanitizeDeckSection falls back to the default on a non-positive widthM", () => {
    const result = sanitizeDeckSection(
      { mode: "longitudinal", ordinate: "mx", centerTM: 1, widthM: 0 },
      DEFAULT_DECK_SECTION,
    );

    expect(result).toEqual(DEFAULT_DECK_SECTION);
  });

  it("sanitizeDeckSection falls back to the default on a non-finite centre", () => {
    const longitudinal = sanitizeDeckSection(
      { mode: "longitudinal", ordinate: "mx", centerTM: Number.NaN, widthM: 1 },
      DEFAULT_DECK_SECTION,
    );
    const transverse = sanitizeDeckSection(
      { mode: "transverse", ordinate: "mx", centerSM: "not-a-number", widthM: 1 },
      DEFAULT_DECK_SECTION,
    );

    expect(longitudinal).toEqual(DEFAULT_DECK_SECTION);
    expect(transverse).toEqual(DEFAULT_DECK_SECTION);
  });

  it("sanitizeDeckSection falls back to the default on missing/non-object input", () => {
    expect(sanitizeDeckSection(undefined, DEFAULT_DECK_SECTION)).toEqual(DEFAULT_DECK_SECTION);
    expect(sanitizeDeckSection(null, DEFAULT_DECK_SECTION)).toEqual(DEFAULT_DECK_SECTION);
    expect(sanitizeDeckSection("nope", DEFAULT_DECK_SECTION)).toEqual(DEFAULT_DECK_SECTION);
  });

  it("defaults deckSection on a loaded legacy snapshot lacking the field, and still round-trips", () => {
    const legacyV2 = v2Snapshot(19);
    expect(legacyV2).not.toHaveProperty("deckSection");

    const model = sanitizeLoadedModel(legacyV2);

    expect(model.deckSection).toEqual(DEFAULT_DECK_SECTION);

    const persisted = JSON.parse(serializeModelForSave(model)) as Record<string, unknown>;
    expect(persisted).not.toHaveProperty("deckSection");
    expect(Object.keys(persisted).sort()).toEqual(
      [
        "schemaVersion",
        "supportSchema",
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
      ].sort(),
    );

    const reloaded = sanitizeLoadedModel(persisted);
    expect(reloaded).toEqual(model);
    expect(reloaded.deckSection).toEqual(DEFAULT_DECK_SECTION);
  });
});

describe("run validation", () => {
  it("rejects non-axis-aligned line supports and empty direct-wheel models", () => {
    const model = createDefaultModel();
    model.supports = [
      {
        id: "S1",
        name: "Diagonal",
        kind: "line",
        x1: 0,
        y1: 0,
        x2: 2,
        y2: 1,
        constraints: {
          uz: { type: "fixed" },
          rx: { type: "free" },
          ry: { type: "free" },
        },
      },
    ];
    model.vehicle.mode = "direct";
    model.vehicle.directWheels = [];

    const issues = validateModelForRun(model);

    expect(issues.some((issue) => /axis-aligned/i.test(issue))).toBe(true);
    expect(issues.some((issue) => /at least one wheel/i.test(issue))).toBe(true);
  });

  it("creates empty error-state results without stale geometry", () => {
    const result = errorResults("bad analysis");

    expect(result.status).toBe("error");
    expect(result.error).toBe("bad analysis");
    expect(result.contours).toEqual({});
    expect(result.nodalContours).toEqual({});
    expect(result.meshNodes).toEqual([]);
    expect(result.meshElements).toEqual([]);
    expect(result.wheelPatches).toEqual([]);
  });
});
