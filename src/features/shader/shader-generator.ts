import { type MaterialSettings } from '../pipeline/pipeline-model';
import type { LutModel, StepModel } from '../step/step-model';
import {
  resolveStepRuntimeModels,
} from '../step/step-runtime';
import { buildShaderLocalDeclarations } from './shader-local-decls';
import { buildShaderStepCode } from './shader-step-code';

export const DEFAULT_VERT = `// SPDX-License-Identifier: CC0-1.0
precision mediump float;

attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec2 a_texcoord;

uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
uniform mat3 u_normalMatrix;

varying vec3 v_worldPos;
varying vec3 v_normal;
varying vec2 v_texcoord;

void main() {
  vec4 worldPos = u_modelMatrix * vec4(a_position, 1.0);
  v_worldPos = worldPos.xyz;
  v_normal = normalize(u_normalMatrix * a_normal);
  v_texcoord = a_texcoord;
  gl_Position = u_projectionMatrix * u_viewMatrix * worldPos;
}`;

export type ShaderStage = 'fragment' | 'vertex' | 'hlsl';

export interface ShaderBuildInput {
  steps: StepModel[];
  luts: LutModel[];
  materialSettings: MaterialSettings;
}

export interface StepPreviewShaderBuildInput {
  steps: StepModel[];
  luts: LutModel[];
}

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

function assertValidStepPreviewInput(input: StepPreviewShaderBuildInput): void {
  if (!input || !Array.isArray(input.steps) || !Array.isArray(input.luts)) {
    throw new Error('StepPreview shader 入力が不正です。');
  }
}

function assertValidShaderBuildInput(input: ShaderBuildInput): void {
  if (!input || !Array.isArray(input.steps) || !Array.isArray(input.luts) || !isValidMaterialSettings(input.materialSettings)) {
    throw new Error('Shader 入力が不正です。');
  }
}

function glslFloat(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  if (Math.abs(safeValue - Math.round(safeValue)) < 1e-6) {
    return `${Math.round(safeValue)}.0`;
  }
  return safeValue.toFixed(4);
}

function glslVec3(value: readonly [number, number, number]): string {
  return `vec3(${glslFloat(value[0])}, ${glslFloat(value[1])}, ${glslFloat(value[2])})`;
}

function hlslVec3(value: readonly [number, number, number]): string {
  return `float3(${glslFloat(value[0])}, ${glslFloat(value[1])}, ${glslFloat(value[2])})`;
}

function buildSampleBody(
  luts: LutModel[],
  fallbackExpr: string,
  sampleExprAtIndex: (index: number) => string,
): string {
  if (!Array.isArray(luts)) {
    throw new Error('LUT list が不正です。');
  }
  if (typeof fallbackExpr !== 'string' || fallbackExpr.trim().length === 0) {
    throw new Error('fallbackExpr が不正です。');
  }
  if (typeof sampleExprAtIndex !== 'function') {
    throw new Error('sampleExprAtIndex が不正です。');
  }

  if (luts.length === 0) {
    return `return ${fallbackExpr};`;
  }

  const lines: string[] = [];
  for (let index = 0; index < luts.length; index++) {
    const sampleExpr = sampleExprAtIndex(index);
    if (typeof sampleExpr !== 'string' || sampleExpr.trim().length === 0) {
      throw new Error(`sampleExprAtIndex(${index}) が不正です。`);
    }

    if (index === 0) lines.push(`if (lutIndex == ${index}) return ${sampleExpr};`);
    else lines.push(`else if (lutIndex == ${index}) return ${sampleExpr};`);
  }

  lines.push(`return ${sampleExprAtIndex(0)};`);
  return lines.join('\n  ');
}

function buildGlslSampleBody(luts: LutModel[]): string {
  return buildSampleBody(
    luts,
    'vec4(1.0, 1.0, 1.0, 1.0)',
    index => `texture2D(u_lut${index}, uv)`,
  );
}

function buildHlslSampleBody(luts: LutModel[]): string {
  return buildSampleBody(
    luts,
    'float4(1.0, 1.0, 1.0, 1.0)',
    index => `u_lut${index}.SampleLevel(u_lutSampler, uv, 0.0)`,
  );
}

export function isValidShaderStage(value: string): value is ShaderStage {
  return value === 'fragment' || value === 'vertex' || value === 'hlsl';
}

export function getShaderStageLabel(stage: ShaderStage): string {
  if (stage === 'fragment') return 'Fragment';
  if (stage === 'vertex') return 'Vertex';
  return 'HLSL';
}

