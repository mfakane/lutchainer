import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { runCliWithIo } from '../../src/app/cli/cli-command-router.ts';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const cliEntry = path.join(repoRoot, 'dist', 'cli', 'main.mjs');
const examplesDir = path.join(repoRoot, 'examples');

function examplePath(fileName: string): string {
  return path.join(examplesDir, fileName);
}

async function runCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';
  const exitCode = await runCliWithIo(args, {
    stdout(text: string): void {
      stdout += text;
    },
    stderr(text: string): void {
      stderr += text;
    },
  });
  return { exitCode, stdout, stderr };
}

async function runCliE2e(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync('node', [cliEntry, ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    const execError = error as { code?: number; stdout?: string; stderr?: string };
    return {
      exitCode: execError.code ?? 1,
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
    };
  }
}

test('root help prints usage and exits successfully', async () => {
  const result = await runCli(['--help']);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /^Usage:/m);
  assert.match(result.stdout, /lutchainer <command> \[<args>\]/);
  assert.match(result.stdout, /Commands:/);
  assert.equal(result.stderr, '');
});

test('unknown command prints usage to stderr and fails', async () => {
  const result = await runCli(['nope']);
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /lutchainer <command> \[<args>\]/);
});

test('group help prints subcommand summaries', async () => {
  const lutHelp = await runCli(['lut', '--help']);
  assert.equal(lutHelp.exitCode, 0);
  assert.match(lutHelp.stdout, /lutchainer lut <subcommand> \[<args>\]/);
  assert.match(lutHelp.stdout, /show\s+Show one LUT by id or -n <name>/);

  const stepHelp = await runCli(['step', '--help']);
  assert.equal(stepHelp.exitCode, 0);
  assert.match(stepHelp.stdout, /lutchainer step <subcommand> \[<args>\]/);
  assert.match(stepHelp.stdout, /show\s+Show one step by id/);

  const pipelineHelp = await runCli(['pipeline', '--help']);
  assert.equal(pipelineHelp.exitCode, 0);
  assert.match(pipelineHelp.stdout, /lutchainer pipeline <subcommand> \[<args>\]/);
  assert.match(pipelineHelp.stdout, /cat\s+Print pipeline\.json contents/);
});

test('unknown group subcommands print group usage to stderr and fail', async () => {
  const lutResult = await runCli(['lut', 'nope']);
  assert.equal(lutResult.exitCode, 1);
  assert.match(lutResult.stderr, /lutchainer lut <subcommand> \[<args>\]/);

  const stepResult = await runCli(['step', 'nope']);
  assert.equal(stepResult.exitCode, 1);
  assert.match(stepResult.stderr, /lutchainer step <subcommand> \[<args>\]/);

  const pipelineResult = await runCli(['pipeline', 'nope']);
  assert.equal(pipelineResult.exitCode, 1);
  assert.match(pipelineResult.stderr, /lutchainer pipeline <subcommand> \[<args>\]/);
});

test('info prints summary and json', async () => {
  const textResult = await runCli(['info', examplePath('Metallic.lutchain')]);
  assert.equal(textResult.exitCode, 0);
  assert.match(textResult.stdout, /Version:\s+2/);
  assert.match(textResult.stdout, /LUT-Count:\s+2/);
  assert.match(textResult.stdout, /Step-Count:\s+2/);

  const jsonResult = await runCli(['info', '--json', examplePath('Metallic.lutchain')]);
  assert.equal(jsonResult.exitCode, 0);
  const payload = JSON.parse(jsonResult.stdout) as { version: number; lutCount: number; stepCount: number; blendModes: string[] };
  assert.equal(payload.version, 2);
  assert.equal(payload.lutCount, 2);
  assert.equal(payload.stepCount, 2);
  assert.ok(payload.blendModes.includes('add'));
});

test('validate reports valid archives in text and json modes', async () => {
  const textResult = await runCli(['validate', examplePath('Metallic.lutchain')]);
  assert.equal(textResult.exitCode, 0);
  assert.equal(textResult.stdout.trim(), 'VALID');

  const jsonResult = await runCli(['validate', '--json', examplePath('Metallic.lutchain')]);
  assert.equal(jsonResult.exitCode, 0);
  const payload = JSON.parse(jsonResult.stdout) as { valid: boolean; errors: string[] };
  assert.deepEqual(payload, { valid: true, errors: [] });
});

test('version prints the CLI commit id and exits successfully', async () => {
  const result = await runCli(['version']);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout.trim(), /^[a-z0-9]+$/);
  assert.equal(result.stderr, '');
});

