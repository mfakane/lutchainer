import { getCliBuildLabel } from './cli-build-info.ts';
import { PROCESS_CLI_IO, type CliIo } from './cli-io.ts';
import { runInfoCommand } from './commands/info-command.ts';
import { runLutExtractCommand } from './commands/lut-extract-command.ts';
import { runLutListCommand } from './commands/lut-list-command.ts';
import { runLutShowCommand } from './commands/lut-show-command.ts';
import { runPipelineCatCommand } from './commands/pipeline-cat-command.ts';
import { runServeCommand } from './commands/serve-command.ts';
import { runStepListCommand } from './commands/step-list-command.ts';
import { runStepShowCommand } from './commands/step-show-command.ts';
import { runValidateCommand } from './commands/validate-command.ts';
import { runVersionCommand } from './commands/version-command.ts';

type TopLevelCommand = 'serve' | 'info' | 'validate' | 'version';
type Group = 'lut' | 'step' | 'pipeline';
type LutSubcommand = 'list' | 'show' | 'extract';
type StepSubcommand = 'list' | 'show';
type PipelineSubcommand = 'cat';

function rootUsage(): string {
  const buildLabel = getCliBuildLabel();
  const lines = [
    ...(buildLabel ? [buildLabel, ''] : []),
    'Usage:',
    '  lutchainer <command> [<args>]',
    '',
    'Commands:',
    '  serve       Start the local preview server',
    '  info        Show archive summary information',
    '  validate    Validate a .lutchain archive',
    '  version     Show CLI version information',
    '  lut         Inspect or extract LUT entries',
    '  step        Inspect step entries',
    '  pipeline    Inspect raw pipeline data',
    '',
    `Run 'lutchainer <command> --help' for more information.`,
    `Run 'lutchainer <group> <subcommand> --help' for nested commands.`,
  ];

  return lines.join('\n');
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

function writeTopLevelUsage(exitCode: 0 | 1, io: CliIo): number {
  const output = `${rootUsage()}\n`;
  if (exitCode === 0) {
    io.stdout(output);
  } else {
    io.stderr(output);
  }
  return exitCode;
}

function writeGroupUsage(group: Group, exitCode: 0 | 1, io: CliIo): number {
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
    io.stdout(output);
  } else {
    io.stderr(output);
  }
  return exitCode;
}

export async function runCliWithIo(argv: string[], io: CliIo): Promise<number> {
  const [command, subcommand, ...rest] = argv;

  if (!command || command === '--help' || command === '-h') {
    return writeTopLevelUsage(0, io);
  }

  const nestedArgv = [subcommand, ...rest].filter((value): value is string => value !== undefined);
  const isGroupHelp = !subcommand || subcommand === '--help' || subcommand === '-h';

  switch (command as TopLevelCommand | Group) {
    case 'serve':
      return await runServeCommand(nestedArgv, io);
    case 'info':
      return await runInfoCommand(nestedArgv, io);
    case 'validate':
      return await runValidateCommand(nestedArgv, io);
    case 'version':
      return await runVersionCommand(nestedArgv, io);
    case 'lut':
      if (isGroupHelp) {
        return writeGroupUsage('lut', 0, io);
      }
      switch (subcommand as LutSubcommand) {
        case 'list':
          return await runLutListCommand(rest, io);
        case 'show':
          return await runLutShowCommand(rest, io);
        case 'extract':
          return await runLutExtractCommand(rest, io);
        default:
          return writeGroupUsage('lut', 1, io);
      }
    case 'step':
      if (isGroupHelp) {
        return writeGroupUsage('step', 0, io);
      }
      switch (subcommand as StepSubcommand) {
        case 'list':
          return await runStepListCommand(rest, io);
        case 'show':
          return await runStepShowCommand(rest, io);
        default:
          return writeGroupUsage('step', 1, io);
      }
    case 'pipeline':
      if (isGroupHelp) {
        return writeGroupUsage('pipeline', 0, io);
      }
      switch (subcommand as PipelineSubcommand) {
        case 'cat':
          return await runPipelineCatCommand(rest, io);
        default:
          return writeGroupUsage('pipeline', 1, io);
      }
    default:
      return writeTopLevelUsage(1, io);
  }
}

export async function runCli(argv: string[]): Promise<number> {
  return await runCliWithIo(argv, PROCESS_CLI_IO);
}
