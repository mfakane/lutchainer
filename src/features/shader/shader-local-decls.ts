import type { MaterialSettings } from '../pipeline/pipeline-model';
import type {
  ParamName,
  ShaderLocalKey,
  StepRuntimeModel,
} from '../step/step-model';
import { PARAM_EVALUATORS } from '../step/step-runtime';

export type ShaderLocalDeclarationStage = 'previewGlsl' | 'fragmentGlsl' | 'hlsl';

interface ShaderLocalDecl {
  requires: readonly ShaderLocalKey[];
  previewGlsl: readonly string[];
  fragmentGlsl: (material: MaterialSettings) => readonly string[];
  hlsl: (material: MaterialSettings) => readonly string[];
}

const SHADER_LOCALS: Record<ShaderLocalKey, ShaderLocalDecl> = {
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

const ALL_LOCAL_KEYS: readonly ShaderLocalKey[] = [
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

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
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

function assertValidStepRuntimeModels(stepModels: readonly StepRuntimeModel[]): void {
  if (!Array.isArray(stepModels)) {
    throw new Error('stepModels は配列で指定してください。');
  }

  for (let index = 0; index < stepModels.length; index += 1) {
    const stepModel = stepModels[index];
    if (!stepModel || typeof stepModel !== 'object' || !stepModel.step || typeof stepModel.step !== 'object') {
      throw new Error(`stepModels[${index}] が不正です。`);
    }

    const xParam = stepModel.step.xParam;
    const yParam = stepModel.step.yParam;
    if (!(typeof xParam === 'string' && xParam in PARAM_EVALUATORS)) {
      throw new Error(`stepModels[${index}].step.xParam が不正です。`);
    }
    if (!(typeof yParam === 'string' && yParam in PARAM_EVALUATORS)) {
      throw new Error(`stepModels[${index}].step.yParam が不正です。`);
    }
  }
}

function assertValidStage(stage: unknown): asserts stage is ShaderLocalDeclarationStage {
  if (stage !== 'previewGlsl' && stage !== 'fragmentGlsl' && stage !== 'hlsl') {
    throw new Error(`stage が不正です: ${String(stage)}`);
  }
}

function collectUsedParams(stepModels: readonly StepRuntimeModel[]): Set<ParamName> {
  const usedParams = new Set<ParamName>();
  for (const stepModel of stepModels) {
    usedParams.add(stepModel.step.xParam);
    usedParams.add(stepModel.step.yParam);
  }
  return usedParams;
}

function collectRequiredLocals(usedParams: ReadonlySet<ParamName>): Set<ShaderLocalKey> {
  const required = new Set<ShaderLocalKey>();
  for (const param of usedParams) {
    for (const key of PARAM_EVALUATORS[param].shader.requires) {
      required.add(key);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const key of ALL_LOCAL_KEYS) {
      if (!required.has(key)) {
        continue;
      }

      for (const dep of SHADER_LOCALS[key].requires) {
        if (!required.has(dep)) {
          required.add(dep);
          changed = true;
        }
      }
    }
  }

  return required;
}

function topoSort(required: ReadonlySet<ShaderLocalKey>): ShaderLocalKey[] {
  const sorted: ShaderLocalKey[] = [];
  const visited = new Set<ShaderLocalKey>();
  const visiting = new Set<ShaderLocalKey>();

  const visit = (key: ShaderLocalKey): void => {
    if (visited.has(key)) {
      return;
    }
    if (visiting.has(key)) {
      throw new Error(`シェーダローカル依存に循環があります: ${key}`);
    }

    visiting.add(key);
    for (const dep of SHADER_LOCALS[key].requires) {
      if (required.has(dep)) {
        visit(dep);
      }
    }

    visiting.delete(key);
    visited.add(key);
    sorted.push(key);
  };

  for (const key of ALL_LOCAL_KEYS) {
    if (required.has(key)) {
      visit(key);
    }
  }

  return sorted;
}

function emitLocalDecls(required: ReadonlySet<ShaderLocalKey>, stage: 'previewGlsl'): string[];
function emitLocalDecls(required: ReadonlySet<ShaderLocalKey>, stage: 'fragmentGlsl' | 'hlsl', material: MaterialSettings): string[];
function emitLocalDecls(
  required: ReadonlySet<ShaderLocalKey>,
  stage: ShaderLocalDeclarationStage,
  material?: MaterialSettings,
): string[] {
  if ((stage === 'fragmentGlsl' || stage === 'hlsl') && !isValidMaterialSettings(material)) {
    throw new Error('materialSettings が不正です。');
  }

  const sorted = topoSort(required);
  return sorted.flatMap(key => {
    const decl = SHADER_LOCALS[key];
    if (stage === 'previewGlsl') {
      return [...decl.previewGlsl];
    }
    if (stage === 'fragmentGlsl') {
      return [...decl.fragmentGlsl(material!)];
    }
    return [...decl.hlsl(material!)];
  });
}

export function buildShaderLocalDeclarations(stepModels: readonly StepRuntimeModel[], stage: 'previewGlsl'): string[];
export function buildShaderLocalDeclarations(
  stepModels: readonly StepRuntimeModel[],
  stage: 'fragmentGlsl' | 'hlsl',
  material: MaterialSettings,
): string[];
export function buildShaderLocalDeclarations(
  stepModels: readonly StepRuntimeModel[],
  stage: ShaderLocalDeclarationStage,
  material?: MaterialSettings,
): string[] {
  assertValidStepRuntimeModels(stepModels);
  assertValidStage(stage);

  const usedParams = collectUsedParams(stepModels);
  const requiredLocals = collectRequiredLocals(usedParams);
  if (stage === 'previewGlsl') {
    return emitLocalDecls(requiredLocals, stage);
  }

  if (!isValidMaterialSettings(material)) {
    throw new Error('materialSettings が不正です。');
  }

  return emitLocalDecls(requiredLocals, stage, material);
}
