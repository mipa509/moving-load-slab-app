import type { DirectWheelInput } from "./types";

export interface DirectWheelCluster {
  xM: number;
  totalLoadKn: number;
  wheelCount: number;
}

export const clusterDirectWheelsByLongitudinal = (
  wheels: readonly DirectWheelInput[],
  tolM: number,
): DirectWheelCluster[] => {
  if (wheels.length === 0) return [];
  const sorted = [...wheels].sort((a, b) => a.xM - b.xM);
  const tol = Math.max(0, tolM);

  const clusters: { sumX: number; sumLoad: number; count: number; centroid: number }[] = [];
  for (const w of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(w.xM - last.centroid) <= tol) {
      last.sumX += w.xM;
      last.sumLoad += w.loadKn;
      last.count += 1;
      last.centroid = last.sumX / last.count;
    } else {
      clusters.push({
        sumX: w.xM,
        sumLoad: w.loadKn,
        count: 1,
        centroid: w.xM,
      });
    }
  }

  return clusters.map((c) => ({
    xM: c.centroid,
    totalLoadKn: c.sumLoad,
    wheelCount: c.count,
  }));
};
