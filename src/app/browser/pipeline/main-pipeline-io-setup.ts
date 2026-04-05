import type { LutModel, StepModel } from '../../../features/step/step-model.ts';
import * as pipelineModel from '../../../features/pipeline/pipeline-model.ts';
import { createPipelineIoSystem } from './pipeline-io-system.ts';

type TranslationParam = string | number;
type Translator = (key: unknown, values?: Record<string, TranslationParam>) => string;

interface StepPreviewSystemLike {
  renderPreviewPngBytes: () => Promise<Uint8Array>;
}

interface SetupMainPipelineIoSystemOptions {
  getLuts: () => LutModel[];
  getSteps: () => StepModel[];
  getStepPreviewSystem: () => StepPreviewSystemLike | null;
  t: Translator;
}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} must be a function.`);
  }
}

function ensureOptions(value: unknown): asserts value is SetupMainPipelineIoSystemOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Main pipeline IO setup options must be an object.');
  }

  const options = value as Partial<SetupMainPipelineIoSystemOptions>;
  ensureFunction(options.getLuts, 'Main pipeline IO setup getLuts');
  ensureFunction(options.getSteps, 'Main pipeline IO setup getSteps');
  ensureFunction(options.getStepPreviewSystem, 'Main pipeline IO setup getStepPreviewSystem');
  ensureFunction(options.t, 'Main pipeline IO setup t');
}

export function setupMainPipelineIoSystem(options: SetupMainPipelineIoSystemOptions): ReturnType<typeof createPipelineIoSystem> {
  ensureOptions(options);

  return createPipelineIoSystem({
    getLuts: options.getLuts,
    getSteps: options.getSteps,
    renderPreviewPngBytes: async () => {
      const stepPreviewSystem = options.getStepPreviewSystem();
      if (!stepPreviewSystem) {
        throw new Error(options.t('main.status.stepPreviewNotInitialized'));
      }
      return await stepPreviewSystem.renderPreviewPngBytes();
    },
    maxPipelineFileBytes: pipelineModel.MAX_PIPELINE_FILE_BYTES,
    serializePipelineAsZip: pipelineModel.serializePipelineAsZip,
    buildPipelineDownloadFilename: pipelineModel.buildPipelineDownloadFilename,
    loadPipelineFromZip: pipelineModel.loadPipelineFromZip,
    isZipLikeFile: pipelineModel.isZipLikeFile,
    toErrorMessage: pipelineModel.toErrorMessage,
  });
}
