import { describe, expect, it } from 'vitest';
import { computeMindlinQ4ElementStiffness } from '../solver/core/element';
import { assembleWheelPatchLoads } from '../solver/loads/patch';
import { generateWheelPatches } from '../solver/loads/vehicle';
import { runFixedPositionAnalysis } from '../solver/runFixedPositionAnalysis';
import {
  ZERO_SKEW_CHARACTERIZATION_ELEMENT_NODES,
  ZERO_SKEW_CHARACTERIZATION_EXPECTED,
  ZERO_SKEW_CHARACTERIZATION_MATERIAL,
  ZERO_SKEW_CHARACTERIZATION_MODEL,
} from '../solver/benchmarks/zeroSkewCharacterizationFixture';

const PURE_RELATIVE_TOLERANCE = 1e-12;
const SOLVE_RELATIVE_TOLERANCE = 1e-9;
const ROUND_OFF_MULTIPLIER = 128;

function scaledRoundOffFloor(expected: readonly number[]): number {
  const scale = Math.max(...expected.map((value) => Math.abs(value)), Number.MIN_VALUE);
  return ROUND_OFF_MULTIPLIER * Number.EPSILON * scale;
}

function expectArrayClose(
  label: string,
  actual: ArrayLike<number>,
  expected: readonly number[],
  relativeTolerance: number,
  absoluteTolerance: number,
): void {
  expect(actual.length, `${label} length`).toBe(expected.length);
  expected.forEach((expectedValue, index) => {
    const tolerance = Math.max(
      absoluteTolerance,
      relativeTolerance * Math.abs(expectedValue),
    );
    expect(
      Math.abs(actual[index] - expectedValue),
      `${label}[${index}] expected ${expectedValue} within ${tolerance}`,
    ).toBeLessThanOrEqual(tolerance);
  });
}

describe('zero-skew characterization', () => {
  it('records the deliberate MITC4 rectangular baseline without claiming validation', () => {
    const elementStiffness = computeMindlinQ4ElementStiffness(
      ZERO_SKEW_CHARACTERIZATION_ELEMENT_NODES,
      ZERO_SKEW_CHARACTERIZATION_MATERIAL,
      ZERO_SKEW_CHARACTERIZATION_MODEL.slab.thickness,
    );
    const result = runFixedPositionAnalysis(ZERO_SKEW_CHARACTERIZATION_MODEL);
    const loads = assembleWheelPatchLoads(
      result.mesh,
      generateWheelPatches(
        ZERO_SKEW_CHARACTERIZATION_MODEL.vehicle,
        ZERO_SKEW_CHARACTERIZATION_MODEL.slab,
      ),
      result.diagnostics.totalDofs,
    );
    const expected = ZERO_SKEW_CHARACTERIZATION_EXPECTED;

    expectArrayClose(
      'element stiffness',
      elementStiffness,
      expected.elementStiffness,
      PURE_RELATIVE_TOLERANCE,
      scaledRoundOffFloor(expected.elementStiffness),
    );
    expectArrayClose(
      'assembled patch vector',
      loads.globalLoadVector,
      expected.globalLoadVector,
      PURE_RELATIVE_TOLERANCE,
      scaledRoundOffFloor(expected.globalLoadVector),
    );

    const expectedW = expected.nodalDisplacements.map((node) => node.w);
    const solveAbsoluteTolerance = Math.max(
      ZERO_SKEW_CHARACTERIZATION_MODEL.options?.cgAbsoluteTolerance ?? 0,
      scaledRoundOffFloor(expectedW),
    );
    expectArrayClose(
      'nodal w',
      result.nodalDisplacements.map((node) => node.w),
      expectedW,
      SOLVE_RELATIVE_TOLERANCE,
      solveAbsoluteTolerance,
    );
    expect(result.nodalDisplacements.map(({ nodeId, x, y }) => ({ nodeId, x, y }))).toEqual(
      expected.nodalDisplacements.map(({ nodeId, x, y }) => ({ nodeId, x, y })),
    );
    expectArrayClose(
      'nodal rx',
      result.nodalDisplacements.map((node) => node.rx),
      expected.nodalDisplacements.map((node) => node.rx),
      SOLVE_RELATIVE_TOLERANCE,
      solveAbsoluteTolerance,
    );
    expectArrayClose(
      'nodal ry',
      result.nodalDisplacements.map((node) => node.ry),
      expected.nodalDisplacements.map((node) => node.ry),
      SOLVE_RELATIVE_TOLERANCE,
      solveAbsoluteTolerance,
    );

    expect(result.supportReactions.map((reaction) => {
      const {
        value: _value,
        springStiffness: _springStiffness,
        ...identity
      } = reaction;
      return identity;
    })).toEqual(
      expected.supportReactions.map(({ value: _value, ...identity }) => identity),
    );
    const expectedReactionValues = expected.supportReactions.map((reaction) => reaction.value);
    expectArrayClose(
      'complete signed support reactions',
      result.supportReactions.map((reaction) => reaction.value),
      expectedReactionValues,
      SOLVE_RELATIVE_TOLERANCE,
      Math.max(
        ZERO_SKEW_CHARACTERIZATION_MODEL.options?.cgAbsoluteTolerance ?? 0,
        scaledRoundOffFloor(expectedReactionValues),
      ),
    );

    expectArrayClose(
      'solve summary',
      Object.values(result.summary),
      Object.values(expected.summary),
      SOLVE_RELATIVE_TOLERANCE,
      ZERO_SKEW_CHARACTERIZATION_MODEL.options?.cgAbsoluteTolerance ?? 0,
    );
    expect({
      converged: result.diagnostics.converged,
      iterations: result.diagnostics.iterations,
      totalDofs: result.diagnostics.totalDofs,
      freeDofs: result.diagnostics.freeDofs,
      fixedDofs: result.diagnostics.fixedDofs,
    }).toEqual({
      converged: expected.diagnostics.converged,
      iterations: expected.diagnostics.iterations,
      totalDofs: expected.diagnostics.totalDofs,
      freeDofs: expected.diagnostics.freeDofs,
      fixedDofs: expected.diagnostics.fixedDofs,
    });
    expectArrayClose(
      'solver residual diagnostics',
      [result.diagnostics.residualNorm, result.diagnostics.initialResidualNorm],
      [expected.diagnostics.residualNorm, expected.diagnostics.initialResidualNorm],
      SOLVE_RELATIVE_TOLERANCE,
      ZERO_SKEW_CHARACTERIZATION_MODEL.options?.cgAbsoluteTolerance ?? 0,
    );
    expectArrayClose(
      'signed vertical equilibrium',
      [result.summary.totalVerticalReaction],
      [-result.summary.totalAppliedLoadToSlab],
      SOLVE_RELATIVE_TOLERANCE,
      ZERO_SKEW_CHARACTERIZATION_MODEL.options?.cgAbsoluteTolerance ?? 0,
    );
  });
});
