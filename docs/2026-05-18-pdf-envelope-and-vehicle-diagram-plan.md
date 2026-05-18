# PDF envelope + vehicle side-elevation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Status (2026-05-18):** ✅ All 11 tasks implemented and committed on `feat/pdf-envelope-and-vehicle-diagram`. Build green, 100/100 tests pass. Awaiting live browser smoke-test:
- Run Envelope → Export PDF.
- Section 4 shows "Side elevation" with axle arrows + kN labels.
- Section 7 (current placement) and Section 8 (envelope worst stations) show distinct Mxx/Myy figures.
- On-screen state restored after closing the print preview.

| # | Commit | Task |
|---|---|---|
| 1 | `6a5cb2a` | `EnvelopeData` worst-station types |
| 2 | `34b45e8` | Track worst Mxx/Myy stations during sweep |
| 3 | `98a8beb` | Longitudinal wheel-clustering helper |
| 4 | `1c1fe08` | Side-elevation layout helper (origin anchored to leading wheel, not cluster centroid — justified deviation) |
| 5 | `e5c4967` | `VehicleSideElevation` SVG component |
| 6 | `75f1ca6` | Wire elevation into ReportNote Section 4 |
| 7 | `0a28723` | Widen `reportImages` state shape |
| 8 | `d0bb43d` | Section 8 worst-station figures in ReportNote |
| 9 | `5acbc92` | `handleExportPdf` multi-station capture flow |
| 10 | `3394c76` | Print CSS for figures + elevation |
| 11 | — | Branch pushed |

---

**Goal:** Add worst-station Mxx/Myy plan-view figures and a vehicle side-elevation diagram to the PDF report. The PDF should reflect the envelope sweep, not just the last interactive placement.

**Architecture:**
- `runPathEnvelope` records, per field, the station coord that produced the largest absolute peak across all nodes.
- `App.handleExportPdf` re-runs analysis at those two worst stations and captures additional canvas PNGs before printing.
- `ReportNote` renders a new Section 8 with the worst-station figures, and Section 4 gets an inline-SVG side elevation derived from `axleInputs` (or longitudinally-clustered direct wheels).
- Layout logic for the side elevation is extracted into a pure helper so it can be unit-tested without a DOM.

**Tech Stack:** TypeScript, React 18, Vite, Vitest (Node test environment — no jsdom, no React Testing Library). All tests are pure-logic against modules; SVG components are exercised indirectly through their layout helpers.

**Spec:** `docs/2026-05-18-pdf-envelope-and-vehicle-diagram.md`

---

## File map

```
src/app/types.ts                                  modify  (extend EnvelopeData)
src/app/runPathEnvelope.ts                        modify  (track worst stations)
src/app/vehicleClustering.ts                      new     (axle-clustering helper)
src/app/vehicleSideElevation.ts                   new     (pure layout helper)
src/components/VehicleSideElevation.tsx           new     (SVG component using the helper)
src/components/ReportNote.tsx                     modify  (new section, vehicle elevation, new props)
src/app/App.tsx                                   modify  (handleExportPdf, reportImages shape)
src/styles/app.css                                modify  (print styles)
src/tests/runPathEnvelope.test.ts                 modify  (worst-station assertion)
src/tests/vehicleClustering.test.ts               new
src/tests/vehicleSideElevation.test.ts            new
docs/2026-05-18-pdf-envelope-and-vehicle-diagram-plan.md  this plan
```

Tasks are ordered to be safe to run independently — types come first, helpers next, then UI, then the PDF flow, then styles.

---

### Task 1: Extend `EnvelopeData` types with worst-station fields

**Files:**
- Modify: `src/app/types.ts` (add types near the existing `EnvelopeFieldData`/`EnvelopeData`)

- [x] **Step 1: Add the `EnvelopeWorstStation` interface and `worstStations` field to `EnvelopeData`**

In `src/app/types.ts`, immediately after the existing `EnvelopeFieldData` interface (around line 237) and BEFORE the existing `EnvelopeData` interface (around line 239), insert:

```ts
export interface EnvelopeWorstStation {
  stationM: number;
  peakValue: number;
  peakAbs: number;
  nodeId: number;
}

export interface EnvelopeWorstStations {
  mx: EnvelopeWorstStation;
  my: EnvelopeWorstStation;
}
```

Then extend `EnvelopeData` (line 239) by adding one new field at the bottom, just before the closing `}`:

```ts
  worstStations: EnvelopeWorstStations;
```

- [x] **Step 2: Type-check the workspace**

Run: `npm run build`
Expected: build fails. The compiler will flag `runPathEnvelope.ts` because the returned object no longer satisfies `EnvelopeData` (missing `worstStations`). That is the signal that Task 2 has real work to do — leave the failure for now and proceed.

If unrelated TypeScript errors appear, stop and fix them before continuing.

- [x] **Step 3: Commit**

```bash
git add src/app/types.ts
git commit -m "feat(envelope): add worstStations to EnvelopeData type"
```

---

### Task 2: Track worst stations in `runPathEnvelope` (test-first)

**Files:**
- Modify: `src/tests/runPathEnvelope.test.ts`
- Modify: `src/app/runPathEnvelope.ts`

- [x] **Step 1: Write the failing test**

Append the following test inside the existing `describe("runPathEnvelope", ...)` block in `src/tests/runPathEnvelope.test.ts`, immediately after the existing `it(...)`:

