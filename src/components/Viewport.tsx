import { useMemo, useState } from "react";
import type {
  AnalysisResults,
  GlobalResultant,
  MeshQualityReport,
  PlotMode,
  ResultField,
  SignedEquilibrium,
  SlabModel,
  VerificationEvidenceStatus,
} from "../app/types";
import {
  deriveViewportLayerVisibility,
  findContourExtrema,
  formatViewportValue,
} from "./viewportHelpers";
import { ViewerCanvas } from "../viewer/ViewerCanvas";
import { getViewerContour } from "../viewer/viewerPresentation";
import { SectionPlot } from "./SectionPlot";
import {
  computeDeckSection,
  computeEnvelopeSectionCurves,
  computeSectionCurve,
  resolveSectionAxis,
} from "../app/sectionCurve";
import {
  deckSectionAxisLabel,
  deckSectionValueLabel,
  toSectionPlotCurve,
} from "../app/deckSectionView";
import { ReactionDistributionPlot } from "./ReactionDistributionPlot";
import { distributionHasSharedCorner, type ReactionSeriesKey } from "../app/reactionPlotData";

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

      {results.warningRequired === true ? (
        <section className="experimental-banner" role="alert">
          <span className="experimental-banner-badge">Experimental</span>
          <div className="experimental-banner-body">
            <strong>Non-zero-skew analysis — experimental, screening-only result.</strong>
            <p>
              This result comes from the skew-general analysis path, which has not yet completed
              independent numerical verification. It has not received G7 checking or CEng
              sign-off and must not be used for design. Treat these values as screening evidence
              only, pending an authorized decision releasing this scope for design use.
            </p>
          </div>
        </section>
      ) : null}

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

      <DeckSectionPanel model={model} results={results} />

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

      <SkewDiagnosticsPanel results={results} />

      {selectedField === "reactions" ? <ReactionDistributionPanel results={results} /> : null}

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

// ---------------------------------------------------------------------------
// WP-041B: deck-local (s/t) section panel — ADDITIVE, alongside (not instead
// of) the legacy global-XY `SectionPlotPanel` above. Renders the deck-local
// section for the CURRENT placement via `computeDeckSection`, mapped onto
// the local `SectionPlot`-compatible shape via `toSectionPlotCurve`.
// ---------------------------------------------------------------------------

interface DeckSectionPanelProps {
  model: SlabModel;
  results: AnalysisResults;
}

const DeckSectionPanel = ({ model, results }: DeckSectionPanelProps) => {
  const settings = model.deckSection;
  const nodalFields = results.nodalFields;

  // Guard: only ever call `computeDeckSection` when both inputs it needs are
  // present. Otherwise fall through to `null`, which `SectionPlot` already
  // renders gracefully as its built-in "No nodes in section band" empty state.
  const deckCurve = useMemo(() => {
    if (!settings || !nodalFields) return null;
    return computeDeckSection(nodalFields, settings);
  }, [settings, nodalFields]);

  const localCurve = useMemo(() => toSectionPlotCurve(deckCurve), [deckCurve]);

  const modeLabel = settings?.mode === "transverse" ? "Transverse" : "Longitudinal";
  const axisLabel = settings ? deckSectionAxisLabel(settings) : "Distance (m)";
  const valueLabel = settings ? deckSectionValueLabel(settings.ordinate) : "Mxx";
  const centerAxisLabel = settings?.mode === "transverse" ? "s" : "t";
  const centerM = settings
    ? settings.mode === "longitudinal"
      ? settings.centerTM
      : settings.centerSM
    : null;
  const subtitle = settings
    ? `Strip ${settings.widthM.toFixed(2)} m wide centred at ${centerAxisLabel} = ${centerM!.toFixed(2)} m`
    : "Deck-local (s/t) section settings are not available for this model.";

  return (
    <section className="section-plot-panel deck-section-panel">
      <header className="section-plot-header">
        <div>
          <p className="viewport-shell-kicker">Deck-local section (s/t)</p>
          <h3>
            {valueLabel} · {modeLabel}
          </h3>
        </div>
        <div className="section-plot-legend">
          <span className="section-plot-legend-current">— current placement</span>
        </div>
      </header>
      <SectionPlot
        current={localCurve}
        axisLabel={axisLabel}
        valueUnits="kN*m/m"
        valueLabel={valueLabel}
        subtitle={subtitle}
      />
    </section>
  );
};

// ---------------------------------------------------------------------------
// WP-041B: skew-evidence diagnostics — ADDITIVE. Presents the signed-
// equilibrium residual, mesh-quality warnings and verification statuses
// carried on `results`. Each sub-panel is independently guarded by the
// presence of its own field, renders a neutral note when the field is
// absent, and never throws (idle/error results carry none of these fields).
// ---------------------------------------------------------------------------

