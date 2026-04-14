/**
 * Pipeline validators.
 * Pure validation, parse, and normalization functions for pipeline data.
 * No adapter dependencies, no side effects.
 */

import {
    isZipLikeFileDescriptor,
    parseNonEmptyText,
} from '../../shared/lutchain/lutchain-archive.ts';
import {
    BLEND_MODES,
    BLEND_OPS,
    CHANNELS,
    CUSTOM_PARAM_PREFIX,
    isBuiltinParamName,
    isCustomParamRef,
    parseCustomParamRef,
    type BlendMode,
    type BlendOp,
    type ChannelName,
    type ParamRef,
} from '../step/step-model.ts';

// ─────────────────────────────────────────────────────
// Re-export for callers that currently import from pipeline-model
// ─────────────────────────────────────────────────────
export { parseNonEmptyText };

// ─────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────

export const CUSTOM_PARAM_ID_RE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
export const MAX_CUSTOM_PARAM_LABEL_LENGTH = 40;

export const MAX_LUT_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_PIPELINE_FILE_BYTES = 64 * 1024 * 1024;
export const MAX_PIPELINE_IMAGE_SIDE = 4096;

// ─────────────────────────────────────────────────────
// Primitive validators
// ─────────────────────────────────────────────────────

export function isValidBlendOp(value: string): value is BlendOp {
  return BLEND_OPS.includes(value as BlendOp);
}

export function isValidChannelName(value: string): value is ChannelName {
  return CHANNELS.includes(value as ChannelName);
}

export function isCustomParamId(value: string): boolean {
  return CUSTOM_PARAM_ID_RE.test(value);
}

export function isValidParamName(value: string): value is ParamRef {
  return (
    isBuiltinParamName(value) ||
    (isCustomParamRef(value) && isCustomParamId(value.slice(CUSTOM_PARAM_PREFIX.length)))
  );
}

export function isValidBlendMode(value: string): value is BlendMode {
  return BLEND_MODES.some(mode => mode.key === value);
}

export function isZipLikeFile(file: File): boolean {
  return isZipLikeFileDescriptor(file);
}

// ─────────────────────────────────────────────────────
// ID parsers
// ─────────────────────────────────────────────────────

export function parseStepId(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const id = value.trim();
  if (id.length === 0 || id.length > 128) {
    return null;
  }
  return id;
}

export function parseLutId(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const lutId = value.trim();
  if (lutId.length === 0 || lutId.length > 128) {
    return null;
  }
  return lutId;
}

export function parseCustomParamId(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const customParamId = value.trim();
  if (!isCustomParamId(customParamId)) {
    return null;
  }
  return customParamId;
}

// ─────────────────────────────────────────────────────
// Custom param helpers
// ─────────────────────────────────────────────────────

export function buildCustomParamRef(paramId: string): ParamRef {
  if (!isCustomParamId(paramId)) {
    throw new Error(`カスタムパラメータIDが不正です: ${paramId}`);
  }
  return `${CUSTOM_PARAM_PREFIX}${paramId}`;
}

export function parseCustomParamLabel(value: unknown): string {
  return parseNonEmptyText(value, 'customParam.label', MAX_CUSTOM_PARAM_LABEL_LENGTH);
}

// ─────────────────────────────────────────────────────
// Numeric helpers
// ─────────────────────────────────────────────────────

export function normalizeCustomParamValue(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

// ─────────────────────────────────────────────────────
// File helpers
// ─────────────────────────────────────────────────────

const PIPELINE_DOWNLOAD_BASENAME = 'lutchainer-pipeline';
const PIPELINE_ARCHIVE_EXTENSION = '.lutchain';

function formatDatePart(value: number, digits: number): string {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error('日付情報が不正です。');
  }
  return String(value).padStart(digits, '0');
}

export function buildPipelineDownloadFilename(now: Date = new Date()): string {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('保存時刻の取得に失敗しました。');
  }
  const yyyy = formatDatePart(now.getFullYear(), 4);
  const mm = formatDatePart(now.getMonth() + 1, 2);
  const dd = formatDatePart(now.getDate(), 2);
  const hh = formatDatePart(now.getHours(), 2);
  const min = formatDatePart(now.getMinutes(), 2);
  const ss = formatDatePart(now.getSeconds(), 2);
  return `${PIPELINE_DOWNLOAD_BASENAME}-${yyyy}${mm}${dd}-${hh}${min}${ss}${PIPELINE_ARCHIVE_EXTENSION}`;
}

// ─────────────────────────────────────────────────────
// Re-exported for advanced callers
// ─────────────────────────────────────────────────────
export { isCustomParamRef, parseCustomParamRef };
