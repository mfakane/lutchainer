import type { LightSettings, MaterialSettings } from '../../../features/pipeline/pipeline-model';
import {
  type LutModel,
  type StepModel,
} from '../../../features/step/step-model';
import type { StepPreviewRenderer } from '../../../platforms/webgl/step-preview-renderer.ts';
import {
  drawStepPreviewSphereCpu,
} from '../../../features/step/step-preview-cpu-render';
import {
  buildStepPreviewDrawOptions,
  ensureStepPreviewRendererProgram,
} from '../../../platforms/webgl/step-preview-webgl.ts';

interface StepPreviewSystemOptions {
  getSteps: () => StepModel[];
  getLuts: () => LutModel[];
  getMaterialSettings: () => MaterialSettings;
  getLightSettings: () => LightSettings;
  getStepPreviewRenderer: () => StepPreviewRenderer | null;
  onError: (message: string) => void;
  lightDirection: readonly [number, number, number];
  viewDirection: readonly [number, number, number];
}

interface SetForceCpuResult {
  ok: boolean;
  forceCpu: boolean;
  message: string;
}

interface StepPreviewSystem {
  bumpPipelineVersion: () => void;
  ensureStepPreviewProgram: () => boolean;
  drawSpherePreview: (canvas: HTMLCanvasElement, targetStepIndex: number) => void;
  renderPreviewPngBytes: () => Promise<Uint8Array>;
  reportError: (message: string) => void;
  setForceCpu: (value: unknown) => SetForceCpuResult;
  isForceCpu: () => boolean;
}

const FALLBACK_LIGHT_DIRECTION: readonly [number, number, number] = [0, 0.7071067812, 0.7071067812];
const FALLBACK_VIEW_DIRECTION: readonly [number, number, number] = [0, 0, 1];
const PREVIEW_EXPORT_SIZE = 256;
const MAX_PIPELINE_VERSION = 1_000_000_000;

function isFiniteTuple3(value: unknown): value is readonly [number, number, number] {
  return Array.isArray(value)
    && value.length === 3
    && Number.isFinite(value[0])
    && Number.isFinite(value[1])
    && Number.isFinite(value[2]);
}

function normalizeDirection(
  value: readonly [number, number, number],
  fallback: readonly [number, number, number],
): [number, number, number] {
  const x = Number.isFinite(value[0]) ? value[0] : fallback[0];
  const y = Number.isFinite(value[1]) ? value[1] : fallback[1];
  const z = Number.isFinite(value[2]) ? value[2] : fallback[2];
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length < 1e-6) {
    return [fallback[0], fallback[1], fallback[2]];
  }
  return [x / length, y / length, z / length];
}

function assertValidOptions(options: StepPreviewSystemOptions): void {
  if (!options || typeof options !== 'object') {
    throw new Error('Step preview system options must be an object.');
  }

  if (typeof options.getSteps !== 'function') {
    throw new Error('Step preview system option getSteps must be a function.');
  }
  if (typeof options.getLuts !== 'function') {
    throw new Error('Step preview system option getLuts must be a function.');
  }
  if (typeof options.getMaterialSettings !== 'function') {
    throw new Error('Step preview system option getMaterialSettings must be a function.');
  }
  if (typeof options.getLightSettings !== 'function') {
    throw new Error('Step preview system option getLightSettings must be a function.');
  }
  if (typeof options.getStepPreviewRenderer !== 'function') {
    throw new Error('Step preview system option getStepPreviewRenderer must be a function.');
  }
  if (typeof options.onError !== 'function') {
    throw new Error('Step preview system option onError must be a function.');
  }
  if (!isFiniteTuple3(options.lightDirection)) {
    throw new Error('Step preview system option lightDirection must be a [number, number, number] tuple.');
  }
  if (!isFiniteTuple3(options.viewDirection)) {
    throw new Error('Step preview system option viewDirection must be a [number, number, number] tuple.');
  }
}

function canvasToPreviewPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('preview.pngの生成に失敗しました。'));
        return;
      }
      blob.arrayBuffer()
        .then(ab => resolve(new Uint8Array(ab)))
        .catch(reject);
    }, 'image/png');
  });
}

