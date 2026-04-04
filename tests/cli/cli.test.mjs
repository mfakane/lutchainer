import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const cliEntry = path.join(repoRoot, 'dist', 'cli', 'main.mjs');
const examplesDir = path.join(repoRoot, 'examples');

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

async function runCli(args, options = {}) {
  const captureDir = await mkdtemp(path.join(os.tmpdir(), 'lutchainer-cli-capture-'));
  const stdoutPath = path.join(captureDir, 'stdout.txt');
  const stderrPath = path.join(captureDir, 'stderr.txt');
  const command = [
    'node',
    shellEscape(cliEntry),
    ...args.map(shellEscape),
    `>${shellEscape(stdoutPath)}`,
    `2>${shellEscape(stderrPath)}`,
  ].join(' ');

  try {
    await execFileAsync('bash', ['-lc', command], {
      cwd: repoRoot,
      encoding: 'utf8',
      ...options,
    });
    return {
      exitCode: 0,
      stdout: await readFile(stdoutPath, 'utf8'),
      stderr: await readFile(stderrPath, 'utf8'),
    };
  } catch (error) {
    return {
      exitCode: error.code ?? 1,
      stdout: await readFile(stdoutPath, 'utf8').catch(() => ''),
      stderr: await readFile(stderrPath, 'utf8').catch(() => ''),
    };
  } finally {
    await rm(captureDir, { recursive: true, force: true });
  }
}

function examplePath(fileName) {
  return path.join(examplesDir, fileName);
}

test('root help prints usage and exits successfully', async () => {
  const result = await runCli(['--help']);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /^Usage:/m);
  assert.match(result.stdout, /lutchainer lut extract <lut-id> <file\.lutchain> --out <png-path>/);
});

test('unknown command prints usage to stderr and fails', async () => {
  const result = await runCli(['nope']);
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^Usage:/m);
});

test('info prints summary and json', async () => {
  const textResult = await runCli(['info', examplePath('Metallic.lutchain')]);
  assert.equal(textResult.exitCode, 0);
  assert.match(textResult.stdout, /Version:\s+2/);
  assert.match(textResult.stdout, /LUT-Count:\s+2/);
  assert.match(textResult.stdout, /Step-Count:\s+2/);

  const jsonResult = await runCli(['info', '--json', examplePath('Metallic.lutchain')]);
  assert.equal(jsonResult.exitCode, 0);
  const payload = JSON.parse(jsonResult.stdout);
  assert.equal(payload.version, 2);
  assert.equal(payload.lutCount, 2);
  assert.equal(payload.stepCount, 2);
});

test('validate reports valid archives in text and json modes', async () => {
  const textResult = await runCli(['validate', examplePath('Metallic.lutchain')]);
  assert.equal(textResult.exitCode, 0);
  assert.equal(textResult.stdout.trim(), 'VALID');

  const jsonResult = await runCli(['validate', '--json', examplePath('Metallic.lutchain')]);
  assert.equal(jsonResult.exitCode, 0);
  const payload = JSON.parse(jsonResult.stdout);
  assert.deepEqual(payload, { valid: true, errors: [] });
});

test('lut list prints a table and json array', async () => {
  const textResult = await runCli(['lut', 'list', examplePath('Metallic.lutchain')]);
  assert.equal(textResult.exitCode, 0);
  assert.match(textResult.stdout, /^ID\s+NAME\s+SIZE\s+FILE/m);
  assert.match(textResult.stdout, /Diffuse Add/);

  const jsonResult = await runCli(['lut', 'list', '--json', examplePath('Metallic.lutchain')]);
  assert.equal(jsonResult.exitCode, 0);
  const payload = JSON.parse(jsonResult.stdout);
  assert.equal(Array.isArray(payload), true);
  assert.equal(payload[0].id, 'lut-mnbmnzez-ubmppr');
  assert.equal(payload[0].filename, 'luts/lut-mnbmnzez-ubmppr.png');
});

test('lut show resolves by id and by name', async () => {
  const byId = await runCli(['lut', 'show', 'lut-mn25faeb-zjgdzm', examplePath('HueShiftToon.lutchain')]);
  assert.equal(byId.exitCode, 0);
  assert.match(byId.stdout, /Name:\s+Hue Shift/);
  assert.match(byId.stdout, /Ramp-Count:\s+2/);

  const byName = await runCli(['lut', 'show', '-n', 'Hue Shift', examplePath('HueShiftToon.lutchain')]);
  assert.equal(byName.exitCode, 0);
  assert.match(byName.stdout, /ID:\s+lut-mn25faeb-zjgdzm/);

  const asJson = await runCli(['lut', 'show', '--json', 'lut-mn25faeb-zjgdzm', examplePath('HueShiftToon.lutchain')]);
  assert.equal(asJson.exitCode, 0);
  const payload = JSON.parse(asJson.stdout);
  assert.equal(payload.id, 'lut-mn25faeb-zjgdzm');
  assert.equal(payload.name, 'Hue Shift');
});

