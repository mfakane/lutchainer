import {
  STEP_PREVIEW_LIGHT_DIR,
  STEP_PREVIEW_VIEW_DIR,
  type LightSettings,
  type MaterialSettings,
} from '../pipeline/pipeline-model';
import type {
  Color,
  LutModel,
  StepModel,
} from './step-model';
import { evaluateStepParam } from './step-param-evaluators';
import {
  composeColorFromSteps,
  resolveStepRuntimeModels,
} from './step-runtime';

interface ResolveLutUvAtPixelInput {
  pixelX: number;
  pixelY: number;
  canvasWidth: number;
  canvasHeight: number;
  targetStepIndex: number;
  steps: readonly StepModel[];
  luts: readonly LutModel[];
  materialSettings: MaterialSettings;
  lightSettings: LightSettings;
}

interface LutUvCoord {
  u: number;
  v: number;
}

const CAMERA_POSITION: readonly [number, number, number] = [0, 0, 3];

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function resolveLutUvAtPixel(input: ResolveLutUvAtPixelInput): LutUvCoord | null {
  const {
    pixelX,
    pixelY,
    canvasWidth,
    canvasHeight,
    targetStepIndex,
    steps,
    luts,
    materialSettings,
    lightSettings,
  } = input;

  if (
    !Number.isFinite(canvasWidth) || canvasWidth <= 0
    || !Number.isFinite(canvasHeight) || canvasHeight <= 0
  ) {
    return null;
  }

  const centerX = canvasWidth * 0.5;
  const centerY = canvasHeight * 0.5;
  const radius = Math.min(canvasWidth, canvasHeight) * 0.34;
  if (!Number.isFinite(radius) || radius < 1) {
    return null;
  }
  const invRadius = 1 / radius;

  const dx = (pixelX + 0.5 - centerX) * invRadius;
  const dy = (pixelY + 0.5 - centerY) * invRadius;
  const dist2 = dx * dx + dy * dy;

  if (dist2 > 1.0) {
    return null;
  }

  const nx = dx;
  const ny = -dy;
  const nz = Math.sqrt(Math.max(0, 1 - dist2));

  const lightDirection = STEP_PREVIEW_LIGHT_DIR;
  const viewDirectionFallback = STEP_PREVIEW_VIEW_DIR;

  let vx = CAMERA_POSITION[0] - nx;
  let vy = CAMERA_POSITION[1] - ny;
  let vz = CAMERA_POSITION[2] - nz;
  const viewLength = Math.hypot(vx, vy, vz);
  if (viewLength > 1e-6) {
    vx /= viewLength;
    vy /= viewLength;
    vz /= viewLength;
  } else {
    vx = viewDirectionFallback[0];
    vy = viewDirectionFallback[1];
    vz = viewDirectionFallback[2];
  }

  const nDotL = nx * lightDirection[0] + ny * lightDirection[1] + nz * lightDirection[2];
  const lambert = Math.max(0, nDotL);
  const halfLambert = Math.pow(nDotL * 0.5 + 0.5, 2);

  const hxRaw = lightDirection[0] + vx;
  const hyRaw = lightDirection[1] + vy;
  const hzRaw = lightDirection[2] + vz;
  const hLength = Math.hypot(hxRaw, hyRaw, hzRaw);
  const hx = hLength > 1e-6 ? hxRaw / hLength : 0;
  const hy = hLength > 1e-6 ? hyRaw / hLength : 0;
  const hz = hLength > 1e-6 ? hzRaw / hLength : 1;

  const minSpecPower = Math.max(1.0, materialSettings.specularPower);
  const minFresnelPower = Math.max(0.01, materialSettings.fresnelPower);

  const nDotH = Math.max(nx * hx + ny * hy + nz * hz, 0);
  const specular = Math.pow(nDotH, minSpecPower) * materialSettings.specularStrength;
  const facing = Math.max(nx * vx + ny * vy + nz * vz, 0);
  const fresnel = Math.pow(1.0 - facing, minFresnelPower) * materialSettings.fresnelStrength;

  const cameraDist = Math.hypot(CAMERA_POSITION[0], CAMERA_POSITION[1], CAMERA_POSITION[2]);
  const nearDepth = Math.max(0, cameraDist - 1);
  const farDepth = cameraDist + 1;
  const depthDenom = Math.max(1e-4, farDepth - nearDepth);
  const linearDepth = clamp01((viewLength - nearDepth) / depthDenom);

  const texU = clamp01(nx * 0.5 + 0.5);
  const texV = clamp01((-ny) * 0.5 + 0.5);

  const context = {
    lambert,
    halfLambert,
    specular,
    fresnel,
    facing,
    nDotH,
    linearDepth,
    texU,
    texV,
  };

  const stepModels = resolveStepRuntimeModels(steps, luts, targetStepIndex);
  if (stepModels.length === 0) {
    return null;
  }

  const targetStepModel = stepModels[stepModels.length - 1];
  const priorStepModels = stepModels.slice(0, -1);

  const intensity = Math.max(
    0,
    Math.min(2, Number.isFinite(lightSettings.lightIntensity) ? lightSettings.lightIntensity : 1),
  );
  const litBaseColor: Color = [
    clamp01(materialSettings.baseColor[0] * lightSettings.lightColor[0] * intensity),
    clamp01(materialSettings.baseColor[1] * lightSettings.lightColor[1] * intensity),
    clamp01(materialSettings.baseColor[2] * lightSettings.lightColor[2] * intensity),
  ];

  const priorColor: Color = priorStepModels.length > 0
    ? composeColorFromSteps(priorStepModels, litBaseColor, context)
    : litBaseColor;

  const xRaw = evaluateStepParam(targetStepModel.step.xParam, priorColor, context);
  const yRaw = evaluateStepParam(targetStepModel.step.yParam, priorColor, context);

  return {
    u: clamp01(Number.isFinite(xRaw) ? xRaw : 0),
    v: clamp01(Number.isFinite(yRaw) ? yRaw : 0),
  };
}
