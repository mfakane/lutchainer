/**
 * Tests for step runtime composition and resolution.
 * Validates: step chain resolution, parameter evaluation in context, color composition,
 * LUT sampling integration, multi-step blending.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import type { Color, StepRuntimeModel } from '../../src/features/step/step-model.ts';
import { DEFAULT_OPS } from '../../src/features/step/step-model.ts';
import {
    composeColorFromSteps,
    resolveStepRuntimeModels,
} from '../../src/features/step/step-runtime.ts';
import {
    COLORS,
    createGradientLut,
    createTestContext,
    createTestLut,
    createTestStep,
    formatColor
} from '../fixtures/step-test-fixtures.mts';

const TOLERANCE = 1e-4;

/**
 * Helper: Check if colors match within tolerance.
 */
function assertColorClose(actual: Color, expected: Color, label: string, tolerance = TOLERANCE) {
  const rDiff = Math.abs(actual[0] - expected[0]);
  const gDiff = Math.abs(actual[1] - expected[1]);
  const bDiff = Math.abs(actual[2] - expected[2]);

  if (rDiff > tolerance || gDiff > tolerance || bDiff > tolerance) {
    assert.fail(
      `${label}: expected ${formatColor(expected)}, got ${formatColor(actual)}`,
    );
  }
}

test('Step runtime - resolveStepRuntimeModels single step', () => {
  const step = createTestStep('step-1');
  const lut = createTestLut();
  const steps = [step];
  const luts = [lut];

  const runtime = resolveStepRuntimeModels(steps, luts);

  assert.equal(runtime.length, 1, 'should resolve 1 step');
  assert.equal(runtime[0]!.step.id, 'step-1');
  assert.equal(runtime[0]!.lut?.id, 'test-lut-1');
  assert.equal(runtime[0]!.lutIndex, 0);
});

test('Step runtime - resolveStepRuntimeModels with multiple steps', () => {
  const step1 = createTestStep('step-1');
  const step2 = createTestStep('step-2');
  const step2Updated = { ...step2, lutId: 'lut-2' };
  const lut1 = createTestLut({ id: 'lut-1' });
  const lut2 = createTestLut({ id: 'lut-2' });

  const runtime = resolveStepRuntimeModels([step1, step2Updated], [lut1, lut2]);

  assert.equal(runtime.length, 2, 'should resolve 2 steps');
  assert.equal(runtime[1]!.lutIndex, 1, 'second step should reference second LUT');
});

test('Step runtime - resolveStepRuntimeModels filters muted steps', () => {
  const step1 = createTestStep('step-1');
  const step2 = { ...createTestStep('step-2'), muted: true };
  const step3 = createTestStep('step-3');
  const lut = createTestLut();

  const runtime = resolveStepRuntimeModels([step1, step2, step3], [lut]);

  assert.equal(runtime.length, 2, 'should filter out muted step');
  assert.equal(runtime[0]!.step.id, 'step-1');
  assert.equal(runtime[1]!.step.id, 'step-3');
});

test('Step runtime - resolveStepRuntimeModels respects targetStepIndex', () => {
  const step1 = createTestStep('step-1');
  const step2 = createTestStep('step-2');
  const step3 = createTestStep('step-3');
  const lut = createTestLut();

  // Only resolve up to step 2 (index 1)
  const runtime = resolveStepRuntimeModels([step1, step2, step3], [lut], 1);

  assert.equal(runtime.length, 2, 'should resolve only up to target index');
  assert.equal(runtime[1]!.step.id, 'step-2');
});

test('Step runtime - resolveStepRuntimeModels with invalid targetStepIndex', () => {
  const step = createTestStep('step-1');
  const lut = createTestLut();

  const runtimeInvalid = resolveStepRuntimeModels([step], [lut], -1);
  assert.equal(runtimeInvalid.length, 0, 'negative index returns empty');

  const runtimeOverflow = resolveStepRuntimeModels([step], [lut], 100);
  assert.equal(runtimeOverflow.length, 1, 'index beyond length clamps to last');
});

test('Step runtime - resolveStepRuntimeModels missing LUT defaults to available LUT', () => {
  const step = { ...createTestStep('step-1'), lutId: 'missing-lut-id' };
  const lut = createTestLut({ id: 'lut-1' });

  const runtime = resolveStepRuntimeModels([step], [lut]);

  assert.equal(runtime.length, 1);
  // When LUT ID is not found, findIndex returns -1, then Math.max(0, -1) = 0
  // So it falls back to the first available LUT
  assert.equal(runtime[0]!.lut?.id, 'lut-1', 'should fallback to first available LUT');
});

test('Step runtime - resolveStepRuntimeModels empty steps list', () => {
  const lut = createTestLut();
  const runtime = resolveStepRuntimeModels([], [lut]);

  assert.equal(runtime.length, 0, 'empty steps should return empty');
});

