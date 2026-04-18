import * as pipelineModel from '../../../../features/pipeline/pipeline-model.ts';

export type StatusKind = 'success' | 'error' | 'info';
export type StatusReporter = (message: string, kind?: StatusKind) => void;

export interface MaterialPanelMountOptions {
  initialSettings: pipelineModel.MaterialSettings;
  onSettingsChange: (nextSettings: pipelineModel.MaterialSettings) => void;
  onStatus: StatusReporter;
}

export interface LightPanelMountOptions {
  initialSettings: pipelineModel.LightSettings;
  onSettingsChange: (nextSettings: pipelineModel.LightSettings) => void;
  onStatus: StatusReporter;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function isValidColor(value: unknown): value is [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) {
    return false;
  }

  return value.every(channel => Number.isFinite(channel));
}

export function isValidMaterialSettings(value: unknown): value is pipelineModel.MaterialSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const material = value as Partial<pipelineModel.MaterialSettings>;
  return isValidColor(material.baseColor)
    && Number.isFinite(material.specularStrength)
    && Number.isFinite(material.specularPower)
    && Number.isFinite(material.fresnelStrength)
    && Number.isFinite(material.fresnelPower);
}

export function isValidLightSettings(value: unknown): value is pipelineModel.LightSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const light = value as Partial<pipelineModel.LightSettings>;
  return Number.isFinite(light.azimuthDeg)
    && Number.isFinite(light.elevationDeg)
    && Number.isFinite(light.lightIntensity)
    && isValidColor(light.lightColor)
    && isValidColor(light.ambientColor)
    && typeof light.showGizmo === 'boolean';
}

export function cloneMaterialSettings(settings: pipelineModel.MaterialSettings): pipelineModel.MaterialSettings {
  return {
    baseColor: [settings.baseColor[0], settings.baseColor[1], settings.baseColor[2]],
    specularStrength: settings.specularStrength,
    specularPower: settings.specularPower,
    fresnelStrength: settings.fresnelStrength,
    fresnelPower: settings.fresnelPower,
  };
}

export function cloneLightSettings(settings: pipelineModel.LightSettings): pipelineModel.LightSettings {
  return {
    azimuthDeg: settings.azimuthDeg,
    elevationDeg: settings.elevationDeg,
    lightIntensity: settings.lightIntensity,
    lightColor: [settings.lightColor[0], settings.lightColor[1], settings.lightColor[2]],
    ambientColor: [settings.ambientColor[0], settings.ambientColor[1], settings.ambientColor[2]],
    showGizmo: settings.showGizmo,
  };
}

export function getMaterialRangeStep(key: pipelineModel.MaterialNumericKey): string {
  switch (key) {
    case 'specularPower':
      return '1';
    case 'fresnelPower':
      return '0.1';
    default:
      return '0.01';
  }
}

export function getLightRangeStep(binding: pipelineModel.LightRangeBinding): string {
  const precision = Math.max(0, Math.trunc(binding.fractionDigits));
  const step = 1 / (10 ** precision);
  return Number.isFinite(step) && step > 0 ? String(step) : '1';
}

export function isLightAngleBinding(binding: pipelineModel.LightRangeBinding): boolean {
  return binding.key === 'azimuthDeg' || binding.key === 'elevationDeg';
}

export function ensureMaterialMountOptions(value: unknown): asserts value is MaterialPanelMountOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Materialパネルの初期化オプションが不正です。');
  }

  const options = value as Partial<MaterialPanelMountOptions>;
  if (!isValidMaterialSettings(options.initialSettings)) {
    throw new Error('Materialパネルの初期設定が不正です。');
  }
  if (typeof options.onSettingsChange !== 'function') {
    throw new Error('Materialパネルの更新コールバックが不正です。');
  }
  if (typeof options.onStatus !== 'function') {
    throw new Error('Materialパネルのステータス通知コールバックが不正です。');
  }
}

export function ensureLightMountOptions(value: unknown): asserts value is LightPanelMountOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Lightパネルの初期化オプションが不正です。');
  }

  const options = value as Partial<LightPanelMountOptions>;
  if (!isValidLightSettings(options.initialSettings)) {
    throw new Error('Lightパネルの初期設定が不正です。');
  }
  if (typeof options.onSettingsChange !== 'function') {
    throw new Error('Lightパネルの更新コールバックが不正です。');
  }
  if (typeof options.onStatus !== 'function') {
    throw new Error('Lightパネルのステータス通知コールバックが不正です。');
  }
}
