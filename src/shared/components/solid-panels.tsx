import { For, createSignal, type Accessor, type JSX } from 'solid-js';
import { render } from 'solid-js/web';
import * as pipelineModel from '../../features/pipeline/pipeline-model';
import { t, useLanguage } from '../i18n';
import { DropdownMenu } from './solid-dropdown-menu';

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
    && Number.isFinite(light.lightIntensity)
    && isValidColor(light.lightColor)
    && isValidColor(light.ambientColor)
    && typeof light.showGizmo === 'boolean';
}

function cloneMaterialSettings(settings: pipelineModel.MaterialSettings): pipelineModel.MaterialSettings {
  return {
    baseColor: [settings.baseColor[0], settings.baseColor[1], settings.baseColor[2]],
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
    lightIntensity: settings.lightIntensity,
    lightColor: [settings.lightColor[0], settings.lightColor[1], settings.lightColor[2]],
    ambientColor: [settings.ambientColor[0], settings.ambientColor[1], settings.ambientColor[2]],
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

function getLightRangeStep(binding: pipelineModel.LightRangeBinding): string {
  const precision = Math.max(0, Math.trunc(binding.fractionDigits));
  const step = 1 / (10 ** precision);
  return Number.isFinite(step) && step > 0 ? String(step) : '1';
}

function isLightAngleBinding(binding: pipelineModel.LightRangeBinding): boolean {
  return binding.key === 'azimuthDeg' || binding.key === 'elevationDeg';
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

  const handleMaterialRangeWheel = (event: WheelEvent, binding: pipelineModel.MaterialRangeBinding): void => {
    event.preventDefault();
    const step = Number(getMaterialRangeStep(binding.key));
    const delta = event.deltaY < 0 ? step : -step;
    const current = props.settings();
    const next = cloneMaterialSettings(current);
    next[binding.key] = clamp(current[binding.key] + delta, binding.min, binding.max);
    props.commitSettings(next);
  };

  const applyMaterialPreset = (preset: MaterialPresetDefinition): boolean => {
    if (!isValidMaterialSettings(preset.settings)) {
      props.onStatus(tr('panel.status.materialPresetInvalidValue', { value: preset.key }), 'error');
      return false;
    }

    props.commitSettings(cloneMaterialSettings(preset.settings));
    props.onStatus(tr('panel.status.materialPresetApplied', { name: tr(preset.labelKey) }), 'info');
    return true;
  };

  return (
    <>
      <div class="material-panel-head">
        <div>
          <div class="section-label">Material</div>
          <div class="material-help">{tr('panel.materialHelp')}</div>
        </div>
        <DropdownMenu
          wrapperClass="material-action-menu-wrap"
          triggerClass="material-kebab-btn"
          menuClass="material-kebab-menu"
          triggerAriaLabel={tr('panel.materialPreset')}
          menuRole="menu"
        >
          {controls => (
            <>
              <div class="material-kebab-header">{tr('panel.materialPreset')}</div>
              <For each={MATERIAL_PRESETS}>
                {preset => (
                  <button
                    type="button"
                    class="material-kebab-item"
                    role="menuitem"
                    onClick={() => {
                      if (applyMaterialPreset(preset)) {
                        controls.closeMenu();
                      }
                    }}
                  >
                    {tr(preset.labelKey)}
                  </button>
                )}
              </For>
            </>
          )}
        </DropdownMenu>
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
                onWheel={event => handleMaterialRangeWheel(event, binding)}
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

  const handleLightColorInput = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      props.onStatus(tr('panel.lightColorInputMissing'), 'error');
      return;
    }

    const parsed = pipelineModel.parseHexColor(input.value);
    if (!parsed) {
      props.onStatus(tr('panel.lightColorInvalid'), 'error');
      return;
    }

    const current = props.settings();
    props.commitSettings({
      ...current,
      lightColor: [parsed[0], parsed[1], parsed[2]],
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

  const handleLightRangeWheel = (event: WheelEvent, binding: pipelineModel.LightRangeBinding): void => {
    event.preventDefault();
    const step = Number(getLightRangeStep(binding));
    const delta = event.deltaY < 0 ? step : -step;
    const current = props.settings();
    const next = cloneLightSettings(current);
    next[binding.key] = clamp(current[binding.key] + delta, binding.min, binding.max);
    props.commitSettings(next);
  };

  const toggleGizmo = (): void => {
    const current = props.settings();
    props.commitSettings({
      ...current,
      showGizmo: !current.showGizmo,
    });
  };

  const applyLightPreset = (preset: LightPresetDefinition): boolean => {
    if (!isValidLightSettings(preset.settings)) {
      props.onStatus(tr('panel.status.lightPresetInvalidValue', { value: preset.key }), 'error');
      return false;
    }

    props.commitSettings(cloneLightSettings(preset.settings));
    props.onStatus(tr('panel.status.lightPresetApplied', { name: tr(preset.labelKey) }), 'info');
    return true;
  };

  return (
    <>
      <div class="light-panel-head">
        <div>
          <div class="section-label">Light</div>
          <div class="material-help">{tr('panel.lightHelp')}</div>
        </div>

        <div class="light-panel-actions">
          <button
            type="button"
            class="btn-secondary light-toggle-btn"
            id="btn-toggle-light-gizmo"
            aria-pressed={props.settings().showGizmo ? 'true' : 'false'}
            onClick={toggleGizmo}
          >
            {tr('panel.guide')}
          </button>

          <DropdownMenu
            wrapperClass="light-action-menu-wrap"
            triggerClass="light-kebab-btn"
            menuClass="light-kebab-menu"
            triggerAriaLabel={tr('panel.lightPreset')}
            menuRole="menu"
          >
            {controls => (
              <>
                <div class="light-kebab-header">{tr('panel.lightPreset')}</div>
                <For each={LIGHT_PRESETS}>
                  {preset => (
                    <button
                      type="button"
                      class="light-kebab-item"
                      role="menuitem"
                      onClick={() => {
                        if (applyLightPreset(preset)) {
                          controls.closeMenu();
                        }
                      }}
                    >
                      {tr(preset.labelKey)}
                    </button>
                  )}
                </For>
              </>
            )}
          </DropdownMenu>
        </div>
      </div>

      <div class="light-grid">
        <label class="material-field material-field-color">
          <span class="material-label-row">
            <span class="material-label">Light Color</span>
            <span class="material-value" id="light-color-value">{pipelineModel.colorToHex(props.settings().lightColor)}</span>
          </span>
          <input
            class="material-color-input"
            type="color"
            id="light-color"
            value={pipelineModel.colorToHex(props.settings().lightColor)}
            onInput={handleLightColorInput}
          />
        </label>

        <label class="material-field material-field-color">
          <span class="material-label-row">
            <span class="material-label">Ambient Color</span>
            <span class="material-value" id="light-ambient-color-value">{pipelineModel.colorToHex(props.settings().ambientColor)}</span>
          </span>
          <input
            class="material-color-input"
            type="color"
            id="light-ambient-color"
            value={pipelineModel.colorToHex(props.settings().ambientColor)}
            onInput={handleAmbientColorInput}
          />
        </label>

        <For each={pipelineModel.LIGHT_RANGE_BINDINGS}>
          {binding => (
            <label class="material-field">
              <span class="material-label-row">
                <span class="material-label">{binding.label}</span>
                <span class="material-value" id={binding.outputId}>
                  {isLightAngleBinding(binding)
                    ? `${props.settings()[binding.key].toFixed(binding.fractionDigits)}°`
                    : props.settings()[binding.key].toFixed(binding.fractionDigits)}
                </span>
              </span>
              <input
                class="material-range-input"
                type="range"
                id={binding.inputId}
                min={String(binding.min)}
                max={String(binding.max)}
                step={getLightRangeStep(binding)}
                value={String(props.settings()[binding.key])}
                onInput={event => handleRangeInput(event, binding)}
                onChange={event => handleRangeInput(event, binding)}
                onWheel={event => handleLightRangeWheel(event, binding)}
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
