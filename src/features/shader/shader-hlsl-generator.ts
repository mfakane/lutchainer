import {
  resolveStepRuntimeModels,
} from '../step/step-runtime';
import { buildGeneratedShaderHeader } from '../../shared/build-info.ts';
import { HLSL_SHADER_BACKEND } from './shader-hlsl-backend';
import {
  buildCustomUniformComments,
  buildSampleBody,
  collectUsedCustomParams,
} from './shader-generator-utils';
import { buildShaderLocalDeclarations } from './shader-local-decls';
import { buildShaderStepCode } from './shader-step-code';
import type {
  ShaderBuildInput,
  ShaderGenerator,
  ShaderGeneratorCapabilities,
} from './shader-generator';

const HLSL_GENERATOR_CAPABILITIES: ShaderGeneratorCapabilities = {
  fragment: true,
  previewFragment: false,
  vertex: false,
};

function buildHlslSampleBody(luts: ShaderBuildInput['luts']): string {
  return buildSampleBody(
    luts,
    'float4(1.0, 1.0, 1.0, 1.0)',
    index => `u_lut${index}.SampleLevel(u_lutSampler, uv, 0.0)`,
  );
}

function buildSharedColorFunctions(): string {
  return `float4 RgbToHsv(float3 color) {
  float r = color.r;
  float g = color.g;
  float b = color.b;
  float maxValue = max(r, max(g, b));
  float minValue = min(r, min(g, b));
  float delta = maxValue - minValue;

  float hue = 0.0;
  if (delta > 1.0e-6) {
    if (maxValue <= r) {
      hue = ((g - b) / delta + (g < b ? 6.0 : 0.0)) / 6.0;
    } else if (maxValue <= g) {
      hue = ((b - r) / delta + 2.0) / 6.0;
    } else if (maxValue <= b) {
      hue = ((r - g) / delta + 4.0) / 6.0;
    }
  }

  float saturation = maxValue <= 1.0e-6 ? 0.0 : delta / maxValue;
  float value = maxValue;
  float hasChroma = step(1.0e-6, delta);
  return saturate(float4(hue, saturation, value, hasChroma));
}

float3 HsvToRgb(float4 color) {
  float saturation = saturate(color.y);
  float value = saturate(color.z);
  float hasChroma = clamp(color.w, 0.0, 1.0);

  if (saturation <= 1.0e-6 || hasChroma <= 1.0e-6) {
    return float3(value, value, value);
  }

  float hue = color.x - floor(color.x);
  float c = value * saturation;
  float x = c * (1.0 - abs(fmod(hue * 6.0, 2.0) - 1.0));
  float m = value - c;
  float cM = c + m;
  float xM = x + m;

  float sectorFloat = floor(hue * 6.0);
  int sector = int(fmod(sectorFloat, 6.0));

  if (sector == 0) return float3(cM, xM, m);
  if (sector == 1) return float3(xM, cM, m);
  if (sector == 2) return float3(m, cM, xM);
  if (sector == 3) return float3(m, xM, cM);
  if (sector == 4) return float3(xM, m, cM);
  return float3(cM, m, xM);
}`;
}

function buildFragmentShader(input: ShaderBuildInput): string {
  const textureDecl = input.luts.map((_, index) => `Texture2D u_lut${index} : register(t${index});`).join('\n');
  const usedCustomParams = collectUsedCustomParams(input.steps, input.customParams);
  const customUniformComments = buildCustomUniformComments(usedCustomParams);
  const sampleBody = buildHlslSampleBody(input.luts);
  const stepModels = resolveStepRuntimeModels(input.steps, input.luts);
  const stepCode = buildShaderStepCode(stepModels, {
    backend: HLSL_SHADER_BACKEND,
    isPreview: false,
  });
  const localDeclarations = buildShaderLocalDeclarations(stepModels, {
    backend: HLSL_SHADER_BACKEND,
    outputKind: 'fragment',
    material: input.materialSettings,
  });

  return `${buildGeneratedShaderHeader('//')}
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
${usedCustomParams.map(param => `  float u_param_${param.id};`).join('\n')}
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

${customUniformComments ? `${customUniformComments}\n` : ''}
${buildSharedColorFunctions()}

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

  ${localDeclarations.join('\n  ')}

  float3 color = saturate(materialBaseColor * lightColor * textureSample.rgb);

  ${stepCode.join('\n  ')}

  color = saturate(color + ambientColor);
  float finalAlpha = saturate(textureSample.a);

  return float4(color, finalAlpha);
}`;
}

export const HLSL_SHADER_GENERATOR: ShaderGenerator = {
  language: 'hlsl',
  displayName: 'HLSL',
  capabilities: HLSL_GENERATOR_CAPABILITIES,
  buildFragment: buildFragmentShader,
  getExportFiles(input: ShaderBuildInput): Record<string, string> {
    return {
      'shader.hlsl': buildFragmentShader(input),
    };
  },
};
