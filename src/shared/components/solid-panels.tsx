import { For, createSignal, type Accessor, type JSX } from 'solid-js';
import { render } from 'solid-js/web';
import * as pipelineModel from '../../features/pipeline/pipeline-model';
import { t, useLanguage } from '../i18n';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

interface MaterialPresetDefinition {
  key: string;
  labelKey: string;
  settings: pipelineModel.MaterialSettings;
}

interface LightPresetDefinition {
  key: string;
  labelKey: string;
  settings: pipelineModel.LightSettings;
}

const MATERIAL_PRESETS: MaterialPresetDefinition[] = [
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
      ambientColor: [0.06, 0.06, 0.07],
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
      ambientColor: [0.02, 0.02, 0.03],
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
      ambientColor: [0.00, 0.03, 0.05],
      specularStrength: 0.62,
      specularPower: 44,
      fresnelStrength: 0.46,
      fresnelPower: 2.8,
    },
  },
];

const LIGHT_PRESETS: LightPresetDefinition[] = [
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
      showGizmo: true,
    },
  },
  {
    key: 'rim-side',
    labelKey: 'panel.preset.light.rimSide',
    settings: {
      azimuthDeg: -115,
      elevationDeg: 18,
      showGizmo: true,
    },
  },
  {
    key: 'top-down',
    labelKey: 'panel.preset.light.topDown',
    settings: {
      azimuthDeg: 0,
      elevationDeg: 82,
      showGizmo: true,
    },
  },
];

interface MaterialPanelMountOptions {
  initialSettings: pipelineModel.MaterialSettings;
  onSettingsChange: (nextSettings: pipelineModel.MaterialSettings) => void;
  onStatus: StatusReporter;
}

interface LightPanelMountOptions {
  initialSettings: pipelineModel.LightSettings;
  onSettingsChange: (nextSettings: pipelineModel.LightSettings) => void;
  onStatus: StatusReporter;
}

interface MaterialPanelProps {
  settings: Accessor<pipelineModel.MaterialSettings>;
  commitSettings: (nextSettings: pipelineModel.MaterialSettings) => void;
  onStatus: StatusReporter;
}

interface LightPanelProps {
  settings: Accessor<pipelineModel.LightSettings>;
  commitSettings: (nextSettings: pipelineModel.LightSettings) => void;
  onStatus: StatusReporter;
}

let disposeMaterialPanel: (() => void) | null = null;
let syncMaterialPanelInternal: ((nextSettings: pipelineModel.MaterialSettings) => void) | null = null;
let materialStatusReporter: StatusReporter = () => undefined;

let disposeLightPanel: (() => void) | null = null;
let syncLightPanelInternal: ((nextSettings: pipelineModel.LightSettings) => void) | null = null;
let lightStatusReporter: StatusReporter = () => undefined;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isValidColor(value: unknown): value is [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) {
    return false;
  }

  return value.every(channel => Number.isFinite(channel));
}

function isValidMaterialSettings(value: unknown): value is pipelineModel.MaterialSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const material = value as Partial<pipelineModel.MaterialSettings>;
  return isValidColor(material.baseColor)
    && isValidColor(material.ambientColor)
    && Number.isFinite(material.specularStrength)
    && Number.isFinite(material.specularPower)
    && Number.isFinite(material.fresnelStrength)
    && Number.isFinite(material.fresnelPower);
}

function isValidLightSettings(value: unknown): value is pipelineModel.LightSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const light = value as Partial<pipelineModel.LightSettings>;
  return Number.isFinite(light.azimuthDeg)
    && Number.isFinite(light.elevationDeg)
    && typeof light.showGizmo === 'boolean';
}

function cloneMaterialSettings(settings: pipelineModel.MaterialSettings): pipelineModel.MaterialSettings {
  return {
    baseColor: [settings.baseColor[0], settings.baseColor[1], settings.baseColor[2]],
    ambientColor: [settings.ambientColor[0], settings.ambientColor[1], settings.ambientColor[2]],
    specularStrength: settings.specularStrength,
    specularPower: settings.specularPower,
    fresnelStrength: settings.fresnelStrength,
    fresnelPower: settings.fresnelPower,
  };
}

function cloneLightSettings(settings: pipelineModel.LightSettings): pipelineModel.LightSettings {
  return {
    azimuthDeg: settings.azimuthDeg,
    elevationDeg: settings.elevationDeg,
    showGizmo: settings.showGizmo,
  };
}

