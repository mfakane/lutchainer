import { strToU8, unzipSync, zipSync } from 'fflate';
import {
  BLEND_MODES,
  BLEND_OPS,
  CHANNELS,
  DEFAULT_OPS,
  MAX_STEP_LABEL_LENGTH,
  type BlendMode,
  type BlendOp,
  type ChannelName,
  type Color,
  type LutModel,
  type ParamName,
  type StepModel,
} from '../step/step-model';

export interface ParamDef {
  key: ParamName;
  label: string;
  description: string;
}

export interface ParamGroupDef {
  key: string;
  label: string;
  description: string;
  tone: 'default' | 'feedback';
  params: ParamName[];
}

export type MaterialNumericKey =
  | 'specularStrength'
  | 'specularPower'
  | 'fresnelStrength'
  | 'fresnelPower';

export interface MaterialSettings {
  baseColor: Color;
  specularStrength: number;
  specularPower: number;
  fresnelStrength: number;
  fresnelPower: number;
}

export interface MaterialRangeBinding {
  key: MaterialNumericKey;
  inputId: string;
  outputId: string;
  min: number;
  max: number;
  fractionDigits: number;
  label: string;
}

export type LightAngleKey = 'azimuthDeg' | 'elevationDeg' | 'lightIntensity';

export interface LightSettings {
  azimuthDeg: number;
  elevationDeg: number;
  lightIntensity: number;
  lightColor: Color;
  ambientColor: Color;
  showGizmo: boolean;
}

export interface LightRangeBinding {
  key: LightAngleKey;
  inputId: string;
  outputId: string;
  min: number;
  max: number;
  fractionDigits: number;
  label: string;
}

export interface PipelineFileLutEntry {
  id: string;
  name: string;
  imageDataUrl: string;
  width: number;
  height: number;
}

export type PipelineStepOpsEntry = Partial<Record<ChannelName, BlendOp>>;

export interface PipelineStepEntry {
  id: number;
  lutId: string;
  label?: string;
  muted?: boolean;
  blendMode: BlendMode;
  xParam: ParamName;
  yParam: ParamName;
  ops?: PipelineStepOpsEntry;
}

export interface PipelineFileData {
  version: number;
  nextStepId: number;
  luts: PipelineFileLutEntry[];
  steps: PipelineStepEntry[];
}

export interface PipelineZipLutEntry {
  id: string;
  name: string;
  filename: string;
  width: number;
  height: number;
}

export interface PipelineZipData {
  version: number;
  nextStepId: number;
  luts: PipelineZipLutEntry[];
  steps: PipelineStepEntry[];
}

export interface LoadedPipelineData {
  nextStepId: number;
  luts: LutModel[];
  steps: StepModel[];
}

export interface CreatePipelineStepResult {
  step: StepModel | null;
  nextStepId: number;
  error: string | null;
}

export interface DuplicatePipelineStepResult {
  steps: StepModel[];
  duplicated: StepModel | null;
  nextStepId: number;
  error: string | null;
}

export interface RemoveLutFromPipelineResult {
  luts: LutModel[];
  steps: StepModel[];
  removed: LutModel | null;
  error: string | null;
}

export const PARAMS: ParamDef[] = [
  { key: 'lightness', label: 'Lightness (Lambert)', description: 'dot(N, L)' },
  { key: 'specular', label: 'Specular', description: 'pow(NdotH, specularPower) * specularStrength' },
  { key: 'halfLambert', label: 'Half-Lambert', description: '0.5 * dot(N, L) + 0.5' },
  { key: 'fresnel', label: 'Fresnel', description: 'pow(1 - dot(N, V), fresnelPower) * fresnelStrength' },
  { key: 'facing', label: 'Facing', description: 'dot(N, V)' },
  { key: 'nDotH', label: 'NdotH', description: 'dot(N, H), H = normalize(L + V)' },
  {
    key: 'linearDepth',
    label: 'Linear Depth',
    description: '((distance(C, P) - near) / (far - near)), near=|C|-1, far=|C|+1',
  },
  { key: 'r', label: 'R', description: 'Current color red channel' },
  { key: 'g', label: 'G', description: 'Current color green channel' },
  { key: 'b', label: 'B', description: 'Current color blue channel' },
  { key: 'h', label: 'Hue', description: 'Current color hue' },
  { key: 's', label: 'Saturation', description: 'Current color saturation' },
  { key: 'v', label: 'Value', description: 'Current color value' },
  { key: 'texU', label: 'U', description: 'Texture coordinate X' },
  { key: 'texV', label: 'V', description: 'Texture coordinate Y' },
];

