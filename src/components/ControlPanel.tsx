import type {
  AxleInput,
  ConstraintType,
  Dof,
  DirectWheelInput,
  PlotMode,
  ResultField,
  SlabModel,
  Support,
  VehicleLibraryItem,
} from "../app/types";
import { deriveMeshResolution } from "../app/meshSizing";
import { PLOT_MODE_OPTIONS } from "../app/plotModes";
import { getTravelAxisSliderConfig } from "../app/placementControls";
import { SectionCard } from "./SectionCard";

interface ControlPanelProps {
  model: SlabModel;
  vehicleLibrary: VehicleLibraryItem[];
  selectedVehicleLibraryId: string;
  vehicleLibraryStatus?: string;
  selectedResultField: ResultField;
  running: boolean;
  envelopeRunning: boolean;
  envelopeProgress: { current: number; total: number } | null;
  envelopeStationCount: number;
  hasEnvelope: boolean;
  envelopeStale: boolean;
  onModelChange: (next: SlabModel) => void;
  onVehicleLibrarySelectionChange: (vehicleLibraryId: string) => void;
  onSaveVehicleToLibrary: () => void;
  onLoadVehicleFromLibrary: () => void;
  onOverwriteVehicleInLibrary: () => void;
  onDuplicateVehicleInLibrary: () => void;
  onDeleteVehicleFromLibrary: () => void;
  onExportVehicleLibrary: () => void;
  onImportVehicleLibraryClick: () => void;
  onResultFieldChange: (field: ResultField) => void;
  onRunAnalysis: () => void;
  onRunEnvelope: () => void;
  onSaveJson: () => void;
  onLoadJsonClick: () => void;
  onExportPdf: () => void;
}

type LineOrientation = "vertical" | "horizontal";

const dofs: Dof[] = ["uz", "rx", "ry"];
const resultFields: ResultField[] = [
  "deflection",
  "mx",
  "my",
  "qx",
  "qy",
  "reactions",
];
const constraintOptionsByDof: Record<Dof, Exclude<ConstraintType, "pinned">[]> = {
  uz: ["free", "fixed", "spring"],
  rx: ["free", "fixed", "spring"],
  ry: ["free", "fixed", "spring"],
};
const springUnitsByDof: Record<Dof, string> = {
  uz: "k (kN/m)",
  rx: "k (kN*m/rad)",
  ry: "k (kN*m/rad)",
};

const parseNumericInput = (value: string, fallback: number): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const getLineOrientation = (
  support: Extract<Support, { kind: "line" }>,
): LineOrientation =>
  Math.abs(support.x1 - support.x2) <= Math.abs(support.y1 - support.y2)
    ? "vertical"
    : "horizontal";

const snapLineSupportToOrientation = (
  support: Extract<Support, { kind: "line" }>,
  orientation: LineOrientation,
  geometry: SlabModel["geometry"],
): Extract<Support, { kind: "line" }> => {
  if (orientation === "vertical") {
    return {
      ...support,
      x2: support.x1,
      y2: support.y2 !== support.y1 ? support.y2 : geometry.widthM,
    };
  }

  return {
    ...support,
    y2: support.y1,
    x2: support.x2 !== support.x1 ? support.x2 : geometry.lengthM,
  };
};

const newSupport = (index: number): Support => ({
  id: `S${index + 1}`,
  name: `Support ${index + 1}`,
  kind: "line",
  x1: 0,
  y1: 0,
  x2: 0,
  y2: 5,
  constraints: {
    uz: { type: "fixed" },
    rx: { type: "free" },
    ry: { type: "free" },
  },
});

const newAxle = (index: number): AxleInput => ({
  id: `A${index + 1}`,
  spacingFromPreviousM: index === 0 ? 0 : 4,
  axleLoadKn: 100,
});

const newWheel = (index: number): DirectWheelInput => ({
  id: `W${index + 1}`,
  xM: 0,
  yM: 0,
  loadKn: 50,
  patchLongM: 0.4,
  patchTransM: 0.25,
});