function getMaterialRangeStep(key: pipelineModel.MaterialNumericKey): string {
  switch (key) {
    case 'specularPower':
      return '1';
    case 'fresnelPower':
      return '0.1';
    default:
      return '0.01';
  }
}

function getMaterialPresetByKey(value: unknown): MaterialPresetDefinition | null {
  if (typeof value !== 'string') {
    return null;
  }

  const key = value.trim();
  if (key.length === 0) {
    return null;
  }

  return MATERIAL_PRESETS.find(preset => preset.key === key) ?? null;
}

function getLightPresetByKey(value: unknown): LightPresetDefinition | null {
  if (typeof value !== 'string') {
    return null;
  }

  const key = value.trim();
  if (key.length === 0) {
    return null;
  }

  return LIGHT_PRESETS.find(preset => preset.key === key) ?? null;
}

function ensureMaterialMountOptions(value: unknown): asserts value is MaterialPanelMountOptions {
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

function ensureLightMountOptions(value: unknown): asserts value is LightPanelMountOptions {
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

function MaterialPanel(props: MaterialPanelProps): JSX.Element {
  const language = useLanguage();

  const tr = (key: string, values?: Record<string, string | number>): string => {
    language();
    return t(key, values);
  };

  const handleBaseColorInput = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      props.onStatus(tr('panel.baseColorInputMissing'), 'error');
      return;
    }

    const parsed = pipelineModel.parseHexColor(input.value);
    if (!parsed) {
      props.onStatus(tr('panel.baseColorInvalid'), 'error');
      return;
    }

    const current = props.settings();
    props.commitSettings({
      ...current,
      baseColor: [parsed[0], parsed[1], parsed[2]],
    });
  };

  const handleAmbientColorInput = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      props.onStatus(tr('panel.ambientColorInputMissing'), 'error');
      return;
    }

    const parsed = pipelineModel.parseHexColor(input.value);
    if (!parsed) {
      props.onStatus(tr('panel.ambientColorInvalid'), 'error');
      return;
    }

    const current = props.settings();
    props.commitSettings({
      ...current,
      ambientColor: [parsed[0], parsed[1], parsed[2]],
    });
  };

  const handleRangeInput = (event: Event, binding: pipelineModel.MaterialRangeBinding): void => {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      props.onStatus(tr('panel.rangeInputMissing', { label: binding.label }), 'error');
      return;
    }

    const parsed = Number(input.value);
    if (!Number.isFinite(parsed)) {
      props.onStatus(tr('panel.rangeInvalid', { label: binding.label }), 'error');
      return;
    }

    const current = props.settings();
    const next = cloneMaterialSettings(current);
    next[binding.key] = clamp(parsed, binding.min, binding.max);
    props.commitSettings(next);
  };

  const handleMaterialPresetChange = (event: Event): void => {
    const select = event.currentTarget as HTMLSelectElement | null;
    if (!(select instanceof HTMLSelectElement)) {
      props.onStatus(tr('panel.status.materialPresetSelectMissing'), 'error');
      return;
    }

    const preset = getMaterialPresetByKey(select.value);
    if (!preset || !isValidMaterialSettings(preset.settings)) {
      props.onStatus(tr('panel.status.materialPresetInvalidValue', { value: String(select.value) }), 'error');
      return;
    }

    props.commitSettings(cloneMaterialSettings(preset.settings));
    props.onStatus(tr('panel.status.materialPresetApplied', { name: tr(preset.labelKey) }), 'info');
  };

  return (
    <>
      <div class="material-panel-head">
        <div>
          <div class="section-label">Material</div>
          <div class="material-help">{tr('panel.materialHelp')}</div>
        </div>
        <label class="panel-preset-row">
          <span class="panel-preset-label">{tr('panel.materialPreset')}</span>
          <select
            class="panel-preset-select"
            id="material-preset-select"
            aria-label={tr('panel.materialPreset')}
            onChange={handleMaterialPresetChange}
          >
            <optgroup label={tr('panel.preset.groupLabel')}>
              <For each={MATERIAL_PRESETS}>
                {preset => (
                  <option value={preset.key}>{tr(preset.labelKey)}</option>
                )}
              </For>
            </optgroup>
          </select>
        </label>
      </div>

      <div class="material-grid">
        <label class="material-field material-field-color">
          <span class="material-label-row">
            <span class="material-label">Base Color</span>
            <span class="material-value" id="mat-base-color-value">{pipelineModel.colorToHex(props.settings().baseColor)}</span>
          </span>
          <input
            class="material-color-input"
            type="color"
            id="mat-base-color"
            value={pipelineModel.colorToHex(props.settings().baseColor)}
            onInput={handleBaseColorInput}
          />
        </label>

        <label class="material-field material-field-color">
          <span class="material-label-row">
            <span class="material-label">Ambient Color</span>
            <span class="material-value" id="mat-ambient-color-value">{pipelineModel.colorToHex(props.settings().ambientColor)}</span>
          </span>
          <input
            class="material-color-input"
            type="color"
            id="mat-ambient-color"
            value={pipelineModel.colorToHex(props.settings().ambientColor)}
            onInput={handleAmbientColorInput}
          />
        </label>

        <For each={pipelineModel.MATERIAL_RANGE_BINDINGS}>
          {binding => (
            <label class="material-field">
              <span class="material-label-row">
                <span class="material-label">{binding.label}</span>
                <span class="material-value" id={binding.outputId}>
                  {props.settings()[binding.key].toFixed(binding.fractionDigits)}
                </span>
              </span>
              <input
                class="material-range-input"
                type="range"
                id={binding.inputId}
                min={String(binding.min)}
                max={String(binding.max)}
                step={getMaterialRangeStep(binding.key)}
                value={String(props.settings()[binding.key])}
                onInput={event => handleRangeInput(event, binding)}
                onChange={event => handleRangeInput(event, binding)}
              />
            </label>
          )}
        </For>
      </div>
    </>
  );
}

