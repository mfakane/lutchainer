import process from 'node:process';
import { parseArgs } from 'node:util';
import type { PipelineStepEntry } from '../../../shared/lutchain/lutchain-archive.ts';
import { loadLutchainArchive } from '../cli-archive.ts';
import { formatStepList, type StepListRow } from '../cli-output.ts';

export function getStepListUsage(): string {
  return [
    'Usage:',
    '  lutchainer step list [--json] <file.lutchain>',
  ].join('\n');
}

interface StepListCommandOptions {
  filePath: string;
  json: boolean;
}

interface StepListJsonEntry {
  id: number;
  label?: string;
  lutId: string;
  blendMode: string;
  xParam: string;
  yParam: string;
  muted: boolean;
  ops?: Record<string, string>;
}

function resolveStepListOptions(argv: string[]): StepListCommandOptions {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      json: { type: 'boolean' },
    },
  });

  if (parsed.values.help) {
    throw new Error('__help__');
  }
  if (parsed.positionals.length !== 1) {
    throw new Error('step list requires exactly one positional argument.');
  }

  return {
    filePath: parsed.positionals[0],
    json: parsed.values.json ?? false,
  };
}

function toStepListRows(steps: readonly PipelineStepEntry[]): StepListRow[] {
  return steps.map(step => ({
    id: String(step.id),
    label: step.label ?? '',
    lut: step.lutId,
    blend: step.blendMode,
    x: step.xParam,
    y: step.yParam,
    muted: step.muted ? 'yes' : 'no',
  }));
}

function toStepListJsonEntries(steps: readonly PipelineStepEntry[]): StepListJsonEntry[] {
  return steps.map(step => ({
    id: step.id,
    ...(step.label !== undefined ? { label: step.label } : {}),
    lutId: step.lutId,
    blendMode: step.blendMode,
    xParam: step.xParam,
    yParam: step.yParam,
    muted: step.muted ?? false,
    ...(step.ops !== undefined ? { ops: step.ops as Record<string, string> } : {}),
  }));
}

export async function runStepListCommand(argv: string[]): Promise<number> {
  try {
    const options = resolveStepListOptions(argv);
    const { archive } = await loadLutchainArchive(options.filePath);

    if (options.json) {
      process.stdout.write(`${JSON.stringify(toStepListJsonEntries(archive.manifest.steps), null, 2)}\n`);
      return 0;
    }

    process.stdout.write(`${formatStepList(toStepListRows(archive.manifest.steps))}\n`);
    return 0;
  } catch (error) {
    if (error instanceof Error && error.message === '__help__') {
      process.stdout.write(`${getStepListUsage()}\n`);
      return 0;
    }
    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n${getStepListUsage()}\n`);
      return 1;
    }
    throw error;
  }
}
