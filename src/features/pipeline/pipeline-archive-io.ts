/**
 * Pipeline archive I/O.
 * Handles serialization and deserialization of .lutchain ZIP archives.
 * Depends on the PipelineImageAdapter (injected via getPipelineImageAdapter callback).
 * Pure at the parsing layer; async I/O is isolated to serialize/load functions.
 */

import {
    buildPipelineArchiveManifest,
    isRecord,
    parseNonEmptyText,
    parsePipelineArchive,
    parsePositiveInteger,
    parsePositiveInteger as parsePositiveIntegerAlias,
    PIPELINE_ZIP_FILE_VERSION,
    serializePipelineArchive,
    type PipelineZipLutEntry,
} from '../../shared/lutchain/lutchain-archive.ts';
import {
    type ColorRamp,
    type ColorRamp2dLutData,
    type ColorStop,
} from '../lut-editor/lut-editor-model.ts';
import {
    DEFAULT_OPS,
    isCustomParamRef,
    MAX_STEP_LABEL_LENGTH,
    parseCustomParamRef,
    type BlendOp,
    type ChannelName,
    type CustomParamModel,
    type LutModel,
    type StepModel
} from '../step/step-model.ts';
import { MAX_LUTS, MAX_STEPS } from './pipeline-constants.ts';
import type { LoadedPipelineData, PipelineImageAdapter } from './pipeline-model.ts';
import {
    isValidBlendMode,
    isValidBlendOp,
    isValidChannelName,
    isValidParamName,
    MAX_CUSTOM_PARAM_LABEL_LENGTH,
    MAX_PIPELINE_IMAGE_SIDE,
    normalizeCustomParamValue,
    parseCustomParamId,
    parseLutId,
} from './pipeline-validators.ts';

// ─────────────────────────────────────────────────────
// Internal parse helpers
// ─────────────────────────────────────────────────────

function parseColorRamp2dLutData(value: unknown): ColorRamp2dLutData | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  try {
    if (!isRecord(value)) return undefined;
    if (typeof value.name !== 'string' || value.name.trim() === '') return undefined;
    if (typeof value.width !== 'number' || !Number.isInteger(value.width) || value.width < 2) return undefined;
    if (typeof value.height !== 'number' || !Number.isInteger(value.height) || value.height < 2) return undefined;
    if (!Array.isArray(value.ramps) || value.ramps.length < 2) return undefined;

    const ramps = value.ramps.map((ramp: unknown) => {
      if (!isRecord(ramp)) return null;
      if (typeof ramp.id !== 'string' || ramp.id === '') return null;
      if (typeof ramp.position !== 'number' || !Number.isFinite(ramp.position)) return null;
      if (!Array.isArray(ramp.stops) || ramp.stops.length < 2) return null;

      const stops = ramp.stops.map((stop: unknown) => {
        if (!isRecord(stop)) return null;
        if (typeof stop.id !== 'string' || stop.id === '') return null;
        if (typeof stop.position !== 'number' || !Number.isFinite(stop.position)) return null;
        if (typeof stop.alpha !== 'number' || !Number.isFinite(stop.alpha)) return null;
        if (!Array.isArray(stop.color) || stop.color.length !== 3) return null;
        const [r, g, b] = stop.color as unknown[];
        if (typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number') return null;
        if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
        return {
          id: stop.id as string,
          position: stop.position as number,
          color: [r, g, b] as [number, number, number],
          alpha: stop.alpha as number,
        } satisfies ColorStop;
      });

      if (stops.some(s => s === null)) return null;
      return {
        id: ramp.id as string,
        position: ramp.position as number,
        stops: stops as NonNullable<typeof stops[number]>[],
      } satisfies ColorRamp;
    });

    if (ramps.some(r => r === null)) return undefined;

    return {
      name: value.name as string,
      width: value.width as number,
      height: value.height as number,
      ramps: ramps as NonNullable<typeof ramps[number]>[],
      ...(value.axisSwap === true ? { axisSwap: true } : {}),
    };
  } catch {
    return undefined;
  }
}