export const PARAM_GROUPS: ParamGroupDef[] = [
  {
    key: 'lighting-derived',
    label: 'Lighting / Derived',
    description: 'ライティングや視線から計算される値',
    tone: 'default',
    params: ['lightness', 'specular', 'halfLambert', 'fresnel', 'facing', 'nDotH', 'linearDepth'],
  },
  {
    key: 'feedback-rgb',
    label: 'Previous RGB',
    description: '前回stepの色をそのまま参照するフィードバック入力',
    tone: 'feedback',
    params: ['r', 'g', 'b'],
  },
  {
    key: 'feedback-hsv',
    label: 'Previous HSV',
    description: '前回stepの色をHSV変換して参照するフィードバック入力',
    tone: 'feedback',
    params: ['h', 's', 'v'],
  },
  {
    key: 'uv',
    label: 'Texture UV',
    description: 'メッシュのUV座標',
    tone: 'default',
    params: ['texU', 'texV'],
  },
];

export const DEFAULT_MATERIAL_SETTINGS: MaterialSettings = {
  baseColor: [1, 1, 1],
  specularStrength: 0.4,
  specularPower: 24,
  fresnelStrength: 0.18,
  fresnelPower: 2.2,
};

export const DEFAULT_LIGHT_SETTINGS: LightSettings = {
  azimuthDeg: 0.0,
  elevationDeg: 50.0,
  lightIntensity: 1.0,
  lightColor: [1, 1, 1],
  ambientColor: [0, 0, 0],
  showGizmo: true,
};

export const STEP_PREVIEW_LIGHT_DIR: [number, number, number] = (() => {
  const raw: [number, number, number] = [-0.42, 0.74, 0.53];
  const length = Math.hypot(raw[0], raw[1], raw[2]);
  if (!Number.isFinite(length) || length < 1e-6) {
    return [0, 0.7071067812, 0.7071067812];
  }
  return [raw[0] / length, raw[1] / length, raw[2] / length];
})();

export const STEP_PREVIEW_VIEW_DIR: [number, number, number] = [0, 0, 1];

export const LIGHT_RANGE_BINDINGS: LightRangeBinding[] = [
  {
    key: 'azimuthDeg',
    inputId: 'light-azimuth',
    outputId: 'light-azimuth-value',
    min: -180,
    max: 180,
    fractionDigits: 0,
    label: 'Azimuth',
  },
  {
    key: 'elevationDeg',
    inputId: 'light-elevation',
    outputId: 'light-elevation-value',
    min: -85,
    max: 85,
    fractionDigits: 0,
    label: 'Elevation',
  },
  {
    key: 'lightIntensity',
    inputId: 'light-intensity',
    outputId: 'light-intensity-value',
    min: 0,
    max: 2,
    fractionDigits: 2,
    label: 'Intensity',
  },
];

export const MATERIAL_RANGE_BINDINGS: MaterialRangeBinding[] = [
  {
    key: 'specularStrength',
    inputId: 'mat-specular-strength',
    outputId: 'mat-specular-strength-value',
    min: 0,
    max: 2,
    fractionDigits: 2,
    label: 'Specular',
  },
  {
    key: 'specularPower',
    inputId: 'mat-specular-power',
    outputId: 'mat-specular-power-value',
    min: 1,
    max: 96,
    fractionDigits: 1,
    label: 'Spec Power',
  },
  {
    key: 'fresnelStrength',
    inputId: 'mat-fresnel-strength',
    outputId: 'mat-fresnel-strength-value',
    min: 0,
    max: 1.5,
    fractionDigits: 2,
    label: 'Fresnel',
  },
  {
    key: 'fresnelPower',
    inputId: 'mat-fresnel-power',
    outputId: 'mat-fresnel-power-value',
    min: 0.5,
    max: 8,
    fractionDigits: 2,
    label: 'Fresnel Power',
  },
];

export const MAX_STEPS = 32;
export const MAX_LUTS = 12;
export const MAX_LUT_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_PIPELINE_FILE_BYTES = 64 * 1024 * 1024;
export const MAX_PIPELINE_IMAGE_SIDE = 4096;
export const PIPELINE_FILE_VERSION = 1;
export const PIPELINE_ZIP_FILE_VERSION = 2;
const PIPELINE_DOWNLOAD_BASENAME = 'lutchainer-pipeline';
const PIPELINE_ARCHIVE_EXTENSION = '.lutchain';

