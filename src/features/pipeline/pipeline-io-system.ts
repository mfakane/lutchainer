import type {
    LutModel,
    StepModel,
} from '../step/step-model';
import type {
    LoadedPipelineData,
} from './pipeline-model';

export interface SavePipelineAsFileResult {
  ok: boolean;
  errorMessage?: string;
}

export interface LoadPipelineFromFileResult {
  ok: boolean;
  loaded?: LoadedPipelineData;
  errorMessage?: string;
}

interface PipelineIoSystemOptions {
  getNextStepId: () => number;
  getLuts: () => LutModel[];
  getSteps: () => StepModel[];
  renderPreviewPngBytes: () => Promise<Uint8Array>;
  maxPipelineFileBytes: number;
  serializePipelineAsZip: (
    nextStepId: number,
    luts: LutModel[],
    steps: StepModel[],
    previewPngBytes: Uint8Array,
  ) => Promise<Uint8Array>;
  buildPipelineDownloadFilename: () => string;
  loadPipelineFromZip: (data: ArrayBuffer) => Promise<LoadedPipelineData>;
  loadPipelineData: (payload: unknown) => Promise<LoadedPipelineData>;
  isZipLikeFile: (file: File) => boolean;
  isJsonLikeFile: (file: File) => boolean;
  toErrorMessage: (error: unknown) => string;
}

interface PipelineIoSystem {
  savePipelineAsFile: () => Promise<SavePipelineAsFileResult>;
  loadPipelineFromFile: (file: File) => Promise<LoadPipelineFromFileResult>;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function hasFileApi(): boolean {
  return typeof File !== 'undefined';
}

function isFile(value: unknown): value is File {
  return hasFileApi() && value instanceof File;
}

function assertValidOptions(options: PipelineIoSystemOptions): void {
  if (!options || typeof options !== 'object') {
    throw new Error('Pipeline I/O system options must be an object.');
  }

  if (typeof options.getNextStepId !== 'function') {
    throw new Error('Pipeline I/O option getNextStepId must be a function.');
  }
  if (typeof options.getLuts !== 'function') {
    throw new Error('Pipeline I/O option getLuts must be a function.');
  }
  if (typeof options.getSteps !== 'function') {
    throw new Error('Pipeline I/O option getSteps must be a function.');
  }
  if (typeof options.renderPreviewPngBytes !== 'function') {
    throw new Error('Pipeline I/O option renderPreviewPngBytes must be a function.');
  }
  if (!Number.isFinite(options.maxPipelineFileBytes) || options.maxPipelineFileBytes <= 0) {
    throw new Error('Pipeline I/O option maxPipelineFileBytes must be a positive number.');
  }
  if (typeof options.serializePipelineAsZip !== 'function') {
    throw new Error('Pipeline I/O option serializePipelineAsZip must be a function.');
  }
  if (typeof options.buildPipelineDownloadFilename !== 'function') {
    throw new Error('Pipeline I/O option buildPipelineDownloadFilename must be a function.');
  }
  if (typeof options.loadPipelineFromZip !== 'function') {
    throw new Error('Pipeline I/O option loadPipelineFromZip must be a function.');
  }
  if (typeof options.loadPipelineData !== 'function') {
    throw new Error('Pipeline I/O option loadPipelineData must be a function.');
  }
  if (typeof options.isZipLikeFile !== 'function') {
    throw new Error('Pipeline I/O option isZipLikeFile must be a function.');
  }
  if (typeof options.isJsonLikeFile !== 'function') {
    throw new Error('Pipeline I/O option isJsonLikeFile must be a function.');
  }
  if (typeof options.toErrorMessage !== 'function') {
    throw new Error('Pipeline I/O option toErrorMessage must be a function.');
  }
}

function normalizeErrorMessage(toErrorMessage: (error: unknown) => string, error: unknown): string {
  try {
    const message = toErrorMessage(error);
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  } catch {
    // no-op
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return '不明なエラーが発生しました。';
}

function validatePipelineSaveState(nextStepId: number, luts: LutModel[], steps: StepModel[]): string | null {
  if (!isPositiveInteger(nextStepId)) {
    return '次の Step ID が不正です。';
  }
  if (!Array.isArray(luts)) {
    return 'LUT の状態が不正です。';
  }
  if (!Array.isArray(steps)) {
    return 'Step の状態が不正です。';
  }
  return null;
}

function validatePipelineFile(
  file: File,
  maxBytes: number,
  isZipLikeFile: (file: File) => boolean,
  isJsonLikeFile: (file: File) => boolean,
): string | null {
  if (!isFile(file)) {
    return 'ファイル入力が不正です。';
  }

  const isZip = isZipLikeFile(file);
  const isJson = isJsonLikeFile(file);
  if (!isZip && !isJson) {
    return '.lutchain または JSON ファイルを選択してください。';
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return '空のファイルは読み込めません。';
  }

  if (file.size > maxBytes) {
    return `ファイルが大きすぎます。上限は ${Math.round(maxBytes / (1024 * 1024))}MB です。`;
  }

  return null;
}

export function createPipelineIoSystem(options: PipelineIoSystemOptions): PipelineIoSystem {
  assertValidOptions(options);

  const savePipelineAsFile = async (): Promise<SavePipelineAsFileResult> => {
    try {
      const nextStepId = options.getNextStepId();
      const luts = options.getLuts();
      const steps = options.getSteps();
      const stateError = validatePipelineSaveState(nextStepId, luts, steps);
      if (stateError) {
        return {
          ok: false,
          errorMessage: stateError,
        };
      }

      const previewBytes = await options.renderPreviewPngBytes();
      if (!(previewBytes instanceof Uint8Array) || previewBytes.byteLength === 0) {
        return {
          ok: false,
          errorMessage: 'プレビュー画像の生成結果が不正です。',
        };
      }

      const zipData = await options.serializePipelineAsZip(nextStepId, luts, steps, previewBytes);
      if (!(zipData instanceof Uint8Array) || zipData.byteLength === 0) {
        return {
          ok: false,
          errorMessage: '保存データの生成に失敗しました。',
        };
      }

      const blob = new Blob([(zipData.buffer as ArrayBuffer).slice(zipData.byteOffset, zipData.byteOffset + zipData.byteLength)], {
        type: 'application/x-lutchain',
      });
      const downloadUrl = URL.createObjectURL(blob);

      try {
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = options.buildPipelineDownloadFilename();
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        URL.revokeObjectURL(downloadUrl);
      }

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        errorMessage: normalizeErrorMessage(options.toErrorMessage, error),
      };
    }
  };

  const loadPipelineFromFile = async (file: File): Promise<LoadPipelineFromFileResult> => {
    try {
      const fileValidationError = validatePipelineFile(
        file,
        options.maxPipelineFileBytes,
        options.isZipLikeFile,
        options.isJsonLikeFile,
      );
      if (fileValidationError) {
        return {
          ok: false,
          errorMessage: fileValidationError,
        };
      }

      if (options.isZipLikeFile(file)) {
        const arrayBuffer = await file.arrayBuffer();
        const loaded = await options.loadPipelineFromZip(arrayBuffer);
        return {
          ok: true,
          loaded,
        };
      }

      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const loaded = await options.loadPipelineData(parsed);
      return {
        ok: true,
        loaded,
      };
    } catch (error) {
      return {
        ok: false,
        errorMessage: normalizeErrorMessage(options.toErrorMessage, error),
      };
    }
  };

  return {
    savePipelineAsFile,
    loadPipelineFromFile,
  };
}
