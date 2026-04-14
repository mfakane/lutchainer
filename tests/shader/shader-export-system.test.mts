import assert from 'node:assert/strict';
import test from 'node:test';
import { strFromU8, unzipSync } from 'fflate';
import {
  buildShaderExportDownloadFilename,
  serializeShaderExportAsZip,
} from '../../src/features/shader/shader-export-system.ts';
import * as shaderTest from './shader-test-helpers.mts';

function withExportableLutCanvases(input: ReturnType<typeof shaderTest.createShaderCoverageBuildInput>) {
  const pngBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  input.luts = input.luts.map(lut => ({
    ...lut,
    image: {
      width: lut.width,
      height: lut.height,
      toBlob(callback: BlobCallback) {
        callback(new Blob([pngBytes], { type: 'image/png' }));
      },
    } as HTMLCanvasElement,
  }));
  return input;
}

function unzipEntries(bytes: Uint8Array): Record<string, Uint8Array> {
  return unzipSync(bytes);
}

test('GLSL export zip contains only GLSL sources and LUT PNGs', async () => {
  const input = withExportableLutCanvases(shaderTest.createShaderCoverageBuildInput());
  const zipBytes = await serializeShaderExportAsZip(input, 'glsl');
  const entries = unzipEntries(zipBytes);

  assert.deepEqual(
    Object.keys(entries).sort(),
    ['fragment.glsl', 'lut-coverage-a.png', 'lut-coverage-b.png', 'vertex.glsl'],
  );
  assert.match(strFromU8(entries['fragment.glsl']), /gl_FragColor/);
  assert.match(strFromU8(entries['vertex.glsl']), /gl_Position/);
});

test('HLSL export zip contains only HLSL source and LUT PNGs', async () => {
  const input = withExportableLutCanvases(shaderTest.createShaderCoverageBuildInput());
  const zipBytes = await serializeShaderExportAsZip(input, 'hlsl');
  const entries = unzipEntries(zipBytes);

  assert.deepEqual(
    Object.keys(entries).sort(),
    ['lut-coverage-a.png', 'lut-coverage-b.png', 'shader.hlsl'],
  );
  assert.match(strFromU8(entries['shader.hlsl']), /PSMain/);
});

test('MMEffect export zip contains only MMEffect source and LUT PNGs', async () => {
  const input = withExportableLutCanvases(shaderTest.createShaderCoverageBuildInput());
  const zipBytes = await serializeShaderExportAsZip(input, 'mme');
  const entries = unzipEntries(zipBytes);

  assert.deepEqual(
    Object.keys(entries).sort(),
    ['lut-coverage-a.png', 'lut-coverage-b.png', 'shader.fx'],
  );
  assert.match(strFromU8(entries['shader.fx']), /MIKUMIKUMOVING/);
});

test('download filename includes the target language name', () => {
  const now = new Date(Date.UTC(2026, 3, 14, 12, 34, 56));

  assert.equal(
    buildShaderExportDownloadFilename('glsl', now),
    'lutchainer-shader-glsl-20260414-123456.zip',
  );
  assert.equal(
    buildShaderExportDownloadFilename('hlsl', now),
    'lutchainer-shader-hlsl-20260414-123456.zip',
  );
  assert.equal(
    buildShaderExportDownloadFilename('mme', now),
    'lutchainer-shader-mmeffect-20260414-123456.zip',
  );
});