export function buildStepPreviewFragmentShader(input: StepPreviewShaderBuildInput): string {
  assertValidStepPreviewInput(input);

  const samplerDecl = input.luts.map((_, index) => `uniform sampler2D u_lut${index};`).join('\n');
  const sampleBody = buildGlslSampleBody(input.luts);
  const stepModels = resolveStepRuntimeModels(input.steps, input.luts);
  const stepCode = buildShaderStepCode(stepModels, 'previewGlsl');
  const previewParamLines = buildShaderLocalDeclarations(stepModels, 'previewGlsl');

  return `// SPDX-License-Identifier: CC0-1.0
precision mediump float;

uniform vec2 u_resolution;
uniform int u_targetStep;
uniform vec3 u_materialBaseColor;
uniform float u_lightIntensity;
uniform vec3 u_lightColor;
uniform vec3 u_ambientColor;
uniform float u_specularStrength;
uniform float u_specularPower;
uniform float u_fresnelStrength;
uniform float u_fresnelPower;
uniform vec3 u_previewLightDir;
${samplerDecl}

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

vec4 sampleLut(int lutIndex, vec2 uv) {
  uv = clamp(uv, 0.0, 1.0);
  ${sampleBody}
}

void main() {
  const float PI = 3.14159265358979323846;

  float width = max(1.0, u_resolution.x);
  float height = max(1.0, u_resolution.y);
  vec2 frag = vec2(gl_FragCoord.x - 0.5, (height - gl_FragCoord.y) + 0.5);

  vec3 outColor = vec3(0.0);
  float outAlpha = 0.0;

  float centerX = width * 0.5;
  float centerY = height * 0.5;
  float radius = min(width, height) * 0.34;

  float dx = (frag.x - centerX) / max(radius, 1.0);
  float dy = (frag.y - centerY) / max(radius, 1.0);
  float dist2 = dx * dx + dy * dy;

  if (radius > 1.0 && dist2 <= 1.0) {
    float nx = dx;
    float ny = -dy;
    float nz = sqrt(max(0.0, 1.0 - dist2));

    ${previewParamLines.join('\n    ')}

    float lightIntensity = clamp(u_lightIntensity, 0.0, 2.0);
    vec3 lightColor = clamp(u_lightColor, 0.0, 1.0) * lightIntensity;
    vec3 color = clamp(u_materialBaseColor * lightColor, 0.0, 1.0);

    ${stepCode.join('\n    ')}

    color = clamp(color + clamp(u_ambientColor, 0.0, 1.0), 0.0, 1.0);
    outColor = color;
    outAlpha = 1.0;
  }

  gl_FragColor = vec4(clamp(outColor, 0.0, 1.0), clamp(outAlpha, 0.0, 1.0));
}`;
}

export function buildFragmentShader(input: ShaderBuildInput): string {
  assertValidShaderBuildInput(input);

  const samplerDecl = input.luts.map((_, index) => `uniform sampler2D u_lut${index};`).join('\n');
  const sampleBody = buildGlslSampleBody(input.luts);
  const stepModels = resolveStepRuntimeModels(input.steps, input.luts);
  const stepCode = buildShaderStepCode(stepModels, 'fragmentGlsl');
  const fragmentParamLines = buildShaderLocalDeclarations(stepModels, 'fragmentGlsl', input.materialSettings);

  return `// SPDX-License-Identifier: CC0-1.0
precision mediump float;

uniform float u_time;
uniform vec2  u_resolution;
uniform vec3  u_cameraPos;
uniform vec3  u_lightDir;
uniform float u_lightIntensity;
uniform vec3  u_lightColor;
uniform vec3  u_materialBaseColor;
uniform vec3  u_ambientColor;
uniform float u_specularStrength;
uniform float u_specularPower;
uniform float u_fresnelStrength;
uniform float u_fresnelPower;
uniform sampler2D u_texture;
${samplerDecl}

varying vec3 v_worldPos;
varying vec3 v_normal;
varying vec2 v_texcoord;

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

vec4 sampleLut(int lutIndex, vec2 uv) {
  uv = clamp(uv, 0.0, 1.0);
  ${sampleBody}
}

void main() {
  float lightIntensity = clamp(u_lightIntensity, 0.0, 2.0);
  vec3 lightColor = clamp(u_lightColor, 0.0, 1.0) * lightIntensity;
  vec3 materialBaseColor = clamp(u_materialBaseColor, 0.0, 1.0);
  vec3 ambientColor = clamp(u_ambientColor, 0.0, 1.0);
  vec4 textureSample = texture2D(u_texture, v_texcoord);

  ${fragmentParamLines.join('\n  ')}

  vec3 color = clamp(materialBaseColor * lightColor * textureSample.rgb, 0.0, 1.0);

  ${stepCode.join('\n  ')}

  color = clamp(color + ambientColor, 0.0, 1.0);
  float finalAlpha = clamp(textureSample.a, 0.0, 1.0);

  gl_FragColor = vec4(color, finalAlpha);
}`;
}

