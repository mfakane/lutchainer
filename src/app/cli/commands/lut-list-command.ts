import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import {
  isZipLikeFilename,
  parsePipelineArchive,
  PIPELINE_ZIP_FILE_VERSION,
  type PipelineZipLutEntry,
} from '../../../shared/lutchain/lutchain-archive.ts';
import { readFileBytes } from '../../../platforms/node/fs/file-load-runtime.ts';
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

export async function runLutListCommand(argv: string[]): Promise<number> {
  try {
    const options = resolveLutListTarget(argv);
    const filePath = options.filePath;
    const resolvedPath = path.resolve(process.cwd(), filePath);
    if (!isZipLikeFilename(resolvedPath)) {
      process.stderr.write(`Expected a .lutchain file path.\n${getLutListUsage()}\n`);
      return 1;
    }

    const bytes = await readFileBytes(resolvedPath);
    const archive = parsePipelineArchive(bytes, PIPELINE_ZIP_FILE_VERSION);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(toLutListJsonEntries(archive.manifest.luts), null, 2)}\n`);
      return 0;
    }

    process.stdout.write(`${formatLutList(toLutListRows(archive.manifest.luts))}\n`);
    return 0;
  } catch (error) {
    if (error instanceof Error && error.message === '__help__') {
      process.stdout.write(`${getLutListUsage()}\n`);
      return 0;
    }
    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n${getLutListUsage()}\n`);
      return 1;
    }
    throw error;
  }
}
