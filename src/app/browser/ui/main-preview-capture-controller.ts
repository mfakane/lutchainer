import {
  buildPreviewDownloadFilename,
  canvasToPngBlob,
  copyCanvasSnapshot,
  downloadBlobAsFile,
} from '../../../platforms/browser/preview-export.ts';
import { Renderer } from '../../../platforms/webgl/renderer.ts';
import type { AppTranslator } from '../../../shared/i18n/browser-translation-contract.ts';

type StatusKind = 'success' | 'error' | 'info';

interface CaptureRequestOptions {
  hideLightGuide?: boolean;
}

interface PendingCapture {
  resolve: (blob: Blob) => void;
  reject: (error: Error) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

interface StepPreviewSystemLike {
  renderPreviewPngBytes: () => Promise<Uint8Array>;
}

interface RenderSystemLike {
  isRunning: () => boolean;
  start: () => void;
}

interface CreateMainPreviewCaptureControllerOptions {
  captureTimeoutMs?: number;
  getRenderer: () => Renderer | null;
  getRenderSystem: () => RenderSystemLike | null;
  getStepPreviewSystem: () => StepPreviewSystemLike | null;
  onStatus: (message: string, kind: StatusKind) => void;
  t: AppTranslator;
}

export interface MainPreviewCaptureController {
  isSuppressLightGuide: () => boolean;
  settleFromFrame: (canvas: HTMLCanvasElement) => void;
  exportMainPreviewPng: () => Promise<void>;
  exportStepPreviewPng: () => Promise<void>;
}

const DEFAULT_CAPTURE_TIMEOUT_MS = 2000;

function assertRecord(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
}

function assertCreateOptions(options: CreateMainPreviewCaptureControllerOptions): void {
  assertRecord(options, 'Main preview capture controller options');

  if (options.captureTimeoutMs !== undefined) {
    if (typeof options.captureTimeoutMs !== 'number' || !Number.isFinite(options.captureTimeoutMs) || options.captureTimeoutMs <= 0) {
      throw new Error('Main preview capture captureTimeoutMs must be a positive finite number when provided.');
    }
  }
  if (typeof options.getRenderer !== 'function') {
    throw new Error('Main preview capture controller getRenderer must be a function.');
  }
  if (typeof options.getRenderSystem !== 'function') {
    throw new Error('Main preview capture controller getRenderSystem must be a function.');
  }
  if (typeof options.getStepPreviewSystem !== 'function') {
    throw new Error('Main preview capture controller getStepPreviewSystem must be a function.');
  }
  if (typeof options.onStatus !== 'function') {
    throw new Error('Main preview capture controller onStatus must be a function.');
  }
  if (typeof options.t !== 'function') {
    throw new Error('Main preview capture controller t must be a function.');
  }
}

export function createMainPreviewCaptureController(
  options: CreateMainPreviewCaptureControllerOptions,
): MainPreviewCaptureController {
  assertCreateOptions(options);

  const {
    captureTimeoutMs = DEFAULT_CAPTURE_TIMEOUT_MS,
    getRenderer,
    getRenderSystem,
    getStepPreviewSystem,
    onStatus,
    t,
  } = options;

  let pendingCapture: PendingCapture | null = null;
  let suppressLightGuide = false;

  const settleFromFrame = (canvas: HTMLCanvasElement): void => {
    const pending = pendingCapture;
    if (!pending) {
      return;
    }

    pendingCapture = null;
    suppressLightGuide = false;
    clearTimeout(pending.timeoutHandle);

    let snapshot: HTMLCanvasElement;
    try {
      snapshot = copyCanvasSnapshot(canvas);
    } catch (error) {
      pending.reject(error instanceof Error ? error : new Error(t('common.unknownError')));
      return;
    }

    canvasToPngBlob(snapshot)
      .then(blob => pending.resolve(blob))
      .catch(error => {
        pending.reject(error instanceof Error ? error : new Error(t('common.unknownError')));
      });
  };

  const requestPngBlob = (reqOptions?: CaptureRequestOptions): Promise<Blob> => {
    if (reqOptions !== undefined && (typeof reqOptions !== 'object' || reqOptions === null || Array.isArray(reqOptions))) {
      return Promise.reject(new Error('キャプチャオプションが不正です。'));
    }

    const hideLightGuideRaw = reqOptions?.hideLightGuide;
    if (hideLightGuideRaw !== undefined && typeof hideLightGuideRaw !== 'boolean') {
      return Promise.reject(new Error('hideLightGuide は boolean で指定してください。'));
    }

    if (pendingCapture) {
      return Promise.reject(new Error(t('main.status.previewExportBusy')));
    }

    suppressLightGuide = hideLightGuideRaw ?? false;

    return new Promise<Blob>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        const pending = pendingCapture;
        if (!pending || pending.timeoutHandle !== timeoutHandle) {
          return;
        }

        pendingCapture = null;
        suppressLightGuide = false;
        pending.reject(new Error(t('main.status.previewExportCaptureTimeout')));
      }, captureTimeoutMs);

      pendingCapture = {
        resolve,
        reject,
        timeoutHandle,
      };
    });
  };

  const exportMainPreviewPng = async (): Promise<void> => {
    const renderer = getRenderer();
    const renderSystem = getRenderSystem();

    if (!(renderer instanceof Renderer)) {
      throw new Error(t('main.status.previewExportRendererMissing'));
    }

    if (!renderSystem) {
      throw new Error(t('main.status.previewExportRendererMissing'));
    }

    if (!renderSystem.isRunning()) {
      renderSystem.start();
    }

    const blob = await requestPngBlob({ hideLightGuide: true });
    downloadBlobAsFile(blob, buildPreviewDownloadFilename('main'));
    onStatus(t('main.status.previewExportMainSaved'), 'success');
  };

  const exportStepPreviewPng = async (): Promise<void> => {
    const stepPreviewSystem = getStepPreviewSystem();
    if (!stepPreviewSystem) {
      throw new Error(t('main.status.stepPreviewNotInitialized'));
    }

    const bytes = await stepPreviewSystem.renderPreviewPngBytes();
    if (!(bytes instanceof Uint8Array) || bytes.byteLength <= 0) {
      throw new Error(t('main.status.previewExportBytesInvalid'));
    }

    const blob = new Blob(
      [(bytes.buffer as ArrayBuffer).slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)],
      { type: 'image/png' },
    );
    downloadBlobAsFile(blob, buildPreviewDownloadFilename('step'));
    onStatus(t('main.status.previewExportStepSaved'), 'success');
  };

  return {
    isSuppressLightGuide: () => suppressLightGuide,
    settleFromFrame,
    exportMainPreviewPng,
    exportStepPreviewPng,
  };
}
