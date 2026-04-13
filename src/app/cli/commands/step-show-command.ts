import { parseArgs } from 'node:util';
import type { PipelineStepEntry } from '../../../shared/lutchain/lutchain-archive.ts';
import { findStepById, formatCompactStepOps, loadLutchainArchive } from '../cli-archive.ts';
import { PROCESS_CLI_IO, type CliIo } from '../cli-io.ts';
import { formatInfoSummary, type InfoSummaryRow } from '../cli-output.ts';

export function getStepShowUsage(): string {
  return [
    'Usage:',
    '  lutchainer step show [--json] <step-id> <file.lutchain>',
  ].join('\n');
}

interface StepShowCommandOptions {
  filePath: string;
  stepId: string;
  json: boolean;
}

function resolveStepShowOptions(argv: string[]): StepShowCommandOptions {
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
  if (parsed.positionals.length !== 2) {
    throw new Error('step show requires a step id and a .lutchain file path.');
  }

  return {
    filePath: parsed.positionals[1],
    stepId: parsed.positionals[0],
    json: parsed.values.json ?? false,
  };
}

function toStepShowRows(step: PipelineStepEntry): InfoSummaryRow[] {
  return [
    { key: 'ID', value: String(step.id) },
    { key: 'Label', value: step.label ?? '-' },
    { key: 'LUT', value: step.lutId },
    { key: 'Blend', value: step.blendMode },
    { key: 'X', value: step.xParam },
    { key: 'Y', value: step.yParam },
    { key: 'Muted', value: step.muted ? 'yes' : 'no' },
    { key: 'Ops', value: formatCompactStepOps(step.ops) },
  ];
}

export async function runStepShowCommand(argv: string[], io: CliIo = PROCESS_CLI_IO): Promise<number> {
  try {
    const options = resolveStepShowOptions(argv);
    const { archive } = await loadLutchainArchive(options.filePath);
    const step = findStepById(archive.manifest.steps, options.stepId);

    if (options.json) {
      io.stdout(`${JSON.stringify(step, null, 2)}\n`);
      return 0;
    }

    io.stdout(`${formatInfoSummary(toStepShowRows(step))}\n`);
    return 0;
  } catch (error) {
    if (error instanceof Error && error.message === '__help__') {
      io.stdout(`${getStepShowUsage()}\n`);
      return 0;
    }
    if (error instanceof Error) {
      io.stderr(`${error.message}\n${getStepShowUsage()}\n`);
      return 1;
    }
    throw error;
  }
}
