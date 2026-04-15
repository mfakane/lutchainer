import type { AppTranslator } from '../../shared/i18n/browser-translation-contract.ts';
import type { LoadedPipelineData } from './pipeline-model.ts';
import type { PipelineStateSnapshot } from './pipeline-state.ts';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

interface ApplyLoadedPipelineOptions {
  loaded: LoadedPipelineData;
  replacePipelineState: (nextState: PipelineStateSnapshot) => void;
  clearHistory: () => void;
  renderSteps: () => void;
  cancelPendingApply: () => void;
  applyNow: () => void;
  onStatus: StatusReporter;
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

function isLoadedPipelineData(value: unknown): value is LoadedPipelineData {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const loaded = value as Partial<LoadedPipelineData>;
  return Array.isArray(loaded.luts)
    && Array.isArray(loaded.steps);
}

function assertOptions(options: ApplyLoadedPipelineOptions): void {
  ensureObject(options, 'Apply loaded pipeline options');

  if (!isLoadedPipelineData(options.loaded)) {
    throw new Error('Apply loaded pipeline options.loaded is invalid.');
  }

  ensureFunction(options.replacePipelineState, 'Apply loaded pipeline replacePipelineState');
  ensureFunction(options.clearHistory, 'Apply loaded pipeline clearHistory');
  ensureFunction(options.renderSteps, 'Apply loaded pipeline renderSteps');
  ensureFunction(options.cancelPendingApply, 'Apply loaded pipeline cancelPendingApply');
  ensureFunction(options.applyNow, 'Apply loaded pipeline applyNow');
  ensureFunction(options.onStatus, 'Apply loaded pipeline onStatus');
  ensureFunction(options.t, 'Apply loaded pipeline t');
}

export function applyLoadedPipelineState(options: ApplyLoadedPipelineOptions): void {
  assertOptions(options);

  options.replacePipelineState({
    customParams: options.loaded.customParams,
    luts: options.loaded.luts,
    steps: options.loaded.steps,
  });
  options.clearHistory();
  options.renderSteps();
  options.cancelPendingApply();
  options.onStatus(options.t('main.status.pipelineLoaded'), 'info');
  options.applyNow();
}
