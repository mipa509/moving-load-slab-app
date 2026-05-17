# PDF report — envelope worst-station plan views + vehicle side elevation

**Date:** 2026-05-18
**Branch:** `feat/pdf-envelope-and-vehicle-diagram`
**Status:** Spec — awaiting user review before implementation plan.

## Motivation

Two gaps in the current PDF report:

1. The Mxx/Myy "plan view" figures in Section 7 are captured from the WebGL canvas at the **current** vehicle placement — the last position the user happened to set in the UI. After running an envelope, the report should also show the plan views at the worst envelope stations (where peak |Mxx| and peak |Myy| occur), so the design check matches the envelope summary in Section 6.
2. The report has no diagram of the vehicle itself. The axle table lists spacings and loads, but a side-elevation schematic with axle arrows + load labels makes the input far easier to confirm at a glance.

## Scope

In scope (this branch):
- Envelope sweep tracks which station produced the worst |Mxx| and worst |Myy|.
- PDF export captures additional plan-view images at those worst stations, in addition to the current-placement images already captured.
- ReportNote gains a new section showing the worst-station plan views below the existing current-placement section.
- A new inline SVG vehicle side-elevation component is added to Section 4 "Loads — vehicle".
- Tests for the new envelope tracking and the axle-clustering helper used by the side elevation in direct-wheel mode.

