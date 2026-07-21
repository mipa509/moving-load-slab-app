import { computeMindlinQ4ElementStiffness } from "../../solver/core/element";
import { evaluateQ4Jacobian } from "../../solver/core/q4Geometry";
import type { MaterialDefinition, MeshNode } from "../../solver/model/types";

export interface DenseMatrix {
  order: number;
  values: Float64Array;
}

export interface DiagnosticMesh {
  nodes: MeshNode[];
  elements: Array<readonly [number, number, number, number]>;
}

export interface EigenDiagnostics {
  eigenvalues: number[];
  eigenvectors: Float64Array[];
  tolerance: number;
  nullity: number;
  negativeCount: number;
  conditionNumber: number;
}

export interface CgDiagnostics {
  converged: boolean;
  breakdown: boolean;
  iterations: number;
  residualNorm: number;
  minimumNormalizedSearchEnergy: number;
}

export interface MeshJacobianQuality {
  minimumDeterminant: number;
  maximumConditionNumber: number;
}

const EIGEN_ROUNDOFF_MULTIPLIER = 4096;
const MAX_JACOBI_SWEEPS_PER_DOF_SQUARED = 100;

export function createAffineStructuredMesh(
  elementCountX: number,
  elementCountY: number,
  lengthX: number,
  lengthY: number,
  shearOffsetPerY = 0,
): DiagnosticMesh {
  return createMappedStructuredMesh(elementCountX, elementCountY, (u, v) => ({
    x: lengthX * u + shearOffsetPerY * lengthY * v,
    y: lengthY * v,
  }));
}

export function createMappedStructuredMesh(
  elementCountX: number,
  elementCountY: number,
  map: (u: number, v: number) => { x: number; y: number },
): DiagnosticMesh {
  const nodes: MeshNode[] = [];
  const nodeId = (i: number, j: number): number => j * (elementCountX + 1) + i;

  for (let j = 0; j <= elementCountY; j += 1) {
    for (let i = 0; i <= elementCountX; i += 1) {
      const point = map(i / elementCountX, j / elementCountY);
      nodes.push({ id: nodeId(i, j), x: point.x, y: point.y });
    }
  }

  const elements: Array<readonly [number, number, number, number]> = [];
  for (let j = 0; j < elementCountY; j += 1) {
    for (let i = 0; i < elementCountX; i += 1) {
      elements.push([
        nodeId(i, j),
        nodeId(i + 1, j),
        nodeId(i + 1, j + 1),
        nodeId(i, j + 1),
      ]);
    }
  }
  return { nodes, elements };
}

export function evaluateMeshJacobianQuality(
  mesh: DiagnosticMesh,
  samplePoints: ReadonlyArray<readonly [number, number]>,
): MeshJacobianQuality {
  let minimumDeterminant = Number.POSITIVE_INFINITY;
  let maximumConditionNumber = 0;

  for (const nodeIds of mesh.elements) {
    const nodes = nodeIds.map((nodeId) => mesh.nodes[nodeId]) as [
      MeshNode,
      MeshNode,
      MeshNode,
      MeshNode,
    ];
    for (const [xi, eta] of samplePoints) {
      const jacobian = evaluateQ4Jacobian(nodes, xi, eta);
      minimumDeterminant = Math.min(minimumDeterminant, jacobian.determinant);
      maximumConditionNumber = Math.max(
        maximumConditionNumber,
        jacobianConditionNumber(jacobian.matrix),
      );
    }
  }

  return { minimumDeterminant, maximumConditionNumber };
}

