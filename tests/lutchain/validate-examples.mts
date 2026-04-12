import { strFromU8, unzipSync } from 'fflate';
import fs from 'node:fs';
import path from 'node:path';

const examplesDir = path.resolve('examples');
const expectedFiles = [
  'StandardToon.lutchain',
  'HueShiftToon.lutchain',
  'HueSatShiftToon.lutchain',
  'Gradient.lutchain',
  'Plastic.lutchain',
  'Metallic.lutchain',
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function loadManifest(filePath: string) {
  const archive = unzipSync(new Uint8Array(fs.readFileSync(filePath)));
  assert(archive['pipeline.json'], `${path.basename(filePath)} is missing pipeline.json`);
  const manifest = JSON.parse(strFromU8(archive['pipeline.json'])) as {
    version: number;
    luts: Array<{ id: string; filename: string }>;
    steps: Array<{ id: string | number; lutId: string; blendMode: string; xParam: string; yParam: string }>;
  };
  return { archive, manifest };
}

function validateFile(fileName: string) {
  const filePath = path.join(examplesDir, fileName);
  const { archive, manifest } = loadManifest(filePath);
  assert(manifest.version === 2, `${fileName} must use version 2`);
  assert(Array.isArray(manifest.luts) && manifest.luts.length > 0, `${fileName} must contain LUTs`);
  assert(Array.isArray(manifest.steps), `${fileName} must contain steps`);

  const lutIds = new Set<string>();
  for (const lut of manifest.luts) {
    assert(typeof lut.id === 'string' && lut.id.length > 0, `${fileName} LUT id is invalid`);
    assert(!lutIds.has(lut.id), `${fileName} has duplicate LUT id ${lut.id}`);
    lutIds.add(lut.id);
    assert(typeof lut.filename === 'string' && archive[lut.filename], `${fileName} is missing ${lut.filename}`);
  }

  const stepIds = new Set<string>();
  for (const step of manifest.steps) {
    const stepId = typeof step.id === 'number' ? String(step.id) : step.id;
    assert(typeof stepId === 'string' && stepId.length > 0, `${fileName} step id is invalid`);
    assert(!stepIds.has(stepId), `${fileName} has duplicate step id ${stepId}`);
    stepIds.add(stepId);
    assert(lutIds.has(step.lutId), `${fileName} step ${step.id} references missing LUT ${step.lutId}`);
    assert(typeof step.blendMode === 'string', `${fileName} step ${step.id} is missing blendMode`);
    assert(typeof step.xParam === 'string', `${fileName} step ${step.id} is missing xParam`);
    assert(typeof step.yParam === 'string', `${fileName} step ${step.id} is missing yParam`);
  }

  return {
    fileName,
    lutCount: manifest.luts.length,
    stepCount: manifest.steps.length,
    blendModes: [...new Set(manifest.steps.map(step => step.blendMode))].sort(),
  };
}

const summaries = expectedFiles.map(validateFile);
for (const summary of summaries) {
  console.log(
    `${summary.fileName}: ${summary.lutCount} LUTs, ${summary.stepCount} steps, blend modes = ${summary.blendModes.join(', ')}`,
  );
}
