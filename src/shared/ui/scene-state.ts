import * as pipelineModel from '../../features/pipeline/pipeline-model';

type MaterialSettings = pipelineModel.MaterialSettings;
type LightSettings = pipelineModel.LightSettings;

const MATERIAL_SETTINGS_STORAGE_KEY = 'lutchainer.material-settings.v1';
const LIGHT_SETTINGS_STORAGE_KEY = 'lutchainer.light-settings.v1';

interface SceneState {
  materialSettings: MaterialSettings;
  lightSettings: LightSettings;
}

const sceneState: SceneState = createInitialSceneState();

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getNumericRange(
  bindings: Array<{ key: string; min: number; max: number }>,
  key: string,
): { min: number; max: number } {
  if (!Array.isArray(bindings)) {
    throw new Error('Range bindings must be an array.');
  }
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new Error('Range key must be a non-empty string.');
  }

  const binding = bindings.find(candidate => candidate.key === key);
  if (!binding) {
    throw new Error(`Range binding was not found for key: ${key}`);
  }

  return {
    min: binding.min,
    max: binding.max,
  };
}

function getSafeLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readJsonFromStorage(storageKey: string): unknown | null {
  if (typeof storageKey !== 'string' || storageKey.trim().length === 0) {
    throw new Error('Storage key must be a non-empty string.');
  }

  const storage = getSafeLocalStorage();
  if (!storage) {
    return null;
  }

  let raw: string | null;
  try {
    raw = storage.getItem(storageKey);
  } catch {
    return null;
  }

  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJsonToStorage(storageKey: string, value: unknown): void {
  if (typeof storageKey !== 'string' || storageKey.trim().length === 0) {
    throw new Error('Storage key must be a non-empty string.');
  }
  if (value === undefined) {
    throw new Error('Storage value cannot be undefined.');
  }

  const storage = getSafeLocalStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Ignore storage errors and keep in-memory state.
  }
}

function loadStoredMaterialSettings(): MaterialSettings | null {
  const parsed = readJsonFromStorage(MATERIAL_SETTINGS_STORAGE_KEY);
  if (parsed === null) {
    return null;
  }

  try {
    return cloneMaterialSettings(parsed as MaterialSettings);
  } catch {
    return null;
  }
}

function loadStoredLightSettings(): LightSettings | null {
  const parsed = readJsonFromStorage(LIGHT_SETTINGS_STORAGE_KEY);
  if (parsed === null) {
    return null;
  }

  try {
    return cloneLightSettings(parsed as LightSettings);
  } catch {
    return null;
  }
}

function createInitialSceneState(): SceneState {
  const materialSettings = loadStoredMaterialSettings() ?? cloneMaterialSettings(pipelineModel.DEFAULT_MATERIAL_SETTINGS);
  const lightSettings = loadStoredLightSettings() ?? cloneLightSettings(pipelineModel.DEFAULT_LIGHT_SETTINGS);

  return {
    materialSettings,
    lightSettings,
  };
}

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

  const specularStrengthRange = getNumericRange(pipelineModel.MATERIAL_RANGE_BINDINGS, 'specularStrength');
  const specularPowerRange = getNumericRange(pipelineModel.MATERIAL_RANGE_BINDINGS, 'specularPower');
  const fresnelStrengthRange = getNumericRange(pipelineModel.MATERIAL_RANGE_BINDINGS, 'fresnelStrength');
  const fresnelPowerRange = getNumericRange(pipelineModel.MATERIAL_RANGE_BINDINGS, 'fresnelPower');

  return {
    baseColor: [
      clamp(settings.baseColor[0], 0, 1),
      clamp(settings.baseColor[1], 0, 1),
      clamp(settings.baseColor[2], 0, 1),
    ],
    ambientColor: [
      clamp(settings.ambientColor[0], 0, 1),
      clamp(settings.ambientColor[1], 0, 1),
      clamp(settings.ambientColor[2], 0, 1),
    ],
    specularStrength: clamp(settings.specularStrength, specularStrengthRange.min, specularStrengthRange.max),
    specularPower: clamp(settings.specularPower, specularPowerRange.min, specularPowerRange.max),
    fresnelStrength: clamp(settings.fresnelStrength, fresnelStrengthRange.min, fresnelStrengthRange.max),
    fresnelPower: clamp(settings.fresnelPower, fresnelPowerRange.min, fresnelPowerRange.max),
  };
}

export function cloneLightSettings(settings: LightSettings): LightSettings {
  assertValidLightSettings(settings);

  const azimuthRange = getNumericRange(pipelineModel.LIGHT_RANGE_BINDINGS, 'azimuthDeg');
  const elevationRange = getNumericRange(pipelineModel.LIGHT_RANGE_BINDINGS, 'elevationDeg');

  return {
    azimuthDeg: clamp(settings.azimuthDeg, azimuthRange.min, azimuthRange.max),
    elevationDeg: clamp(settings.elevationDeg, elevationRange.min, elevationRange.max),
    showGizmo: settings.showGizmo,
  };
}

export function getMaterialSettings(): MaterialSettings {
  return cloneMaterialSettings(sceneState.materialSettings);
}

export function setMaterialSettings(settings: MaterialSettings): void {
  const normalized = cloneMaterialSettings(settings);
  sceneState.materialSettings = normalized;
  writeJsonToStorage(MATERIAL_SETTINGS_STORAGE_KEY, normalized);
}

export function getLightSettings(): LightSettings {
  return cloneLightSettings(sceneState.lightSettings);
}

export function setLightSettings(settings: LightSettings): void {
  const normalized = cloneLightSettings(settings);
  sceneState.lightSettings = normalized;
  writeJsonToStorage(LIGHT_SETTINGS_STORAGE_KEY, normalized);
}