export function assembleDenseStiffness(
  mesh: DiagnosticMesh,
  material: MaterialDefinition,
  thickness: number,
): DenseMatrix {
  const order = mesh.nodes.length * 3;
  const values = new Float64Array(order * order);

  for (const nodeIds of mesh.elements) {
    const elementNodes = nodeIds.map((id) => mesh.nodes[id]) as [
      MeshNode,
      MeshNode,
      MeshNode,
      MeshNode,
    ];
    const element = computeMindlinQ4ElementStiffness(elementNodes, material, thickness);
    for (let localRow = 0; localRow < 12; localRow += 1) {
      const globalRow = nodeIds[Math.floor(localRow / 3)] * 3 + (localRow % 3);
      for (let localColumn = 0; localColumn < 12; localColumn += 1) {
        const globalColumn =
          nodeIds[Math.floor(localColumn / 3)] * 3 + (localColumn % 3);
        values[globalRow * order + globalColumn] += element[localRow * 12 + localColumn];
      }
    }
  }
  return { order, values };
}

/**
 * Congruence scaling d = T q with T_w = L and T_beta = 1 makes every q
 * dimensionless and every entry of T^T K T an energy coefficient (kN m).
 */
export function scalePlateDofsByLength(matrix: DenseMatrix, length: number): DenseMatrix {
  const values = new Float64Array(matrix.values.length);
  for (let row = 0; row < matrix.order; row += 1) {
    const rowScale = row % 3 === 0 ? length : 1;
    for (let column = 0; column < matrix.order; column += 1) {
      const columnScale = column % 3 === 0 ? length : 1;
      values[row * matrix.order + column] =
        matrix.values[row * matrix.order + column] * rowScale * columnScale;
    }
  }
  return { order: matrix.order, values };
}

export function matrixInfinityNorm(matrix: DenseMatrix): number {
  let norm = 0;
  for (let row = 0; row < matrix.order; row += 1) {
    let sum = 0;
    for (let column = 0; column < matrix.order; column += 1) {
      sum += Math.abs(matrix.values[row * matrix.order + column]);
    }
    norm = Math.max(norm, sum);
  }
  return norm;
}

export function normalizedAntisymmetry(matrix: DenseMatrix): number {
  const scale = Math.max(matrixInfinityNorm(matrix), Number.MIN_VALUE);
  let difference = 0;
  for (let row = 0; row < matrix.order; row += 1) {
    for (let column = row + 1; column < matrix.order; column += 1) {
      difference = Math.max(
        difference,
        Math.abs(
          matrix.values[row * matrix.order + column] -
            matrix.values[column * matrix.order + row],
        ),
      );
    }
  }
  return difference / scale;
}

export function multiplyMatrixVector(
  matrix: DenseMatrix,
  vector: ArrayLike<number>,
): Float64Array {
  const result = new Float64Array(matrix.order);
  for (let row = 0; row < matrix.order; row += 1) {
    let sum = 0;
    for (let column = 0; column < matrix.order; column += 1) {
      sum += matrix.values[row * matrix.order + column] * vector[column];
    }
    result[row] = sum;
  }
  return result;
}

export function quadraticEnergy(matrix: DenseMatrix, vector: ArrayLike<number>): number {
  return dot(vector, multiplyMatrixVector(matrix, vector));
}

export function vectorNorm(vector: ArrayLike<number>): number {
  return Math.sqrt(dot(vector, vector));
}

export function relativeMatrixResidual(
  matrix: DenseMatrix,
  vector: ArrayLike<number>,
): number {
  return (
    vectorNorm(multiplyMatrixVector(matrix, vector)) /
    Math.max(matrixInfinityNorm(matrix) * vectorNorm(vector), Number.MIN_VALUE)
  );
}

export function extractPrincipalSubmatrix(
  matrix: DenseMatrix,
  retainedDofs: readonly number[],
): DenseMatrix {
  const order = retainedDofs.length;
  const values = new Float64Array(order * order);
  for (let row = 0; row < order; row += 1) {
    for (let column = 0; column < order; column += 1) {
      values[row * order + column] =
        matrix.values[retainedDofs[row] * matrix.order + retainedDofs[column]];
    }
  }
  return { order, values };
}