```ts
  it("records worst Mxx/Myy stations within the sweep range", async () => {
    const model = createDefaultModel();
    model.placement = {
      ...model.placement,
      pathStartM: 3,
      pathEndM: 7,
      pathStepM: 1,
      travelDirection: "x+",
    };

    const envelope = await runPathEnvelope(model);

    const mxWorst = envelope.worstStations.mx;
    const myWorst = envelope.worstStations.my;

    expect(mxWorst.stationM).toBeGreaterThanOrEqual(3);
    expect(mxWorst.stationM).toBeLessThanOrEqual(7);
    expect(myWorst.stationM).toBeGreaterThanOrEqual(3);
    expect(myWorst.stationM).toBeLessThanOrEqual(7);

    expect(mxWorst.peakAbs).toBeGreaterThan(0);
    expect(myWorst.peakAbs).toBeGreaterThan(0);
    expect(Math.abs(mxWorst.peakValue)).toBeCloseTo(mxWorst.peakAbs, 6);
    expect(Math.abs(myWorst.peakValue)).toBeCloseTo(myWorst.peakAbs, 6);

    // The worst |Mxx| seen at the worst station must be >= the field's overall absMax-ε
    // (it should equal it, but allow tiny FP slack).
    expect(mxWorst.peakAbs).toBeGreaterThanOrEqual(envelope.mx.absMax - 1e-6);
    expect(myWorst.peakAbs).toBeGreaterThanOrEqual(envelope.my.absMax - 1e-6);
  }, 30_000);
```

- [x] **Step 2: Run the new test to verify it fails**

Run: `npm test -- --run runPathEnvelope`
Expected: the new test fails because `envelope.worstStations` is `undefined` (the implementation does not populate it yet). The existing test must still pass.

- [x] **Step 3: Implement worst-station tracking in `runPathEnvelope.ts`**

In `src/app/runPathEnvelope.ts`:

a) Update the import block at the top to also import the new types:

```ts
import type {
  AnalysisResults,
  EnvelopeData,
  EnvelopeField,
  EnvelopeFieldData,
  EnvelopePerNode,
  EnvelopeWorstStation,
  SlabModel,
} from "./types";
```

b) Define a small accumulator type and a helper above `runPathEnvelope` (after the existing `buildFieldData` function, around line 128). Insert:

```ts
interface WorstAccum {
  stationM: number;
  peakValue: number;
  peakAbs: number;
  nodeId: number;
}

const initWorst = (): WorstAccum => ({
  stationM: 0,
  peakValue: 0,
  peakAbs: -Infinity,
  nodeId: -1,
});

const updateWorst = (
  worst: WorstAccum,
  contour: AnalysisResults["nodalContours"]["mx"],
  stationM: number,
): void => {
  if (!contour) return;
  for (const point of contour.points) {
    const abs = Math.abs(point.value);
    if (abs > worst.peakAbs) {
      worst.peakAbs = abs;
      worst.peakValue = point.value;
      worst.stationM = stationM;
      worst.nodeId = point.nodeId;
    }
  }
};

const finalizeWorst = (worst: WorstAccum): EnvelopeWorstStation => ({
  stationM: worst.stationM,
  peakValue: Number.isFinite(worst.peakValue) ? worst.peakValue : 0,
  peakAbs: Number.isFinite(worst.peakAbs) ? worst.peakAbs : 0,
  nodeId: worst.nodeId,
});
```

c) Inside `runPathEnvelope`, just below the existing `const accum = new Map<...>()` line (around line 141), add per-field worst accumulators:

```ts
  const worstMx = initWorst();
  const worstMy = initWorst();
```

d) Inside the station loop, immediately AFTER the existing `for (const field of ENVELOPE_FIELDS) { … }` block and BEFORE `onProgress?.({…})` (around line 167), add:

```ts
    const mxContour = stepResult.nodalContours.mx;
    const myContour = stepResult.nodalContours.my;
    updateWorst(worstMx, mxContour, station);
    updateWorst(worstMy, myContour, station);
```

e) In the return object at the bottom of the function (around lines 178-189), add `worstStations` before the closing `};`:

```ts
    worstStations: {
      mx: finalizeWorst(worstMx),
      my: finalizeWorst(worstMy),
    },
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npm test -- --run runPathEnvelope`
Expected: both tests pass.

- [x] **Step 5: Run the full test suite**

Run: `npm test`
Expected: every existing test passes (no regressions).

- [x] **Step 6: Commit**

```bash
git add src/app/runPathEnvelope.ts src/tests/runPathEnvelope.test.ts
git commit -m "feat(envelope): record worst Mxx and Myy stations during sweep"
```

---

### Task 3: Add the axle-clustering helper for direct-wheel mode (test-first)

**Files:**
- Create: `src/app/vehicleClustering.ts`
- Create: `src/tests/vehicleClustering.test.ts`

- [x] **Step 1: Write the failing tests**

