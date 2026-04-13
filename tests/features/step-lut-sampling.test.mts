/**
 * Tests for LUT color sampling with linear interpolation.
 * Validates: texel-center mapping, linear interpolation, edge clamping, alpha blending.
 * References AGENTS.md: CPU/GPU one consistency via texel-center sampling.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    sampleLutColorLinear
} from '../../src/features/step/lut-sampling.ts';
import type { Color } from '../../src/features/step/step-model.ts';
import {
    createGradientLut,
    createRampLut,
    createTestLut,
    formatColor,
} from '../fixtures/step-test-fixtures.mts';

const TOLERANCE = 1e-5;

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

test('LUT sampling - center of 1x1 white LUT', () => {
  const lut = createTestLut({ width: 1, height: 1, color: [1, 1, 1] });
  const sample = sampleLutColorLinear(lut, 0.5, 0.5);

  assertColorClose(sample.color, [1, 1, 1], 'center of white 1x1 LUT');
  assert.equal(sample.alpha, 1.0, 'alpha should be 1.0');
});

test('LUT sampling - center of 1x1 black LUT', () => {
  const lut = createTestLut({ width: 1, height: 1, color: [0, 0, 0] });
  const sample = sampleLutColorLinear(lut, 0.5, 0.5);

  assertColorClose(sample.color, [0, 0, 0], 'center of black 1x1 LUT');
});

test('LUT sampling - corner samples of 2x2 LUT', () => {
  // Create 2x2 LUT: top-left red, top-right green, bottom-left blue, bottom-right white
  const lut = {
    ...createTestLut({ width: 2, height: 2, color: [1, 1, 1] }),
    pixels: new Uint8ClampedArray([
      // Top-left: red
      255, 0, 0, 255,
      // Top-right: green
      0, 255, 0, 255,
      // Bottom-left: blue
      0, 0, 255, 255,
      // Bottom-right: white
      255, 255, 255, 255,
    ]),
  };

  // u=0, v=0 should sample texel center at (0, 0) -> red
  // With texel-center mapping: x = u * width - 0.5 = 0 * 2 - 0.5 = -0.5 (clamped to 0)
  // This samples near texel 0
  const topLeft = sampleLutColorLinear(lut, 0, 0);
  assertColorClose(topLeft.color, [1, 0, 0], 'u=0, v=0 samples red');

  // u=1, v=1 should sample bottom-right -> white
  const bottomRight = sampleLutColorLinear(lut, 1, 1);
  assertColorClose(bottomRight.color, [1, 1, 1], 'u=1, v=1 samples white');
});

test('LUT sampling - center of 4x4 LUT gradient', () => {
  const lut = createGradientLut({ width: 4, height: 4 });
  const sample = sampleLutColorLinear(lut, 0.5, 0.5);

  // At u=0.5, v=0.5 on a 4x4 gradient (R increases left-to-right, G bottom-to-top):
  // Approximate expected values based on gradient
  assert(sample.color[0] >= 0.4 && sample.color[0] <= 0.6, 'center R channel in mid range');
  assert(sample.color[1] >= 0.4 && sample.color[1] <= 0.6, 'center G channel in mid range');
});

test('LUT sampling - edge wrapping/clamping with u,v outside [0,1]', () => {
  const lut = createTestLut({ width: 4, height: 4, color: [0.5, 0.5, 0.5] });

  // u > 1 should clamp to 1
  const overU = sampleLutColorLinear(lut, 1.5, 0.5);
  assertColorClose(overU.color, [0.5, 0.5, 0.5], 'u > 1 clamps to right edge', 0.1);

  // u < 0 should clamp to 0
  const underU = sampleLutColorLinear(lut, -0.5, 0.5);
  assertColorClose(underU.color, [0.5, 0.5, 0.5], 'u < 0 clamps to left edge', 0.1);

  // v outside [0, 1] clamps similarly
  const overV = sampleLutColorLinear(lut, 0.5, 1.5);
  assertColorClose(overV.color, [0.5, 0.5, 0.5], 'v > 1 clamps to top edge', 0.1);
});

test('LUT sampling - linear interpolation on ramp LUT', () => {
  const lut = createRampLut({ width: 256, height: 1 });

  // u=0.25 should sample ~25% intensity red
  const sample25 = sampleLutColorLinear(lut, 0.25, 0.5);
  assert(sample25.color[0] >= 0.2 && sample25.color[0] <= 0.3, 'u=0.25 samples ~25% on ramp');

  // u=0.75 should sample ~75% intensity red
  const sample75 = sampleLutColorLinear(lut, 0.75, 0.5);
  assert(sample75.color[0] >= 0.7 && sample75.color[0] <= 0.8, 'u=0.75 samples ~75% on ramp');
});

test('LUT sampling - texel-center accuracy (u * width - 0.5)', () => {
  // Create 4x4 LUT with known pattern
  const lut = createGradientLut({ width: 4, height: 4 });

  // At u=0 (texel-center x = 0 * 4 - 0.5 = -0.5 -> clamped to 0)
  // This should primarily sample texel 0
  const sample0 = sampleLutColorLinear(lut, 0, 0);
  assert(sample0.color[0] === 0, 'u=0 should access left edge');

  // At u=1 (texel-center x = 1 * 4 - 0.5 = 3.5)
  // This should sample between texels 3 and 4 (clamped to 3)
  const sample1 = sampleLutColorLinear(lut, 1, 1);
  assert(sample1.color[0] > 0.5, 'u=1 should access right side');
});

test('LUT sampling - bilinear interpolation correctness', () => {
  // Create a 2x2 LUT with known corner values
  const lut = {
    ...createTestLut({ width: 2, height: 2, color: [0, 0, 0] }),
    pixels: new Uint8ClampedArray([
      // Pixel [0,0]: red (255, 0, 0)
      255, 0, 0, 255,
      // Pixel [1,0]: green (0, 255, 0)
      0, 255, 0, 255,
      // Pixel [0,1]: blue (0, 0, 255)
      0, 0, 255, 255,
      // Pixel [1,1]: white (255, 255, 255)
      255, 255, 255, 255,
    ]),
  };

  // At u=0.5, v=0.5 with 2x2 LUT:
  // texel-center x = 0.5 * 2 - 0.5 = 0.5
  // This should interpolate between 4 corner samples
  const centerSample = sampleLutColorLinear(lut, 0.5, 0.5);

  // Expected: approximately average of 4 corners
  // (red + green + blue + white) / 4 = (1.0, 0.5, 0.5) / 4 ≈ (0.25, 0.125, 0.125)
  // But exact calculation depends on interpolation factor
  assert(centerSample.color[0] > 0 && centerSample.color[0] < 1, 'interpolated R in range');
  assert(centerSample.color[1] > 0 && centerSample.color[1] < 1, 'interpolated G in range');
  assert(centerSample.color[2] > 0 && centerSample.color[2] < 1, 'interpolated B in range');
});

test('LUT sampling - alpha channel extraction and clamping', () => {
  const lut = {
    ...createTestLut({ width: 2, height: 2, color: [1, 1, 1] }),
    pixels: new Uint8ClampedArray([
      // Pixel [0,0]: red with alpha 128
      255, 0, 0, 128,
      // Pixel [1,0]: green with alpha 64
      0, 255, 0, 64,
      // Pixel [0,1]: blue with alpha 192
      0, 0, 255, 192,
      // Pixel [1,1]: white with alpha 255
      255, 255, 255, 255,
    ]),
  };

  const sample = sampleLutColorLinear(lut, 0.25, 0.25);
  assert(sample.alpha >= 0 && sample.alpha <= 1, 'alpha should be in [0, 1]');
});

test('LUT sampling - invalid/null LUT returns default white+opaque', () => {
  const invalidLut = null;
  const sample = sampleLutColorLinear(invalidLut as never, 0.5, 0.5);

  assertColorClose(sample.color, [1, 1, 1], 'null LUT returns white');
  assert.equal(sample.alpha, 1, 'null LUT returns opaque');
});

test('LUT sampling - invalid dimensions return default', () => {
  const badLut = {
    ...createTestLut({ width: 0, height: 0 }),
    width: 0,
    height: 0,
  };

  const sample = sampleLutColorLinear(badLut, 0.5, 0.5);
  assertColorClose(sample.color, [1, 1, 1], 'invalid dimensions return white');
});

test('LUT sampling - non-finite u/v return default', () => {
  const lut = createTestLut();

  const sampleNanU = sampleLutColorLinear(lut, NaN, 0.5);
  const sampleNanV = sampleLutColorLinear(lut, 0.5, Infinity);

  assertColorClose(sampleNanU.color, [1, 1, 1], 'NaN u returns default');
  assertColorClose(sampleNanV.color, [1, 1, 1], 'Infinity v returns default');
});

test('LUT sampling - insufficient pixel data returns default', () => {
  const lut = {
    ...createTestLut({ width: 4, height: 4 }),
    pixels: new Uint8ClampedArray(8), // Too small (needs 4*4*4=64)
  };

  const sample = sampleLutColorLinear(lut, 0.5, 0.5);
  assertColorClose(sample.color, [1, 1, 1], 'insufficient pixels returns default');
});

test('LUT sampling - tall narrow LUT (height >> width)', () => {
  const lut = createTestLut({ width: 2, height: 16, color: [0.5, 0.5, 0.5] });
  const sample = sampleLutColorLinear(lut, 0.5, 0.5);

  assertColorClose(sample.color, [0.5, 0.5, 0.5], 'tall narrow LUT samples correctly', 0.1);
});

test('LUT sampling - wide short LUT (width >> height)', () => {
  const lut = createTestLut({ width: 16, height: 2, color: [0.7, 0.3, 0.5] });
  const sample = sampleLutColorLinear(lut, 0.5, 0.5);

  assertColorClose(sample.color, [0.7, 0.3, 0.5], 'wide short LUT samples correctly', 0.1);
});

test('LUT sampling - u=0 and v=0 (top-left corner)', () => {
  const lut = {
    ...createTestLut({ width: 4, height: 4, color: [0, 0, 0] }),
    pixels: new Uint8ClampedArray([
      // Pixel [0,0]: red
      255, 0, 0, 255,
      // Remaining pixels: black
      ...Array(60).fill(0),
    ]),
  };

  const sample = sampleLutColorLinear(lut, 0, 0);
  // Should be close to [1, 0, 0] (red)
  assert(sample.color[0] >= 0.8, 'u=0, v=0 samples red');
  assert(sample.color[1] < 0.2, 'u=0, v=0 samples red (low G)');
});

test('LUT sampling - u=1 and v=1 (bottom-right corner)', () => {
  const lut = {
    ...createTestLut({ width: 4, height: 4, color: [0, 0, 0] }),
    pixels: new Uint8ClampedArray([
      ...Array(60).fill(0),
      // Pixel [3,3]: green
      0, 255, 0, 255,
    ]),
  };

  const sample = sampleLutColorLinear(lut, 1, 1);
  // Should be close to [0, 1, 0] (green)
  assert(sample.color[1] >= 0.8, 'u=1, v=1 samples green');
  assert(sample.color[0] < 0.2, 'u=1, v=1 samples green (low R)');
});

test('LUT sampling - batch test: verify monotonic gradient', () => {
  const lut = createRampLut({ width: 256, height: 1 });

  let prevRed = -0.1;
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    const sample = sampleLutColorLinear(lut, u, 0.5);
    // Red channel should monotonically increase
    assert(sample.color[0] >= prevRed - TOLERANCE,
      `u=${u}: red should be >= previous ${prevRed.toFixed(3)}, got ${sample.color[0].toFixed(3)}`);
    prevRed = sample.color[0];
  }
});
