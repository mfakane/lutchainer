import process from 'node:process';
import { runLutListCommand } from './commands/lut-list-command.ts';
import { runServeCommand } from './commands/serve-command.ts';

function usage(): string {
  return [
    'Usage:',
    '  lutchainer serve [--port <number>]',
    '  lutchainer lut list <file.lutchain>',
  ].join('\n');
}

export async function runCli(argv: string[]): Promise<number> {
  const [command, subcommand, ...rest] = argv;

  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }

  if (command === 'serve') {
    return await runServeCommand([subcommand, ...rest].filter((value): value is string => value !== undefined));
  }

  if (command === 'lut' && subcommand === 'list') {
    return await runLutListCommand(rest);
  }

  process.stderr.write(`${usage()}\n`);
  return 1;
}
