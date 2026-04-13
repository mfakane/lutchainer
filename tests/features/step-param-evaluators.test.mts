/**
 * Tests for step parameter evaluators.
 * Validates: RGB/HSV extraction, parameter evaluation, custom params, edge cases.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import type { Color } from '../../src/features/step/step-model.ts';
import {
    PARAM_EVALUATORS,
    evaluateStepParam,
} from '../../src/features/step/step-param-evaluators.ts';
import {
    COLORS,
    createTestContext,
    formatColor
} from '../fixtures/step-test-fixtures.mts';

/**
 * Helper: RGB/HSV conversion for reference (should match implementation).
 */
function rgbToHsv(c: Color): Color {
  const r = c[0];
  const g = c[1];
  const b = c[2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d > 1e-6) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  const s = max <= 1e-6 ? 0 : d / max;
  const v = max;
  return [
    Math.max(0, Math.min(1, h)),
    Math.max(0, Math.min(1, s)),
    Math.max(0, Math.min(1, v)),
  ];
}

test('Parameter evaluators - RGB channel extraction', () => {
  const color = COLORS.red;
  const ctx = createTestContext();

  const r = evaluateStepParam('r', color, ctx);
  const g = evaluateStepParam('g', color, ctx);
  const b = evaluateStepParam('b', color, ctx);

  assert.equal(r, 1, 'red channel should be 1');
  assert.equal(g, 0, 'green channel should be 0');
  assert.equal(b, 0, 'blue channel should be 0');
});

test('Parameter evaluators - RGB from gray', () => {
  const color = COLORS.gray;
  const ctx = createTestContext();

  const r = evaluateStepParam('r', color, ctx);
  const g = evaluateStepParam('g', color, ctx);
  const b = evaluateStepParam('b', color, ctx);

  assert.equal(r, 0.5);
  assert.equal(g, 0.5);
  assert.equal(b, 0.5);
});

test('Parameter evaluators - HSV hue extraction', () => {
  const testCases: Array<[Color, number, string]> = [
    [COLORS.red, 0, 'red hue'],
    [COLORS.green, 1 / 3, 'green hue'],
    [COLORS.blue, 2 / 3, 'blue hue'],
    [COLORS.cyan, 0.5, 'cyan hue'],
    [COLORS.magenta, 5 / 6, 'magenta hue'],
    [COLORS.yellow, 1 / 6, 'yellow hue'],
    [COLORS.white, 0, 'white (achromatic) hue'],
    [COLORS.black, 0, 'black (achromatic) hue'],
    [COLORS.gray, 0, 'gray (achromatic) hue'],
  ];

  const ctx = createTestContext();

  for (const [color, expectedHue, label] of testCases) {
    const h = evaluateStepParam('h', color, ctx);
    const tolerance = label.includes('achromatic') ? 0.01 : 1e-5;
    assert(
      Math.abs(h - expectedHue) < tolerance,
      `HSV hue ${label}: expected ${expectedHue.toFixed(6)}, got ${h.toFixed(6)}`,
    );
  }
});

test('Parameter evaluators - HSV saturation extraction', () => {
  const testCases: Array<[Color, number, string]> = [
    [COLORS.red, 1.0, 'pure red saturation'],
    [COLORS.white, 0.0, 'white saturation'],
    [COLORS.black, 0.0, 'black saturation'],
    [COLORS.gray, 0.0, 'gray saturation'],
    [
      [0.5, 1.0, 0.5],
      0.5,
      'medium saturation',
    ],
  ];

  const ctx = createTestContext();

  for (const [color, expectedSat, label] of testCases) {
    const s = evaluateStepParam('s', color, ctx);
    assert(
      Math.abs(s - expectedSat) < 1e-5,
      `HSV saturation ${label}: expected ${expectedSat.toFixed(6)}, got ${s.toFixed(6)}`,
    );
  }
});

test('Parameter evaluators - HSV value extraction', () => {
  const testCases: Array<[Color, number, string]> = [
    [COLORS.black, 0.0, 'black value'],
    [COLORS.white, 1.0, 'white value'],
    [COLORS.gray, 0.5, 'gray value'],
    [COLORS.red, 1.0, 'red value'],
    [[0.5, 0.25, 0.1], 0.5, 'max component as value'],
  ];

  const ctx = createTestContext();

  for (const [color, expectedVal, label] of testCases) {
    const v = evaluateStepParam('v', color, ctx);
    assert(
      Math.abs(v - expectedVal) < 1e-5,
      `HSV value ${label}: expected ${expectedVal.toFixed(6)}, got ${v.toFixed(6)}`,
    );
  }
});

test('Parameter evaluators - context light/specular parameters', () => {
  const ctx = createTestContext({
    lambert: 0.75,
    specular: 0.25,
    halfLambert: 0.85,
    fresnel: 0.4,
    facing: 0.6,
    nDotH: 0.3,
    linearDepth: 0.5,
  });

  const color = COLORS.white;

  assert.equal(evaluateStepParam('lightness', color, ctx), 0.75);
  assert.equal(evaluateStepParam('specular', color, ctx), 0.25);
  assert.equal(evaluateStepParam('halfLambert', color, ctx), 0.85);
  assert.equal(evaluateStepParam('fresnel', color, ctx), 0.4);
  assert.equal(evaluateStepParam('facing', color, ctx), 0.6);
  assert.equal(evaluateStepParam('nDotH', color, ctx), 0.3);
  assert.equal(evaluateStepParam('linearDepth', color, ctx), 0.5);
});

