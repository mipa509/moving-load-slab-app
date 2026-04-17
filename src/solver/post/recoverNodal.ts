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
