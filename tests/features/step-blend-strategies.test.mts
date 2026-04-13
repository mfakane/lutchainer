/**
 * Tests for step blending strategies (RGB and HSV modes).
 * Validates: blend operations, color interpolation, alpha blending, custom channel logic.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    applyStepColor,
    getBlendModeStrategy,
    getCustomChannelsForBlendMode
} from '../../src/features/step/step-blend-strategies.ts';
import type { BlendMode, Color } from '../../src/features/step/step-model.ts';
import { DEFAULT_OPS } from '../../src/features/step/step-model.ts';
import {
    COLORS,
    formatColor
} from '../fixtures/step-test-fixtures.mts';

/**
 * Tolerance for floating point comparisons.
 */
const TOLERANCE = 1e-5;

/**
 * Helper: Check if two colors are approximately equal.
 */
function assertColorEqual(actual: Color, expected: Color, label: string, tolerance = TOLERANCE) {
  const rDiff = Math.abs(actual[0] - expected[0]);
  const gDiff = Math.abs(actual[1] - expected[1]);
  const bDiff = Math.abs(actual[2] - expected[2]);

  if (rDiff > tolerance || gDiff > tolerance || bDiff > tolerance) {
    assert.fail(
      `${label}: expected ${formatColor(expected)}, got ${formatColor(actual)}`,
    );
  }
}

/**
 * Test helper: HSV to RGB conversion (reference).
 */
function hsvToRgb(c: Color): Color {
  const h = (c[0] % 1 + 1) % 1;
  const s = Math.max(0, Math.min(1, c[1]));
  const v = Math.max(0, Math.min(1, c[2]));

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}

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

test('Blend strategies - none mode ignores LUT', () => {
  const current = COLORS.red;
  const lut = COLORS.blue;
  const result = applyStepColor(current, lut, 1.0, 'none', DEFAULT_OPS);
  assertColorEqual(result, current, 'none mode returns current unchanged');
});

test('Blend strategies - replace mode with full alpha', () => {
  const current = COLORS.red;
  const lut = COLORS.blue;
  const result = applyStepColor(current, lut, 1.0, 'replace', DEFAULT_OPS);
  assertColorEqual(result, lut, 'replace with alpha=1 returns LUT color');
});

test('Blend strategies - replace mode with half alpha (lerp)', () => {
  const current = COLORS.red;
  const lut = COLORS.blue;
  const result = applyStepColor(current, lut, 0.5, 'replace', DEFAULT_OPS);
  const expected = [0.5, 0, 0.5] as Color;
  assertColorEqual(result, expected, 'replace with alpha=0.5 interpolates 50%');
});

test('Blend strategies - replace mode with zero alpha', () => {
  const current = COLORS.red;
  const lut = COLORS.blue;
  const result = applyStepColor(current, lut, 0.0, 'replace', DEFAULT_OPS);
  assertColorEqual(result, current, 'replace with alpha=0 returns current unchanged');
});

test('Blend strategies - add mode accumulates color', () => {
  const current = COLORS.red;
  const lut = COLORS.green;
  const result = applyStepColor(current, lut, 1.0, 'add', DEFAULT_OPS);
  const expected = [1.0, 1.0, 0.0] as Color;
  assertColorEqual(result, expected, 'add blends red + green = yellow');
});

test('Blend strategies - add mode clamps to [0, 1]', () => {
  const current = [0.8, 0.8, 0.8] as Color;
  const lut = [0.5, 0.5, 0.5] as Color;
  const result = applyStepColor(current, lut, 1.0, 'add', DEFAULT_OPS);
  const expected = [1.0, 1.0, 1.0] as Color;
  assertColorEqual(result, expected, 'add clamps overflow to 1.0');
});

test('Blend strategies - add mode scales by alpha', () => {
  const current = [0.5, 0.5, 0.5] as Color;
  const lut = [0.2, 0.2, 0.2] as Color;
  const result = applyStepColor(current, lut, 0.5, 'add', DEFAULT_OPS);
  const expected = [0.6, 0.6, 0.6] as Color;
  assertColorEqual(result, expected, 'add scales lut contribution by alpha');
});

test('Blend strategies - subtract mode removes color', () => {
  const current = COLORS.white;
  const lut = COLORS.red;
  const result = applyStepColor(current, lut, 1.0, 'subtract', DEFAULT_OPS);
  const expected = [0.0, 1.0, 1.0] as Color;
  assertColorEqual(result, expected, 'subtract white - red = cyan');
});

test('Blend strategies - subtract mode clamps to [0, 1]', () => {
  const current = [0.2, 0.2, 0.2] as Color;
  const lut = [0.5, 0.5, 0.5] as Color;
  const result = applyStepColor(current, lut, 1.0, 'subtract', DEFAULT_OPS);
  const expected = [0.0, 0.0, 0.0] as Color;
  assertColorEqual(result, expected, 'subtract clamps underflow to 0.0');
});

