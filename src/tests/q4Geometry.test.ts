import { describe, expect, it } from "vitest";
import { computeMindlinQ4ElementStiffness } from "../solver/core/element";
import {
  evaluateQ4Jacobian,
  evaluateQ4NaturalDerivatives,
  evaluateQ4PhysicalGradients,
  evaluateQ4ShapeFunctions,
  interpolateQ4Point,
  type Q4NodeCoordinates,
  type Q4Values,
} from "../solver/core/q4Geometry";
import {
  ZERO_SKEW_CHARACTERIZATION_ELEMENT_NODES,
  ZERO_SKEW_CHARACTERIZATION_EXPECTED,
  ZERO_SKEW_CHARACTERIZATION_MATERIAL,
} from "../solver/benchmarks/zeroSkewCharacterizationFixture";
import type { MeshNode } from "../solver/model/types";

const ROUND_OFF_MULTIPLIER = 128;
const PURE_RELATIVE_TOLERANCE = 1e-12;

const RECTANGULAR_Q4: Q4NodeCoordinates = [
  { x: 2, y: -1 },
  { x: 6, y: -1 },
  { x: 6, y: 3 },
  { x: 2, y: 3 },
];

const SHEARED_Q4: Q4NodeCoordinates = [
  { x: -1, y: 0 },
  { x: 3, y: 0 },
  { x: 5, y: 2 },
  { x: 1, y: 2 },
];

const NATURAL_TEST_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [-1 / Math.sqrt(3), 1 / Math.sqrt(3)],
  [0.37, -0.41],
];

function expectRoundOffClose(actual: number, expected: number): void {
  const tolerance =
    ROUND_OFF_MULTIPLIER * Number.EPSILON * Math.max(1, Math.abs(expected));
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function gradientOfNodalField(
  nodes: Q4NodeCoordinates,
  values: Q4Values,
  xi: number,
  eta: number,
): readonly [number, number] {
  const { dNdx, dNdy } = evaluateQ4PhysicalGradients(nodes, xi, eta);
  let gradientX = 0;
  let gradientY = 0;
  for (let i = 0; i < 4; i += 1) {
    gradientX += values[i] * dNdx[i];
    gradientY += values[i] * dNdy[i];
  }
  return [gradientX, gradientY];
}

function asMeshNodes(
  nodes: Q4NodeCoordinates,
): readonly [MeshNode, MeshNode, MeshNode, MeshNode] {
  return [
    { id: 0, ...nodes[0], s: nodes[0].x, t: nodes[0].y },
    { id: 1, ...nodes[1], s: nodes[1].x, t: nodes[1].y },
    { id: 2, ...nodes[2], s: nodes[2].x, t: nodes[2].y },
    { id: 3, ...nodes[3], s: nodes[3].x, t: nodes[3].y },
  ];
}

describe("shared Q4 geometry", () => {
  it("preserves the counter-clockwise natural-corner node ordering", () => {
    const corners: ReadonlyArray<readonly [number, number]> = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];

    corners.forEach(([xi, eta], nodeIndex) => {
      const expected = [0, 0, 0, 0];
      expected[nodeIndex] = 1;
      expect(evaluateQ4ShapeFunctions(xi, eta)).toEqual(expected);
    });

    const derivatives = evaluateQ4NaturalDerivatives(0.37, -0.41);
    expectRoundOffClose(derivatives.dNdxi.reduce((sum, value) => sum + value, 0), 0);
    expectRoundOffClose(derivatives.dNdeta.reduce((sum, value) => sum + value, 0), 0);
  });

  it("interpolates forward and exposes the natural-to-global Jacobian", () => {
    const rectangularPoint = interpolateQ4Point(RECTANGULAR_Q4, 0.25, -0.5);
    expectRoundOffClose(rectangularPoint.x, 4.5);
    expectRoundOffClose(rectangularPoint.y, 0);
    expect(evaluateQ4Jacobian(RECTANGULAR_Q4, 0.25, -0.5)).toEqual({
      matrix: [2, 0, 0, 2],
      determinant: 4,
    });

    const shearedPoint = interpolateQ4Point(SHEARED_Q4, 0.25, -0.5);
    expectRoundOffClose(shearedPoint.x, 2);
    expectRoundOffClose(shearedPoint.y, 0.5);
    expect(evaluateQ4Jacobian(SHEARED_Q4, 0.25, -0.5)).toEqual({
      matrix: [2, 1, 0, 1],
      determinant: 2,
    });
  });

  it.each([
    ["rectangular", RECTANGULAR_Q4],
    ["sheared", SHEARED_Q4],
  ] as const)("reproduces constant, global-x, and global-y gradients on a %s quad", (_name, nodes) => {
    const constantValues: Q4Values = [7, 7, 7, 7];
    const xValues = nodes.map((node) => node.x) as Q4Values;
    const yValues = nodes.map((node) => node.y) as Q4Values;

    for (const [xi, eta] of NATURAL_TEST_POINTS) {
      const constantGradient = gradientOfNodalField(nodes, constantValues, xi, eta);
      const xGradient = gradientOfNodalField(nodes, xValues, xi, eta);
      const yGradient = gradientOfNodalField(nodes, yValues, xi, eta);
      expectRoundOffClose(constantGradient[0], 0);
      expectRoundOffClose(constantGradient[1], 0);
      expectRoundOffClose(xGradient[0], 1);
      expectRoundOffClose(xGradient[1], 0);
      expectRoundOffClose(yGradient[0], 0);
      expectRoundOffClose(yGradient[1], 1);
    }
  });

  it("rejects clockwise ordering and a zero determinant", () => {
    const clockwise: Q4NodeCoordinates = [
      RECTANGULAR_Q4[0],
      RECTANGULAR_Q4[3],
      RECTANGULAR_Q4[2],
      RECTANGULAR_Q4[1],
    ];
    const collapsed: Q4NodeCoordinates = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];

    expect(() => evaluateQ4Jacobian(clockwise, 0, 0)).toThrow(/finite positive/);
    expect(() => evaluateQ4PhysicalGradients(collapsed, 0, 0)).toThrow(/finite positive/);
  });
});