function parsePipelineZipLutEntry(value: unknown, index: number): PipelineZipLutEntry {
  const fieldPrefix = `luts[${index}]`;
  if (!isRecord(value)) {
    throw new Error(`${fieldPrefix} はオブジェクトである必要があります。`);
  }

  const lutId = parseLutId(typeof value.id === 'string' ? value.id : undefined);
  if (!lutId) {
    throw new Error(`${fieldPrefix}.id が不正です。`);
  }

  const name = parseNonEmptyText(value.name, `${fieldPrefix}.name`);
  const filename = parseNonEmptyText(value.filename, `${fieldPrefix}.filename`, 500);
  if (!/^luts\/[^/]+\.png$/.test(filename) || filename.includes('..')) {
    throw new Error(`${fieldPrefix}.filename の形式が不正です。`);
  }

  const width = parsePositiveInteger(value.width, `${fieldPrefix}.width`, 2, MAX_PIPELINE_IMAGE_SIDE);
  const height = parsePositiveInteger(value.height, `${fieldPrefix}.height`, 2, MAX_PIPELINE_IMAGE_SIDE);
  const ramp2dData = parseColorRamp2dLutData(value.ramp2dData);

  return { id: lutId, name, filename, width, height, ...(ramp2dData !== undefined ? { ramp2dData } : {}) };
}

function parseCustomParamEntry(value: unknown, index: number): CustomParamModel {
  const fieldPrefix = `customParams[${index}]`;
  if (!isRecord(value)) {
    throw new Error(`${fieldPrefix} はオブジェクトである必要があります。`);
  }

  const id = parseCustomParamId(typeof value.id === 'string' ? value.id : undefined);
  if (!id) {
    throw new Error(`${fieldPrefix}.id が不正です。`);
  }

  const label = parseNonEmptyText(value.label, `${fieldPrefix}.label`, MAX_CUSTOM_PARAM_LABEL_LENGTH);
  const defaultValueRaw = value.defaultValue;
  if (typeof defaultValueRaw !== 'number' || !Number.isFinite(defaultValueRaw)) {
    throw new Error(`${fieldPrefix}.defaultValue が不正です。`);
  }

  return {
    id,
    label,
    defaultValue: normalizeCustomParamValue(defaultValueRaw),
  };
}

function parsePipelineStepEntry(
  value: unknown,
  index: number,
  customParamIds: ReadonlySet<string> = new Set<string>(),
): StepModel {
  const fieldPrefix = `steps[${index}]`;
  if (!isRecord(value)) {
    throw new Error(`${fieldPrefix} はオブジェクトである必要があります。`);
  }

  // id can be either number or string for backward compatibility
  const id = typeof value.id === 'number'
    ? String(parsePositiveIntegerAlias(value.id, `${fieldPrefix}.id`))
    : parseNonEmptyText(value.id, `${fieldPrefix}.id`, 128);

  const lutId = parseLutId(typeof value.lutId === 'string' ? value.lutId : undefined);
  if (!lutId) {
    throw new Error(`${fieldPrefix}.lutId が不正です。`);
  }

  let label: string | undefined;
  if (value.label !== undefined) {
    label = parseNonEmptyText(value.label, `${fieldPrefix}.label`, MAX_STEP_LABEL_LENGTH);
  }

  let muted = false;
  if (value.muted !== undefined) {
    if (typeof value.muted !== 'boolean') {
      throw new Error(`${fieldPrefix}.muted が不正です。`);
    }
    muted = value.muted;
  }

  const blendModeRaw = value.blendMode;
  if (typeof blendModeRaw !== 'string' || !isValidBlendMode(blendModeRaw)) {
    throw new Error(`${fieldPrefix}.blendMode が不正です。`);
  }

  const xParamRaw = value.xParam;
  if (typeof xParamRaw !== 'string' || !isValidParamName(xParamRaw)) {
    throw new Error(`${fieldPrefix}.xParam が不正です。`);
  }
  if (isCustomParamRef(xParamRaw)) {
    const customParamId = parseCustomParamRef(xParamRaw);
    if (!customParamId || !customParamIds.has(customParamId)) {
      throw new Error(`${fieldPrefix}.xParam が未知のカスタムパラメータを参照しています。`);
    }
  }

  const yParamRaw = value.yParam;
  if (typeof yParamRaw !== 'string' || !isValidParamName(yParamRaw)) {
    throw new Error(`${fieldPrefix}.yParam が不正です。`);
  }
  if (isCustomParamRef(yParamRaw)) {
    const customParamId = parseCustomParamRef(yParamRaw);
    if (!customParamId || !customParamIds.has(customParamId)) {
      throw new Error(`${fieldPrefix}.yParam が未知のカスタムパラメータを参照しています。`);
    }
  }

  const ops: Record<ChannelName, BlendOp> = { ...DEFAULT_OPS };
  const rawOps = value.ops;
  if (rawOps !== undefined) {
    if (!isRecord(rawOps)) {
      throw new Error(`${fieldPrefix}.ops が不正です。`);
    }
    for (const [channelRaw, opRaw] of Object.entries(rawOps)) {
      if (!isValidChannelName(channelRaw)) {
        throw new Error(`${fieldPrefix}.ops.${channelRaw} が不正です。`);
      }
      if (typeof opRaw !== 'string' || !isValidBlendOp(opRaw)) {
        throw new Error(`${fieldPrefix}.ops.${channelRaw} が不正です。`);
      }
      ops[channelRaw] = opRaw;
    }
  }

  return { id, lutId, label, muted, blendMode: blendModeRaw, xParam: xParamRaw, yParam: yParamRaw, ops };
}

