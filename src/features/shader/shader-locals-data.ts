import type { MaterialSettings } from '../pipeline/pipeline-model';
import type { ShaderLocalKey } from '../step/step-model';

export interface ShaderLocalDecl {
  requires: readonly ShaderLocalKey[];
  previewGlsl: readonly string[];
  fragmentGlsl: (material: MaterialSettings) => readonly string[];
  hlsl: (material: MaterialSettings) => readonly string[];
}

export const SHADER_LOCALS: Record<ShaderLocalKey, ShaderLocalDecl> = {
  N: {
    requires: [],
    previewGlsl: ['vec3 N = vec3(nx, ny, nz);'],
    fragmentGlsl: () => ['vec3 N = normalize(v_normal);'],
    hlsl: () => ['float3 N = normalize(input.normal);'],
  },
  L: {
    requires: [],
    previewGlsl: ['vec3 L = normalize(u_previewLightDir);'],
    fragmentGlsl: () => ['vec3 L = normalize(u_lightDir);'],
    hlsl: () => ['float3 L = normalize(u_lightDir);'],
  },
  cameraPos: {
    requires: [],
    previewGlsl: ['vec3 cameraPos = vec3(0.0, 0.0, 3.0);'],
    fragmentGlsl: () => [],
    hlsl: () => [],
  },
  V: {
    requires: ['N', 'cameraPos'],
    previewGlsl: ['vec3 V = normalize(cameraPos - N);'],
    fragmentGlsl: () => ['vec3 V = normalize(u_cameraPos - v_worldPos);'],
    hlsl: () => ['float3 V = normalize(u_cameraPos - input.worldPos);'],
  },
  H: {
    requires: ['L', 'V'],
    previewGlsl: ['vec3 H = normalize(L + V);'],
    fragmentGlsl: () => ['vec3 H = normalize(L + V);'],
    hlsl: () => ['float3 H = normalize(L + V);'],
  },
  lambert: {
    requires: ['N', 'L'],
    previewGlsl: ['float lambert = max(dot(N, L), 0.0);'],
    fragmentGlsl: () => ['float lambert = max(dot(N, L), 0.0);'],
    hlsl: () => ['float lambert = max(dot(N, L), 0.0);'],
  },
  halfLambert: {
    requires: ['lambert'],
    previewGlsl: ['float halfLambert = lambert * 0.5 + 0.5;'],
    fragmentGlsl: () => ['float halfLambert = lambert * 0.5 + 0.5;'],
    hlsl: () => ['float halfLambert = lambert * 0.5 + 0.5;'],
  },
  nDotH: {
    requires: ['N', 'H'],
    previewGlsl: ['float nDotH = max(dot(N, H), 0.0);'],
    fragmentGlsl: () => ['float nDotH = max(dot(N, H), 0.0);'],
    hlsl: () => ['float nDotH = max(dot(N, H), 0.0);'],
  },
  specular: {
    requires: ['nDotH'],
    previewGlsl: [
      'float specularStrength = max(0.0, u_specularStrength);',
      'float specularPower = max(1.0, u_specularPower);',
      'float specular = pow(nDotH, specularPower) * specularStrength;',
    ],
    fragmentGlsl: () => [
      'float specularStrength = max(0.0, u_specularStrength);',
      'float specularPower = max(1.0, u_specularPower);',
      'float specular = pow(nDotH, specularPower) * specularStrength;',
    ],
    hlsl: () => [
      'float specularStrength = max(0.0, u_specularStrength);',
      'float specularPower = max(1.0, u_specularPower);',
      'float specular = pow(nDotH, specularPower) * specularStrength;',
    ],
  },
  facing: {
    requires: ['N', 'V'],
    previewGlsl: ['float facing = max(dot(N, V), 0.0);'],
    fragmentGlsl: () => ['float facing = max(dot(N, V), 0.0);'],
    hlsl: () => ['float facing = max(dot(N, V), 0.0);'],
  },
  fresnel: {
    requires: ['facing'],
    previewGlsl: [
      'float fresnelStrength = max(0.0, u_fresnelStrength);',
      'float fresnelPower = max(0.01, u_fresnelPower);',
      'float fresnel = pow(1.0 - facing, fresnelPower) * fresnelStrength;',
    ],
    fragmentGlsl: () => [
      'float fresnelStrength = max(0.0, u_fresnelStrength);',
      'float fresnelPower = max(0.01, u_fresnelPower);',
      'float fresnel = pow(1.0 - facing, fresnelPower) * fresnelStrength;',
    ],
    hlsl: () => [
      'float fresnelStrength = max(0.0, u_fresnelStrength);',
      'float fresnelPower = max(0.01, u_fresnelPower);',
      'float fresnel = pow(1.0 - facing, fresnelPower) * fresnelStrength;',
    ],
  },
  linearDepth: {
    requires: ['N', 'cameraPos'],
    previewGlsl: [
      'float cameraDist = length(cameraPos);',
      'float nearDepth = max(0.0, cameraDist - 1.0);',
      'float farDepth = cameraDist + 1.0;',
      'float linearDepth = clamp((length(cameraPos - N) - nearDepth) / max(1.0e-4, farDepth - nearDepth), 0.0, 1.0);',
    ],
    fragmentGlsl: () => [
      'float cameraDist = length(u_cameraPos);',
      'float nearDepth = max(0.0, cameraDist - 1.0);',
      'float farDepth = cameraDist + 1.0;',
      'float linearDepth = clamp((length(u_cameraPos - v_worldPos) - nearDepth) / max(1.0e-4, farDepth - nearDepth), 0.0, 1.0);',
    ],
    hlsl: () => [
      'float cameraDist = length(u_cameraPos);',
      'float nearDepth = max(0.0, cameraDist - 1.0);',
      'float farDepth = cameraDist + 1.0;',
      'float linearDepth = saturate((length(u_cameraPos - input.worldPos) - nearDepth) / max(1.0e-4, farDepth - nearDepth));',
    ],
  },
  texcoord: {
    requires: [],
    previewGlsl: [
      'float texU = atan(nz, nx) / (PI * 2.0);',
      'if (texU < 0.0) texU += 1.0;',
      'float texV = acos(clamp(ny, -1.0, 1.0)) / PI;',
      'vec2 v_texcoord = vec2(texU, texV);',
    ],
    fragmentGlsl: () => [],
    hlsl: () => [],
  },
};

export const ALL_LOCAL_KEYS: readonly ShaderLocalKey[] = [
  'N',
  'L',
  'cameraPos',
  'V',
  'H',
  'lambert',
  'halfLambert',
  'nDotH',
  'specular',
  'facing',
  'fresnel',
  'linearDepth',
  'texcoord',
];
