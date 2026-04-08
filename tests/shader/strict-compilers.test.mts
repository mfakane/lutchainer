import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const shaderTest = await import(pathToFileURL(path.join(repoRoot, 'dist', 'test', 'shader-test-helpers.mjs')).href);

async function findExecutable(name: string): Promise<string | null> {
  try {
    const result = await execFileAsync('bash', ['-lc', `command -v ${name}`], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    const resolved = result.stdout.trim();
    return resolved.length > 0 ? resolved : null;
  } catch {
    return null;
  }
}

async function withTempDir(callback: (tempDir: string) => Promise<void>): Promise<void> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'lutchainer-shader-'));
  try {
    await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test('glslangValidator compiles generated GLSL when available', async t => {
  const glslang = await findExecutable('glslangValidator');
  if (!glslang) {
    t.skip('glslangValidator is not installed.');
    return;
  }

  const outputs = shaderTest.generateShaderOutputs(shaderTest.createShaderCoverageBuildInput());
  await withTempDir(async tempDir => {
    const vertexPath = path.join(tempDir, 'coverage.vert');
    const fragmentPath = path.join(tempDir, 'coverage.frag');
    const previewPath = path.join(tempDir, 'coverage-preview.frag');

    await writeFile(vertexPath, outputs.glsl.vertex, 'utf8');
    await writeFile(fragmentPath, outputs.glsl.fragment, 'utf8');
    await writeFile(previewPath, outputs.glsl.previewFragment, 'utf8');

    const compile = async (filePath: string): Promise<void> => {
      await execFileAsync(glslang, ['--glsl-version', '100', filePath], {
        cwd: repoRoot,
        encoding: 'utf8',
      });
    };

    await compile(vertexPath);
    await compile(fragmentPath);
    await compile(previewPath);
  });
});

test('dxc compiles generated HLSL entry points when available', async t => {
  const dxc = await findExecutable('dxc');
  if (!dxc) {
    t.skip('dxc is not installed.');
    return;
  }

  const outputs = shaderTest.generateShaderOutputs(shaderTest.createShaderCoverageBuildInput());
  await withTempDir(async tempDir => {
    const shaderPath = path.join(tempDir, 'coverage.hlsl');
    await writeFile(shaderPath, outputs.hlsl.fragment, 'utf8');

    const run = async (target: string, entryPoint: string): Promise<void> => {
      const result = await execFileAsync(dxc, ['-T', target, '-E', entryPoint, shaderPath], {
        cwd: repoRoot,
        encoding: 'utf8',
      });
      assert.equal(result.stderr.trim(), '', `${entryPoint} emitted unexpected stderr`);
    };

    await run('vs_6_0', 'VSMain');
    await run('ps_6_0', 'PSMain');
  });
});