export function symmetricEigenDiagnostics(matrix: DenseMatrix): EigenDiagnostics {
  const order = matrix.order;
  const a = Float64Array.from(matrix.values);
  const eigenvectorMatrix = new Float64Array(order * order);
  for (let i = 0; i < order; i += 1) eigenvectorMatrix[i * order + i] = 1;

  const convergenceTolerance =
    64 * Number.EPSILON * Math.max(matrixInfinityNorm(matrix), Number.MIN_VALUE);
  const iterationLimit = MAX_JACOBI_SWEEPS_PER_DOF_SQUARED * order * order;

  for (let iteration = 0; iteration < iterationLimit; iteration += 1) {
    let pivotRow = 0;
    let pivotColumn = 0;
    let largestOffDiagonal = 0;
    for (let row = 0; row < order; row += 1) {
      for (let column = row + 1; column < order; column += 1) {
        const magnitude = Math.abs(a[row * order + column]);
        if (magnitude > largestOffDiagonal) {
          largestOffDiagonal = magnitude;
          pivotRow = row;
          pivotColumn = column;
        }
      }
    }
    if (largestOffDiagonal <= convergenceTolerance) break;

    const app = a[pivotRow * order + pivotRow];
    const aqq = a[pivotColumn * order + pivotColumn];
    const apq = a[pivotRow * order + pivotColumn];
    const tau = (aqq - app) / (2 * apq);
    const tangent =
      Math.sign(tau || 1) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
    const cosine = 1 / Math.sqrt(1 + tangent * tangent);
    const sine = tangent * cosine;

    for (let index = 0; index < order; index += 1) {
      if (index === pivotRow || index === pivotColumn) continue;
      const aip = a[index * order + pivotRow];
      const aiq = a[index * order + pivotColumn];
      const rotatedP = cosine * aip - sine * aiq;
      const rotatedQ = sine * aip + cosine * aiq;
      a[index * order + pivotRow] = rotatedP;
      a[pivotRow * order + index] = rotatedP;
      a[index * order + pivotColumn] = rotatedQ;
      a[pivotColumn * order + index] = rotatedQ;
    }
    a[pivotRow * order + pivotRow] =
      cosine * cosine * app - 2 * sine * cosine * apq + sine * sine * aqq;
    a[pivotColumn * order + pivotColumn] =
      sine * sine * app + 2 * sine * cosine * apq + cosine * cosine * aqq;
    a[pivotRow * order + pivotColumn] = 0;
    a[pivotColumn * order + pivotRow] = 0;

    for (let row = 0; row < order; row += 1) {
      const vip = eigenvectorMatrix[row * order + pivotRow];
      const viq = eigenvectorMatrix[row * order + pivotColumn];
      eigenvectorMatrix[row * order + pivotRow] = cosine * vip - sine * viq;
      eigenvectorMatrix[row * order + pivotColumn] = sine * vip + cosine * viq;
    }
  }

  const pairs = Array.from({ length: order }, (_, column) => ({
    value: a[column * order + column],
    vector: Float64Array.from(
      { length: order },
      (_, row) => eigenvectorMatrix[row * order + column],
    ),
  })).sort((left, right) => left.value - right.value);
  const maxMagnitude = Math.max(...pairs.map((pair) => Math.abs(pair.value)), Number.MIN_VALUE);
  const tolerance = EIGEN_ROUNDOFF_MULTIPLIER * Number.EPSILON * order * maxMagnitude;
  const positive = pairs.filter((pair) => pair.value > tolerance).map((pair) => pair.value);

  return {
    eigenvalues: pairs.map((pair) => pair.value),
    eigenvectors: pairs.map((pair) => pair.vector),
    tolerance,
    nullity: pairs.filter((pair) => Math.abs(pair.value) <= tolerance).length,
    negativeCount: pairs.filter((pair) => pair.value < -tolerance).length,
    conditionNumber:
      positive.length === 0 ? Number.POSITIVE_INFINITY : positive[positive.length - 1] / positive[0],
  };
}

