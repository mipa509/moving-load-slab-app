import { useId } from "react";
import type { AnalysisResults, PlotMode, ResultField, SlabModel } from "../app/types";
import { createContourScale } from "../app/contourScale";
import {
  buildLegendTicks,
  deriveViewportLayerVisibility,
  findContourExtrema,
  formatViewportValue,
} from "./viewportHelpers";

interface ViewportProps {
  model: SlabModel;
  results: AnalysisResults;
  selectedField: ResultField;
}

type CellRect = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
};

const resultLabel: Record<ResultField, string> = {
  deflection: "Deflection",
  mx: "Mx",
  my: "My",
  qx: "Qx",
  qy: "Qy",
  reactions: "Reactions",
};

const plotModeLabel: Record<PlotMode, string> = {
  results: "Result View",
  structure: "Structure View",
  mesh: "Mesh View",
};

export const Viewport = ({ model, results, selectedField }: ViewportProps) => {
  const legendGradientId = useId().replace(/:/g, "");
  const plotMode = model.display.plotMode;
  const contour = selectedField === "reactions" ? undefined : results.contours[selectedField];
  const mesh = results.mesh ?? buildFallbackMesh(model);
  const cells = contour ? buildContourCells(mesh.xCoordsM, mesh.yCoordsM, contour.points) : [];
  const contourScale = contour ? createContourScale(contour.min, contour.max) : null;
  const legendStops = contourScale
    ? buildLegendStops(contourScale.domainMin, contourScale.domainMax, contourScale.getColor)
    : [];
  const legendTicks = contourScale
    ? buildLegendTicks(contourScale.domainMin, contourScale.domainMax)
    : [];
  const contourExtrema = contour ? findContourExtrema(contour.points) : null;
  const plotPadding = Math.max(0.5, Math.max(model.geometry.lengthM, model.geometry.widthM) * 0.08);
  const totalReactionText = `${results.reactionTotals.uz.toFixed(3)} kN`;
  const contourSpan = contour ? Math.abs(contour.max - contour.min) : 0;
  const layerVisibility = deriveViewportLayerVisibility(plotMode, model.display, Boolean(contour));
  const { showContours, showMesh, showSupports, showWheelPatches } = layerVisibility;
  const showLegend = showContours && Boolean(contourScale);
  const plotModeNote =
    plotMode !== "results" && selectedField !== "reactions"
      ? `Contours hidden in ${plotModeLabel[plotMode].toLowerCase()}. Switch to Result View for the colour map.`
      : undefined;
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
            )} ${
              contour.units
            }`,
            detail: contourScale?.hasZeroTick
              ? "Colour scale is symmetric about zero for mixed-sign values"
              : "Colour scale follows the active field min/max range",
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
        <div className={`viewport-canvas mode-${plotMode}`}>
          <div className="viewport-frame" aria-hidden="true" />
          <svg
            viewBox={`${-plotPadding} ${-plotPadding} ${model.geometry.lengthM + plotPadding * 2} ${
              model.geometry.widthM + plotPadding * 2
            }`}
            preserveAspectRatio="xMidYMid meet"
            className="slab-viewport"
          >
            <rect
              x={0}
              y={0}
              width={model.geometry.lengthM}
              height={model.geometry.widthM}
              className="slab-domain"
            />

            {showContours && contour
              ? cells.map((cell) => (
                  <rect
                    key={cell.key}
                    x={cell.x}
                    y={cell.y}
                    width={cell.width}
                    height={cell.height}
                    className="contour-cell"
                    fill={contourScale?.getColor(cell.value) ?? "#f7f7f7"}
                  />
                ))
              : null}

            {showContours && contourExtrema ? (
              <g className="extrema-layer" aria-label="Contour extrema markers">
                <circle
                  cx={contourExtrema.max.xM}
                  cy={contourExtrema.max.yM}
                  r={0.13}
                  className="extrema-marker extrema-marker-max"
                />
                <text
                  x={contourExtrema.max.xM + 0.16}
                  y={contourExtrema.max.yM - 0.12}
                  className="extrema-label extrema-label-max"
                  fontSize={0.24}
                >
                  MAX*
                </text>
                {contourExtrema.samePoint ? null : (
                  <>
                    <circle
                      cx={contourExtrema.min.xM}
                      cy={contourExtrema.min.yM}
                      r={0.13}
                      className="extrema-marker extrema-marker-min"
                    />
                    <text
                      x={contourExtrema.min.xM + 0.16}
                      y={contourExtrema.min.yM - 0.12}
                      className="extrema-label extrema-label-min"
                      fontSize={0.24}
                    >
                      MIN*
                    </text>
                  </>
                )}
              </g>
            ) : null}

            {showMesh
              ? mesh.xCoordsM.map((xCoord) => (
                  <line
                    key={`vx-${xCoord}`}
                    x1={xCoord}
                    y1={0}
                    x2={xCoord}
                    y2={model.geometry.widthM}
                    className="mesh-line"
                  />
                ))
              : null}
            {showMesh
              ? mesh.yCoordsM.map((yCoord) => (
                  <line
                    key={`hy-${yCoord}`}
                    x1={0}
                    y1={yCoord}
                    x2={model.geometry.lengthM}
                    y2={yCoord}
                    className="mesh-line"
                  />
                ))
              : null}

            {showSupports
              ? model.supports.map((support) =>
                  support.kind === "line" ? (
                    <line
                      key={support.id}
                      x1={support.x1}
                      y1={support.y1}
                      x2={support.x2}
                      y2={support.y2}
                      className="support-line"
                    />
                  ) : (
                    <circle
                      key={support.id}
                      cx={support.x}
                      cy={support.y}
                      r={0.12}
                      className="support-point"
                    />
                  ),
                )
              : null}

            {showWheelPatches
              ? (results.wheelPatches ?? []).map((patch, index) => (
                  <rect
                    key={`wheel-${index}`}
                    x={patch.xMinM}
                    y={patch.yMinM}
                    width={patch.xMaxM - patch.xMinM}
                    height={patch.yMaxM - patch.yMinM}
                    className="wheel-patch"
                  />
                ))
              : null}
          </svg>

          <div className="viewport-axis-badge" aria-label="Axis orientation">
            <span>X+</span>
            <span>Y+</span>
          </div>
          {showLegend && contour && contourScale ? (
            <div className="legend-panel" aria-label={`${resultLabel[selectedField]} legend`}>
              <div className="legend-title">Scale</div>
              <div className="legend-subtitle">{contour.units}</div>
              <div className="legend-scale-wrap">
                <svg
                  viewBox="0 0 112 100"
                  preserveAspectRatio="none"
                  className="legend-scale"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id={legendGradientId} x1="0" y1="1" x2="0" y2="0">
                      {legendStops.map((stop) => (
                        <stop
                          key={stop.key}
                          offset={stop.offset}
                          stopColor={stop.color}
                        />
                      ))}
                    </linearGradient>
                  </defs>
                  <rect
                    x={1}
                    y={1}
                    width={22}
                    height={98}
                    fill={`url(#${legendGradientId})`}
                    stroke="none"
                  />
                  <rect
                    x={1}
                    y={1}
                    width={22}
                    height={98}
                    fill="none"
                    stroke="rgba(23, 33, 43, 0.2)"
                  />
                  {legendTicks.map((tick) => (
                    <g key={tick.key}>
                      <line
                        x1={27}
                        y1={tick.y}
                        x2={42}
                        y2={tick.y}
                        stroke="rgba(23, 33, 43, 0.45)"
                        strokeWidth={1}
                      />
                      <text
                        x={50}
                        y={tick.y + 3.1}
                        fontSize={10.5}
                        fontWeight={700}
                        fill="#17212b"
                      >
                        {tick.label}
                      </text>
                    </g>
                  ))}
                  {contourScale.hasZeroTick && contourScale.zeroOffsetPercent !== null ? (
                    <>
                      <line
                        x1={2}
                        y1={100 - contourScale.zeroOffsetPercent}
                        x2={23}
                        y2={100 - contourScale.zeroOffsetPercent}
                        stroke="rgba(23, 33, 43, 0.7)"
                        strokeDasharray="1.2 1"
                        strokeWidth={0.5}
                      />
                    </>
                  ) : null}
                </svg>
              </div>
              <div className="legend-footnote">
                {contourScale.hasZeroTick ? "Symmetric colour scale" : "Direct field scale"}
              </div>
            </div>
          ) : null}
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
                  Scale:{" "}
                  {contourScale?.hasZeroTick
                    ? `${formatViewportValue(
                        contourScale.domainMin,
                        Math.abs(contourScale.domainMax - contourScale.domainMin),
                      )} to ${formatViewportValue(
                        contourScale.domainMax,
                        Math.abs(contourScale.domainMax - contourScale.domainMin),
                      )} ${contour.units} (symmetric about zero)`
                    : `${formatViewportValue(contour.min, contourSpan)} to ${formatViewportValue(
                        contour.max,
                        contourSpan,
                      )} ${
                        contour.units
                      }`}
                </p>
                {showContours ? (
                  <p className="viewport-overlay-summary viewport-overlay-note">
                    * Extrema markers indicate sampled element-centre values.
                  </p>
                ) : null}
                {plotModeNote ? (
                  <p className="viewport-overlay-summary viewport-overlay-note">{plotModeNote}</p>
                ) : null}
              </>
            ) : (
              <p className="viewport-overlay-summary">No contour values available for this field yet.</p>
            )}
          </div>
        </div>
      </section>

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