test('step list prints a table and json array', async () => {
  const textResult = await runCli(['step', 'list', examplePath('HueShiftToon.lutchain')]);
  assert.equal(textResult.exitCode, 0);
  assert.match(textResult.stdout, /^ID\s+LABEL\s+LUT\s+BLEND\s+X\s+Y\s+MUTED/m);
  assert.match(textResult.stdout, /Hue Shift/);

  const jsonResult = await runCli(['step', 'list', '--json', examplePath('HueShiftToon.lutchain')]);
  assert.equal(jsonResult.exitCode, 0);
  const payload = JSON.parse(jsonResult.stdout);
  assert.equal(Array.isArray(payload), true);
  assert.equal(payload[0].id, 1);
  assert.equal(payload[0].lutId, 'lut-mn25faeb-zjgdzm');
});

test('step show prints a summary and json object', async () => {
  const textResult = await runCli(['step', 'show', '1', examplePath('HueShiftToon.lutchain')]);
  assert.equal(textResult.exitCode, 0);
  assert.match(textResult.stdout, /Label:\s+Hue Shift/);
  assert.match(textResult.stdout, /Blend:\s+hue/);

  const jsonResult = await runCli(['step', 'show', '--json', '1', examplePath('HueShiftToon.lutchain')]);
  assert.equal(jsonResult.exitCode, 0);
  const payload = JSON.parse(jsonResult.stdout);
  assert.equal(payload.id, 1);
  assert.equal(payload.label, 'Hue Shift');
});

test('pipeline cat outputs parseable manifest json', async () => {
  const result = await runCli(['pipeline', 'cat', examplePath('Metallic.lutchain')]);
  assert.equal(result.exitCode, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.version, 2);
  assert.equal(Array.isArray(payload.luts), true);
  assert.equal(Array.isArray(payload.steps), true);
});

test('lut extract writes a single png by id and by name', async t => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'lutchainer-cli-single-'));
  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const idTarget = path.join(tempDir, 'by-id.png');
  const idResult = await runCli([
    'lut', 'extract', 'lut-mn25faeb-zjgdzm', examplePath('HueShiftToon.lutchain'), '--out', idTarget,
  ]);
  assert.equal(idResult.exitCode, 0);
  assert.match(idResult.stdout, /by-id\.png/);
  const idStat = await stat(idTarget);
  assert.ok(idStat.size > 0);

  const nameTarget = path.join(tempDir, 'by-name.png');
  const nameResult = await runCli([
    'lut', 'extract', '-n', 'Hue Shift', examplePath('HueShiftToon.lutchain'), '--out', nameTarget,
  ]);
  assert.equal(nameResult.exitCode, 0);
  const nameStat = await stat(nameTarget);
  assert.ok(nameStat.size > 0);
});

test('lut extract --all writes one png per lut', async t => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'lutchainer-cli-all-'));
  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const result = await runCli([
    'lut', 'extract', '--all', examplePath('HueShiftToon.lutchain'), '--out-dir', tempDir,
  ]);
  assert.equal(result.exitCode, 0);
  const files = result.stdout.trim().split('\n').filter(Boolean);
  assert.equal(files.length, 5);
  for (const file of files) {
    const fileStat = await stat(file);
    assert.ok(fileStat.size > 0);
  }
});

test('extract refuses to overwrite an existing file', async t => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'lutchainer-cli-overwrite-'));
  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const target = path.join(tempDir, 'existing.png');
  await writeFile(target, 'already here');
  const result = await runCli([
    'lut', 'extract', 'lut-mn25faeb-zjgdzm', examplePath('HueShiftToon.lutchain'), '--out', target,
  ]);
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /Refusing to overwrite existing file/);
});

test('commands fail on invalid input paths and missing ids', async () => {
  const badPath = path.join(repoRoot, 'package.json');

  const badExtension = await runCli(['info', badPath]);
  assert.equal(badExtension.exitCode, 1);
  assert.match(badExtension.stderr, /Expected a \.lutchain file path/);

  const missingLut = await runCli(['lut', 'show', 'missing-lut', examplePath('HueShiftToon.lutchain')]);
  assert.equal(missingLut.exitCode, 1);
  assert.match(missingLut.stderr, /LUT not found: missing-lut/);

  const missingStep = await runCli(['step', 'show', '999', examplePath('HueShiftToon.lutchain')]);
  assert.equal(missingStep.exitCode, 1);
  assert.match(missingStep.stderr, /Step not found: 999/);
});

test('extract validates argument combinations', async () => {
  const missingOut = await runCli(['lut', 'extract', 'lut-mn25faeb-zjgdzm', examplePath('HueShiftToon.lutchain')]);
  assert.equal(missingOut.exitCode, 1);
  assert.match(missingOut.stderr, /requires a LUT id, a \.lutchain file path, and --out/);

  const invalidCombo = await runCli([
    'lut', 'extract', '--all', '-n', 'Hue Shift', examplePath('HueShiftToon.lutchain'), '--out-dir', '/tmp/whatever',
  ]);
  assert.equal(invalidCombo.exitCode, 1);
  assert.match(invalidCombo.stderr, /does not allow --all and -n together/);
});
