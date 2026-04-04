import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import {
  isZipLikeFilename,
  parsePipelineArchive,
  PIPELINE_ZIP_FILE_VERSION,
} from '../../../shared/lutchain/lutchain-archive.ts';
import { readFileBytes } from '../../../platforms/node/fs/file-load-runtime.ts';
import { formatLutList } from '../cli-output.ts';

export function getLutListUsage(): string {
  return [
    'Usage:',
    '  lutchainer lut list <file.lutchain>',
  ].join('\n');
}

function resolveLutListTarget(argv: string[]): string {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (parsed.values.help) {
    throw new Error('__help__');
  }
  if (parsed.positionals.length !== 1) {
    throw new Error('lut list requires exactly one positional argument.');
  }

  return parsed.positionals[0];
}

export async function runLutListCommand(argv: string[]): Promise<number> {
  try {
    const filePath = resolveLutListTarget(argv);
    const resolvedPath = path.resolve(process.cwd(), filePath);
    if (!isZipLikeFilename(resolvedPath)) {
      process.stderr.write(`Expected a .lutchain file path.\n${getLutListUsage()}\n`);
      return 1;
    }

    const bytes = await readFileBytes(resolvedPath);
    const archive = parsePipelineArchive(bytes, PIPELINE_ZIP_FILE_VERSION);
    const lines = archive.manifest.luts.map((lut, index) =>
      `${index + 1}. ${lut.name} (${lut.id}) ${lut.width}x${lut.height}`,
    );
    process.stdout.write(`${formatLutList(lines)}\n`);
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