function hasFiniteColor(value: Color): boolean {
  return Array.isArray(value)
    && value.length === 3
    && value.every(component => typeof component === 'number' && Number.isFinite(component));
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function rgbToHsv(c: Color): Color {
  const r = c[0];
  const g = c[1];
  const b = c[2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d > 1e-6) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  const s = max <= 1e-6 ? 0 : d / max;
  const v = max;
  return [clamp01(h), clamp01(s), clamp01(v)];
}

export function hsvToRgb(c: Color): Color {
  const h = (c[0] % 1 + 1) % 1;
  const s = clamp01(c[1]);
  const v = clamp01(c[2]);

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}

export function colorToHex(c: Color): string {
  const toHex = (value: number) => Math.round(clamp01(value) * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(c[0])}${toHex(c[1])}${toHex(c[2])}`;
}

export function parseHexColor(value: string): Color | null {
  if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
    return null;
  }

  return [
    parseInt(value.slice(1, 3), 16) / 255,
    parseInt(value.slice(3, 5), 16) / 255,
    parseInt(value.slice(5, 7), 16) / 255,
  ];
}

export function getLightDirectionWorld(lightSettings: LightSettings): [number, number, number] {
  if (
    typeof lightSettings !== 'object'
    || lightSettings === null
    || !Number.isFinite(lightSettings.azimuthDeg)
    || !Number.isFinite(lightSettings.elevationDeg)
  ) {
    return [0, 1, 0];
  }

  const azimuth = lightSettings.azimuthDeg * Math.PI / 180;
  const elevation = lightSettings.elevationDeg * Math.PI / 180;
  const cosElevation = Math.cos(elevation);

  const x = Math.sin(azimuth) * cosElevation;
  const y = Math.sin(elevation);
  const z = Math.cos(azimuth) * cosElevation;
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length < 1e-6) {
    return [0, 1, 0];
  }

  return [x / length, y / length, z / length];
}

export function uid(prefix: string): string {
  const trimmedPrefix = typeof prefix === 'string' ? prefix.trim() : '';
  const safePrefix = trimmedPrefix.length > 0 && trimmedPrefix.length <= 40 ? trimmedPrefix : 'item';
  return `${safePrefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isValidBlendOp(value: string): value is BlendOp {
  return BLEND_OPS.includes(value as BlendOp);
}

export function isValidChannelName(value: string): value is ChannelName {
  return CHANNELS.includes(value as ChannelName);
}

export function isValidParamName(value: string): value is ParamName {
  return PARAMS.some(param => param.key === value);
}

export function isValidBlendMode(value: string): value is BlendMode {
  return BLEND_MODES.some(mode => mode.key === value);
}

export function parseStepId(value: string | undefined): number | null {
  if (!value) return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '不明なエラーです。';
}

export function parsePositiveInteger(value: unknown, fieldName: string, min = 1, max = Number.MAX_SAFE_INTEGER): number {
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

export function isJsonLikeFile(file: File): boolean {
  const mimeType = file.type.trim().toLowerCase();
  const fileName = file.name.trim().toLowerCase();
  return mimeType === 'application/json'
    || mimeType === 'text/json'
    || fileName.endsWith('.json');
}

export function isZipLikeFile(file: File): boolean {
  const mimeType = file.type.trim().toLowerCase();
  const fileName = file.name.trim().toLowerCase();
  return mimeType === 'application/x-lutchain'
    || fileName.endsWith(PIPELINE_ARCHIVE_EXTENSION);
}

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

export function getParamLabel(param: ParamName): string {
  const found = PARAMS.find(p => p.key === param);
  return found ? found.label : param;
}

export function getParamDef(param: ParamName): ParamDef {
  const found = PARAMS.find(p => p.key === param);
  if (!found) {
    throw new Error(`未知のパラメータです: ${param}`);
  }
  return found;
}

export function getStepById(steps: StepModel[], stepId: number): StepModel | null {
  if (!Array.isArray(steps) || !Number.isInteger(stepId) || stepId <= 0) {
    return null;
  }
  return steps.find(step => step.id === stepId) ?? null;
}

export function getLutById(luts: LutModel[], lutId: string): LutModel | null {
  const validatedLutId = parseLutId(lutId);
  if (!Array.isArray(luts) || !validatedLutId) {
    return null;
  }
  return luts.find(lut => lut.id === validatedLutId) ?? null;
}

export function normalizeSteps(steps: StepModel[], luts: LutModel[]): void {
  if (!Array.isArray(steps) || !Array.isArray(luts) || luts.length === 0) {
    return;
  }

  const fallback = luts[0].id;
  for (const step of steps) {
    if (!getLutById(luts, step.lutId)) {
      step.lutId = fallback;
    }
  }
}

export function createPipelineStep(
  steps: StepModel[],
  luts: LutModel[],
  nextStepId: number,
): CreatePipelineStepResult {
  if (!Array.isArray(steps) || !Array.isArray(luts)) {
    return { step: null, nextStepId, error: 'Step または LUT の状態が不正です。' };
  }

  if (!Number.isSafeInteger(nextStepId) || nextStepId <= 0) {
    return { step: null, nextStepId, error: '次の Step ID が不正です。' };
  }

  if (steps.length >= MAX_STEPS) {
    return { step: null, nextStepId, error: `Step は最大 ${MAX_STEPS} 個までです。` };
  }

  const defaultLutId = luts[0]?.id ?? '';
  return {
    step: {
      id: nextStepId,
      lutId: defaultLutId,
      muted: false,
      blendMode: 'multiply',
      xParam: 'lightness',
      yParam: 'facing',
      ops: { ...DEFAULT_OPS },
    },
    nextStepId: nextStepId + 1,
    error: null,
  };
}

function buildDuplicatedStepLabel(source: StepModel, sourceIndex: number): string {
  const suffix = ' コピー';
  const sourceLabel = typeof source.label === 'string' ? source.label.trim() : '';
  const fallbackLabel = `Step ${sourceIndex + 1}`;
  const baseLabel = sourceLabel.length > 0 ? sourceLabel : fallbackLabel;
  const maxBaseLength = Math.max(1, MAX_STEP_LABEL_LENGTH - suffix.length);
  const clippedBase = baseLabel.length > maxBaseLength
    ? baseLabel.slice(0, maxBaseLength).trimEnd()
    : baseLabel;
  return `${clippedBase}${suffix}`;
}

export function duplicatePipelineStep(
  steps: StepModel[],
  stepId: number,
  nextStepId: number,
): DuplicatePipelineStepResult {
  if (!Array.isArray(steps)) {
    return { steps: [], duplicated: null, nextStepId, error: 'Step の状態が不正です。' };
  }

  if (!Number.isSafeInteger(stepId) || stepId <= 0) {
    return { steps: [...steps], duplicated: null, nextStepId, error: '複製対象の Step ID が不正です。' };
  }

  if (!Number.isSafeInteger(nextStepId) || nextStepId <= 0) {
    return { steps: [...steps], duplicated: null, nextStepId, error: '次の Step ID が不正です。' };
  }

  if (steps.length >= MAX_STEPS) {
    return { steps: [...steps], duplicated: null, nextStepId, error: `Step は最大 ${MAX_STEPS} 個までです。` };
  }

  const sourceIndex = steps.findIndex(step => step.id === stepId);
  if (sourceIndex < 0) {
    return { steps: [...steps], duplicated: null, nextStepId, error: `Step ${stepId} が見つかりません。` };
  }

  const source = steps[sourceIndex];
  const duplicated: StepModel = {
    ...source,
    id: nextStepId,
    label: buildDuplicatedStepLabel(source, sourceIndex),
    ops: { ...source.ops },
  };

  const nextSteps = [
    ...steps.slice(0, sourceIndex + 1),
    duplicated,
    ...steps.slice(sourceIndex + 1),
  ];

  return {
    steps: nextSteps,
    duplicated,
    nextStepId: nextStepId + 1,
    error: null,
  };
}

export function removeStepFromPipeline(steps: StepModel[], stepId: number): { steps: StepModel[]; removed: boolean } {
  if (!Array.isArray(steps) || !Number.isInteger(stepId) || stepId <= 0) {
    return { steps: Array.isArray(steps) ? [...steps] : [], removed: false };
  }

  const nextSteps = steps.filter(step => step.id !== stepId);
  return { steps: nextSteps, removed: nextSteps.length !== steps.length };
}

export function removeLutFromPipeline(
  luts: LutModel[],
  steps: StepModel[],
  lutId: string,
): RemoveLutFromPipelineResult {
  const validatedLutId = parseLutId(lutId);
  if (!Array.isArray(luts) || !Array.isArray(steps)) {
    return { luts: [], steps: [], removed: null, error: 'パイプライン状態が不正です。' };
  }

  if (!validatedLutId) {
    return { luts: [...luts], steps: [...steps], removed: null, error: '不正なLUT IDです。' };
  }

  if (luts.length <= 1) {
    return { luts: [...luts], steps: [...steps], removed: null, error: '最後のLUTは削除できません。' };
  }

  const removed = getLutById(luts, validatedLutId);
  if (!removed) {
    return { luts: [...luts], steps: [...steps], removed: null, error: '削除対象のLUTが見つかりません。' };
  }

  const nextLuts = luts.filter(lut => lut.id !== validatedLutId);
  const nextSteps = steps.map(step => ({ ...step, ops: { ...step.ops } }));
  normalizeSteps(nextSteps, nextLuts);

  return { luts: nextLuts, steps: nextSteps, removed, error: null };
}

export function createLutFromPainter(name: string, painter: (u: number, v: number) => Color): LutModel {
  const safeName = parseNonEmptyText(name, 'name');
  if (typeof painter !== 'function') {
    throw new Error('LUT painter が不正です。');
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('LUT キャンバスのコンテキスト取得に失敗しました。');
  }

  const imageData = ctx.createImageData(canvas.width, canvas.height);
  const d = imageData.data;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const u = x / (canvas.width - 1);
      const v = y / (canvas.height - 1);
      const c = painter(u, v);
      if (!hasFiniteColor(c)) {
        throw new Error('LUT painter が不正な色を返しました。');
      }
      const idx = (y * canvas.width + x) * 4;
      d[idx + 0] = Math.round(clamp01(c[0]) * 255);
      d[idx + 1] = Math.round(clamp01(c[1]) * 255);
      d[idx + 2] = Math.round(clamp01(c[2]) * 255);
      d[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return {
    id: uid('lut'),
    name: safeName,
    image: canvas,
    width: canvas.width,
    height: canvas.height,
    pixels: imageData.data,
    thumbUrl: canvas.toDataURL('image/png'),
  };
}

function createLutFromCanvas(name: string, srcCanvas: HTMLCanvasElement): LutModel {
  const safeName = parseNonEmptyText(name, 'name');
  if (!(srcCanvas instanceof HTMLCanvasElement)) {
    throw new Error('LUT 元画像が不正です。');
  }
  if (srcCanvas.width < 2 || srcCanvas.height < 2) {
    throw new Error('LUT 画像サイズが小さすぎます。2x2以上の画像を指定してください。');
  }

  const canvas = document.createElement('canvas');
  canvas.width = srcCanvas.width;
  canvas.height = srcCanvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('LUT キャンバス化に失敗しました。');

  ctx.drawImage(srcCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  return {
    id: uid('lut-file'),
    name: safeName,
    image: canvas,
    width: canvas.width,
    height: canvas.height,
    pixels: imageData.data,
    thumbUrl: canvas.toDataURL('image/png'),
  };
}

export function createBuiltinLuts(): LutModel[] {
  const lutA = createLutFromPainter('Cyan-Amber Sweep', (u, v) => {
    const h = clamp01(0.08 + u * 0.55 + (1 - v) * 0.1);
    const s = clamp01(0.4 + v * 0.6);
    const val = clamp01(0.25 + (1 - Math.abs(u - 0.5) * 1.4) * 0.75);
    return hsvToRgb([h, s, val]);
  });

  const lutB = createLutFromPainter('Soft Filmic', (u, v) => {
    const warm = [0.93, 0.68, 0.49] as Color;
    const cool = [0.41, 0.66, 0.86] as Color;
    const t = clamp01(0.15 + u * 0.85);
    const mix: Color = [
      warm[0] * (1 - t) + cool[0] * t,
      warm[1] * (1 - t) + cool[1] * t,
      warm[2] * (1 - t) + cool[2] * t,
    ];
    const lift = 0.25 + (1 - v) * 0.75;
    return [mix[0] * lift, mix[1] * lift, mix[2] * lift];
  });

  const lutC = createLutFromPainter('Split Tones', (u, v) => {
    const h = clamp01((u * 0.85 + v * 0.25) % 1);
    const s = clamp01(0.2 + Math.pow(v, 0.75) * 0.8);
    const val = clamp01(0.18 + (u * v) * 0.82);
    return hsvToRgb([h, s, val]);
  });

  return [lutA, lutB, lutC];
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`画像読み込みに失敗しました: ${file.name}`));
    };
    img.src = url;
  });
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = () => {
      reject(new Error('JSON内のLUT画像データを読み込めませんでした。'));
    };
    img.src = dataUrl;
  });
}

