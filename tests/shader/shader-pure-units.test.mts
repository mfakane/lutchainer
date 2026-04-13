import assert from 'node:assert/strict';
import test from 'node:test';
import type { MaterialSettings } from '../../src/features/pipeline/pipeline-model.ts';
import { DEFAULT_MATERIAL_SETTINGS } from '../../src/features/pipeline/pipeline-model.ts';
import { DEFAULT_OPS, type BlendMode, type BlendModeEmitInput, type CustomParamModel, type ParamRef, type ShaderLocalKey, type StepModel } from '../../src/features/step/step-model.ts';
import {
  buildCustomUniformComments,
  buildCustomUniformDeclarations,
  buildSampleBody,
  collectUsedCustomParams,
} from '../../src/features/shader/shader-generator-utils.ts';
import { emitBlendModeCode, type ShaderLanguageBackend, type ShaderOutputKind } from '../../src/features/shader/shader-language-backend.ts';

function createStep(blendMode: BlendMode, xParam: ParamRef, yParam: ParamRef): StepModel {
  return {
    id: `step-${blendMode}`,
    lutId: 'lut-1',
    muted: false,
    blendMode,
    xParam,
    yParam,
    ops: {
      ...DEFAULT_OPS,
      r: 'replace',
      g: 'add',
      b: 'multiply',
      h: 'replace',
      s: 'add',
      v: 'multiply',
    },
  };
}

const STUB_BACKEND: ShaderLanguageBackend = {
  language: 'glsl',
  displayName: 'Stub',
  sampleType: 'sample',
  colorType: 'Color',
  hsvType: 'Hsv',
  uvType: 'Uv',
  sampleFunctionName: 'sample',
  whiteColor: 'WHITE',
  clampUnit: expression => `clampUnit(${expression})`,
  clampColor: expression => `clampColor(${expression})`,
  lerp: (from, to, alpha) => `lerp(${from}, ${to}, ${alpha})`,
  hsvFromColor: expression => `hsvFrom(${expression})`,
  hsvToColor: expression => `hsvTo(${expression})`,
  getParamExpr: (param: ParamRef) => `param(${param})`,
  emitLocalDeclaration: (key: ShaderLocalKey, outputKind: ShaderOutputKind, material?: MaterialSettings): readonly string[] => {
    void outputKind;
    void material;
    return [`local(${key})`];
  },
};

const EMIT_INPUT: BlendModeEmitInput = {
  lutColorVar: 'lutColor',
  lutAlphaVar: 'lutAlpha',
  targetColorVar: 'targetColor',
  hsvCurVar: 'hsvCur',
  hsvLutVar: 'hsvLut',
  ops: {
    ...DEFAULT_OPS,
    r: 'replace',
    g: 'add',
    b: 'multiply',
    h: 'replace',
    s: 'add',
    v: 'multiply',
  },
};

test('buildSampleBody returns fallback for zero LUTs and branches for multiple LUTs', () => {
  assert.equal(buildSampleBody([], 'fallback()', index => `sample(${index})`), 'return fallback();');
  assert.equal(buildSampleBody([{ id: 'lut-1' } as never], 'fallback()', index => `sample(${index})`), 'if (lutIndex == 0) return sample(0);\n  return sample(0);');
  assert.match(buildSampleBody([{ id: 'a' } as never, { id: 'b' } as never], 'fallback()', index => `sample(${index})`), /else if \(lutIndex == 1\) return sample\(1\);/);
});

test('collectUsedCustomParams keeps used params once and ignores unused ones', () => {
  const customParams: CustomParamModel[] = [
    { id: 'gain', label: 'Gain', defaultValue: 0.5 },
    { id: 'bias', label: 'Bias', defaultValue: 0.25 },
    { id: 'unused', label: 'Unused', defaultValue: 0.0 },
  ];
  const used = collectUsedCustomParams([
    createStep('replace', 'custom:gain', 'g'),
    createStep('add', 'custom:bias', 'custom:gain'),
  ], customParams);

  assert.deepEqual(used.map(param => param.id), ['gain', 'bias']);
});

test('custom uniform helpers only mention the params they receive', () => {
  const customParams: CustomParamModel[] = [
    { id: 'gain', label: 'Gain', defaultValue: 0.5 },
    { id: 'bias', label: 'Bias', defaultValue: 0.25 },
  ];

  assert.match(buildCustomUniformDeclarations(customParams), /u_param_gain/);
  assert.match(buildCustomUniformDeclarations(customParams), /u_param_bias/);
  assert.match(buildCustomUniformComments(customParams), /Custom Params/);
  assert.match(buildCustomUniformComments(customParams), /Gain \(gain\) => u_param_gain/);
  assert.equal(buildCustomUniformComments([]), '');
});

test('emitBlendModeCode preserves each blend mode semantic shape', () => {
  assert.deepEqual(emitBlendModeCode(STUB_BACKEND, 'none', EMIT_INPUT), []);

  const replaceLines = emitBlendModeCode(STUB_BACKEND, 'replace', EMIT_INPUT);
  assert.ok(replaceLines.some(line => line.includes('targetColor')));
  assert.ok(replaceLines.some(line => line.includes('lerp(color, targetColor')));

  const multiplyLines = emitBlendModeCode(STUB_BACKEND, 'multiply', EMIT_INPUT);
  assert.ok(multiplyLines.some(line => line.includes('WHITE')));

  const hueLines = emitBlendModeCode(STUB_BACKEND, 'hue', EMIT_INPUT);
  assert.ok(hueLines.some(line => line.includes('hsvFrom(color)')));
  assert.ok(hueLines.some(line => line.includes('hsvCur.x = hsvLut.x')));

  const customRgbLines = emitBlendModeCode(STUB_BACKEND, 'customRgb', EMIT_INPUT);
  assert.ok(customRgbLines.some(line => line.includes('targetColor.r = lutColor.r')));
  assert.ok(customRgbLines.some(line => line.includes('targetColor.g = (targetColor.g + lutColor.g)')));
  assert.ok(customRgbLines.some(line => line.includes('targetColor.b = (targetColor.b * lutColor.b)')));

  const customHsvLines = emitBlendModeCode(STUB_BACKEND, 'customHsv', EMIT_INPUT);
  assert.ok(customHsvLines.some(line => line.includes('hsvCur.x = hsvLut.x')));
  assert.ok(customHsvLines.some(line => line.includes('hsvCur.y = (hsvCur.y + hsvLut.y)')));
  assert.ok(customHsvLines.some(line => line.includes('hsvCur.z = (hsvCur.z * hsvLut.z)')));
  assert.ok(customHsvLines.some(line => line.includes('hsvTo(hsvCur)')));

  const selfBlendLines = emitBlendModeCode(STUB_BACKEND, 'selfBlend', EMIT_INPUT);
  assert.ok(selfBlendLines.some(line => line.includes('targetColor = color')));
  assert.ok(selfBlendLines.some(line => line.includes('lerp(targetColor.r, targetColor.r')));
});

test('material defaults remain valid test inputs for shader helpers', () => {
  assert.equal(Array.isArray(DEFAULT_MATERIAL_SETTINGS.baseColor), true);
  assert.equal(DEFAULT_MATERIAL_SETTINGS.baseColor.length, 3);
});