test('lut list prints a table and json array', async () => {
  const textResult = await runCli(['lut', 'list', examplePath('Metallic.lutchain')]);
  assert.equal(textResult.exitCode, 0);
  assert.match(textResult.stdout, /^ID\s+NAME\s+SIZE\s+FILE/m);
  assert.match(textResult.stdout, /Diffuse Add/);

  const jsonResult = await runCli(['lut', 'list', '--json', examplePath('Metallic.lutchain')]);
  assert.equal(jsonResult.exitCode, 0);
  const payload = JSON.parse(jsonResult.stdout) as Array<{ id: string; name: string; filename: string }>;
  assert.ok(payload.some(entry => entry.name === 'Diffuse Add'));
  assert.ok(payload.some(entry => entry.filename.endsWith('.png')));
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
  const payload = JSON.parse(asJson.stdout) as { id: string; name: string; ramp2dData?: { ramps: unknown[] } };
  assert.equal(payload.id, 'lut-mn25faeb-zjgdzm');
  assert.equal(payload.name, 'Hue Shift');
  assert.equal(payload.ramp2dData?.ramps.length, 2);
});

test('step list prints a table and json array', async () => {
  const textResult = await runCli(['step', 'list', examplePath('HueShiftToon.lutchain')]);
  assert.equal(textResult.exitCode, 0);
  assert.match(textResult.stdout, /^ID\s+LABEL\s+LUT\s+BLEND\s+X\s+Y\s+MUTED/m);
  assert.match(textResult.stdout, /Hue Shift/);

  const jsonResult = await runCli(['step', 'list', '--json', examplePath('HueShiftToon.lutchain')]);
  assert.equal(jsonResult.exitCode, 0);
  const payload = JSON.parse(jsonResult.stdout) as Array<{ id: number; lutId: string; blendMode: string; label?: string }>;
  const step = payload.find(entry => entry.id === 1);
  assert.ok(step);
  assert.equal(step.lutId, 'lut-mn25faeb-zjgdzm');
  assert.equal(step.blendMode, 'hue');
  assert.equal(step.label, 'Hue Shift');
});

test('step show prints a summary and json object', async () => {
  const textResult = await runCli(['step', 'show', '1', examplePath('HueShiftToon.lutchain')]);
  assert.equal(textResult.exitCode, 0);
  assert.match(textResult.stdout, /Label:\s+Hue Shift/);
  assert.match(textResult.stdout, /Blend:\s+hue/);

  const jsonResult = await runCli(['step', 'show', '--json', '1', examplePath('HueShiftToon.lutchain')]);
  assert.equal(jsonResult.exitCode, 0);
  const payload = JSON.parse(jsonResult.stdout) as { id: number; label: string; blendMode: string };
  assert.equal(payload.id, 1);
  assert.equal(payload.label, 'Hue Shift');
  assert.equal(payload.blendMode, 'hue');
});

test('pipeline cat outputs parseable manifest json', async () => {
  const result = await runCli(['pipeline', 'cat', examplePath('Metallic.lutchain')]);
  assert.equal(result.exitCode, 0);
  const payload = JSON.parse(result.stdout) as { version: number; luts: unknown[]; steps: unknown[] };
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

test('lut extract --all writes one png per lut in the archive', async t => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'lutchainer-cli-all-'));
  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const listResult = await runCli(['lut', 'list', '--json', examplePath('HueShiftToon.lutchain')]);
  assert.equal(listResult.exitCode, 0);
  const luts = JSON.parse(listResult.stdout) as Array<{ id: string }>;

  const extractResult = await runCli([
    'lut', 'extract', '--all', examplePath('HueShiftToon.lutchain'), '--out-dir', tempDir,
  ]);
  assert.equal(extractResult.exitCode, 0);
  const files = extractResult.stdout.trim().split('\n').filter(Boolean);
  assert.equal(files.length, luts.length);
  for (const file of files) {
    const fileStat = await stat(file);
    assert.ok(fileStat.size > 0);
  }
});

test('validate rejects malformed archives', async t => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'lutchainer-cli-invalid-'));
  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const invalidPath = path.join(tempDir, 'invalid.lutchain');
  await writeFile(invalidPath, 'not a zip', 'utf8');

  const textResult = await runCli(['validate', invalidPath]);
  assert.equal(textResult.exitCode, 1);
  assert.equal(textResult.stderr, '');
  assert.match(textResult.stdout, /INVALID/);
  assert.match(textResult.stdout, /invalid zip data/);

  const jsonResult = await runCli(['validate', '--json', invalidPath]);
  assert.equal(jsonResult.exitCode, 1);
  const payload = JSON.parse(jsonResult.stdout) as { valid: boolean; errors: string[] };
  assert.equal(payload.valid, false);
  assert.ok(payload.errors.length > 0);
});

test('dist cli wiring works in minimal end-to-end checks', async t => {
  const helpResult = await runCliE2e(['--help']);
  assert.equal(helpResult.exitCode, 0);
  assert.equal(helpResult.stderr, '');

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'lutchainer-cli-e2e-'));
  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const outputPath = path.join(tempDir, 'e2e.png');
  const extractResult = await runCliE2e([
    'lut', 'extract', 'lut-mn25faeb-zjgdzm', examplePath('HueShiftToon.lutchain'), '--out', outputPath,
  ]);
  assert.equal(extractResult.exitCode, 0);
  assert.equal(extractResult.stderr, '');
  const outputStat = await stat(outputPath);
  assert.ok(outputStat.size > 0);
});