export async function createLutFromFile(file: File): Promise<LutModel> {
  if (!(file instanceof File)) {
    throw new Error('LUTファイル入力が不正です。');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error(`画像ファイルのみ指定できます: ${file.name}`);
  }
  if (file.size > MAX_LUT_FILE_BYTES) {
    throw new Error(`ファイルサイズが大きすぎます (${file.name})。上限は 12MB です。`);
  }

  const img = await loadImageFromFile(file);
  const maxSide = 512;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(2, Math.round(img.width * scale));
  const h = Math.max(2, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error(`LUT変換に失敗しました: ${file.name}`);
  }
  ctx.drawImage(img, 0, 0, w, h);

  return createLutFromCanvas(file.name, canvas);
}

export async function createLutFromDataUrl(entry: PipelineFileLutEntry): Promise<LutModel> {
  if (!isRecord(entry)) {
    throw new Error('LUT エントリが不正です。');
  }

  const img = await loadImageFromDataUrl(entry.imageDataUrl);
  if (img.width < 2 || img.height < 2) {
    throw new Error(`LUT「${entry.name}」の画像サイズが小さすぎます。2x2以上が必要です。`);
  }
  if (img.width > MAX_PIPELINE_IMAGE_SIDE || img.height > MAX_PIPELINE_IMAGE_SIDE) {
    throw new Error(`LUT「${entry.name}」の画像サイズが大きすぎます。最大 ${MAX_PIPELINE_IMAGE_SIDE}px です。`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error(`LUT「${entry.name}」のキャンバス生成に失敗しました。`);
  }

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  if (canvas.width !== entry.width || canvas.height !== entry.height) {
    throw new Error(`LUT「${entry.name}」の画像サイズがJSONの情報と一致しません。`);
  }

  return {
    id: entry.id,
    name: entry.name,
    image: canvas,
    width: canvas.width,
    height: canvas.height,
    pixels: imageData.data,
    thumbUrl: canvas.toDataURL('image/png'),
  };
}

function parsePipelineLutEntry(value: unknown, index: number): PipelineFileLutEntry {
  const fieldPrefix = `luts[${index}]`;
  if (!isRecord(value)) {
    throw new Error(`${fieldPrefix} はオブジェクトである必要があります。`);
  }

  const lutId = parseLutId(typeof value.id === 'string' ? value.id : undefined);
  if (!lutId) {
    throw new Error(`${fieldPrefix}.id が不正です。`);
  }

  const name = parseNonEmptyText(value.name, `${fieldPrefix}.name`);
  const imageDataUrl = parseNonEmptyText(value.imageDataUrl, `${fieldPrefix}.imageDataUrl`, 32 * 1024 * 1024);
  if (!imageDataUrl.startsWith('data:image/')) {
    throw new Error(`${fieldPrefix}.imageDataUrl は data:image/ 形式である必要があります。`);
  }

  const width = parsePositiveInteger(value.width, `${fieldPrefix}.width`, 2, MAX_PIPELINE_IMAGE_SIDE);
  const height = parsePositiveInteger(value.height, `${fieldPrefix}.height`, 2, MAX_PIPELINE_IMAGE_SIDE);

  return {
    id: lutId,
    name,
    imageDataUrl,
    width,
    height,
  };
}

function parsePipelineStepEntry(value: unknown, index: number): StepModel {
  const fieldPrefix = `steps[${index}]`;
  if (!isRecord(value)) {
    throw new Error(`${fieldPrefix} はオブジェクトである必要があります。`);
  }

  const id = parsePositiveInteger(value.id, `${fieldPrefix}.id`);

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

  const yParamRaw = value.yParam;
  if (typeof yParamRaw !== 'string' || !isValidParamName(yParamRaw)) {
    throw new Error(`${fieldPrefix}.yParam が不正です。`);
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

  return {
    id,
    lutId,
    label,
    muted,
    blendMode: blendModeRaw,
    xParam: xParamRaw,
    yParam: yParamRaw,
    ops,
  };
}

function compactPipelineStepOps(ops: Record<ChannelName, BlendOp>, fieldPrefix: string): PipelineStepOpsEntry | undefined {
  if (!isRecord(ops)) {
    throw new Error(`${fieldPrefix}.ops が不正です。`);
  }

  const compactOps: PipelineStepOpsEntry = {};
  for (const channel of CHANNELS) {
    const opRaw = ops[channel];
    if (typeof opRaw !== 'string' || !isValidBlendOp(opRaw)) {
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
  if (!isRecord(step)) {
    throw new Error(`${fieldPrefix} はオブジェクトである必要があります。`);
  }

  const id = parsePositiveInteger(step.id, `${fieldPrefix}.id`);

  const lutId = parseLutId(typeof step.lutId === 'string' ? step.lutId : undefined);
  if (!lutId) {
    throw new Error(`${fieldPrefix}.lutId が不正です。`);
  }

  let label: string | undefined;
  if (step.label !== undefined) {
    label = parseNonEmptyText(step.label, `${fieldPrefix}.label`, MAX_STEP_LABEL_LENGTH);
  }

  if (typeof step.muted !== 'boolean') {
    throw new Error(`${fieldPrefix}.muted が不正です。`);
  }

  const blendModeRaw = step.blendMode;
  if (typeof blendModeRaw !== 'string' || !isValidBlendMode(blendModeRaw)) {
    throw new Error(`${fieldPrefix}.blendMode が不正です。`);
  }

  const xParamRaw = step.xParam;
  if (typeof xParamRaw !== 'string' || !isValidParamName(xParamRaw)) {
    throw new Error(`${fieldPrefix}.xParam が不正です。`);
  }

  const yParamRaw = step.yParam;
  if (typeof yParamRaw !== 'string' || !isValidParamName(yParamRaw)) {
    throw new Error(`${fieldPrefix}.yParam が不正です。`);
  }

  const compactOps = compactPipelineStepOps(step.ops, fieldPrefix);

  const entry: PipelineStepEntry = {
    id,
    lutId,
    blendMode: blendModeRaw,
    xParam: xParamRaw,
    yParam: yParamRaw,
  };

  if (label) {
    entry.label = label;
  }

  if (step.muted) {
    entry.muted = true;
  }

  if (compactOps) {
    entry.ops = compactOps;
  }

  return entry;
}

export function serializePipeline(nextStepId: number, luts: LutModel[], steps: StepModel[]): PipelineFileData {
  if (!Number.isSafeInteger(nextStepId) || nextStepId <= 0) {
    throw new Error('nextStepId が不正です。');
  }
  if (!Array.isArray(luts) || !Array.isArray(steps)) {
    throw new Error('パイプライン状態が不正です。');
  }

  return {
    version: PIPELINE_FILE_VERSION,
    nextStepId,
    luts: luts.map(lut => ({
      id: lut.id,
      name: lut.name,
      imageDataUrl: lut.thumbUrl,
      width: lut.width,
      height: lut.height,
    })),
    steps: steps.map((step, index) => serializePipelineStepEntry(step, index)),
  };
}

export async function loadPipelineData(payload: unknown): Promise<LoadedPipelineData> {
  if (!isRecord(payload)) {
    throw new Error('JSONルートはオブジェクトである必要があります。');
  }

  const version = parsePositiveInteger(payload.version, 'version');
  if (version !== PIPELINE_FILE_VERSION) {
    throw new Error(`未対応のパイプラインバージョンです: ${version}`);
  }

  const parsedNextStepId = parsePositiveInteger(payload.nextStepId, 'nextStepId');

  const rawLuts = payload.luts;
  if (!Array.isArray(rawLuts)) {
    throw new Error('luts は配列である必要があります。');
  }
  if (rawLuts.length === 0) {
    throw new Error('luts が空です。1件以上必要です。');
  }
  if (rawLuts.length > MAX_LUTS) {
    throw new Error(`luts は最大 ${MAX_LUTS} 件までです。`);
  }

  const rawSteps = payload.steps;
  if (!Array.isArray(rawSteps)) {
    throw new Error('steps は配列である必要があります。');
  }
  if (rawSteps.length > MAX_STEPS) {
    throw new Error(`steps は最大 ${MAX_STEPS} 件までです。`);
  }

  const lutEntries = rawLuts.map((entry, index) => parsePipelineLutEntry(entry, index));
  const lutIdSet = new Set<string>();
  for (const lutEntry of lutEntries) {
    if (lutIdSet.has(lutEntry.id)) {
      throw new Error(`luts に重複IDがあります: ${lutEntry.id}`);
    }
    lutIdSet.add(lutEntry.id);
  }

  const loadedLuts: LutModel[] = [];
  for (const lutEntry of lutEntries) {
    const lut = await createLutFromDataUrl(lutEntry);
    loadedLuts.push(lut);
  }

  const loadedSteps = rawSteps.map((entry, index) => parsePipelineStepEntry(entry, index));
  const stepIdSet = new Set<number>();
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

  const maxStepId = loadedSteps.reduce((maxId, step) => Math.max(maxId, step.id), 0);
  return {
    luts: loadedLuts,
    steps: loadedSteps,
    nextStepId: Math.max(parsedNextStepId, maxStepId + 1),
  };
}

// ---------------------------------------------------------------------------
// ZIP形式の保存・読み込み
// ---------------------------------------------------------------------------

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('PNG変換に失敗しました。'));
        return;
      }
      blob.arrayBuffer()
        .then(ab => resolve(new Uint8Array(ab)))
        .catch(reject);
    }, 'image/png');
  });
}