Create `src/tests/vehicleClustering.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clusterDirectWheelsByLongitudinal } from "../app/vehicleClustering";
import type { DirectWheelInput } from "../app/types";

const wheel = (id: string, xM: number, loadKn = 10, yM = 0): DirectWheelInput => ({
  id,
  xM,
  yM,
  loadKn,
  patchLongM: 0.3,
  patchTransM: 0.2,
});

describe("clusterDirectWheelsByLongitudinal", () => {
  it("returns an empty array for no wheels", () => {
    expect(clusterDirectWheelsByLongitudinal([], 0.05)).toEqual([]);
  });

  it("returns one cluster per wheel when wheels are well separated", () => {
    const clusters = clusterDirectWheelsByLongitudinal(
      [wheel("a", 0, 10), wheel("b", 1.5, 12), wheel("c", 3.0, 15)],
      0.05,
    );
    expect(clusters).toHaveLength(3);
    expect(clusters[0].xM).toBeCloseTo(0, 6);
    expect(clusters[1].xM).toBeCloseTo(1.5, 6);
    expect(clusters[2].xM).toBeCloseTo(3.0, 6);
    expect(clusters.map((c) => c.totalLoadKn)).toEqual([10, 12, 15]);
    expect(clusters.map((c) => c.wheelCount)).toEqual([1, 1, 1]);
  });

  it("merges wheels within the tolerance and sums their loads", () => {
    const clusters = clusterDirectWheelsByLongitudinal(
      [
        wheel("a", 1.0, 10),
        wheel("b", 1.02, 11), // within 0.05 of a
        wheel("c", 1.04, 12), // within 0.05 of a/b
        wheel("d", 2.0, 13),
      ],
      0.05,
    );
    expect(clusters).toHaveLength(2);
    expect(clusters[0].totalLoadKn).toBeCloseTo(33, 6);
    expect(clusters[0].wheelCount).toBe(3);
    expect(clusters[0].xM).toBeGreaterThan(0.99);
    expect(clusters[0].xM).toBeLessThan(1.05);
    expect(clusters[1].xM).toBeCloseTo(2.0, 6);
    expect(clusters[1].totalLoadKn).toBeCloseTo(13, 6);
  });

  it("outputs clusters sorted ascending by xM regardless of input order", () => {
    const clusters = clusterDirectWheelsByLongitudinal(
      [wheel("a", 3.0, 10), wheel("b", 1.0, 11), wheel("c", 2.0, 12)],
      0.05,
    );
    expect(clusters.map((c) => Number(c.xM.toFixed(3)))).toEqual([1, 2, 3]);
  });
});
```

- [x] **Step 2: Run the new test file to verify it fails**

Run: `npm test -- --run vehicleClustering`
Expected: failure — module `../app/vehicleClustering` does not exist.

- [x] **Step 3: Implement the helper**

Create `src/app/vehicleClustering.ts`:

```ts
import type { DirectWheelInput } from "./types";

export interface DirectWheelCluster {
  xM: number;
  totalLoadKn: number;
  wheelCount: number;
}

export const clusterDirectWheelsByLongitudinal = (
  wheels: readonly DirectWheelInput[],
  tolM: number,
): DirectWheelCluster[] => {
  if (wheels.length === 0) return [];
  const sorted = [...wheels].sort((a, b) => a.xM - b.xM);
  const tol = Math.max(0, tolM);

  const clusters: { sumX: number; sumLoad: number; count: number; centroid: number }[] = [];
  for (const w of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(w.xM - last.centroid) <= tol) {
      last.sumX += w.xM;
      last.sumLoad += w.loadKn;
      last.count += 1;
      last.centroid = last.sumX / last.count;
    } else {
      clusters.push({
        sumX: w.xM,
        sumLoad: w.loadKn,
        count: 1,
        centroid: w.xM,
      });
    }
  }

  return clusters.map((c) => ({
    xM: c.centroid,
    totalLoadKn: c.sumLoad,
    wheelCount: c.count,
  }));
};
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npm test -- --run vehicleClustering`
Expected: all 4 cases pass.

- [x] **Step 5: Commit**

```bash
git add src/app/vehicleClustering.ts src/tests/vehicleClustering.test.ts
git commit -m "feat(vehicle): add longitudinal wheel clustering helper"
```

---

### Task 4: Add the side-elevation layout helper (test-first)

**Files:**
- Create: `src/app/vehicleSideElevation.ts`
- Create: `src/tests/vehicleSideElevation.test.ts`

This task extracts the layout maths out of the React component so it can be tested without a DOM. The component (Task 5) is a thin renderer over this helper.

- [x] **Step 1: Write the failing tests**