export const ControlPanel = ({
  model,
  vehicleLibrary,
  selectedVehicleLibraryId,
  vehicleLibraryStatus,
  selectedResultField,
  running,
  envelopeRunning,
  envelopeProgress,
  envelopeStationCount,
  hasEnvelope,
  envelopeStale,
  onModelChange,
  onVehicleLibrarySelectionChange,
  onSaveVehicleToLibrary,
  onLoadVehicleFromLibrary,
  onOverwriteVehicleInLibrary,
  onDuplicateVehicleInLibrary,
  onDeleteVehicleFromLibrary,
  onExportVehicleLibrary,
  onImportVehicleLibraryClick,
  onResultFieldChange,
  onRunAnalysis,
  onRunEnvelope,
  onSaveJson,
  onLoadJsonClick,
  onExportPdf,
}: ControlPanelProps) => {
  const setModel = (updater: (curr: SlabModel) => SlabModel) => {
    onModelChange(updater(model));
  };
  const derivedMeshResolution = deriveMeshResolution(
    model.geometry,
    model.mesh.autoTargetElementM,
  );
  const sliderConfig = getTravelAxisSliderConfig(model);
  const selectedVehicleLibraryItem = vehicleLibrary.find(
    (item) => item.id === selectedVehicleLibraryId,
  );
  const hasVehicleLibrarySelection = Boolean(selectedVehicleLibraryItem);

  const updateSupportConstraint = (
    supportIndex: number,
    dof: Dof,
    nextType: ConstraintType,
  ) => {
    setModel((curr) => {
      const supports = [...curr.supports];
      const target = { ...supports[supportIndex] };
      target.constraints = { ...target.constraints };
      target.constraints[dof] = {
        ...target.constraints[dof],
        type: nextType,
        stiffness:
          nextType === "spring"
            ? target.constraints[dof].stiffness ?? 10000
            : undefined,
      };
      supports[supportIndex] = target;
      return { ...curr, supports };
    });
  };

  return (
    <aside className="control-panel">
      <header className="panel-header">
        <h1>Moving Load Slab</h1>
        <p>kN, m, MPa | linear elastic plate model</p>
      </header>

      <SectionCard title="Run" className="section-card-sticky" collapsible={false}>
        <div className="inline-actions">
          <button className="button button-primary" onClick={onRunAnalysis} disabled={running}>
            {running ? "Running..." : "Re-run Analysis"}
          </button>
          <button
            className="button"
            onClick={onRunEnvelope}
            disabled={envelopeRunning || running}
            title="Sweep the vehicle along the defined path and accumulate per-node max/min."
          >
            {envelopeRunning && envelopeProgress
              ? `Envelope ${envelopeProgress.current}/${envelopeProgress.total}…`
              : `Run Envelope (${envelopeStationCount} stations)`}
          </button>
          <button className="button" onClick={onExportPdf}>
            Export PDF (Print)
          </button>
        </div>
        <p className="field-note">Valid changes auto-run after a 150 ms debounce.</p>
        {hasEnvelope && !envelopeRunning ? (
          <p className={`field-note ${envelopeStale ? "muted" : ""}`}>
            {envelopeStale
              ? "Envelope is stale — inputs changed. Re-run to refresh."
              : "Envelope ready. The section plot shows max/min curves."}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title="Project" defaultCollapsed>
        <label className="field">
          <span>Project Name</span>
          <input
            value={model.projectName}
            onChange={(e) =>
              setModel((curr) => ({ ...curr, projectName: e.target.value }))
            }
          />
        </label>
        <label className="field">
          <span>Description (printed on the engineering note)</span>
          <textarea
            rows={3}
            value={model.description}
            onChange={(e) =>
              setModel((curr) => ({ ...curr, description: e.target.value }))
            }
          />
        </label>
        <label className="field">
          <span>Assumptions (semicolon- or newline-separated)</span>
          <textarea
            rows={4}
            value={model.assumptions}
            onChange={(e) =>
              setModel((curr) => ({ ...curr, assumptions: e.target.value }))
            }
          />
        </label>
        <div className="inline-actions">
          <button className="button" onClick={onSaveJson}>
            Save JSON
          </button>
          <button className="button" onClick={onLoadJsonClick}>
            Load JSON
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="Vehicle Library"
        subtitle="Save reusable vehicle definitions in browser storage and recall them later"
        defaultCollapsed
      >
        <label className="field">
          <span>Saved vehicles</span>
          <select
            value={selectedVehicleLibraryId}
            onChange={(e) => onVehicleLibrarySelectionChange(e.target.value)}
            disabled={vehicleLibrary.length === 0}
          >
            {vehicleLibrary.length === 0 ? (
              <option value="">No saved vehicles yet</option>
            ) : (
              vehicleLibrary.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))
            )}
          </select>
        </label>
        <p className="field-note">
          Saved vehicles: {vehicleLibrary.length}. Model JSON save/load does not modify this
          library.
        </p>
        {selectedVehicleLibraryItem ? (
          <p className="field-note">
            Selected: {selectedVehicleLibraryItem.name} | Mode:{" "}
            {selectedVehicleLibraryItem.vehicle.mode === "axle" ? "Axle-based" : "Direct wheels"}
          </p>
        ) : null}
        <div className="inline-actions">
          <button className="button" onClick={onSaveVehicleToLibrary}>
            Save Current
          </button>
          <button
            className="button"
            onClick={onLoadVehicleFromLibrary}
            disabled={!hasVehicleLibrarySelection}
          >
            Load Selected
          </button>
          <button
            className="button"
            onClick={onOverwriteVehicleInLibrary}
            disabled={!hasVehicleLibrarySelection}
          >
            Overwrite Selected
          </button>
        </div>
        <div className="inline-actions">
          <button
            className="button"
            onClick={onDuplicateVehicleInLibrary}
            disabled={!hasVehicleLibrarySelection}
          >
            Duplicate Selected
          </button>
          <button
            className="button"
            onClick={onDeleteVehicleFromLibrary}
            disabled={!hasVehicleLibrarySelection}
          >
            Delete Selected
          </button>
          <button
            className="button"
            onClick={onExportVehicleLibrary}
            disabled={vehicleLibrary.length === 0}
          >
            Export Library
          </button>
          <button className="button" onClick={onImportVehicleLibraryClick}>
            Import Library
          </button>
        </div>
        {vehicleLibraryStatus ? <p className="notice info">{vehicleLibraryStatus}</p> : null}
      </SectionCard>

      <SectionCard title="Slab Geometry">
        <label className="field">
          <span>Length (m)</span>
          <input
            type="number"
            value={model.geometry.lengthM}
            onChange={(e) =>
              setModel((curr) => ({
                ...curr,
                geometry: {
                  ...curr.geometry,
                  lengthM: parseNumericInput(e.target.value, curr.geometry.lengthM),
                },
              }))
            }
          />
        </label>
        <label className="field">
          <span>Width (m)</span>
          <input
            type="number"
            value={model.geometry.widthM}
            onChange={(e) =>
              setModel((curr) => ({
                ...curr,
                geometry: {
                  ...curr.geometry,
                  widthM: parseNumericInput(e.target.value, curr.geometry.widthM),
                },
              }))
            }
          />
        </label>
        <label className="field">
          <span>Thickness (m)</span>
          <input
            type="number"
            step="0.01"
            value={model.geometry.thicknessM}
            onChange={(e) =>
              setModel((curr) => ({
                ...curr,
                geometry: {
                  ...curr.geometry,
                  thicknessM: parseNumericInput(e.target.value, curr.geometry.thicknessM),
                },
              }))
            }
          />
        </label>
      </SectionCard>

      <SectionCard title="Material" defaultCollapsed>
        <label className="field">
          <span>E (MPa)</span>
          <input
            type="number"
            value={model.material.elasticModulusMPa}
            onChange={(e) =>
              setModel((curr) => ({
                ...curr,
                material: {
                  ...curr.material,
                  elasticModulusMPa: parseNumericInput(
                    e.target.value,
                    curr.material.elasticModulusMPa,
                  ),
                },
              }))
            }
          />
        </label>
        <label className="field">
          <span>Poisson</span>
          <input
            type="number"
            step="0.01"
            value={model.material.poisson}
            onChange={(e) =>
              setModel((curr) => ({
                ...curr,
                material: {
                  ...curr.material,
                  poisson: parseNumericInput(e.target.value, curr.material.poisson),
                },
              }))
            }
          />
        </label>
        <label className="field">
          <span>Density (kN/m^3)</span>
          <input
            type="number"
            value={model.material.densityKnPerM3}
            onChange={(e) =>
              setModel((curr) => ({
                ...curr,
                material: {
                  ...curr.material,
                  densityKnPerM3: parseNumericInput(e.target.value, curr.material.densityKnPerM3),
                },
              }))
            }
          />
        </label>
      </SectionCard>

      <SectionCard title="Mesh" subtitle="Target element size now drives the solver mesh directly">
        <label className="field">
          <span>Target element size (m)</span>
          <input
            type="number"
            step="0.1"
            value={model.mesh.autoTargetElementM}
            onChange={(e) =>
              setModel((curr) => {
                const autoTargetElementM = parseNumericInput(
                  e.target.value,
                  curr.mesh.autoTargetElementM,
                );
                const resolution = deriveMeshResolution(curr.geometry, autoTargetElementM);
                return {
                  ...curr,
                  mesh: {
                    ...curr.mesh,
                    autoTargetElementM,
                    density: resolution.targetElementsX,
                  },
                };
              })
            }
          />
        </label>
        <p className="field-note">
          Estimated solver mesh: {derivedMeshResolution.targetElementsX} x{" "}
          {derivedMeshResolution.targetElementsY} elements.
        </p>
      </SectionCard>

      <SectionCard
        title="Supports"
        subtitle="Line and point supports with explicit uz/rx/ry constraints"
        defaultCollapsed
      >
        <p className="field-note">
          Line supports are axis-aligned only in v1. The editor below keeps each line support
          horizontal or vertical.
        </p>
        <p className="field-note">
          Spring stiffness is entered in solver units. For line springs, the entered stiffness is
          the total support stiffness and is distributed internally across the mapped support
          nodes.
        </p>
        {model.supports.map((support, supportIndex) => (
          <article key={support.id} className="sub-card">
            <div className="sub-card-head">
              <strong>{support.id}</strong>
              <button
                className="button button-quiet"
                onClick={() =>
                  setModel((curr) => ({
                    ...curr,
                    supports: curr.supports.filter((_, idx) => idx !== supportIndex),
                  }))
                }
              >
                Remove
              </button>
            </div>

            <label className="field">
              <span>Name</span>
              <input
                value={support.name}
                onChange={(e) =>
                  setModel((curr) => {
                    const supports = [...curr.supports];
                    supports[supportIndex] = { ...supports[supportIndex], name: e.target.value };
                    return { ...curr, supports };
                  })
                }
              />
            </label>

            <label className="field">
              <span>Type</span>
              <select
                value={support.kind}
                onChange={(e) =>
                  setModel((curr) => {
                    const supports = [...curr.supports];
                    const prev = supports[supportIndex];
                    const nextKind = e.target.value as Support["kind"];
                    supports[supportIndex] =
                      nextKind === "line"
                        ? {
                            id: prev.id,
                            name: prev.name,
                            kind: "line",
                            x1: 0,
                            y1: 0,
                            x2: 0,
                            y2: curr.geometry.widthM,
                            constraints: prev.constraints,
                          }
                        : {
                            id: prev.id,
                            name: prev.name,
                            kind: "point",
                            x: 0,
                            y: 0,
                            constraints: prev.constraints,
                          };
                    return { ...curr, supports };
                  })
                }
              >
                <option value="line">Line</option>
                <option value="point">Point</option>
              </select>
            </label>

            {support.kind === "line" ? (
              <>
                {support.x1 !== support.x2 && support.y1 !== support.y2 ? (
                  <p className="field-note">
                    This support was loaded with non-axis-aligned coordinates. Choose an
                    orientation below to snap it back to a valid v1 support.
                  </p>
                ) : null}
                <label className="field">
                  <span>Orientation</span>
                  <select
                    value={getLineOrientation(support)}
                    onChange={(e) =>
                      setModel((curr) => {
                        const supports = [...curr.supports];
                        const line = supports[supportIndex];
                        if (line.kind === "line") {
                          supports[supportIndex] = snapLineSupportToOrientation(
                            line,
                            e.target.value as LineOrientation,
                            curr.geometry,
                          );
                        }
                        return { ...curr, supports };
                      })
                    }
                  >
                    <option value="vertical">Vertical</option>
                    <option value="horizontal">Horizontal</option>
                  </select>
                </label>
                {getLineOrientation(support) === "vertical" ? (
                  <div className="grid-2">
                    <label className="field">
                      <span>X</span>
                      <input
                        type="number"
                        value={support.x1}
                        onChange={(e) =>
                          setModel((curr) => {
                            const supports = [...curr.supports];
                            const line = supports[supportIndex];
                            if (line.kind === "line") {
                              const x = parseNumericInput(e.target.value, line.x1);
                              supports[supportIndex] = {
                                ...line,
                                x1: x,
                                x2: x,
                              };
                            }
                            return { ...curr, supports };
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Y Start</span>
                      <input
                        type="number"
                        value={support.y1}
                        onChange={(e) =>
                          setModel((curr) => {
                            const supports = [...curr.supports];
                            const line = supports[supportIndex];
                            if (line.kind === "line") {
                              supports[supportIndex] = {
                                ...line,
                                x2: line.x1,
                                y1: parseNumericInput(e.target.value, line.y1),
                              };
                            }
                            return { ...curr, supports };
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Y End</span>
                      <input
                        type="number"
                        value={support.y2}
                        onChange={(e) =>
                          setModel((curr) => {
                            const supports = [...curr.supports];
                            const line = supports[supportIndex];
                            if (line.kind === "line") {
                              supports[supportIndex] = {
                                ...line,
                                x2: line.x1,
                                y2: parseNumericInput(e.target.value, line.y2),
                              };
                            }
                            return { ...curr, supports };
                          })
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <div className="grid-2">
                    <label className="field">
                      <span>Y</span>
                      <input
                        type="number"
                        value={support.y1}
                        onChange={(e) =>
                          setModel((curr) => {
                            const supports = [...curr.supports];
                            const line = supports[supportIndex];
                            if (line.kind === "line") {
                              const y = parseNumericInput(e.target.value, line.y1);
                              supports[supportIndex] = {
                                ...line,
                                y1: y,
                                y2: y,
                              };
                            }
                            return { ...curr, supports };
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>X Start</span>
                      <input
                        type="number"
                        value={support.x1}
                        onChange={(e) =>
                          setModel((curr) => {
                            const supports = [...curr.supports];
                            const line = supports[supportIndex];
                            if (line.kind === "line") {
                              supports[supportIndex] = {
                                ...line,
                                y2: line.y1,
                                x1: parseNumericInput(e.target.value, line.x1),
                              };
                            }
                            return { ...curr, supports };
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>X End</span>
                      <input
                        type="number"
                        value={support.x2}
                        onChange={(e) =>
                          setModel((curr) => {
                            const supports = [...curr.supports];
                            const line = supports[supportIndex];
                            if (line.kind === "line") {
                              supports[supportIndex] = {
                                ...line,
                                y2: line.y1,
                                x2: parseNumericInput(e.target.value, line.x2),
                              };
                            }
                            return { ...curr, supports };
                          })
                        }
                      />
                    </label>
                  </div>
                )}
              </>
            ) : (
              <div className="grid-2">
                <label className="field">
                  <span>x</span>
                  <input
                    type="number"
                    value={support.x}
                    onChange={(e) =>
                      setModel((curr) => {
                        const supports = [...curr.supports];
                        const point = supports[supportIndex];
                        if (point.kind === "point") {
                          supports[supportIndex] = {
                            ...point,
                            x: parseNumericInput(e.target.value, point.x),
                          };
                        }
                        return { ...curr, supports };
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>y</span>
                  <input
                    type="number"
                    value={support.y}
                    onChange={(e) =>
                      setModel((curr) => {
                        const supports = [...curr.supports];
                        const point = supports[supportIndex];
                        if (point.kind === "point") {
                          supports[supportIndex] = {
                            ...point,
                            y: parseNumericInput(e.target.value, point.y),
                          };
                        }
                        return { ...curr, supports };
                      })
                    }
                  />
                </label>
              </div>
            )}

            <div className="constraints">
              {dofs.map((dof) => (
                <div key={`${support.id}-${dof}`} className="constraint-row">
                  <label>
                    <span>{dof.toUpperCase()}</span>
                    <select
                      value={support.constraints[dof].type}
                      onChange={(e) =>
                        updateSupportConstraint(
                          supportIndex,
                          dof,
                          e.target.value as ConstraintType,
                        )
                      }
                    >
                      {constraintOptionsByDof[dof].map((constraintType) => (
                        <option key={`${support.id}-${dof}-${constraintType}`} value={constraintType}>
                          {constraintType.charAt(0).toUpperCase()}
                          {constraintType.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {support.constraints[dof].type === "spring" ? (
                    <div className="spring-input">
                      <input
                        type="number"
                        value={support.constraints[dof].stiffness ?? 10000}
                        onChange={(e) =>
                          setModel((curr) => {
                            const supports = [...curr.supports];
                            const target = { ...supports[supportIndex] };
                            target.constraints = { ...target.constraints };
                            target.constraints[dof] = {
                              ...target.constraints[dof],
                              stiffness: parseNumericInput(
                                e.target.value,
                                target.constraints[dof].stiffness ?? 10000,
                              ),
                            };
                            supports[supportIndex] = target;
                            return { ...curr, supports };
                          })
                        }
                      />
                      <small>{springUnitsByDof[dof]}</small>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        ))}
        <button
          className="button"
          onClick={() =>
            setModel((curr) => ({
              ...curr,
              supports: [...curr.supports, newSupport(curr.supports.length)],
            }))
          }
        >
          Add Support
        </button>
      </SectionCard>

      <SectionCard title="Vehicle Definition" subtitle="Axle builder is the primary workflow">
        <label className="field">
          <span>Vehicle Name</span>
          <input
            value={model.vehicle.name}
            onChange={(e) =>
              setModel((curr) => ({
                ...curr,
                vehicle: { ...curr.vehicle, name: e.target.value },
              }))
            }
          />
        </label>

        <label className="field">
          <span>Input Mode</span>
          <select
            value={model.vehicle.mode}
            onChange={(e) =>
              setModel((curr) => ({
                ...curr,
                vehicle: { ...curr.vehicle, mode: e.target.value as "axle" | "direct" },
              }))
            }
          >
            <option value="axle">Axle-based</option>
            <option value="direct">Direct wheels</option>
          </select>
        </label>

        <label className="field">
          <span>Transverse wheel spacing (m)</span>
          <input
            type="number"
            value={model.vehicle.transverseSpacingM}
            onChange={(e) =>
              setModel((curr) => ({
                ...curr,
                vehicle: {
                  ...curr.vehicle,
                  transverseSpacingM: parseNumericInput(
                    e.target.value,
                    curr.vehicle.transverseSpacingM,
                  ),
                },
              }))
            }
          />
        </label>

        <div className="grid-2">
          <label className="field">
            <span>Wheels / axle</span>
            <input
              type="number"
              min={1}
              step={1}
              value={model.vehicle.wheelsPerAxle}
              onChange={(e) =>
                setModel((curr) => ({
                  ...curr,
                  vehicle: {
                    ...curr.vehicle,
                    wheelsPerAxle: Math.max(
                      1,
                      Math.round(
                        parseNumericInput(e.target.value, curr.vehicle.wheelsPerAxle),
                      ),
                    ),
                  },
                }))
              }
            />
          </label>
          <label className="field">
            <span>Patch L x T (m)</span>
            <div className="compound-input">
              <input
                type="number"
                value={model.vehicle.wheelPatchLongM}
                onChange={(e) =>
                  setModel((curr) => ({
                    ...curr,
                    vehicle: {
                      ...curr.vehicle,
                      wheelPatchLongM: parseNumericInput(
                        e.target.value,
                        curr.vehicle.wheelPatchLongM,
                      ),
                    },
                  }))
                }
              />
              <input
                type="number"
                value={model.vehicle.wheelPatchTransM}
                onChange={(e) =>
                  setModel((curr) => ({
                    ...curr,
                    vehicle: {
                      ...curr.vehicle,
                      wheelPatchTransM: parseNumericInput(
                        e.target.value,
                        curr.vehicle.wheelPatchTransM,
                      ),
                    },
                  }))
                }
              />
            </div>
          </label>
        </div>

        <div className="sub-card sub-card-emphasis">
          <div className="sub-card-head">
            <strong>Live Position Control</strong>
          </div>
          {model.vehicle.mode === "axle" ? (
            <>
              <p className="field-note">
                This range follows the full vehicle envelope, so the whole vehicle can move fully on and off the slab.
              </p>
              <label className="field">
                <span>Travel direction</span>
                <select
                  value={model.placement.travelDirection}
                  onChange={(e) =>
                    setModel((curr) => ({
                      ...curr,
                      placement: {
                        ...curr.placement,
                        travelDirection: e.target.value as SlabModel["placement"]["travelDirection"],
                      },
                    }))
                  }
                >
                  <option value="x+">+X</option>
                  <option value="x-">-X</option>
                  <option value="y+">+Y</option>
                  <option value="y-">-Y</option>
                </select>
              </label>
              {sliderConfig ? (
                <label className="field field-slider">
                  <span>{sliderConfig.label}</span>
                  <input
                    type="range"
                    min={sliderConfig.min}
                    max={sliderConfig.max}
                    step={sliderConfig.step}
                    value={sliderConfig.value}
                    onChange={(e) =>
                      setModel((curr) => ({
                        ...curr,
                        placement: {
                          ...curr.placement,
                          [sliderConfig.field]: parseNumericInput(
                            e.target.value,
                            curr.placement[sliderConfig.field],
                          ),
                        },
                      }))
                    }
                  />
                  <small className="field-note">
                    Vehicle reference centre on travel axis: {sliderConfig.value.toFixed(2)} m
                  </small>
                </label>
              ) : null}
            </>
          ) : (
            <>
              <p className="field-note">
                Travel direction controls wheel patch orientation in direct-wheel mode.
              </p>
              <label className="field">
                <span>Travel direction (patch orientation)</span>
                <select
                  value={model.placement.travelDirection}
                  onChange={(e) =>
                    setModel((curr) => ({
                      ...curr,
                      placement: {
                        ...curr.placement,
                        travelDirection: e.target.value as SlabModel["placement"]["travelDirection"],
                      },
                    }))
                  }
                >
                  <option value="x+">+X</option>
                  <option value="x-">-X</option>
                  <option value="y+">+Y</option>
                  <option value="y-">-Y</option>
                </select>
              </label>
            </>
          )}
        </div>

        {model.vehicle.mode === "axle" ? (
          <div className="stack">
            {model.vehicle.axleInputs.map((axle, idx) => (
              <article key={axle.id} className="sub-card">
                <div className="sub-card-head">
                  <strong>{axle.id}</strong>
                  <button
                    className="button button-quiet"
                    onClick={() =>
                      setModel((curr) => ({
                        ...curr,
                        vehicle: {
                          ...curr.vehicle,
                          axleInputs: curr.vehicle.axleInputs.filter((_, i) => i !== idx),
                        },
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
                <label className="field">
                  <span>Axle load (kN)</span>
                  <input
                    type="number"
                    value={axle.axleLoadKn}
                    onChange={(e) =>
                      setModel((curr) => {
                        const axleInputs = [...curr.vehicle.axleInputs];
                        axleInputs[idx] = {
                          ...axleInputs[idx],
                          axleLoadKn: parseNumericInput(e.target.value, axle.axleLoadKn),
                        };
                        return {
                          ...curr,
                          vehicle: { ...curr.vehicle, axleInputs },
                        };
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>Spacing from previous (m)</span>
                  <input
                    type="number"
                    value={axle.spacingFromPreviousM}
                    onChange={(e) =>
                      setModel((curr) => {
                        const axleInputs = [...curr.vehicle.axleInputs];
                        axleInputs[idx] = {
                          ...axleInputs[idx],
                          spacingFromPreviousM: parseNumericInput(
                            e.target.value,
                            axle.spacingFromPreviousM,
                          ),
                        };
                        return {
                          ...curr,
                          vehicle: { ...curr.vehicle, axleInputs },
                        };
                      })
                    }
                  />
                </label>
              </article>
            ))}
            <button
              className="button"
              onClick={() =>
                setModel((curr) => ({
                  ...curr,
                  vehicle: {
                    ...curr.vehicle,
                    axleInputs: [...curr.vehicle.axleInputs, newAxle(curr.vehicle.axleInputs.length)],
                  },
                }))
              }
            >
              Add Axle
            </button>
          </div>
        ) : (
          <div className="stack">
            <p className="field-note">
              Direct-wheel mode uses absolute slab coordinates. Placement center and transverse
              offset are not applied to these wheel coordinates.
            </p>
            {model.vehicle.directWheels.map((wheel, idx) => (
              <article key={wheel.id} className="sub-card">
                <div className="sub-card-head">
                  <strong>{wheel.id}</strong>
                  <button
                    className="button button-quiet"
                    onClick={() =>
                      setModel((curr) => ({
                        ...curr,
                        vehicle: {
                          ...curr.vehicle,
                          directWheels: curr.vehicle.directWheels.filter((_, i) => i !== idx),
                        },
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
                <div className="grid-2">
                  <label className="field">
                    <span>X (global slab m)</span>
                    <input
                      type="number"
                      value={wheel.xM}
                      onChange={(e) =>
                        setModel((curr) => {
                          const directWheels = [...curr.vehicle.directWheels];
                          directWheels[idx] = {
                            ...directWheels[idx],
                            xM: parseNumericInput(e.target.value, wheel.xM),
                          };
                          return { ...curr, vehicle: { ...curr.vehicle, directWheels } };
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Y (global slab m)</span>
                    <input
                      type="number"
                      value={wheel.yM}
                      onChange={(e) =>
                        setModel((curr) => {
                          const directWheels = [...curr.vehicle.directWheels];
                          directWheels[idx] = {
                            ...directWheels[idx],
                            yM: parseNumericInput(e.target.value, wheel.yM),
                          };
                          return { ...curr, vehicle: { ...curr.vehicle, directWheels } };
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Load (kN)</span>
                    <input
                      type="number"
                      value={wheel.loadKn}
                      onChange={(e) =>
                        setModel((curr) => {
                          const directWheels = [...curr.vehicle.directWheels];
                          directWheels[idx] = {
                            ...directWheels[idx],
                            loadKn: parseNumericInput(e.target.value, wheel.loadKn),
                          };
                          return { ...curr, vehicle: { ...curr.vehicle, directWheels } };
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Patch L x T (m)</span>
                    <div className="compound-input">
                      <input
                        type="number"
                        value={wheel.patchLongM}
                        onChange={(e) =>
                          setModel((curr) => {
                            const directWheels = [...curr.vehicle.directWheels];
                            directWheels[idx] = {
                              ...directWheels[idx],
                              patchLongM: parseNumericInput(e.target.value, wheel.patchLongM),
                            };
                            return { ...curr, vehicle: { ...curr.vehicle, directWheels } };
                          })
                        }
                      />
                      <input
                        type="number"
                        value={wheel.patchTransM}
                        onChange={(e) =>
                          setModel((curr) => {
                            const directWheels = [...curr.vehicle.directWheels];
                            directWheels[idx] = {
                              ...directWheels[idx],
                              patchTransM: parseNumericInput(e.target.value, wheel.patchTransM),
                            };
                            return { ...curr, vehicle: { ...curr.vehicle, directWheels } };
                          })
                        }
                      />
                    </div>
                  </label>
                </div>
              </article>
            ))}
            <button
              className="button"
              onClick={() =>
                setModel((curr) => ({
                  ...curr,
                  vehicle: {
                    ...curr.vehicle,
                    directWheels: [...curr.vehicle.directWheels, newWheel(curr.vehicle.directWheels.length)],
                  },
                }))
              }
            >
              Add Wheel
            </button>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Placement Details">
        {model.vehicle.mode === "axle" ? (
          <>
            <p className="field-note">
              Vehicle center X/Y is the midpoint between the first and last axle centres in the
              axle-builder solver.
            </p>
            <p className="field-note muted">
              Fixed-position analysis is the active v1 workflow. Arbitrary heading and moved-run
              path controls remain deferred until after fixed-position verification is complete.
            </p>
            <div className="grid-2">
              <label className="field">
                <span>Vehicle Center X (m)</span>
                <input
                  type="number"
                  value={model.placement.centerXM}
                  onChange={(e) =>
                    setModel((curr) => ({
                      ...curr,
                      placement: {
                        ...curr.placement,
                        centerXM: parseNumericInput(e.target.value, curr.placement.centerXM),
                      },
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Vehicle Center Y (m)</span>
                <input
                  type="number"
                  value={model.placement.centerYM}
                  onChange={(e) =>
                    setModel((curr) => ({
                      ...curr,
                      placement: {
                        ...curr.placement,
                        centerYM: parseNumericInput(e.target.value, curr.placement.centerYM),
                      },
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Transverse offset (m)</span>
                <input
                  type="number"
                  value={model.placement.transverseOffsetM}
                  onChange={(e) =>
                    setModel((curr) => ({
                      ...curr,
                      placement: {
                        ...curr.placement,
                        transverseOffsetM: parseNumericInput(
                          e.target.value,
                          curr.placement.transverseOffsetM,
                        ),
                      },
                    }))
                  }
                />
              </label>
            </div>
            <h4 className="field-subhead">Path sweep (used by Run Envelope)</h4>
            <div className="grid-2">
              <label className="field">
                <span>Path start (m)</span>
                <input
                  type="number"
                  value={model.placement.pathStartM}
                  onChange={(e) =>
                    setModel((curr) => ({
                      ...curr,
                      placement: {
                        ...curr.placement,
                        pathStartM: parseNumericInput(e.target.value, curr.placement.pathStartM),
                      },
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Path end (m)</span>
                <input
                  type="number"
                  value={model.placement.pathEndM}
                  onChange={(e) =>
                    setModel((curr) => ({
                      ...curr,
                      placement: {
                        ...curr.placement,
                        pathEndM: parseNumericInput(e.target.value, curr.placement.pathEndM),
                      },
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Path step (m)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.05"
                  value={model.placement.pathStepM}
                  onChange={(e) =>
                    setModel((curr) => ({
                      ...curr,
                      placement: {
                        ...curr.placement,
                        pathStepM: Math.max(
                          0.05,
                          parseNumericInput(e.target.value, curr.placement.pathStepM),
                        ),
                      },
                    }))
                  }
                />
              </label>
            </div>
            <p className="field-note">
              Envelope sweeps the vehicle reference centre from start to end in the travel
              direction; {envelopeStationCount} station{envelopeStationCount === 1 ? "" : "s"} at the
              current step.
            </p>
          </>
        ) : (
          <>
            <p className="field-note">
              Direct-wheel coordinates remain in global slab coordinates.
            </p>
          </>
        )}
      </SectionCard>

      <SectionCard
        title="Longitudinal Section"
        subtitle="1 m strip averaged for the section moment plot"
      >
        {(() => {
          const isXAxis =
            model.section.axis === "x" ||
            (model.section.axis === "auto" &&
              (model.placement.travelDirection === "x+" ||
                model.placement.travelDirection === "x-"));
          const perpExtent = isXAxis ? model.geometry.widthM : model.geometry.lengthM;
          const perpLabel = isXAxis ? "Y" : "X";
          const sectionAxisLabel = isXAxis ? "along X" : "along Y";
          return (
            <>
              <p className="field-note">
                Section axis: {sectionAxisLabel} (follows travel direction). Centre slides on the{" "}
                {perpLabel}-axis.
              </p>
              <label className="field field-slider">
                <span>
                  Centre {perpLabel} (m): {model.section.centerPerpM.toFixed(2)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={perpExtent}
                  step={0.05}
                  value={Math.min(perpExtent, Math.max(0, model.section.centerPerpM))}
                  onChange={(e) =>
                    setModel((curr) => ({
                      ...curr,
                      section: {
                        ...curr.section,
                        centerPerpM: parseNumericInput(e.target.value, curr.section.centerPerpM),
                      },
                    }))
                  }
                />
              </label>
              <label className="field field-slider">
                <span>Strip width (m): {model.section.widthM.toFixed(2)}</span>
                <input
                  type="range"
                  min={0.2}
                  max={Math.max(0.4, perpExtent)}
                  step={0.1}
                  value={Math.min(perpExtent, Math.max(0.2, model.section.widthM))}
                  onChange={(e) =>
                    setModel((curr) => ({
                      ...curr,
                      section: {
                        ...curr.section,
                        widthM: parseNumericInput(e.target.value, curr.section.widthM),
                      },
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Axis override</span>
                <select
                  value={model.section.axis}
                  onChange={(e) =>
                    setModel((curr) => ({
                      ...curr,
                      section: {
                        ...curr.section,
                        axis: e.target.value as SlabModel["section"]["axis"],
                      },
                    }))
                  }
                >
                  <option value="auto">Auto (follow travel)</option>
                  <option value="x">Along X</option>
                  <option value="y">Along Y</option>
                </select>
              </label>
            </>
          );
        })()}
      </SectionCard>

      <SectionCard title="Display Toggles" defaultCollapsed>
        <label className="check">
          <input
            type="checkbox"
            checked={model.display.mesh}
            onChange={(e) =>
              setModel((curr) => ({ ...curr, display: { ...curr.display, mesh: e.target.checked } }))
            }
          />
          Mesh
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={model.display.supports}
            onChange={(e) =>
              setModel((curr) => ({
                ...curr,
                display: { ...curr.display, supports: e.target.checked },
              }))
            }
          />
          Supports
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={model.display.wheelPatches}
            onChange={(e) =>
              setModel((curr) => ({
                ...curr,
                display: { ...curr.display, wheelPatches: e.target.checked },
              }))
            }
          />
          Wheel patches
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={model.display.contours}
            onChange={(e) =>
              setModel((curr) => ({
                ...curr,
                display: { ...curr.display, contours: e.target.checked },
              }))
            }
          />
          Contours
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={model.display.tables}
            onChange={(e) =>
              setModel((curr) => ({
                ...curr,
                display: { ...curr.display, tables: e.target.checked },
              }))
            }
          />
          Tables
        </label>
      </SectionCard>

      <SectionCard title="Result Control">
        <label className="field">
          <span>Plot Mode</span>
          <select
            value={model.display.plotMode}
            onChange={(e) =>
              setModel((curr) => ({
                ...curr,
                display: { ...curr.display, plotMode: e.target.value as PlotMode },
              }))
            }
          >
            {PLOT_MODE_OPTIONS.map(({ value, controlLabel }) => (
              <option key={value} value={value}>
                {controlLabel}
              </option>
            ))}
          </select>
        </label>
        <p className="field-note">
          Structure view suppresses contour filling; mesh now acts as an overlay toggle in every view.
        </p>
        <label className="field">
          <span>Primary Result</span>
          <select
            value={selectedResultField}
            onChange={(e) => onResultFieldChange(e.target.value as ResultField)}
          >
            {resultFields.map((field) => (
              <option key={field} value={field}>
                {field.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      </SectionCard>
    </aside>
  );
};