export async function serializePipelineAsZip(
  nextStepId: number,
  luts: LutModel[],
  steps: StepModel[],
  previewPngBytes?: Uint8Array,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(nextStepId) || nextStepId <= 0) {
    throw new Error('nextStepId が不正です。');
  }
  if (!Array.isArray(luts) || !Array.isArray(steps)) {
    throw new Error('パイプライン状態が不正です。');
  }

  const zipFiles: Record<string, Uint8Array> = {};
  const lutEntries: PipelineZipLutEntry[] = [];

  for (const lut of luts) {
    const filename = `luts/${lut.id}.png`;
    const pngBytes = await canvasToPngBytes(lut.image);
    zipFiles[filename] = pngBytes;
    lutEntries.push({
      id: lut.id,
      name: lut.name,
      filename,
      width: lut.width,
      height: lut.height,
    });
  }

  const manifest: PipelineZipData = {
    version: PIPELINE_ZIP_FILE_VERSION,
    nextStepId,
    luts: lutEntries,
    steps: steps.map((step, index) => serializePipelineStepEntry(step, index)),
  };

  if (previewPngBytes instanceof Uint8Array && previewPngBytes.length > 0) {
    zipFiles['preview.png'] = previewPngBytes;
  }

  zipFiles['pipeline.json'] = strToU8(JSON.stringify(manifest, null, 2));
  return zipSync(zipFiles);
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

  return { id: lutId, name, filename, width, height };
}