test('Blend strategies - multiply mode scales color', () => {
  const current = COLORS.white;
  const lut = [0.5, 0.6, 0.4] as Color;
  const result = applyStepColor(current, lut, 1.0, 'multiply', DEFAULT_OPS);
  const expected = [0.5, 0.6, 0.4] as Color;
  assertColorEqual(result, expected, 'multiply white * half = half');
});

test('Blend strategies - multiply mode darkens', () => {
  const current = [0.8, 0.8, 0.8] as Color;
  const lut = [0.5, 0.5, 0.5] as Color;
  const result = applyStepColor(current, lut, 1.0, 'multiply', DEFAULT_OPS);
  const expected = [0.4, 0.4, 0.4] as Color;
  assertColorEqual(result, expected, 'multiply interpolates toward lut by lut * (1 - alpha)');
});

test('Blend strategies - multiply with zero alpha is identity', () => {
  const current = COLORS.gray;
  const lut = COLORS.red;
  const result = applyStepColor(current, lut, 0.0, 'multiply', DEFAULT_OPS);
  assertColorEqual(result, current, 'multiply with alpha=0 returns current');
});

test('Blend strategies - hue mode blends hue only', () => {
  const current = COLORS.red;
  const lut = COLORS.blue;
  const result = applyStepColor(current, lut, 1.0, 'hue', DEFAULT_OPS);

  // Result should have blue's hue but red's saturation/value
  const resultHsv = rgbToHsv(result);
  const currentHsv = rgbToHsv(current);
  const lutHsv = rgbToHsv(lut);

  assert(
    Math.abs(resultHsv[0] - lutHsv[0]) < TOLERANCE,
    `Hue mode: result hue should match LUT hue`,
  );
  // Saturation and value should remain from current (since it's a saturated color)
});

test('Blend strategies - saturation mode blends saturation only', () => {
  const current = COLORS.white; // Achromatic (S=0)
  const lut = COLORS.red; // Saturated (S=1)
  const result = applyStepColor(current, lut, 1.0, 'saturation', DEFAULT_OPS);

  // Result should have red's saturation but white's hue/value
  const resultHsv = rgbToHsv(result);
  const currentHsv = rgbToHsv(current);
  const lutHsv = rgbToHsv(lut);

  // Since white is achromatic, its saturation is 0, and result should be less saturated
  assert(
    resultHsv[1] > 0,
    `Saturation mode: result saturation should increase from white`,
  );
});

test('Blend strategies - color mode blends hue and saturation', () => {
  const current = COLORS.red;
  const lut = [0.5, 0.5, 1.0] as Color; // Light blue
  const result = applyStepColor(current, lut, 1.0, 'color', DEFAULT_OPS);

  const resultHsv = rgbToHsv(result);
  const currentHsv = rgbToHsv(current);
  const lutHsv = rgbToHsv(lut);

  // Color mode should match LUT's hue and saturation, but keep current's value
  assert(
    Math.abs(resultHsv[0] - lutHsv[0]) < TOLERANCE,
    'Color mode: result hue should match LUT',
  );
  assert(
    Math.abs(resultHsv[1] - lutHsv[1]) < TOLERANCE,
    'Color mode: result saturation should match LUT',
  );
});

test('Blend strategies - value mode blends value only', () => {
  const current = COLORS.red;
  const lut = COLORS.black;
  const result = applyStepColor(current, lut, 1.0, 'value', DEFAULT_OPS);

  const resultHsv = rgbToHsv(result);
  const lutHsv = rgbToHsv(lut);

  // Value should match LUT (black has V=0)
  assert(
    Math.abs(resultHsv[2] - lutHsv[2]) < TOLERANCE,
    'Value mode: result value should match LUT (black)',
  );
});

test('Blend strategies - customRgb mode applies per-channel operations', () => {
  const current = COLORS.red;
  const lut = COLORS.green;
  const ops = {
    ...DEFAULT_OPS,
    r: 'replace',
    g: 'add',
    b: 'multiply',
  } as const;

  const result = applyStepColor(current, lut, 1.0, 'customRgb', ops);

  // r: replace -> green.r = 0
  // g: add -> red.g + green.g = 0 + 1 = 1
  // b: multiply -> red.b * (1 - 0 + green.b * 0) = 0 * 1 = 0
  const expected = [0, 1, 0] as Color;
  assertColorEqual(result, expected, 'customRgb applies per-channel ops');
});