const statusPillTone = (status: string): string => {
  if (status === "passed") return "status-passed";
  if (status === "conditional") return "status-conditional";
  if (status === "failed") return "status-failed";
  // "not-checked" | "not-run" | "not-demonstrated"
  return "status-neutral";
};

interface EquilibriumSummaryProps {
  equilibrium?: SignedEquilibrium;
}

const EquilibriumSummary = ({ equilibrium }: EquilibriumSummaryProps) => {
  if (!equilibrium) {
    return (
      <div className="diagnostics-block">
        <h4>Signed equilibrium residual</h4>
        <p className="field-note">No equilibrium evidence available for this result.</p>
      </div>
    );
  }

  const rows: Array<{ label: string; resultant: GlobalResultant }> = [
    { label: "Applied", resultant: equilibrium.applied },
    { label: "Reactions", resultant: equilibrium.reactions },
    { label: "Residual", resultant: equilibrium.residual },
    { label: "|Residual|", resultant: equilibrium.absoluteResidual },
  ];

  return (
    <div className="diagnostics-block">
      <h4>Signed equilibrium residual</h4>
      <p className="field-note">
        Origin at x = {equilibrium.originM.xM.toFixed(3)} m, y = {equilibrium.originM.yM.toFixed(3)} m
      </p>
      <div className="table-scroll diagnostics-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Resultant</th>
              <th>Fz (kN)</th>
              <th>Mx (kN*m)</th>
              <th>My (kN*m)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.resultant.forceZKn.toFixed(3)}</td>
                <td>{row.resultant.momentXKnm.toFixed(3)}</td>
                <td>{row.resultant.momentYKnm.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="diagnostics-normalized-grid">
        <p>
          <span>Normalized |Fz|</span>
          <strong>{equilibrium.normalizedResidual.forceZ.toExponential(2)}</strong>
        </p>
        <p>
          <span>Normalized |Mx|</span>
          <strong>{equilibrium.normalizedResidual.momentX.toExponential(2)}</strong>
        </p>
        <p>
          <span>Normalized |My|</span>
          <strong>{equilibrium.normalizedResidual.momentY.toExponential(2)}</strong>
        </p>
      </div>
    </div>
  );
};

interface MeshQualitySummaryProps {
  meshQuality?: MeshQualityReport;
}