export function buildHlslShader(input: ShaderBuildInput): string {
  assertValidShaderBuildInput(input);

  const textureDecl = input.luts.map((_, index) => `Texture2D u_lut${index} : register(t${index});`).join('\n');
  const sampleBody = buildHlslSampleBody(input.luts);
  const stepModels = resolveStepRuntimeModels(input.steps, input.luts);
  const stepCode = buildShaderStepCode(stepModels, 'hlsl');
  const hlslParamLines = buildShaderLocalDeclarations(stepModels, 'hlsl', input.materialSettings);

  return `// SPDX-License-Identifier: CC0-1.0
cbuffer SceneUniforms : register(b0)
{
  float4x4 u_modelMatrix;
  float4x4 u_viewMatrix;
  float4x4 u_projectionMatrix;
  float3x3 u_normalMatrix;
  float u_time;
  float2 u_resolution;
  float3 u_cameraPos;
  float3 u_lightDir;
  float u_lightIntensity;
  float3 u_lightColor;
  float3 u_materialBaseColor;
  float3 u_ambientColor;
  float u_specularStrength;
  float u_specularPower;
  float u_fresnelStrength;
  float u_fresnelPower;
};

Texture2D u_texture : register(t0);
${textureDecl}
SamplerState u_lutSampler : register(s0);

struct VSInput {
  float3 position : POSITION;
  float3 normal : NORMAL;
  float2 texcoord : TEXCOORD0;
};

struct PSInput {
  float4 position : SV_POSITION;
  float3 worldPos : TEXCOORD0;
  float3 normal : TEXCOORD1;
  float2 texcoord : TEXCOORD2;
};

float3 RgbToHsv(float3 color) {
  float r = color.r;
  float g = color.g;
  float b = color.b;
  float maxValue = max(r, max(g, b));
  float minValue = min(r, min(g, b));
  float delta = maxValue - minValue;

  float hue = 0.0;
  if (delta > 1.0e-6) {
    if (maxValue == r) {
      hue = ((g - b) / delta + (g < b ? 6.0 : 0.0)) / 6.0;
    } else if (maxValue == g) {
      hue = ((b - r) / delta + 2.0) / 6.0;
    } else {
      hue = ((r - g) / delta + 4.0) / 6.0;
    }
  }

  float saturation = maxValue <= 1.0e-6 ? 0.0 : delta / maxValue;
  float value = maxValue;
  return saturate(float3(hue, saturation, value));
}

float3 HsvToRgb(float3 color) {
  float hue = color.x - floor(color.x);
  float saturation = saturate(color.y);
  float value = saturate(color.z);

  float sectorFloat = floor(hue * 6.0);
  float fraction = hue * 6.0 - sectorFloat;
  float p = value * (1.0 - saturation);
  float q = value * (1.0 - fraction * saturation);
  float t = value * (1.0 - (1.0 - fraction) * saturation);
  int sector = (int)sectorFloat % 6;

  if (sector == 0) return float3(value, t, p);
  if (sector == 1) return float3(q, value, p);
  if (sector == 2) return float3(p, value, t);
  if (sector == 3) return float3(p, q, value);
  if (sector == 4) return float3(t, p, value);
  return float3(value, p, q);
}

float4 SampleLut(int lutIndex, float2 uv) {
  uv = saturate(uv);
  ${sampleBody}
}

PSInput VSMain(VSInput input) {
  PSInput output;
  float4 worldPos = mul(u_modelMatrix, float4(input.position, 1.0));
  output.worldPos = worldPos.xyz;
  output.normal = normalize(mul(u_normalMatrix, input.normal));
  output.texcoord = input.texcoord;

  float4 viewPos = mul(u_viewMatrix, worldPos);
  output.position = mul(u_projectionMatrix, viewPos);
  return output;
}

float4 PSMain(PSInput input) : SV_TARGET {
  float lightIntensity = clamp(u_lightIntensity, 0.0, 2.0);
  float3 lightColor = saturate(u_lightColor) * lightIntensity;
  float3 materialBaseColor = saturate(u_materialBaseColor);
  float3 ambientColor = saturate(u_ambientColor);
  float4 textureSample = u_texture.SampleLevel(u_lutSampler, input.texcoord, 0.0);

  ${hlslParamLines.join('\n  ')}

  float3 color = saturate(materialBaseColor * lightColor * textureSample.rgb);

  ${stepCode.join('\n  ')}

  color = saturate(color + ambientColor);
  float finalAlpha = saturate(textureSample.a);

  return float4(color, finalAlpha);
}`;
}

export function getShaderSource(
  stage: ShaderStage,
  input: ShaderBuildInput,
  fragmentShader?: string,
): string {
  if (!isValidShaderStage(stage)) {
    throw new Error(`不正なシェーダ種別です: ${stage}`);
  }

  if (stage === 'vertex') {
    return DEFAULT_VERT;
  }

  if (stage === 'hlsl') {
    return buildHlslShader(input);
  }

  return fragmentShader ?? buildFragmentShader(input);
}