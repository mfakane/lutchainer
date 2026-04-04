import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { createStaticServer } from '../../../platforms/node/serve/static-server-runtime.ts';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8000;

export function getServeUsage(): string {
  return [
    'Usage:',
    '  lutchainer serve [--port <number>]',
    '  lutchainer serve [-p <number>]',
  ].join('\n');
}

function resolveDistDir(): string {
  return path.resolve(process.cwd(), 'dist', 'web');
}

function parsePortOption(value: string | undefined, optionLabel = '--port'): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!/^\d+$/.test(value)) {
    throw new Error(`${optionLabel} must be an integer between 1 and 65535.`);
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${optionLabel} must be an integer between 1 and 65535.`);
  }
  return port;
}

function resolveServeOptions(argv: string[]): { host: string; port: number } {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      port: { type: 'string', short: 'p' },
    },
  });

  if (parsed.values.help) {
    throw new Error('__help__');
  }
  if (parsed.positionals.length > 0) {
    throw new Error('serve does not accept positional arguments.');
  }

  const port = parsePortOption(parsed.values.port) ?? DEFAULT_PORT;

  return {
    host: DEFAULT_HOST,
    port,
  };
}

export async function runServeCommand(argv: string[]): Promise<number> {
  let options: { host: string; port: number };
  try {
    options = resolveServeOptions(argv);
  } catch (error) {
    if (error instanceof Error && error.message === '__help__') {
      process.stdout.write(`${getServeUsage()}\n`);
      return 0;
    }
    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n${getServeUsage()}\n`);
      return 1;
    }
    throw error;
  }

  try {
    const server = await createStaticServer({
      rootDir: resolveDistDir(),
      host: options.host,
      port: options.port,
    });
    process.stdout.write(`Server running on http://${server.host}:${server.port}\n`);
    await new Promise<void>(() => {});
    return 0;
  } catch (error) {
    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    throw error;
  }
}
