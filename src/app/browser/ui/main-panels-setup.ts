import type { LightSettings, MaterialSettings } from '../../../features/pipeline/pipeline-model.ts';
import type { ShaderBuildInput } from '../../../features/shader/shader-generator.ts';
import {
  mountLightPanel,
  mountMaterialPanel,
  mountStatusPanel,
  syncLightPanelState,
  syncMaterialPanelState,
} from '../components/panels/index.tsx';
import {
  mountShaderDialogShell,
  syncShaderDialogState,
} from '../components/solid-shader-dialog.tsx';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

export interface SetupMainPanelsOptions {
  materialPanelEl: HTMLElement;
  lightPanelEl: HTMLElement;
  statusPanelEl: HTMLElement;
  initialStatusMessage: string;
  initialStatusKind?: StatusKind;
  shaderDialogEl: HTMLDialogElement;
  shaderOpenButtonEl: HTMLButtonElement;
  shaderSurfaceEl: Element;
  lightGizmoLayerEl: SVGSVGElement;
  getMaterialSettings: () => MaterialSettings;
  setMaterialSettings: (nextSettings: MaterialSettings) => void;
  getLightSettings: () => LightSettings;
  setLightSettings: (nextSettings: LightSettings) => void;
  getShaderBuildInput: () => ShaderBuildInput;
  onExportShaderZip: () => void | Promise<void>;
  onUpdateStepSwatches: () => void;
  onUpdateShaderCodePanel: () => void;
  onScheduleApply: () => void;
  onStatus: StatusReporter;
}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} が不正です。`);
  }
}

function ensureOptions(value: unknown): asserts value is SetupMainPanelsOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Main panel setup options が不正です。');
  }

  const options = value as Partial<SetupMainPanelsOptions>;
  if (!(options.materialPanelEl instanceof HTMLElement)) {
    throw new Error('Main panel setup: materialPanelEl が不正です。');
  }
  if (!(options.lightPanelEl instanceof HTMLElement)) {
    throw new Error('Main panel setup: lightPanelEl が不正です。');
  }
  if (!(options.statusPanelEl instanceof HTMLElement)) {
    throw new Error('Main panel setup: statusPanelEl が不正です。');
  }
  if (typeof options.initialStatusMessage !== 'string') {
    throw new Error('Main panel setup: initialStatusMessage が不正です。');
  }
  if (
    options.initialStatusKind !== undefined
      && options.initialStatusKind !== 'success'
      && options.initialStatusKind !== 'error'
      && options.initialStatusKind !== 'info'
  ) {
    throw new Error('Main panel setup: initialStatusKind が不正です。');
  }
  if (!(options.shaderDialogEl instanceof HTMLDialogElement)) {
    throw new Error('Main panel setup: shaderDialogEl が不正です。');
  }
  if (!(options.shaderOpenButtonEl instanceof HTMLButtonElement)) {
    throw new Error('Main panel setup: shaderOpenButtonEl が不正です。');
  }
  if (!(options.shaderSurfaceEl instanceof Element)) {
    throw new Error('Main panel setup: shaderSurfaceEl が不正です。');
  }
  if (!(options.lightGizmoLayerEl instanceof SVGSVGElement)) {
    throw new Error('Main panel setup: lightGizmoLayerEl が不正です。');
  }

  ensureFunction(options.getMaterialSettings, 'Main panel setup: getMaterialSettings');
  ensureFunction(options.setMaterialSettings, 'Main panel setup: setMaterialSettings');
  ensureFunction(options.getLightSettings, 'Main panel setup: getLightSettings');
  ensureFunction(options.setLightSettings, 'Main panel setup: setLightSettings');
  ensureFunction(options.getShaderBuildInput, 'Main panel setup: getShaderBuildInput');
  ensureFunction(options.onExportShaderZip, 'Main panel setup: onExportShaderZip');
  ensureFunction(options.onUpdateStepSwatches, 'Main panel setup: onUpdateStepSwatches');
  ensureFunction(options.onUpdateShaderCodePanel, 'Main panel setup: onUpdateShaderCodePanel');
  ensureFunction(options.onScheduleApply, 'Main panel setup: onScheduleApply');
  ensureFunction(options.onStatus, 'Main panel setup: onStatus');
}

export function setupMainPanels(options: SetupMainPanelsOptions): void {
  ensureOptions(options);

  mountMaterialPanel(options.materialPanelEl, {
    initialSettings: options.getMaterialSettings(),
    onSettingsChange: nextSettings => {
      options.setMaterialSettings(nextSettings);
      options.onUpdateStepSwatches();
      options.onUpdateShaderCodePanel();
      options.onScheduleApply();
    },
    onStatus: options.onStatus,
  });

  syncMaterialPanelState(options.getMaterialSettings());
  options.onUpdateShaderCodePanel();

  mountLightPanel(options.lightPanelEl, {
    initialSettings: options.getLightSettings(),
    onSettingsChange: nextSettings => {
      const wasVisible = options.getLightSettings().showGizmo;
      options.setLightSettings(nextSettings);
      const lightSettings = options.getLightSettings();
      options.onUpdateShaderCodePanel();

      if (wasVisible && !lightSettings.showGizmo) {
        options.lightGizmoLayerEl.style.opacity = '0';
      }
    },
    onStatus: options.onStatus,
  });

  syncLightPanelState(options.getLightSettings());

  mountStatusPanel(options.statusPanelEl, {
    initialMessage: options.initialStatusMessage,
    initialKind: options.initialStatusKind,
  });

  mountShaderDialogShell({
    dialogEl: options.shaderDialogEl,
    openButtonEl: options.shaderOpenButtonEl,
    surfaceEl: options.shaderSurfaceEl,
    onBeforeOpen: options.onUpdateShaderCodePanel,
    onExport: options.onExportShaderZip,
    onStatus: options.onStatus,
  });

  syncShaderDialogState(options.getShaderBuildInput());
}
