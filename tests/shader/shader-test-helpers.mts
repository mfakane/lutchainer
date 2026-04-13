import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  BLEND_MODES,
  BUILTIN_PARAM_NAMES,
  DEFAULT_OPS,
  type BlendMode,
  type CustomParamModel,
  type LutModel,
  type ParamRef,
  type StepModel,
} from '../../src/features/step/step-model.ts';
import { DEFAULT_MATERIAL_SETTINGS } from '../../src/features/pipeline/pipeline-model.ts';
import {
  assertValidShaderBuildInput,
  getShaderGenerator,
  type ShaderBuildInput,
} from '../../src/features/shader/shader-generator.ts';
import {
  parsePipelineArchive,
  PIPELINE_ZIP_FILE_VERSION,
  type PipelineStepEntry,
  type PipelineZipLutEntry,
} from '../../src/shared/lutchain/lutchain-archive.ts';

function createDummyLut(entry: PipelineZipLutEntry): LutModel {
  const pixelCount = Math.max(1, entry.width * entry.height * 4);
  return {
    id: entry.id,
    name: entry.name,
    image: {
      width: entry.width,
      height: entry.height,
    } as HTMLCanvasElement,
    width: entry.width,
    height: entry.height,
    pixels: new Uint8ClampedArray(pixelCount),
    thumbUrl: '',
    ramp2dData: entry.ramp2dData,
  };
}

function normalizeStep(step: PipelineStepEntry): StepModel {
  return {
    id: String(step.id),
    lutId: step.lutId,
    label: step.label,
    muted: step.muted === true,
    blendMode: step.blendMode as BlendMode,
    xParam: step.xParam,
    yParam: step.yParam,
    ops: {
      ...DEFAULT_OPS,
      ...(step.ops ?? {}),
    },
  };
}

export async function loadShaderBuildInputFromArchive(filePath: string): Promise<ShaderBuildInput> {
  const resolvedPath = path.resolve(filePath);
  const bytes = await readFile(resolvedPath);
  const archive = parsePipelineArchive(bytes, PIPELINE_ZIP_FILE_VERSION);
  const customParams = Array.isArray(archive.manifest.customParams)
    ? archive.manifest.customParams.map(param => ({
        id: param.id,
        label: param.label,
        defaultValue: param.defaultValue,
      }))
    : [];

  const input: ShaderBuildInput = {
    steps: archive.manifest.steps.map(normalizeStep),
    luts: archive.manifest.luts.map(createDummyLut),
    customParams,
    materialSettings: {
      ...DEFAULT_MATERIAL_SETTINGS,
      baseColor: [...DEFAULT_MATERIAL_SETTINGS.baseColor],
    },
  };
  assertValidShaderBuildInput(input);
  return input;
}

function createCoverageCustomParams(): CustomParamModel[] {
  return [
    { id: 'userGain', label: 'User Gain', defaultValue: 0.25 },
    { id: 'userBias', label: 'User Bias', defaultValue: 0.75 },
  ];
}

function createCoverageLuts(): LutModel[] {
  const entries: PipelineZipLutEntry[] = [
    { id: 'lut-coverage-a', name: 'Coverage A', filename: 'luts/a.png', width: 8, height: 8 },
    { id: 'lut-coverage-b', name: 'Coverage B', filename: 'luts/b.png', width: 16, height: 4 },
  ];
  return entries.map(createDummyLut);
}

function createCoverageOps(blendMode: BlendMode): StepModel['ops'] {
  switch (blendMode) {
    case 'selfBlend':
      return {
        ...DEFAULT_OPS,
        r: 'replace',
        g: 'add',
        b: 'multiply',
      };
    case 'customRgb':
      return {
        ...DEFAULT_OPS,
        r: 'replace',
        g: 'subtract',
        b: 'multiply',
      };
    case 'customHsv':
      return {
        ...DEFAULT_OPS,
        h: 'replace',
        s: 'add',
        v: 'multiply',
      };
    default:
      return { ...DEFAULT_OPS };
  }
}

export function createShaderCoverageBuildInput(): ShaderBuildInput {
  const customParams = createCoverageCustomParams();
  const luts = createCoverageLuts();
  const lutIds = luts.map(lut => lut.id);
  const params: ParamRef[] = [
    ...BUILTIN_PARAM_NAMES,
    'custom:userGain',
    'custom:userBias',
  ];

  const steps: StepModel[] = BLEND_MODES.map((blendModeDef, index) => ({
    id: `coverage-${blendModeDef.key}`,
    lutId: lutIds[index % lutIds.length],
    label: `Coverage ${blendModeDef.key}`,
    muted: false,
    blendMode: blendModeDef.key,
    xParam: params[(index * 2) % params.length],
    yParam: params[(index * 2 + 1) % params.length],
    ops: createCoverageOps(blendModeDef.key),
  }));

  const input: ShaderBuildInput = {
    steps,
    luts,
    customParams,
    materialSettings: {
      ...DEFAULT_MATERIAL_SETTINGS,
      baseColor: [...DEFAULT_MATERIAL_SETTINGS.baseColor],
    },
  };
  assertValidShaderBuildInput(input);
  return input;
}

export function createShaderCoverageBuildInputWithoutCustomParamRefs(): ShaderBuildInput {
  const input = createShaderCoverageBuildInput();
  input.steps = input.steps.map((step, index) => ({
    ...step,
    xParam: BUILTIN_PARAM_NAMES[index % BUILTIN_PARAM_NAMES.length],
    yParam: BUILTIN_PARAM_NAMES[(index + 1) % BUILTIN_PARAM_NAMES.length],
  }));
  assertValidShaderBuildInput(input);
  return input;
}

export function createShaderBuildInputsPerBlendMode(): ShaderBuildInput[] {
  const base = createShaderCoverageBuildInput();
  return base.steps.map(step => {
    const input: ShaderBuildInput = {
      steps: [{ ...step }],
      luts: base.luts,
      customParams: base.customParams,
      materialSettings: {
        ...base.materialSettings,
        baseColor: [...base.materialSettings.baseColor],
      },
    };
    assertValidShaderBuildInput(input);
    return input;
  });
}

export function generateShaderOutputs(input: ShaderBuildInput): {
  glsl: {
    fragment: string;
    previewFragment: string;
    vertex: string;
  };
  hlsl: {
    fragment: string;
  };
} {
  assertValidShaderBuildInput(input);

  const glslGenerator = getShaderGenerator('glsl');
  const hlslGenerator = getShaderGenerator('hlsl');
  if (!glslGenerator.buildPreviewFragment || !glslGenerator.buildVertex) {
    throw new Error('GLSL generator is missing preview/vertex capabilities.');
  }

  return {
    glsl: {
      fragment: glslGenerator.buildFragment(input),
      previewFragment: glslGenerator.buildPreviewFragment(input),
      vertex: glslGenerator.buildVertex(),
    },
    hlsl: {
      fragment: hlslGenerator.buildFragment(input),
    },
  };
}

export function listShaderBlendModes(): string[] {
  return BLEND_MODES.map(mode => mode.key);
}

export function listShaderBuiltinParams(): string[] {
  return [...BUILTIN_PARAM_NAMES];
}
