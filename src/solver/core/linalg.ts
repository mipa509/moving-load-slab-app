export function createVector(length: number, fill = 0): Float64Array {
  const vector = new Float64Array(length);
  if (fill !== 0) {
    vector.fill(fill);
  }
  return vector;
}

export function createMatrix(size: number): Float64Array {
  return new Float64Array(size * size);
}

export function matrixIndex(size: number, row: number, col: number): number {
  return row * size + col;
}

export function addToMatrix(
  matrix: Float64Array,
  size: number,
  row: number,
  col: number,
  value: number,
): void {
  matrix[matrixIndex(size, row, col)] += value;
}

export function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

export function multiplyMatrixVector(
  matrix: Float64Array,
  size: number,
  vector: ArrayLike<number>,
): Float64Array {
  const result = new Float64Array(size);
  for (let row = 0; row < size; row += 1) {
    let sum = 0;
    const offset = row * size;
    for (let col = 0; col < size; col += 1) {
      sum += matrix[offset + col] * vector[col];
    }
    result[row] = sum;
  }
  return result;
}

export function extractSubmatrix(
  matrix: Float64Array,
  size: number,
  indices: number[],
): Float64Array {
  const n = indices.length;
  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      out[i * n + j] = matrix[matrixIndex(size, indices[i], indices[j])];
    }
  }
  return out;
}

export function extractSubvector(
  vector: ArrayLike<number>,
  indices: number[],
): Float64Array {
  const out = new Float64Array(indices.length);
  for (let i = 0; i < indices.length; i += 1) {
    out[i] = vector[indices[i]];
  }
  return out;
}

export function choleskyDecompose(matrix: Float64Array, size: number): Float64Array {
  const lower = new Float64Array(matrix.length);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col <= row; col += 1) {
      let sum = 0;
      for (let k = 0; k < col; k += 1) {
        sum += lower[matrixIndex(size, row, k)] * lower[matrixIndex(size, col, k)];
      }

      const idx = matrixIndex(size, row, col);
      if (row === col) {
        const value = matrix[idx] - sum;
        if (value <= 0) {
          throw new Error("Stiffness matrix is not positive definite.");
        }
        lower[idx] = Math.sqrt(value);
      } else {
        lower[idx] = (matrix[idx] - sum) / lower[matrixIndex(size, col, col)];
      }
    }
  }
  return lower;
}

export function choleskySolve(
  lower: Float64Array,
  size: number,
  rhs: ArrayLike<number>,
): Float64Array {
  const y = new Float64Array(size);
  for (let row = 0; row < size; row += 1) {
    let sum = 0;
    for (let col = 0; col < row; col += 1) {
      sum += lower[matrixIndex(size, row, col)] * y[col];
    }
    y[row] = (rhs[row] - sum) / lower[matrixIndex(size, row, row)];
  }

  const x = new Float64Array(size);
  for (let row = size - 1; row >= 0; row -= 1) {
    let sum = 0;
    for (let col = row + 1; col < size; col += 1) {
      sum += lower[matrixIndex(size, col, row)] * x[col];
    }
    x[row] = (y[row] - sum) / lower[matrixIndex(size, row, row)];
  }
  return x;
}

export function maxAbs(values: ArrayLike<number>): number {
  let max = 0;
  for (let i = 0; i < values.length; i += 1) {
    max = Math.max(max, Math.abs(values[i]));
  }
  return max;
}
