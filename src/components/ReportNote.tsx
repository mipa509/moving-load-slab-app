import type {
  AnalysisResults,
  ConstraintSetting,
  Dof,
  SlabModel,
  Support,
} from "../app/types";
import {
  computeEnvelopeSectionCurves,
  computeSectionCurve,
  resolveSectionAxis,
} from "../app/sectionCurve";
import { SectionPlot } from "./SectionPlot";

interface ReportNoteProps {
  model: SlabModel;
  results: AnalysisResults;
  images: { mx?: string; my?: string };
  preparedBy?: string;
}

const DOFS: Dof[] = ["uz", "rx", "ry"];

const formatConstraint = (setting: ConstraintSetting): string => {
  if (setting.type === "spring") {
    return `spring (k=${(setting.stiffness ?? 0).toLocaleString()})`;
  }
  return setting.type;
};

const supportCoords = (support: Support): string => {
  if (support.kind === "line") {
    return `(${support.x1.toFixed(2)}, ${support.y1.toFixed(2)}) → (${support.x2.toFixed(2)}, ${support.y2.toFixed(2)})`;
  }
  return `(${support.x.toFixed(2)}, ${support.y.toFixed(2)})`;
};

const splitAssumptions = (text: string): string[] =>
  text
    .split(/[\n;]+/)
    .map((line) => line.trim())
    .filter(Boolean);

const sumAxleLoad = (model: SlabModel): number => {
  if (model.vehicle.mode === "axle") {
    return model.vehicle.axleInputs.reduce((sum, axle) => sum + axle.axleLoadKn, 0);
  }
  return model.vehicle.directWheels.reduce((sum, wheel) => sum + wheel.loadKn, 0);
};

const wheelCount = (model: SlabModel): number => {
  if (model.vehicle.mode === "axle") {
    return model.vehicle.axleInputs.length * Math.max(1, model.vehicle.wheelsPerAxle);
  }
  return model.vehicle.directWheels.length;
};

const travelLabel: Record<string, string> = {
  "x+": "+X",
  "x-": "-X",
  "y+": "+Y",
  "y-": "-Y",
};

