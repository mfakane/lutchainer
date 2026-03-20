import type {
  LightSettings,
  MaterialSettings,
} from '../pipeline/pipeline-model';
import type {
  Color,
  LutModel,
  StepModel,
  StepParamContext,
  StepRuntimeModel,
} from './step-model';
import {
  composeColorFromSteps,
  resolveStepRuntimeModels,
} from './step-runtime';

export interface DrawStepPreviewSphereCpuInput {
  canvas: HTMLCanvasElement;
  targetStepIndex: number;
  pixelWidth: number;
  pixelHeight: number;
  steps: readonly StepModel[];
  luts: readonly LutModel[];
  materialSettings: MaterialSettings;
  lightSettings: LightSettings;
  lightDirection: readonly [number, number, number];
  viewDirection: readonly [number, number, number];
}

const CAMERA_POSITION: readonly [number, number, number] = [0, 0, 3];

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

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isValidMaterialSettings(value: unknown): value is MaterialSettings {
  if (!isObject(value)) {
    return false;
  }

  const candidate = value as Partial<MaterialSettings>;
  return Array.isArray(candidate.baseColor)
    && candidate.baseColor.length === 3
    && Number.isFinite(candidate.baseColor[0])
    && Number.isFinite(candidate.baseColor[1])
    && Number.isFinite(candidate.baseColor[2])
    && Number.isFinite(candidate.specularStrength)
    && Number.isFinite(candidate.specularPower)
    && Number.isFinite(candidate.fresnelStrength)
    && Number.isFinite(candidate.fresnelPower);
}

function isValidLightSettings(value: unknown): value is LightSettings {
  if (!isObject(value)) {
    return false;
  }

  const candidate = value as Partial<LightSettings>;
  return Number.isFinite(candidate.azimuthDeg)
    && Number.isFinite(candidate.elevationDeg)
    && Number.isFinite(candidate.lightIntensity)
    && Array.isArray(candidate.lightColor)
    && candidate.lightColor.length === 3
    && Number.isFinite(candidate.lightColor[0])
    && Number.isFinite(candidate.lightColor[1])
    && Number.isFinite(candidate.lightColor[2])
    && Array.isArray(candidate.ambientColor)
    && candidate.ambientColor.length === 3
    && Number.isFinite(candidate.ambientColor[0])
    && Number.isFinite(candidate.ambientColor[1])
    && Number.isFinite(candidate.ambientColor[2])
    && typeof candidate.showGizmo === 'boolean';
}

function assertValidInput(input: DrawStepPreviewSphereCpuInput): void {
  if (!input || typeof input !== 'object') {
    throw new Error('CPU preview 入力が不正です。');
  }

  if (!(input.canvas instanceof HTMLCanvasElement)) {
    throw new Error('描画先キャンバスが不正です。');
  }
  if (!Number.isInteger(input.targetStepIndex) || input.targetStepIndex < 0) {
    throw new Error(`不正な targetStepIndex です: ${String(input.targetStepIndex)}`);
  }
  if (!Number.isInteger(input.pixelWidth) || input.pixelWidth <= 0
    || !Number.isInteger(input.pixelHeight) || input.pixelHeight <= 0) {
    throw new Error('不正なプレビュー解像度です。');
  }
  if (!Array.isArray(input.steps)) {
    throw new Error('steps は配列で指定してください。');
  }
  if (!Array.isArray(input.luts)) {
    throw new Error('luts は配列で指定してください。');
  }
  if (!isValidMaterialSettings(input.materialSettings)) {
    throw new Error('materialSettings が不正です。');
  }
  if (!isValidLightSettings(input.lightSettings)) {
    throw new Error('lightSettings が不正です。');
  }
  if (!isFiniteTuple3(input.lightDirection)) {
    throw new Error('lightDirection が不正です。');
  }
  if (!isFiniteTuple3(input.viewDirection)) {
    throw new Error('viewDirection が不正です。');
  }
}

function composePreviewColor(
  stepModels: readonly StepRuntimeModel[],
  context: StepParamContext,
  materialSettings: MaterialSettings,
  lightSettings: LightSettings,
): Color {
  const intensity = Math.max(
    0,
    Math.min(2, Number.isFinite(lightSettings.lightIntensity) ? lightSettings.lightIntensity : 1),
  );
  const litBaseColor: Color = [
    clamp01(materialSettings.baseColor[0] * lightSettings.lightColor[0] * intensity),
    clamp01(materialSettings.baseColor[1] * lightSettings.lightColor[1] * intensity),
    clamp01(materialSettings.baseColor[2] * lightSettings.lightColor[2] * intensity),
  ];
  const composed = composeColorFromSteps(stepModels, litBaseColor, context);
  return [
    clamp01(composed[0] + lightSettings.ambientColor[0]),
    clamp01(composed[1] + lightSettings.ambientColor[1]),
    clamp01(composed[2] + lightSettings.ambientColor[2]),
  ];
}

export function drawStepPreviewSphereCpu(input: DrawStepPreviewSphereCpuInput): void {
  assertValidInput(input);

  const {
    canvas,
    targetStepIndex,
    pixelWidth,
    pixelHeight,
    steps,
    luts,
    materialSettings,
    lightSettings,
    lightDirection,
    viewDirection,
  } = input;

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  const stepModels = resolveStepRuntimeModels(steps, luts, targetStepIndex);
  const image = ctx.createImageData(pixelWidth, pixelHeight);
  const data = image.data;

  const centerX = pixelWidth * 0.5;
  const centerY = pixelHeight * 0.5;
  const radius = Math.min(pixelWidth, pixelHeight) * 0.34;
  if (!Number.isFinite(radius) || radius < 1) {
    return;
  }
  const invRadius = 1 / radius;

  const minSpecPower = Math.max(1.0, materialSettings.specularPower);
  const minFresnelPower = Math.max(0.01, materialSettings.fresnelPower);

  for (let py = 0; py < pixelHeight; py += 1) {
    for (let px = 0; px < pixelWidth; px += 1) {
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

        let vx = CAMERA_POSITION[0] - nx;
        let vy = CAMERA_POSITION[1] - ny;
        let vz = CAMERA_POSITION[2] - nz;
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
        const cameraDist = Math.hypot(CAMERA_POSITION[0], CAMERA_POSITION[1], CAMERA_POSITION[2]);
        const nearDepth = Math.max(0, cameraDist - 1);
        const farDepth = cameraDist + 1;
        const depthDenom = Math.max(1e-4, farDepth - nearDepth);
        const linearDepth = clamp01((viewLength - nearDepth) / depthDenom);

        let texU = Math.atan2(nz, nx) / (Math.PI * 2);
        if (texU < 0) texU += 1;
        const texV = Math.acos(Math.max(-1, Math.min(1, ny))) / Math.PI;

        const composed = composePreviewColor(
          stepModels,
          {
            lambert,
            halfLambert,
            specular,
            fresnel,
            facing,
            nDotH,
            linearDepth,
            texU,
            texV,
          },
          materialSettings,
          lightSettings,
        );

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
}