function LightPanel(props: LightPanelProps): JSX.Element {
  const language = useLanguage();

  const tr = (key: string, values?: Record<string, string | number>): string => {
    language();
    return t(key, values);
  };

  const handleRangeInput = (event: Event, binding: pipelineModel.LightRangeBinding): void => {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      props.onStatus(tr('panel.rangeInputMissing', { label: binding.label }), 'error');
      return;
    }

    const parsed = Number(input.value);
    if (!Number.isFinite(parsed)) {
      props.onStatus(tr('panel.rangeInvalid', { label: binding.label }), 'error');
      return;
    }

    const current = props.settings();
    const next = cloneLightSettings(current);
    next[binding.key] = clamp(parsed, binding.min, binding.max);
    props.commitSettings(next);
  };

  const toggleGizmo = (): void => {
    const current = props.settings();
    props.commitSettings({
      ...current,
      showGizmo: !current.showGizmo,
    });
  };

  const handleLightPresetChange = (event: Event): void => {
    const select = event.currentTarget as HTMLSelectElement | null;
    if (!(select instanceof HTMLSelectElement)) {
      props.onStatus(tr('panel.status.lightPresetSelectMissing'), 'error');
      return;
    }

    const preset = getLightPresetByKey(select.value);
    if (!preset || !isValidLightSettings(preset.settings)) {
      props.onStatus(tr('panel.status.lightPresetInvalidValue', { value: String(select.value) }), 'error');
      return;
    }

    props.commitSettings(cloneLightSettings(preset.settings));
    props.onStatus(tr('panel.status.lightPresetApplied', { name: tr(preset.labelKey) }), 'info');
  };

  return (
    <>
      <div class="light-panel-head">
        <div>
          <div class="section-label">Light</div>
          <div class="material-help">{tr('panel.lightHelp')}</div>
        </div>

        <div class="light-panel-actions">
          <label class="panel-preset-row">
            <span class="panel-preset-label">{tr('panel.lightPreset')}</span>
            <select
              class="panel-preset-select"
              id="light-preset-select"
              aria-label={tr('panel.lightPreset')}
              onChange={handleLightPresetChange}
            >
              <optgroup label={tr('panel.preset.groupLabel')}>
                <For each={LIGHT_PRESETS}>
                  {preset => (
                    <option value={preset.key}>{tr(preset.labelKey)}</option>
                  )}
                </For>
              </optgroup>
            </select>
          </label>

          <button
            type="button"
            class="btn-secondary light-toggle-btn"
            id="btn-toggle-light-gizmo"
            aria-pressed={props.settings().showGizmo ? 'true' : 'false'}
            onClick={toggleGizmo}
          >
            {tr('panel.guide', { state: props.settings().showGizmo ? tr('common.on') : tr('common.off') })}
          </button>
        </div>
      </div>

      <div class="light-grid">
        <For each={pipelineModel.LIGHT_RANGE_BINDINGS}>
          {binding => (
            <label class="material-field">
              <span class="material-label-row">
                <span class="material-label">{binding.label}</span>
                <span class="material-value" id={binding.outputId}>
                  {`${props.settings()[binding.key].toFixed(binding.fractionDigits)}°`}
                </span>
              </span>
              <input
                class="material-range-input"
                type="range"
                id={binding.inputId}
                min={String(binding.min)}
                max={String(binding.max)}
                step="1"
                value={String(props.settings()[binding.key])}
                onInput={event => handleRangeInput(event, binding)}
                onChange={event => handleRangeInput(event, binding)}
              />
            </label>
          )}
        </For>
      </div>
    </>
  );
}

