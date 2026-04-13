import { parseArgs } from 'node:util';
import {
  type PipelineZipLutEntry,
} from '../../../shared/lutchain/lutchain-archive.ts';
import { loadLutchainArchive } from '../cli-archive.ts';
import { PROCESS_CLI_IO, type CliIo } from '../cli-io.ts';
import { formatLutList, type LutListRow } from '../cli-output.ts';

export function getLutListUsage(): string {
  return [
    'Usage:',
    '  lutchainer lut list [--json] <file.lutchain>',
  ].join('\n');
}

interface LutListCommandOptions {
  filePath: string;
  json: boolean;
}

interface LutListJsonEntry {
  id: string;
  name: string;
  filename: string;
  width: number;
  height: number;
}

function resolveLutListTarget(argv: string[]): LutListCommandOptions {
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
    throw new Error('lut list requires exactly one positional argument.');
  }

  return {
    filePath: parsed.positionals[0],
    json: parsed.values.json ?? false,
  };
}

function toLutListRows(luts: readonly PipelineZipLutEntry[]): LutListRow[] {
  return luts.map(lut => ({
    id: lut.id,
    name: lut.name,
    size: `${lut.width}x${lut.height}`,
    file: lut.filename,
  }));
}

function toLutListJsonEntries(luts: readonly PipelineZipLutEntry[]): LutListJsonEntry[] {
  return luts.map(lut => ({
    id: lut.id,
    name: lut.name,
    filename: lut.filename,
    width: lut.width,
    height: lut.height,
  }));
}

export async function runLutListCommand(argv: string[], io: CliIo = PROCESS_CLI_IO): Promise<number> {
  try {
    const options = resolveLutListTarget(argv);
    const { archive } = await loadLutchainArchive(options.filePath);
    if (options.json) {
      io.stdout(`${JSON.stringify(toLutListJsonEntries(archive.manifest.luts), null, 2)}\n`);
      return 0;
    }

    io.stdout(`${formatLutList(toLutListRows(archive.manifest.luts))}\n`);
    return 0;
  } catch (error) {
    if (error instanceof Error && error.message === '__help__') {
      io.stdout(`${getLutListUsage()}\n`);
      return 0;
    }
    if (error instanceof Error) {
      io.stderr(`${error.message}\n${getLutListUsage()}\n`);
      return 1;
    }
    throw error;
  }
}