Out of scope:
- Changing the existing cross-section plot in Section 6 (it already renders envelope max/min curves).
- Plan-view from a top-down camera angle that's separate from the current WebGL view (we reuse the same canvas).
- Vehicle plan-view diagram (only side elevation per user's decision).
- 3D iso views in the report.

## Requirements

### R1 — Envelope worst-station tracking
The envelope must record, per field (`mx`, `my`), the station coord that produced the largest absolute peak across all nodes during the sweep. "Peak" means whichever of `max`/`min` has the larger absolute value at that station for that field.

### R2 — Worst-station plan-view capture
When the user clicks **Export PDF**, if a fresh envelope is available:
1. Capture current-placement Mxx + Myy PNGs (existing behaviour).
2. Move placement to the worst-Mxx station, re-run analysis, switch the viewer to Mxx, capture PNG.
3. Repeat for worst-Myy station + Myy view.
4. Restore the original placement and re-run analysis so the UI is left as the user found it.
5. Open the print dialog.

If no envelope is available or the envelope is stale, only the current-placement images are captured and the worst-station section is omitted from the report (with a short note).

### R3 — ReportNote — new worst-station figures section
A new Section 8 "Bending moments — envelope worst stations" is inserted after Section 7. It contains:
- Two figures: Mxx-at-worst-Mxx-station and Myy-at-worst-Myy-station.
- Each figure caption states: peak value, station coord along the travel axis, and that the vehicle is positioned at this station in the figure.
- If `envelopeStale` or no envelope: a single short paragraph "Run the envelope to populate worst-station plan views."

### R4 — Vehicle side elevation diagram
A new inline SVG component (`VehicleSideElevation`) renders at the bottom of Section 4 "Loads — vehicle":
- Horizontal baseline representing the slab.
- One wheel per axle drawn as a small ellipse/circle on the baseline.
- One downward arrow per axle, anchored above the wheel, labelled with the axle load in kN.
- Dimension lines between adjacent axles showing centre-to-centre spacing in metres.
- Total vehicle length annotated above.
- Pure SVG (no canvas capture), sized to fit the report column, scales axle positions to fit.

Axle mode: uses `model.vehicle.axleInputs` directly. Cumulative spacing from the first axle gives X positions.

Direct-wheel mode: cluster `directWheels` by their X coordinate (tolerance 0.05 m), treat each cluster as a pseudo-axle, sum loads. Render the same way as axle mode using cluster centres + summed loads.

### R5 — Tests
- Unit test that `runPathEnvelope` records the correct worst-station coord for a synthetic two-station sweep where the second station has a larger peak.
- Unit test for the axle-clustering helper (covers: distinct clusters, near-coincident wheels merging, single wheel).
- Unit test or snapshot for `VehicleSideElevation` rendering with both axle mode and direct-wheel mode.

## Design

### Data shape change — `EnvelopeData`

Extend `EnvelopeData` in `src/app/types.ts`:

```ts
export interface EnvelopeWorstStation {
  stationM: number;        // placement coord along travel axis
  peakValue: number;       // signed peak (whichever of max/min has larger |·|)
  peakAbs: number;         // |peakValue|, for convenience
  nodeId: number;          // node where the peak was observed
}

export interface EnvelopeData {
  // … existing fields …
  worstStations: {
    mx: EnvelopeWorstStation;
    my: EnvelopeWorstStation;
  };
}
```

`runPathEnvelope.ts` is extended:
- Track per field: current best `peakAbs`, plus `stationM`, signed `peakValue`, `nodeId`.
- After each station's solve, for each field scan the contour points; for each node compute `|value|`; if it beats the running best, update.
- At the end, populate `worstStations` on the returned `EnvelopeData`.

### PDF export flow

In `App.tsx::handleExportPdf`:

```text
1. snapshot prevField, prevPlotMode, prevPlacement
2. set plot mode to "results", field to "mx"
3. waitFrames(4); capture canvas -> currentMx
4. set field to "my"; waitFrames(4); capture -> currentMy
5. if results.envelope && !envelopeStale:
     for field, worst in [("mx", envelope.worstStations.mx),
                          ("my", envelope.worstStations.my)]:
       set placement to worst.stationM (along travel axis)
       run analysis (await)
       set field
       waitFrames(4)
       capture -> envelopeMx / envelopeMy
6. restore prevPlacement; re-run analysis; await
7. setReportImages({ currentMx, currentMy, envelopeMx?, envelopeMy? })
8. waitFrames(2); window.print()
9. finally: restore prevField, prevPlotMode
```

Failure handling: if any of the worst-station re-runs fails (solver error), skip the worst-station images and continue with the rest. Log the error via the existing analysis-result error surface.

State shape:
```ts
const [reportImages, setReportImages] = useState<{
  currentMx?: string;
  currentMy?: string;
  envelopeMx?: string;
  envelopeMy?: string;
  envelopeMxStation?: number;
  envelopeMyStation?: number;
  envelopeMxPeak?: number;
  envelopeMyPeak?: number;
}>({});
```

### `ReportNote` changes

- Update the `images` prop type to the shape above.
- Section 7 caption text unchanged.
- Insert a new section "8. Bending moments — envelope worst stations" before the footer:
  - Renders if `images.envelopeMx || images.envelopeMy` present.
  - Otherwise renders a short note: "No envelope available. Run **Envelope** then re-export to populate worst-station plan views."
- Each worst-station figure caption: `<strong>Mxx</strong> — vehicle ref. centre at {X|Y} = {stationM} m · peak {peakValue} {units}` (axis letter follows the travel direction).

### `VehicleSideElevation` component

`src/components/VehicleSideElevation.tsx`:

```ts
interface Props {
  vehicle: VehicleDefinition;
  // computed positions:
  //   axle mode    -> axleInputs (cumulative spacing)
  //   direct mode  -> clusterDirectWheelsByLongitudinal(directWheels, 0.05)
  className?: string;
}
```

Layout (logical units; viewBox scales to the SVG container):
- viewBox computed from total vehicle length + margins for labels.
- Baseline at y = 80 (px in viewBox). Axle wheels drawn as 14×8 ellipses centred on baseline.
- Above each wheel: vertical arrow length 40 px terminating at the wheel top. Arrowhead 6 px.
- Load label above arrow tip in bold.
- Below baseline: dimension line between adjacent axle centres with the spacing value in metres.
- Above the highest arrow label: a single span dimension line giving total length.

Axle-clustering helper (`clusterDirectWheelsByLongitudinal`):
- Group wheels whose X positions are within `tolM` (default 0.05) of the cluster's running centroid.
- Output: `{ xM: number; totalLoadKn: number; wheelCount: number; }[]` sorted by `xM`.

### Files

```
src/app/types.ts                                  modify (extend EnvelopeData)
src/app/runPathEnvelope.ts                        modify (track worst stations)
src/app/App.tsx                                   modify (handleExportPdf, state shape)
src/components/ReportNote.tsx                     modify (new section, new props, side elevation)
src/components/VehicleSideElevation.tsx           new
src/app/vehicleClustering.ts                      new (axle-clustering helper)
src/styles/app.css                                modify (print styles for new section + elevation)
src/tests/runPathEnvelope.test.ts                 modify (worst-station assertion)
src/tests/vehicleClustering.test.ts               new
src/tests/vehicleSideElevation.test.tsx           new (smoke render in both modes)
docs/2026-05-18-pdf-envelope-and-vehicle-diagram.md  this spec
```

## Testing

Unit tests (Vitest, existing setup):

1. `runPathEnvelope.test.ts` — extend the existing two-station test: assert `worstStations.mx.stationM` equals the station with the larger node peak; same for `my`.
2. `vehicleClustering.test.ts` — three cases: well-separated wheels yield N clusters; wheels within tol merge; single wheel passes through; ordering is stable.
3. `vehicleSideElevation.test.tsx` — render in both modes, assert axle count and load labels are present in the SVG output.

No solver/integration tests change. Manual verification: run app → place vehicle → run envelope → Export PDF → confirm Section 7 (current placement) and Section 8 (worst stations) figures are distinct and show the expected vehicle positions; confirm Section 4 elevation diagram matches the axle table.

## Risks / open questions

- **WebGL canvas timing** — `waitFrames(4)` is what the current export uses. Re-running analysis is async, so the export flow must `await` solver completion before capturing. Need to make sure the existing `handleRunAnalysis` returns a promise (or replicate the analysis call inline).
- **`waitFrames` portability** — works in browser; tests don't exercise this path.
- **Print page breaks** — the new section adds 2 figures + diagram. Need to verify with `@media print` that the report still paginates sensibly. Likely a `page-break-inside: avoid` on each figure.
- **Direct-wheel clustering tolerance** — 0.05 m is a guess. If real vehicle inputs have tighter or looser groupings, the tolerance may need to be a vehicle-level setting. Defer until we see real input.
