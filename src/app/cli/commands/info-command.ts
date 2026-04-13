import { parseArgs } from 'node:util';
import { loadLutchainArchive } from '../cli-archive.ts';
import { PROCESS_CLI_IO, type CliIo } from '../cli-io.ts';
import { formatInfoSummary, type InfoSummaryRow } from '../cli-output.ts';

export function getInfoUsage(): string {
  return [
    'Usage:',
    '  lutchainer info [--json] <file.lutchain>',
  ].join('\n');
}

interface InfoCommandOptions {
  filePath: string;
  json: boolean;
}

interface InfoSummary {
  version: number;
  lutCount: number;
  stepCount: number;
  blendModes: string[];
  lutIds: string[];
  stepIds: string[];
}

function resolveInfoOptions(argv: string[]): InfoCommandOptions {
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
    throw new Error('info requires exactly one positional argument.');
  }

  return {
    filePath: parsed.positionals[0],
    json: parsed.values.json ?? false,
  };
}

function buildInfoSummary(manifest: {
  version: number;
  luts: Array<{ id: string }>;
  steps: Array<{ id: string | number; blendMode: string }>;
}): InfoSummary {
  return {
    version: manifest.version,
    lutCount: manifest.luts.length,
    stepCount: manifest.steps.length,
    blendModes: [...new Set(manifest.steps.map(step => step.blendMode))].sort(),
    lutIds: manifest.luts.map(lut => lut.id),
    stepIds: manifest.steps.map(step => String(step.id)),
  };
}

function toInfoSummaryRows(summary: InfoSummary): InfoSummaryRow[] {
  return [
    { key: 'Version', value: String(summary.version) },
    { key: 'LUT-Count', value: String(summary.lutCount) },
    { key: 'Step-Count', value: String(summary.stepCount) },
    { key: 'Blend-Modes', value: summary.blendModes.length > 0 ? summary.blendModes.join(', ') : '-' },
    { key: 'LUT-IDs', value: summary.lutIds.length > 0 ? summary.lutIds.join(', ') : '-' },
    { key: 'Step-IDs', value: summary.stepIds.length > 0 ? summary.stepIds.join(', ') : '-' },
  ];
}

export async function runInfoCommand(argv: string[], io: CliIo = PROCESS_CLI_IO): Promise<number> {
  try {
    const options = resolveInfoOptions(argv);
    const { archive } = await loadLutchainArchive(options.filePath);
    const summary = buildInfoSummary(archive.manifest);

    if (options.json) {
      io.stdout(`${JSON.stringify(summary, null, 2)}\n`);
      return 0;
    }

    io.stdout(`${formatInfoSummary(toInfoSummaryRows(summary))}\n`);
    return 0;
  } catch (error) {
    if (error instanceof Error && error.message === '__help__') {
      io.stdout(`${getInfoUsage()}\n`);
      return 0;
    }
    if (error instanceof Error) {
      io.stderr(`${error.message}\n${getInfoUsage()}\n`);
      return 1;
    }
    throw error;
  }
}
