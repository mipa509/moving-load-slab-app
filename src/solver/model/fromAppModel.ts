import type { SlabModel } from "../../app/types";
import { deriveMeshResolution } from "../../app/meshSizing";
import type {
  AxisDirection,
  FixedPositionAnalysisModel,
  SupportDefinition,
  SupportDofConstraint,
} from "./types";

export function fromAppModel(model: SlabModel): FixedPositionAnalysisModel {
  const { targetElementsX, targetElementsY } = deriveMeshResolution(
    model.geometry,
    model.mesh.autoTargetElementM,
  );

  return {
    slab: {
      lengthX: model.geometry.lengthM,
      lengthY: model.geometry.widthM,
      thickness: model.geometry.thicknessM,
    },
    material: {
      elasticModulusMPa: model.material.elasticModulusMPa,
      poissonRatio: model.material.poisson,
    },
    mesh: {
      targetElementsX,
      targetElementsY,
    },
    supports: model.supports.map(toSupportDefinition),
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
            defaultWheelTrack: model.vehicle.trackM,
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

function toSupportDefinition(support: SlabModel["supports"][number]): SupportDefinition {
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
