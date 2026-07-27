import type { SlabModel } from "../../app/types";
import { deriveMeshResolution } from "../../app/meshSizing";
import { getDeckEdgeSegment } from "../geometry/deckCoordinates";
import type {
  AxisDirection,
  FixedPositionAnalysisModel,
  LegacySolverSlabGeometryInput,
  StagedSkewSolverContract,
  SupportDefinition,
  SupportDofConstraint,
} from "./types";

export function normalizeSolverGeometry(
  input: LegacySolverSlabGeometryInput,
): StagedSkewSolverContract.NormalizedSlabGeometry {
  return {
    lengthM: input.lengthX,
    widthM: input.lengthY,
    thicknessM: input.thickness,
    skewAngleDeg: input.skewAngleDeg ?? 0,
  };
}

export function fromAppModel(model: SlabModel): FixedPositionAnalysisModel {
  const normalizedGeometry = normalizeSolverGeometry({
    lengthX: model.geometry.lengthM,
    lengthY: model.geometry.widthM,
    thickness: model.geometry.thicknessM,
    skewAngleDeg: model.geometry.skewAngleDeg,
  });
  const { targetElementsX, targetElementsY } = deriveMeshResolution(
    normalizedGeometry,
    model.mesh.autoTargetElementM,
  );

  return {
    slab: {
      lengthX: normalizedGeometry.lengthM,
      lengthY: normalizedGeometry.widthM,
      thickness: normalizedGeometry.thicknessM,
      skewAngleDeg: normalizedGeometry.skewAngleDeg,
    },
    material: {
      elasticModulusMPa: model.material.elasticModulusMPa,
      poissonRatio: model.material.poisson,
    },
    mesh: {
      targetElementsX,
      targetElementsY,
    },
    supports: model.supports.map((support) => toSupportDefinition(support, model.geometry)),
    vehicle:
      model.vehicle.mode === "axle"
        ? {
            kind: "axle-builder",
            direction: toDirection(model.placement.travelDirection),
            reference: {
              x: model.placement.centerXM,
              y: model.placement.centerYM,
            },
            referenceKind: "vehicle-center",
            transverseOffset: model.placement.transverseOffsetM,
            defaultTransverseSpacing: model.vehicle.transverseSpacingM,
            defaultPatchLength: model.vehicle.wheelPatchLongM,
            defaultPatchWidth: model.vehicle.wheelPatchTransM,
            axles: model.vehicle.axleInputs.map((axle, index, all) => ({
              id: axle.id,
              axleLoad: axle.axleLoadKn,
              wheelCount: model.vehicle.wheelsPerAxle,
              spacingToNext:
                index < all.length - 1 ? all[index + 1].spacingFromPreviousM : undefined,
            })),
          }
        : {
            kind: "explicit-wheels",
            direction: toDirection(model.placement.travelDirection),
            coordinateSystem: "global-slab",
            wheels: model.vehicle.directWheels.map((wheel) => ({
              id: wheel.id,
              x: wheel.xM,
              y: wheel.yM,
              load: wheel.loadKn,
              patchLength: wheel.patchLongM,
              patchWidth: wheel.patchTransM,
              direction: toDirection(model.placement.travelDirection),
            })),
          },
    metadata: {
      projectName: model.projectName,
    },
  };
}

function toSupportDefinition(
  support: SlabModel["supports"][number],
  geometry: SlabModel["geometry"],
): SupportDefinition {
  const dofs = {
    w: toSupportConstraint("uz", support.constraints.uz),
    rx: toSupportConstraint("rx", support.constraints.rx),
    ry: toSupportConstraint("ry", support.constraints.ry),
  };

  if (support.kind === "line") {
    return {
      kind: "line",
      id: support.id,
      behavior: "custom",
      x1: support.x1,
      y1: support.y1,
      x2: support.x2,
      y2: support.y2,
      dofs,
    };
  }

  if (support.kind === "edge") {
    const [p0, p1] = getDeckEdgeSegment(geometry, support.edge);
    return {
      kind: "line",
      id: support.id,
      behavior: "custom",
      x1: p0.x,
      y1: p0.y,
      x2: p1.x,
      y2: p1.y,
      dofs,
    };
  }

  return {
    kind: "point",
    id: support.id,
    behavior: "custom",
    x: support.x,
    y: support.y,
    dofs,
  };
}

function toSupportConstraint(
  dof: "uz" | "rx" | "ry",
  input: SlabModel["supports"][number]["constraints"]["uz"],
): SupportDofConstraint {
  if (input.type === "free") {
    return { kind: "free" };
  }
  if (input.type === "fixed") {
    return { kind: "fixed" };
  }
  if (input.type === "spring") {
    return { kind: "spring", stiffness: input.stiffness ?? 10000 };
  }
  return dof === "uz" ? { kind: "fixed" } : { kind: "free" };
}

function toDirection(direction: SlabModel["placement"]["travelDirection"]): AxisDirection {
  switch (direction) {
    case "x+":
      return "+x";
    case "x-":
      return "-x";
    case "y+":
      return "+y";
    case "y-":
      return "-y";
  }
}