const MeshQualitySummary = ({ meshQuality }: MeshQualitySummaryProps) => {
  if (!meshQuality) {
    return (
      <div className="diagnostics-block">
        <h4>Mesh-quality warnings</h4>
        <p className="field-note">No mesh-quality evidence available for this result.</p>
      </div>
    );
  }

  return (
    <div className="diagnostics-block">
      <h4>Mesh-quality warnings</h4>
      <p className="diagnostics-status-row">
        <span className={`pill status-pill ${statusPillTone(meshQuality.status === "ok" ? "passed" : "conditional")}`}>
          {meshQuality.status.toUpperCase()}
        </span>
        <span className="field-note">{meshQuality.elements.length} element(s) assessed</span>
      </p>
      {meshQuality.diagnostics.length === 0 ? (
        <p className="field-note">No mesh-quality diagnostics reported.</p>
      ) : (
        <ul className="diagnostics-list">
          {meshQuality.diagnostics.map((diagnostic, index) => (
            <li
              key={`${diagnostic.code}-${index}`}
              className={`diagnostics-list-item severity-${diagnostic.severity}`}
            >
              <span className="diagnostics-list-code">{diagnostic.code}</span>
              <span className="diagnostics-list-message">{diagnostic.message}</span>
              <span className="field-note">{diagnostic.elementIds.length} element(s)</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface VerificationSummaryProps {
  verification?: VerificationEvidenceStatus;
}

const VerificationSummary = ({ verification }: VerificationSummaryProps) => {
  if (!verification) {
    return (
      <div className="diagnostics-block">
        <h4>Verification status</h4>
        <p className="field-note">No verification evidence available for this result.</p>
      </div>
    );
  }

  const rows: Array<{ label: string; status: string }> = [
    { label: "Formulation", status: verification.formulation },
    { label: "Reference study (19 deg)", status: verification.referenceStudy19Deg },
    { label: "Current model convergence", status: verification.currentModelConvergence },
  ];

  return (
    <div className="diagnostics-block">
      <h4>Verification status</h4>
      <ul className="diagnostics-status-list">
        {rows.map((row) => (
          <li key={row.label}>
            <span>{row.label}</span>
            <span className={`pill status-pill ${statusPillTone(row.status)}`}>{row.status}</span>
          </li>
        ))}
      </ul>
      <p className="field-note">
        {verification.evidenceIds.length > 0
          ? `Evidence: ${verification.evidenceIds.join(", ")}`
          : "No evidence references recorded."}
      </p>
    </div>
  );
};

interface SkewDiagnosticsPanelProps {
  results: AnalysisResults;
}

const SkewDiagnosticsPanel = ({ results }: SkewDiagnosticsPanelProps) => {
  const { equilibrium, meshQuality, verification } = results;

  if (!equilibrium && !meshQuality && !verification) {
    return null;
  }

  return (
    <section className="skew-diagnostics-panel">
      <header className="skew-diagnostics-header">
        <p className="viewport-shell-kicker">Skew-evidence diagnostics</p>
        <h3>Equilibrium · Mesh Quality · Verification</h3>
      </header>
      <div className="diagnostics-grid">
        <EquilibriumSummary equilibrium={equilibrium} />
        <MeshQualitySummary meshQuality={meshQuality} />
        <VerificationSummary verification={verification} />
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
// WP-044: per-support reaction DISTRIBUTION plot — ADDITIVE, alongside (not
// instead of) the existing reaction summary/nodal tables further below (those
// are left completely unmodified). Guarded end to end: an absent or empty
// `results.reactionDistributions` (any non-success result, or a model with no
// edge/line supports) renders a neutral note instead of the plot, and never
// throws. `results.reactionDistributions` predates this packet (WP-034); this
// panel only ever reads it, never re-derives or re-weights its totals.
// ---------------------------------------------------------------------------

interface ReactionDistributionPanelProps {
  results: AnalysisResults;
}

const ReactionDistributionPanel = ({ results }: ReactionDistributionPanelProps) => {
  const distributions = results.reactionDistributions;
  const [selectedSupportId, setSelectedSupportId] = useState<string | null>(null);
  const [seriesKey, setSeriesKey] = useState<ReactionSeriesKey>("forceZKn");

  const hasDistributions = Boolean(distributions && distributions.length > 0);

  // Default to the first support whenever nothing (or a now-stale support id
  // from a previous analysis) is selected, without needing an effect.
  const resolvedSupportId = useMemo(() => {
    if (!distributions || distributions.length === 0) return null;
    if (selectedSupportId && distributions.some((d) => d.supportId === selectedSupportId)) {
      return selectedSupportId;
    }
    return distributions[0].supportId;
  }, [distributions, selectedSupportId]);

  const selectedDistribution = useMemo(() => {
    if (!distributions || !resolvedSupportId) return null;
    return distributions.find((d) => d.supportId === resolvedSupportId) ?? null;
  }, [distributions, resolvedSupportId]);

  const hasSharedCorner = distributionHasSharedCorner(selectedDistribution);

  if (!hasDistributions) {
    return (
      <section className="section-plot-panel reaction-distribution-panel">
        <header className="section-plot-header">
          <div>
            <p className="viewport-shell-kicker">Support reaction distribution</p>
            <h3>Reaction vs. distance along support</h3>
          </div>
        </header>
        <p className="field-note">
          No per-support reaction distribution is available for this result. Run a successful
          analysis with at least one edge or line support to populate this plot.
        </p>
      </section>
    );
  }

  return (
    <section className="section-plot-panel reaction-distribution-panel">
      <header className="section-plot-header">
        <div>
          <p className="viewport-shell-kicker">Support reaction distribution</p>
          <h3>Reaction vs. distance along support</h3>
        </div>
        <label className="field reaction-distribution-support-select">
          <span>Support</span>
          <select
            value={resolvedSupportId ?? ""}
            onChange={(event) => setSelectedSupportId(event.target.value)}
          >
            {distributions!.map((dist) => (
              <option key={dist.supportId} value={dist.supportId}>
                {dist.supportId} ({dist.supportKind})
              </option>
            ))}
          </select>
        </label>
      </header>

      <ReactionDistributionPlot
        distribution={selectedDistribution}
        seriesKey={seriesKey}
        onSeriesKeyChange={setSeriesKey}
      />

      {selectedDistribution ? (
        <p className="reaction-distribution-panel-totals field-note">
          Integrated totals for <strong>{selectedDistribution.supportId}</strong>: Fz ={" "}
          {selectedDistribution.totals.forceZKn.toFixed(3)} kN, Cx ={" "}
          {selectedDistribution.totals.coupleXKnm.toFixed(3)} kN*m, Cy ={" "}
          {selectedDistribution.totals.coupleYKnm.toFixed(3)} kN*m
        </p>
      ) : null}

      <p
        className={`notice warning${
          hasSharedCorner ? " reaction-distribution-mesh-warning-emphasis" : ""
        }`}
      >
        Reaction values at or near acute skew corners are mesh-sensitive and screening-only;
        do not rely on individual point values there for design.
        {hasSharedCorner
          ? " The selected support currently includes shared/mixed fixed-corner samples — treat these with extra caution."
          : ""}
      </p>

      <p className="field-note">
        Values plotted and totalled here are <strong>nodal-integrated reactions</strong> (kN,
        kN*m) at each mesh node, not tributary per-metre densities — densities are not computed
        or shown in this view.
      </p>
    </section>
  );
};
