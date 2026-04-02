import fs from 'node:fs';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';

const examplesDir = path.resolve('examples');
const expectedFiles = [
  'Metallic.lutchain',
  'HueShiftToon.lutchain',
  'HueSatShiftToon.lutchain',
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function loadManifest(filePath) {
  const archive = unzipSync(new Uint8Array(fs.readFileSync(filePath)));
  assert(archive['pipeline.json'], `${path.basename(filePath)} is missing pipeline.json`);
  const manifest = JSON.parse(strFromU8(archive['pipeline.json']));
  return { archive, manifest };
}

function validateFile(fileName) {
  const filePath = path.join(examplesDir, fileName);
  const { archive, manifest } = loadManifest(filePath);
  assert(manifest.version === 2, `${fileName} must use version 2`);
  assert(Array.isArray(manifest.luts) && manifest.luts.length > 0, `${fileName} must contain LUTs`);
  assert(Array.isArray(manifest.steps), `${fileName} must contain steps`);

  const lutIds = new Set();
  for (const lut of manifest.luts) {
    assert(typeof lut.id === 'string' && lut.id.length > 0, `${fileName} LUT id is invalid`);
    assert(!lutIds.has(lut.id), `${fileName} has duplicate LUT id ${lut.id}`);
    lutIds.add(lut.id);
    assert(typeof lut.filename === 'string' && archive[lut.filename], `${fileName} is missing ${lut.filename}`);
  }

  const stepIds = new Set();
  for (const step of manifest.steps) {
    assert(Number.isInteger(step.id) && step.id > 0, `${fileName} step id is invalid`);
    assert(!stepIds.has(step.id), `${fileName} has duplicate step id ${step.id}`);
    stepIds.add(step.id);
    assert(lutIds.has(step.lutId), `${fileName} step ${step.id} references missing LUT ${step.lutId}`);
    assert(typeof step.blendMode === 'string', `${fileName} step ${step.id} is missing blendMode`);
    assert(typeof step.xParam === 'string', `${fileName} step ${step.id} is missing xParam`);
    assert(typeof step.yParam === 'string', `${fileName} step ${step.id} is missing yParam`);
  }

  return {
    fileName,
    lutCount: manifest.luts.length,
    stepCount: manifest.steps.length,
    blendModes: [...new Set(manifest.steps.map((step) => step.blendMode))].sort(),
  };
}

const summaries = expectedFiles.map(validateFile);
for (const summary of summaries) {
  console.log(
    `${summary.fileName}: ${summary.lutCount} LUTs, ${summary.stepCount} steps, blend modes = ${summary.blendModes.join(', ')}`,
  );
}

