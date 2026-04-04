import process from 'node:process';
import { runCli } from './cli-command-router.ts';

async function main(): Promise<void> {
  try {
    const exitCode = await runCli(process.argv.slice(2));
    process.exitCode = exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown CLI error';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

void main();
