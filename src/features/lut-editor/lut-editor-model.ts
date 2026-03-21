// Color stop within a single horizontal ramp
export interface ColorStop {
  id: string;
  position: number;   // [0, 1] along X axis; first stop is always 0, last is always 1
  color: [number, number, number];  // RGB, each [0, 1]
  alpha: number;      // [0, 1]
}

// A horizontal color ramp at a specific Y position
export interface ColorRamp {
  id: string;
  yPosition: number;  // [0, 1]; first ramp is always 0, last is always 1
  stops: ColorStop[]; // At least 2 stops, sorted by position ascending
}

// Top-level 2D color ramp LUT data — ephemeral editor state, not persisted
export interface ColorRamp2dLutData {
  name: string;
  width: number;    // Pixel width of the generated LUT (typically 256)
  height: number;   // Pixel height of the generated LUT (typically 256)
  ramps: ColorRamp[]; // At least 2 ramps, sorted by yPosition ascending
}

export const LUT_EDITOR_DEFAULT_WIDTH = 256;
export const LUT_EDITOR_DEFAULT_HEIGHT = 256;
export const MIN_RAMPS = 2;
export const MIN_STOPS_PER_RAMP = 2;
export const MAX_RAMPS = 16;
export const MAX_STOPS_PER_RAMP = 16;
