import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const shaderTestEntryPath = path.join(repoRoot, 'dist', 'test', 'shader-test.mjs');
const shaderTest = await import(pathToFileURL(shaderTestEntryPath).href);

const exampleNames = [
  'Metallic.lutchain',
  'HueShiftToon.lutchain',
  'HueSatShiftToon.lutchain',
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function tryLoadHeadlessGl() {
  try {
    const mod = await import('gl');
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

function createProgramCompiler(gl) {
  function compileShader(type, source) {
    const shader = gl.createShader(type);
    assert.ok(shader, 'Expected shader object');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    const log = gl.getShaderInfoLog(shader) ?? '';
    assert.equal(ok, true, `Shader compile failed:\n${log}\n--- source ---\n${source}`);
    return shader;
  }

  function linkProgram(vertexSource, fragmentSource) {
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
    compileFragment: source => {
      const fragmentShader = compileShader(gl.FRAGMENT_SHADER, source);
      gl.deleteShader(fragmentShader);
    },
    linkProgram,
  };
}

test('coverage fixture spans every blend mode and built-in parameter', () => {
  const input = shaderTest.createShaderCoverageBuildInput();
  const usedBlendModes = new Set(input.steps.map(step => step.blendMode));
  const usedParams = new Set(input.steps.flatMap(step => [step.xParam, step.yParam]));

  assert.deepEqual([...usedBlendModes].sort(), [...shaderTest.listShaderBlendModes()].sort());
  for (const param of shaderTest.listShaderBuiltinParams()) {
    assert.ok(usedParams.has(param), `Missing builtin parameter coverage for ${param}`);
  }
  assert.ok(usedParams.has('custom:userGain'));
  assert.ok(usedParams.has('custom:userBias'));
});

test('coverage fixture generates GLSL and HLSL with expected entry points and uniforms', () => {
  const outputs = shaderTest.generateShaderOutputs(shaderTest.createShaderCoverageBuildInput());

  assert.match(outputs.glsl.vertex, /attribute vec3 a_position;/);
  assert.match(outputs.glsl.fragment, /uniform sampler2D u_texture;/);
  assert.match(outputs.glsl.fragment, /uniform sampler2D u_lut0;/);
  assert.match(outputs.glsl.fragment, /uniform sampler2D u_lut1;/);
  assert.match(outputs.glsl.previewFragment, /uniform int u_targetStep;/);
  assert.match(outputs.glsl.previewFragment, /gl_FragColor = vec4/);

  assert.match(outputs.hlsl.fragment, /cbuffer SceneUniforms : register\(b0\)/);
  assert.match(outputs.hlsl.fragment, /Texture2D u_texture : register\(t0\);/);
  assert.match(outputs.hlsl.fragment, /Texture2D u_lut0 : register\(t1\);/);
  assert.match(outputs.hlsl.fragment, /Texture2D u_lut1 : register\(t2\);/);
  assert.match(outputs.hlsl.fragment, /SamplerState u_lutSampler : register\(s0\);/);
  assert.match(outputs.hlsl.fragment, /PSInput VSMain\(VSInput input\)/);
  assert.match(outputs.hlsl.fragment, /float4 PSMain\(PSInput input\) : SV_TARGET/);
  assert.match(outputs.hlsl.fragment, /float u_param_userGain;/);
  assert.match(outputs.hlsl.fragment, /float u_param_userBias;/);
});

test('example archives generate shader outputs without missing stages', async () => {
  for (const exampleName of exampleNames) {
    const input = await shaderTest.loadShaderBuildInputFromArchive(path.join(repoRoot, 'examples', exampleName));
    const outputs = shaderTest.generateShaderOutputs(input);

    assert.match(outputs.glsl.fragment, /void main\(\)/, exampleName);
    assert.match(outputs.glsl.vertex, /void main\(\)/, exampleName);
    assert.match(outputs.glsl.previewFragment, /void main\(\)/, exampleName);
    assert.match(outputs.hlsl.fragment, /float4 PSMain\(PSInput input\) : SV_TARGET/, exampleName);
  }
});

test('coverage fixture emits one shader step block per blend mode', () => {
  const outputs = shaderTest.generateShaderOutputs(shaderTest.createShaderCoverageBuildInput());

  for (const blendMode of shaderTest.listShaderBlendModes()) {
    assert.match(
      outputs.glsl.fragment,
      new RegExp(`// \\([^\\n]+\\) -> ${escapeRegExp(blendMode)}`),
      `Missing GLSL comment block for ${blendMode}`,
    );
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
    const extension = gl.getExtension('STACKGL_destroy_context');
    if (extension && typeof extension.destroy === 'function') {
      extension.destroy();
    }
  });

  const compiler = createProgramCompiler(gl);
  const inputs = [
    shaderTest.createShaderCoverageBuildInput(),
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