function normalizedAntisymmetry(stiffness: Float64Array): number {
  let largestEntry = 0;
  let largestDifference = 0;
  for (let row = 0; row < 12; row += 1) {
    for (let column = 0; column < 12; column += 1) {
      largestEntry = Math.max(largestEntry, Math.abs(stiffness[row * 12 + column]));
      largestDifference = Math.max(
        largestDifference,
        Math.abs(stiffness[row * 12 + column] - stiffness[column * 12 + row]),
      );
    }
  }
  return largestDifference / Math.max(largestEntry, Number.MIN_VALUE);
}

describe("Mindlin element use of shared Q4 geometry", () => {
  it.each([
    ["rectangular", RECTANGULAR_Q4],
    ["sheared", SHEARED_Q4],
  ] as const)("retains stiffness symmetry for a %s positive-Jacobian quad", (_name, nodes) => {
    const stiffness = computeMindlinQ4ElementStiffness(
      asMeshNodes(nodes),
      ZERO_SKEW_CHARACTERIZATION_MATERIAL,
      0.3,
    );

    expect(normalizedAntisymmetry(stiffness)).toBeLessThanOrEqual(1e-12);
  });

  it("keeps the deliberate MITC4 zero-skew baseline within the scaled-roundoff policy", () => {
    const actual = computeMindlinQ4ElementStiffness(
      ZERO_SKEW_CHARACTERIZATION_ELEMENT_NODES,
      ZERO_SKEW_CHARACTERIZATION_MATERIAL,
      0.3,
    );
    const expected = ZERO_SKEW_CHARACTERIZATION_EXPECTED.elementStiffness;
    const scale = Math.max(...expected.map((value) => Math.abs(value)), Number.MIN_VALUE);
    const absoluteFloor = ROUND_OFF_MULTIPLIER * Number.EPSILON * scale;

    expect(actual.length).toBe(expected.length);
    expected.forEach((expectedValue, index) => {
      const tolerance = Math.max(
        absoluteFloor,
        PURE_RELATIVE_TOLERANCE * Math.abs(expectedValue),
      );
      expect(
        Math.abs(actual[index] - expectedValue),
        `stiffness[${index}] expected ${expectedValue} within ${tolerance}`,
      ).toBeLessThanOrEqual(tolerance);
    });
  });
});