function buildFallbackMesh(model: SlabModel): { xCoordsM: number[]; yCoordsM: number[] } {
  const xDivisions = Math.max(2, Math.round(model.mesh.density));
  const yDivisions = Math.max(
    2,
    Math.round((model.geometry.widthM / Math.max(model.geometry.lengthM, 0.1)) * xDivisions),
  );
  return {
    xCoordsM: Array.from(
      { length: xDivisions + 1 },
      (_, index) => (index / xDivisions) * model.geometry.lengthM,
    ),
    yCoordsM: Array.from(
      { length: yDivisions + 1 },
      (_, index) => (index / yDivisions) * model.geometry.widthM,
    ),
  };
}

function buildContourCells(
  xCoords: number[],
  yCoords: number[],
  points: { xM: number; yM: number; value: number }[],
): CellRect[] {
  const cells: CellRect[] = [];
  points.forEach((point, index) => {
    const i = findSegmentIndex(xCoords, point.xM);
    const j = findSegmentIndex(yCoords, point.yM);
    if (i < 0 || j < 0 || i >= xCoords.length - 1 || j >= yCoords.length - 1) {
      return;
    }
    cells.push({
      key: `cell-${index}`,
      x: xCoords[i],
      y: yCoords[j],
      width: xCoords[i + 1] - xCoords[i],
      height: yCoords[j + 1] - yCoords[j],
      value: point.value,
    });
  });
  return cells;
}

function findSegmentIndex(axis: number[], coordinate: number): number {
  for (let index = 0; index < axis.length - 1; index += 1) {
    if (coordinate >= axis[index] && coordinate <= axis[index + 1]) {
      return index;
    }
  }
  return -1;
}

function buildLegendStops(
  domainMin: number,
  domainMax: number,
  getColor: (value: number) => string,
  stopCount: number = 16,
): { key: string; offset: string; color: string }[] {
  if (stopCount <= 1) {
    return [];
  }

  return Array.from({ length: stopCount }, (_, index) => {
    const fraction = index / (stopCount - 1);
    const sampleValue = domainMin + (domainMax - domainMin) * fraction;

    return {
      key: `legend-stop-${index}`,
      offset: `${fraction * 100}%`,
      color: getColor(sampleValue),
    };
  });
}
