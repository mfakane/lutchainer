import type { StepRuntimeModel } from '../step/step-model.ts';
import { emitBlendModeCode, type ShaderLanguageBackend } from './shader-language-backend.ts';

export interface BuildShaderStepCodeOptions {
  backend: ShaderLanguageBackend;
  isPreview: boolean;
}

function assertValidStepRuntimeModels(stepModels: readonly StepRuntimeModel[]): void {
  if (!Array.isArray(stepModels)) {
    throw new Error('stepModels は配列で指定してください。');
  }

  for (let index = 0; index < stepModels.length; index += 1) {
    const stepModel = stepModels[index];
    if (!stepModel || typeof stepModel !== 'object' || !stepModel.step || typeof stepModel.step !== 'object') {
      throw new Error(`stepModels[${index}] が不正です。`);
    }

    if (typeof stepModel.lutIndex !== 'number' || !Number.isInteger(stepModel.lutIndex) || stepModel.lutIndex < 0) {
      throw new Error(`stepModels[${index}].lutIndex が不正です。`);
    }
  }
}

function assertValidOptions(options: BuildShaderStepCodeOptions): void {
  if (!options || typeof options !== 'object') {
    throw new Error('step code options が不正です。');
  }
  if (!options.backend || typeof options.backend !== 'object') {
    throw new Error('step code backend が不正です。');
  }
  if (typeof options.isPreview !== 'boolean') {
    throw new Error('step code isPreview が不正です。');
  }
}

export function buildShaderStepCode(
  stepModels: readonly StepRuntimeModel[],
  options: BuildShaderStepCodeOptions,
): string[] {
  assertValidStepRuntimeModels(stepModels);
  assertValidOptions(options);

  const { backend, isPreview } = options;
  const stepCode: string[] = [];

  for (let index = 0; index < stepModels.length; index += 1) {
    const stepModel = stepModels[index];
    const step = stepModel.step;
    const lutIndex = stepModel.lutIndex;

    const px = `px${index}`;
    const py = `py${index}`;
    const lutSample = `lutSample${index}`;
    const lutColor = `lutColor${index}`;
    const lutAlpha = `lutAlpha${index}`;
    const targetColor = `targetColor${index}`;
    const hsvCur = `hsvCur${index}`;
    const hsvLut = `hsvLut${index}`;

    const xExpr = backend.clampUnit(backend.getParamExpr(step.xParam));
    const yExpr = backend.clampUnit(backend.getParamExpr(step.yParam));
    const alphaExpr = backend.clampUnit(`${lutSample}.a`);

    const headLines = [
      `float ${px} = ${xExpr};`,
      `float ${py} = ${yExpr};`,
      `${backend.sampleType} ${lutSample} = ${backend.sampleFunctionName}(${lutIndex}, ${backend.uvType}(${px}, ${py}));`,
      `${backend.colorType} ${lutColor} = ${lutSample}.rgb;`,
      `float ${lutAlpha} = ${alphaExpr};`,
    ];

    const blendLines = emitBlendModeCode(backend, step.blendMode, {
      lutColorVar: lutColor,
      lutAlphaVar: lutAlpha,
      targetColorVar: targetColor,
      hsvCurVar: hsvCur,
      hsvLutVar: hsvLut,
      ops: step.ops,
    });

    if (isPreview) {
      stepCode.push(`if (${index} <= u_targetStep) {`);
      for (const line of headLines) {
        stepCode.push(`  ${line}`);
      }
      for (const line of blendLines) {
        stepCode.push(`  ${line}`);
      }
      stepCode.push('}');
      continue;
    }

    const opsDescription = Object.entries(step.ops)
      .filter(([, op]) => op !== 'none')
      .map(([channel, op]) => `${channel}: ${op}`)
      .join(', ');
    stepCode.push(`// Step ${index}${step.label ? `: ${step.label}` : ''}`);
    stepCode.push(`// (${step.xParam}, ${step.yParam}) -> ${step.blendMode}${opsDescription ? `(${opsDescription})` : ''}`);
    stepCode.push(...headLines);
    stepCode.push(...blendLines);
    stepCode.push('');
  }

  return stepCode;
}
