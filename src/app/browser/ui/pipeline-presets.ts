export type PipelinePresetKey = 'Initial' | 'StandardToon' | 'HueShiftToon' | 'HueSatShiftToon' | 'Metallic';

export function isPipelinePresetKey(value: unknown): value is PipelinePresetKey {
  return value === 'Initial'
    || value === 'StandardToon'
    || value === 'HueShiftToon'
    || value === 'HueSatShiftToon'
    || value === 'Metallic';
}
