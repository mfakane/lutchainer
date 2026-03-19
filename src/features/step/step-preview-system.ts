import type { MaterialSettings } from '../pipeline/pipeline-model';
import * as shaderGenerator from '../shader/shader-generator';
import {
  type Color,
  type LutModel,
  type StepModel,
  type StepParamContext,
  type StepRuntimeModel,
} from './step-model';
import { StepPreviewRenderer } from './step-preview-renderer';
import {
  composeColorFromSteps,
  resolveStepRuntimeModels,
} from './step-runtime';

interface StepPreviewSystemOptions {
  getSteps: () => StepModel[];
  getLuts: () => LutModel[];
  getMaterialSettings: () => MaterialSettings;
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

function clamp01(v: number): number {
  if (!Number.isFinite(v)) {
    return 0;
  }
  return Math.max(0, Math.min(1, v));
}

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

  const composePreviewColor = (stepModels: StepRuntimeModel[], context: StepParamContext): Color => {
    const materialSettings = options.getMaterialSettings();
    const composed = composeColorFromSteps(stepModels, materialSettings.baseColor, context);
    return [
      clamp01(composed[0] + materialSettings.ambientColor[0]),
      clamp01(composed[1] + materialSettings.ambientColor[1]),
      clamp01(composed[2] + materialSettings.ambientColor[2]),
    ];
  };

  const drawSpherePreviewCore = (
    canvas: HTMLCanvasElement,
    targetStepIndex: number,
    pixelWidth: number,
    pixelHeight: number,
  ): void => {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('描画先キャンバスが不正です。');
    }
    if (!Number.isInteger(targetStepIndex) || targetStepIndex < 0) {
      throw new Error(`不正な targetStepIndex です: ${targetStepIndex}`);
    }
    if (!Number.isInteger(pixelWidth) || pixelWidth <= 0 || !Number.isInteger(pixelHeight) || pixelHeight <= 0) {
      throw new Error('不正なプレビュー解像度です。');
    }

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const stepModels = resolveStepRuntimeModels(options.getSteps(), options.getLuts(), targetStepIndex);
    const materialSettings = options.getMaterialSettings();
    const image = ctx.createImageData(pixelWidth, pixelHeight);
    const data = image.data;

    const centerX = pixelWidth * 0.5;
    const centerY = pixelHeight * 0.5;
    const radius = Math.min(pixelWidth, pixelHeight) * 0.34;
    if (!Number.isFinite(radius) || radius < 1) {
      return;
    }
    const invRadius = 1 / radius;

    const cameraPos: [number, number, number] = [0, 0, 3];
    const minSpecPower = Math.max(1.0, materialSettings.specularPower);
    const minFresnelPower = Math.max(0.01, materialSettings.fresnelPower);

    for (let py = 0; py < pixelHeight; py++) {
      for (let px = 0; px < pixelWidth; px++) {
        const idx = (py * pixelWidth + px) * 4;

        let outR = 0;
        let outG = 0;
        let outB = 0;
        let outA = 0;

        const dx = (px + 0.5 - centerX) * invRadius;
        const dy = (py + 0.5 - centerY) * invRadius;
        const dist2 = dx * dx + dy * dy;

        if (dist2 <= 1.0) {
          const nx = dx;
          const ny = -dy;
          const nz = Math.sqrt(Math.max(0, 1 - dist2));

          let vx = cameraPos[0] - nx;
          let vy = cameraPos[1] - ny;
          let vz = cameraPos[2] - nz;
          const viewLength = Math.hypot(vx, vy, vz);
          if (viewLength > 1e-6) {
            vx /= viewLength;
            vy /= viewLength;
            vz /= viewLength;
          } else {
            vx = viewDirection[0];
            vy = viewDirection[1];
            vz = viewDirection[2];
          }

          const lambert = Math.max(0, nx * lightDirection[0] + ny * lightDirection[1] + nz * lightDirection[2]);
          const halfLambert = lambert * 0.5 + 0.5;
          const hxRaw = lightDirection[0] + vx;
          const hyRaw = lightDirection[1] + vy;
          const hzRaw = lightDirection[2] + vz;
          const hLength = Math.hypot(hxRaw, hyRaw, hzRaw);
          const hx = hLength > 1e-6 ? hxRaw / hLength : 0;
          const hy = hLength > 1e-6 ? hyRaw / hLength : 0;
          const hz = hLength > 1e-6 ? hzRaw / hLength : 1;

          const nDotH = Math.max(nx * hx + ny * hy + nz * hz, 0);
          const specular = Math.pow(nDotH, minSpecPower) * materialSettings.specularStrength;
          const facing = Math.max(nx * vx + ny * vy + nz * vz, 0);
          const fresnel = Math.pow(1.0 - facing, minFresnelPower) * materialSettings.fresnelStrength;
          const cameraDist = Math.hypot(cameraPos[0], cameraPos[1], cameraPos[2]);
          const nearDepth = Math.max(0, cameraDist - 1);
          const farDepth = cameraDist + 1;
          const depthDenom = Math.max(1e-4, farDepth - nearDepth);
          const linearDepth = clamp01((viewLength - nearDepth) / depthDenom);

          let texU = Math.atan2(nz, nx) / (Math.PI * 2);
          if (texU < 0) texU += 1;
          const texV = Math.acos(Math.max(-1, Math.min(1, ny))) / Math.PI;

          const composed = composePreviewColor(stepModels, {
            lambert,
            halfLambert,
            specular,
            fresnel,
            facing,
            nDotH,
            linearDepth,
            texU,
            texV,
          });

          outR = composed[0];
          outG = composed[1];
          outB = composed[2];
          outA = 1;
        }

        data[idx + 0] = Math.round(clamp01(outR) * 255);
        data[idx + 1] = Math.round(clamp01(outG) * 255);
        data[idx + 2] = Math.round(clamp01(outB) * 255);
        data[idx + 3] = Math.round(clamp01(outA) * 255);
      }
    }

    ctx.putImageData(image, 0, 0);
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

    const steps = options.getSteps();
    const luts = options.getLuts();
    const lutError = renderer.setLutTextures(luts.map(lut => lut.image));
    if (lutError) {
      reportError(`Stepプレビュー(WebGL) のLUT設定に失敗しました: ${lutError}`);
      return false;
    }

    const compileResult = renderer.compileProgram(
      shaderGenerator.buildStepPreviewFragmentShader({ steps, luts }),
    );
    if (!compileResult.success) {
      const details = compileResult.errors
        .map(error => `[${error.type.toUpperCase()}]\n${error.message.trim()}`)
        .join('\n\n');
      reportError(`Stepプレビュー(WebGL) のシェーダー生成に失敗しました。\n${details}`);
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
    const materialSettings = options.getMaterialSettings();
    const renderer = options.getStepPreviewRenderer();

    if (renderer && ensureStepPreviewProgram()) {
      const err = renderer.drawToSize(size, size, {
        targetStepIndex,
        baseColor: materialSettings.baseColor,
        ambientColor: materialSettings.ambientColor,
        specularStrength: materialSettings.specularStrength,
        specularPower: materialSettings.specularPower,
        fresnelStrength: materialSettings.fresnelStrength,
        fresnelPower: materialSettings.fresnelPower,
        lightDirection,
      });
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
