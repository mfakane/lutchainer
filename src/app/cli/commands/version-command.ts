import { getBuildCommitId } from '../cli-build-info.ts';
import { PROCESS_CLI_IO, type CliIo } from '../cli-io.ts';

export async function runVersionCommand(argv: string[], io: CliIo = PROCESS_CLI_IO): Promise<number> {
  const revision = getBuildCommitId();
  void argv;
  io.stdout(`${revision}\n`);
  return 0;
}
