import type {
  AxleInput,
  ConstraintType,
  Dof,
  DirectWheelInput,
  ResultField,
  SlabModel,
  Support,
} from "../app/types";
import { SectionCard } from "./SectionCard";

interface ControlPanelProps {
  model: SlabModel;
  selectedResultField: ResultField;
  running: boolean;
  onModelChange: (next: SlabModel) => void;
  onResultFieldChange: (field: ResultField) => void;
  onRunAnalysis: () => void;
  onSaveJson: () => void;
  onLoadJsonClick: () => void;
  onExportPdf: () => void;
}

const dofs: Dof[] = ["uz", "rx", "ry"];
const resultFields: ResultField[] = [
  "deflection",
  "mx",
  "my",
  "qx",
  "qy",
  "reactions",
];

const parseNumericInput = (value: string, fallback: number): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
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
    rx: { type: "pinned" },
    ry: { type: "pinned" },
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
  selectedResultField,
  running,
  onModelChange,
  onResultFieldChange,
  onRunAnalysis,
  onSaveJson,
  onLoadJsonClick,
  onExportPdf,
}: ControlPanelProps) => {
  const setModel = (updater: (curr: SlabModel) => SlabModel) => {
    onModelChange(updater(model));
  };

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

      <SectionCard title="Run">
        <div className="inline-actions">
          <button className="button button-primary" onClick={onRunAnalysis} disabled={running}>
            {running ? "Running..." : "Run Fixed Analysis"}
          </button>
          <button className="button" onClick={onExportPdf}>
            Export PDF (Print)
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Project">
        <label className="field">
          <span>Project Name</span>
          <input
            value={model.projectName}
            onChange={(e) =>
              setModel((curr) => ({ ...curr, projectName: e.target.value }))
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

      <SectionCard title="Material">
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

      <SectionCard title="Mesh Density">
        <label className="field">
          <span>Density ({model.mesh.density} elements/side)</span>
          <input
            type="range"
            min={6}
            max={60}
            value={model.mesh.density}
            onChange={(e) =>
              setModel((curr) => ({
                ...curr,
                mesh: { ...curr.mesh, density: parseNumericInput(e.target.value, curr.mesh.density) },
              }))
            }
          />
        </label>
        <label className="field">
          <span>Target element size (m)</span>
          <input
            type="number"
            step="0.1"
            value={model.mesh.autoTargetElementM}
            onChange={(e) =>
              setModel((curr) => ({
                ...curr,
                mesh: {
                  ...curr.mesh,
                  autoTargetElementM: parseNumericInput(
                    e.target.value,
                    curr.mesh.autoTargetElementM,
                  ),
                },
              }))
            }
          />
        </label>
      </SectionCard>

      <SectionCard title="Supports" subtitle="Line and point supports with uz/rx/ry fixity">
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
              <div className="grid-2">
                <label className="field">
                  <span>x1</span>
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
                            x1: parseNumericInput(e.target.value, line.x1),
                          };
                        }
                        return { ...curr, supports };
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>y1</span>
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
                            y1: parseNumericInput(e.target.value, line.y1),
                          };
                        }
                        return { ...curr, supports };
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>x2</span>
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
                            x2: parseNumericInput(e.target.value, line.x2),
                          };
                        }
                        return { ...curr, supports };
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>y2</span>
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
                      <option value="free">Free</option>
                      <option value="fixed">Fixed</option>
                      <option value="pinned">Pinned</option>
                      <option value="spring">Spring</option>
                    </select>
                  </label>
                  {support.constraints[dof].type === "spring" ? (
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
          <span>Wheel Track (m)</span>
          <input
            type="number"
            value={model.vehicle.trackM}
            onChange={(e) =>
              setModel((curr) => ({
                ...curr,
                vehicle: {
                  ...curr.vehicle,
                  trackM: parseNumericInput(e.target.value, curr.vehicle.trackM),
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
                    <span>x (m)</span>
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
                    <span>y (m)</span>
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

      <SectionCard title="Fixed Placement / Path">
        <div className="grid-2">
          <label className="field">
            <span>Center X (m)</span>
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
            <span>Center Y (m)</span>
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
            <span>Heading (deg)</span>
            <input
              type="number"
              value={model.placement.headingDeg}
              onChange={(e) =>
                setModel((curr) => ({
                  ...curr,
                  placement: {
                    ...curr.placement,
                    headingDeg: parseNumericInput(e.target.value, curr.placement.headingDeg),
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
        <div className="grid-2">
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
          <label className="field">
            <span>Step for moved runs (m)</span>
            <input
              type="number"
              step="0.1"
              value={model.placement.pathStepM}
              onChange={(e) =>
                setModel((curr) => ({
                  ...curr,
                  placement: {
                    ...curr.placement,
                    pathStepM: parseNumericInput(e.target.value, curr.placement.pathStepM),
                  },
                }))
              }
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Display Toggles">
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