test('Parameter evaluators - texture coordinates', () => {
  const ctx = createTestContext({
    texU: 0.25,
    texV: 0.75,
  });

  const color = COLORS.white;

  assert.equal(evaluateStepParam('texU', color, ctx), 0.25);
  assert.equal(evaluateStepParam('texV', color, ctx), 0.75);
});

test('Parameter evaluators - zero and one constants', () => {
  const ctx = createTestContext();
  const color = COLORS.red;

  assert.equal(evaluateStepParam('zero', color, ctx), 0);
  assert.equal(evaluateStepParam('one', color, ctx), 1);
});

test('Parameter evaluators - custom parameter clamping', () => {
  const ctx = createTestContext({
    customParamValues: {
      'gain': 0.5,
      'bias': 1.5, // Should be clamped to 1.0
      'negative': -0.5, // Should be clamped to 0.0
    },
  });

  const color = COLORS.white;

  assert.equal(evaluateStepParam('custom:gain', color, ctx), 0.5, 'custom param within range');
  assert.equal(evaluateStepParam('custom:bias', color, ctx), 1.0, 'custom param clamped to max');
  assert.equal(evaluateStepParam('custom:negative', color, ctx), 0.0, 'custom param clamped to min');
});

test('Parameter evaluators - missing custom parameter defaults to 0', () => {
  const ctx = createTestContext();
  const color = COLORS.white;

  assert.equal(evaluateStepParam('custom:missing', color, ctx), 0);
});

test('Parameter evaluators - non-finite values default to 0', () => {
  const ctx = createTestContext({
    customParamValues: {
      'invalid': NaN,
      'infinity': Infinity,
    },
  });

  const color = COLORS.white;

  assert.equal(evaluateStepParam('custom:invalid', color, ctx), 0);
  assert.equal(evaluateStepParam('custom:infinity', color, ctx), 0);
});

test('Parameter evaluators - HSV round-trip consistency (RGB → HSV → RGB)', () => {
  const testColors = [
    COLORS.red,
    COLORS.green,
    COLORS.blue,
    COLORS.cyan,
    COLORS.magenta,
    COLORS.yellow,
    COLORS.white,
    COLORS.black,
    COLORS.gray,
    [0.1, 0.5, 0.9] as Color,
    [0.9, 0.1, 0.5] as Color,
  ];

  const ctx = createTestContext();

  for (const originalColor of testColors) {
    const hsv = [
      evaluateStepParam('h', originalColor, ctx),
      evaluateStepParam('s', originalColor, ctx),
      evaluateStepParam('v', originalColor, ctx),
    ] as Color;

    // Verify HSV matches reference implementation
    const refHsv = rgbToHsv(originalColor);
    assert(
      Math.abs(hsv[0] - refHsv[0]) < 1e-5
        && Math.abs(hsv[1] - refHsv[1]) < 1e-5
        && Math.abs(hsv[2] - refHsv[2]) < 1e-5,
      `HSV consistency for ${formatColor(originalColor)}: expected ${formatColor(refHsv)}, got ${formatColor(hsv)}`,
    );
  }
});

test('Parameter evaluators - evaluator requires entries are consistent', () => {
  for (const [paramName, evaluator] of Object.entries(PARAM_EVALUATORS)) {
    assert(
      Array.isArray(evaluator.requires),
      `Evaluator '${paramName}' requires should be an array`,
    );
    assert(
      typeof evaluator.evaluate === 'function',
      `Evaluator '${paramName}' evaluate should be a function`,
    );
  }
});

test('Parameter evaluators - HSV edge case: hue wrapping', () => {
  // Colors close to hue boundary (0/360 degrees)
  const almostRed = [1.0, 0.0, 0.01] as Color;
  const almostPurple = [0.99, 0.0, 1.0] as Color;

  const ctx = createTestContext();

  const hue1 = evaluateStepParam('h', almostRed, ctx);
  const hue2 = evaluateStepParam('h', almostPurple, ctx);

  // Both should be close to either 0 or 1 (hue 0 = red, hue ~1 = purple)
  assert(
    hue1 < 0.1 || hue1 > 0.9,
    `Almost-red hue should be near 0 or 1, got ${hue1.toFixed(6)}`,
  );
  assert(
    hue2 > 0.7 && hue2 < 0.9,
    `Almost-purple hue should stay in the purple range, got ${hue2.toFixed(6)}`,
  );
});

test('Parameter evaluators - context independence for RGB extractions', () => {
  const ctx1 = createTestContext({ lambert: 0.1 });
  const ctx2 = createTestContext({ lambert: 0.9 });
  const color = [0.3, 0.6, 0.2] as Color;

  // RGB extractions should not depend on context
  assert.equal(evaluateStepParam('r', color, ctx1), evaluateStepParam('r', color, ctx2));
  assert.equal(evaluateStepParam('g', color, ctx1), evaluateStepParam('g', color, ctx2));
  assert.equal(evaluateStepParam('b', color, ctx1), evaluateStepParam('b', color, ctx2));
});

test('Parameter evaluators - context independence for HSV extractions', () => {
  const ctx1 = createTestContext({ specular: 0.2 });
  const ctx2 = createTestContext({ specular: 0.9 });
  const color = [0.4, 0.2, 0.7] as Color;

  // HSV extractions should not depend on context
  assert.equal(evaluateStepParam('h', color, ctx1), evaluateStepParam('h', color, ctx2));
  assert.equal(evaluateStepParam('s', color, ctx1), evaluateStepParam('s', color, ctx2));
  assert.equal(evaluateStepParam('v', color, ctx1), evaluateStepParam('v', color, ctx2));
});
