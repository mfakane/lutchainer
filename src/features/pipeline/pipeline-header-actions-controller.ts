import type {
  LoadPipelineFromFileResult,
  SavePipelineAsFileResult,
} from './pipeline-io-system.ts';
import type { LoadedPipelineData } from './pipeline-model.ts';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;
type Translator = (key: unknown, values?: Record<string, string | number>) => string;

interface PipelineIoSystemLike {
  savePipelineAsFile: () => Promise<SavePipelineAsFileResult>;
  loadPipelineFromFile: (file: File) => Promise<LoadPipelineFromFileResult>;
}

export interface PipelineHeaderActionMountOptions {
  initialAutoApplyEnabled: boolean;
  initialCanUndo: boolean;
  initialCanRedo: boolean;
  onUndoPipeline: () => void;
  onRedoPipeline: () => void;
  onResetPipeline: () => void;
  onSavePipeline: () => void | Promise<void>;
  onApplyPipeline: () => void;
  onPipelineFileSelected: (file: File) => void | Promise<void>;
  onAutoApplyChange: (enabled: boolean) => void;
  onStatus: StatusReporter;
}

export interface PipelineHeaderActionControllerOptions {
  isAutoApplyEnabled: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  onUndoPipeline: () => void;
  onRedoPipeline: () => void;
  onResetPipelineState: () => void;
  onApplyPipeline: () => void;
  onApplyLoadedPipeline: (loaded: LoadedPipelineData) => void;
  getPipelineIoSystem: () => PipelineIoSystemLike | null;
  setAutoApplyEnabled: (enabled: boolean) => void;
  syncAutoApplyState: (enabled: boolean) => void;
  scheduleApply: () => void;
  onStatus: StatusReporter;
  t: Translator;
}

export interface PipelineHeaderActionController {
  buildMountOptions: () => PipelineHeaderActionMountOptions;
}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} が不正です。`);
  }
}

function ensureBoolean(value: unknown, label: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} が不正です。`);
  }
}

function hasFileApi(): boolean {
  return typeof File !== 'undefined';
}

function isFile(value: unknown): value is File {
  return hasFileApi() && value instanceof File;
}

function ensureOptions(value: unknown): asserts value is PipelineHeaderActionControllerOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('PipelineHeaderActionController の options が不正です。');
  }

  const options = value as Partial<PipelineHeaderActionControllerOptions>;
  ensureFunction(options.isAutoApplyEnabled, 'PipelineHeaderActionController: isAutoApplyEnabled');
  ensureFunction(options.canUndo, 'PipelineHeaderActionController: canUndo');
  ensureFunction(options.canRedo, 'PipelineHeaderActionController: canRedo');
  ensureFunction(options.onUndoPipeline, 'PipelineHeaderActionController: onUndoPipeline');
  ensureFunction(options.onRedoPipeline, 'PipelineHeaderActionController: onRedoPipeline');
  ensureFunction(options.onResetPipelineState, 'PipelineHeaderActionController: onResetPipelineState');
  ensureFunction(options.onApplyPipeline, 'PipelineHeaderActionController: onApplyPipeline');
  ensureFunction(options.onApplyLoadedPipeline, 'PipelineHeaderActionController: onApplyLoadedPipeline');
  ensureFunction(options.getPipelineIoSystem, 'PipelineHeaderActionController: getPipelineIoSystem');
  ensureFunction(options.setAutoApplyEnabled, 'PipelineHeaderActionController: setAutoApplyEnabled');
  ensureFunction(options.syncAutoApplyState, 'PipelineHeaderActionController: syncAutoApplyState');
  ensureFunction(options.scheduleApply, 'PipelineHeaderActionController: scheduleApply');
  ensureFunction(options.onStatus, 'PipelineHeaderActionController: onStatus');
  ensureFunction(options.t, 'PipelineHeaderActionController: t');
}

export function createPipelineHeaderActionController(
  options: PipelineHeaderActionControllerOptions,
): PipelineHeaderActionController {
  ensureOptions(options);

  const onUndoPipeline = (): void => {
    options.onUndoPipeline();
  };

  const onRedoPipeline = (): void => {
    options.onRedoPipeline();
  };

  const onResetPipeline = (): void => {
    options.onResetPipelineState();
    options.onStatus(options.t('main.status.resetStepChain'), 'info');
  };

  const onSavePipeline = async (): Promise<void> => {
    const pipelineIoSystem = options.getPipelineIoSystem();
    if (!pipelineIoSystem) {
      options.onStatus(options.t('main.status.pipelineIoNotInitialized'), 'error');
      return;
    }

    const result = await pipelineIoSystem.savePipelineAsFile();
    if (result.ok) {
      options.onStatus(options.t('main.status.pipelineSaved'), 'success');
      return;
    }

    options.onStatus(
      options.t('main.status.pipelineSaveFailed', {
        message: result.errorMessage ?? options.t('common.unknownError'),
      }),
      'error',
    );
  };

  const onApplyPipeline = (): void => {
    options.onApplyPipeline();
  };

  const onPipelineFileSelected = async (file: File): Promise<void> => {
    if (!isFile(file)) {
      options.onStatus(
        options.t('main.status.pipelineLoadFailed', {
          message: '入力ファイルが不正です。',
        }),
        'error',
      );
      return;
    }

    const pipelineIoSystem = options.getPipelineIoSystem();
    if (!pipelineIoSystem) {
      options.onStatus(options.t('main.status.pipelineIoNotInitialized'), 'error');
      return;
    }

    const result = await pipelineIoSystem.loadPipelineFromFile(file);
    if (!result.ok || !result.loaded) {
      options.onStatus(
        options.t('main.status.pipelineLoadFailed', {
          message: result.errorMessage ?? options.t('common.unknownError'),
        }),
        'error',
      );
      return;
    }

    options.onApplyLoadedPipeline(result.loaded);
  };

  const onAutoApplyChange = (enabled: boolean): void => {
    if (typeof enabled !== 'boolean') {
      options.onStatus('自動反映の値が不正です。', 'error');
      return;
    }

    options.setAutoApplyEnabled(enabled);

    const autoApplyEnabled = options.isAutoApplyEnabled();
    ensureBoolean(autoApplyEnabled, 'PipelineHeaderActionController: isAutoApplyEnabled() の戻り値');

    options.syncAutoApplyState(autoApplyEnabled);
    if (autoApplyEnabled) {
      options.scheduleApply();
    }
  };

  const buildMountOptions = (): PipelineHeaderActionMountOptions => {
    const initialAutoApplyEnabled = options.isAutoApplyEnabled();
    const initialCanUndo = options.canUndo();
    const initialCanRedo = options.canRedo();

    ensureBoolean(initialAutoApplyEnabled, 'PipelineHeaderActionController: initialAutoApplyEnabled');
    ensureBoolean(initialCanUndo, 'PipelineHeaderActionController: initialCanUndo');
    ensureBoolean(initialCanRedo, 'PipelineHeaderActionController: initialCanRedo');

    return {
      initialAutoApplyEnabled,
      initialCanUndo,
      initialCanRedo,
      onUndoPipeline,
      onRedoPipeline,
      onResetPipeline,
      onSavePipeline,
      onApplyPipeline,
      onPipelineFileSelected,
      onAutoApplyChange,
      onStatus: options.onStatus,
    };
  };

  return {
    buildMountOptions,
  };
}
