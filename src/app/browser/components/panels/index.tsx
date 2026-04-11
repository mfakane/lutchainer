import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import * as pipelineModel from '../../../../features/pipeline/pipeline-model.ts';
import { t } from '../../i18n.ts';
import {
  cloneLightSettings,
  cloneMaterialSettings,
  ensureLightMountOptions,
  ensureMaterialMountOptions,
  isValidLightSettings,
  isValidMaterialSettings,
  type LightPanelMountOptions,
  type MaterialPanelMountOptions,
  type StatusReporter,
} from './shared.ts';
import { LightPanel } from './solid-light-panel.tsx';
import { MaterialPanel } from './solid-material-panel.tsx';
export {
  mountStatusPanel,
  syncStatusPanelState,
} from './solid-status-panel.tsx';

let disposeMaterialPanel: (() => void) | null = null;
let syncMaterialPanelInternal: ((nextSettings: pipelineModel.MaterialSettings) => void) | null = null;
let materialStatusReporter: StatusReporter = () => undefined;

let disposeLightPanel: (() => void) | null = null;
let syncLightPanelInternal: ((nextSettings: pipelineModel.LightSettings) => void) | null = null;
let lightStatusReporter: StatusReporter = () => undefined;

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

    return <MaterialPanel settings={settings} commitSettings={commitSettings} onStatus={options.onStatus} />;
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

    return <LightPanel settings={settings} commitSettings={commitSettings} onStatus={options.onStatus} />;
  }, target);
}

export function syncMaterialPanelState(nextSettings: pipelineModel.MaterialSettings): void {
  if (!isValidMaterialSettings(nextSettings)) {
    materialStatusReporter(t('panel.status.materialSyncFailed'), 'error');
    return;
  }

  syncMaterialPanelInternal?.(nextSettings);
}

export function syncLightPanelState(nextSettings: pipelineModel.LightSettings): void {
  if (!isValidLightSettings(nextSettings)) {
    lightStatusReporter(t('panel.status.lightSyncFailed'), 'error');
    return;
  }

  syncLightPanelInternal?.(nextSettings);
}
