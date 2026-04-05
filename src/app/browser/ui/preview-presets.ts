import * as pipelineModel from '../../../features/pipeline/pipeline-model';

export interface MaterialPresetDefinition {
  key: string;
  labelKey: string;
  settings: pipelineModel.MaterialSettings;
}

export interface LightPresetDefinition {
  key: string;
  labelKey: string;
  settings: pipelineModel.LightSettings;
}

export const MATERIAL_PRESETS: MaterialPresetDefinition[] = [
  {
    key: 'default',
    labelKey: 'panel.preset.default',
    settings: pipelineModel.DEFAULT_MATERIAL_SETTINGS,
  },
  {
    key: 'matte-clay',
    labelKey: 'panel.preset.material.matteClay',
    settings: {
      baseColor: [0.70, 0.62, 0.54],
      specularStrength: 0.12,
      specularPower: 7,
      fresnelStrength: 0.08,
      fresnelPower: 1.4,
    },
  },
  {
    key: 'gloss-metal',
    labelKey: 'panel.preset.material.glossMetal',
    settings: {
      baseColor: [0.78, 0.80, 0.84],
      specularStrength: 1.05,
      specularPower: 72,
      fresnelStrength: 0.36,
      fresnelPower: 3.6,
    },
  },
  {
    key: 'neon-lacquer',
    labelKey: 'panel.preset.material.neonLacquer',
    settings: {
      baseColor: [0.18, 0.82, 0.95],
      specularStrength: 0.62,
      specularPower: 44,
      fresnelStrength: 0.46,
      fresnelPower: 2.8,
    },
  },
];

export const LIGHT_PRESETS: LightPresetDefinition[] = [
  {
    key: 'default',
    labelKey: 'panel.preset.default',
    settings: pipelineModel.DEFAULT_LIGHT_SETTINGS,
  },
  {
    key: 'studio-front',
    labelKey: 'panel.preset.light.studioFront',
    settings: {
      azimuthDeg: 20,
      elevationDeg: 48,
      lightIntensity: 1.10,
      lightColor: [1.00, 0.94, 0.86],
      ambientColor: [0.10, 0.08, 0.06],
      showGizmo: true,
    },
  },
  {
    key: 'rim-side',
    labelKey: 'panel.preset.light.rimSide',
    settings: {
      azimuthDeg: -115,
      elevationDeg: 18,
      lightIntensity: 1.25,
      lightColor: [0.66, 0.79, 1.00],
      ambientColor: [0.03, 0.05, 0.09],
      showGizmo: true,
    },
  },
  {
    key: 'top-down',
    labelKey: 'panel.preset.light.topDown',
    settings: {
      azimuthDeg: 0,
      elevationDeg: 82,
      lightIntensity: 0.92,
      lightColor: [0.93, 0.98, 1.00],
      ambientColor: [0.02, 0.03, 0.05],
      showGizmo: true,
    },
  },
];

export function getMaterialPresetByKey(key: string): MaterialPresetDefinition | undefined {
  return MATERIAL_PRESETS.find(preset => preset.key === key);
}

export function getLightPresetByKey(key: string): LightPresetDefinition | undefined {
  return LIGHT_PRESETS.find(preset => preset.key === key);
}
