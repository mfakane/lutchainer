import * as pipelineModel from '../../../../features/pipeline/pipeline-model.ts';
import { t } from '../../i18n.ts';
import { mountSvelteHost, type SvelteHostElement } from '../custom-element-host.ts';
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
import './svelte-light-panel.svelte';
import './svelte-material-panel.svelte';
export {
  mountStatusPanel,
  syncStatusPanelState,
} from './solid-status-panel.tsx';

let disposeMaterialPanel: (() => void) | null = null;
let syncMaterialPanelInternal: ((nextSettings: pipelineModel.MaterialSettings) => void) | null = null;
let materialStatusReporter: StatusReporter = () => undefined;
let materialPanelHost: SvelteHostElement<Record<string, unknown>> | null = null;

let disposeLightPanel: (() => void) | null = null;
let syncLightPanelInternal: ((nextSettings: pipelineModel.LightSettings) => void) | null = null;
let lightStatusReporter: StatusReporter = () => undefined;
let lightPanelHost: SvelteHostElement<Record<string, unknown>> | null = null;

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
  materialPanelHost?.destroyHost();
  materialPanelHost = mountSvelteHost({
    tagName: 'lut-material-panel',
    target,
    props: {
      settings: initialSettings,
      commitSettings: (nextSettings: pipelineModel.MaterialSettings): void => {
        if (!isValidMaterialSettings(nextSettings)) {
          materialStatusReporter(t('panel.status.materialUpdateInvalid'), 'error');
          return;
        }

        const cloned = cloneMaterialSettings(nextSettings);
        materialPanelHost?.setHostProps({ settings: cloned });
        options.onSettingsChange(cloned);
      },
      onStatus: options.onStatus,
    },
  });

  syncMaterialPanelInternal = nextSettings => {
    if (!isValidMaterialSettings(nextSettings)) {
      materialStatusReporter(t('panel.status.materialSyncInvalid'), 'error');
      return;
    }
    materialPanelHost?.setHostProps({ settings: cloneMaterialSettings(nextSettings) });
  };

  disposeMaterialPanel = () => {
    materialPanelHost?.destroyHost();
    materialPanelHost = null;
  };
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
  lightPanelHost?.destroyHost();
  lightPanelHost = mountSvelteHost({
    tagName: 'lut-light-panel',
    target,
    props: {
      settings: initialSettings,
      commitSettings: (nextSettings: pipelineModel.LightSettings): void => {
        if (!isValidLightSettings(nextSettings)) {
          lightStatusReporter(t('panel.status.lightUpdateInvalid'), 'error');
          return;
        }

        const cloned = cloneLightSettings(nextSettings);
        lightPanelHost?.setHostProps({ settings: cloned });
        options.onSettingsChange(cloned);
      },
      onStatus: options.onStatus,
    },
  });

  syncLightPanelInternal = nextSettings => {
    if (!isValidLightSettings(nextSettings)) {
      lightStatusReporter(t('panel.status.lightSyncInvalid'), 'error');
      return;
    }
    lightPanelHost?.setHostProps({ settings: cloneLightSettings(nextSettings) });
  };

  disposeLightPanel = () => {
    lightPanelHost?.destroyHost();
    lightPanelHost = null;
  };
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
