import { useMemo } from "react";
import type { AnalysisResults, PlotMode, ResultField, SlabModel } from "../app/types";
import {
  deriveViewportLayerVisibility,
  findContourExtrema,
  formatViewportValue,
} from "./viewportHelpers";
import { ViewerCanvas } from "../viewer/ViewerCanvas";
import { getViewerContour } from "../viewer/viewerPresentation";
import { SectionPlot } from "./SectionPlot";
import {
  computeEnvelopeSectionCurves,
  computeSectionCurve,
  resolveSectionAxis,
} from "../app/sectionCurve";

interface ViewportProps {
  model: SlabModel;
  results: AnalysisResults;
  selectedField: ResultField;
  onModelChange: (model: SlabModel) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

const resultLabel: Record<ResultField, string> = {
  deflection: "Deflection",
  mx: "Mx",
  my: "My",
  mxy: "Mxy",
  qx: "Qx",
  qy: "Qy",
  reactions: "Reactions",
};

const plotModeLabel: Record<PlotMode, string> = {
  results: "Result View",
  structure: "Structure View",
  deformed: "Deformed View",
};

export const Viewport = ({ model, results, selectedField, onModelChange, onCanvasReady }: ViewportProps) => {
  const plotMode = model.display.plotMode;
  const contour = getViewerContour(results, selectedField);
  const totalReactionText = `${results.reactionTotals.uz.toFixed(3)} kN`;
  const contourSpan = contour ? Math.abs(contour.max - contour.min) : 0;
  const layerVisibility = deriveViewportLayerVisibility(plotMode, model.display, Boolean(contour));
  const { showContours, showMesh, showSupports, showWheelPatches } = layerVisibility;
  const contourExtrema = contour ? findContourExtrema(contour.points) : null;
  const activeResultSummary =
    selectedField === "reactions"
      ? {
          title: "Active Plot Summary",
          value: totalReactionText,
          detail: `${results.reactionSummaryBySupport.length} support groups in current reaction view`,
        }
      : contour
        ? {
            title: `${resultLabel[selectedField]} Range`,
            value: `${formatViewportValue(contour.min, contourSpan)} to ${formatViewportValue(
              contour.max,
              contourSpan,
            )} ${contour.units}`,
            detail: contourExtrema
              ? "Range and extrema derived from nodal contour values"
              : "Run a valid analysis to populate this plot",
          }
        : {
            title: `${resultLabel[selectedField]} Range`,
            value: "No contour data",
            detail: "Run a valid analysis to populate this plot",
          };

  return (
    <main className="result-area">
      <section className="result-header">
        <div>
          <h2>{model.projectName}</h2>
          <p>
            {model.geometry.lengthM} m x {model.geometry.widthM} m slab | t ={" "}
            {model.geometry.thicknessM} m
          </p>
        </div>
        <div className="status-strip">
          <span className={`pill ${results.status}`}>{results.status.toUpperCase()}</span>
          <span className="pill source">{results.source.toUpperCase()}</span>
          <span className="pill time">{results.elapsedMs.toFixed(0)} ms</span>
        </div>
      </section>

      <section className="viewport-shell">
        <header className="viewport-shell-header">
          <div className="viewport-shell-heading">
            <p className="viewport-shell-kicker">Result Plot</p>
            <h3>{resultLabel[selectedField]}</h3>
          </div>
          <div className="viewport-shell-meta" aria-label="Plot metadata">
            <span>{plotModeLabel[plotMode]}</span>
            <span>
              {model.geometry.lengthM.toFixed(2)} m x {model.geometry.widthM.toFixed(2)} m
            </span>
          </div>
        </header>
        <div className="viewport-canvas mode-webgl" style={{ height: "520px" }}>
          <ViewerCanvas
            model={model}
            results={results}
            selectedField={selectedField}
            onModelChange={onModelChange}
            onCanvasReady={onCanvasReady}
          />
        </div>
        <div className="viewport-shell-footer">
          <div className="viewport-overlay">
            <p className="viewport-overlay-label">Viewport Status</p>
            <h4>{resultLabel[selectedField]} view</h4>
            <div className="viewport-overlay-grid">
              <p>
                <span>Contours</span>
                <strong>{showContours ? "On" : "Off"}</strong>
              </p>
              <p>
                <span>Mesh</span>
                <strong>{showMesh ? "On" : "Off"}</strong>
              </p>
              <p>
                <span>Supports</span>
                <strong>{showSupports ? "On" : "Off"}</strong>
              </p>
              <p>
                <span>Wheels</span>
                <strong>{showWheelPatches ? "On" : "Off"}</strong>
              </p>
            </div>
            {selectedField === "reactions" ? (
              <p className="viewport-overlay-summary">
                Support groups: {results.reactionSummaryBySupport.length} | Total vertical reaction:{" "}
                {totalReactionText}
              </p>
            ) : contour ? (
              <>
                <p className="viewport-overlay-summary">
                  Range: {formatViewportValue(contour.min, contourSpan)} to{" "}
                  {formatViewportValue(contour.max, contourSpan)} {contour.units}
                </p>
                <p className="viewport-overlay-summary viewport-overlay-note">
                  {activeResultSummary.detail}
                </p>
              </>
            ) : (
              <p className="viewport-overlay-summary">No contour values available for this field yet.</p>
            )}
          </div>
        </div>
      </section>

      <SectionPlotPanel model={model} results={results} />

      <section className="summary-grid">
        <article className="summary-card">
          <h4>Max Deflection</h4>
          <strong>{results.summary.maxDeflectionMm.toFixed(3)} mm</strong>
        </article>
        <article className="summary-card">
          <h4>Max |M|</h4>
          <strong>{results.summary.maxAbsMomentKnmPerM.toFixed(3)} kN*m/m</strong>
        </article>
        <article className="summary-card">
          <h4>Max |Q|</h4>
          <strong>{results.summary.maxAbsShearKnPerM.toFixed(3)} kN/m</strong>
        </article>
        <article className="summary-card summary-card-highlight">
          <h4>{activeResultSummary.title}</h4>
          <strong>{activeResultSummary.value}</strong>
          <small>{activeResultSummary.detail}</small>
        </article>
      </section>

      {model.display.tables && selectedField === "reactions" ? (
        <div className="table-stack">
          <section className="table-panel">
            <header>
              <h3>Support Reaction Summary</h3>
              <p>{results.reactionSummaryBySupport.length} supports</p>
            </header>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Support</th>
                    <th>Sum Uz (kN)</th>
                    <th>Sum Rx (kN*m)</th>
                    <th>Sum Ry (kN*m)</th>
                  </tr>
                </thead>
                <tbody>
                  {results.reactionSummaryBySupport.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No reaction values available.</td>
                    </tr>
                  ) : (
                    <>
                      {results.reactionSummaryBySupport.map((row) => (
                        <tr key={row.supportId}>
                          <td>{row.supportId}</td>
                          <td>{row.uz.toFixed(3)}</td>
                          <td>{row.rx.toFixed(3)}</td>
                          <td>{row.ry.toFixed(3)}</td>
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td>Total</td>
                        <td>{results.reactionTotals.uz.toFixed(3)}</td>
                        <td>{results.reactionTotals.rx.toFixed(3)}</td>
                        <td>{results.reactionTotals.ry.toFixed(3)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="table-panel">
            <header>
              <h3>Nodal Reaction Rows</h3>
              <p>{results.reactions.length} rows</p>
            </header>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Support</th>
                    <th>Node</th>
                    <th>DOF</th>
                    <th>Value</th>
                    <th>Units</th>
                  </tr>
                </thead>
                <tbody>
                  {results.reactions.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No reaction values available.</td>
                    </tr>
                  ) : (
                    results.reactions.map((row, idx) => (
                      <tr key={`${row.supportId}-${row.dof}-${idx}`}>
                        <td>{row.supportId}</td>
                        <td>{row.nodeId ?? "-"}</td>
                        <td>{row.dof}</td>
                        <td>{row.value.toFixed(3)}</td>
                        <td>{row.units}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      <p className="sign-note">
        Sign convention: results are displayed using the solver field signs exactly as returned.
      </p>
      {results.warning ? <p className="notice warning">{results.warning}</p> : null}
      {results.error ? <p className="notice error">{results.error}</p> : null}
    </main>
  );
};

interface SectionPlotPanelProps {
  model: SlabModel;
  results: AnalysisResults;
}

const SectionPlotPanel = ({ model, results }: SectionPlotPanelProps) => {
  const axis = resolveSectionAxis(model.placement.travelDirection, model.section.axis);
  const targetField = axis === "x" ? "mx" : "my";
  const contour = results.nodalContours[targetField];
  const envelopeData = results.envelope;
  const envelope = envelopeData ? envelopeData[targetField] : undefined;

  const currentCurve = useMemo(() => {
    if (!contour) return null;
    return computeSectionCurve(
      contour,
      axis,
      model.section.centerPerpM,
      model.section.widthM,
    );
  }, [contour, axis, model.section.centerPerpM, model.section.widthM]);

  const envelopeCurves = useMemo(() => {
    if (!envelope) return null;
    return computeEnvelopeSectionCurves(
      envelope,
      axis,
      model.section.centerPerpM,
      model.section.widthM,
    );
  }, [envelope, axis, model.section.centerPerpM, model.section.widthM]);

  const valueLabel = targetField === "mx" ? "Mxx" : "Myy";
  const axisLabel = axis === "x" ? "Distance along X (m)" : "Distance along Y (m)";
  const perpLabel = axis === "x" ? "Y" : "X";
  const subtitle = `Strip ${model.section.widthM.toFixed(2)} m wide centred at ${perpLabel} = ${model.section.centerPerpM.toFixed(2)} m${
    envelopeData
      ? ` · envelope from ${envelopeData.stationsRun} stations`
      : ""
  }`;

  return (
    <section className="section-plot-panel">
      <header className="section-plot-header">
        <div>
          <p className="viewport-shell-kicker">Longitudinal section</p>
          <h3>{valueLabel} along {axis === "x" ? "X" : "Y"}</h3>
        </div>
        <div className="section-plot-legend">
          <span className="section-plot-legend-current">— current placement</span>
          {envelope ? (
            <>
              <span className="section-plot-legend-max">— — envelope max</span>
              <span className="section-plot-legend-min">— — envelope min</span>
            </>
          ) : null}
        </div>
      </header>
      <SectionPlot
        current={currentCurve}
        envelopeMax={envelopeCurves?.max ?? null}
        envelopeMin={envelopeCurves?.min ?? null}
        axisLabel={axisLabel}
        valueUnits={contour?.units ?? envelope?.units ?? "kN*m/m"}
        valueLabel={valueLabel}
        subtitle={subtitle}
      />
    </section>
  );
};
