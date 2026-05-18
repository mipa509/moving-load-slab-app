import { clusterDirectWheelsByLongitudinal } from "./vehicleClustering";
import type { VehicleDefinition } from "./types";

export interface SideElevationAxle {
  id: string;
  xM: number;
  loadKn: number;
  wheelCount: number;
}

export interface SideElevationLayout {
  axles: SideElevationAxle[];
  totalLengthM: number;
}

const DIRECT_WHEEL_CLUSTER_TOL_M = 0.05;

export const computeSideElevationLayout = (
  vehicle: VehicleDefinition,
): SideElevationLayout => {
  if (vehicle.mode === "axle") {
    let cumulative = 0;
    const axles: SideElevationAxle[] = vehicle.axleInputs.map((axle, index) => {
      if (index > 0) cumulative += Math.max(0, axle.spacingFromPreviousM);
      return {
        id: axle.id,
        xM: cumulative,
        loadKn: axle.axleLoadKn,
        wheelCount: Math.max(1, vehicle.wheelsPerAxle),
      };
    });
    const totalLengthM = axles.length > 0 ? axles[axles.length - 1].xM : 0;
    return { axles, totalLengthM };
  }

  const clusters = clusterDirectWheelsByLongitudinal(
    vehicle.directWheels,
    DIRECT_WHEEL_CLUSTER_TOL_M,
  );
  const minWheelX =
    vehicle.directWheels.length > 0
      ? Math.min(...vehicle.directWheels.map((w) => w.xM))
      : 0;
  const axles: SideElevationAxle[] = clusters.map((c, i) => ({
    id: `cluster-${i + 1}`,
    xM: c.xM - minWheelX,
    loadKn: c.totalLoadKn,
    wheelCount: c.wheelCount,
  }));
  const totalLengthM = axles.length > 0 ? axles[axles.length - 1].xM : 0;
  return { axles, totalLengthM };
};
