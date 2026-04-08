import type {
  Color,
  LutModel,
} from './step-model.ts';

export interface LutColorSample {
  color: Color;
  alpha: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function createDefaultSample(): LutColorSample {
  return { color: [1, 1, 1], alpha: 1 };
}

function hasValidDimensions(lut: LutModel): boolean {
  return Number.isInteger(lut.width)
    && Number.isInteger(lut.height)
    && lut.width > 0
    && lut.height > 0;
}

function hasSufficientPixelData(lut: LutModel): boolean {
  const requiredPixelCount = lut.width * lut.height * 4;
  return lut.pixels.length >= requiredPixelCount;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function readPixelClamped(
  lut: LutModel,
  pixelX: number,
  pixelY: number,
): [number, number, number, number] {
  const x = clampInt(pixelX, 0, lut.width - 1);
  const y = clampInt(pixelY, 0, lut.height - 1);
  const index = (y * lut.width + x) * 4;
  const data = lut.pixels;

  return [
    (data[index + 0] ?? 0) / 255,
    (data[index + 1] ?? 0) / 255,
    (data[index + 2] ?? 0) / 255,
    (data[index + 3] ?? 255) / 255,
  ];
}

export function sampleLutColorLinear(lut: LutModel, u: number, v: number): LutColorSample {
  if (!lut || typeof lut !== 'object') {
    return createDefaultSample();
  }

  if (!isFiniteNumber(u) || !isFiniteNumber(v)) {
    return createDefaultSample();
  }

  if (!hasValidDimensions(lut) || !hasSufficientPixelData(lut)) {
    return createDefaultSample();
  }

  const clampedU = clamp01(u);
  const clampedV = clamp01(v);

  // Match GPU-style linear filtering by sampling around texel centers.
  const x = clampedU * lut.width - 0.5;
  const y = clampedV * lut.height - 0.5;

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = x - x0;
  const ty = y - y0;

  const c00 = readPixelClamped(lut, x0, y0);
  const c10 = readPixelClamped(lut, x1, y0);
  const c01 = readPixelClamped(lut, x0, y1);
  const c11 = readPixelClamped(lut, x1, y1);

  const mix = (from: number, to: number, alpha: number) => from * (1 - alpha) + to * alpha;

  const r0 = mix(c00[0], c10[0], tx);
  const g0 = mix(c00[1], c10[1], tx);
  const b0 = mix(c00[2], c10[2], tx);
  const a0 = mix(c00[3], c10[3], tx);

  const r1 = mix(c01[0], c11[0], tx);
  const g1 = mix(c01[1], c11[1], tx);
  const b1 = mix(c01[2], c11[2], tx);
  const a1 = mix(c01[3], c11[3], tx);

  return {
    color: [
      clamp01(mix(r0, r1, ty)),
      clamp01(mix(g0, g1, ty)),
      clamp01(mix(b0, b1, ty)),
    ],
    alpha: clamp01(mix(a0, a1, ty)),
  };
}
