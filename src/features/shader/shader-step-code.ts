import {
  getBlendModeStrategy,
} from '../step/step-blend-strategies';
import type { StepRuntimeModel } from '../step/step-model';
import {
  paramExprGlsl,
  paramExprHlsl,
} from '../step/step-param-evaluators';

export type ShaderStepCodeStage = 'previewGlsl' | 'fragmentGlsl' | 'hlsl';

function assertValidStage(stage: unknown): asserts stage is ShaderStepCodeStage {
  if (stage !== 'previewGlsl' && stage !== 'fragmentGlsl' && stage !== 'hlsl') {
    throw new Error(`step code stage が不正です: ${String(stage)}`);
  }
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

export function buildShaderStepCode(stepModels: readonly StepRuntimeModel[], stage: ShaderStepCodeStage): string[] {
  assertValidStepRuntimeModels(stepModels);
  assertValidStage(stage);

  const isPreviewStage = stage === 'previewGlsl';
  const isHlslStage = stage === 'hlsl';
  const sampleType = isHlslStage ? 'float4' : 'vec4';
  const colorType = isHlslStage ? 'float3' : 'vec3';
  const uvType = isHlslStage ? 'float2' : 'vec2';
  const sampleFn = isHlslStage ? 'SampleLut' : 'sampleLut';

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

    const xExpr = isHlslStage
      ? `saturate(${paramExprHlsl(step.xParam)})`
      : `clamp(${paramExprGlsl(step.xParam)}, 0.0, 1.0)`;
    const yExpr = isHlslStage
      ? `saturate(${paramExprHlsl(step.yParam)})`
      : `clamp(${paramExprGlsl(step.yParam)}, 0.0, 1.0)`;
    const alphaExpr = isHlslStage
      ? `saturate(${lutSample}.a)`
      : `clamp(${lutSample}.a, 0.0, 1.0)`;

    const headLines = [
      `float ${px} = ${xExpr};`,
      `float ${py} = ${yExpr};`,
      `${sampleType} ${lutSample} = ${sampleFn}(${lutIndex}, ${uvType}(${px}, ${py}));`,
      `${colorType} ${lutColor} = ${lutSample}.rgb;`,
      `float ${lutAlpha} = ${alphaExpr};`,
    ];

    const blendLines = isHlslStage
      ? getBlendModeStrategy(step.blendMode).emitHlsl({
          lutColorVar: lutColor,
          lutAlphaVar: lutAlpha,
          targetColorVar: targetColor,
          hsvCurVar: hsvCur,
          hsvLutVar: hsvLut,
          ops: step.ops,
        })
      : getBlendModeStrategy(step.blendMode).emitGlsl({
          lutColorVar: lutColor,
          lutAlphaVar: lutAlpha,
          targetColorVar: targetColor,
          hsvCurVar: hsvCur,
          hsvLutVar: hsvLut,
          ops: step.ops,
        });

    if (isPreviewStage) {
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
