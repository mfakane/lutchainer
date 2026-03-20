type StatusKind = 'success' | 'error' | 'info';

type TranslationParam = string | number;
type TranslateFn = (key: string, params?: Record<string, TranslationParam>) => string;

export interface StepPreviewDebugApiResult {
  ok: boolean;
  forceCpu: boolean;
  message: string;
}

interface StepPreviewSystemLike {
  setForceCpu: (value: unknown) => StepPreviewDebugApiResult;
  isForceCpu: () => boolean;
}

interface CreateStepPreviewDebugControllerOptions {
  getStepPreviewSystem: () => StepPreviewSystemLike | null;
  onUpdateStepSwatches: () => void;
  onStatus: (message: string, kind: StatusKind) => void;
  t: TranslateFn;
}

interface RegisterGlobalDebugApiOptions {
  globalObject: Record<string, unknown>;
  globalKey?: string;
}

export interface StepPreviewDebugApi {
  forceCpu: (value: unknown) => StepPreviewDebugApiResult;
  isForceCpu: () => boolean;
}

export interface StepPreviewDebugController {
  setForceCpu: (value: unknown) => StepPreviewDebugApiResult;
  createDebugApi: () => StepPreviewDebugApi;
  registerGlobalDebugApi: (options: RegisterGlobalDebugApiOptions) => void;
}

export const DEFAULT_STEP_PREVIEW_DEBUG_GLOBAL_KEY = '__debugStepPreview';

function assertRecord(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
}

function assertCreateStepPreviewDebugControllerOptions(options: CreateStepPreviewDebugControllerOptions): void {
  assertRecord(options, 'Step preview debug controller options');

  if (typeof options.getStepPreviewSystem !== 'function') {
    throw new Error('Step preview debug controller getStepPreviewSystem must be a function.');
  }
  if (typeof options.onUpdateStepSwatches !== 'function') {
    throw new Error('Step preview debug controller onUpdateStepSwatches must be a function.');
  }
  if (typeof options.onStatus !== 'function') {
    throw new Error('Step preview debug controller onStatus must be a function.');
  }
  if (typeof options.t !== 'function') {
    throw new Error('Step preview debug controller t must be a function.');
  }
}

function resolveGlobalKey(value: unknown): string {
  if (value === undefined) {
    return DEFAULT_STEP_PREVIEW_DEBUG_GLOBAL_KEY;
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Step preview debug global key must be a non-empty string.');
  }
  return value;
}

function assertRegisterGlobalDebugApiOptions(options: RegisterGlobalDebugApiOptions): string {
  assertRecord(options, 'Global debug API registration options');
  assertRecord(options.globalObject, 'Global debug API registration object');
  return resolveGlobalKey(options.globalKey);
}

export function createStepPreviewDebugController(
  options: CreateStepPreviewDebugControllerOptions,
): StepPreviewDebugController {
  assertCreateStepPreviewDebugControllerOptions(options);

  const {
    getStepPreviewSystem,
    onUpdateStepSwatches,
    onStatus,
    t,
  } = options;

  const setForceCpu = (value: unknown): StepPreviewDebugApiResult => {
    const stepPreviewSystem = getStepPreviewSystem();
    if (!stepPreviewSystem) {
      const message = t('main.status.stepPreviewNotInitialized');
      onStatus(message, 'error');
      return {
        ok: false,
        forceCpu: false,
        message,
      };
    }

    const result = stepPreviewSystem.setForceCpu(value);
    if (!result.ok) {
      onStatus(result.message, 'error');
      return result;
    }

    onUpdateStepSwatches();
    onStatus(
      t('main.status.stepPreviewCpuMode', {
        state: result.forceCpu ? t('common.on') : t('common.off'),
      }),
      'info',
    );
    return result;
  };

  const createDebugApi = (): StepPreviewDebugApi => ({
    forceCpu: (value: unknown): StepPreviewDebugApiResult => setForceCpu(value),
    isForceCpu: () => getStepPreviewSystem()?.isForceCpu() ?? false,
  });

  const registerGlobalDebugApi = (registerOptions: RegisterGlobalDebugApiOptions): void => {
    const globalKey = assertRegisterGlobalDebugApiOptions(registerOptions);
    registerOptions.globalObject[globalKey] = createDebugApi();
  };

  return {
    setForceCpu,
    createDebugApi,
    registerGlobalDebugApi,
  };
}
