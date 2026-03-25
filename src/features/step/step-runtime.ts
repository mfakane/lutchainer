import {
  sampleLutColorLinear,
  type LutColorSample,
} from './lut-sampling';
import {
  applyStepColor,
  getCustomChannelsForBlendMode
} from './step-blend-strategies';
import type {
  BlendOp,
  ChannelName,
  Color,
  LutModel,
  StepModel,
  StepParamContext,
  StepRuntimeModel,
} from './step-model';
import {
  evaluateStepParam,
} from './step-param-evaluators';

export {
  sampleLutColorLinear,
  type LutColorSample
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function sanitizePreviewColor(color: Color): Color {
  const r = Number.isFinite(color[0]) ? clamp01(color[0]) : 0.5;
  const g = Number.isFinite(color[1]) ? clamp01(color[1]) : 0.5;
  const b = Number.isFinite(color[2]) ? clamp01(color[2]) : 0.5;
  return [r, g, b];
}

export function resolveStepRuntimeModels(
  steps: readonly StepModel[],
  luts: readonly LutModel[],
  targetStepIndex = steps.length - 1,
): StepRuntimeModel[] {
  if (!Number.isInteger(targetStepIndex)) {
    return [];
  }

  const clampedLast = Math.max(-1, Math.min(targetStepIndex, steps.length - 1));
  if (clampedLast < 0) {
    return [];
  }

  const activeSteps = steps
    .slice(0, clampedLast + 1)
    .filter(step => step && !step.muted);

  return activeSteps.map(step => {
    const lutIndex = Math.max(0, luts.findIndex(lut => lut.id === step.lutId));
    const lut = luts[lutIndex] ?? null;
    const ops = getCustomChannelsForBlendMode(step.blendMode).reduce((acc, channel) => {
      acc[channel] = step.ops?.[channel] ?? 'none';
      return acc;
    }, {} as Record<ChannelName, BlendOp>);
    const stepModel = { ...step, ops };
    return { step: stepModel, lut, lutIndex };
  });
}

export function composeColorFromSteps(
  stepModels: readonly StepRuntimeModel[],
  baseColor: Color,
  context: StepParamContext,
): Color {
  let color: Color = [baseColor[0], baseColor[1], baseColor[2]];

  for (const stepModel of stepModels) {
    const step = stepModel.step;
    const xRaw = evaluateStepParam(step.xParam, color, context);
    const yRaw = evaluateStepParam(step.yParam, color, context);
    const xVal = clamp01(Number.isFinite(xRaw) ? xRaw : 0);
    const yVal = clamp01(Number.isFinite(yRaw) ? yRaw : 0);

    const lutSample = stepModel.lut
      ? sampleLutColorLinear(stepModel.lut, xVal, yVal)
      : { color: [1, 1, 1] as Color, alpha: 1 };
    color = applyStepColor(color, lutSample.color, lutSample.alpha, step.blendMode, step.ops);
  }

  return sanitizePreviewColor(color);
}
