import assert from 'node:assert/strict';
import test from 'node:test';
import { createPipelineApplyController } from '../../../src/app/browser/pipeline/pipeline-apply.ts';
import { DEFAULT_MATERIAL_SETTINGS } from '../../../src/features/pipeline/pipeline-model.ts';
import type { ShaderBuildInput } from '../../../src/features/shader/shader-generator.ts';
import { createTestLut, createTestStep } from '../../fixtures/step-test-fixtures.mts';

interface CompileResult {
  success: boolean;
  errors: Array<{ type: string; message: string }>;
}

interface RendererStub {
  setLutTextures: () => string | null;
  compileProgram: (vertex: string, fragment: string) => CompileResult;
}

function createShaderBuildInput(): ShaderBuildInput {
  return {
    steps: [createTestStep('step-1')],
    luts: [createTestLut()],
    customParams: [],
    materialSettings: DEFAULT_MATERIAL_SETTINGS,
  };
}

function createRendererStub(options?: {
  lutError?: string | null;
  compileResult?: CompileResult;
}): {
  renderer: RendererStub;
  getLastFragmentShader: () => string | null;
} {
  let lastFragmentShader: string | null = null;

  return {
    renderer: {
      setLutTextures: () => options?.lutError ?? null,
      compileProgram: (_vertex: string, fragment: string) => {
        lastFragmentShader = fragment;
        return options?.compileResult ?? { success: true, errors: [] };
      },
    },
    getLastFragmentShader: () => lastFragmentShader,
  };
}

test('pipeline apply does not report status on compile success', () => {
  const statusCalls: Array<{ message: string; kind: string }> = [];
  const { renderer, getLastFragmentShader } = createRendererStub();

  const controller = createPipelineApplyController({
    getShaderBuildInput: createShaderBuildInput,
    renderer: renderer as never,
    onUpdateShaderCodePanel: () => undefined,
    onStatus: (message, kind) => {
      statusCalls.push({ message, kind });
    },
  });

  controller.applyNow();

  assert.equal(statusCalls.length, 0);
  assert.notEqual(getLastFragmentShader(), null);
});

test('pipeline apply reports compile errors', () => {
  const statusCalls: Array<{ message: string; kind: string }> = [];
  const { renderer } = createRendererStub({
    compileResult: {
      success: false,
      errors: [
        {
          type: 'fragment',
          message: 'unexpected token',
        },
      ],
    },
  });

  const controller = createPipelineApplyController({
    getShaderBuildInput: createShaderBuildInput,
    renderer: renderer as never,
    onUpdateShaderCodePanel: () => undefined,
    onStatus: (message, kind) => {
      statusCalls.push({ message, kind });
    },
  });

  controller.applyNow();

  assert.equal(statusCalls.length, 1);
  assert.equal(statusCalls[0]?.kind, 'error');
  assert.match(statusCalls[0]?.message ?? '', /\[FRAGMENT\]/);
  assert.match(statusCalls[0]?.message ?? '', /unexpected token/);
});

test('pipeline apply reports LUT upload errors', () => {
  const statusCalls: Array<{ message: string; kind: string }> = [];
  const { renderer } = createRendererStub({
    lutError: 'failed to upload LUT',
  });

  const controller = createPipelineApplyController({
    getShaderBuildInput: createShaderBuildInput,
    renderer: renderer as never,
    onUpdateShaderCodePanel: () => undefined,
    onStatus: (message, kind) => {
      statusCalls.push({ message, kind });
    },
  });

  controller.applyNow();

  assert.deepEqual(statusCalls, [
    {
      message: 'failed to upload LUT',
      kind: 'error',
    },
  ]);
});

test('pipeline apply schedules automatically without an auto-apply flag', async () => {
  const statusCalls: Array<{ message: string; kind: string }> = [];
  const { renderer } = createRendererStub();
  let compileCalls = 0;

  renderer.compileProgram = (_vertex: string, _fragment: string) => {
    compileCalls += 1;
    return { success: true, errors: [] };
  };

  const controller = createPipelineApplyController({
    getShaderBuildInput: createShaderBuildInput,
    renderer: renderer as never,
    onUpdateShaderCodePanel: () => undefined,
    onStatus: (message, kind) => {
      statusCalls.push({ message, kind });
    },
    autoApplyDelayMs: 5,
  });

  controller.scheduleApply();
  await new Promise(resolve => setTimeout(resolve, 20));

  assert.equal(compileCalls, 1);
  assert.equal(statusCalls.length, 0);
});
