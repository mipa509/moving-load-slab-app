import type { PlotMode, SlabModel } from "../app/types";
import { PLOT_MODE_OPTIONS } from "../app/plotModes";
import {
  DEFORM_MULTIPLIER_MAX,
  DEFORM_MULTIPLIER_MIN,
} from "./viewerPresentation";

type BoolToggleKey = "mesh" | "supports" | "wheelPatches" | "contours";

const TOGGLES: { key: BoolToggleKey; label: string }[] = [
  { key: "mesh", label: "Mesh" },
  { key: "supports", label: "Supports" },
  { key: "wheelPatches", label: "Wheels" },
  { key: "contours", label: "Contours" },
];

interface ViewerToolbarProps {
  model: SlabModel;
  onModelChange: (model: SlabModel) => void;
  deformScale: number;
  effectiveExaggeration: number;
  hasVisibleDeformation: boolean;
  onDeformScaleChange: (scale: number) => void;
}

export const ViewerToolbar = ({
  model,
  onModelChange,
  deformScale,
  effectiveExaggeration,
  hasVisibleDeformation,
  onDeformScaleChange,
}: ViewerToolbarProps) => {
  const { plotMode } = model.display;

  const setMode = (mode: PlotMode) => {
    onModelChange({ ...model, display: { ...model.display, plotMode: mode } });
  };

  const toggle = (key: BoolToggleKey) => {
    onModelChange({ ...model, display: { ...model.display, [key]: !model.display[key] } });
  };

  return (
    <div className="viewer-toolbar">
      <div className="viewer-toolbar-modes">
        {PLOT_MODE_OPTIONS.map(({ value, toolbarLabel }) => (
          <button
            key={value}
            className={`viewer-mode-btn${plotMode === value ? " active" : ""}`}
            onClick={() => setMode(value)}
            type="button"
          >
            {toolbarLabel}
          </button>
        ))}
      </div>
      <div className="viewer-toolbar-toggles">
        {TOGGLES.map(({ key, label }) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={model.display[key]}
              onChange={() => toggle(key)}
            />
            {label}
          </label>
        ))}
      </div>
      {plotMode === "deformed" && (
        <div className="viewer-toolbar-deform">
          <label>
            {hasVisibleDeformation
              ? `Shape ${deformScale.toFixed(2)}x (effective ${formatExaggeration(
                  effectiveExaggeration,
                )})`
              : "Shape unavailable (no finite deflection)"}
            <input
              type="range"
              min={DEFORM_MULTIPLIER_MIN}
              max={DEFORM_MULTIPLIER_MAX}
              step={0.05}
              value={deformScale}
              disabled={!hasVisibleDeformation}
              onChange={(event) => onDeformScaleChange(Number(event.target.value))}
            />
          </label>
        </div>
      )}
    </div>
  );
};

function formatExaggeration(value: number): string {
  if (value >= 1000) {
    return `${value.toFixed(0)}x`;
  }
  if (value >= 100) {
    return `${value.toFixed(1)}x`;
  }
  return `${value.toFixed(2)}x`;
}
