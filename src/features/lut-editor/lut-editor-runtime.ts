import {
  LUT_EDITOR_DEFAULT_HEIGHT,
  LUT_EDITOR_DEFAULT_WIDTH,
  MAX_RAMPS,
  MAX_STOPS_PER_RAMP,
  MIN_RAMPS,
  MIN_STOPS_PER_RAMP,
  type ColorRamp,
  type ColorRamp2dLutData,
  type ColorStop,
} from './lut-editor-model.ts';

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function makeStopId(): string {
  return `stop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeRampId(): string {
  return `ramp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// Sample a 1D color ramp at position t ∈ [0, 1]
export function interpolateColorStops(
  stops: readonly ColorStop[],
  t: number,
): [number, number, number, number] {
  if (stops.length === 0) return [0, 0, 0, 1];
  if (stops.length === 1) {
    const s = stops[0]!;
    return [s.color[0], s.color[1], s.color[2], s.alpha];
  }

  const clamped = clamp01(t);

  const first = stops[0]!;
  const last = stops[stops.length - 1]!;

  // Outside the stop range: clamp to boundary stop color
  if (clamped <= first.position) return [first.color[0], first.color[1], first.color[2], first.alpha];
  if (clamped >= last.position) return [last.color[0], last.color[1], last.color[2], last.alpha];

  // Find bracketing stops
  let lo = first;
  let hi = last;

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    if (clamped >= a.position && clamped <= b.position) {
      lo = a;
      hi = b;
      break;
    }
  }

  const span = hi.position - lo.position;
  const localT = span > 0 ? (clamped - lo.position) / span : 0;

  return [
    lerp(lo.color[0], hi.color[0], localT),
    lerp(lo.color[1], hi.color[1], localT),
    lerp(lo.color[2], hi.color[2], localT),
    lerp(lo.alpha, hi.alpha, localT),
  ];
}

// Sample the 2D color ramp at (u, v) ∈ [0, 1]
export function sampleColorRamp2d(
  data: ColorRamp2dLutData,
  u: number,
  v: number,
): [number, number, number, number] {
  const ramps = data.ramps;
  if (ramps.length === 0) return [0, 0, 0, 1];
  if (ramps.length === 1) return interpolateColorStops(ramps[0]!.stops, u);

  const cv = clamp01(v);

  const firstRamp = ramps[0]!;
  const lastRamp = ramps[ramps.length - 1]!;

  // Outside the ramp range: clamp to boundary ramp color
  if (cv <= firstRamp.position) return interpolateColorStops(firstRamp.stops, u);
  if (cv >= lastRamp.position) return interpolateColorStops(lastRamp.stops, u);

  // Find bracketing ramps by position
  let loRamp = firstRamp;
  let hiRamp = lastRamp;

  for (let i = 0; i < ramps.length - 1; i++) {
    const a = ramps[i]!;
    const b = ramps[i + 1]!;
    if (cv >= a.position && cv <= b.position) {
      loRamp = a;
      hiRamp = b;
      break;
    }
  }

  const loColor = interpolateColorStops(loRamp.stops, u);
  const hiColor = interpolateColorStops(hiRamp.stops, u);

  const span = hiRamp.position - loRamp.position;
  const localT = span > 0 ? (cv - loRamp.position) / span : 0;

  return [
    lerp(loColor[0], hiColor[0], localT),
    lerp(loColor[1], hiColor[1], localT),
    lerp(loColor[2], hiColor[2], localT),
    lerp(loColor[3], hiColor[3], localT),
  ];
}

// Render the full pixel buffer for a ColorRamp2dLutData
export function renderColorRamp2dToPixels(data: ColorRamp2dLutData): Uint8ClampedArray {
  const { width, height } = data;
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = width > 1 ? x / (width - 1) : 0;
      const py = height > 1 ? y / (height - 1) : 0;
      const u = data.axisSwap ? py : px;
      const v = data.axisSwap ? px : py;
      const [r, g, b, a] = sampleColorRamp2d(data, u, v);
      const idx = (y * width + x) * 4;
      pixels[idx] = Math.round(clamp01(r) * 255);
      pixels[idx + 1] = Math.round(clamp01(g) * 255);
      pixels[idx + 2] = Math.round(clamp01(b) * 255);
      pixels[idx + 3] = Math.round(clamp01(a) * 255);
    }
  }

  return pixels;
}

