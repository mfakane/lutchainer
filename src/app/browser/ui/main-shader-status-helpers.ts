import * as pipelineModel from '../../../features/pipeline/pipeline-model.ts';
import type { ExportShaderZipResult } from '../../../features/shader/shader-export-system.ts';
import type { ShaderBuildInput, ShaderLanguage } from '../../../features/shader/shader-generator.ts';
import type { AppTranslator } from '../../../shared/i18n/browser-translation-contract.ts';
import {
  syncStatusPanelState,
} from '../components/panels/index.ts';
import {
  syncShaderDialogState,
} from '../components/shader-dialog.ts';

type StatusKind = 'success' | 'error' | 'info';
export type MainStatusReporter = (message: string, kind?: StatusKind) => void;

interface CreateShaderBuildInputGetterOptions {
  getSteps: () => ShaderBuildInput['steps'];
  getLuts: () => ShaderBuildInput['luts'];
  getCustomParams: () => ShaderBuildInput['customParams'];
  getMaterialSettings: () => ShaderBuildInput['materialSettings'];
}

interface CreateShaderCodePanelUpdaterOptions {
  getShaderBuildInput: () => ShaderBuildInput;
}

interface CreateLightDirectionWorldGetterOptions {
  getLightSettings: () => pipelineModel.LightSettings;
}

interface ShaderExportSystemLike {
  exportShaderZip: (language: ShaderLanguage) => Promise<ExportShaderZipResult>;
}

interface CreateShaderExportHandlerOptions {
  getShaderExportSystem: () => ShaderExportSystemLike | null;
  onStatus: MainStatusReporter;
  t: AppTranslator;
}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} must be a function.`);
  }
}

function ensureObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function ensureStatusKind(value: unknown): asserts value is StatusKind {
  if (value !== 'success' && value !== 'error' && value !== 'info') {
    throw new Error('Status kind must be one of success, error, or info.');
  }
}

function assertShaderBuildInputGetterOptions(options: CreateShaderBuildInputGetterOptions): void {
  ensureObject(options, 'Shader build input getter options');
  ensureFunction(options.getSteps, 'Shader build input getter options.getSteps');
  ensureFunction(options.getLuts, 'Shader build input getter options.getLuts');
  ensureFunction(options.getCustomParams, 'Shader build input getter options.getCustomParams');
  ensureFunction(options.getMaterialSettings, 'Shader build input getter options.getMaterialSettings');
}

function assertShaderCodePanelUpdaterOptions(options: CreateShaderCodePanelUpdaterOptions): void {
  ensureObject(options, 'Shader code panel updater options');
  ensureFunction(options.getShaderBuildInput, 'Shader code panel updater options.getShaderBuildInput');
}

function assertLightDirectionWorldGetterOptions(options: CreateLightDirectionWorldGetterOptions): void {
  ensureObject(options, 'Light direction world getter options');
  ensureFunction(options.getLightSettings, 'Light direction world getter options.getLightSettings');
}

function assertShaderExportHandlerOptions(options: CreateShaderExportHandlerOptions): void {
  ensureObject(options, 'Shader export handler options');
  ensureFunction(options.getShaderExportSystem, 'Shader export handler options.getShaderExportSystem');
  ensureFunction(options.onStatus, 'Shader export handler options.onStatus');
  ensureFunction(options.t, 'Shader export handler options.t');
}

export function createShaderBuildInputGetter(
  options: CreateShaderBuildInputGetterOptions,
): () => ShaderBuildInput {
  assertShaderBuildInputGetterOptions(options);

  return (): ShaderBuildInput => ({
    steps: options.getSteps(),
    luts: options.getLuts(),
    customParams: options.getCustomParams(),
    materialSettings: options.getMaterialSettings(),
  });
}

export function createShaderCodePanelUpdater(
  options: CreateShaderCodePanelUpdaterOptions,
): (fragmentShader?: string) => void {
  assertShaderCodePanelUpdaterOptions(options);

  return (fragmentShader?: string): void => {
    syncShaderDialogState(options.getShaderBuildInput(), fragmentShader);
  };
}

export function createStatusReporter(): MainStatusReporter {
  return (message: string, kind: StatusKind = 'info'): void => {
    if (typeof message !== 'string' || message.length === 0) {
      throw new Error('Status message must be a non-empty string.');
    }
    ensureStatusKind(kind);

    syncStatusPanelState({
      message,
      kind,
    });
  };
}

export function createShaderExportHandler(
  options: CreateShaderExportHandlerOptions,
): (language: ShaderLanguage) => Promise<void> {
  assertShaderExportHandlerOptions(options);

  return async (language: ShaderLanguage): Promise<void> => {
    const shaderExportSystem = options.getShaderExportSystem();
    if (!shaderExportSystem) {
      options.onStatus(options.t('main.status.shaderExportNotInitialized'), 'error');
      return;
    }

    const result = await shaderExportSystem.exportShaderZip(language);
    if (result.ok) {
      options.onStatus(options.t('shader.status.exportSuccess'), 'success');
      return;
    }

    options.onStatus(
      options.t('shader.status.exportFailed', {
        message: result.errorMessage ?? options.t('common.unknownError'),
      }),
      'error',
    );
  };
}

export function createLightDirectionWorldGetter(
  options: CreateLightDirectionWorldGetterOptions,
): () => [number, number, number] {
  assertLightDirectionWorldGetterOptions(options);
  return (): [number, number, number] => pipelineModel.getLightDirectionWorld(options.getLightSettings());
}
