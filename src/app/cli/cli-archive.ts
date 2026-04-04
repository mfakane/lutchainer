import path from 'node:path';
import process from 'node:process';
import {
  isZipLikeFilename,
  parsePipelineArchive,
  PIPELINE_ZIP_FILE_VERSION,
  type ParsedPipelineArchive,
} from '../../shared/lutchain/lutchain-archive.ts';
import { readFileBytes } from '../../platforms/node/fs/file-load-runtime.ts';

export interface CliLoadedArchive {
  resolvedPath: string;
  archive: ParsedPipelineArchive;
}

export interface CliReadArchiveBytesResult {
  resolvedPath: string;
  bytes: Uint8Array;
}

export function resolveLutchainPath(filePath: string): string {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!isZipLikeFilename(resolvedPath)) {
    throw new Error('Expected a .lutchain file path.');
  }
  return resolvedPath;
}

export async function readLutchainBytes(filePath: string): Promise<CliReadArchiveBytesResult> {
  const resolvedPath = resolveLutchainPath(filePath);
  const bytes = await readFileBytes(resolvedPath);
  return { resolvedPath, bytes };
}

export async function loadLutchainArchive(filePath: string): Promise<CliLoadedArchive> {
  const { resolvedPath, bytes } = await readLutchainBytes(filePath);
  return {
    resolvedPath,
    archive: parsePipelineArchive(bytes, PIPELINE_ZIP_FILE_VERSION),
  };
}
