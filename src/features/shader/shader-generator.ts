import { type MaterialSettings } from '../pipeline/pipeline-model';
import type { LutModel, StepModel } from '../step/step-model';
import { GLSL_SHADER_GENERATOR } from './shader-glsl-generator';
import { HLSL_SHADER_GENERATOR } from './shader-hlsl-generator';
import type { ShaderLanguage } from './shader-language-backend';
export type { ShaderLanguage } from './shader-language-backend';

export interface ShaderBuildInput {
  steps: StepModel[];
  luts: LutModel[];
  materialSettings: MaterialSettings;
}

export interface StepPreviewShaderBuildInput {
  steps: StepModel[];
  luts: LutModel[];
}

export interface ShaderGeneratorCapabilities {
  fragment: boolean;
  previewFragment: boolean;
  vertex: boolean;
}

export interface ShaderGenerator {
  language: ShaderLanguage;
  displayName: string;
  capabilities: ShaderGeneratorCapabilities;
  buildFragment: (input: ShaderBuildInput) => string;
  buildPreviewFragment?: (input: StepPreviewShaderBuildInput) => string;
  buildVertex?: () => string;
  getExportFiles: (input: ShaderBuildInput) => Record<string, string>;
}

const SHADER_GENERATORS: Record<ShaderLanguage, ShaderGenerator> = {
  glsl: GLSL_SHADER_GENERATOR,
  hlsl: HLSL_SHADER_GENERATOR,
};

function isValidMaterialSettings(value: MaterialSettings): boolean {
  return typeof value === 'object'
    && value !== null
    && Array.isArray(value.baseColor)
    && value.baseColor.length === 3
    && Number.isFinite(value.specularStrength)
    && Number.isFinite(value.specularPower)
    && Number.isFinite(value.fresnelStrength)
    && Number.isFinite(value.fresnelPower);
}

export function assertValidStepPreviewInput(input: StepPreviewShaderBuildInput): void {
  if (!input || !Array.isArray(input.steps) || !Array.isArray(input.luts)) {
    throw new Error('StepPreview shader 入力が不正です。');
  }
}

export function assertValidShaderBuildInput(input: ShaderBuildInput): void {
  if (!input || !Array.isArray(input.steps) || !Array.isArray(input.luts) || !isValidMaterialSettings(input.materialSettings)) {
    throw new Error('Shader 入力が不正です。');
  }
}

export function listShaderGenerators(): ShaderGenerator[] {
  return [SHADER_GENERATORS.glsl, SHADER_GENERATORS.hlsl];
}

export function getShaderGenerator(language: ShaderLanguage): ShaderGenerator {
  const generator = SHADER_GENERATORS[language];
  if (!generator) {
    throw new Error(`Unsupported shader language: ${String(language)}`);
  }
  return generator;
}
