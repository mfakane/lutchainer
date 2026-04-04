import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import {
  ensureOutputDir,
  findLutByRef,
  loadLutchainArchive,
  outputBasename,
  writeOutputFile,
} from '../cli-archive.ts';

export function getLutExtractUsage(): string {
  return [
    'Usage:',
    '  lutchainer lut extract <lut-id> <file.lutchain> [-o|--out] <png-path>',
    '  lutchainer lut extract [-n|--name] <lut-name> <file.lutchain> [-o|--out] <png-path>',
    '  lutchainer lut extract --all <file.lutchain> --out-dir <dir>',
  ].join('\n');
}

interface LutExtractCommandOptions {
  filePath: string;
  lutRef?: string;
  byName: boolean;
  all: boolean;
  out?: string;
  outDir?: string;
}

function resolveLutExtractOptions(argv: string[]): LutExtractCommandOptions {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      all: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      name: { type: 'string', short: 'n' },
      out: { type: 'string', short: 'o' },
      'out-dir': { type: 'string' },
    },
  });

  if (parsed.values.help) {
    throw new Error('__help__');
  }

  const all = parsed.values.all ?? false;
  const byName = parsed.values.name !== undefined;
  if (all && byName) {
    throw new Error('lut extract does not allow --all and -n together.');
  }
  if (all && parsed.values.out) {
    throw new Error('lut extract --all requires --out-dir instead of --out.');
  }
  if (!all && parsed.values['out-dir']) {
    throw new Error('lut extract for a single LUT requires --out instead of --out-dir.');
  }

  if (all) {
    if (parsed.positionals.length !== 1 || !parsed.values['out-dir']) {
      throw new Error('lut extract --all requires a .lutchain file path and --out-dir <dir>.');
    }
    return {
      filePath: parsed.positionals[0],
      all: true,
      byName: false,
      outDir: parsed.values['out-dir'],
    };
  }

  if (byName) {
    if (parsed.positionals.length !== 1 || !parsed.values.out) {
      throw new Error('lut extract -n requires a .lutchain file path and --out <png-path>.');
    }
    return {
      filePath: parsed.positionals[0],
      lutRef: parsed.values.name,
      byName: true,
      all: false,
      out: parsed.values.out,
    };
  }

  if (parsed.positionals.length !== 2 || !parsed.values.out) {
    throw new Error('lut extract requires a LUT id, a .lutchain file path, and --out <png-path>.');
  }
  return {
    filePath: parsed.positionals[1],
    lutRef: parsed.positionals[0],
    byName: false,
    all: false,
    out: parsed.values.out,
  };
}

export async function runLutExtractCommand(argv: string[]): Promise<number> {
  try {
    const options = resolveLutExtractOptions(argv);
    const { archive } = await loadLutchainArchive(options.filePath);

    if (options.all) {
      const outputDir = await ensureOutputDir(options.outDir ?? '');
      const writtenPaths: string[] = [];
      for (const lut of archive.manifest.luts) {
        const bytes = archive.files[lut.filename];
        if (!bytes) {
          throw new Error(`LUT image is missing from the archive: ${lut.filename}`);
        }
        const outputPath = path.join(outputDir, outputBasename(lut.filename));
        writtenPaths.push(await writeOutputFile(outputPath, bytes));
      }
      process.stdout.write(`${writtenPaths.join('\n')}\n`);
      return 0;
    }

    const lut = findLutByRef(archive.manifest.luts, options.lutRef ?? '', { byName: options.byName });
    const bytes = archive.files[lut.filename];
    if (!bytes) {
      throw new Error(`LUT image is missing from the archive: ${lut.filename}`);
    }

    const writtenPath = await writeOutputFile(options.out ?? '', bytes);
    process.stdout.write(`${writtenPath}\n`);
    return 0;
  } catch (error) {
    if (error instanceof Error && error.message === '__help__') {
      process.stdout.write(`${getLutExtractUsage()}\n`);
      return 0;
    }
    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n${getLutExtractUsage()}\n`);
      return 1;
    }
    throw error;
  }
}
