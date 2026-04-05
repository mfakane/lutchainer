import { CHANNELS } from '../step/step-model';
import type {
  LutModel,
  StepModel,
} from '../step/types';
import type { PipelineStateSnapshot } from './pipeline-state';

interface PipelineHistoryControllerOptions {
  historyLimit: number;
  captureSnapshot: () => PipelineStateSnapshot;
  restoreSnapshot: (snapshot: PipelineStateSnapshot) => void;
  onHistoryStateChange?: (canUndo: boolean, canRedo: boolean) => void;
}

interface PipelineHistoryController {
  captureSnapshot: () => PipelineStateSnapshot;
  clearHistory: () => void;
  commitSnapshot: (before: PipelineStateSnapshot) => boolean;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isStepModel(value: unknown): value is StepModel {
  if (!isObject(value)) {
    return false;
  }

  const candidate = value as Partial<StepModel>;
  return typeof candidate.id === 'string' && candidate.id.trim().length > 0
    && typeof candidate.lutId === 'string'
    && typeof candidate.muted === 'boolean'
    && typeof candidate.blendMode === 'string'
    && typeof candidate.xParam === 'string'
    && typeof candidate.yParam === 'string'
    && isObject(candidate.ops);
}

function isLutModel(value: unknown): value is LutModel {
  if (!isObject(value)) {
    return false;
  }

  const candidate = value as Partial<LutModel>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.width === 'number' && Number.isInteger(candidate.width) && candidate.width > 0
    && typeof candidate.height === 'number' && Number.isInteger(candidate.height) && candidate.height > 0
    && typeof candidate.thumbUrl === 'string';
}

function isPipelineStateSnapshot(value: unknown): value is PipelineStateSnapshot {
  if (!isObject(value)) {
    return false;
  }

  const candidate = value as Partial<PipelineStateSnapshot>;
  return Array.isArray(candidate.steps)
    && candidate.steps.every(step => isStepModel(step))
    && Array.isArray(candidate.luts)
    && candidate.luts.every(lut => isLutModel(lut));
}

function assertValidPipelineSnapshot(value: unknown, label: string): asserts value is PipelineStateSnapshot {
  if (!isPipelineStateSnapshot(value)) {
    throw new Error(`${label} が不正です。`);
  }
}

function cloneStepForHistory(step: StepModel): StepModel {
  return {
    ...step,
    ops: { ...step.ops },
  };
}

function cloneLutForHistory(lut: LutModel): LutModel {
  return {
    ...lut,
  };
}

function clonePipelineSnapshot(snapshot: PipelineStateSnapshot): PipelineStateSnapshot {
  assertValidPipelineSnapshot(snapshot, '履歴スナップショット');
  return {
    steps: snapshot.steps.map(step => cloneStepForHistory(step)),
    luts: snapshot.luts.map(lut => cloneLutForHistory(lut)),
  };
}

function areStepModelsEqual(left: StepModel, right: StepModel): boolean {
  if (left.id !== right.id) return false;
  if (left.lutId !== right.lutId) return false;
  if ((left.label ?? '') !== (right.label ?? '')) return false;
  if (left.muted !== right.muted) return false;
  if (left.blendMode !== right.blendMode) return false;
  if (left.xParam !== right.xParam) return false;
  if (left.yParam !== right.yParam) return false;

  for (const channel of CHANNELS) {
    if (left.ops[channel] !== right.ops[channel]) {
      return false;
    }
  }

  return true;
}

function areLutModelsEqual(left: LutModel, right: LutModel): boolean {
  return left.id === right.id
    && left.name === right.name
    && left.width === right.width
    && left.height === right.height
    && left.thumbUrl === right.thumbUrl;
}

function arePipelineSnapshotsEqual(left: PipelineStateSnapshot, right: PipelineStateSnapshot): boolean {
  if (left.steps.length !== right.steps.length || left.luts.length !== right.luts.length) {
    return false;
  }

  for (let index = 0; index < left.steps.length; index += 1) {
    if (!areStepModelsEqual(left.steps[index], right.steps[index])) {
      return false;
    }
  }

  for (let index = 0; index < left.luts.length; index += 1) {
    if (!areLutModelsEqual(left.luts[index], right.luts[index])) {
      return false;
    }
  }

  return true;
}

function trimHistoryStack(stack: PipelineStateSnapshot[], historyLimit: number): void {
  while (stack.length > historyLimit) {
    stack.shift();
  }
}

function assertValidHistoryOptions(value: unknown): asserts value is PipelineHistoryControllerOptions {
  if (!isObject(value)) {
    throw new Error('Pipeline history options が不正です。');
  }

  const options = value as Partial<PipelineHistoryControllerOptions>;
  if (!isPositiveInteger(options.historyLimit)) {
    throw new Error(`historyLimit が不正です: ${String(options.historyLimit)}`);
  }
  if (typeof options.captureSnapshot !== 'function') {
    throw new Error('captureSnapshot が不正です。');
  }
  if (typeof options.restoreSnapshot !== 'function') {
    throw new Error('restoreSnapshot が不正です。');
  }
  if (options.onHistoryStateChange !== undefined && typeof options.onHistoryStateChange !== 'function') {
    throw new Error('onHistoryStateChange が不正です。');
  }
}

export function createPipelineHistoryController(options: PipelineHistoryControllerOptions): PipelineHistoryController {
  assertValidHistoryOptions(options);

  const undoStack: PipelineStateSnapshot[] = [];
  const redoStack: PipelineStateSnapshot[] = [];

  const emitHistoryState = (): void => {
    options.onHistoryStateChange?.(undoStack.length > 0, redoStack.length > 0);
  };

  const captureSnapshot = (): PipelineStateSnapshot => {
    const snapshot = options.captureSnapshot();
    assertValidPipelineSnapshot(snapshot, 'キャプチャされたパイプライン状態');
    return clonePipelineSnapshot(snapshot);
  };

  const clearHistory = (): void => {
    undoStack.length = 0;
    redoStack.length = 0;
    emitHistoryState();
  };

  const commitSnapshot = (before: PipelineStateSnapshot): boolean => {
    assertValidPipelineSnapshot(before, '履歴記録前のパイプライン状態');

    const normalizedBefore = clonePipelineSnapshot(before);
    const after = captureSnapshot();
    if (arePipelineSnapshotsEqual(normalizedBefore, after)) {
      return false;
    }

    const lastUndo = undoStack[undoStack.length - 1];
    if (!lastUndo || !arePipelineSnapshotsEqual(lastUndo, normalizedBefore)) {
      undoStack.push(normalizedBefore);
      trimHistoryStack(undoStack, options.historyLimit);
    }

    redoStack.length = 0;
    emitHistoryState();
    return true;
  };

  const undo = (): boolean => {
    const previous = undoStack.pop();
    if (!previous) {
      emitHistoryState();
      return false;
    }

    const current = captureSnapshot();
    redoStack.push(current);
    trimHistoryStack(redoStack, options.historyLimit);

    options.restoreSnapshot(clonePipelineSnapshot(previous));
    emitHistoryState();
    return true;
  };

  const redo = (): boolean => {
    const next = redoStack.pop();
    if (!next) {
      emitHistoryState();
      return false;
    }

    const current = captureSnapshot();
    undoStack.push(current);
    trimHistoryStack(undoStack, options.historyLimit);

    options.restoreSnapshot(clonePipelineSnapshot(next));
    emitHistoryState();
    return true;
  };

  return {
    captureSnapshot,
    clearHistory,
    commitSnapshot,
    undo,
    redo,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
  };
}
