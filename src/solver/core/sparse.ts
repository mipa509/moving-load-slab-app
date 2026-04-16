export interface SparseMatrix {
  size: number;
  rows: Array<Map<number, number>>;
}

export interface ReducedLinearSystem {
  matrix: SparseMatrix;
  rhs: Float64Array;
  freeToFull: number[];
  fullToFree: Int32Array;
}

export interface ConjugateGradientOptions {
  tolerance?: number;
  absoluteTolerance?: number;
  maxIterations?: number;
}

export interface ConjugateGradientResult {
  solution: Float64Array;
  converged: boolean;
  iterations: number;
  residualNorm: number;
  initialResidualNorm: number;
}

export function createSparseMatrix(size: number): SparseMatrix {
  if (size < 0 || !Number.isInteger(size)) {
    throw new Error("Sparse matrix size must be a non-negative integer.");
  }
  return {
    size,
    rows: Array.from({ length: size }, () => new Map<number, number>()),
  };
}

export function addSparseValue(
  matrix: SparseMatrix,
  row: number,
  col: number,
  value: number,
): void {
  if (value === 0) {
    return;
  }
  const rowMap = matrix.rows[row];
  rowMap.set(col, (rowMap.get(col) ?? 0) + value);
}

export function addToSparseDiagonal(matrix: SparseMatrix, index: number, value: number): void {
  addSparseValue(matrix, index, index, value);
}

export function addElementStiffnessToSparse(
  matrix: SparseMatrix,
  dofIndices: readonly number[],
  localStiffness: Float64Array,
): void {
  const n = dofIndices.length;
  for (let i = 0; i < n; i += 1) {
    const globalRow = dofIndices[i];
    for (let j = 0; j < n; j += 1) {
      const globalCol = dofIndices[j];
      const value = localStiffness[i * n + j];
      if (value !== 0) {
        addSparseValue(matrix, globalRow, globalCol, value);
      }
    }
  }
}

export function multiplySparseMatrixVector(
  matrix: SparseMatrix,
  vector: Float64Array,
): Float64Array {
  const result = new Float64Array(matrix.size);
  for (let row = 0; row < matrix.size; row += 1) {
    let sum = 0;
    for (const [col, value] of matrix.rows[row]) {
      sum += value * vector[col];
    }
    result[row] = sum;
  }
  return result;
}

export function buildReducedSystem(
  fullMatrix: SparseMatrix,
  fullRhs: Float64Array,
  fixedDofs: Set<number>,
): ReducedLinearSystem {
  const fullSize = fullMatrix.size;
  const fullToFree = new Int32Array(fullSize);
  fullToFree.fill(-1);

  const freeToFull: number[] = [];
  for (let dof = 0; dof < fullSize; dof += 1) {
    if (fixedDofs.has(dof)) {
      continue;
    }
    fullToFree[dof] = freeToFull.length;
    freeToFull.push(dof);
  }

  const reducedMatrix = createSparseMatrix(freeToFull.length);
  const reducedRhs = new Float64Array(freeToFull.length);

  for (let freeRow = 0; freeRow < freeToFull.length; freeRow += 1) {
    const fullRow = freeToFull[freeRow];
    reducedRhs[freeRow] = fullRhs[fullRow];

    for (const [fullCol, value] of fullMatrix.rows[fullRow]) {
      const freeCol = fullToFree[fullCol];
      if (freeCol < 0) {
        continue;
      }
      addSparseValue(reducedMatrix, freeRow, freeCol, value);
    }
  }

  return {
    matrix: reducedMatrix,
    rhs: reducedRhs,
    freeToFull,
    fullToFree,
  };
}

export function expandReducedSolution(
  reducedSolution: Float64Array,
  freeToFull: readonly number[],
  fullSize: number,
): Float64Array {
  const full = new Float64Array(fullSize);
  for (let i = 0; i < freeToFull.length; i += 1) {
    full[freeToFull[i]] = reducedSolution[i];
  }
  return full;
}

export function solveConjugateGradient(
  matrix: SparseMatrix,
  rhs: Float64Array,
  options: ConjugateGradientOptions = {},
): ConjugateGradientResult {
  const n = matrix.size;
  const tolerance = options.tolerance ?? 1e-8;
  const absoluteTolerance = options.absoluteTolerance ?? 1e-10;
  const maxIterations = options.maxIterations ?? Math.max(200, n * 4);

  const x = new Float64Array(n);
  if (n === 0) {
    return {
      solution: x,
      converged: true,
      iterations: 0,
      residualNorm: 0,
      initialResidualNorm: 0,
    };
  }

  const diagonal = extractSparseDiagonal(matrix);
  const residual = rhs.slice();
  const z = applyJacobiPreconditioner(residual, diagonal);
  let direction = z.slice();
  let rzOld = dot(residual, z);

  const initialResidualNorm = norm2(residual);
  if (initialResidualNorm <= absoluteTolerance) {
    return {
      solution: x,
      converged: true,
      iterations: 0,
      residualNorm: initialResidualNorm,
      initialResidualNorm,
    };
  }

  const convergenceTarget = Math.max(absoluteTolerance, tolerance * initialResidualNorm);
  let iterations = 0;
  let residualNorm = initialResidualNorm;
  let converged = false;

  for (iterations = 1; iterations <= maxIterations; iterations += 1) {
    const ad = multiplySparseMatrixVector(matrix, direction);
    const denom = dot(direction, ad);
    if (Math.abs(denom) <= 1e-30) {
      break;
    }

    const alpha = rzOld / denom;
    axpy(x, direction, alpha);
    axpy(residual, ad, -alpha);

    residualNorm = norm2(residual);
    if (residualNorm <= convergenceTarget) {
      converged = true;
      break;
    }

    const zNew = applyJacobiPreconditioner(residual, diagonal);
    const rzNew = dot(residual, zNew);
    const beta = rzNew / rzOld;
    direction = combineVectors(zNew, direction, beta);
    rzOld = rzNew;
  }

  return {
    solution: x,
    converged,
    iterations,
    residualNorm,
    initialResidualNorm,
  };
}

function extractSparseDiagonal(matrix: SparseMatrix): Float64Array {
  const diagonal = new Float64Array(matrix.size);
  for (let i = 0; i < matrix.size; i += 1) {
    diagonal[i] = matrix.rows[i].get(i) ?? 0;
  }
  return diagonal;
}

function applyJacobiPreconditioner(
  vector: Float64Array,
  diagonal: Float64Array,
): Float64Array {
  const result = new Float64Array(vector.length);
  for (let i = 0; i < vector.length; i += 1) {
    const d = diagonal[i];
    result[i] = Math.abs(d) > 1e-30 ? vector[i] / d : vector[i];
  }
  return result;
}

function dot(a: Float64Array, b: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

function norm2(a: Float64Array): number {
  return Math.sqrt(dot(a, a));
}

function axpy(target: Float64Array, source: Float64Array, scale: number): void {
  for (let i = 0; i < target.length; i += 1) {
    target[i] += scale * source[i];
  }
}

function combineVectors(
  a: Float64Array,
  b: Float64Array,
  scaleB: number,
): Float64Array<ArrayBuffer> {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i += 1) {
    result[i] = a[i] + scaleB * b[i];
  }
  return result;
}