// Create a default 2D color ramp (black to white, two ramps)
export function createDefaultColorRamp2dLutData(name: string): ColorRamp2dLutData {
  const bottomStop0: ColorStop = { id: makeStopId(), position: 0, color: [0, 0, 0], alpha: 1 };
  const bottomStop1: ColorStop = { id: makeStopId(), position: 1, color: [1, 1, 1], alpha: 1 };
  const topStop0: ColorStop = { id: makeStopId(), position: 0, color: [0, 0, 0], alpha: 1 };
  const topStop1: ColorStop = { id: makeStopId(), position: 1, color: [1, 1, 1], alpha: 1 };

  const ramp0: ColorRamp = { id: makeRampId(), position: 0, stops: [bottomStop0, bottomStop1] };
  const ramp1: ColorRamp = { id: makeRampId(), position: 1, stops: [topStop0, topStop1] };

  return {
    name,
    width: LUT_EDITOR_DEFAULT_WIDTH,
    height: LUT_EDITOR_DEFAULT_HEIGHT,
    ramps: [ramp0, ramp1],
  };
}

// Insert a new ramp at position, with stops interpolated from neighbors
export function addRamp(data: ColorRamp2dLutData, position: number): ColorRamp2dLutData {
  if (data.ramps.length >= MAX_RAMPS) return data;

  const cv = clamp01(position);

  // Find neighbors
  const sorted = data.ramps;
  let loRamp = sorted[0]!;
  let hiRamp = sorted[sorted.length - 1]!;

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (cv >= a.position && cv <= b.position) {
      loRamp = a;
      hiRamp = b;
      break;
    }
  }

  // Build stops by sampling both neighbor ramps at positions from loRamp
  const refStops = loRamp.stops;
  const newStops: ColorStop[] = refStops.map(s => {
    const loColor = interpolateColorStops(loRamp.stops, s.position);
    const hiColor = interpolateColorStops(hiRamp.stops, s.position);
    const span = hiRamp.position - loRamp.position;
    const localT = span > 0 ? (cv - loRamp.position) / span : 0;
    return {
      id: makeStopId(),
      position: s.position,
      color: [
        lerp(loColor[0], hiColor[0], localT),
        lerp(loColor[1], hiColor[1], localT),
        lerp(loColor[2], hiColor[2], localT),
      ],
      alpha: lerp(loColor[3], hiColor[3], localT),
    };
  });

  const newRamp: ColorRamp = { id: makeRampId(), position: cv, stops: newStops };
  const newRamps = [...data.ramps, newRamp].sort((a, b) => a.position - b.position);

  return { ...data, ramps: newRamps };
}

// Remove a ramp by id (guards: cannot remove boundary ramps or go below MIN_RAMPS)
export function removeRamp(data: ColorRamp2dLutData, rampId: string): ColorRamp2dLutData {
  if (data.ramps.length <= MIN_RAMPS) return data;

  const idx = data.ramps.findIndex(r => r.id === rampId);
  if (idx < 0) return data;

  // Cannot remove boundary ramps (y=0 or y=1 ramps are first/last after sorting)
  if (idx === 0 || idx === data.ramps.length - 1) return data;

  const newRamps = data.ramps.filter(r => r.id !== rampId);
  return { ...data, ramps: newRamps };
}

// Add a color stop at position in a ramp, with interpolated color
export function addStop(ramp: ColorRamp, position: number): ColorRamp {
  if (ramp.stops.length >= MAX_STOPS_PER_RAMP) return ramp;

  const cp = clamp01(position);
  const color = interpolateColorStops(ramp.stops, cp);
  const newStop: ColorStop = {
    id: makeStopId(),
    position: cp,
    color: [color[0], color[1], color[2]],
    alpha: color[3],
  };

  const newStops = [...ramp.stops, newStop].sort((a, b) => a.position - b.position);
  return { ...ramp, stops: newStops };
}