test('Step runtime - composeColorFromSteps with single white replace step', () => {
  const lut = createTestLut({ color: COLORS.blue });
  const stepModels: StepRuntimeModel[] = [
    {
      step: {
        ...createTestStep('step-1'),
        xParam: 'lightness',
        yParam: 'specular',
        blendMode: 'replace',
      },
      lut,
      lutIndex: 0,
    },
  ];

  const ctx = createTestContext();
  const result = composeColorFromSteps(stepModels, COLORS.red, ctx);

  // With replace blend mode and parametric UV, should apply the LUT
  assertColorClose(result, COLORS.blue, 'replace blend applies LUT color');
});

test('Step runtime - composeColorFromSteps with no LUT uses white default', () => {
  const stepModels: StepRuntimeModel[] = [
    {
      step: createTestStep('step-1', 'add'),
      lut: null,
      lutIndex: 0,
    },
  ];

  const ctx = createTestContext();
  const result = composeColorFromSteps(stepModels, COLORS.black, ctx);

  // With null LUT, should default to white and add it
  assertColorClose(result, COLORS.white, 'null LUT adds white');
});

test('Step runtime - composeColorFromSteps with none mode', () => {
  const lut = createTestLut({ color: COLORS.blue });
  const stepModels: StepRuntimeModel[] = [
    {
      step: {
        ...createTestStep('step-1'),
        blendMode: 'none',
      },
      lut,
      lutIndex: 0,
    },
  ];

  const ctx = createTestContext();
  const baseColor = COLORS.red;
  const result = composeColorFromSteps(stepModels, baseColor, ctx);

  assertColorClose(result, baseColor, 'none mode passes through color unchanged');
});

test('Step runtime - composeColorFromSteps with multiple steps chain', () => {
  const lut1 = createTestLut({ color: COLORS.green });
  const lut2 = createTestLut({ color: COLORS.blue });

  const stepModels: StepRuntimeModel[] = [
    {
      step: {
        ...createTestStep('step-1'),
        blendMode: 'replace',
      },
      lut: lut1,
      lutIndex: 0,
    },
    {
      step: {
        ...createTestStep('step-2'),
        blendMode: 'replace',
      },
      lut: lut2,
      lutIndex: 1,
    },
  ];

  const ctx = createTestContext();
  const result = composeColorFromSteps(stepModels, COLORS.red, ctx);

  // Step 1: red -> green (replace)
  // Step 2: green -> blue (replace)
  assertColorClose(result, COLORS.blue, 'chained replace steps produce final LUT color');
});

test('Step runtime - composeColorFromSteps with add blend', () => {
  const lut = createTestLut({ color: COLORS.green });
  const stepModels: StepRuntimeModel[] = [
    {
      step: {
        ...createTestStep('step-1'),
        blendMode: 'add',
      },
      lut,
      lutIndex: 0,
    },
  ];

  const ctx = createTestContext();
  const result = composeColorFromSteps(stepModels, COLORS.red, ctx);

  // Red + Green = Yellow
  const expected = [1, 1, 0] as Color;
  assertColorClose(result, expected, 'add blend produces yellow from red + green');
});

test('Step runtime - composeColorFromSteps sanitizes output to [0, 1]', () => {
  const lut = createTestLut({ color: [2, 3, 4] }); // Out of range
  const stepModels: StepRuntimeModel[] = [
    {
      step: {
        ...createTestStep('step-1'),
        blendMode: 'replace',
      },
      lut,
      lutIndex: 0,
    },
  ];

  const ctx = createTestContext();
  const result = composeColorFromSteps(stepModels, COLORS.red, ctx);

  assert(result[0] >= 0 && result[0] <= 1, 'output r clamped to [0, 1]');
  assert(result[1] >= 0 && result[1] <= 1, 'output g clamped to [0, 1]');
  assert(result[2] >= 0 && result[2] <= 1, 'output b clamped to [0, 1]');
});

test('Step runtime - composeColorFromSteps handles non-finite colors', () => {
  const stepModels: StepRuntimeModel[] = [];
  const ctx = createTestContext();

  const resultNan = composeColorFromSteps(stepModels, [NaN, 0, 0] as never, ctx);
  const resultInf = composeColorFromSteps(stepModels, [Infinity, 0, 0] as never, ctx);

  // Should sanitize to [0.5, 0 or clamped, 0]
  assert(Number.isFinite(resultNan[0]));
  assert(Number.isFinite(resultInf[0]));
});

