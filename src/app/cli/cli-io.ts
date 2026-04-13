import process from 'node:process';

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

export const PROCESS_CLI_IO: CliIo = {
  stdout(text: string): void {
    process.stdout.write(text);
  },
  stderr(text: string): void {
    process.stderr.write(text);
  },
};