// Remove a stop from a ramp (guards: cannot remove boundary stops or go below MIN_STOPS_PER_RAMP)
export function removeStop(ramp: ColorRamp, stopId: string): ColorRamp {
  if (ramp.stops.length <= MIN_STOPS_PER_RAMP) return ramp;

  const idx = ramp.stops.findIndex(s => s.id === stopId);
  if (idx < 0) return ramp;

  // Cannot remove boundary stops (first or last position)
  if (idx === 0 || idx === ramp.stops.length - 1) return ramp;

  const newStops = ramp.stops.filter(s => s.id !== stopId);
  return { ...ramp, stops: newStops };
}

// Update a stop's color
export function updateStopColor(ramp: ColorRamp, stopId: string, color: [number, number, number]): ColorRamp {
  const newStops = ramp.stops.map(s =>
    s.id === stopId ? { ...s, color } : s,
  );
  return { ...ramp, stops: newStops };
}

// Update a stop's alpha
export function updateStopAlpha(ramp: ColorRamp, stopId: string, alpha: number): ColorRamp {
  const newStops = ramp.stops.map(s =>
    s.id === stopId ? { ...s, alpha: clamp01(alpha) } : s,
  );
  return { ...ramp, stops: newStops };
}

// Move a stop to a new position (re-sorts, clamps to [0, 1])
export function moveStop(ramp: ColorRamp, stopId: string, newPosition: number): ColorRamp {
  const idx = ramp.stops.findIndex(s => s.id === stopId);
  if (idx < 0) return ramp;

  const clamped = clamp01(newPosition);

  const newStops = ramp.stops.map(s =>
    s.id === stopId ? { ...s, position: clamped } : s,
  ).sort((a, b) => a.position - b.position);

  return { ...ramp, stops: newStops };
}

// Update a ramp in the data (immutable)
export function updateRamp(data: ColorRamp2dLutData, updatedRamp: ColorRamp): ColorRamp2dLutData {
  const newRamps = data.ramps.map(r => r.id === updatedRamp.id ? updatedRamp : r);
  return { ...data, ramps: newRamps };
}

// Convert [0, 1] color component to hex string
export function colorToHex(color: [number, number, number]): string {
  const toHex = (v: number): string => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return `#${toHex(color[0])}${toHex(color[1])}${toHex(color[2])}`;
}

// Parse a hex color string to [0, 1] RGB
export function parseHexColor(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [
    Number.isFinite(r) ? r : 0,
    Number.isFinite(g) ? g : 0,
    Number.isFinite(b) ? b : 0,
  ];
}

// Reorder ramps by moving fromIndex to insertBeforeIndex, then reassign positions in-place.
// All ramps including boundary ones can be reordered.
// insertBeforeIndex = n means "append at end".
export function reorderRamps(
  data: ColorRamp2dLutData,
  fromIndex: number,
  insertBeforeIndex: number,
): ColorRamp2dLutData {
  const n = data.ramps.length;
  if (fromIndex < 0 || fromIndex >= n) return data;
  if (insertBeforeIndex < 0 || insertBeforeIndex > n) return data;
  // No-op: inserting immediately before or after itself
  if (insertBeforeIndex === fromIndex || insertBeforeIndex === fromIndex + 1) return data;

  const positions = data.ramps.map(r => r.position);

  // Remove the ramp from its current position
  const without = data.ramps.filter((_, i) => i !== fromIndex);
  // After removal, indices > fromIndex shift down by 1
  const adjustedInsert = insertBeforeIndex > fromIndex ? insertBeforeIndex - 1 : insertBeforeIndex;
  without.splice(adjustedInsert, 0, data.ramps[fromIndex]!);

  // Reassign positions to keep the sorted structure
  const reordered = without.map((ramp, i) => ({ ...ramp, position: positions[i]! }));
  return { ...data, ramps: reordered };
}

// Move a ramp to a new position, re-sorting the array
export function moveRamp(data: ColorRamp2dLutData, rampId: string, newPosition: number): ColorRamp2dLutData {
  const idx = data.ramps.findIndex(r => r.id === rampId);
  if (idx < 0) return data;
  const ramp = data.ramps[idx]!;
  const clamped = clamp01(newPosition);
  const updatedRamp = { ...ramp, position: clamped };
  const newRamps = data.ramps.map(r => r.id === rampId ? updatedRamp : r)
    .sort((a, b) => a.position - b.position);
  return { ...data, ramps: newRamps };
}
