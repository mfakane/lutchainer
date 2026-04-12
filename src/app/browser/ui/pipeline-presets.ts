export type PipelinePresetKey = 'Initial' | 'StandardToon' | 'HueShiftToon' | 'HueSatShiftToon' | 'Gradient' | 'Plastic' | 'Metallic';

export function isPipelinePresetKey(value: unknown): value is PipelinePresetKey {
  return value === 'Initial'
    || value === 'StandardToon'
    || value === 'HueShiftToon'
    || value === 'HueSatShiftToon'
    || value === 'Gradient'
    || value === 'Plastic'
    || value === 'Metallic';
}
