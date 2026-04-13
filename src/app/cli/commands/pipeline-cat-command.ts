import { parseArgs } from 'node:util';
import { loadLutchainArchive } from '../cli-archive.ts';
import { PROCESS_CLI_IO, type CliIo } from '../cli-io.ts';

export function getPipelineCatUsage(): string {
  return [
    'Usage:',
    '  lutchainer pipeline cat [--json] <file.lutchain>',
  ].join('\n');
}

interface PipelineCatCommandOptions {
  filePath: string;
}

function resolvePipelineCatOptions(argv: string[]): PipelineCatCommandOptions {
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
    throw new Error('pipeline cat requires exactly one positional argument.');
  }

  return {
    filePath: parsed.positionals[0],
  };
}

export async function runPipelineCatCommand(argv: string[], io: CliIo = PROCESS_CLI_IO): Promise<number> {
  try {
    const options = resolvePipelineCatOptions(argv);
    const { archive } = await loadLutchainArchive(options.filePath);
    io.stdout(`${JSON.stringify(archive.manifest, null, 2)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof Error && error.message === '__help__') {
      io.stdout(`${getPipelineCatUsage()}\n`);
      return 0;
    }
    if (error instanceof Error) {
      io.stderr(`${error.message}\n${getPipelineCatUsage()}\n`);
      return 1;
    }
    throw error;
  }
}
