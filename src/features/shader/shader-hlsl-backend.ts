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
  h: 'RgbToHsv(color).x',
  s: 'RgbToHsv(color).y',
  v: 'RgbToHsv(color).z',
  texU: 'input.texcoord.x',
  texV: 'input.texcoord.y',
  zero: '0.0',
  one: '1.0',
};

function emitLocalDeclaration(
  key: ShaderLocalKey,
  outputKind: 'fragment' | 'previewFragment',
  _material?: MaterialSettings,
): readonly string[] {
  if (outputKind !== 'fragment') {
    throw new Error(`HLSL backend does not support ${outputKind}.`);
  }

  switch (key) {
    case 'N':
      return ['float3 N = normalize(input.normal);'];
    case 'L':
      return ['float3 L = normalize(u_lightDir);'];
    case 'NdotL':
      return ['float NdotL = dot(N, L);'];
    case 'cameraPos':
      return [];
    case 'V':
      return ['float3 V = normalize(u_cameraPos - input.worldPos);'];
    case 'H':
      return ['float3 H = normalize(L + V);'];
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
      return [
        'float cameraDist = length(u_cameraPos);',
        'float nearDepth = max(0.0, cameraDist - 1.0);',
        'float farDepth = cameraDist + 1.0;',
        'float linearDepth = saturate((length(u_cameraPos - input.worldPos) - nearDepth) / max(1.0e-4, farDepth - nearDepth));',
      ];
    case 'texcoord':
      return [];
    default:
      throw new Error(`Unsupported HLSL local key: ${String(key)}`);
  }
}

export const HLSL_SHADER_BACKEND: ShaderLanguageBackend = {
  language: 'hlsl',
  displayName: 'HLSL',
  sampleType: 'float4',
  colorType: 'float3',
  hsvType: 'float4',
  uvType: 'float2',
  sampleFunctionName: 'SampleLut',
  whiteColor: 'float3(1.0, 1.0, 1.0)',
  clampUnit: expression => `saturate(${expression})`,
  clampColor: expression => `saturate(${expression})`,
  lerp: (from, to, alpha) => `lerp(${from}, ${to}, ${alpha})`,
  hsvFromColor: expression => `RgbToHsv(${expression})`,
  hsvToColor: expression => `HsvToRgb(${expression})`,
  getParamExpr: (param: ParamRef) => {
    const customParamId = parseCustomParamRef(param);
    if (customParamId) {
      return `u_param_${customParamId}`;
    }
    return PARAM_EXPRESSIONS[param as ParamName];
  },
  emitLocalDeclaration,
};
