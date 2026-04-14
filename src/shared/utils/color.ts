export type Color3 = [number, number, number];
export type Color3WithChroma = [number, number, number, boolean?];

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

export function rgbToHsv(color: readonly [number, number, number]): Color3 {
  const r = color[0];
  const g = color[1];
  const b = color[2];
  const maxValue = Math.max(r, g, b);
  const minValue = Math.min(r, g, b);
  const delta = maxValue - minValue;

  let hue = 0;
  if (delta > 1e-6) {
    if (maxValue === r) {
      hue = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    } else if (maxValue === g) {
      hue = ((b - r) / delta + 2) / 6;
    } else {
      hue = ((r - g) / delta + 4) / 6;
    }
  }

  const saturation = maxValue <= 1e-6 ? 0 : delta / maxValue;
  return [clamp01(hue), clamp01(saturation), clamp01(maxValue)];
}

export function hsvToRgb(
  color: readonly [number, number, number] | readonly [number, number, number, boolean?],
): Color3 {
  const hue = ((color[0] % 1) + 1) % 1;
  const saturation = clamp01(color[1]);
  const value = clamp01(color[2]);
  const hasChroma = color.length < 4
    ? true
    : (color[3] ?? (saturation > 1e-6));

  if (saturation <= 1e-6 || !hasChroma) {
    return [value, value, value];
  }

  const sector = Math.floor(hue * 6);
  const fraction = hue * 6 - sector;
  const p = value * (1 - saturation);
  const q = value * (1 - fraction * saturation);
  const t = value * (1 - (1 - fraction) * saturation);

  switch (sector % 6) {
    case 0:
      return [value, t, p];
    case 1:
      return [q, value, p];
    case 2:
      return [p, value, t];
    case 3:
      return [p, q, value];
    case 4:
      return [t, p, value];
    default:
      return [value, p, q];
  }
}
