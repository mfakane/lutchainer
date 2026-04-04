import process from 'node:process';
import { runInfoCommand } from './commands/info-command.ts';
import { runLutExtractCommand } from './commands/lut-extract-command.ts';
import { runLutListCommand } from './commands/lut-list-command.ts';
import { runLutShowCommand } from './commands/lut-show-command.ts';
import { runPipelineCatCommand } from './commands/pipeline-cat-command.ts';
import { runServeCommand } from './commands/serve-command.ts';
import { runStepListCommand } from './commands/step-list-command.ts';
import { runStepShowCommand } from './commands/step-show-command.ts';
import { runValidateCommand } from './commands/validate-command.ts';

function usage(): string {
  return [
    'Usage:',
    '  lutchainer info [--json] <file.lutchain>',
    '  lutchainer serve [--port <number>]',
    '  lutchainer validate [--json] <file.lutchain>',
    '  lutchainer lut extract <lut-id> <file.lutchain> --out <png-path>',
    '  lutchainer lut list [--json] <file.lutchain>',
    '  lutchainer lut show [--json] <lut-id> <file.lutchain>',
    '  lutchainer step list [--json] <file.lutchain>',
    '  lutchainer step show [--json] <step-id> <file.lutchain>',
    '  lutchainer pipeline cat [--json] <file.lutchain>',
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

  if (command === 'info') {
    return await runInfoCommand([subcommand, ...rest].filter((value): value is string => value !== undefined));
  }

  if (command === 'validate') {
    return await runValidateCommand([subcommand, ...rest].filter((value): value is string => value !== undefined));
  }

  if (command === 'lut' && subcommand === 'list') {
    return await runLutListCommand(rest);
  }

  if (command === 'lut' && subcommand === 'show') {
    return await runLutShowCommand(rest);
  }

  if (command === 'lut' && subcommand === 'extract') {
    return await runLutExtractCommand(rest);
  }

  if (command === 'step' && subcommand === 'list') {
    return await runStepListCommand(rest);
  }

  if (command === 'step' && subcommand === 'show') {
    return await runStepShowCommand(rest);
  }

  if (command === 'pipeline' && subcommand === 'cat') {
    return await runPipelineCatCommand(rest);
  }

  process.stderr.write(`${usage()}\n`);
  return 1;
}