export function createStepPreviewSystem(options: StepPreviewSystemOptions): StepPreviewSystem {
  assertValidOptions(options);

  const lightDirection = normalizeDirection(options.lightDirection, FALLBACK_LIGHT_DIRECTION);
  const viewDirection = normalizeDirection(options.viewDirection, FALLBACK_VIEW_DIRECTION);

  let pipelineVersion = 0;
  let compiledVersion = -1;
  let lastError: string | null = null;
  let forceCpu = false;

  const reportError = (message: string): void => {
    if (typeof message !== 'string' || message.trim().length === 0) {
      return;
    }

    if (lastError === message) {
      return;
    }

    lastError = message;
    options.onError(message);
  };

  const drawSpherePreviewCore = (
    canvas: HTMLCanvasElement,
    targetStepIndex: number,
    pixelWidth: number,
    pixelHeight: number,
  ): void => {
    drawStepPreviewSphereCpu({
      canvas,
      targetStepIndex,
      pixelWidth,
      pixelHeight,
      steps: options.getSteps(),
      luts: options.getLuts(),
      materialSettings: options.getMaterialSettings(),
      lightSettings: options.getLightSettings(),
      lightDirection,
      viewDirection,
    });
  };

  const bumpPipelineVersion = (): void => {
    pipelineVersion += 1;
    if (!Number.isSafeInteger(pipelineVersion) || pipelineVersion > MAX_PIPELINE_VERSION) {
      pipelineVersion = 1;
      compiledVersion = -1;
    }
  };

  const ensureStepPreviewProgram = (): boolean => {
    if (forceCpu) {
      return false;
    }

    const renderer = options.getStepPreviewRenderer();
    if (!renderer) {
      return false;
    }

    if (compiledVersion === pipelineVersion) {
      return true;
    }

    const ensureResult = ensureStepPreviewRendererProgram({
      renderer,
      steps: options.getSteps(),
      luts: options.getLuts(),
    });
    if (!ensureResult.ok) {
      reportError(ensureResult.message ?? 'Stepプレビュー(WebGL) の初期化に失敗しました。');
      return false;
    }

    compiledVersion = pipelineVersion;
    lastError = null;
    return true;
  };

  const drawSpherePreview = (canvas: HTMLCanvasElement, targetStepIndex: number): void => {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('描画先キャンバスが不正です。');
    }
    if (!Number.isInteger(targetStepIndex) || targetStepIndex < 0) {
      throw new Error(`不正な targetStepIndex です: ${targetStepIndex}`);
    }

    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (!Number.isFinite(cssWidth) || !Number.isFinite(cssHeight) || cssWidth <= 0 || cssHeight <= 0) {
      return;
    }

    const rawDpr = window.devicePixelRatio || 1;
    const dpr = Number.isFinite(rawDpr) && rawDpr > 0 ? rawDpr : 1;
    const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
    const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));
    drawSpherePreviewCore(canvas, targetStepIndex, pixelWidth, pixelHeight);
  };

  const renderPreviewPngBytes = async (): Promise<Uint8Array> => {
    const size = PREVIEW_EXPORT_SIZE;
    const targetStepIndex = Math.max(0, options.getSteps().length - 1);
    const renderer = options.getStepPreviewRenderer();

    if (renderer && ensureStepPreviewProgram()) {
      const drawOptions = buildStepPreviewDrawOptions({
        targetStepIndex,
        materialSettings: options.getMaterialSettings(),
        lightSettings: options.getLightSettings(),
        lightDirection,
      });
      const err = renderer.drawToSize(size, size, drawOptions);
      if (!err) {
        return await canvasToPreviewPngBytes(renderer.getInternalCanvas());
      }
    }

    const canvas = document.createElement('canvas');
    drawSpherePreviewCore(canvas, targetStepIndex, size, size);
    return await canvasToPreviewPngBytes(canvas);
  };

  const setForceCpu = (value: unknown): SetForceCpuResult => {
    if (typeof value !== 'boolean') {
      return {
        ok: false,
        forceCpu,
        message: 'CPU優先モードの値は true / false で指定してください。',
      };
    }

    forceCpu = value;
    return {
      ok: true,
      forceCpu,
      message: `CPU優先モードを ${forceCpu ? 'ON' : 'OFF'} に設定しました。`,
    };
  };

  return {
    bumpPipelineVersion,
    ensureStepPreviewProgram,
    drawSpherePreview,
    renderPreviewPngBytes,
    reportError,
    setForceCpu,
    isForceCpu: () => forceCpu,
  };
}
