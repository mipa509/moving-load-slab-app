import type { AnalysisResults, RectOverlay, ResultField, SlabModel } from "../app/types";

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
  const contour = selectedField === "reactions" ? undefined : results.contours[selectedField];
  const mesh = results.mesh ?? buildFallbackMesh(model);
  const cells = contour ? buildContourCells(mesh.xCoordsM, mesh.yCoordsM, contour.points) : [];

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
        <div className="viewport-canvas">
          <svg
            viewBox={`0 0 ${model.geometry.lengthM} ${model.geometry.widthM}`}
            preserveAspectRatio="xMidYMid meet"
            className="slab-viewport"
          >
            <rect
              x={0}
              y={0}
              width={model.geometry.lengthM}
              height={model.geometry.widthM}
              fill="#f8fbf9"
              stroke="#163827"
              strokeWidth={0.04}
            />

            {model.display.contours && contour
              ? cells.map((cell) => (
                  <rect
                    key={cell.key}
                    x={cell.x}
                    y={cell.y}
                    width={cell.width}
                    height={cell.height}
                    fill={interpolateContourColor(cell.value, contour.min, contour.max)}
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
            <h3>{resultLabel[selectedField]} View</h3>
            <p>
              Contours: {model.display.contours ? "On" : "Off"} | Mesh:{" "}
              {model.display.mesh ? "On" : "Off"} | Supports:{" "}
              {model.display.supports ? "On" : "Off"} | Wheels:{" "}
              {model.display.wheelPatches ? "On" : "Off"}
            </p>
            {selectedField === "reactions" ? (
              <p>Reaction table mode active.</p>
            ) : contour ? (
              <p>
                Range: {contour.min.toFixed(3)} to {contour.max.toFixed(3)} {contour.units}
              </p>
            ) : (
              <p>No contour values available for this field yet.</p>
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
      </section>

      {model.display.tables ? (
        <section className="table-panel">
          <header>
            <h3>Reactions</h3>
            <p>{results.reactions.length} rows</p>
          </header>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Support</th>
                  <th>DOF</th>
                  <th>Value</th>
                  <th>Units</th>
                </tr>
              </thead>
              <tbody>
                {results.reactions.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No reaction values available.</td>
                  </tr>
                ) : (
                  results.reactions.map((row, idx) => (
                    <tr key={`${row.supportId}-${row.dof}-${idx}`}>
                      <td>{row.supportId}</td>
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

function interpolateContourColor(value: number, min: number, max: number): string {
  if (Math.abs(max - min) < 1e-12) {
    return "rgb(217, 231, 225)";
  }

  const normalized = (value - min) / (max - min);
  const clamped = Math.max(0, Math.min(1, normalized));
  const r = Math.round(28 + 204 * clamped);
  const g = Math.round(91 + 95 * (1 - Math.abs(clamped - 0.5) * 2));
  const b = Math.round(78 + 166 * (1 - clamped));
  return `rgb(${r}, ${g}, ${b})`;
}
