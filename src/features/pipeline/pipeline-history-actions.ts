import type { PipelineStateSnapshot } from './pipeline-state.ts';

type StatusKind = 'success' | 'error' | 'info';

interface PipelineHistoryLike {
  captureSnapshot: () => PipelineStateSnapshot;
  clearHistory: () => void;
  commitSnapshot: (before: PipelineStateSnapshot) => boolean;
  undo: () => boolean;
  redo: () => boolean;
}

export interface PipelineHistoryActionsControllerOptions {
  history: PipelineHistoryLike;
  onStatus: (message: string, kind?: StatusKind) => void;
  t: (key: unknown, values?: Record<string, string | number>) => string;
}

export interface PipelineHistoryActionsController {
  captureSnapshot: () => PipelineStateSnapshot;
  clearHistory: () => void;
  commitSnapshot: (before: PipelineStateSnapshot) => boolean;
  undo: () => boolean;
  redo: () => boolean;
}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} が不正です。`);
  }
}

function ensureOptions(value: unknown): asserts value is PipelineHistoryActionsControllerOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('PipelineHistoryActionsController の options が不正です。');
  }

  const options = value as Partial<PipelineHistoryActionsControllerOptions>;
  if (!options.history || typeof options.history !== 'object') {
    throw new Error('PipelineHistoryActionsController: history が不正です。');
  }

  const history = options.history as Partial<PipelineHistoryLike>;
  ensureFunction(history.captureSnapshot, 'PipelineHistoryActionsController: history.captureSnapshot');
  ensureFunction(history.clearHistory, 'PipelineHistoryActionsController: history.clearHistory');
  ensureFunction(history.commitSnapshot, 'PipelineHistoryActionsController: history.commitSnapshot');
  ensureFunction(history.undo, 'PipelineHistoryActionsController: history.undo');
  ensureFunction(history.redo, 'PipelineHistoryActionsController: history.redo');

  ensureFunction(options.onStatus, 'PipelineHistoryActionsController: onStatus');
  ensureFunction(options.t, 'PipelineHistoryActionsController: t');
}

export function createPipelineHistoryActionsController(
  options: PipelineHistoryActionsControllerOptions,
): PipelineHistoryActionsController {
  ensureOptions(options);

  const captureSnapshot = (): PipelineStateSnapshot => {
    return options.history.captureSnapshot();
  };

  const clearHistory = (): void => {
    options.history.clearHistory();
  };

  const commitSnapshot = (before: PipelineStateSnapshot): boolean => {
    return options.history.commitSnapshot(before);
  };

  const undo = (): boolean => {
    if (!options.history.undo()) {
      options.onStatus(options.t('main.status.undoUnavailable'), 'info');
      return false;
    }

    options.onStatus(options.t('main.status.undoApplied'), 'info');
    return true;
  };

  const redo = (): boolean => {
    if (!options.history.redo()) {
      options.onStatus(options.t('main.status.redoUnavailable'), 'info');
      return false;
    }

    options.onStatus(options.t('main.status.redoApplied'), 'info');
    return true;
  };

  return {
    captureSnapshot,
    clearHistory,
    commitSnapshot,
    undo,
    redo,
  };
}