export function choleskyPivots(matrix: DenseMatrix): number[] {
  const lower = new Float64Array(matrix.values.length);
  const pivots: number[] = [];
  for (let row = 0; row < matrix.order; row += 1) {
    for (let column = 0; column <= row; column += 1) {
      let value = matrix.values[row * matrix.order + column];
      for (let k = 0; k < column; k += 1) {
        value -= lower[row * matrix.order + k] * lower[column * matrix.order + k];
      }
      if (row === column) {
        pivots.push(value);
        lower[row * matrix.order + column] = value > 0 ? Math.sqrt(value) : Number.NaN;
      } else {
        lower[row * matrix.order + column] =
          value / lower[column * matrix.order + column];
      }
    }
  }
  return pivots;
}

export function conjugateGradientDiagnostics(
  matrix: DenseMatrix,
  rightHandSide: ArrayLike<number>,
  relativeTolerance = 1e-12,
  maximumIterations = matrix.order * 4,
): CgDiagnostics {
  const solution = new Float64Array(matrix.order);
  const residual = Float64Array.from(rightHandSide);
  const search = Float64Array.from(residual);
  let residualSquared = dot(residual, residual);
  const initialNorm = Math.sqrt(residualSquared);
  const matrixNorm = Math.max(matrixInfinityNorm(matrix), Number.MIN_VALUE);
  let minimumNormalizedSearchEnergy = Number.POSITIVE_INFINITY;

  if (initialNorm === 0) {
    return {
      converged: true,
      breakdown: false,
      iterations: 0,
      residualNorm: 0,
      minimumNormalizedSearchEnergy,
    };
  }

  for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
    const matrixSearch = multiplyMatrixVector(matrix, search);
    const searchNormSquared = dot(search, search);
    const searchEnergy = dot(search, matrixSearch);
    const normalizedSearchEnergy = searchEnergy / (matrixNorm * searchNormSquared);
    minimumNormalizedSearchEnergy = Math.min(
      minimumNormalizedSearchEnergy,
      normalizedSearchEnergy,
    );
    const breakdownTolerance =
      EIGEN_ROUNDOFF_MULTIPLIER * Number.EPSILON * matrixNorm * searchNormSquared;
    if (!Number.isFinite(searchEnergy) || searchEnergy <= breakdownTolerance) {
      return {
        converged: false,
        breakdown: true,
        iterations: iteration,
        residualNorm: Math.sqrt(residualSquared),
        minimumNormalizedSearchEnergy,
      };
    }

    const alpha = residualSquared / searchEnergy;
    for (let i = 0; i < matrix.order; i += 1) {
      solution[i] += alpha * search[i];
      residual[i] -= alpha * matrixSearch[i];
    }
    const nextResidualSquared = dot(residual, residual);
    if (Math.sqrt(nextResidualSquared) <= relativeTolerance * initialNorm) {
      return {
        converged: true,
        breakdown: false,
        iterations: iteration + 1,
        residualNorm: Math.sqrt(nextResidualSquared),
        minimumNormalizedSearchEnergy,
      };
    }
    const beta = nextResidualSquared / residualSquared;
    for (let i = 0; i < matrix.order; i += 1) {
      search[i] = residual[i] + beta * search[i];
    }
    residualSquared = nextResidualSquared;
  }

  return {
    converged: false,
    breakdown: false,
    iterations: maximumIterations,
    residualNorm: Math.sqrt(residualSquared),
    minimumNormalizedSearchEnergy,
  };
}

function dot(left: ArrayLike<number>, right: ArrayLike<number>): number {
  let result = 0;
  for (let i = 0; i < left.length; i += 1) result += left[i] * right[i];
  return result;
}

function jacobianConditionNumber(
  matrix: readonly [number, number, number, number],
): number {
  const [a, b, c, d] = matrix;
  const trace = a * a + b * b + c * c + d * d;
  const determinant = a * d - b * c;
  const discriminant = Math.sqrt(
    Math.max(0, trace * trace - 4 * determinant * determinant),
  );
  const maximumEigenvalue = 0.5 * (trace + discriminant);
  const minimumEigenvalue = 0.5 * (trace - discriminant);
  return Math.sqrt(maximumEigenvalue / minimumEigenvalue);
}
