import * as pipelineModel from '../../../../features/pipeline/pipeline-model.ts';
import { t } from '../../i18n.ts';
import { syncParamNodeListMaterialSettings } from '../pipeline-lists/index.ts';
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
} from './shared.ts';

type StatusReporter = (message: string, kind?: StatusKind) => void;

interface MaterialPanelElement extends HTMLElement {
  settings: pipelineModel.MaterialSettings;
}

interface LightPanelElement extends HTMLElement {
  settings: pipelineModel.LightSettings;
}

interface StatusPanelElement extends HTMLElement {
  message: string;
  kind: StatusKind;
}

interface StatusState {
  message: string;
  kind: StatusKind;
}

interface StatusPanelMountOptions {
  initialMessage?: string;
  initialKind?: StatusKind;
}

let materialPanelElement: MaterialPanelElement | null = null;
let lightPanelElement: LightPanelElement | null = null;
let statusPanelElement: StatusPanelElement | null = null;
let materialStatusReporter: StatusReporter = () => undefined;
let lightStatusReporter: StatusReporter = () => undefined;

export function mountMaterialPanel(target: HTMLElement, options: MaterialPanelMountOptions): void {
  if (!(target instanceof HTMLElement)) {
    throw new Error('Materialパネルの描画先要素が不正です。');
  }

  ensureMaterialMountOptions(options);
  materialStatusReporter = options.onStatus;

  const element = target as MaterialPanelElement;
  element.settings = cloneMaterialSettings(options.initialSettings);
  syncParamNodeListMaterialSettings(options.initialSettings);
  materialPanelElement = element;

  element.addEventListener('settings-change', event => {
    const detail = (event as CustomEvent<{ settings: pipelineModel.MaterialSettings }>).detail;
    if (!isValidMaterialSettings(detail.settings)) {
      materialStatusReporter(t('panel.status.materialUpdateInvalid'), 'error');
      return;
    }

    const cloned = cloneMaterialSettings(detail.settings);
    element.settings = cloned;
    syncParamNodeListMaterialSettings(cloned);
    options.onSettingsChange(cloned);
  });
  element.addEventListener('status-message', event => {
    const detail = (event as CustomEvent<{ message: string; kind?: StatusKind }>).detail;
    options.onStatus(detail.message, detail.kind);
  });
}

export function mountLightPanel(target: HTMLElement, options: LightPanelMountOptions): void {
  if (!(target instanceof HTMLElement)) {
    throw new Error('Lightパネルの描画先要素が不正です。');
  }

  ensureLightMountOptions(options);
  lightStatusReporter = options.onStatus;

  const element = target as LightPanelElement;
  element.settings = cloneLightSettings(options.initialSettings);
  lightPanelElement = element;

  element.addEventListener('settings-change', event => {
    const detail = (event as CustomEvent<{ settings: pipelineModel.LightSettings }>).detail;
    if (!isValidLightSettings(detail.settings)) {
      lightStatusReporter(t('panel.status.lightUpdateInvalid'), 'error');
      return;
    }

    const cloned = cloneLightSettings(detail.settings);
    element.settings = cloned;
    options.onSettingsChange(cloned);
  });
  element.addEventListener('status-message', event => {
    const detail = (event as CustomEvent<{ message: string; kind?: StatusKind }>).detail;
    options.onStatus(detail.message, detail.kind);
  });
}

export function syncMaterialPanelState(nextSettings: pipelineModel.MaterialSettings): void {
  if (!isValidMaterialSettings(nextSettings)) {
    materialStatusReporter(t('panel.status.materialSyncFailed'), 'error');
    return;
  }

  if (materialPanelElement) {
    const cloned = cloneMaterialSettings(nextSettings);
    materialPanelElement.settings = cloned;
    syncParamNodeListMaterialSettings(cloned);
  }
}

export function syncLightPanelState(nextSettings: pipelineModel.LightSettings): void {
  if (!isValidLightSettings(nextSettings)) {
    lightStatusReporter(t('panel.status.lightSyncFailed'), 'error');
    return;
  }

  if (lightPanelElement) {
    lightPanelElement.settings = cloneLightSettings(nextSettings);
  }
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
  const element = target as StatusPanelElement;
  element.message = initialState.message;
  element.kind = initialState.kind;
  statusPanelElement = element;
}

export function syncStatusPanelState(nextState: StatusState): void {
  assertValidStatusState(nextState);
  if (!statusPanelElement) {
    return;
  }

  statusPanelElement.message = nextState.message;
  statusPanelElement.kind = nextState.kind;
}