// ─────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────

export async function serializePipelineAsZip(
  luts: LutModel[],
  steps: StepModel[],
  customParams: CustomParamModel[],
  previewPngBytes: Uint8Array | undefined,
  adapter: PipelineImageAdapter,
): Promise<Uint8Array> {
  if (!Array.isArray(luts) || !Array.isArray(steps) || !Array.isArray(customParams)) {
    throw new Error('パイプライン状態が不正です。');
  }

  const zipFiles: Record<string, Uint8Array> = {};
  const lutEntries: PipelineZipLutEntry[] = [];

  for (const lut of luts) {
    const filename = `luts/${lut.id}.png`;
    const pngBytes = await adapter.imageToPngBytes(lut.image);
    zipFiles[filename] = pngBytes;
    lutEntries.push({
      id: lut.id,
      name: lut.name,
      filename,
      width: lut.width,
      height: lut.height,
      ...(lut.ramp2dData !== undefined ? { ramp2dData: lut.ramp2dData } : {}),
    });
  }

  const manifest = buildPipelineArchiveManifest(
    PIPELINE_ZIP_FILE_VERSION,
    steps,
    lutEntries,
    customParams,
  );

  if (previewPngBytes instanceof Uint8Array && previewPngBytes.length > 0) {
    zipFiles['preview.png'] = previewPngBytes;
  }

  return serializePipelineArchive(manifest, zipFiles);
}

export async function loadPipelineFromZip(
  data: ArrayBuffer,
  adapter: PipelineImageAdapter,
): Promise<LoadedPipelineData> {
  if (!(data instanceof ArrayBuffer)) {
    throw new Error('.lutchain データが不正です。');
  }

  const archive = parsePipelineArchive(data, PIPELINE_ZIP_FILE_VERSION);
  const { manifest, files } = archive;

  const rawLuts = manifest.luts;
  if (rawLuts.length === 0) {
    throw new Error('luts が空です。1件以上必要です。');
  }
  if (rawLuts.length > MAX_LUTS) {
    throw new Error(`luts は最大 ${MAX_LUTS} 件までです。`);
  }

  const rawSteps = manifest.steps;
  if (rawSteps.length > MAX_STEPS) {
    throw new Error(`steps は最大 ${MAX_STEPS} 件までです。`);
  }
  const rawCustomParams = Array.isArray(manifest.customParams) ? manifest.customParams : [];

  const lutEntries = rawLuts.map((entry, index) => parsePipelineZipLutEntry(entry, index));
  const lutIdSet = new Set<string>();
  for (const entry of lutEntries) {
    if (lutIdSet.has(entry.id)) {
      throw new Error(`luts に重複IDがあります: ${entry.id}`);
    }
    lutIdSet.add(entry.id);
  }

  const loadedLuts: LutModel[] = [];
  for (const entry of lutEntries) {
    const pngBytes = files[entry.filename];
    if (!pngBytes) {
      throw new Error(`LUT「${entry.name}」の画像ファイル (${entry.filename}) がZIP内に見つかりません。`);
    }
    const lut = await adapter.createLutFromZipPngBytes(entry, pngBytes);
    loadedLuts.push(lut);
  }

  const customParams = rawCustomParams.map((entry, index) => parseCustomParamEntry(entry, index));
  const customParamIdSet = new Set<string>();
  for (const customParam of customParams) {
    if (customParamIdSet.has(customParam.id)) {
      throw new Error(`customParams に重複IDがあります: ${customParam.id}`);
    }
    customParamIdSet.add(customParam.id);
  }

  const loadedSteps = rawSteps.map((entry, index) => parsePipelineStepEntry(entry, index, customParamIdSet));
  const stepIdSet = new Set<string>();
  const fallbackLutId = loadedLuts[0].id;
  for (const step of loadedSteps) {
    if (stepIdSet.has(step.id)) {
      throw new Error(`steps に重複IDがあります: ${step.id}`);
    }
    stepIdSet.add(step.id);
    if (!lutIdSet.has(step.lutId)) {
      step.lutId = fallbackLutId;
    }
  }

  return { customParams, luts: loadedLuts, steps: loadedSteps };
}
