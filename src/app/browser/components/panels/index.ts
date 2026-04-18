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
  type StatusKind,
  type StatusReporter,
} from './shared.ts';
import './svelte-light-panel.svelte';
import './svelte-material-panel.svelte';
import './svelte-status-panel.svelte';

let disposeMaterialPanel: (() => void) | null = null;
let syncMaterialPanelInternal: ((nextSettings: pipelineModel.MaterialSettings) => void) | null = null;
let materialStatusReporter: StatusReporter = () => undefined;
let materialPanelHost: SvelteHostElement<Record<string, unknown>> | null = null;

let disposeLightPanel: (() => void) | null = null;
let syncLightPanelInternal: ((nextSettings: pipelineModel.LightSettings) => void) | null = null;
let lightStatusReporter: StatusReporter = () => undefined;
let lightPanelHost: SvelteHostElement<Record<string, unknown>> | null = null;

interface StatusState {
  message: string;
  kind: StatusKind;
}

interface StatusPanelMountOptions {
  initialMessage?: string;
  initialKind?: StatusKind;
}

let disposeStatusPanel: (() => void) | null = null;
let syncStatusPanelInternal: ((nextState: StatusState) => void) | null = null;

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

function isValidStatusKind(value: unknown): value is StatusKind {
  return value === 'success' || value === 'error' || value === 'info';
}

function isValidStatusMessage(value: unknown): value is string {
  return typeof value === 'string';
}

function assertValidStatusState(value: unknown): asserts value is StatusState {
  if (!value || typeof value !== 'object') {
    throw new Error('Status state must be an object.');
  }

  const candidate = value as Partial<StatusState>;
  if (!isValidStatusMessage(candidate.message)) {
    throw new Error('Status message must be a string.');
  }

  if (!isValidStatusKind(candidate.kind)) {
    throw new Error(`Invalid status kind: ${String(candidate.kind)}`);
  }
}

function normalizeInitialStatusState(options: StatusPanelMountOptions | undefined): StatusState {
  const message = options?.initialMessage;
  const kind = options?.initialKind;

  if (message !== undefined && !isValidStatusMessage(message)) {
    throw new Error('initialMessage must be a string when provided.');
  }

  if (kind !== undefined && !isValidStatusKind(kind)) {
    throw new Error(`Invalid initialKind: ${String(kind)}`);
  }

  return {
    message: message ?? '',
    kind: kind ?? 'info',
  };
}

export function mountStatusPanel(target: HTMLElement, options?: StatusPanelMountOptions): void {
  if (!(target instanceof HTMLElement)) {
    throw new Error('mountStatusPanel: target must be an HTMLElement.');
  }

  const initialState = normalizeInitialStatusState(options);

  if (disposeStatusPanel) {
    disposeStatusPanel();
    disposeStatusPanel = null;
  }

  const statusHost = mountSvelteHost({
    tagName: 'lut-status-panel',
    target,
    props: {
      message: initialState.message,
      kind: initialState.kind,
    },
  });

  syncStatusPanelInternal = nextState => {
    assertValidStatusState(nextState);
    statusHost.setHostProps(nextState);
  };

  disposeStatusPanel = () => {
    statusHost.destroyHost();
  };
}

export function syncStatusPanelState(nextState: StatusState): void {
  assertValidStatusState(nextState);
  syncStatusPanelInternal?.(nextState);
}
