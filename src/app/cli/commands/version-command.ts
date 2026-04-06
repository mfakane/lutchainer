import process from 'node:process';
import { getBuildCommitId } from '../cli-build-info.ts';

export async function runVersionCommand(argv: string[]): Promise<number> {
  let revision = getBuildCommitId();
  process.stdout.write(`${revision}\n`);
  return 0;
}
