import { strToU8, unzipSync, zipSync } from 'fflate';
import type { ColorRamp2dLutData } from '../../features/lut-editor/lut-editor-model.ts';
import {
  CHANNELS,
  type BlendOp,
  type ChannelName,
  type CustomParamModel,
  type ParamRef,
  type StepModel,
} from '../../features/step/step-model.ts';

export interface PipelineStepOpsEntry {
  [key: string]: BlendOp | undefined;
}

export interface PipelineStepEntry {
  id: string | number;
  lutId: string;
  label?: string;
  muted?: boolean;
  blendMode: string;
  xParam: ParamRef;
  yParam: ParamRef;
  ops?: PipelineStepOpsEntry;
}

export type PipelineCustomParamEntry = CustomParamModel;

export interface PipelineZipLutEntry {
  id: string;
  name: string;
  filename: string;
  width: number;
  height: number;
  ramp2dData?: ColorRamp2dLutData;
}

export interface PipelineZipData {
  version: number;
  luts: PipelineZipLutEntry[];
  steps: PipelineStepEntry[];
  customParams?: PipelineCustomParamEntry[];
}

export interface LegacyPipelineStepEntry extends Omit<PipelineStepEntry, 'id'> {
  id: number | string;
}

export interface LegacyPipelineZipData extends Omit<PipelineZipData, 'steps'> {
  nextStepId?: number;
  steps: LegacyPipelineStepEntry[];
}

export interface ParsedPipelineArchive {
  manifest: PipelineZipData;
  files: Record<string, Uint8Array>;
}

const PIPELINE_ARCHIVE_EXTENSION = '.lutchain';
export const PIPELINE_ZIP_FILE_VERSION = 2;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '不明なエラーです。';
}

export function parsePositiveInteger(
  value: unknown,
  fieldName: string,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${fieldName} は整数である必要があります。`);
  }

  if (value < min || value > max) {
    throw new Error(`${fieldName} は ${min} 以上 ${max} 以下である必要があります。`);
  }

  return value;
}

export function parseNonEmptyText(value: unknown, fieldName: string, maxLength = 200): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} は文字列である必要があります。`);
  }

  const text = value.trim();
  if (text.length === 0 || text.length > maxLength) {
    throw new Error(`${fieldName} は 1 文字以上 ${maxLength} 文字以下である必要があります。`);
  }

  return text;
}

export function isZipLikeFilename(filename: string): boolean {
  return typeof filename === 'string' && filename.trim().toLowerCase().endsWith(PIPELINE_ARCHIVE_EXTENSION);
}

export function isZipLikeFileDescriptor(file: { name?: string; type?: string }): boolean {
  const mimeType = typeof file.type === 'string' ? file.type.trim().toLowerCase() : '';
  const fileName = typeof file.name === 'string' ? file.name.trim().toLowerCase() : '';
  return mimeType === 'application/x-lutchain'
    || fileName.endsWith(PIPELINE_ARCHIVE_EXTENSION);
}

function compactPipelineStepOps(
  ops: Record<ChannelName, BlendOp>,
  fieldPrefix: string,
): PipelineStepOpsEntry | undefined {
  if (!isRecord(ops)) {
    throw new Error(`${fieldPrefix}.ops が不正です。`);
  }

  const compactOps: PipelineStepOpsEntry = {};
  for (const channel of CHANNELS) {
    const opRaw = ops[channel];
    if (typeof opRaw !== 'string') {
      throw new Error(`${fieldPrefix}.ops.${channel} が不正です。`);
    }
    if (opRaw !== 'none') {
      compactOps[channel] = opRaw;
    }
  }

  return Object.keys(compactOps).length > 0 ? compactOps : undefined;
}

function serializePipelineStepEntry(step: StepModel, index: number): PipelineStepEntry {
  const fieldPrefix = `steps[${index}]`;
  const entry: PipelineStepEntry = {
    id: parseNonEmptyText(step.id, `${fieldPrefix}.id`, 128),
    lutId: parseNonEmptyText(step.lutId, `${fieldPrefix}.lutId`, 200),
    blendMode: parseNonEmptyText(step.blendMode, `${fieldPrefix}.blendMode`, 100),
    xParam: parseNonEmptyText(step.xParam, `${fieldPrefix}.xParam`, 100) as ParamRef,
    yParam: parseNonEmptyText(step.yParam, `${fieldPrefix}.yParam`, 100) as ParamRef,
  };

  if (step.label !== undefined) {
    entry.label = parseNonEmptyText(step.label, `${fieldPrefix}.label`, 200);
  }
  if (step.muted) {
    entry.muted = true;
  }

  const compactOps = compactPipelineStepOps(step.ops, fieldPrefix);
  if (compactOps) {
    entry.ops = compactOps;
  }

  return entry;
}

export function buildPipelineArchiveManifest(
  version: number,
  steps: StepModel[],
  lutEntries: PipelineZipLutEntry[],
  customParams?: CustomParamModel[],
): PipelineZipData {
  return {
    version: parsePositiveInteger(version, 'version'),
    luts: lutEntries,
    steps: steps.map((step, index) => serializePipelineStepEntry(step, index)),
    ...(Array.isArray(customParams) && customParams.length > 0
      ? {
          customParams: customParams.map((param, index) => ({
            id: parseNonEmptyText(param.id, `customParams[${index}].id`, 32),
            label: parseNonEmptyText(param.label, `customParams[${index}].label`, 40),
            defaultValue: Number.isFinite(param.defaultValue) ? param.defaultValue : 0,
          })),
        }
      : {}),
  };
}

export function serializePipelineArchive(
  manifest: PipelineZipData,
  files: Record<string, Uint8Array>,
): Uint8Array {
  return zipSync({
    ...files,
    'pipeline.json': strToU8(JSON.stringify(manifest, null, 2)),
  });
}

export function parsePipelineArchive(
  data: ArrayBuffer | Uint8Array,
  expectedVersion: number,
): ParsedPipelineArchive {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch (error) {
    throw new Error(`保存ファイル（.lutchain）を開けませんでした: ${toErrorMessage(error)}`);
  }

  const jsonBytes = files['pipeline.json'];
  if (!jsonBytes) {
    throw new Error('.lutchain に pipeline.json が見つかりません。');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(jsonBytes));
  } catch {
    throw new Error('pipeline.jsonのパースに失敗しました。');
  }

  if (!isRecord(payload)) {
    throw new Error('pipeline.jsonのルートはオブジェクトである必要があります。');
  }

  const manifest = payload as Partial<LegacyPipelineZipData>;
  const version = parsePositiveInteger(manifest.version, 'version');
  if (version !== expectedVersion) {
    throw new Error(`未対応のパイプラインバージョンです: ${version}`);
  }

  if (!Array.isArray(manifest.luts)) {
    throw new Error('luts は配列である必要があります。');
  }
  if (!Array.isArray(manifest.steps)) {
    throw new Error('steps は配列である必要があります。');
  }

  return {
    manifest: manifest as unknown as PipelineZipData,
    files,
  };
}
