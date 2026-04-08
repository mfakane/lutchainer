import type { MaterialSettings } from '../pipeline/pipeline-model.ts';
import type { ParamName, ParamRef, ShaderLocalKey } from '../step/step-model.ts';
import { parseCustomParamRef } from '../step/step-model.ts';
import type { ShaderLanguageBackend } from './shader-language-backend.ts';

const PARAM_EXPRESSIONS: Record<ParamName, string> = {
  lightness: 'lambert',
  specular: 'specular',
  halfLambert: 'halfLambert',
  fresnel: 'fresnel',
  facing: 'facing',
  nDotH: 'nDotH',
  linearDepth: 'linearDepth',
  r: 'color.r',
  g: 'color.g',
  b: 'color.b',
  h: 'rgb2hsv(color).x',
  s: 'rgb2hsv(color).y',
  v: 'rgb2hsv(color).z',
  texU: 'v_texcoord.x',
  texV: 'v_texcoord.y',
  zero: '0.0',
  one: '1.0',
};

function emitLocalDeclaration(
  key: ShaderLocalKey,
  outputKind: 'fragment' | 'previewFragment',
  _material?: MaterialSettings,
): readonly string[] {
  switch (key) {
    case 'N':
      return outputKind === 'previewFragment' ? ['vec3 N = vec3(nx, ny, nz);'] : ['vec3 N = normalize(v_normal);'];
    case 'L':
      return outputKind === 'previewFragment' ? ['vec3 L = normalize(u_previewLightDir);'] : ['vec3 L = normalize(u_lightDir);'];
    case 'NdotL':
      return ['float NdotL = dot(N, L);'];
    case 'cameraPos':
      return outputKind === 'previewFragment' ? ['vec3 cameraPos = vec3(0.0, 0.0, 3.0);'] : [];
    case 'V':
      return outputKind === 'previewFragment'
        ? ['vec3 V = normalize(cameraPos - N);']
        : ['vec3 V = normalize(u_cameraPos - v_worldPos);'];
    case 'H':
      return ['vec3 H = normalize(L + V);'];
    case 'lambert':
      return ['float lambert = max(NdotL, 0.0);'];
    case 'halfLambert':
      return ['float halfLambert = pow(NdotL * 0.5 + 0.5, 2.0);'];
    case 'nDotH':
      return ['float nDotH = max(dot(N, H), 0.0);'];
    case 'specular':
      return [
        'float specularStrength = max(0.0, u_specularStrength);',
        'float specularPower = max(1.0, u_specularPower);',
        'float specular = pow(nDotH, specularPower) * specularStrength;',
      ];
    case 'facing':
      return ['float facing = max(dot(N, V), 0.0);'];
    case 'fresnel':
      return [
        'float fresnelStrength = max(0.0, u_fresnelStrength);',
        'float fresnelPower = max(0.01, u_fresnelPower);',
        'float fresnel = pow(1.0 - facing, fresnelPower) * fresnelStrength;',
      ];
    case 'linearDepth':
      return outputKind === 'previewFragment'
        ? [
            'float cameraDist = length(cameraPos);',
            'float nearDepth = max(0.0, cameraDist - 1.0);',
            'float farDepth = cameraDist + 1.0;',
            'float linearDepth = clamp((length(cameraPos - N) - nearDepth) / max(1.0e-4, farDepth - nearDepth), 0.0, 1.0);',
          ]
        : [
            'float cameraDist = length(u_cameraPos);',
            'float nearDepth = max(0.0, cameraDist - 1.0);',
            'float farDepth = cameraDist + 1.0;',
            'float linearDepth = clamp((length(u_cameraPos - v_worldPos) - nearDepth) / max(1.0e-4, farDepth - nearDepth), 0.0, 1.0);',
          ];
    case 'texcoord':
      return outputKind === 'previewFragment'
        ? [
            'float texU = clamp(nx * 0.5 + 0.5, 0.0, 1.0);',
            'float texV = clamp((-ny) * 0.5 + 0.5, 0.0, 1.0);',
            'vec2 v_texcoord = vec2(texU, texV);',
          ]
        : [];
    default:
      throw new Error(`Unsupported GLSL local key: ${String(key)}`);
  }
}

export const GLSL_SHADER_BACKEND: ShaderLanguageBackend = {
  language: 'glsl',
  displayName: 'GLSL',
  sampleType: 'vec4',
  colorType: 'vec3',
  hsvType: 'vec4',
  uvType: 'vec2',
  sampleFunctionName: 'sampleLut',
  whiteColor: 'vec3(1.0)',
  clampUnit: expression => `clamp(${expression}, 0.0, 1.0)`,
  clampColor: expression => `clamp(${expression}, 0.0, 1.0)`,
  lerp: (from, to, alpha) => `mix(${from}, ${to}, ${alpha})`,
  hsvFromColor: expression => `rgb2hsv(${expression})`,
  hsvToColor: expression => `hsv2rgb(${expression})`,
  getParamExpr: (param: ParamRef) => {
    const customParamId = parseCustomParamRef(param);
    if (customParamId) {
      return `u_param_${customParamId}`;
    }
    return PARAM_EXPRESSIONS[param as ParamName];
  },
  emitLocalDeclaration,
};