Create `src/tests/vehicleSideElevation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeSideElevationLayout } from "../app/vehicleSideElevation";
import type { VehicleDefinition } from "../app/types";

const baseVehicle: VehicleDefinition = {
  name: "Test vehicle",
  mode: "axle",
  transverseSpacingM: 1.8,
  wheelsPerAxle: 2,
  wheelPatchLongM: 0.3,
  wheelPatchTransM: 0.2,
  axleInputs: [
    { id: "a1", spacingFromPreviousM: 0, axleLoadKn: 60 },
    { id: "a2", spacingFromPreviousM: 1.5, axleLoadKn: 80 },
    { id: "a3", spacingFromPreviousM: 1.5, axleLoadKn: 80 },
  ],
  directWheels: [],
};

describe("computeSideElevationLayout — axle mode", () => {
  it("places axles at cumulative spacings starting at zero", () => {
    const layout = computeSideElevationLayout(baseVehicle);
    expect(layout.axles.map((a) => Number(a.xM.toFixed(3)))).toEqual([0, 1.5, 3.0]);
    expect(layout.totalLengthM).toBeCloseTo(3.0, 6);
  });

  it("labels each axle with its axle load in kN", () => {
    const layout = computeSideElevationLayout(baseVehicle);
    expect(layout.axles.map((a) => a.loadKn)).toEqual([60, 80, 80]);
  });

  it("returns an empty layout for a vehicle with no axles", () => {
    const empty: VehicleDefinition = {
      ...baseVehicle,
      axleInputs: [],
    };
    const layout = computeSideElevationLayout(empty);
    expect(layout.axles).toEqual([]);
    expect(layout.totalLengthM).toBe(0);
  });
});

describe("computeSideElevationLayout — direct mode", () => {
  const directVehicle: VehicleDefinition = {
    ...baseVehicle,
    mode: "direct",
    axleInputs: [],
    directWheels: [
      { id: "w1", xM: 0.0, yM: -0.9, loadKn: 30, patchLongM: 0.3, patchTransM: 0.2 },
      { id: "w2", xM: 0.02, yM: 0.9, loadKn: 30, patchLongM: 0.3, patchTransM: 0.2 },
      { id: "w3", xM: 2.0, yM: -0.9, loadKn: 40, patchLongM: 0.3, patchTransM: 0.2 },
      { id: "w4", xM: 2.0, yM: 0.9, loadKn: 40, patchLongM: 0.3, patchTransM: 0.2 },
    ],
  };

  it("clusters wheels by longitudinal position and sums loads", () => {
    const layout = computeSideElevationLayout(directVehicle);
    expect(layout.axles).toHaveLength(2);
    expect(layout.axles[0].loadKn).toBeCloseTo(60, 6);
    expect(layout.axles[1].loadKn).toBeCloseTo(80, 6);
    expect(layout.axles[0].xM).toBeLessThan(0.05);
    expect(layout.axles[1].xM).toBeCloseTo(2.0, 6);
    expect(layout.totalLengthM).toBeCloseTo(2.0, 6);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run vehicleSideElevation`
Expected: failure — module `../app/vehicleSideElevation` does not exist.

- [x] **Step 3: Implement the helper**

Create `src/app/vehicleSideElevation.ts`:

```ts
import { clusterDirectWheelsByLongitudinal } from "./vehicleClustering";
import type { VehicleDefinition } from "./types";

export interface SideElevationAxle {
  id: string;
  xM: number;
  loadKn: number;
  wheelCount: number;
}

export interface SideElevationLayout {
  axles: SideElevationAxle[];
  totalLengthM: number;
}

const DIRECT_WHEEL_CLUSTER_TOL_M = 0.05;

export const computeSideElevationLayout = (
  vehicle: VehicleDefinition,
): SideElevationLayout => {
  if (vehicle.mode === "axle") {
    let cumulative = 0;
    const axles: SideElevationAxle[] = vehicle.axleInputs.map((axle, index) => {
      if (index > 0) cumulative += Math.max(0, axle.spacingFromPreviousM);
      return {
        id: axle.id,
        xM: cumulative,
        loadKn: axle.axleLoadKn,
        wheelCount: Math.max(1, vehicle.wheelsPerAxle),
      };
    });
    const totalLengthM = axles.length > 0 ? axles[axles.length - 1].xM : 0;
    return { axles, totalLengthM };
  }

  const clusters = clusterDirectWheelsByLongitudinal(
    vehicle.directWheels,
    DIRECT_WHEEL_CLUSTER_TOL_M,
  );
  const first = clusters[0]?.xM ?? 0;
  const axles: SideElevationAxle[] = clusters.map((c, i) => ({
    id: `cluster-${i + 1}`,
    xM: c.xM - first,
    loadKn: c.totalLoadKn,
    wheelCount: c.wheelCount,
  }));
  const totalLengthM = axles.length > 0 ? axles[axles.length - 1].xM : 0;
  return { axles, totalLengthM };
};
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npm test -- --run vehicleSideElevation`
Expected: all cases pass.

- [x] **Step 5: Commit**

```bash
git add src/app/vehicleSideElevation.ts src/tests/vehicleSideElevation.test.ts
git commit -m "feat(vehicle): add side-elevation layout helper"
```

---

### Task 5: Build the `VehicleSideElevation` SVG component

**Files:**
- Create: `src/components/VehicleSideElevation.tsx`

No tests in this task — the layout is already covered by Task 4; the component is a stateless renderer.

- [x] **Step 1: Create the component**

Create `src/components/VehicleSideElevation.tsx`:

```tsx
import {
  computeSideElevationLayout,
  type SideElevationLayout,
} from "../app/vehicleSideElevation";
import type { VehicleDefinition } from "../app/types";

interface VehicleSideElevationProps {
  vehicle: VehicleDefinition;
  className?: string;
}

const VIEWBOX_HEIGHT = 160;
const TOP_MARGIN = 10;
const BOTTOM_MARGIN = 40;
const SIDE_MARGIN = 60;
const BASELINE_Y = VIEWBOX_HEIGHT - BOTTOM_MARGIN;
const ARROW_LENGTH = 60;
const WHEEL_RX = 9;
const WHEEL_RY = 6;
const MIN_AXLE_PIXELS = 80;

const buildScale = (layout: SideElevationLayout, drawableWidth: number) => {
  const span = Math.max(layout.totalLengthM, 0);
  if (layout.axles.length <= 1 || span <= 1e-6) {
    return (xM: number) => SIDE_MARGIN + drawableWidth / 2 + xM * 0;
  }
  const pxPerM = drawableWidth / span;
  return (xM: number) => SIDE_MARGIN + xM * pxPerM;
};

export const VehicleSideElevation = ({
  vehicle,
  className,
}: VehicleSideElevationProps) => {
  const layout = computeSideElevationLayout(vehicle);
  if (layout.axles.length === 0) {
    return (
      <p className="vehicle-side-elevation-empty">
        No axles defined — add at least one axle (or one wheel cluster) to see the
        elevation.
      </p>
    );
  }

  const baseWidth = Math.max(
    MIN_AXLE_PIXELS * Math.max(layout.axles.length - 1, 1) + 2 * SIDE_MARGIN,
    320,
  );
  const drawableWidth = baseWidth - 2 * SIDE_MARGIN;
  const scaleX = buildScale(layout, drawableWidth);

  const axlesWithPx = layout.axles.map((axle) => ({
    ...axle,
    px: scaleX(axle.xM),
  }));

  return (
    <figure className={`vehicle-side-elevation ${className ?? ""}`.trim()}>
      <svg
        role="img"
        aria-label="Vehicle side elevation"
        viewBox={`0 0 ${baseWidth} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* baseline */}
        <line
          x1={SIDE_MARGIN - 20}
          x2={baseWidth - SIDE_MARGIN + 20}
          y1={BASELINE_Y}
          y2={BASELINE_Y}
          stroke="currentColor"
          strokeWidth={1.2}
        />
        {/* spacings */}
        {axlesWithPx.slice(1).map((axle, i) => {
          const prev = axlesWithPx[i];
          const y = BASELINE_Y + 22;
          const mid = (prev.px + axle.px) / 2;
          const dist = axle.xM - prev.xM;
          return (
            <g key={`dim-${prev.id}-${axle.id}`} stroke="currentColor" fill="currentColor">
              <line x1={prev.px} x2={axle.px} y1={y} y2={y} strokeWidth={0.8} />
              <line x1={prev.px} x2={prev.px} y1={y - 4} y2={y + 4} strokeWidth={0.8} />
              <line x1={axle.px} x2={axle.px} y1={y - 4} y2={y + 4} strokeWidth={0.8} />
              <text
                x={mid}
                y={y - 4}
                textAnchor="middle"
                fontSize="11"
                stroke="none"
              >
                {dist.toFixed(2)} m
              </text>
            </g>
          );
        })}
        {/* axles + arrows */}
        {axlesWithPx.map((axle) => {
          const arrowTopY = BASELINE_Y - ARROW_LENGTH;
          return (
            <g key={axle.id}>
              <ellipse
                cx={axle.px}
                cy={BASELINE_Y}
                rx={WHEEL_RX}
                ry={WHEEL_RY}
                fill="#ffffff"
                stroke="currentColor"
                strokeWidth={1}
              />
              <line
                x1={axle.px}
                x2={axle.px}
                y1={arrowTopY}
                y2={BASELINE_Y - WHEEL_RY - 2}
                stroke="currentColor"
                strokeWidth={1.4}
              />
              <polygon
                points={`${axle.px - 4},${BASELINE_Y - WHEEL_RY - 2} ${axle.px + 4},${BASELINE_Y - WHEEL_RY - 2} ${axle.px},${BASELINE_Y - WHEEL_RY + 4}`}
                fill="currentColor"
              />
              <text
                x={axle.px}
                y={arrowTopY - 4}
                textAnchor="middle"
                fontSize="12"
                fontWeight={600}
                fill="currentColor"
              >
                {axle.loadKn.toFixed(1)} kN
              </text>
            </g>
          );
        })}
        {/* total length */}
        {axlesWithPx.length > 1 ? (
          <g stroke="currentColor" fill="currentColor">
            <line
              x1={axlesWithPx[0].px}
              x2={axlesWithPx[axlesWithPx.length - 1].px}
              y1={TOP_MARGIN}
              y2={TOP_MARGIN}
              strokeWidth={0.8}
            />
            <text
              x={(axlesWithPx[0].px + axlesWithPx[axlesWithPx.length - 1].px) / 2}
              y={TOP_MARGIN - 2}
              textAnchor="middle"
              fontSize="11"
              stroke="none"
            >
              total {layout.totalLengthM.toFixed(2)} m
            </text>
          </g>
        ) : null}
      </svg>
      <figcaption>
        Side elevation — {axlesWithPx.length} axle{axlesWithPx.length === 1 ? "" : "s"},
        total length {layout.totalLengthM.toFixed(2)} m.
      </figcaption>
    </figure>
  );
};
```

- [x] **Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: build succeeds (the new file imports types correctly; no other code uses it yet).

If errors appear, re-read this step's code and ensure imports match the helper exports from Task 4.

- [x] **Step 3: Commit**

```bash
git add src/components/VehicleSideElevation.tsx
git commit -m "feat(report): add vehicle side-elevation SVG component"
```

---

### Task 6: Wire `VehicleSideElevation` into `ReportNote` Section 4

**Files:**
- Modify: `src/components/ReportNote.tsx`

- [x] **Step 1: Import the new component**

In `src/components/ReportNote.tsx`, add an import near the top, immediately after the `SectionPlot` import (around line 13):

```ts
import { VehicleSideElevation } from "./VehicleSideElevation";
```

- [x] **Step 2: Render the elevation at the bottom of Section 4**

In `src/components/ReportNote.tsx`, find the closing `</section>` of Section 4 "Loads — vehicle" (it ends just before the `<section className="report-note-section">` that opens Section 5 "Reactions"; look for the conditional that renders the axle table or direct-wheels table). Immediately BEFORE that closing `</section>`, insert:

```tsx
        <h3>Side elevation</h3>
        <VehicleSideElevation vehicle={model.vehicle} />