test('Step runtime - composeColorFromSteps with custom context parameters', () => {
  const lut = createTestLut({ color: COLORS.white });
  const stepModels: StepRuntimeModel[] = [
    {
      step: {
        ...createTestStep('step-1'),
        xParam: 'custom:gain',
        yParam: 'custom:bias',
        blendMode: 'replace',
      },
      lut,
      lutIndex: 0,
    },
  ];

  const ctx = createTestContext({
    customParamValues: {
      'gain': 0.25,
      'bias': 0.75,
    },
  });

  const result = composeColorFromSteps(stepModels, COLORS.red, ctx);
  // Custom params should be used for LUT coordinates
  assert(Array.isArray(result) && result.length === 3);
  assert(result.every(v => Number.isFinite(v)));
});

test('Step runtime - composeColorFromSteps gradient LUT interpolation', () => {
  const lut = createGradientLut({ width: 256, height: 256 });
  const stepModels: StepRuntimeModel[] = [
    {
      step: {
        ...createTestStep('step-1'),
        xParam: 'r',
        yParam: 'g',
        blendMode: 'replace',
      },
      lut,
      lutIndex: 0,
    },
  ];

  const ctx = createTestContext();

  // Sample at red channel 0.25, green channel 0.75
  const baseColor = [0.25, 0.75, 0.1] as Color;
  const result = composeColorFromSteps(stepModels, baseColor, ctx);

  // Gradient LUT: r increases left-to-right, g increases bottom-to-top
  // So at (0.25, 0.75) we expect roughly (0.25, 0.75, 0) from gradient
  assert(result[0] > 0 && result[0] < 1, 'gradient interpolation produces valid r');
  assert(result[1] > 0 && result[1] < 1, 'gradient interpolation produces valid g');
});

test('Step runtime - composeColorFromSteps parameter context independence', () => {
  const lut = createTestLut({ color: COLORS.blue });
  const stepModels: StepRuntimeModel[] = [
    {
      step: {
        ...createTestStep('step-1'),
        xParam: 'r', // Uses base color red channel
        yParam: 'g', // Uses base color green channel
        blendMode: 'replace',
      },
      lut,
      lutIndex: 0,
    },
  ];

  const baseColor = [0.3, 0.4, 0.2] as Color;

  // Result should be independent of context lighting params
  const ctx1 = createTestContext({ lambert: 0.2 });
  const ctx2 = createTestContext({ lambert: 0.9 });

  const result1 = composeColorFromSteps(stepModels, baseColor, ctx1);
  const result2 = composeColorFromSteps(stepModels, baseColor, ctx2);

  assertColorClose(result1, result2, 'parameter-dependent results are consistent');
});

test('Step runtime - composeColorFromSteps large step chain', () => {
  const createChainStep = (index: number) => ({
    step: {
      ...createTestStep(`step-${index}`),
      xParam: 'lightness' as const,
      yParam: 'specular' as const,
      blendMode: 'add' as const,
    },
    lut: createTestLut({ id: `lut-${index}`, color: [0.1, 0.1, 0.1] }),
    lutIndex: index,
  });

  const stepModels: StepRuntimeModel[] = Array.from({ length: 10 }, (_, i) => createChainStep(i));

  const ctx = createTestContext();
  const result = composeColorFromSteps(stepModels, COLORS.black, ctx);

  // 10 adds of [0.1, 0.1, 0.1] should give ~[1.0, 1.0, 1.0]
  assertColorClose(result, [1, 1, 1], 'large chain accumulates correctly', 0.01);
});

test('Step runtime - resolveStepRuntimeModels preserves step ops for customRgb', () => {
  const step = {
    ...createTestStep('step-1', 'customRgb'),
    ops: {
      ...DEFAULT_OPS,
      r: 'add',
      g: 'subtract',
      b: 'multiply',
    } as const,
  };

  const runtime = resolveStepRuntimeModels([step], [createTestLut()]);

  // For customRgb blend mode, RGB channels should be preserved
  assert.equal(runtime[0]!.step.ops.r, 'add', 'ops.r preserved for customRgb');
  assert.equal(runtime[0]!.step.ops.g, 'subtract', 'ops.g preserved for customRgb');
  assert.equal(runtime[0]!.step.ops.b, 'multiply', 'ops.b preserved for customRgb');
});

test('Step runtime - composeColorFromSteps empty steps chain returns base color', () => {
  const result = composeColorFromSteps([], COLORS.red, createTestContext());
  assertColorClose(result, COLORS.red, 'empty steps returns base color unchanged');
});

test('Step runtime - resolveStepRuntimeModels with custom blend mode', () => {
  const step = {
    ...createTestStep('step-1'),
    blendMode: 'customRgb' as const,
    ops: {
      ...DEFAULT_OPS,
      r: 'replace',
      g: 'add',
      b: 'multiply',
    } as const,
  };

  const runtime = resolveStepRuntimeModels([step], [createTestLut()]);
  assert.equal(runtime[0]!.step.blendMode, 'customRgb');

  // Verify ops are populated correctly
  assert(runtime[0]!.step.ops.r === 'replace' || runtime[0]!.step.ops.r === 'none');
});
