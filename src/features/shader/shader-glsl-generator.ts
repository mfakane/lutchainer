import {
  type MaterialSettings,
} from '../pipeline/pipeline-model.ts';
import type { LutModel, StepModel } from '../step/step-model.ts';
import {
  resolveStepRuntimeModels,
} from '../step/step-runtime.ts';
import { buildGeneratedShaderHeader } from '../../shared/build-info.ts';
import { GLSL_SHADER_BACKEND } from './shader-glsl-backend.ts';
import {
  buildCustomUniformComments,
  buildCustomUniformDeclarations,
  buildSampleBody,
  collectUsedCustomParams,
} from './shader-generator-utils.ts';
import { buildShaderLocalDeclarations } from './shader-local-decls.ts';
import { buildShaderStepCode } from './shader-step-code.ts';
import type {
  ShaderBuildInput,
  ShaderGenerator,
  ShaderGeneratorCapabilities,
  StepPreviewShaderBuildInput,
} from './shader-generator.ts';

export const DEFAULT_GLSL_VERTEX_SHADER = `${buildGeneratedShaderHeader('//')}
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

const GLSL_GENERATOR_CAPABILITIES: ShaderGeneratorCapabilities = {
  fragment: true,
  previewFragment: true,
  vertex: true,
};

function buildGlslSampleBody(luts: readonly LutModel[]): string {
  return buildSampleBody(
    luts,
    'vec4(1.0, 1.0, 1.0, 1.0)',
    index => `texture2D(u_lut${index}, uv)`,
  );
}

function buildSharedColorFunctions(): string {
  return `vec4 rgb2hsv(vec3 color) {
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
  return clamp(vec4(hue, saturation, value, hasChroma), 0.0, 1.0);
}

vec3 hsv2rgb(vec4 color) {
  float saturation = clamp(color.y, 0.0, 1.0);
  float value = clamp(color.z, 0.0, 1.0);
  float hasChroma = clamp(color.w, 0.0, 1.0);

  if (saturation <= 1.0e-6 || hasChroma <= 1.0e-6) {
    return vec3(value);
  }

  float hue = color.x - floor(color.x);
  float c = value * saturation;
  float x = c * (1.0 - abs(mod(hue * 6.0, 2.0) - 1.0));
  float m = value - c;
  float cM = c + m;
  float xM = x + m;

  float sectorFloat = floor(hue * 6.0);
  int sector = int(mod(sectorFloat, 6.0));

  if (sector == 0) return vec3(cM, xM, m);
  if (sector == 1) return vec3(xM, cM, m);
  if (sector == 2) return vec3(m, cM, xM);
  if (sector == 3) return vec3(m, xM, cM);
  if (sector == 4) return vec3(xM, m, cM);
  return vec3(cM, m, xM);
}`;
}

function buildPreviewFragmentShader(input: StepPreviewShaderBuildInput): string {
  const samplerDecl = input.luts.map((_, index) => `uniform sampler2D u_lut${index};`).join('\n');
  const usedCustomParams = collectUsedCustomParams(input.steps, input.customParams);
  const customUniformDecl = buildCustomUniformDeclarations(usedCustomParams);
  const sampleBody = buildGlslSampleBody(input.luts);
  const stepModels = resolveStepRuntimeModels(input.steps, input.luts);
  const stepCode = buildShaderStepCode(stepModels, {
    backend: GLSL_SHADER_BACKEND,
    isPreview: true,
  });
  const previewParamLines = buildShaderLocalDeclarations(stepModels, {
    backend: GLSL_SHADER_BACKEND,
    outputKind: 'previewFragment',
  });

  return `${buildGeneratedShaderHeader('//')}
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
${customUniformDecl ? `${customUniformDecl}\n` : ''}

${buildSharedColorFunctions()}

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

function buildFragmentShader(input: ShaderBuildInput): string {
  const samplerDecl = input.luts.map((_, index) => `uniform sampler2D u_lut${index};`).join('\n');
  const usedCustomParams = collectUsedCustomParams(input.steps, input.customParams);
  const customUniformDecl = buildCustomUniformDeclarations(usedCustomParams);
  const customUniformComments = buildCustomUniformComments(usedCustomParams);
  const sampleBody = buildGlslSampleBody(input.luts);
  const stepModels = resolveStepRuntimeModels(input.steps, input.luts);
  const stepCode = buildShaderStepCode(stepModels, {
    backend: GLSL_SHADER_BACKEND,
    isPreview: false,
  });
  const fragmentParamLines = buildShaderLocalDeclarations(stepModels, {
    backend: GLSL_SHADER_BACKEND,
    outputKind: 'fragment',
    material: input.materialSettings,
  });

  return `${buildGeneratedShaderHeader('//')}
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
${customUniformDecl ? `${customUniformDecl}\n` : ''}

varying vec3 v_worldPos;
varying vec3 v_normal;
varying vec2 v_texcoord;

${customUniformComments ? `${customUniformComments}\n` : ''}
${buildSharedColorFunctions()}

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

export const GLSL_SHADER_GENERATOR: ShaderGenerator = {
  language: 'glsl',
  displayName: 'GLSL',
  capabilities: GLSL_GENERATOR_CAPABILITIES,
  buildFragment: buildFragmentShader,
  buildPreviewFragment: buildPreviewFragmentShader,
  buildVertex: () => DEFAULT_GLSL_VERTEX_SHADER,
  getExportFiles(input: ShaderBuildInput): Record<string, string> {
    return {
      'fragment.glsl': buildFragmentShader(input),
      'vertex.glsl': DEFAULT_GLSL_VERTEX_SHADER,
    };
  },
};