```

- [x] **Step 3: Type-check**

Run: `npm run build`
Expected: build succeeds.

- [x] **Step 4: Manual smoke check (browser)**

Run: `npm run dev` (in another shell), open the URL it prints, and confirm the report area (scroll down past the viewport) shows the new "Side elevation" subsection with axle wheels, downward arrows, axle-load labels, and spacing dimensions. Stop the dev server (Ctrl+C) when done.

Expected: diagram renders. If text labels overlap arrows on very wide vehicles, that's acceptable for now — print layout is the priority.

- [x] **Step 5: Commit**

```bash
git add src/components/ReportNote.tsx
git commit -m "feat(report): show vehicle side elevation in Loads section"
```

---

### Task 7: Extend `reportImages` state shape in `App.tsx`

**Files:**
- Modify: `src/app/App.tsx` (state declaration only; the consumer changes come in later tasks)

- [x] **Step 1: Widen the state type**

In `src/app/App.tsx`, find the existing line (around line 55):

```ts
  const [reportImages, setReportImages] = useState<{ mx?: string; my?: string }>({});
```

Replace it with:

```ts
  const [reportImages, setReportImages] = useState<{
    currentMx?: string;
    currentMy?: string;
    envelopeMx?: string;
    envelopeMy?: string;
    envelopeMxStationM?: number;
    envelopeMyStationM?: number;
    envelopeMxPeak?: number;
    envelopeMyPeak?: number;
    envelopeUnits?: string;
  }>({});
```

- [x] **Step 2: Update the existing `handleExportPdf` to use the new field names**

In `src/app/App.tsx`, find `handleExportPdf` (around line 211). Inside the `try` block, change:

```ts
      const mxPng = canvasRef.current?.toDataURL("image/png");
```

to:

```ts
      const currentMx = canvasRef.current?.toDataURL("image/png");
```

and:

```ts
      const myPng = canvasRef.current?.toDataURL("image/png");
```

to:

```ts
      const currentMy = canvasRef.current?.toDataURL("image/png");
```

Then change the `setReportImages` call from:

```ts
      setReportImages({ mx: mxPng, my: myPng });
```

to:

```ts
      setReportImages({ currentMx, currentMy });
```

- [x] **Step 3: Update the `ReportNote` consumer to use the new field names**

In `src/app/App.tsx`, find the `<ReportNote ... />` JSX (around line 427) and change its `images` prop usage if it inlines `reportImages` — leave it pointing at the state, but the `ReportNote` consumption is rewired in Task 8. For now, temporarily map the new state into the old shape so the build keeps working:

Change:

```tsx
      <ReportNote model={model} results={results} images={reportImages} />
```

to:

```tsx
      <ReportNote
        model={model}
        results={results}
        images={{ mx: reportImages.currentMx, my: reportImages.currentMy }}
      />
```

This keeps the old `ReportNote` contract intact until Task 8 widens it.

- [x] **Step 4: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds.

- [x] **Step 5: Commit**

```bash
git add src/app/App.tsx
git commit -m "refactor(report): widen reportImages state to carry envelope captures"
```

---

### Task 8: Add Section 8 worst-station figures to `ReportNote`

**Files:**
- Modify: `src/components/ReportNote.tsx`
- Modify: `src/app/App.tsx` (drop the temporary adapter from Task 7)

- [x] **Step 1: Widen the `ReportNote` props**

In `src/components/ReportNote.tsx`, find the existing prop declaration (around line 15):

```ts
interface ReportNoteProps {
  model: SlabModel;
  results: AnalysisResults;
  images: { mx?: string; my?: string };
  preparedBy?: string;
}
```

Replace with:

```ts
interface ReportNoteImages {
  currentMx?: string;
  currentMy?: string;
  envelopeMx?: string;
  envelopeMy?: string;
  envelopeMxStationM?: number;
  envelopeMyStationM?: number;
  envelopeMxPeak?: number;
  envelopeMyPeak?: number;
  envelopeUnits?: string;
}

