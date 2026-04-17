import { useState, useCallback } from "react";

export interface ProbeHit {
  x: number;
  y: number;
  value: number;
}

export interface UseViewerStateReturn {
  deformScale: number;
  setDeformScale: (scale: number) => void;
  probeHit: ProbeHit | null;
  setProbeHit: (hit: ProbeHit | null) => void;
}

export function useViewerState(): UseViewerStateReturn {
  const [deformScale, setDeformScaleRaw] = useState(30);
  const [probeHit, setProbeHit] = useState<ProbeHit | null>(null);

  const setDeformScale = useCallback((scale: number) => {
    setDeformScaleRaw(Math.max(0.1, scale));
  }, []);

  return { deformScale, setDeformScale, probeHit, setProbeHit };
}