export const ReportNote = ({ model, results, images, preparedBy }: ReportNoteProps) => {
  const today = new Date().toLocaleDateString();
  const totalLoad = sumAxleLoad(model);
  const wheels = wheelCount(model);
  const assumptions = splitAssumptions(model.assumptions);
  const mxData = results.nodalContours.mx;
  const myData = results.nodalContours.my;

  return (
    <article className="report-note" aria-label="Engineering note">
      <header className="report-note-header">
        <div>
          <p className="report-note-kicker">Engineering note · Moving Load Slab</p>
          <h1>{model.projectName || "Untitled project"}</h1>
        </div>
        <dl className="report-note-meta">
          <div>
            <dt>Date</dt>
            <dd>{today}</dd>
          </div>
          {preparedBy ? (
            <div>
              <dt>Prepared by</dt>
              <dd>{preparedBy}</dd>
            </div>
          ) : null}
          <div>
            <dt>Solver</dt>
            <dd>Linear-elastic plate (Kirchhoff)</dd>
          </div>
        </dl>
      </header>

      <section className="report-note-section">
        <h2>1. Description</h2>
        <p>{model.description || "—"}</p>
      </section>

      <section className="report-note-section">
        <h2>2. Assumptions</h2>
        {assumptions.length > 0 ? (
          <ul>
            {assumptions.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        ) : (
          <p>—</p>
        )}
      </section>

      <section className="report-note-section">
        <h2>3. Structure & supports</h2>
        <table className="report-note-table">
          <tbody>
            <tr>
              <th>Span</th>
              <td>
                {model.geometry.lengthM.toFixed(2)} m × {model.geometry.widthM.toFixed(2)} m
              </td>
            </tr>
            <tr>
              <th>Slab thickness</th>
              <td>{model.geometry.thicknessM.toFixed(3)} m</td>
            </tr>
            <tr>
              <th>Material</th>
              <td>
                E = {model.material.elasticModulusMPa.toLocaleString()} MPa, ν ={" "}
                {model.material.poisson.toFixed(2)}, ρ ={" "}
                {model.material.densityKnPerM3.toFixed(1)} kN/m³
              </td>
            </tr>
            <tr>
              <th>Mesh target</th>
              <td>
                {model.mesh.autoTargetElementM.toFixed(2)} m element size (
                {model.mesh.density} elements along longest side)
              </td>
            </tr>
          </tbody>
        </table>

        <h3>Supports</h3>
        <table className="report-note-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Kind</th>
              <th>Coordinates (m)</th>
              <th>Uz</th>
              <th>Rx</th>
              <th>Ry</th>
            </tr>
          </thead>
          <tbody>
            {model.supports.map((support) => (
              <tr key={support.id}>
                <td>{support.id}</td>
                <td>{support.name}</td>
                <td>{support.kind}</td>
                <td>{supportCoords(support)}</td>
                {DOFS.map((dof) => (
                  <td key={dof}>{formatConstraint(support.constraints[dof])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="report-note-section">
        <h2>4. Loads — vehicle</h2>
        <table className="report-note-table">
          <tbody>
            <tr>
              <th>Vehicle</th>
              <td>{model.vehicle.name}</td>
            </tr>
            <tr>
              <th>Definition mode</th>
              <td>
                {model.vehicle.mode === "axle"
                  ? `Axle-based (${model.vehicle.axleInputs.length} axles, ${model.vehicle.wheelsPerAxle} wheels per axle)`
                  : `Direct wheels (${model.vehicle.directWheels.length} wheels)`}
              </td>
            </tr>
            <tr>
              <th>Transverse spacing</th>
              <td>{model.vehicle.transverseSpacingM.toFixed(2)} m</td>
            </tr>
            <tr>
              <th>Total wheel count</th>
              <td>{wheels}</td>
            </tr>
            <tr>
              <th>Total vehicle load</th>
              <td>{totalLoad.toFixed(2)} kN</td>
            </tr>
            <tr>
              <th>Travel direction</th>
              <td>{travelLabel[model.placement.travelDirection] ?? model.placement.travelDirection}</td>
            </tr>
            <tr>
              <th>Reference centre</th>
              <td>
                ({model.placement.centerXM.toFixed(2)}, {model.placement.centerYM.toFixed(2)}) m
              </td>
            </tr>
          </tbody>
        </table>

        {model.vehicle.mode === "axle" ? (
          <table className="report-note-table">
            <thead>
              <tr>
                <th>Axle</th>
                <th>Spacing from prev. (m)</th>
                <th>Axle load (kN)</th>
                <th>Patch L × T (m)</th>
              </tr>
            </thead>
            <tbody>
              {model.vehicle.axleInputs.map((axle) => (
                <tr key={axle.id}>
                  <td>{axle.id}</td>
                  <td>{axle.spacingFromPreviousM.toFixed(2)}</td>
                  <td>{axle.axleLoadKn.toFixed(2)}</td>
                  <td>
                    {model.vehicle.wheelPatchLongM.toFixed(2)} × {model.vehicle.wheelPatchTransM.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="report-note-table">
            <thead>
              <tr>
                <th>Wheel</th>
                <th>X (m)</th>
                <th>Y (m)</th>
                <th>Load (kN)</th>
                <th>Patch L × T (m)</th>
              </tr>
            </thead>
            <tbody>
              {model.vehicle.directWheels.map((wheel) => (
                <tr key={wheel.id}>
                  <td>{wheel.id}</td>
                  <td>{wheel.xM.toFixed(2)}</td>
                  <td>{wheel.yM.toFixed(2)}</td>
                  <td>{wheel.loadKn.toFixed(2)}</td>
                  <td>
                    {wheel.patchLongM.toFixed(2)} × {wheel.patchTransM.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="report-note-section">
        <h2>5. Reactions</h2>
        <table className="report-note-table">
          <thead>
            <tr>
              <th>Support</th>
              <th>Σ Uz (kN)</th>
              <th>Σ Rx (kN·m)</th>
              <th>Σ Ry (kN·m)</th>
            </tr>
          </thead>
          <tbody>
            {results.reactionSummaryBySupport.length === 0 ? (
              <tr>
                <td colSpan={4}>No reactions available — re-run analysis.</td>
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
                <tr className="report-note-total-row">
                  <td>Total</td>
                  <td>{results.reactionTotals.uz.toFixed(3)}</td>
                  <td>{results.reactionTotals.rx.toFixed(3)}</td>
                  <td>{results.reactionTotals.ry.toFixed(3)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </section>

      {(() => {
        const axis = resolveSectionAxis(model.placement.travelDirection, model.section.axis);
        const targetField = axis === "x" ? "mx" : "my";
        const contour = results.nodalContours[targetField];
        const envelopeData = results.envelope;
        const envelope = envelopeData ? envelopeData[targetField] : undefined;
        const currentCurve = contour
          ? computeSectionCurve(contour, axis, model.section.centerPerpM, model.section.widthM)
          : null;
        const envelopeCurves = envelope
          ? computeEnvelopeSectionCurves(
              envelope,
              axis,
              model.section.centerPerpM,
              model.section.widthM,
            )
          : null;
        const valueLabel = targetField === "mx" ? "Mxx" : "Myy";
        const axisLabel = axis === "x" ? "Distance along X (m)" : "Distance along Y (m)";
        const perpLabel = axis === "x" ? "Y" : "X";
        const sectionSubtitle = `Strip ${model.section.widthM.toFixed(2)} m wide centred at ${perpLabel} = ${model.section.centerPerpM.toFixed(2)} m`;

        return (
          <section className="report-note-section report-note-section-plots">
            <h2>6. Longitudinal section</h2>
            <p>
              Section axis: along {axis === "x" ? "X" : "Y"} (follows travel direction). Each
              station of the curve is the arithmetic mean of nodal {valueLabel} values inside the
              strip band.
            </p>
            <SectionPlot
              current={currentCurve}
              axisLabel={axisLabel}
              valueUnits={contour?.units ?? "kN*m/m"}
              valueLabel={valueLabel}
              title={`${valueLabel} — current placement`}
              subtitle={sectionSubtitle}
            />
            {envelopeCurves && envelope && envelopeData ? (
              <SectionPlot
                current={null}
                envelopeMax={envelopeCurves.max}
                envelopeMin={envelopeCurves.min}
                axisLabel={axisLabel}
                valueUnits={envelope.units}
                valueLabel={valueLabel}
                title={`${valueLabel} — envelope (${envelopeData.stationsRun} stations from ${envelopeData.pathStartM.toFixed(2)} m to ${envelopeData.pathEndM.toFixed(2)} m, step ${envelopeData.pathStepM.toFixed(2)} m)`}
                subtitle={sectionSubtitle}
              />
            ) : null}
          </section>
        );
      })()}

      <section className="report-note-section report-note-figures">
        <h2>7. Bending moments</h2>
        <figure>
          <figcaption>
            <strong>Mxx</strong> — bending moment about y-axis
            {mxData
              ? ` · range ${mxData.min.toFixed(2)} to ${mxData.max.toFixed(2)} ${mxData.units}`
              : null}
          </figcaption>
          {images.mx ? (
            <img src={images.mx} alt="Mxx contour" />
          ) : (
            <p className="report-note-missing">Plot capture not available.</p>
          )}
        </figure>
        <figure>
          <figcaption>
            <strong>Myy</strong> — bending moment about x-axis
            {myData
              ? ` · range ${myData.min.toFixed(2)} to ${myData.max.toFixed(2)} ${myData.units}`
              : null}
          </figcaption>
          {images.my ? (
            <img src={images.my} alt="Myy contour" />
          ) : (
            <p className="report-note-missing">Plot capture not available.</p>
          )}
        </figure>
      </section>

      <footer className="report-note-footer">
        <span>Generated by Moving Load Slab App · {today}</span>
      </footer>
    </article>
  );
};
