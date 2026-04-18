import type {
  LightSettings,
  MaterialSettings,
} from '../../features/pipeline/pipeline-model.ts';
import { getShaderGenerator } from '../../features/shader/shader-generator.ts';
import type {
  LutModel,
  StepModel,
  CustomParamModel,
} from '../../features/step/step-model.ts';
import {
  StepPreviewRenderer,
  type StepPreviewDrawOptions,
  type StepPreviewShaderError,
} from './step-preview-renderer.ts';

export interface EnsureStepPreviewRendererProgramInput {
  renderer: StepPreviewRenderer;
  steps: readonly StepModel[];
  luts: readonly LutModel[];
  customParams: readonly CustomParamModel[];
}

export interface EnsureStepPreviewRendererProgramResult {
  ok: boolean;
  message: string | null;
}

export interface BuildStepPreviewDrawOptionsInput {
  targetStepIndex: number;
  materialSettings: MaterialSettings;
  lightSettings: LightSettings;
  lightDirection: readonly [number, number, number];
  customParams: readonly CustomParamModel[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteTuple3(value: unknown): value is readonly [number, number, number] {
  return Array.isArray(value)
    && value.length === 3
    && Number.isFinite(value[0])
    && Number.isFinite(value[1])
    && Number.isFinite(value[2]);
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

function assertValidEnsureProgramInput(input: EnsureStepPreviewRendererProgramInput): void {
  if (!input || typeof input !== 'object') {
    throw new Error('WebGL preview 入力が不正です。');
  }
  if (!(input.renderer instanceof StepPreviewRenderer)) {
    throw new Error('renderer が不正です。');
  }
  if (!Array.isArray(input.steps)) {
    throw new Error('steps は配列で指定してください。');
  }
  if (!Array.isArray(input.luts)) {
    throw new Error('luts は配列で指定してください。');
  }
  if (!Array.isArray(input.customParams)) {
    throw new Error('customParams は配列で指定してください。');
  }
}

function formatShaderErrors(errors: readonly StepPreviewShaderError[]): string {
  if (!Array.isArray(errors)) {
    throw new Error('shader errors が不正です。');
  }

  return errors
    .map(error => {
      if (!error || typeof error !== 'object') {
        return '[UNKNOWN]\nInvalid shader error entry';
      }
      const type = typeof error.type === 'string' ? error.type.toUpperCase() : 'UNKNOWN';
      const message = typeof error.message === 'string' ? error.message.trim() : 'Unknown shader error';
      return `[${type}]\n${message}`;
    })
    .join('\n\n');
}

function assertValidBuildDrawOptionsInput(input: BuildStepPreviewDrawOptionsInput): void {
  if (!input || typeof input !== 'object') {
    throw new Error('draw options 入力が不正です。');
  }
  if (!Number.isInteger(input.targetStepIndex) || input.targetStepIndex < 0) {
    throw new Error(`不正な targetStepIndex です: ${String(input.targetStepIndex)}`);
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
}

export function ensureStepPreviewRendererProgram(
  input: EnsureStepPreviewRendererProgramInput,
): EnsureStepPreviewRendererProgramResult {
  assertValidEnsureProgramInput(input);

  const { renderer, steps, luts, customParams } = input;
  const lutError = renderer.setLutTextures(luts.map(lut => lut.image as TexImageSource));
  if (lutError) {
    return {
      ok: false,
      message: `Stepプレビュー(WebGL) のLUT設定に失敗しました: ${lutError}`,
    };
  }

  const compileResult = renderer.compileProgram(
    (() => {
      const glslGenerator = getShaderGenerator('glsl');
      if (typeof glslGenerator.buildPreviewFragment !== 'function') {
        throw new Error('GLSL generator does not support preview fragment generation.');
      }
      return glslGenerator.buildPreviewFragment({
        steps: [...steps],
        luts: [...luts],
        customParams: [...customParams],
      });
    })(),
  );
  if (!compileResult.success) {
    return {
      ok: false,
      message: `Stepプレビュー(WebGL) のシェーダー生成に失敗しました。\n${formatShaderErrors(compileResult.errors)}`,
    };
  }

  return {
    ok: true,
    message: null,
  };
}

export function buildStepPreviewDrawOptions(
  input: BuildStepPreviewDrawOptionsInput,
): StepPreviewDrawOptions {
  assertValidBuildDrawOptionsInput(input);

  return {
    targetStepIndex: input.targetStepIndex,
    baseColor: input.materialSettings.baseColor,
    lightIntensity: input.lightSettings.lightIntensity,
    lightColor: input.lightSettings.lightColor,
    ambientColor: input.lightSettings.ambientColor,
    specularStrength: input.materialSettings.specularStrength,
    specularPower: input.materialSettings.specularPower,
    fresnelStrength: input.materialSettings.fresnelStrength,
    fresnelPower: input.materialSettings.fresnelPower,
    lightDirection: input.lightDirection,
    customParams: input.customParams,
  };
}