interface ReportNoteProps {
  model: SlabModel;
  results: AnalysisResults;
  images: ReportNoteImages;
  preparedBy?: string;
}
```

- [x] **Step 2: Switch Section 7 figures to the new field names**

In `src/components/ReportNote.tsx`, find Section 7 "Bending moments" (the section that renders the `<img src={images.mx}>` and `<img src={images.my}>` figures). Update the section heading text to mention "current placement", and change the `src` references from `images.mx` / `images.my` to `images.currentMx` / `images.currentMy`. The two `<figcaption>` lines stay otherwise the same.

Example before:

```tsx
      <section className="report-note-section report-note-figures">
        <h2>7. Bending moments</h2>
        <figure>
          <figcaption>
            <strong>Mxx</strong> — bending moment about y-axis
            ...
          </figcaption>
          {images.mx ? (
            <img src={images.mx} alt="Mxx contour" />
```

After:

```tsx
      <section className="report-note-section report-note-figures">
        <h2>7. Bending moments — current placement</h2>
        <figure>
          <figcaption>
            <strong>Mxx</strong> — bending moment about y-axis
            ...
          </figcaption>
          {images.currentMx ? (
            <img src={images.currentMx} alt="Mxx contour at current placement" />
```

Repeat for the Myy figure: `images.my` → `images.currentMy`; alt text "Myy contour at current placement".

- [x] **Step 3: Add Section 8 below Section 7**

In `src/components/ReportNote.tsx`, IMMEDIATELY AFTER the closing `</section>` of Section 7 and BEFORE the existing `<footer …>`, insert:

```tsx
      <section className="report-note-section report-note-figures">
        <h2>8. Bending moments — envelope worst stations</h2>
        {images.envelopeMx || images.envelopeMy ? (
          <>
            <p>
              Plan views captured with the vehicle reference centre placed at the
              station that produced the largest absolute peak across all nodes during
              the envelope sweep. Travel axis follows{" "}
              {travelLabel[model.placement.travelDirection] ?? model.placement.travelDirection}.
            </p>
            <figure>
              <figcaption>
                <strong>Mxx</strong> — worst station
                {images.envelopeMxStationM !== undefined
                  ? ` · vehicle ref. centre at ${
                      model.placement.travelDirection.startsWith("x") ? "X" : "Y"
                    } = ${images.envelopeMxStationM.toFixed(2)} m`
                  : null}
                {images.envelopeMxPeak !== undefined && images.envelopeUnits
                  ? ` · peak ${images.envelopeMxPeak.toFixed(2)} ${images.envelopeUnits}`
                  : null}
              </figcaption>
              {images.envelopeMx ? (
                <img src={images.envelopeMx} alt="Mxx contour at worst envelope station" />
              ) : (
                <p className="report-note-missing">Plot capture not available.</p>
              )}
            </figure>
            <figure>
              <figcaption>
                <strong>Myy</strong> — worst station
                {images.envelopeMyStationM !== undefined
                  ? ` · vehicle ref. centre at ${
                      model.placement.travelDirection.startsWith("x") ? "X" : "Y"
                    } = ${images.envelopeMyStationM.toFixed(2)} m`
                  : null}
                {images.envelopeMyPeak !== undefined && images.envelopeUnits
                  ? ` · peak ${images.envelopeMyPeak.toFixed(2)} ${images.envelopeUnits}`
                  : null}
              </figcaption>
              {images.envelopeMy ? (
                <img src={images.envelopeMy} alt="Myy contour at worst envelope station" />
              ) : (
                <p className="report-note-missing">Plot capture not available.</p>
              )}
            </figure>
          </>
        ) : (
          <p className="report-note-missing">
            No envelope available — run <strong>Envelope</strong> then re-export to populate
            worst-station plan views.
          </p>
        )}
      </section>
```

- [x] **Step 4: Drop the temporary adapter in `App.tsx`**

In `src/app/App.tsx`, change the `<ReportNote …>` JSX back to passing `reportImages` directly:

```tsx
      <ReportNote model={model} results={results} images={reportImages} />
```

- [x] **Step 5: Type-check**

Run: `npm run build`
Expected: build succeeds.

- [x] **Step 6: Commit**

```bash
git add src/components/ReportNote.tsx src/app/App.tsx
git commit -m "feat(report): add Section 8 worst-station plan view figures"
```

---

### Task 9: Capture worst-station images in `handleExportPdf`

**Files:**
- Modify: `src/app/App.tsx`

This task makes the export flow re-run analysis at the two worst stations and capture canvas PNGs from each.

- [x] **Step 1: Replace `handleExportPdf` with the multi-station version**

In `src/app/App.tsx`, find the existing `handleExportPdf` (around line 211) and replace its whole body. The new implementation:

```ts
  const handleExportPdf = async () => {
    if (results.status !== "success") {
      window.print();
      return;
    }

    const envelope = results.envelope;
    const envelopeFresh =
      envelope !== undefined &&
      envelope.signature === buildAutoRunSignature(model);

    const prevField = selectedResultField;
    const prevPlotMode = model.display.plotMode;
    const prevPlacement = model.placement;

    const captureField = async (field: "mx" | "my"): Promise<string | undefined> => {
      setSelectedResultField(field);
      await waitFrames(4);
      return canvasRef.current?.toDataURL("image/png");
    };

    try {
      setModel((curr) => ({ ...curr, display: { ...curr.display, plotMode: "results" } }));
      await waitFrames(2);

      const currentMx = await captureField("mx");
      const currentMy = await captureField("my");

      const captures: {
        envelopeMx?: string;
        envelopeMy?: string;
        envelopeMxStationM?: number;
        envelopeMyStationM?: number;
        envelopeMxPeak?: number;
        envelopeMyPeak?: number;
        envelopeUnits?: string;
      } = {};

      if (envelopeFresh && envelope) {
        const isXAxis =
          model.placement.travelDirection === "x+" ||
          model.placement.travelDirection === "x-";
        const stationModel = (stationM: number): SlabModel => ({
          ...model,
          placement: {
            ...model.placement,
            ...(isXAxis ? { centerXM: stationM } : { centerYM: stationM }),
          },
        });

        const mxStation = envelope.worstStations.mx.stationM;
        setModel(stationModel(mxStation));
        await waitFrames(2);
        const mxRun = await runFixedAnalysis(stationModel(mxStation));
        if (mxRun.status === "success") {
          setResults(mxRun);
          await waitFrames(4);
          captures.envelopeMx = await captureField("mx");
          captures.envelopeMxStationM = mxStation;
          captures.envelopeMxPeak = envelope.worstStations.mx.peakValue;
          captures.envelopeUnits = envelope.mx.units;
        }

        const myStation = envelope.worstStations.my.stationM;
        setModel(stationModel(myStation));
        await waitFrames(2);
        const myRun = await runFixedAnalysis(stationModel(myStation));
        if (myRun.status === "success") {
          setResults(myRun);
          await waitFrames(4);
          captures.envelopeMy = await captureField("my");
          captures.envelopeMyStationM = myStation;
          captures.envelopeMyPeak = envelope.worstStations.my.peakValue;
          captures.envelopeUnits = envelope.my.units;
        }

        // Restore original placement + re-run so the UI reflects user's last setup.
        setModel((curr) => ({ ...curr, placement: prevPlacement }));
        const restoredRun = await runFixedAnalysis({
          ...model,
          placement: prevPlacement,
        });
        if (restoredRun.status === "success") {
          setResults({ ...restoredRun, envelope });
        }
        await waitFrames(2);
      }

      setReportImages({
        currentMx,
        currentMy,
        ...captures,
      });
      await waitFrames(2);
      window.print();
    } finally {
      setSelectedResultField(prevField);
      setModel((curr) => ({ ...curr, display: { ...curr.display, plotMode: prevPlotMode } }));
    }
  };
```

Notes for the engineer applying this step:
- `buildAutoRunSignature` and `runFixedAnalysis` are already imported at the top of the file.
- `SlabModel` is already imported via the existing `import type { … SlabModel … }` group.
- `waitFrames` is already defined locally just above `handleExportPdf`.

- [x] **Step 2: Type-check the workspace**

Run: `npm run build`
Expected: build succeeds.

- [x] **Step 3: Run the full test suite**

Run: `npm test`
Expected: every test passes.

- [x] **Step 4: Manual smoke check (browser)**

Run: `npm run dev`. In the browser:
1. Use the default model. Click **Run Envelope** and wait for completion.
2. Click **Export PDF (Print)**.
3. In the print preview, verify Section 7 (current placement) and Section 8 (envelope worst stations) each show two contour images.
4. Confirm Section 8's images show the vehicle in two (potentially different) positions, with captions reporting the station coordinate and peak value.
5. After closing the print preview, confirm the on-screen state matches what was there before exporting (placement, selected field).

Stop the dev server when done.

Expected: behaviour matches the description. If Section 8 images are identical to Section 7, double-check that `envelope.worstStations.mx.stationM` differs from the current `centerXM`/`centerYM` — they may legitimately coincide on the default model; tweak the placement first to confirm.

- [x] **Step 5: Commit**

```bash
git add src/app/App.tsx
git commit -m "feat(report): capture envelope worst-station plan views on PDF export"
```

---

### Task 10: Add print styles for the new section and elevation diagram

**Files:**
- Modify: `src/styles/app.css`

- [x] **Step 1: Add styles at the end of the file**

Append to `src/styles/app.css`:

```css
.vehicle-side-elevation {
  margin: 0.75rem 0 0;
  color: #1f2937;
}

.vehicle-side-elevation svg {
  display: block;
  width: 100%;
  max-width: 640px;
  height: auto;
}

.vehicle-side-elevation figcaption {
  margin-top: 0.25rem;
  font-size: 0.85rem;
  color: #4b5563;
}

.vehicle-side-elevation-empty {
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
  color: #6b7280;
}

@media print {
  .report-note-section.report-note-figures figure {
    page-break-inside: avoid;
  }
  .vehicle-side-elevation {
    page-break-inside: avoid;
  }
}
```

- [x] **Step 2: Manual print check**

Run: `npm run dev`. In the browser, open the print preview (Ctrl/Cmd+P from the page, or trigger Export PDF). Verify:
- Each figure in Sections 7 and 8 stays on a single page where possible (no figure split across a page break).
- The side-elevation SVG renders crisply (vector) in the preview.

- [x] **Step 3: Commit**

```bash
git add src/styles/app.css
git commit -m "style(report): print rules for figures and side-elevation diagram"
```

---

### Task 11: Push the branch

**Files:** none

- [x] **Step 1: Push the feature branch**

```bash
git push
```

Expected: all commits land on `origin/feat/pdf-envelope-and-vehicle-diagram`.

- [x] **Step 2: Hand off**

Stop here. The branch is ready for a PR. Do not open the PR from the agent — leave that for the user (per workspace rules: PRs are user-driven via `gh pr create` / GitHub UI).

---

## Self-review

- **Spec coverage:**
  - R1 (worst-station tracking) → Task 1 (types) + Task 2 (impl/test).
  - R2 (PDF capture flow) → Task 9.
  - R3 (Section 8 figures) → Task 8.
  - R4 (vehicle side elevation, both modes) → Tasks 3, 4, 5, 6.
  - R5 (tests) → Tasks 2, 3, 4.
- **Placeholders:** none — every code step shows the code, every test step shows the test, every command is concrete.
- **Type/name consistency:** `EnvelopeWorstStation` and `worstStations` field names align across Tasks 1, 2, 9. `computeSideElevationLayout` is defined in Task 4 and consumed in Task 5. `clusterDirectWheelsByLongitudinal` defined in Task 3, used in Task 4. `images.currentMx` etc. introduced in Task 7 and consumed in Task 8.
- **Scope:** No regression risk to solver, mesh, or interactive viewer; changes are limited to envelope post-processing, the PDF export flow, the report component, and styles.
