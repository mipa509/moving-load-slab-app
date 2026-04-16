import { useId } from "react";
import type { AnalysisResults, ResultField, SlabModel } from "../app/types";
import { createContourScale } from "../app/contourScale";

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

export const Viewport = ({ model, results, selectedField }: ViewportProps) => {
  const legendGradientId = useId().replace(/:/g, "");
  const contour = selectedField === "reactions" ? undefined : results.contours[selectedField];
  const mesh = results.mesh ?? buildFallbackMesh(model);
  const cells = contour ? buildContourCells(mesh.xCoordsM, mesh.yCoordsM, contour.points) : [];
  const contourScale = contour ? createContourScale(contour.min, contour.max) : null;
  const legendStops = contourScale
    ? buildLegendStops(contourScale.domainMin, contourScale.domainMax, contourScale.getColor)
    : [];
  const plotPadding = Math.max(0.5, Math.max(model.geometry.lengthM, model.geometry.widthM) * 0.08);
  const totalReactionText = `${results.reactionTotals.uz.toFixed(3)} kN`;

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
            <span>Plan View</span>
            <span>
              {model.geometry.lengthM.toFixed(2)} m x {model.geometry.widthM.toFixed(2)} m
            </span>
          </div>
        </header>
        <div className="viewport-canvas">
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

            {model.display.contours && contour
              ? cells.map((cell) => (
                  <rect
                    key={cell.key}
                    x={cell.x}
                    y={cell.y}
                    width={cell.width}
                    height={cell.height}
                    fill={contourScale?.getColor(cell.value) ?? "#f7f7f7"}
                    opacity={0.92}
                  />
                ))
              : null}

            {model.display.mesh
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
            {model.display.mesh
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

            {model.display.supports
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

            {model.display.wheelPatches
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

          <div className="viewport-overlay">
            <p className="viewport-overlay-label">Viewport Status</p>
            <h4>{resultLabel[selectedField]} view</h4>
            <div className="viewport-overlay-grid">
              <p>
                <span>Contours</span>
                <strong>{model.display.contours ? "On" : "Off"}</strong>
              </p>
              <p>
                <span>Mesh</span>
                <strong>{model.display.mesh ? "On" : "Off"}</strong>
              </p>
              <p>
                <span>Supports</span>
                <strong>{model.display.supports ? "On" : "Off"}</strong>
              </p>
              <p>
                <span>Wheels</span>
                <strong>{model.display.wheelPatches ? "On" : "Off"}</strong>
              </p>
            </div>
            {selectedField === "reactions" ? (
              <p className="viewport-overlay-summary">
                Support groups: {results.reactionSummaryBySupport.length} | Total vertical reaction:{" "}
                {totalReactionText}
              </p>
            ) : contour ? (
              <p className="viewport-overlay-summary">
                Range: {contour.min.toFixed(3)} to {contour.max.toFixed(3)} {contour.units}
              </p>
            ) : (
              <p className="viewport-overlay-summary">No contour values available for this field yet.</p>
            )}
          </div>
          {contour && contourScale ? (
            <div className="legend-panel" aria-label={`${resultLabel[selectedField]} legend`}>
              <div className="legend-label legend-label-top">
                {contour.max.toFixed(3)} {contour.units}
              </div>
              <div className="legend-scale-wrap">
                <svg
                  viewBox="0 0 20 100"
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
                    width={18}
                    height={98}
                    fill={`url(#${legendGradientId})`}
                    stroke="none"
                  />
                  <rect
                    x={1}
                    y={1}
                    width={18}
                    height={98}
                    fill="none"
                    stroke="rgba(18, 32, 25, 0.16)"
                  />
                  {contourScale.hasZeroTick && contourScale.zeroOffsetPercent !== null ? (
                    <>
                      <line
                        x1={2}
                        y1={100 - contourScale.zeroOffsetPercent}
                        x2={18}
                        y2={100 - contourScale.zeroOffsetPercent}
                        stroke="rgba(18, 32, 25, 0.65)"
                        strokeDasharray="1.2 1"
                        strokeWidth={0.5}
                      />
                      <text
                        x={10}
                        y={100 - contourScale.zeroOffsetPercent - 1.5}
                        textAnchor="middle"
                        fontSize={5}
                        fill="#122019"
                      >
                        0
                      </text>
                    </>
                  ) : null}
                </svg>
              </div>
              <div className="legend-label legend-label-bottom">
                {contour.min.toFixed(3)} {contour.units}
              </div>
            </div>
          ) : null}
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