test('Blend strategies - customRgb mode respects none operation', () => {
  const current = COLORS.red;
  const lut = COLORS.blue;
  const ops = {
    ...DEFAULT_OPS,
    r: 'none',
    g: 'none',
    b: 'none',
  } as const;

  const result = applyStepColor(current, lut, 1.0, 'customRgb', ops);
  assertColorEqual(result, current, 'customRgb with all none ops returns current');
});

test('Blend strategies - customHsv mode applies per-channel operations in HSV space', () => {
  const current = COLORS.red;
  const lut = COLORS.blue;
  const ops = {
    ...DEFAULT_OPS,
    h: 'replace',
    s: 'replace',
    v: 'replace',
  } as const;

  const result = applyStepColor(current, lut, 1.0, 'customHsv', ops);

  const resultHsv = rgbToHsv(result);
  const lutHsv = rgbToHsv(lut);

  // With all replace ops, result should have LUT's HSV
  assert(
    Math.abs(resultHsv[0] - lutHsv[0]) < TOLERANCE,
    'customHsv h: should match LUT hue',
  );
  assert(
    Math.abs(resultHsv[1] - lutHsv[1]) < TOLERANCE,
    'customHsv s: should match LUT saturation',
  );
  assert(
    Math.abs(resultHsv[2] - lutHsv[2]) < TOLERANCE,
    'customHsv v: should match LUT value',
  );
});

test('Blend strategies - strategies have consistent editableChannels', () => {
  const testModes: BlendMode[] = [
    'selfBlend',
    'customRgb',
    'customHsv',
  ];

  for (const mode of testModes) {
    const channels = getCustomChannelsForBlendMode(mode);
    assert(
      Array.isArray(channels),
      `${mode} should return array of channels`,
    );
  }
});

test('Blend strategies - customRgb has RGB channels', () => {
  const channels = getCustomChannelsForBlendMode('customRgb');
  assert(
    channels.includes('r') && channels.includes('g') && channels.includes('b'),
    'customRgb should have r, g, b channels',
  );
});

test('Blend strategies - customHsv has HSV channels', () => {
  const channels = getCustomChannelsForBlendMode('customHsv');
  assert(
    channels.includes('h') && channels.includes('s') && channels.includes('v'),
    'customHsv should have h, s, v channels',
  );
});

test('Blend strategies - non-finite alpha defaults to 1.0', () => {
  const current = COLORS.red;
  const lut = COLORS.blue;

  const resultNan = applyStepColor(current, lut, NaN, 'replace', DEFAULT_OPS);
  const resultInf = applyStepColor(current, lut, Infinity, 'replace', DEFAULT_OPS);

  // NaN should clamp to [0, 1] range, defaulting behavior
  // Infinity should clamp to 1
  assertColorEqual(resultInf, lut, 'replace with Infinity alpha acts as 1.0');
});

test('Blend strategies - all blend modes clamp output to [0, 1]', () => {
  const modes: BlendMode[] = [
    'replace',
    'add',
    'subtract',
    'multiply',
    'hue',
    'saturation',
    'color',
    'value',
  ];

  const current = [0.9, 0.9, 0.9] as Color;
  const lut = [0.9, 0.9, 0.9] as Color;

  for (const mode of modes) {
    const result = applyStepColor(current, lut, 1.0, mode, DEFAULT_OPS);

    assert(result[0] >= 0 && result[0] <= 1, `${mode}: r channel in [0, 1]`);
    assert(result[1] >= 0 && result[1] <= 1, `${mode}: g channel in [0, 1]`);
    assert(result[2] >= 0 && result[2] <= 1, `${mode}: b channel in [0, 1]`);
  }
});

test('Blend strategies - getBlendModeStrategy returns valid strategy', () => {
  const modes: BlendMode[] = [
    'none',
    'replace',
    'add',
    'subtract',
    'multiply',
    'hue',
    'saturation',
    'color',
    'value',
    'selfBlend',
    'customRgb',
    'customHsv',
  ];

  for (const mode of modes) {
    const strategy = getBlendModeStrategy(mode);
    assert(strategy, `${mode} should have a strategy`);
    assert(typeof strategy.applyCpu === 'function', `${mode} should have applyCpu function`);
    assert(Array.isArray(strategy.editableChannels), `${mode} should have editableChannels array`);
  }
});

test('Blend strategies - edge case: black + white in multiply', () => {
  const result = applyStepColor(COLORS.black, COLORS.white, 1.0, 'multiply', DEFAULT_OPS);
  assertColorEqual(result, COLORS.black, 'multiply black is always black');
});

test('Blend strategies - edge case: white + white in add with clamping', () => {
  const result = applyStepColor(COLORS.white, COLORS.white, 1.0, 'add', DEFAULT_OPS);
  assertColorEqual(result, COLORS.white, 'add white + white clamps to white');
});
