import * as pipelineModel from '../../features/pipeline/pipeline-model';

type MaterialSettings = pipelineModel.MaterialSettings;
type LightSettings = pipelineModel.LightSettings;

interface SceneState {
  materialSettings: MaterialSettings;
  lightSettings: LightSettings;
}

const sceneState: SceneState = {
  materialSettings: cloneMaterialSettings(pipelineModel.DEFAULT_MATERIAL_SETTINGS),
  lightSettings: cloneLightSettings(pipelineModel.DEFAULT_LIGHT_SETTINGS),
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRgbColor(value: unknown): value is [number, number, number] {
  return Array.isArray(value)
    && value.length === 3
    && isFiniteNumber(value[0])
    && isFiniteNumber(value[1])
    && isFiniteNumber(value[2]);
}

function assertValidMaterialSettings(value: unknown): asserts value is MaterialSettings {
  if (!value || typeof value !== 'object') {
    throw new Error('Material settings must be an object.');
  }

  const candidate = value as Partial<MaterialSettings>;
  if (!isRgbColor(candidate.baseColor)) {
    throw new Error('Material baseColor must be a [number, number, number] tuple.');
  }
  if (!isRgbColor(candidate.ambientColor)) {
    throw new Error('Material ambientColor must be a [number, number, number] tuple.');
  }
  if (!isFiniteNumber(candidate.specularStrength)) {
    throw new Error('Material specularStrength must be a finite number.');
  }
  if (!isFiniteNumber(candidate.specularPower)) {
    throw new Error('Material specularPower must be a finite number.');
  }
  if (!isFiniteNumber(candidate.fresnelStrength)) {
    throw new Error('Material fresnelStrength must be a finite number.');
  }
  if (!isFiniteNumber(candidate.fresnelPower)) {
    throw new Error('Material fresnelPower must be a finite number.');
  }
}

function assertValidLightSettings(value: unknown): asserts value is LightSettings {
  if (!value || typeof value !== 'object') {
    throw new Error('Light settings must be an object.');
  }

  const candidate = value as Partial<LightSettings>;
  if (!isFiniteNumber(candidate.azimuthDeg)) {
    throw new Error('Light azimuthDeg must be a finite number.');
  }
  if (!isFiniteNumber(candidate.elevationDeg)) {
    throw new Error('Light elevationDeg must be a finite number.');
  }
  if (typeof candidate.showGizmo !== 'boolean') {
    throw new Error('Light showGizmo must be a boolean.');
  }
}

export function cloneMaterialSettings(settings: MaterialSettings): MaterialSettings {
  assertValidMaterialSettings(settings);
  return {
    baseColor: [settings.baseColor[0], settings.baseColor[1], settings.baseColor[2]],
    ambientColor: [settings.ambientColor[0], settings.ambientColor[1], settings.ambientColor[2]],
    specularStrength: settings.specularStrength,
    specularPower: settings.specularPower,
    fresnelStrength: settings.fresnelStrength,
    fresnelPower: settings.fresnelPower,
  };
}

export function cloneLightSettings(settings: LightSettings): LightSettings {
  assertValidLightSettings(settings);
  return {
    azimuthDeg: settings.azimuthDeg,
    elevationDeg: settings.elevationDeg,
    showGizmo: settings.showGizmo,
  };
}

export function getMaterialSettings(): MaterialSettings {
  return cloneMaterialSettings(sceneState.materialSettings);
}

export function setMaterialSettings(settings: MaterialSettings): void {
  sceneState.materialSettings = cloneMaterialSettings(settings);
}

export function getLightSettings(): LightSettings {
  return cloneLightSettings(sceneState.lightSettings);
}

export function setLightSettings(settings: LightSettings): void {
  sceneState.lightSettings = cloneLightSettings(settings);
}
