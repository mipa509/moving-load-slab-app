# V5 WebGL Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SVG-based contour viewport with a three.js / React Three Fiber WebGL viewer that renders smooth per-vertex contours, supports Structure / Mesh / Results 2D / Deformed 3D view modes, zoom / pan / orbit, and hover probe inspection.

**Architecture:** A new `src/viewer/` module builds indexed-triangle `BufferGeometry` from solver mesh data, renders per-vertex-colored triangles inside an R3F `Canvas`, and switches between an orthographic camera (2D modes) and a perspective + orbit camera (Deformed 3D). DOM overlays — legend, toolbar, probe readout — dock outside the canvas. The nodal field averager (`recoverNodalFields`) is added to the solver post-processing path so the viewer always has one smooth value per node. Existing SVG rendering in `Viewport.tsx` is replaced in the final integration task.

**Tech Stack:** three.js 0.172+, @react-three/fiber 8+, @react-three/drei 9+, @types/three, React 18, TypeScript 5, vitest (math utilities only — R3F components are verified by `npm run build` and manual browser testing).

---

## File Map

### New files
| Path | Responsibility |
|---|---|
| `src/solver/post/recoverNodal.ts` | Average element-corner field values to one value per mesh node |
| `src/viewer/math/buildSurfaceGeometry.ts` | Build indexed Float32 positions + Uint32 indices from mesh topology |
| `src/viewer/math/interpolateField.ts` | Map nodal values through ContourScale to per-vertex Float32 RGB |
| `src/viewer/hooks/useViewerState.ts` | Probe hit and deform scale — view-only state not in SlabModel |
| `src/viewer/ViewerCanvas.tsx` | Top-level viewer: R3F Canvas + toolbar + legend + probe overlay |
| `src/viewer/ViewerToolbar.tsx` | Mode selector + layer toggle + deform scale slider (DOM) |
| `src/viewer/LegendDock.tsx` | Docked colour scale legend with ticks (DOM) |
| `src/viewer/scene/SlabScene.tsx` | Compose WebGL layers by plotMode; manage cameras |
| `src/viewer/scene/ResultSurface.tsx` | Per-vertex coloured triangle mesh; raycasting for probe |
| `src/viewer/scene/StructureOverlay.tsx` | Slab outline, support glyphs, wheel patch quads as line/point geometry |
| `src/viewer/scene/MeshOverlay.tsx` | Mesh wireframe as LineSegments |
| `src/viewer/scene/ExtremaMarkers.tsx` | Sphere glyphs at MIN / MAX nodal positions |

### Modified files
| Path | Change |
|---|---|
| `package.json` | Add three, @react-three/fiber, @react-three/drei, @types/three |
| `src/app/types.ts` | Add "deformed" to PlotMode; add NodalContourPoint, NodalContourData, MeshNodeOverlay, MeshElementOverlay, NodalDisplacementOverlay; extend AnalysisResults |
| `src/solver/index.ts` | Call recoverNodalFields; add nodalContours, meshNodes, meshElements, nodalDisplacements to SolverPayload |
| `src/app/solverAdapter.ts` | Normalize new solver payload fields |
| `src/app/defaults.ts` | Update isPlotMode guard; add new empty fields to idleResults() |
| `src/components/Viewport.tsx` | Replace SVG + floating legend with ViewerCanvas |
| `src/app/App.tsx` | Pass onModelChange to Viewport |
| `src/styles/app.css` | Add viewer-shell CSS classes |

### Test files (new)
| Path | What it tests |
|---|---|
| `src/tests/recoverNodal.test.ts` | Nodal averager — count, ids, uniform-deflection edge case |
| `src/tests/buildSurfaceGeometry.test.ts` | Triangle index count, position layout, z-displacement, deformScale |
| `src/tests/interpolateField.test.ts` | Float count, 0-1 range, uniform-value stability |

---

## Task 1: Install three.js dependencies

**Files:**
- Modify: `package.json`
- Create: `src/tests/threeSmoke.test.ts`

- [ ] **Step 1: Install packages**

```bash
npm install three @react-three/fiber @react-three/drei
npm install --save-dev @types/three
```

Expected: packages appear under `dependencies` in `package.json`; `node_modules/three` exists.

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: build exits 0 with no type errors.

- [ ] **Step 3: Write smoke test**

Create `src/tests/threeSmoke.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as Three from "three";

describe("three.js smoke", () => {
  it("can create a BufferGeometry", () => {
    const geo = new Three.BufferGeometry();
    expect(geo).toBeDefined();
    geo.dispose();
  });
});
```

- [ ] **Step 4: Run smoke test**

```bash
npm test -- src/tests/threeSmoke.test.ts
```

Expected: PASS 1 test.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/tests/threeSmoke.test.ts
git commit -m "feat: add three.js, @react-three/fiber, @react-three/drei"
```

---

## Task 2: Nodal field recovery

**Files:**
- Create: `src/solver/post/recoverNodal.ts`
- Create: `src/tests/recoverNodal.test.ts`

This upgrades field recovery from one value per element centre to one averaged value per mesh node, which is the prerequisite for smooth per-vertex WebGL contour interpolation.

- [ ] **Step 1: Write failing test**

Create `src/tests/recoverNodal.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { recoverNodalFields } from "../solver/post/recoverNodal";
import type { MaterialDefinition, StructuredMesh } from "../solver/model/types";

const MATERIAL: MaterialDefinition = { elasticModulusMPa: 30000, poissonRatio: 0.2 };
const THICKNESS = 0.25;

function singleElementMesh(): StructuredMesh {
  return {
    xCoords: [0, 1],
    yCoords: [0, 1],
    nodes: [
      { id: 0, x: 0, y: 0 },
      { id: 1, x: 1, y: 0 },
      { id: 2, x: 1, y: 1 },
      { id: 3, x: 0, y: 1 },
    ],
    elements: [
      {
        id: 0,
        nodeIds: [0, 1, 2, 3],
        bounds: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
      },
    ],
    nodeIdsByIJ: [[0, 3], [1, 2]],
    elementCountX: 1,
    elementCountY: 1,
  };
}

function uniformDeflectionDisp(wM: number): Float64Array {
  // 4 nodes × 3 DOFs = 12; DOF order per node: w, rx, ry
  const d = new Float64Array(12);
  for (let i = 0; i < 4; i++) d[i * 3] = wM;
  return d;
}

