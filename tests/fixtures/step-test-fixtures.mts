/**
 * Test fixtures for step-related tests.
 * Provides: sample models, color data, parameters, and context.
 */

import type {
    Color,
    CustomParamModel,
    LutModel,
    StepModel,
    StepParamContext,
} from '../../src/features/step/step-model.ts';
import { DEFAULT_OPS } from '../../src/features/step/step-model.ts';

/**
 * Standard test context with common parameter values.
 */
export function createTestContext(overrides?: Partial<StepParamContext>): StepParamContext {
  return {
    lambert: 0.8,
    halfLambert: 0.9,
    specular: 0.5,
    fresnel: 0.3,
    facing: 0.6,
    nDotH: 0.4,
    linearDepth: 0.5,
    texU: 0.5,
    texV: 0.5,
    customParamValues: {},
    ...overrides,
  };
}

/**
 * Create a simple step model for testing.
 */
export function createTestStep(id: string, blendMode = 'replace'): StepModel {
  return {
    id,
    lutId: 'test-lut-1',
    muted: false,
    blendMode: blendMode as never,
    xParam: 'lightness',
    yParam: 'specular',
    ops: DEFAULT_OPS,
  };
}

/**
 * Create a test LUT model with solid color or gradient.
 * Defaults to a white 4x4 LUT.
 */
export function createTestLut(options?: {
  id?: string;
  width?: number;
  height?: number;
  color?: Color;
}): LutModel {
  const width = options?.width ?? 4;
  const height = options?.height ?? 4;
  const color = options?.color ?? [1, 1, 1] as Color;

  // Create a simple solid color LUT
  const pixels = new Uint8ClampedArray(width * height * 4);
  const [r, g, b] = color;
  const rByte = Math.round(r * 255);
  const gByte = Math.round(g * 255);
  const bByte = Math.round(b * 255);

  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i + 0] = rByte;
    pixels[i + 1] = gByte;
    pixels[i + 2] = bByte;
    pixels[i + 3] = 255;
  }

  // Create a canvas element (minimal mock)
  const canvas = {
    width,
    height,
    getContext: () => ({
      putImageData: () => {},
    }),
  } as never as HTMLCanvasElement;

  return {
    id: options?.id ?? 'test-lut-1',
    name: 'Test LUT',
    image: canvas,
    width,
    height,
    pixels,
    thumbUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  };
}

/**
 * Create a gradient LUT (left to right, top to bottom).
 * Useful for testing LUT sampling behavior.
 */
export function createGradientLut(options?: {
  id?: string;
  width?: number;
  height?: number;
}): LutModel {
  const width = options?.width ?? 8;
  const height = options?.height ?? 8;
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Horizontal gradient: red at left, green at right
      pixels[idx + 0] = Math.round((x / (width - 1)) * 255); // R
      pixels[idx + 1] = Math.round((y / (height - 1)) * 255); // G
      pixels[idx + 2] = 0; // B
      pixels[idx + 3] = 255; // A
    }
  }

  const canvas = {
    width,
    height,
    getContext: () => ({
      putImageData: () => {},
    }),
  } as never as HTMLCanvasElement;

  return {
    id: options?.id ?? 'gradient-lut',
    name: 'Gradient LUT',
    image: canvas,
    width,
    height,
    pixels,
    thumbUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  };
}

/**
 * Create a ramp LUT useful for color curves testing.
 * Red channel: 0 to 1 from left to right
 */
export function createRampLut(options?: {
  id?: string;
  width?: number;
  height?: number;
}): LutModel {
  const width = options?.width ?? 256;
  const height = options?.height ?? 1;
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let x = 0; x < width; x++) {
    const idx = x * 4;
    pixels[idx + 0] = x; // R: 0-255
    pixels[idx + 1] = 128; // G: constant
    pixels[idx + 2] = 128; // B: constant
    pixels[idx + 3] = 255; // A
  }

  const canvas = {
    width,
    height,
    getContext: () => ({
      putImageData: () => {},
    }),
  } as never as HTMLCanvasElement;

  return {
    id: options?.id ?? 'ramp-lut',
    name: 'Ramp LUT',
    image: canvas,
    width,
    height,
    pixels,
    thumbUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  };
}

/**
 * Standard test colors for blending tests.
 */
export const COLORS = {
  red: [1, 0, 0] as Color,
  green: [0, 1, 0] as Color,
  blue: [0, 0, 1] as Color,
  white: [1, 1, 1] as Color,
  black: [0, 0, 0] as Color,
  gray: [0.5, 0.5, 0.5] as Color,
  cyan: [0, 1, 1] as Color,
  magenta: [1, 0, 1] as Color,
  yellow: [1, 1, 0] as Color,
};

/**
 * Create a custom parameter for testing.
 */
export function createCustomParam(id: string, defaultValue = 0.5): CustomParamModel {
  return {
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    defaultValue: Math.max(0, Math.min(1, defaultValue)),
  };
}

/**
 * Helper to compare colors with tolerance (for floating point errors).
 */
export function colorEqual(a: Color, b: Color, tolerance = 1e-6): boolean {
  return Math.abs(a[0] - b[0]) < tolerance
    && Math.abs(a[1] - b[1]) < tolerance
    && Math.abs(a[2] - b[2]) < tolerance;
}

/**
 * Helper to format a color for readable assertion messages.
 */
export function formatColor(color: Color | number): string {
  if (typeof color === 'number') {
    return color.toFixed(6);
  }
  return `[${color[0].toFixed(3)}, ${color[1].toFixed(3)}, ${color[2].toFixed(3)}]`;
}
