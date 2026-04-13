import { parseArgs } from 'node:util';
import type { PipelineZipLutEntry } from '../../../shared/lutchain/lutchain-archive.ts';
import { findLutByRef, loadLutchainArchive } from '../cli-archive.ts';
import { PROCESS_CLI_IO, type CliIo } from '../cli-io.ts';
import { formatInfoSummary, type InfoSummaryRow } from '../cli-output.ts';

export function getLutShowUsage(): string {
  return [
    'Usage:',
    '  lutchainer lut show [--json] <lut-id> <file.lutchain>',
    '  lutchainer lut show [--json] -n <lut-name> <file.lutchain>',
  ].join('\n');
}

interface LutShowCommandOptions {
  filePath: string;
  lutRef: string;
  byName: boolean;
  json: boolean;
}

function resolveLutShowOptions(argv: string[]): LutShowCommandOptions {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      json: { type: 'boolean' },
      name: { type: 'string', short: 'n' },
    },
  });

  if (parsed.values.help) {
    throw new Error('__help__');
  }

  const byName = parsed.values.name !== undefined;
  if (byName && parsed.positionals.length !== 1) {
    throw new Error('lut show with -n requires exactly one positional argument for the .lutchain file.');
  }
  if (!byName && parsed.positionals.length !== 2) {
    throw new Error('lut show requires a LUT id and a .lutchain file path.');
  }

  return {
    filePath: byName ? parsed.positionals[0] : parsed.positionals[1],
    lutRef: byName ? parsed.values.name ?? '' : parsed.positionals[0],
    byName,
    json: parsed.values.json ?? false,
  };
}

function toLutShowRows(lut: PipelineZipLutEntry): InfoSummaryRow[] {
  return [
    { key: 'ID', value: lut.id },
    { key: 'Name', value: lut.name },
    { key: 'File', value: lut.filename },
    { key: 'Size', value: `${lut.width}x${lut.height}` },
    { key: 'Ramp-Data', value: lut.ramp2dData ? 'yes' : 'no' },
    { key: 'Ramp-Count', value: lut.ramp2dData ? String(lut.ramp2dData.ramps.length) : '0' },
  ];
}

export async function runLutShowCommand(argv: string[], io: CliIo = PROCESS_CLI_IO): Promise<number> {
  try {
    const options = resolveLutShowOptions(argv);
    const { archive } = await loadLutchainArchive(options.filePath);
    const lut = findLutByRef(archive.manifest.luts, options.lutRef, { byName: options.byName });

    if (options.json) {
      io.stdout(`${JSON.stringify(lut, null, 2)}\n`);
      return 0;
    }

    io.stdout(`${formatInfoSummary(toLutShowRows(lut))}\n`);
    return 0;
  } catch (error) {
    if (error instanceof Error && error.message === '__help__') {
      io.stdout(`${getLutShowUsage()}\n`);
      return 0;
    }
    if (error instanceof Error) {
      io.stderr(`${error.message}\n${getLutShowUsage()}\n`);
      return 1;
    }
    throw error;
  }
}
