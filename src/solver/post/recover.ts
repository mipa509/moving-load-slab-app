import {
  computeMindlinConstitutive,
  evaluateMindlinQ4At,
} from "../core/element";
import { getMeshElementCenter } from "../core/mesh";
import type {
  ElementCenterResult,
  MaterialDefinition,
  MeshElement,
  MeshNode,
  StructuredMesh,
} from "../model/types";

export function recoverElementCenterResults(
  mesh: StructuredMesh,
  material: MaterialDefinition,
  thickness: number,
  fullDisplacements: Float64Array,
): ElementCenterResult[] {
  const constitutive = computeMindlinConstitutive(material, thickness);
  const results: ElementCenterResult[] = [];

  for (const element of mesh.elements) {
    const elementNodes = element.nodeIds.map((nodeId) => mesh.nodes[nodeId]) as [
      MeshNode,
      MeshNode,
      MeshNode,
      MeshNode,
    ];
    const elementDisp = gatherElementDisplacements(element, fullDisplacements);
    const evaluation = evaluateMindlinQ4At(elementNodes, elementDisp, 0, 0);

    const moments = multiply3x3ByVector(constitutive.db, evaluation.curvatures);
    const shears = multiply2x2ByVector(constitutive.ds, evaluation.shears);
    const centerDeflection = evaluateCenterDeflection(evaluation.shapeFunctions, elementDisp);

    results.push({
      elementId: element.id,
      center: getMeshElementCenter(mesh, element),
      deflection: centerDeflection,
      moments: {
        mx: moments[0],
        my: moments[1],
        mxy: moments[2],
      },
      shears: {
        qx: shears[0],
        qy: shears[1],
      },
    });
  }

  return results;
}

function gatherElementDisplacements(
  element: MeshElement,
  fullDisplacements: Float64Array,
): Float64Array {
  const elementDisplacements = new Float64Array(12);
  for (let i = 0; i < 4; i += 1) {
    const nodeId = element.nodeIds[i];
    const base = nodeId * 3;
    elementDisplacements[i * 3 + 0] = fullDisplacements[base + 0];
    elementDisplacements[i * 3 + 1] = fullDisplacements[base + 1];
    elementDisplacements[i * 3 + 2] = fullDisplacements[base + 2];
  }
  return elementDisplacements;
}

function evaluateCenterDeflection(
  shape: readonly [number, number, number, number],
  elementDisplacements: Float64Array,
): number {
  let deflection = 0;
  for (let i = 0; i < 4; i += 1) {
    deflection += shape[i] * elementDisplacements[i * 3];
  }
  return deflection;
}

function multiply3x3ByVector(
  matrix: readonly [number, number, number, number, number, number, number, number, number],
  vector: readonly [number, number, number],
): [number, number, number] {
  return [
    matrix[0] * vector[0] + matrix[1] * vector[1] + matrix[2] * vector[2],
    matrix[3] * vector[0] + matrix[4] * vector[1] + matrix[5] * vector[2],
    matrix[6] * vector[0] + matrix[7] * vector[1] + matrix[8] * vector[2],
  ];
}

function multiply2x2ByVector(
  matrix: readonly [number, number, number, number],
  vector: readonly [number, number],
): [number, number] {
  return [
    matrix[0] * vector[0] + matrix[1] * vector[1],
    matrix[2] * vector[0] + matrix[3] * vector[1],
  ];
}
