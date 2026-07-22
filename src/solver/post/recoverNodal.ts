import { computeMindlinConstitutive, evaluateMindlinQ4At } from "../core/element";
import type { MaterialDefinition, MeshElement, MeshNode, NodalFieldValues, StructuredMesh } from "../model/types";

/**
 * Recover nodal field values as area-weighted averages of the surrounding
 * element-CENTRE (natural (0,0), superconvergent) values.
 *
 * - Deflection is taken from the exact nodal degree of freedom.
 * - Moments (mx, my, mxy) are area-weighted averages of element-centre moments;
 *   they are smoothed averages, never extrapolated corner peaks or singular
 *   extrema.
 * - Shear policy: qx/qy are recovered at the element centre because that is the
 *   defensible location for the MITC4 assumed-shear field, then area-weighted to
 *   the nodes. Nodal shear is a smoothed average and must not be read as a
 *   corner extremum; unverified corner shear extrema are deliberately excluded.
 *
 * A constant-curvature state recovers exactly at every node on any (including
 * nonuniform or skew) mesh, because every surrounding element shares the same
 * centre value and the area-weighted mean of equal values is that value.
 */
export function recoverNodalFields(
  mesh: StructuredMesh,
  material: MaterialDefinition,
  thickness: number,
  fullDisplacements: Float64Array,
): NodalFieldValues[] {
  const constitutive = computeMindlinConstitutive(material, thickness);
  const n = mesh.nodes.length;
  const sumMx = new Float64Array(n);
  const sumMy = new Float64Array(n);
  const sumMxy = new Float64Array(n);
  const sumQx = new Float64Array(n);
  const sumQy = new Float64Array(n);
  const sumArea = new Float64Array(n);

  for (const element of mesh.elements) {
    const elementNodes = element.nodeIds.map((id) => mesh.nodes[id]) as [
      MeshNode, MeshNode, MeshNode, MeshNode,
    ];
    const ed = gatherElementDisp(element, fullDisplacements);
    const ev = evaluateMindlinQ4At(elementNodes, ed, 0, 0);

    const { db, ds } = constitutive;
    const [k0, k1, k2] = ev.curvatures;
    const [s0, s1] = ev.shears;
    const mx = db[0] * k0 + db[1] * k1 + db[2] * k2;
    const my = db[3] * k0 + db[4] * k1 + db[5] * k2;
    const mxy = db[6] * k0 + db[7] * k1 + db[8] * k2;
    const qx = ds[0] * s0 + ds[1] * s1;
    const qy = ds[2] * s0 + ds[3] * s1;
    const area = quadArea(elementNodes);

    for (let c = 0; c < 4; c++) {
      const nodeId = element.nodeIds[c];
      sumMx[nodeId] += area * mx;
      sumMy[nodeId] += area * my;
      sumMxy[nodeId] += area * mxy;
      sumQx[nodeId] += area * qx;
      sumQy[nodeId] += area * qy;
      sumArea[nodeId] += area;
    }
  }

  return mesh.nodes.map((node) => {
    const weight = sumArea[node.id] > 0 ? sumArea[node.id] : 1;
    return {
      nodeId: node.id,
      x: node.x,
      y: node.y,
      deflection: fullDisplacements[node.id * 3],
      mx: sumMx[node.id] / weight,
      my: sumMy[node.id] / weight,
      mxy: sumMxy[node.id] / weight,
      qx: sumQx[node.id] / weight,
      qy: sumQy[node.id] / weight,
    };
  });
}

function quadArea(nodes: readonly [MeshNode, MeshNode, MeshNode, MeshNode]): number {
  let twiceArea = 0;
  for (let i = 0; i < 4; i++) {
    const current = nodes[i];
    const next = nodes[(i + 1) % 4];
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(twiceArea) / 2;
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
