import type { MaterialSettings } from '../pipeline/pipeline-model';
import type {
  ParamName,
  ShaderLocalKey,
  StepRuntimeModel,
} from '../step/step-model';
import { PARAM_EVALUATORS } from '../step/step-param-evaluators';
import { parseCustomParamRef } from '../step/step-model';
import type { ShaderLanguageBackend, ShaderOutputKind } from './shader-language-backend';

const ALL_LOCAL_KEYS: readonly ShaderLocalKey[] = [
  'N',
  'L',
  'NdotL',
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

const LOCAL_DEPENDENCIES: Record<ShaderLocalKey, readonly ShaderLocalKey[]> = {
  N: [],
  L: [],
  NdotL: ['N', 'L'],
  cameraPos: [],
  V: ['N', 'cameraPos'],
  H: ['L', 'V'],
  lambert: ['NdotL'],
  halfLambert: ['NdotL'],
  nDotH: ['N', 'H'],
  specular: ['nDotH'],
  facing: ['N', 'V'],
  fresnel: ['facing'],
  linearDepth: ['N', 'cameraPos'],
  texcoord: [],
};

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
    if (!(typeof xParam === 'string' && (parseCustomParamRef(xParam) !== null || xParam in PARAM_EVALUATORS))) {
      throw new Error(`stepModels[${index}].step.xParam が不正です。`);
    }
    if (!(typeof yParam === 'string' && (parseCustomParamRef(yParam) !== null || yParam in PARAM_EVALUATORS))) {
      throw new Error(`stepModels[${index}].step.yParam が不正です。`);
    }
  }
}

function collectUsedParams(stepModels: readonly StepRuntimeModel[]): Set<ParamName> {
  const usedParams = new Set<ParamName>();
  for (const stepModel of stepModels) {
    if (!parseCustomParamRef(stepModel.step.xParam)) {
      usedParams.add(stepModel.step.xParam as ParamName);
    }
    if (!parseCustomParamRef(stepModel.step.yParam)) {
      usedParams.add(stepModel.step.yParam as ParamName);
    }
  }
  return usedParams;
}

function collectRequiredLocals(usedParams: ReadonlySet<ParamName>): Set<ShaderLocalKey> {
  const required = new Set<ShaderLocalKey>();
  for (const param of usedParams) {
    for (const key of PARAM_EVALUATORS[param].requires) {
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
      for (const dependency of LOCAL_DEPENDENCIES[key]) {
        if (!required.has(dependency)) {
          required.add(dependency);
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
    for (const dependency of LOCAL_DEPENDENCIES[key]) {
      if (required.has(dependency)) {
        visit(dependency);
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

export interface BuildShaderLocalDeclarationOptions {
  backend: ShaderLanguageBackend;
  outputKind: ShaderOutputKind;
  material?: MaterialSettings;
}

export function buildShaderLocalDeclarations(
  stepModels: readonly StepRuntimeModel[],
  options: BuildShaderLocalDeclarationOptions,
): string[] {
  assertValidStepRuntimeModels(stepModels);
  if (!options || typeof options !== 'object' || !options.backend) {
    throw new Error('shader local declaration options が不正です。');
  }
  if (options.outputKind === 'fragment' && !isValidMaterialSettings(options.material)) {
    throw new Error('materialSettings が不正です。');
  }

  const usedParams = collectUsedParams(stepModels);
  const requiredLocals = collectRequiredLocals(usedParams);
  const sorted = topoSort(requiredLocals);
  return sorted.flatMap(key => [
    ...options.backend.emitLocalDeclaration(key, options.outputKind, options.material),
  ]);
}