async function createLutFromZipPngBytes(
  entry: PipelineZipLutEntry,
  pngBytes: Uint8Array,
): Promise<LutModel> {
  const blob = new Blob([(pngBytes.buffer as ArrayBuffer).slice(pngBytes.byteOffset, pngBytes.byteOffset + pngBytes.byteLength)], { type: 'image/png' });
  const url = URL.createObjectURL(blob);

  let img: HTMLImageElement;
  try {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`LUT「${entry.name}」の画像読み込みに失敗しました。`));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }

  if (img.width < 2 || img.height < 2) {
    throw new Error(`LUT「${entry.name}」の画像サイズが小さすぎます。2x2以上が必要です。`);
  }
  if (img.width > MAX_PIPELINE_IMAGE_SIDE || img.height > MAX_PIPELINE_IMAGE_SIDE) {
    throw new Error(`LUT「${entry.name}」の画像サイズが大きすぎます。最大 ${MAX_PIPELINE_IMAGE_SIDE}px です。`);
  }
  if (img.width !== entry.width || img.height !== entry.height) {
    throw new Error(`LUT「${entry.name}」の画像サイズがmanifestの情報と一致しません。`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error(`LUT「${entry.name}」のキャンバス生成に失敗しました。`);
  }

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  return {
    id: entry.id,
    name: entry.name,
    image: canvas,
    width: canvas.width,
    height: canvas.height,
    pixels: imageData.data,
    thumbUrl: canvas.toDataURL('image/png'),
  };
}

