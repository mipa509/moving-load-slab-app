import type { PlotMode } from "./types";

export const PLOT_MODE_OPTIONS: {
  value: PlotMode;
  controlLabel: string;
  toolbarLabel: string;
}[] = [
  { value: "structure", controlLabel: "STRUCTURE", toolbarLabel: "Structure" },
  { value: "mesh", controlLabel: "MESH", toolbarLabel: "Mesh" },
  { value: "results", controlLabel: "RESULTS", toolbarLabel: "Results 2D" },
  { value: "deformed", controlLabel: "DEFORMED", toolbarLabel: "Deformed 3D" },
];

export const PLOT_MODES: PlotMode[] = PLOT_MODE_OPTIONS.map(({ value }) => value);
