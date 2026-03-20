import * as pipelineModel from '../../features/pipeline/pipeline-model.ts';
import type { ShaderBuildInput } from '../../features/shader/shader-generator.ts';
import {
  syncShaderDialogState,
} from '../components/solid-shader-dialog.tsx';
import {
  syncStatusLogState,
} from '../components/solid-status.tsx';

type StatusKind = 'success' | 'error' | 'info';
export type MainStatusReporter = (message: string, kind?: StatusKind) => void;

interface CreateShaderBuildInputGetterOptions {
  getSteps: () => ShaderBuildInput['steps'];
  getLuts: () => ShaderBuildInput['luts'];
  getMaterialSettings: () => ShaderBuildInput['materialSettings'];
}

interface CreateShaderCodePanelUpdaterOptions {
  getShaderBuildInput: () => ShaderBuildInput;
}

interface CreateLightDirectionWorldGetterOptions {
  getLightSettings: () => pipelineModel.LightSettings;
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

export function createShaderBuildInputGetter(
  options: CreateShaderBuildInputGetterOptions,
): () => ShaderBuildInput {
  assertShaderBuildInputGetterOptions(options);

  return (): ShaderBuildInput => ({
    steps: options.getSteps(),
    luts: options.getLuts(),
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

    syncStatusLogState({
      message,
      kind,
    });
  };
}

export function createLightDirectionWorldGetter(
  options: CreateLightDirectionWorldGetterOptions,
): () => [number, number, number] {
  assertLightDirectionWorldGetterOptions(options);
  return (): [number, number, number] => pipelineModel.getLightDirectionWorld(options.getLightSettings());
}