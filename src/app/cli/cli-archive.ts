import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  isZipLikeFilename,
  parsePipelineArchive,
  PIPELINE_ZIP_FILE_VERSION,
  type PipelineStepEntry,
  type PipelineZipLutEntry,
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

export function findStepById(steps: readonly PipelineStepEntry[], rawId: string): PipelineStepEntry {
  if (!/^\d+$/.test(rawId)) {
    throw new Error(`Invalid step id: ${rawId}`);
  }

  const stepId = Number(rawId);
  const step = steps.find(candidate => candidate.id === stepId);
  if (!step) {
    throw new Error(`Step not found: ${stepId}`);
  }
  return step;
}

function findLutByName(luts: readonly PipelineZipLutEntry[], name: string): PipelineZipLutEntry {
  const matches = luts.filter(candidate => candidate.name === name);
  if (matches.length === 0) {
    throw new Error(`LUT not found by name: ${name}`);
  }
  if (matches.length > 1) {
    throw new Error(`LUT name is ambiguous: ${name} (${matches.map(match => match.id).join(', ')})`);
  }
  return matches[0];
}

export function findLutByRef(
  luts: readonly PipelineZipLutEntry[],
  ref: string,
  options?: { byName?: boolean },
): PipelineZipLutEntry {
  if (options?.byName) {
    return findLutByName(luts, ref);
  }

  const lut = luts.find(candidate => candidate.id === ref);
  if (!lut) {
    throw new Error(`LUT not found: ${ref}`);
  }
  return lut;
}

export function formatCompactStepOps(ops: PipelineStepEntry['ops']): string {
  if (!ops) {
    return '-';
  }

  const entries = Object.entries(ops).filter(([, op]) => op !== undefined);
  if (entries.length === 0) {
    return '-';
  }

  return entries.map(([channel, op]) => `${channel}:${op}`).join(', ');
}

export async function writeOutputFile(outputPath: string, bytes: Uint8Array): Promise<string> {
  const resolvedPath = path.resolve(process.cwd(), outputPath);
  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

  try {
    await fs.access(resolvedPath);
    throw new Error(`Refusing to overwrite existing file: ${resolvedPath}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  await fs.writeFile(resolvedPath, bytes);
  return resolvedPath;
}

export async function ensureOutputDir(outputDir: string): Promise<string> {
  const resolvedPath = path.resolve(process.cwd(), outputDir);
  await fs.mkdir(resolvedPath, { recursive: true });
  return resolvedPath;
}

export function outputBasename(relativePath: string): string {
  return path.basename(relativePath);
}
