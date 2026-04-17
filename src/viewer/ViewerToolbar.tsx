import type { PlotMode, SlabModel } from "../app/types";
import { PLOT_MODE_OPTIONS } from "../app/plotModes";

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
  onDeformScaleChange: (scale: number) => void;
}

export const ViewerToolbar = ({
  model,
  onModelChange,
  deformScale,
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
            Scale ×{deformScale}
            <input
              type="range"
              min={1}
              max={200}
              value={deformScale}
              onChange={(e) => onDeformScaleChange(Number(e.target.value))}
            />
          </label>
        </div>
      )}
    </div>
  );
};
