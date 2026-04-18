import { useState, useCallback } from "react";
import { clampDeformMultiplier } from "../viewerPresentation";

export interface ProbeHit {
  x: number;
  y: number;
  value: number;
  screenX: number;
  screenY: number;
}

export interface UseViewerStateReturn {
  deformScale: number;
  setDeformScale: (scale: number) => void;
  probeHit: ProbeHit | null;
  setProbeHit: (hit: ProbeHit | null) => void;
}

export function useViewerState(): UseViewerStateReturn {
  const [deformScale, setDeformScaleRaw] = useState(1);
  const [probeHit, setProbeHit] = useState<ProbeHit | null>(null);

  const setDeformScale = useCallback((scale: number) => {
    setDeformScaleRaw(clampDeformMultiplier(scale));
  }, []);

  return { deformScale, setDeformScale, probeHit, setProbeHit };
}