export function mountMaterialPanel(target: HTMLElement, options: MaterialPanelMountOptions): void {
  if (!(target instanceof HTMLElement)) {
    throw new Error('Materialパネルの描画先要素が不正です。');
  }

  ensureMaterialMountOptions(options);
  materialStatusReporter = options.onStatus;

  if (disposeMaterialPanel) {
    disposeMaterialPanel();
    disposeMaterialPanel = null;
  }

  const initialSettings = cloneMaterialSettings(options.initialSettings);
  target.textContent = '';

  disposeMaterialPanel = render(() => {
    const [settings, setSettings] = createSignal(initialSettings);

    syncMaterialPanelInternal = nextSettings => {
      if (!isValidMaterialSettings(nextSettings)) {
        materialStatusReporter(t('panel.status.materialSyncInvalid'), 'error');
        return;
      }
      setSettings(cloneMaterialSettings(nextSettings));
    };

    const commitSettings = (nextSettings: pipelineModel.MaterialSettings): void => {
      if (!isValidMaterialSettings(nextSettings)) {
        materialStatusReporter(t('panel.status.materialUpdateInvalid'), 'error');
        return;
      }

      const cloned = cloneMaterialSettings(nextSettings);
      setSettings(cloned);
      options.onSettingsChange(cloned);
    };

    return (
      <MaterialPanel
        settings={settings}
        commitSettings={commitSettings}
        onStatus={options.onStatus}
      />
    );
  }, target);
}

export function mountLightPanel(target: HTMLElement, options: LightPanelMountOptions): void {
  if (!(target instanceof HTMLElement)) {
    throw new Error('Lightパネルの描画先要素が不正です。');
  }

  ensureLightMountOptions(options);
  lightStatusReporter = options.onStatus;

  if (disposeLightPanel) {
    disposeLightPanel();
    disposeLightPanel = null;
  }

  const initialSettings = cloneLightSettings(options.initialSettings);
  target.textContent = '';

  disposeLightPanel = render(() => {
    const [settings, setSettings] = createSignal(initialSettings);

    syncLightPanelInternal = nextSettings => {
      if (!isValidLightSettings(nextSettings)) {
        lightStatusReporter(t('panel.status.lightSyncInvalid'), 'error');
        return;
      }
      setSettings(cloneLightSettings(nextSettings));
    };

    const commitSettings = (nextSettings: pipelineModel.LightSettings): void => {
      if (!isValidLightSettings(nextSettings)) {
        lightStatusReporter(t('panel.status.lightUpdateInvalid'), 'error');
        return;
      }

      const cloned = cloneLightSettings(nextSettings);
      setSettings(cloned);
      options.onSettingsChange(cloned);
    };

    return (
      <LightPanel
        settings={settings}
        commitSettings={commitSettings}
        onStatus={options.onStatus}
      />
    );
  }, target);
}

export function syncMaterialPanelState(nextSettings: pipelineModel.MaterialSettings): void {
  if (!isValidMaterialSettings(nextSettings)) {
    materialStatusReporter(t('panel.status.materialSyncFailed'), 'error');
    return;
  }

  if (syncMaterialPanelInternal) {
    syncMaterialPanelInternal(nextSettings);
  }
}

export function syncLightPanelState(nextSettings: pipelineModel.LightSettings): void {
  if (!isValidLightSettings(nextSettings)) {
    lightStatusReporter(t('panel.status.lightSyncFailed'), 'error');
    return;
  }

  if (syncLightPanelInternal) {
    syncLightPanelInternal(nextSettings);
  }
}
