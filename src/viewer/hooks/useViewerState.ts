import { useState } from "react";

export interface ProbeHit {
  x: number;
  y: number;
  value: number;
}

export interface ViewerState {
  deformScale: number;
  setDeformScale: (scale: number) => void;
  probeHit: ProbeHit | null;
  setProbeHit: (hit: ProbeHit | null) => void;
}

export function useViewerState(): ViewerState {
  const [deformScale, setDeformScale] = useState(30);
  const [probeHit, setProbeHit] = useState<ProbeHit | null>(null);
  return { deformScale, setDeformScale, probeHit, setProbeHit };
}
