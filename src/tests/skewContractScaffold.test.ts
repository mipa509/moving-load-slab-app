import { describe, expect, expectTypeOf, it } from "vitest";
import * as SolverModelRuntime from "../solver/model/types";
import type {
  Aabb,
  DeckEdge,
  Point2D,
  Polygon2D,
  SlabGeometry as CanonicalSlabGeometry,
} from "../solver/geometry/types";
import type {
  FixedPositionAnalysisModelInputV2,
  GeneralizedSupportDof,
  MeshElement,
  NormalizeSolverSupports,
  SlabGeometry as LiveSolverSlabGeometry,
  SolverSupportInputBridgeV2,
  StagedSkewSolverContract,
  StructuredMesh,
} from "../solver/model/types";
import type {
  ElementFieldMap,
  EnvelopeFieldMap,
  IdleAnalysisResults,
  LoadablePersistedModel,
  NodalFieldMap,
  PersistedModelV1Implicit,
  PersistedModelV2SkewLegacySupports,
  PersistedModelV3PhysicalSupports,
  PersistedModelV4SectionBridge,
  PersistedModelV5DeckOnly,
  ReleaseWarning,
  SlabGeometry as LiveAppSlabGeometry,
  SuccessAnalysisResultEvidence,
  SuccessAnalysisResults,
  Support as LiveAppSupport,
  SupportReactionComponent,
  StagedSkewAppContract,
  WarningFreeVerificationStatus,
  WarningRequiredVerificationStatus,
} from "../app/types";