describe("recoverNodalFields", () => {
  it("returns one entry per mesh node", () => {
    const mesh = singleElementMesh();
    const result = recoverNodalFields(mesh, MATERIAL, THICKNESS, uniformDeflectionDisp(0.001));
    expect(result).toHaveLength(4);
  });

  it("node ids match the mesh node ids", () => {
    const mesh = singleElementMesh();
    const result = recoverNodalFields(mesh, MATERIAL, THICKNESS, uniformDeflectionDisp(0.001));
    const ids = result.map((n) => n.nodeId).sort((a, b) => a - b);
    expect(ids).toEqual([0, 1, 2, 3]);
  });

  it("coordinates match the mesh nodes", () => {
    const mesh = singleElementMesh();
    const result = recoverNodalFields(mesh, MATERIAL, THICKNESS, uniformDeflectionDisp(0.001));
    const node0 = result.find((n) => n.nodeId === 0)!;
    expect(node0.x).toBeCloseTo(0);
    expect(node0.y).toBeCloseTo(0);
  });

  it("uniform deflection gives equal deflection at every node", () => {
    const mesh = singleElementMesh();
    const result = recoverNodalFields(mesh, MATERIAL, THICKNESS, uniformDeflectionDisp(0.001));
    for (const node of result) {
      expect(node.deflection).toBeCloseTo(0.001, 8);
    }
  });

  it("uniform deflection gives near-zero moments and shears", () => {
    const mesh = singleElementMesh();
    const result = recoverNodalFields(mesh, MATERIAL, THICKNESS, uniformDeflectionDisp(0.001));
    for (const node of result) {
      expect(Math.abs(node.mx)).toBeLessThan(1e-6);
      expect(Math.abs(node.my)).toBeLessThan(1e-6);
      expect(Math.abs(node.qx)).toBeLessThan(1e-6);
      expect(Math.abs(node.qy)).toBeLessThan(1e-6);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/tests/recoverNodal.test.ts
```

Expected: FAIL — `Cannot find module '../solver/post/recoverNodal'`.

- [ ] **Step 3: Implement recoverNodal**

Create `src/solver/post/recoverNodal.ts`:

```typescript
import { computeMindlinConstitutive, evaluateMindlinQ4At } from "../core/element";
import type { MaterialDefinition, MeshElement, MeshNode, StructuredMesh } from "../model/types";

export interface NodalFieldValues {
  nodeId: number;
  x: number;
  y: number;
  deflection: number;
  mx: number;
  my: number;
  qx: number;
  qy: number;
}

// Local corner coordinates for Q4 nodes 0-3 (bottom-left, bottom-right, top-right, top-left)
const CORNER_COORDS: [number, number][] = [
  [-1, -1],
  [+1, -1],
  [+1, +1],
  [-1, +1],
];

export function recoverNodalFields(
  mesh: StructuredMesh,
  material: MaterialDefinition,
  thickness: number,
  fullDisplacements: Float64Array,
): NodalFieldValues[] {
  const constitutive = computeMindlinConstitutive(material, thickness);
  const n = mesh.nodes.length;
  const sumW = new Float64Array(n);
  const sumMx = new Float64Array(n);
  const sumMy = new Float64Array(n);
  const sumQx = new Float64Array(n);
  const sumQy = new Float64Array(n);
  const cnt = new Int32Array(n);

  for (const element of mesh.elements) {
    const elementNodes = element.nodeIds.map((id) => mesh.nodes[id]) as [
      MeshNode, MeshNode, MeshNode, MeshNode,
    ];
    const ed = gatherElementDisp(element, fullDisplacements);

    for (let c = 0; c < 4; c++) {
      const nodeId = element.nodeIds[c];
      const [xi, eta] = CORNER_COORDS[c];
      const ev = evaluateMindlinQ4At(elementNodes, ed, xi, eta);

      const { db, ds } = constitutive;
      const [k0, k1, k2] = ev.curvatures;
      const [s0, s1] = ev.shears;

      // At a corner, the shape function for that corner is 1 and others are 0,
      // so deflection = elementDisp[c*3] exactly.
      sumW[nodeId] += ed[c * 3];
      sumMx[nodeId] += db[0] * k0 + db[1] * k1 + db[2] * k2;
      sumMy[nodeId] += db[3] * k0 + db[4] * k1 + db[5] * k2;
      sumQx[nodeId] += ds[0] * s0 + ds[1] * s1;
      sumQy[nodeId] += ds[2] * s0 + ds[3] * s1;
      cnt[nodeId] += 1;
    }
  }

  return mesh.nodes.map((node) => {
    const c = Math.max(cnt[node.id], 1);
    return {
      nodeId: node.id,
      x: node.x,
      y: node.y,
      deflection: sumW[node.id] / c,
      mx: sumMx[node.id] / c,
      my: sumMy[node.id] / c,
      qx: sumQx[node.id] / c,
      qy: sumQy[node.id] / c,
    };
  });
}

function gatherElementDisp(element: MeshElement, full: Float64Array): Float64Array {
  const ed = new Float64Array(12);
  for (let i = 0; i < 4; i++) {
    const base = element.nodeIds[i] * 3;
    ed[i * 3] = full[base];
    ed[i * 3 + 1] = full[base + 1];
    ed[i * 3 + 2] = full[base + 2];
  }
  return ed;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/tests/recoverNodal.test.ts
```

Expected: PASS 5 tests.

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/solver/post/recoverNodal.ts src/tests/recoverNodal.test.ts
git commit -m "feat: add nodal field recovery by element-corner averaging"
```

---

## Task 3: Surface geometry + vertex colour math

**Files:**
- Create: `src/viewer/math/buildSurfaceGeometry.ts`
- Create: `src/viewer/math/interpolateField.ts`
- Create: `src/tests/buildSurfaceGeometry.test.ts`
- Create: `src/tests/interpolateField.test.ts`

These pure math utilities are the foundation of the WebGL renderer and are independently testable without browser APIs or React.

- [ ] **Step 1: Write failing geometry tests**

Create `src/tests/buildSurfaceGeometry.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildSurfaceGeometry } from "../viewer/math/buildSurfaceGeometry";
import type { MeshTopology } from "../viewer/math/buildSurfaceGeometry";

function singleQuad(): MeshTopology {
  return {
    nodes: [
      { id: 0, x: 0, y: 0 },
      { id: 1, x: 1, y: 0 },
      { id: 2, x: 1, y: 1 },
      { id: 3, x: 0, y: 1 },
    ],
    elements: [{ id: 0, nodeIds: [0, 1, 2, 3] }],
  };
}

describe("buildSurfaceGeometry", () => {
  it("produces 3 position floats per node", () => {
    const { positions } = buildSurfaceGeometry(singleQuad());
    expect(positions.length).toBe(4 * 3);
  });

  it("node coordinates appear at correct offsets (z=0 default)", () => {
    const { positions } = buildSurfaceGeometry(singleQuad());
    expect(positions[0]).toBeCloseTo(0); // node0 x
    expect(positions[1]).toBeCloseTo(0); // node0 y
    expect(positions[2]).toBeCloseTo(0); // node0 z
    expect(positions[3]).toBeCloseTo(1); // node1 x
    expect(positions[4]).toBeCloseTo(0); // node1 y
  });

  it("produces 6 indices per element (2 triangles per quad)", () => {
    const { indices } = buildSurfaceGeometry(singleQuad());
    expect(indices.length).toBe(6);
  });

  it("all indices reference valid node positions", () => {
    const { indices } = buildSurfaceGeometry(singleQuad());
    for (const idx of indices) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(4);
    }
  });

  it("applies z-displacement when provided", () => {
    const zDisplacements = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const { positions } = buildSurfaceGeometry(singleQuad(), { zDisplacements, deformScale: 1 });
    expect(positions[2]).toBeCloseTo(0.1); // node0 z
    expect(positions[5]).toBeCloseTo(0.2); // node1 z
  });

  it("deformScale multiplies z-displacement", () => {
    const zDisplacements = new Float32Array([0.1, 0, 0, 0]);
    const { positions } = buildSurfaceGeometry(singleQuad(), { zDisplacements, deformScale: 10 });
    expect(positions[2]).toBeCloseTo(1.0);
  });

  it("scales to a 2-element mesh", () => {
    const mesh: MeshTopology = {
      nodes: [
        { id: 0, x: 0, y: 0 }, { id: 1, x: 1, y: 0 }, { id: 2, x: 2, y: 0 },
        { id: 3, x: 0, y: 1 }, { id: 4, x: 1, y: 1 }, { id: 5, x: 2, y: 1 },
      ],
      elements: [
        { id: 0, nodeIds: [0, 1, 4, 3] },
        { id: 1, nodeIds: [1, 2, 5, 4] },
      ],
    };
    const { positions, indices } = buildSurfaceGeometry(mesh);
    expect(positions.length).toBe(6 * 3);
    expect(indices.length).toBe(2 * 6);
  });
});
```

- [ ] **Step 2: Write failing colour tests**

Create `src/tests/interpolateField.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildVertexColors } from "../viewer/math/interpolateField";
import { createContourScale } from "../app/contourScale";

describe("buildVertexColors", () => {
  it("returns 3 floats per value entry", () => {
    const scale = createContourScale(0, 1);
    const colors = buildVertexColors(new Float32Array([0, 0.5, 1]), scale);
    expect(colors.length).toBe(9);
  });

  it("all color components are in the 0-1 range", () => {
    const scale = createContourScale(-10, 10);
    const colors = buildVertexColors(new Float32Array([-10, 0, 10]), scale);
    for (const c of colors) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1.001);
    }
  });

  it("uniform values produce identical colours at every vertex", () => {
    const scale = createContourScale(5, 5);
    const colors = buildVertexColors(new Float32Array([5, 5, 5]), scale);
    expect(colors[0]).toBeCloseTo(colors[3], 4);
    expect(colors[1]).toBeCloseTo(colors[4], 4);
    expect(colors[2]).toBeCloseTo(colors[5], 4);
  });
});
```

- [ ] **Step 3: Run failing tests**

```bash
npm test -- src/tests/buildSurfaceGeometry.test.ts src/tests/interpolateField.test.ts
```

Expected: FAIL — cannot find modules.

- [ ] **Step 4: Implement buildSurfaceGeometry**

Create `src/viewer/math/buildSurfaceGeometry.ts`:

```typescript
export interface MeshTopology {
  nodes: { id: number; x: number; y: number }[];
  elements: { id: number; nodeIds: [number, number, number, number] }[];
}

export interface SurfaceGeometryOptions {
  zDisplacements?: Float32Array;
  deformScale?: number;
}

export interface SurfaceGeometryResult {
  positions: Float32Array;
  indices: Uint32Array;
}

export function buildSurfaceGeometry(
  mesh: MeshTopology,
  options: SurfaceGeometryOptions = {},
): SurfaceGeometryResult {
  const { zDisplacements, deformScale = 1 } = options;
  const nodeCount = mesh.nodes.length;
  const elementCount = mesh.elements.length;

  const positions = new Float32Array(nodeCount * 3);
  for (const node of mesh.nodes) {
    const base = node.id * 3;
    positions[base] = node.x;
    positions[base + 1] = node.y;
    positions[base + 2] = zDisplacements ? zDisplacements[node.id] * deformScale : 0;
  }

  const indices = new Uint32Array(elementCount * 6);
  for (let e = 0; e < elementCount; e++) {
    const { nodeIds } = mesh.elements[e];
    const base = e * 6;
    // Triangle 1: nodes 0, 1, 2
    indices[base] = nodeIds[0];
    indices[base + 1] = nodeIds[1];
    indices[base + 2] = nodeIds[2];
    // Triangle 2: nodes 0, 2, 3
    indices[base + 3] = nodeIds[0];
    indices[base + 4] = nodeIds[2];
    indices[base + 5] = nodeIds[3];
  }

  return { positions, indices };
}
```

- [ ] **Step 5: Implement interpolateField**

Create `src/viewer/math/interpolateField.ts`:

```typescript
import type { ContourScale } from "../../app/contourScale";

export function buildVertexColors(
  nodalValues: Float32Array,
  scale: ContourScale,
): Float32Array {
  const colors = new Float32Array(nodalValues.length * 3);
  for (let i = 0; i < nodalValues.length; i++) {
    const css = scale.getColor(nodalValues[i]);
    const [r, g, b] = parseCssColor(css);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  return colors;
}

// Handles "rgb(r, g, b)" (returned by interpolateColor) and "#rrggbb" (hex stops)
function parseCssColor(css: string): [number, number, number] {
  if (css.startsWith("rgb")) {
    const m = css.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (m) {
      return [
        parseInt(m[1], 10) / 255,
        parseInt(m[2], 10) / 255,
        parseInt(m[3], 10) / 255,
      ];
    }
  }
  if (css.startsWith("#")) {
    const h = css.slice(1);
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    ];
  }
  return [0.5, 0.5, 0.5];
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- src/tests/buildSurfaceGeometry.test.ts src/tests/interpolateField.test.ts
```

Expected: PASS all tests.

- [ ] **Step 7: Commit**

```bash
git add src/viewer/math/buildSurfaceGeometry.ts src/viewer/math/interpolateField.ts \
        src/tests/buildSurfaceGeometry.test.ts src/tests/interpolateField.test.ts
git commit -m "feat: add surface geometry builder and vertex colour interpolation"
```

---

## Task 4: Types + solver payload + adapter upgrade

**Files:**
- Modify: `src/app/types.ts`
- Modify: `src/app/defaults.ts`
- Modify: `src/solver/index.ts`
- Modify: `src/app/solverAdapter.ts`

This wires nodal recovery into the solver pipeline so `AnalysisResults` carries the data the WebGL viewer needs.

- [ ] **Step 1: Update src/app/types.ts**

Make the following edits to `src/app/types.ts`:

**1a. Extend PlotMode:**
```typescript
// Before:
export type PlotMode = "results" | "structure" | "mesh";

// After:
export type PlotMode = "results" | "structure" | "mesh" | "deformed";
```

**1b. Add nodal + mesh overlay types after the `ContourData` interface:**
```typescript
export interface NodalContourPoint {
  nodeId: number;
  xM: number;
  yM: number;
  value: number;
}

export interface NodalContourData {
  field: Exclude<ResultField, "reactions">;
  points: NodalContourPoint[];
  min: number;
  max: number;
  units: string;
}

export interface MeshNodeOverlay {
  id: number;
  xM: number;
  yM: number;
}

export interface MeshElementOverlay {
  id: number;
  nodeIds: [number, number, number, number];
}

export interface NodalDisplacementOverlay {
  nodeId: number;
  wM: number;
}
```

**1c. Add new fields to AnalysisResults:**
```typescript
export interface AnalysisResults {
  status: "idle" | "running" | "success" | "error";
  source: "solver";
  contours: Partial<Record<Exclude<ResultField, "reactions">, ContourData>>;
  nodalContours: Partial<Record<Exclude<ResultField, "reactions">, NodalContourData>>;
  meshNodes: MeshNodeOverlay[];
  meshElements: MeshElementOverlay[];
  nodalDisplacements: NodalDisplacementOverlay[];
  mesh?: MeshOverlay;
  wheelPatches?: RectOverlay[];
  reactions: ReactionRow[];
  reactionSummaryBySupport: ReactionSummaryRow[];
  reactionTotals: ReactionComponentTotals;
  summary: AnalysisSummary;
  elapsedMs: number;
  warning?: string;
  error?: string;
}
```

- [ ] **Step 2: Update src/app/defaults.ts**

**2a. Fix isPlotMode guard:**
```typescript
// Before:
const isPlotMode = (input: unknown): input is DisplayToggles["plotMode"] =>
  input === "results" || input === "structure" || input === "mesh";

// After:
const isPlotMode = (input: unknown): input is DisplayToggles["plotMode"] =>
  input === "results" || input === "structure" || input === "mesh" || input === "deformed";
```

**2b. Add new fields to idleResults():**
```typescript
export const idleResults = (): AnalysisResults => ({
  status: "idle",
  source: "solver",
  contours: {},
  nodalContours: {},
  meshNodes: [],
  meshElements: [],
  nodalDisplacements: [],
  mesh: undefined,
  wheelPatches: [],
  reactions: [],
  reactionSummaryBySupport: [],
  reactionTotals: { uz: 0, rx: 0, ry: 0 },
  summary: { maxDeflectionMm: 0, maxAbsMomentKnmPerM: 0, maxAbsShearKnPerM: 0 },
  elapsedMs: 0,
});
```

- [ ] **Step 3: Update src/solver/index.ts**

Add the import at the top:
```typescript
import { recoverNodalFields } from "./post/recoverNodal";
import type {
  ContourData,
  NodalContourData,
  RectOverlay,
  SlabModel,
} from "../app/types";
```

Update `SolverPayload` type:
```typescript
type SolverPayload = {
  contours: Record<string, ContourData>;
  nodalContours: Record<string, NodalContourData>;
  mesh: { xCoordsM: number[]; yCoordsM: number[] };
  meshNodes: { id: number; xM: number; yM: number }[];
  meshElements: { id: number; nodeIds: [number, number, number, number] }[];
  nodalDisplacements: { nodeId: number; wM: number }[];
  wheelPatches: RectOverlay[];
  reactions: {
    supportId: string;
    nodeId: number;
    dof: "uz" | "rx" | "ry";
    type: "fixed" | "spring";
    value: number;
    units: string;
  }[];
  summary: {
    maxDeflectionMm: number;
    maxAbsMomentKnmPerM: number;
    maxAbsShearKnPerM: number;
  };
  warning?: string;
};
```

Update `runFixedPositionAnalysis` to call nodal recovery and include new fields:
```typescript
export function runFixedPositionAnalysis(model: SlabModel): SolverPayload {
  const internalModel = fromAppModel(model);
  const result = runInternalFixedPositionAnalysis(internalModel);

  // Reconstruct the full global displacement vector from per-node data
  const nodeCount = result.mesh.nodes.length;
  const fullDisp = new Float64Array(nodeCount * 3);
  for (const nd of result.nodalDisplacements) {
    fullDisp[nd.nodeId * 3] = nd.w;
    fullDisp[nd.nodeId * 3 + 1] = nd.rx;
    fullDisp[nd.nodeId * 3 + 2] = nd.ry;
  }

  const nodalFields = recoverNodalFields(
    result.mesh,
    internalModel.material,
    internalModel.slab.thickness,
    fullDisp,
  );

  const nodalContours: Record<string, NodalContourData> = {
    deflection: toNodalContour("deflection", nodalFields, (n) => n.deflection * 1000, "mm"),
    mx: toNodalContour("mx", nodalFields, (n) => n.mx, "kN*m/m"),
    my: toNodalContour("my", nodalFields, (n) => n.my, "kN*m/m"),
    qx: toNodalContour("qx", nodalFields, (n) => n.qx, "kN/m"),
    qy: toNodalContour("qy", nodalFields, (n) => n.qy, "kN/m"),
  };

  return {
    contours: {
      deflection: toContour("deflection", result, (item) => item.deflection * 1000, "mm"),
      mx: toContour("mx", result, (item) => item.moments.mx, "kN*m/m"),
      my: toContour("my", result, (item) => item.moments.my, "kN*m/m"),
      qx: toContour("qx", result, (item) => item.shears.qx, "kN/m"),
      qy: toContour("qy", result, (item) => item.shears.qy, "kN/m"),
    },
    nodalContours,
    mesh: {
      xCoordsM: result.mesh.xCoords,
      yCoordsM: result.mesh.yCoords,
    },
    meshNodes: result.mesh.nodes.map((n) => ({ id: n.id, xM: n.x, yM: n.y })),
    meshElements: result.mesh.elements.map((e) => ({
      id: e.id,
      nodeIds: e.nodeIds,
    })),
    nodalDisplacements: result.nodalDisplacements.map((nd) => ({
      nodeId: nd.nodeId,
      wM: nd.w,
    })),
    wheelPatches: result.wheelPatches
      .filter((patch) => patch.clippedBounds)
      .map((patch) => ({
        xMinM: patch.originalBounds.xMin,
        xMaxM: patch.originalBounds.xMax,
        yMinM: patch.originalBounds.yMin,
        yMaxM: patch.originalBounds.yMax,
      })),
    reactions: result.supportReactions.map((reaction) => ({
      supportId: reaction.supportId,
      nodeId: reaction.nodeId,
      dof: reaction.dof === "w" ? "uz" : reaction.dof,
      type: reaction.type,
      value: reaction.value,
      units: reaction.dof === "w" ? "kN" : "kN*m",
    })),
    summary: {
      maxDeflectionMm:
        Math.max(Math.abs(result.summary.minDeflection), Math.abs(result.summary.maxDeflection)) * 1000,
      maxAbsMomentKnmPerM: Math.max(result.summary.maxAbsMomentX, result.summary.maxAbsMomentY),
      maxAbsShearKnPerM: Math.max(result.summary.maxAbsShearX, result.summary.maxAbsShearY),
    },
    warning: result.warnings.length > 0 ? result.warnings.join(" ") : undefined,
  };
}
```

Add the `toNodalContour` helper after `toContour`:
```typescript
import type { NodalFieldValues } from "./post/recoverNodal";

function toNodalContour(
  field: NodalContourData["field"],
  nodes: NodalFieldValues[],
  pick: (node: NodalFieldValues) => number,
  units: string,
): NodalContourData {
  const points = nodes.map((node) => ({
    nodeId: node.nodeId,
    xM: node.x,
    yM: node.y,
    value: pick(node),
  }));
  return {
    field,
    points,
    min: Math.min(...points.map((p) => p.value)),
    max: Math.max(...points.map((p) => p.value)),
    units,
  };
}
```

- [ ] **Step 4: Update src/app/solverAdapter.ts**

Extend `runFixedAnalysis` to pass through the new fields in both the success and error return values.

In the success return object, add:
```typescript
nodalContours: normalizeNodalContours(payload.nodalContours),
meshNodes: Array.isArray(payload.meshNodes)
  ? payload.meshNodes.map((n) => ({
      id: toNumber((n as { id?: unknown }).id),
      xM: toNumber((n as { xM?: unknown }).xM),
      yM: toNumber((n as { yM?: unknown }).yM),
    }))
  : [],
meshElements: Array.isArray(payload.meshElements)
  ? payload.meshElements.map((e) => ({
      id: toNumber((e as { id?: unknown }).id),
      nodeIds: Array.isArray((e as { nodeIds?: unknown }).nodeIds)
        ? ((e as { nodeIds: unknown[] }).nodeIds.map((v) => toNumber(v)) as [number, number, number, number])
        : [0, 0, 0, 0],
    }))
  : [],
nodalDisplacements: Array.isArray(payload.nodalDisplacements)
  ? payload.nodalDisplacements.map((nd) => ({
      nodeId: toNumber((nd as { nodeId?: unknown }).nodeId),
      wM: toNumber((nd as { wM?: unknown }).wM),
    }))
  : [],
```

In the error return object, add:
```typescript
nodalContours: {},
meshNodes: [],
meshElements: [],
nodalDisplacements: [],
```

Add a `normalizeNodalContours` helper:
```typescript
const normalizeNodalContours = (
  rawContours: unknown,
): AnalysisResults["nodalContours"] => {
  if (!rawContours || typeof rawContours !== "object") return {};
  const asRecord = rawContours as Record<string, unknown>;
  const result: AnalysisResults["nodalContours"] = {};

  contourFields.forEach((field) => {
    const rawField = asRecord[field];
    if (!rawField || typeof rawField !== "object") return;
    const obj = rawField as Partial<NodalContourData>;
    if (!Array.isArray(obj.points)) return;
    const points = obj.points.map((p) => ({
      nodeId: toNumber((p as { nodeId?: unknown }).nodeId),
      xM: toNumber((p as { xM?: unknown }).xM),
      yM: toNumber((p as { yM?: unknown }).yM),
      value: toNumber((p as { value?: unknown }).value),
    }));
    result[field] = {
      field,
      points,
      min: toNumber(obj.min, Math.min(...points.map((p) => p.value), 0)),
      max: toNumber(obj.max, Math.max(...points.map((p) => p.value), 0)),
      units: typeof obj.units === "string" ? obj.units : defaultUnits[field],
    };
  });

  return result;
};
```

Add the import at the top of solverAdapter.ts:
```typescript
import type { NodalContourData } from "./types";
```

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all existing tests PASS. TypeScript must compile cleanly (type errors would surface here).

- [ ] **Step 6: Verify build**

```bash
npm run build
```

Expected: build exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/app/types.ts src/app/defaults.ts src/solver/index.ts src/app/solverAdapter.ts
git commit -m "feat: add nodal contours, mesh topology, and nodal displacements to analysis results"
```

---

## Task 5: Viewer state hook

**Files:**
- Create: `src/viewer/hooks/useViewerState.ts`

- [ ] **Step 1: Create the hook**

Create `src/viewer/hooks/useViewerState.ts`:

```typescript
import { useState } from "react";

export interface ProbeHit {
  x: number;
  y: number;
  value: number;
}

export interface ViewerState {
  deformScale: number;
  setDeformScale: (scale: number) => void;
  probeHit: ProbeHit | null;
  setProbeHit: (hit: ProbeHit | null) => void;
}

export function useViewerState(): ViewerState {
  const [deformScale, setDeformScale] = useState(30);
  const [probeHit, setProbeHit] = useState<ProbeHit | null>(null);
  return { deformScale, setDeformScale, probeHit, setProbeHit };
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/viewer/hooks/useViewerState.ts
git commit -m "feat: add viewer state hook (probe hit, deform scale)"
```

---

## Task 6: WebGL viewer shell

**Files:**
- Create: `src/viewer/scene/SlabScene.tsx`
- Create: `src/viewer/ViewerCanvas.tsx`

This creates the structural skeleton of the viewer — an R3F Canvas with camera management and a scene root that conditionally mounts layers. No layers are implemented yet; `SlabScene` renders a placeholder.

- [ ] **Step 1: Create SlabScene**

Create `src/viewer/scene/SlabScene.tsx`:

```typescript
import {
  MapControls,
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
} from "@react-three/drei";
import type { ContourScale } from "../../app/contourScale";
import type { AnalysisResults, ResultField, SlabModel } from "../../app/types";
import type { ProbeHit } from "../hooks/useViewerState";

interface SlabSceneProps {
  model: SlabModel;
  results: AnalysisResults;
  selectedField: ResultField;
  contourScale: ContourScale | null;
  deformScale: number;
  onProbeHit: (hit: ProbeHit | null) => void;
}

export const SlabScene = ({
  model,
  results,
  selectedField,
  contourScale,
  deformScale,
  onProbeHit,
}: SlabSceneProps) => {
  const { plotMode } = model.display;
  const Lx = model.geometry.lengthM;
  const Ly = model.geometry.widthM;
  const cx = Lx / 2;
  const cy = Ly / 2;
  const maxDim = Math.max(Lx, Ly);
  const is3D = plotMode === "deformed";

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[Lx, Ly, maxDim]} intensity={0.6} />

      {is3D ? (
        <>
          <PerspectiveCamera
            makeDefault
            position={[cx, cy - maxDim * 0.7, maxDim * 0.6]}
            fov={50}
          />
          <OrbitControls target={[cx, cy, 0]} />
        </>
      ) : (
        <>
          <OrthographicCamera
            makeDefault
            position={[cx, cy, 100]}
            zoom={Math.min(580 / Lx, 380 / Ly)}
            near={-200}
            far={200}
          />
          <MapControls screenSpacePanning />
        </>
      )}

      {/* Layers mounted in subsequent tasks */}
    </>
  );
};
```

- [ ] **Step 2: Create ViewerCanvas**

Create `src/viewer/ViewerCanvas.tsx`:

```typescript
import { Canvas } from "@react-three/fiber";
import { createContourScale } from "../app/contourScale";
import type { AnalysisResults, ResultField, SlabModel } from "../app/types";
import { useViewerState } from "./hooks/useViewerState";
import { SlabScene } from "./scene/SlabScene";

interface ViewerCanvasProps {
  model: SlabModel;
  results: AnalysisResults;
  selectedField: ResultField;
  onModelChange: (model: SlabModel) => void;
}

export const ViewerCanvas = ({
  model,
  results,
  selectedField,
  onModelChange,
}: ViewerCanvasProps) => {
  const { deformScale, setDeformScale, probeHit, setProbeHit } = useViewerState();
  const contour =
    selectedField === "reactions" ? undefined : results.nodalContours[selectedField];
  const contourScale = contour ? createContourScale(contour.min, contour.max) : null;

  return (
    <div className="viewer-shell">
      <div className="viewer-canvas-wrap">
        <Canvas style={{ background: "#1b2027" }}>
          <SlabScene
            model={model}
            results={results}
            selectedField={selectedField}
            contourScale={contourScale}
            deformScale={deformScale}
            onProbeHit={setProbeHit}
          />
        </Canvas>
        {probeHit && contour && (
          <div className="viewer-probe-overlay">
            x {probeHit.x.toFixed(2)} m, y {probeHit.y.toFixed(2)} m —{" "}
            {probeHit.value.toFixed(4)} {contour.units}
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build exits 0. React Three Fiber requires a browser-compatible environment, so tests won't cover these components — build is the verification.

- [ ] **Step 4: Commit**

```bash
git add src/viewer/scene/SlabScene.tsx src/viewer/ViewerCanvas.tsx
git commit -m "feat: add R3F viewer shell with camera management"
```

---

## Task 7: Results 2D — smooth contour surface

**Files:**
- Create: `src/viewer/scene/ResultSurface.tsx`
- Modify: `src/viewer/scene/SlabScene.tsx`

Renders the slab as a triangle mesh with per-vertex colour interpolation from the nodal contour data.

- [ ] **Step 1: Create ResultSurface**

Create `src/viewer/scene/ResultSurface.tsx`:

```typescript
import { useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import { buildSurfaceGeometry } from "../math/buildSurfaceGeometry";
import { buildVertexColors } from "../math/interpolateField";
import type { ContourScale } from "../../app/contourScale";
import type { AnalysisResults, ResultField } from "../../app/types";
import type { ProbeHit } from "../hooks/useViewerState";

interface ResultSurfaceProps {
  results: AnalysisResults;
  selectedField: ResultField;
  contourScale: ContourScale;
  deformScale: number;
  onProbeHit: (hit: ProbeHit | null) => void;
}

export const ResultSurface = ({
  results,
  selectedField,
  contourScale,
  deformScale,
  onProbeHit,
}: ResultSurfaceProps) => {
  const nodalContour =
    selectedField !== "reactions" ? results.nodalContours[selectedField] : undefined;

  const geometry = useMemo(() => {
    if (!nodalContour || results.meshElements.length === 0) {
      return new BufferGeometry();
    }

    const nodeCount = results.meshNodes.length;
    const vals = new Float32Array(nodeCount);
    for (const pt of nodalContour.points) {
      vals[pt.nodeId] = pt.value;
    }

    const zDisplacements =
      deformScale > 0 && results.nodalDisplacements.length > 0
        ? (() => {
            const zd = new Float32Array(nodeCount);
            for (const nd of results.nodalDisplacements) {
              zd[nd.nodeId] = nd.wM;
            }
            return zd;
          })()
        : undefined;

    const topology = {
      nodes: results.meshNodes.map((n) => ({ id: n.id, x: n.xM, y: n.yM })),
      elements: results.meshElements.map((e) => ({ id: e.id, nodeIds: e.nodeIds })),
    };

    const { positions, indices } = buildSurfaceGeometry(topology, {
      zDisplacements,
      deformScale,
    });
    const colors = buildVertexColors(vals, contourScale);

    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    geo.setAttribute("color", new BufferAttribute(colors, 3));
    geo.setIndex(new BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [nodalContour, results.meshNodes, results.meshElements, results.nodalDisplacements, contourScale, deformScale]);

  return (
    <mesh
      geometry={geometry}
      onPointerMove={(e) => {
        onProbeHit({
          x: e.point.x,
          y: e.point.y,
          value: nearestNodeValue(
            e.point.x,
            e.point.y,
            results.meshNodes,
            nodalContour?.points ?? [],
          ),
        });
      }}
      onPointerLeave={() => onProbeHit(null)}
    >
      <meshBasicMaterial vertexColors side={2} />
    </mesh>
  );
};

function nearestNodeValue(
  x: number,
  y: number,
  nodes: { id: number; xM: number; yM: number }[],
  points: { nodeId: number; value: number }[],
): number {
  if (points.length === 0) return 0;
  const valueByNode = new Map(points.map((p) => [p.nodeId, p.value]));
  let best = Infinity;
  let val = 0;
  for (const node of nodes) {
    const d2 = (node.xM - x) ** 2 + (node.yM - y) ** 2;
    if (d2 < best) {
      best = d2;
      val = valueByNode.get(node.id) ?? 0;
    }
  }
  return val;
}
```

- [ ] **Step 2: Mount ResultSurface in SlabScene**

In `src/viewer/scene/SlabScene.tsx`, add the import and mount the layer:

```typescript
import { ResultSurface } from "./ResultSurface";
```

Inside the JSX, after the lights and camera setup, add:

```typescript
{(plotMode === "results" || plotMode === "deformed") &&
  contourScale !== null &&
  results.meshElements.length > 0 && (
    <ResultSurface
      results={results}
      selectedField={selectedField}
      contourScale={contourScale}
      deformScale={plotMode === "deformed" ? deformScale : 0}
      onProbeHit={onProbeHit}
    />
  )}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build exits 0.

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

Open the app in a browser. After analysis completes, the viewport should show a smooth colour gradient over the slab instead of flat rectangles. Verify colours change as you switch between result fields.

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/viewer/scene/ResultSurface.tsx src/viewer/scene/SlabScene.tsx
git commit -m "feat: add smooth contour result surface (Results 2D mode)"
```

---

## Task 8: Structure and Mesh overlay layers

**Files:**
- Create: `src/viewer/scene/StructureOverlay.tsx`
- Create: `src/viewer/scene/MeshOverlay.tsx`
- Modify: `src/viewer/scene/SlabScene.tsx`

- [ ] **Step 1: Create StructureOverlay**

Create `src/viewer/scene/StructureOverlay.tsx`:

```typescript
import { useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import type { AnalysisResults, SlabModel } from "../../app/types";

interface StructureOverlayProps {
  model: SlabModel;
  results: AnalysisResults;
}

export const StructureOverlay = ({ model, results }: StructureOverlayProps) => {
  const Lx = model.geometry.lengthM;
  const Ly = model.geometry.widthM;

  // Slab boundary as a closed rectangle (5 points including closing point)
  const boundaryVerts = useMemo(() => {
    return new Float32Array([
      0, 0, 0.01,
      Lx, 0, 0.01,
      Lx, Ly, 0.01,
      0, Ly, 0.01,
      0, 0, 0.01,
    ]);
  }, [Lx, Ly]);

  const boundaryGeo = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(boundaryVerts, 3));
    return geo;
  }, [boundaryVerts]);

  return (
    <>
      {/* Slab outline */}
      <line_ geometry={boundaryGeo}>
        <lineBasicMaterial color="#e0e6ef" linewidth={1.5} />
      </line_>

      {/* Support lines */}
      {model.supports.map((support) => {
        if (support.kind === "line") {
          const verts = new Float32Array([
            support.x1, support.y1, 0.02,
            support.x2, support.y2, 0.02,
          ]);
          const geo = new BufferGeometry();
          geo.setAttribute("position", new BufferAttribute(verts, 3));
          return (
            <line_ key={support.id} geometry={geo}>
              <lineBasicMaterial color="#4fc3f7" linewidth={2} />
            </line_>
          );
        }
        return null;
      })}

      {/* Support points */}
      {model.supports.filter((s) => s.kind === "point").map((support) => {
        if (support.kind !== "point") return null;
        return (
          <mesh key={support.id} position={[support.x, support.y, 0.02]}>
            <sphereGeometry args={[Math.max(Lx, Ly) * 0.012, 12, 12]} />
            <meshBasicMaterial color="#4fc3f7" />
          </mesh>
        );
      })}

      {/* Wheel patches */}
      {(results.wheelPatches ?? []).map((patch, i) => {
        const w = patch.xMaxM - patch.xMinM;
        const h = patch.yMaxM - patch.yMinM;
        return (
          <mesh
            key={`wp-${i}`}
            position={[patch.xMinM + w / 2, patch.yMinM + h / 2, 0.02]}
          >
            <planeGeometry args={[w, h]} />
            <meshBasicMaterial color="#ffb300" transparent opacity={0.55} />
          </mesh>
        );
      })}
    </>
  );
};
```

> **Note:** `line_` is the lowercase intrinsic element for `THREE.Line` in R3F. Use `<line_ ...>` (underscore suffix avoids collision with the HTML `<line>` element).

- [ ] **Step 2: Create MeshOverlay**

Create `src/viewer/scene/MeshOverlay.tsx`:

```typescript
import { useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import type { MeshElementOverlay, MeshNodeOverlay } from "../../app/types";

interface MeshOverlayProps {
  meshNodes: MeshNodeOverlay[];
  meshElements: MeshElementOverlay[];
}

export const MeshOverlay = ({ meshNodes, meshElements }: MeshOverlayProps) => {
  const geometry = useMemo(() => {
    if (meshNodes.length === 0) return new BufferGeometry();

    // Build a unique set of edges from the quad elements
    const edgeSet = new Set<string>();
    const edgePairs: [number, number][] = [];

    for (const el of meshElements) {
      const [n0, n1, n2, n3] = el.nodeIds;
      const quads: [number, number][] = [
        [n0, n1], [n1, n2], [n2, n3], [n3, n0],
      ];
      for (const [a, b] of quads) {
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edgePairs.push([a, b]);
        }
      }
    }

    const nodeById = new Map(meshNodes.map((n) => [n.id, n]));
    const verts = new Float32Array(edgePairs.length * 6);
    for (let i = 0; i < edgePairs.length; i++) {
      const [a, b] = edgePairs[i];
      const na = nodeById.get(a)!;
      const nb = nodeById.get(b)!;
      verts[i * 6] = na.xM;
      verts[i * 6 + 1] = na.yM;
      verts[i * 6 + 2] = 0.015;
      verts[i * 6 + 3] = nb.xM;
      verts[i * 6 + 4] = nb.yM;
      verts[i * 6 + 5] = 0.015;
    }

    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(verts, 3));
    return geo;
  }, [meshNodes, meshElements]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#4a5568" transparent opacity={0.6} />
    </lineSegments>
  );
};
```

- [ ] **Step 3: Mount layers in SlabScene**

In `src/viewer/scene/SlabScene.tsx`, add imports and mount:

```typescript
import { StructureOverlay } from "./StructureOverlay";
import { MeshOverlay } from "./MeshOverlay";
```

Add inside the JSX (after ResultSurface):

```typescript
{(plotMode === "structure" || plotMode === "deformed") && (
  <StructureOverlay model={model} results={results} />
)}

{(plotMode === "mesh" || model.display.mesh) &&
  results.meshNodes.length > 0 && (
    <MeshOverlay
      meshNodes={results.meshNodes}
      meshElements={results.meshElements}
    />
  )}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: build exits 0.

- [ ] **Step 5: Manual test — Structure mode**

```bash
npm run dev
```

Switch to Structure mode. The slab boundary, support lines, and wheel patches should be visible. Switch to Mesh mode — the element grid should appear.

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/viewer/scene/StructureOverlay.tsx src/viewer/scene/MeshOverlay.tsx \
        src/viewer/scene/SlabScene.tsx
git commit -m "feat: add structure and mesh overlay layers to WebGL viewer"
```

---

## Task 9: Docked legend and toolbar

**Files:**
- Create: `src/viewer/LegendDock.tsx`
- Create: `src/viewer/ViewerToolbar.tsx`
- Modify: `src/viewer/ViewerCanvas.tsx`
- Modify: `src/styles/app.css`

- [ ] **Step 1: Create LegendDock**

Create `src/viewer/LegendDock.tsx`:

```typescript
import { buildLegendTicks } from "../components/viewportHelpers";
import type { ContourScale } from "../app/contourScale";

interface LegendDockProps {
  contourScale: ContourScale;
  units: string;
}

export const LegendDock = ({ contourScale, units }: LegendDockProps) => {
  const ticks = buildLegendTicks(contourScale.domainMin, contourScale.domainMax);
  const stops = Array.from({ length: 16 }, (_, i) => {
    const frac = i / 15;
    const val = contourScale.domainMin + (contourScale.domainMax - contourScale.domainMin) * frac;
    return contourScale.getColor(val);
  });

  const gradientCss = `linear-gradient(to top, ${stops
    .map((c, i) => `${c} ${(i / 15) * 100}%`)
    .join(", ")})`;

  return (
    <div className="viewer-legend-dock" aria-label="Colour scale legend">
      <div className="viewer-legend-title">{units}</div>
      <div className="viewer-legend-bar-wrap">
        <div className="viewer-legend-bar" style={{ background: gradientCss }} />
        <div className="viewer-legend-ticks">
          {ticks.map((tick) => (
            <div
              key={tick.key}
              className="viewer-legend-tick"
              style={{ top: `${tick.y}%` }}
            >
              {tick.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Create ViewerToolbar**

Create `src/viewer/ViewerToolbar.tsx`:

```typescript
import type { PlotMode, SlabModel } from "../app/types";

const MODES: { value: PlotMode; label: string }[] = [
  { value: "structure", label: "Structure" },
  { value: "mesh", label: "Mesh" },
  { value: "results", label: "Results 2D" },
  { value: "deformed", label: "Deformed 3D" },
];

interface ViewerToolbarProps {
  model: SlabModel;
  onModelChange: (model: SlabModel) => void;
  deformScale: number;
  onDeformScaleChange: (scale: number) => void;
}

export const ViewerToolbar = ({
  model,
  onModelChange,
  deformScale,
  onDeformScaleChange,
}: ViewerToolbarProps) => {
  const { plotMode, mesh, supports, wheelPatches, contours } = model.display;

  const setMode = (mode: PlotMode) => {
    onModelChange({ ...model, display: { ...model.display, plotMode: mode } });
  };

  const toggle = (key: keyof typeof model.display) => {
    onModelChange({ ...model, display: { ...model.display, [key]: !model.display[key] } });
  };

  return (
    <div className="viewer-toolbar">
      <div className="viewer-toolbar-modes">
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            className={`viewer-mode-btn${plotMode === value ? " active" : ""}`}
            onClick={() => setMode(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="viewer-toolbar-toggles">
        <label>
          <input type="checkbox" checked={mesh} onChange={() => toggle("mesh")} />
          Mesh
        </label>
        <label>
          <input type="checkbox" checked={supports} onChange={() => toggle("supports")} />
          Supports
        </label>
        <label>
          <input type="checkbox" checked={wheelPatches} onChange={() => toggle("wheelPatches")} />
          Wheels
        </label>
        <label>
          <input type="checkbox" checked={contours} onChange={() => toggle("contours")} />
          Contours
        </label>
      </div>
      {plotMode === "deformed" && (
        <div className="viewer-toolbar-deform">
          <label>
            Scale ×{deformScale}
            <input
              type="range"
              min={1}
              max={200}
              value={deformScale}
              onChange={(e) => onDeformScaleChange(Number(e.target.value))}
            />
          </label>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Wire toolbar and legend into ViewerCanvas**

Update `src/viewer/ViewerCanvas.tsx` to import and render both:

```typescript
import { ViewerToolbar } from "./ViewerToolbar";
import { LegendDock } from "./LegendDock";
```

Add toolbar before the canvas wrap, and legend inside `viewer-canvas-wrap`:

```typescript
return (
  <div className="viewer-shell">
    <ViewerToolbar
      model={model}
      onModelChange={onModelChange}
      deformScale={deformScale}
      onDeformScaleChange={setDeformScale}
    />
    <div className="viewer-canvas-wrap">
      <Canvas style={{ background: "#1b2027" }}>
        <SlabScene
          model={model}
          results={results}
          selectedField={selectedField}
          contourScale={contourScale}
          deformScale={deformScale}
          onProbeHit={setProbeHit}
        />
      </Canvas>
      {contourScale && contour && (
        <LegendDock contourScale={contourScale} units={contour.units} />
      )}
      {probeHit && contour && (
        <div className="viewer-probe-overlay">
          x {probeHit.x.toFixed(2)} m, y {probeHit.y.toFixed(2)} m —{" "}
          {probeHit.value.toFixed(4)} {contour.units}
        </div>
      )}
    </div>
  </div>
);
```

- [ ] **Step 4: Add CSS to src/styles/app.css**

Append the following to `src/styles/app.css`:

```css
/* ── Viewer shell ─────────────────────────────────── */
.viewer-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #13171c;
  border-radius: 6px;
  overflow: hidden;
}

.viewer-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 12px;
  background: #1b2027;
  border-bottom: 1px solid #2c3542;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.viewer-toolbar-modes {
  display: flex;
  gap: 4px;
}

.viewer-mode-btn {
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: transparent;
  border: 1px solid #3a4455;
  border-radius: 3px;
  color: #8ea3bc;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.viewer-mode-btn:hover,
.viewer-mode-btn.active {
  background: #2d3a4d;
  color: #e0e8f4;
  border-color: #4a6080;
}

.viewer-toolbar-toggles {
  display: flex;
  gap: 12px;
}

.viewer-toolbar-toggles label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #7a90a8;
  cursor: pointer;
}

.viewer-toolbar-deform {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #7a90a8;
}

.viewer-canvas-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
}

.viewer-canvas-wrap canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

/* ── Docked legend ────────────────────────────────── */
.viewer-legend-dock {
  position: absolute;
  right: 12px;
  top: 12px;
  width: 68px;
  background: rgba(19, 23, 28, 0.85);
  border: 1px solid #2c3542;
  border-radius: 4px;
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.viewer-legend-title {
  font-size: 10px;
  font-weight: 700;
  color: #8ea3bc;
  text-align: center;
  letter-spacing: 0.04em;
}

.viewer-legend-bar-wrap {
  position: relative;
  display: flex;
  gap: 4px;
}

.viewer-legend-bar {
  width: 16px;
  height: 140px;
  border-radius: 2px;
  flex-shrink: 0;
}

.viewer-legend-ticks {
  position: relative;
  flex: 1;
  height: 140px;
}

.viewer-legend-tick {
  position: absolute;
  right: 0;
  transform: translateY(-50%);
  font-size: 9.5px;
  font-weight: 700;
  color: #b0c4dc;
  white-space: nowrap;
}

/* ── Probe overlay ────────────────────────────────── */
.viewer-probe-overlay {
  position: absolute;
  left: 10px;
  bottom: 10px;
  background: rgba(19, 23, 28, 0.82);
  color: #c8d8ea;
  font-size: 11px;
  font-family: monospace;
  padding: 4px 8px;
  border-radius: 3px;
  border: 1px solid #2c3542;
  pointer-events: none;
}
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: build exits 0.

- [ ] **Step 6: Manual test — toolbar and legend**

```bash
npm run dev
```

Verify: mode buttons switch modes, layer toggles update the scene, legend docks to the right without covering the plot, probe overlay shows on hover.

- [ ] **Step 7: Commit**

```bash
git add src/viewer/LegendDock.tsx src/viewer/ViewerToolbar.tsx \
        src/viewer/ViewerCanvas.tsx src/styles/app.css
git commit -m "feat: add docked legend and viewer toolbar"
```

---

## Task 10: Deformed 3D mode

**Files:**
- Modify: `src/viewer/scene/SlabScene.tsx`

The camera-switching logic for Deformed 3D was already added in Task 6. This task verifies the mode visually works end-to-end once the surface layer and toolbar are in place, and adjusts the camera target to centre on the deformed slab.

- [ ] **Step 1: Tune camera for deformed mode**

In `src/viewer/scene/SlabScene.tsx`, update the deformed camera to account for the slab's actual deflected extent. Replace the `PerspectiveCamera` position with:

```typescript
// Position camera above and behind the slab for a 3/4 view
const cameraZ = Math.max(model.geometry.thicknessM * deformScale * 3, maxDim * 0.4);
```

Update the PerspectiveCamera:
```typescript
<PerspectiveCamera
  makeDefault
  position={[cx, cy - maxDim * 0.7, cameraZ + maxDim * 0.5]}
  fov={50}
/>
<OrbitControls target={[cx, cy, cameraZ / 4]} />
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build exits 0.

- [ ] **Step 3: Manual test — Deformed 3D mode**

```bash
npm run dev
```

After running analysis, switch to Deformed 3D. The slab should appear as a deflected surface coloured by the selected field. The orbit controls should allow rotating the view. The deformation scale slider should exaggerate or reduce the deflection. Verify that switching back to Results 2D restores the flat plan view with panning.

- [ ] **Step 4: Commit**

```bash
git add src/viewer/scene/SlabScene.tsx
git commit -m "feat: tune camera for deformed 3D mode"
```

---

## Task 11: Extrema markers

**Files:**
- Create: `src/viewer/scene/ExtremaMarkers.tsx`
- Modify: `src/viewer/scene/SlabScene.tsx`

- [ ] **Step 1: Create ExtremaMarkers**

Create `src/viewer/scene/ExtremaMarkers.tsx`:

```typescript
import type { NodalContourData } from "../../app/types";

interface ExtremaMarkersProps {
  contour: NodalContourData | undefined;
  radius: number;
}

export const ExtremaMarkers = ({ contour, radius }: ExtremaMarkersProps) => {
  if (!contour || contour.points.length === 0) return null;

  let minPt = contour.points[0];
  let maxPt = contour.points[0];
  for (const pt of contour.points) {
    if (pt.value < minPt.value) minPt = pt;
    if (pt.value > maxPt.value) maxPt = pt;
  }

  const samePoint = minPt.nodeId === maxPt.nodeId;

  return (
    <>
      <mesh position={[maxPt.xM, maxPt.yM, 0.04]}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      {!samePoint && (
        <mesh position={[minPt.xM, minPt.yM, 0.04]}>
          <sphereGeometry args={[radius, 16, 16]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
      )}
    </>
  );
};
```

- [ ] **Step 2: Mount in SlabScene**

In `src/viewer/scene/SlabScene.tsx`, add:

```typescript
import { ExtremaMarkers } from "./ExtremaMarkers";
```

After the existing layer mounts, add:

```typescript
{(plotMode === "results" || plotMode === "deformed") &&
  selectedField !== "reactions" && (
    <ExtremaMarkers
      contour={results.nodalContours[selectedField]}
      radius={maxDim * 0.013}
    />
  )}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build exits 0.

- [ ] **Step 4: Manual test**

```bash
npm run dev
```

A red sphere should appear at the MAX value location and a blue sphere at the MIN value location when in Results 2D mode. Verify they move correctly when switching fields.

- [ ] **Step 5: Commit**

```bash
git add src/viewer/scene/ExtremaMarkers.tsx src/viewer/scene/SlabScene.tsx
git commit -m "feat: add min/max extrema sphere markers"
```

---

## Task 12: Wire into Viewport — final integration

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/components/Viewport.tsx`
- Modify: `src/components/viewportHelpers.ts`

This task replaces the SVG drawing section of `Viewport.tsx` with the new `ViewerCanvas`, retaining the result header, summary cards, and reaction tables.

- [ ] **Step 1: Update viewportHelpers.ts for deformed mode**

In `src/components/viewportHelpers.ts`, update `deriveViewportLayerVisibility` to handle the "deformed" mode:

```typescript
export function deriveViewportLayerVisibility(
  plotMode: PlotMode,
  display: DisplayToggles,
  hasContour: boolean,
): ViewportLayerVisibility {
  return {
    showContours:
      (plotMode === "results" || plotMode === "deformed") && display.contours && hasContour,
    showMesh:
      plotMode === "mesh" || plotMode === "deformed" ? true : display.mesh,
    showSupports:
      plotMode === "structure" || plotMode === "mesh" || plotMode === "deformed"
        ? true
        : display.supports,
    showWheelPatches:
      plotMode === "structure" || plotMode === "deformed" ? true : display.wheelPatches,
  };
}
```

- [ ] **Step 2: Run tests after viewportHelpers change**

```bash
npm test -- src/tests/viewportHelpers.test.ts
```

Expected: PASS. If new "deformed" cases expose missing coverage, add them now before continuing. Here are the tests to add to `src/tests/viewportHelpers.test.ts`:

```typescript
it("deformed mode shows contours, mesh, supports, and wheels", () => {
  const display: DisplayToggles = {
    plotMode: "deformed",
    mesh: false,
    supports: false,
    wheelPatches: false,
    contours: true,
    tables: false,
  };
  const v = deriveViewportLayerVisibility("deformed", display, true);
  expect(v.showContours).toBe(true);
  expect(v.showMesh).toBe(true);
  expect(v.showSupports).toBe(true);
  expect(v.showWheelPatches).toBe(true);
});
```

- [ ] **Step 3: Update App.tsx to pass onModelChange**

In `src/app/App.tsx`, find the `<Viewport ...>` render and add the `onModelChange` prop:

```typescript
<Viewport
  model={model}
  results={results}
  selectedField={selectedResultField}
  onModelChange={setModel}
/>
```

- [ ] **Step 4: Replace SVG section in Viewport.tsx**

In `src/components/Viewport.tsx`:

**4a. Add imports:**
```typescript
import { ViewerCanvas } from "../viewer/ViewerCanvas";
```

**4b. Add onModelChange to ViewportProps:**
```typescript
interface ViewportProps {
  model: SlabModel;
  results: AnalysisResults;
  selectedField: ResultField;
  onModelChange: (model: SlabModel) => void;
}
```

**4c. Replace the `viewport-shell` section** (lines 108–399 in the original file — the entire `<section className="viewport-shell">...</section>` block) with:

```typescript
<section className="viewport-shell">
  <header className="viewport-shell-header">
    <div className="viewport-shell-heading">
      <p className="viewport-shell-kicker">Result Plot</p>
      <h3>{resultLabel[selectedField]}</h3>
    </div>
    <div className="viewport-shell-meta" aria-label="Plot metadata">
      <span>{model.geometry.lengthM.toFixed(2)} m × {model.geometry.widthM.toFixed(2)} m</span>
    </div>
  </header>
  <div className="viewport-canvas mode-webgl" style={{ height: "520px" }}>
    <ViewerCanvas
      model={model}
      results={results}
      selectedField={selectedField}
      onModelChange={onModelChange}
    />
  </div>
  <div className="viewport-shell-footer">
    <div className="viewport-overlay">
      <p className="viewport-overlay-label">Viewport Status</p>
      <h4>{resultLabel[selectedField]} view</h4>
      {activeResultSummary && (
        <>
          <p className="viewport-overlay-summary">
            <span>{activeResultSummary.title}:</span>{" "}
            <strong>{activeResultSummary.value}</strong>
          </p>
          <p className="viewport-overlay-summary viewport-overlay-note">
            {activeResultSummary.detail}
          </p>
        </>
      )}
    </div>
  </div>
</section>
```

**4d. Remove the now-unused helper functions** from `Viewport.tsx`: `buildFallbackMesh`, `buildContourCells`, `findSegmentIndex`, and `buildLegendStops` (they were only used by the SVG section).

**4e. Remove the now-unused imports** from `Viewport.tsx`:
- `useId` (no longer needed for gradient IDs)
- `createContourScale` (now inside ViewerCanvas)
- `buildLegendTicks`, `findContourExtrema` (now used in viewer components)
- `deriveViewportLayerVisibility` (optionally keep if layerVisibility data is still shown in the status footer)

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: PASS. TypeScript must compile cleanly — any prop-shape mismatches will surface here.

- [ ] **Step 6: Verify build**

```bash
npm run build
```

Expected: build exits 0 with no type errors.

- [ ] **Step 7: Manual full test in browser**

```bash
npm run dev
```

Verify all acceptance criteria from spec §10:

- [ ] Contour fields render as a smooth colour gradient, not flat per-cell rectangles
- [ ] The main viewport is WebGL-based (canvas element, not SVG)
- [ ] The legend is docked to the right, not covering the plot area
- [ ] The four mode buttons switch cleanly: Structure / Mesh / Results 2D / Deformed 3D
- [ ] Switching modes does NOT trigger a solver re-run (status stays "success", elapsed time does not change)
- [ ] The result view looks materially more modern than the SVG version
- [ ] The deformation scale slider changes the 3D deflection exaggeration live
- [ ] Hover over the plot surface shows the field value in the probe overlay
- [ ] MIN (blue) and MAX (red) sphere markers appear at correct positions
- [ ] `window.print()` from the export button produces a recognisable output

- [ ] **Step 8: Commit**

```bash
git add src/app/App.tsx src/components/Viewport.tsx src/components/viewportHelpers.ts
git commit -m "feat: replace SVG viewport with WebGL viewer (V5 integration)"
```

---

## Post-plan notes

### Deferred from V5 scope (per spec §12)
- Non-rectangular slab geometry
- Multiple panels
- Isoline overlays (spec §5.3, Phase 2 shading)
- Jump-to-min / jump-to-max navigation buttons (spec §5.2)
- PDF / print export fine-tuning

### Known first-implementation simplifications
- Probe uses nearest-node value lookup rather than barycentric interpolation within the hit triangle
- The orthographic camera zoom is a static ratio of canvas size; it does not auto-fit on window resize (use the MapControls scroll-to-fit as a workaround)
- The `line_` JSX intrinsic for THREE.Line objects requires the drei/fiber version to expose it; if it is not available, replace with `<primitive object={new THREE.Line(geo, mat)} />`

### Spec §9.8-9 (export + review)
After manual testing passes, perform a final independent review using the `superpowers:requesting-code-review` skill before pushing to remote.