export async function loadPipelineFromZip(data: ArrayBuffer): Promise<LoadedPipelineData> {
  if (!(data instanceof ArrayBuffer)) {
    throw new Error('.lutchain データが不正です。');
  }

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(data));
  } catch (err) {
    throw new Error(`保存ファイル（.lutchain）を開けませんでした: ${toErrorMessage(err)}`);
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

  const version = parsePositiveInteger(payload.version, 'version');
  if (version !== PIPELINE_ZIP_FILE_VERSION) {
    throw new Error(`未対応のパイプラインバージョンです: ${version}`);
  }

  const parsedNextStepId = parsePositiveInteger(payload.nextStepId, 'nextStepId');

  const rawLuts = payload.luts;
  if (!Array.isArray(rawLuts)) {
    throw new Error('luts は配列である必要があります。');
  }
  if (rawLuts.length === 0) {
    throw new Error('luts が空です。1件以上必要です。');
  }
  if (rawLuts.length > MAX_LUTS) {
    throw new Error(`luts は最大 ${MAX_LUTS} 件までです。`);
  }

  const rawSteps = payload.steps;
  if (!Array.isArray(rawSteps)) {
    throw new Error('steps は配列である必要があります。');
  }
  if (rawSteps.length > MAX_STEPS) {
    throw new Error(`steps は最大 ${MAX_STEPS} 件までです。`);
  }

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
    const lut = await createLutFromZipPngBytes(entry, pngBytes);
    loadedLuts.push(lut);
  }

  const loadedSteps = rawSteps.map((entry, index) => parsePipelineStepEntry(entry, index));
  const stepIdSet = new Set<number>();
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

  const maxStepId = loadedSteps.reduce((maxId, step) => Math.max(maxId, step.id), 0);
  return {
    luts: loadedLuts,
    steps: loadedSteps,
    nextStepId: Math.max(parsedNextStepId, maxStepId + 1),
  };
}