import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { getShaderGenerator, listShaderGenerators } from '../../src/features/shader/shader-generator.ts';
import * as shaderTest from './shader-test-helpers.mts';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

const exampleNames = [
  'Metallic.lutchain',
  'HueShiftToon.lutchain',
  'HueSatShiftToon.lutchain',
  'StandardToon.lutchain',
];

async function tryLoadHeadlessGl(): Promise<((width: number, height: number, options?: object) => WebGLRenderingContext | null) | null> {
  try {
    const mod = await import('gl');
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

function createProgramCompiler(gl: WebGLRenderingContext) {
  function compileShader(type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    assert.ok(shader, 'Expected shader object');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    const log = gl.getShaderInfoLog(shader) ?? '';
    assert.equal(ok, true, `Shader compile failed:\n${log}\n--- source ---\n${source}`);
    return shader;
  }

  function linkProgram(vertexSource: string, fragmentSource: string): void {
    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    assert.ok(program, 'Expected program object');
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const ok = gl.getProgramParameter(program, gl.LINK_STATUS);
    const log = gl.getProgramInfoLog(program) ?? '';
    assert.equal(ok, true, `Program link failed:\n${log}`);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
  }

  return {
    compileFragment(source: string): void {
      const fragmentShader = compileShader(gl.FRAGMENT_SHADER, source);
      gl.deleteShader(fragmentShader);
    },
    linkProgram,
  };
}

test('shader generator capabilities match the exported build functions', () => {
  for (const generator of listShaderGenerators()) {
    assert.equal(typeof generator.buildFragment, 'function');
    assert.equal(generator.capabilities.fragment, true);
    assert.equal(Boolean(generator.buildPreviewFragment), generator.capabilities.previewFragment);
    assert.equal(Boolean(generator.buildVertex), generator.capabilities.vertex);
    assert.equal(getShaderGenerator(generator.language), generator);
  }
});

test('generated shaders include custom parameter uniforms only when they are used', () => {
  const outputsWithCustomParams = shaderTest.generateShaderOutputs(shaderTest.createShaderCoverageBuildInput());
  assert.match(outputsWithCustomParams.glsl.fragment, /u_param_userGain/);
  assert.match(outputsWithCustomParams.hlsl.fragment, /u_param_userGain/);

  const inputWithoutCustomParams = shaderTest.createShaderCoverageBuildInputWithoutCustomParamRefs();
  const outputsWithoutCustomParams = shaderTest.generateShaderOutputs(inputWithoutCustomParams);
  assert.doesNotMatch(outputsWithoutCustomParams.glsl.fragment, /u_param_userGain/);
  assert.doesNotMatch(outputsWithoutCustomParams.glsl.fragment, /u_param_userBias/);
  assert.doesNotMatch(outputsWithoutCustomParams.hlsl.fragment, /u_param_userGain/);
  assert.doesNotMatch(outputsWithoutCustomParams.hlsl.fragment, /u_param_userBias/);
});

test('example archives generate shader outputs for every supported language entry point', async () => {
  for (const exampleName of exampleNames) {
    const input = await shaderTest.loadShaderBuildInputFromArchive(path.join(repoRoot, 'examples', exampleName));
    const outputs = shaderTest.generateShaderOutputs(input);

    assert.ok(outputs.glsl.vertex.length > 0, `${exampleName}: missing GLSL vertex shader`);
    assert.ok(outputs.glsl.fragment.length > 0, `${exampleName}: missing GLSL fragment shader`);
    assert.ok(outputs.glsl.previewFragment.length > 0, `${exampleName}: missing GLSL preview fragment shader`);
    assert.ok(outputs.hlsl.fragment.length > 0, `${exampleName}: missing HLSL fragment shader`);
  }
});

test('generated GLSL compiles with headless-gl when available', async t => {
  const createGl = await tryLoadHeadlessGl();
  if (!createGl) {
    t.skip('Optional dependency `gl` is not installed.');
    return;
  }

  const gl = createGl(32, 32, { preserveDrawingBuffer: true });
  if (!gl) {
    t.skip('headless-gl could not create a WebGL context.');
    return;
  }

  t.after(() => {
    const extension = gl.getExtension('STACKGL_destroy_context') as { destroy?: () => void } | null;
    if (extension && typeof extension.destroy === 'function') {
      extension.destroy();
    }
  });

  const compiler = createProgramCompiler(gl);
  const inputs = [
    shaderTest.createShaderCoverageBuildInput(),
    ...shaderTest.createShaderBuildInputsPerBlendMode(),
    ...await Promise.all(
      exampleNames.map(exampleName =>
        shaderTest.loadShaderBuildInputFromArchive(path.join(repoRoot, 'examples', exampleName))),
    ),
  ];

  for (const input of inputs) {
    const outputs = shaderTest.generateShaderOutputs(input);
    compiler.linkProgram(outputs.glsl.vertex, outputs.glsl.fragment);
    compiler.compileFragment(outputs.glsl.previewFragment);
  }
});
