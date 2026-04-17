import type { PlotMode, SlabModel } from "../app/types";

const MODES: { value: PlotMode; label: string }[] = [
  { value: "structure", label: "Structure" },
  { value: "mesh", label: "Mesh" },
  { value: "results", label: "Results 2D" },
  { value: "deformed", label: "Deformed 3D" },
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
  const { plotMode, mesh, supports, wheelPatches, contours } = model.display;

  const setMode = (mode: PlotMode) => {
    onModelChange({ ...model, display: { ...model.display, plotMode: mode } });
  };

  // Only boolean display toggles — excludes plotMode which is PlotMode type
  type BoolToggleKey = "mesh" | "supports" | "wheelPatches" | "contours";
  const toggle = (key: BoolToggleKey) => {
    onModelChange({ ...model, display: { ...model.display, [key]: !model.display[key] } });
  };

  return (
    <div className="viewer-toolbar">
      <div className="viewer-toolbar-modes">
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            className={`viewer-mode-btn${plotMode === value ? " active" : ""}`}
            onClick={() => setMode(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="viewer-toolbar-toggles">
        <label>
          <input type="checkbox" checked={mesh} onChange={() => toggle("mesh")} />
          Mesh
        </label>
        <label>
          <input type="checkbox" checked={supports} onChange={() => toggle("supports")} />
          Supports
        </label>
        <label>
          <input type="checkbox" checked={wheelPatches} onChange={() => toggle("wheelPatches")} />
          Wheels
        </label>
        <label>
          <input type="checkbox" checked={contours} onChange={() => toggle("contours")} />
          Contours
        </label>
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