describe("skew contract scaffold", () => {
  it("exposes canonical geometry and the promoted solver mesh", () => {
    expectTypeOf<Point2D>().toEqualTypeOf<{ x: number; y: number }>();
    expectTypeOf<Polygon2D>().toEqualTypeOf<Point2D[]>();
    expectTypeOf<Aabb>().toEqualTypeOf<{
      xMin: number;
      xMax: number;
      yMin: number;
      yMax: number;
    }>();
    expectTypeOf<DeckEdge>().toEqualTypeOf<
      "start" | "end" | "lower-side" | "upper-side"
    >();
    expectTypeOf<CanonicalSlabGeometry["skewAngleDeg"]>().toEqualTypeOf<number>();
    expectTypeOf<LiveAppSlabGeometry>().toEqualTypeOf<CanonicalSlabGeometry>();
    expectTypeOf<LiveAppSlabGeometry["skewAngleDeg"]>().toEqualTypeOf<number>();

    const sCoordinates = [0, 5];
    const tCoordinates = [0, 5];
    const mesh: StructuredMesh = {
      sCoords: sCoordinates,
      tCoords: tCoordinates,
      xCoords: sCoordinates,
      yCoords: tCoordinates,
      nodes: [],
      elements: [],
      nodeIdsByIJ: [],
      elementCountS: 1,
      elementCountT: 1,
    };

    expect(mesh.xCoords).toBe(mesh.sCoords);
    expect(mesh.yCoords).toBe(mesh.tCoords);
    expectTypeOf<MeshElement["polygon"]>()
      .toEqualTypeOf<Polygon2D>();
    expectTypeOf<StagedSkewSolverContract.WheelPatchV2["clippedBounds"]>()
      .toEqualTypeOf<Aabb | null>();
    expectTypeOf<GeneralizedSupportDof>().toEqualTypeOf<"w" | "betaX" | "betaY">();
    expectTypeOf<Parameters<NormalizeSolverSupports>>()
      .toEqualTypeOf<[SolverSupportInputBridgeV2]>();
    expectTypeOf<ReturnType<NormalizeSolverSupports>>()
      .toEqualTypeOf<StagedSkewSolverContract.SupportDefinitionV2[]>();
    expectTypeOf<Extract<keyof typeof SolverModelRuntime, "normalizeSolverSupports">>()
      .toEqualTypeOf<never>();
    expect("normalizeSolverSupports" in SolverModelRuntime).toBe(false);
  });

  it("materializes every staged app collision member", () => {
    expectTypeOf<StagedSkewAppContract.ResultFieldV2>().toEqualTypeOf<
      "deflection" | "mx" | "my" | "mxy" | "qx" | "qy" | "reactions"
    >();
    expectTypeOf<StagedSkewAppContract.EnvelopeFieldV2>().toEqualTypeOf<
      "deflection" | "mx" | "my" | "mxy"
    >();
    expectTypeOf<StagedSkewAppContract.MeshNodeOverlayV2>().toEqualTypeOf<{
      id: number;
      xM: number;
      yM: number;
      sM: number;
      tM: number;
    }>();
    expectTypeOf<StagedSkewAppContract.MeshElementOverlayV2["polygon"]>()
      .toEqualTypeOf<Array<{ xM: number; yM: number }>>();
    expectTypeOf<StagedSkewAppContract.EnvelopePerNodeV2["sM"]>()
      .toEqualTypeOf<number>();
    expectTypeOf<
      StagedSkewAppContract.EnvelopeFieldDataV2<"mxy", "kN*m/m">
    >().toEqualTypeOf<EnvelopeFieldMap["mxy"]>();
    expectTypeOf<StagedSkewAppContract.EnvelopeWorstStationV2<"mx">["field"]>()
      .toEqualTypeOf<"mx">();
    expectTypeOf<StagedSkewAppContract.EnvelopeWorstStationsV2["mxy"]["units"]>()
      .toEqualTypeOf<"kN*m/m">();
    expectTypeOf<StagedSkewAppContract.EnvelopeDataV2["fields"]>()
      .toEqualTypeOf<EnvelopeFieldMap>();
    expectTypeOf<StagedSkewAppContract.SectionSettingsV2["deck"]>()
      .toMatchTypeOf<{ mode: "longitudinal" | "transverse" }>();
    expectTypeOf<SuccessAnalysisResults>()
      .toMatchTypeOf<StagedSkewAppContract.AnalysisResultsV2>();
  });

  it("correlates result keys, fields, locations, and units", () => {
    expectTypeOf<NodalFieldMap["mxy"]["field"]>().toEqualTypeOf<"mxy">();
    expectTypeOf<NodalFieldMap["mxy"]["location"]>().toEqualTypeOf<"node">();
    expectTypeOf<NodalFieldMap["mxy"]["units"]>().toEqualTypeOf<"kN*m/m">();
    expectTypeOf<ElementFieldMap["qx"]["field"]>().toEqualTypeOf<"qx">();
    expectTypeOf<ElementFieldMap["qx"]["location"]>()
      .toEqualTypeOf<"element-center">();
    expectTypeOf<ElementFieldMap["qx"]["units"]>().toEqualTypeOf<"kN/m">();
    expectTypeOf<EnvelopeFieldMap["deflection"]["units"]>().toEqualTypeOf<"mm">();
    expectTypeOf<EnvelopeFieldMap["mxy"]["field"]>().toEqualTypeOf<"mxy">();

    type ForceReaction = Extract<SupportReactionComponent, { component: "forceZ" }>;
    type CoupleReaction = Extract<
      SupportReactionComponent,
      { component: "coupleX" | "coupleY" }
    >;
    expectTypeOf<ForceReaction["units"]>().toEqualTypeOf<"kN">();
    expectTypeOf<CoupleReaction["units"]>().toEqualTypeOf<"kN*m">();

    type ActualMxyField = NodalFieldMap["mxy"];
    type WrongField = Omit<ActualMxyField, "field"> & { field: "mx" };
    type WrongLocation = Omit<ActualMxyField, "location"> & {
      location: "element-center";
    };
    type WrongUnits = Omit<ActualMxyField, "units"> & { units: "kN/m" };
    expectTypeOf<WrongField>().not.toMatchTypeOf<ActualMxyField>();
    expectTypeOf<WrongLocation>().not.toMatchTypeOf<ActualMxyField>();
    expectTypeOf<WrongUnits>().not.toMatchTypeOf<ActualMxyField>();
  });

  it("keeps live support and solver geometry compatibility boundaries explicit", () => {
    expectTypeOf<LiveAppSupport["kind"]>().toEqualTypeOf<"line" | "point">();
    expectTypeOf<Extract<LiveAppSupport, { kind: "edge" }>>().toEqualTypeOf<never>();
    expectTypeOf<
      Extract<StagedSkewAppContract.SupportV2, { kind: "edge" }>["edge"]
    >().toEqualTypeOf<DeckEdge>();
    expectTypeOf<
      Extract<
        FixedPositionAnalysisModelInputV2,
        { supportInputSchema: "physical-v2" }
      >["supports"]
    >().toEqualTypeOf<StagedSkewSolverContract.SupportDefinitionV2[]>();

    const appGeometry: LiveAppSlabGeometry = {
      lengthM: 10,
      widthM: 5,
      thicknessM: 0.25,
      skewAngleDeg: 0,
    };
    // @ts-expect-error Live app geometry requires an explicit structural skew angle.
    const missingAppSkew: LiveAppSlabGeometry = {
      lengthM: 10,
      widthM: 5,
      thicknessM: 0.25,
    };
    const solverGeometry: LiveSolverSlabGeometry = {
      lengthX: 10,
      lengthY: 5,
      thickness: 0.25,
    };
    const legacyModelShape: FixedPositionAnalysisModelInputV2["slab"] = solverGeometry;

    expect(appGeometry).toEqual({
      lengthM: 10,
      widthM: 5,
      thicknessM: 0.25,
      skewAngleDeg: 0,
    });
    void missingAppSkew;
    expect(legacyModelShape.skewAngleDeg).toBeUndefined();
  });

  it("fixes result status warning tuples and persistence discriminants", () => {
    type WarningFreeSuccess = SuccessAnalysisResultEvidence & {
      verification: WarningFreeVerificationStatus;
      releaseWarnings: [];
    };
    type WarningRequiredSuccess = SuccessAnalysisResultEvidence & {
      verification: WarningRequiredVerificationStatus;
      releaseWarnings: [ReleaseWarning];
    };
    type MissingRequiredWarning = SuccessAnalysisResultEvidence & {
      verification: WarningRequiredVerificationStatus;
      releaseWarnings: [];
    };
    type UnexpectedWarning = SuccessAnalysisResultEvidence & {
      verification: WarningFreeVerificationStatus;
      releaseWarnings: [ReleaseWarning];
    };

    expectTypeOf<IdleAnalysisResults["releaseWarnings"]>().toEqualTypeOf<[]>();
    expectTypeOf<WarningFreeSuccess>().toMatchTypeOf<SuccessAnalysisResults>();
    expectTypeOf<WarningRequiredSuccess>().toMatchTypeOf<SuccessAnalysisResults>();
    expectTypeOf<MissingRequiredWarning>().not.toMatchTypeOf<SuccessAnalysisResults>();
    expectTypeOf<UnexpectedWarning>().not.toMatchTypeOf<SuccessAnalysisResults>();
    expectTypeOf<StagedSkewAppContract.AnalysisResultsV2["status"]>()
      .toEqualTypeOf<"idle" | "running" | "success" | "error">();

    expectTypeOf<PersistedModelV1Implicit>().toMatchTypeOf<LoadablePersistedModel>();
    expectTypeOf<PersistedModelV2SkewLegacySupports>()
      .toMatchTypeOf<LoadablePersistedModel>();
    expectTypeOf<PersistedModelV3PhysicalSupports>()
      .toMatchTypeOf<LoadablePersistedModel>();
    expectTypeOf<PersistedModelV4SectionBridge>()
      .toMatchTypeOf<LoadablePersistedModel>();
    expectTypeOf<PersistedModelV5DeckOnly>().toMatchTypeOf<LoadablePersistedModel>();
    expectTypeOf<PersistedModelV1Implicit["schemaVersion"]>()
      .toEqualTypeOf<undefined>();
    expectTypeOf<Extract<LoadablePersistedModel, { schemaVersion: 2 }>["supportSchema"]>()
      .toEqualTypeOf<"legacy-generalized-v1">();
    expectTypeOf<Extract<LoadablePersistedModel, { schemaVersion: 3 }>["supportSchema"]>()
      .toEqualTypeOf<"physical-v1">();
    expectTypeOf<Extract<LoadablePersistedModel, { schemaVersion: 4 }>["sectionSchema"]>()
      .toEqualTypeOf<"section-bridge-v1">();
    expectTypeOf<Extract<LoadablePersistedModel, { schemaVersion: 5 }>["sectionSchema"]>()
      .toEqualTypeOf<"deck-local-v1">();

    type InvalidV1 = Omit<PersistedModelV1Implicit, "schemaVersion"> & {
      schemaVersion: 1;
    };
    type InvalidV2 = Omit<PersistedModelV2SkewLegacySupports, "geometry"> & {
      geometry: PersistedModelV1Implicit["geometry"];
    };
    type InvalidV3 = Omit<PersistedModelV3PhysicalSupports, "supports"> & {
      supports: PersistedModelV1Implicit["supports"];
    };
    type InvalidV4 = Omit<PersistedModelV4SectionBridge, "sectionSchema"> & {
      sectionSchema: "deck-local-v1";
    };
    type InvalidV5 = Omit<PersistedModelV5DeckOnly, "section"> & {
      section: PersistedModelV1Implicit["section"];
    };
    expectTypeOf<InvalidV1>().not.toMatchTypeOf<LoadablePersistedModel>();
    expectTypeOf<InvalidV2>().not.toMatchTypeOf<LoadablePersistedModel>();
    expectTypeOf<InvalidV3>().not.toMatchTypeOf<LoadablePersistedModel>();
    expectTypeOf<InvalidV4>().not.toMatchTypeOf<LoadablePersistedModel>();
    expectTypeOf<InvalidV5>().not.toMatchTypeOf<LoadablePersistedModel>();
  });
});
