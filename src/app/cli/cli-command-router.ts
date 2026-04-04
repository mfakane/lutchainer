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

type TopLevelCommand = 'serve' | 'info' | 'validate';
type Group = 'lut' | 'step' | 'pipeline';
type LutSubcommand = 'list' | 'show' | 'extract';
type StepSubcommand = 'list' | 'show';
type PipelineSubcommand = 'cat';

function rootUsage(): string {
  return [
    'Usage:',
    '  lutchainer <command> [<args>]',
    '',
    'Commands:',
    '  serve       Start the local preview server',
    '  info        Show archive summary information',
    '  validate    Validate a .lutchain archive',
    '  lut         Inspect or extract LUT entries',
    '  step        Inspect step entries',
    '  pipeline    Inspect raw pipeline data',
    '',
    `Run 'lutchainer <command> --help' for more information.`,
    `Run 'lutchainer <group> <subcommand> --help' for nested commands.`,
  ].join('\n');
}

function lutUsage(): string {
  return [
    'Usage:',
    '  lutchainer lut <subcommand> [<args>]',
    '',
    'Subcommands:',
    '  list        List LUTs in an archive',
    '  show        Show one LUT by id or -n <name>',
    '  extract     Extract one or more LUT PNG files',
    '',
    `Run 'lutchainer lut <subcommand> --help' for details.`,
  ].join('\n');
}

function stepUsage(): string {
  return [
    'Usage:',
    '  lutchainer step <subcommand> [<args>]',
    '',
    'Subcommands:',
    '  list        List step entries in an archive',
    '  show        Show one step by id',
    '',
    `Run 'lutchainer step <subcommand> --help' for details.`,
  ].join('\n');
}

function pipelineUsage(): string {
  return [
    'Usage:',
    '  lutchainer pipeline <subcommand> [<args>]',
    '',
    'Subcommands:',
    '  cat         Print pipeline.json contents',
    '',
    `Run 'lutchainer pipeline <subcommand> --help' for details.`,
  ].join('\n');
}

function writeTopLevelUsage(exitCode: 0 | 1): number {
  const output = `${rootUsage()}\n`;
  if (exitCode === 0) {
    process.stdout.write(output);
  } else {
    process.stderr.write(output);
  }
  return exitCode;
}

function writeGroupUsage(group: Group, exitCode: 0 | 1): number {
  let usage: string;
  switch (group) {
    case 'lut':
      usage = lutUsage();
      break;
    case 'step':
      usage = stepUsage();
      break;
    case 'pipeline':
      usage = pipelineUsage();
      break;
  }
  const output = `${usage}\n`;
  if (exitCode === 0) {
    process.stdout.write(output);
  } else {
    process.stderr.write(output);
  }
  return exitCode;
}

export async function runCli(argv: string[]): Promise<number> {
  const [command, subcommand, ...rest] = argv;

  if (!command || command === '--help' || command === '-h') {
    return writeTopLevelUsage(0);
  }

  const nestedArgv = [subcommand, ...rest].filter((value): value is string => value !== undefined);
  const isGroupHelp = !subcommand || subcommand === '--help' || subcommand === '-h';

  switch (command as TopLevelCommand | Group) {
    case 'serve':
      return await runServeCommand(nestedArgv);
    case 'info':
      return await runInfoCommand(nestedArgv);
    case 'validate':
      return await runValidateCommand(nestedArgv);
    case 'lut':
      if (isGroupHelp) {
        return writeGroupUsage('lut', 0);
      }
      switch (subcommand as LutSubcommand) {
        case 'list':
          return await runLutListCommand(rest);
        case 'show':
          return await runLutShowCommand(rest);
        case 'extract':
          return await runLutExtractCommand(rest);
        default:
          return writeGroupUsage('lut', 1);
      }
    case 'step':
      if (isGroupHelp) {
        return writeGroupUsage('step', 0);
      }
      switch (subcommand as StepSubcommand) {
        case 'list':
          return await runStepListCommand(rest);
        case 'show':
          return await runStepShowCommand(rest);
        default:
          return writeGroupUsage('step', 1);
      }
    case 'pipeline':
      if (isGroupHelp) {
        return writeGroupUsage('pipeline', 0);
      }
      switch (subcommand as PipelineSubcommand) {
        case 'cat':
          return await runPipelineCatCommand(rest);
        default:
          return writeGroupUsage('pipeline', 1);
      }
    default:
      return writeTopLevelUsage(1);
  }
}
