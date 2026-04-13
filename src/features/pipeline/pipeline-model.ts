import type { ParamGroupDescriptionTranslationKey } from '../../shared/i18n/browser-translation-contract.ts';
import {
  buildPipelineArchiveManifest,
  isRecord,
  isZipLikeFileDescriptor,
  parseNonEmptyText,
  parsePipelineArchive,
  parsePositiveInteger,
  PIPELINE_ZIP_FILE_VERSION,
  serializePipelineArchive,
  type PipelineZipLutEntry,
} from '../../shared/lutchain/lutchain-archive.ts';
import {
  LUT_EDITOR_DEFAULT_HEIGHT,
  LUT_EDITOR_DEFAULT_WIDTH,
  type ColorRamp,
  type ColorRamp2dLutData,
  type ColorStop
} from '../lut-editor/lut-editor-model.ts';
import {
  BLEND_MODES,
  BLEND_OPS,
  CHANNELS,
  CUSTOM_PARAM_PREFIX,
  DEFAULT_OPS,
  isBuiltinParamName,
  isCustomParamRef,
  MAX_STEP_LABEL_LENGTH,
  parseCustomParamRef,
  type BlendMode,
  type BlendOp,
  type ChannelName,
  type Color,
  type ColorWithAlpha,
  type ColorWithHasChroma,
  type CustomParamModel,
  type LutModel,
  type ParamName,
  type ParamRef,
  type StepModel
} from '../step/step-model.ts';
import { MAX_LUTS, MAX_STEPS } from './pipeline-constants.ts';
export {
  parseNonEmptyText,
  toErrorMessage,
  type PipelineStepEntry,
  type PipelineStepOpsEntry,
  type PipelineZipData,
  type PipelineZipLutEntry
} from '../../shared/lutchain/lutchain-archive.ts';

export interface ParamDef {
  key: ParamRef;
  label: string;
  description: string;
}

export interface ParamGroupDef {
  key: string;
  label: string;
  descriptionKey: ParamGroupDescriptionTranslationKey;
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

export interface LoadedPipelineData {
  luts: LutModel[];
  steps: StepModel[];
  customParams: CustomParamModel[];
}

export interface CreatePipelineStepResult {
  step: StepModel | null;
  error: string | null;
}

export interface DuplicatePipelineStepResult {
  steps: StepModel[];
  duplicated: StepModel | null;
  error: string | null;
}

export interface RemoveLutFromPipelineResult {
  luts: LutModel[];
  steps: StepModel[];
  removed: LutModel | null;
  error: string | null;
}

export interface CreateCustomParamResult {
  customParam: CustomParamModel | null;
  error: string | null;
}

export interface PipelineImageAdapter {
  createLutFromPainter: (name: string, painter: (u: number, v: number) => ColorWithAlpha) => LutModel;
  createLutFromFile: (file: File) => Promise<LutModel>;
  canvasToPngBytes: (canvas: HTMLCanvasElement) => Promise<Uint8Array>;
  createLutFromZipPngBytes: (entry: PipelineZipLutEntry, pngBytes: Uint8Array) => Promise<LutModel>;
}

let pipelineImageAdapter: PipelineImageAdapter | null = null;

function assertValidPipelineImageAdapter(adapter: PipelineImageAdapter): void {
  if (!adapter || typeof adapter !== 'object') {
    throw new Error('PipelineImageAdapter が不正です。');
  }

  if (typeof adapter.createLutFromPainter !== 'function') {
    throw new Error('PipelineImageAdapter.createLutFromPainter が不正です。');
  }
  if (typeof adapter.createLutFromFile !== 'function') {
    throw new Error('PipelineImageAdapter.createLutFromFile が不正です。');
  }
  if (typeof adapter.canvasToPngBytes !== 'function') {
    throw new Error('PipelineImageAdapter.canvasToPngBytes が不正です。');
  }
  if (typeof adapter.createLutFromZipPngBytes !== 'function') {
    throw new Error('PipelineImageAdapter.createLutFromZipPngBytes が不正です。');
  }
}

export function configurePipelineImageAdapter(adapter: PipelineImageAdapter): void {
  assertValidPipelineImageAdapter(adapter);
  pipelineImageAdapter = adapter;
}

function getPipelineImageAdapter(): PipelineImageAdapter {
  if (!pipelineImageAdapter) {
    throw new Error('Pipeline image adapter is not configured.');
  }
  return pipelineImageAdapter;
}

export const PARAMS: ParamDef[] = [
  { key: 'lightness', label: 'Lightness (Lambert)', description: 'dot(N, L)' },
  { key: 'specular', label: 'Specular', description: 'pow(NdotH, specularPower) * specularStrength' },
  { key: 'halfLambert', label: 'Half-Lambert', description: 'pow(0.5 * dot(N, L) + 0.5, 2.0)' },
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
  { key: 'zero', label: 'Zero', description: 'Constant 0' },
  { key: 'one', label: 'One', description: 'Constant 1' },
];

export const CUSTOM_PARAM_ID_RE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
export const MAX_CUSTOM_PARAM_LABEL_LENGTH = 40;

export const PARAM_GROUPS: ParamGroupDef[] = [
  {
    key: 'lighting-derived',
    label: 'Lighting / Derived',
    descriptionKey: 'pipeline.paramGroup.lightingDerivedDesc',
    tone: 'default',
    params: ['lightness', 'specular', 'halfLambert', 'fresnel', 'facing', 'nDotH', 'linearDepth'],
  },
  {
    key: 'feedback-rgb',
    label: 'Previous RGB',
    descriptionKey: 'pipeline.paramGroup.feedbackRgbDesc',
    tone: 'feedback',
    params: ['r', 'g', 'b'],
  },
  {
    key: 'feedback-hsv',
    label: 'Previous HSV',
    descriptionKey: 'pipeline.paramGroup.feedbackHsvDesc',
    tone: 'feedback',
    params: ['h', 's', 'v'],
  },
  {
    key: 'uv',
    label: 'Texture UV',
    descriptionKey: 'pipeline.paramGroup.uvDesc',
    tone: 'default',
    params: ['texU', 'texV'],
  },
  {
    key: 'constant',
    label: 'Constant',
    descriptionKey: 'pipeline.paramGroup.constantDesc',
    tone: 'default',
    params: ['zero', 'one'],
  },
];

export const DEFAULT_MATERIAL_SETTINGS: MaterialSettings = {
  baseColor: [0.9, 0.9, 0.9],
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

export const MAX_LUT_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_PIPELINE_FILE_BYTES = 64 * 1024 * 1024;
export const MAX_PIPELINE_IMAGE_SIDE = 4096;
const PIPELINE_DOWNLOAD_BASENAME = 'lutchainer-pipeline';
const PIPELINE_ARCHIVE_EXTENSION = '.lutchain';

function hasFiniteColor(value: ColorWithAlpha): boolean {
  if (!Array.isArray(value) || value.length < 3 || value.length > 4) return false;
  if (!value.slice(0, 3).every(c => typeof c === 'number' && Number.isFinite(c))) return false;
  if (value.length === 4 && (typeof value[3] !== 'number' || !Number.isFinite(value[3]))) return false;
  return true;
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function rgbToHsv(c: Color): ColorWithHasChroma {
  const r = c[0];
  const g = c[1];
  const b = c[2];
  const maxValue = Math.max(r, g, b);
  const minValue = Math.min(r, g, b);
  const delta = maxValue - minValue;

  let hue = 0.0;
  if (delta > 1.0e-6) {
    if (maxValue <= r) {
      hue = ((g - b) / delta + (g < b ? 6.0 : 0.0)) / 6.0;
    } else if (maxValue <= g) {
      hue = ((b - r) / delta + 2.0) / 6.0;
    } else if (maxValue <= b) {
      hue = ((r - g) / delta + 4.0) / 6.0;
    }
  }

  const saturation = maxValue <= 1.0e-6 ? 0.0 : delta / maxValue;
  const value = maxValue;
  const hasChroma = delta > 1.0e-6;
  return [clamp01(hue), clamp01(saturation), clamp01(value), hasChroma];
}

export function hsvToRgb(c: ColorWithHasChroma): Color {
  const saturation = clamp01(c[1]);
  const value = clamp01(c[2]);
  const hasChroma = c[3] ?? saturation > 1.0e-6;

  if (saturation <= 1.0e-6 || !hasChroma) {
    return [value, value, value];
  }

  const hue = c[0] - Math.floor(c[0]);
  const cVal = value * saturation;
  const x = cVal * (1.0 - Math.abs((hue * 6.0) % 2.0 - 1.0));
  const m = value - cVal;
  const cM = cVal + m;
  const xM = x + m;

  const sectorFloat = Math.floor(hue * 6.0);
  const sector = sectorFloat % 6;

  switch (sector) {
    case 0:
      return [cM, xM, m];
    case 1:
      return [xM, cM, m];
    case 2:
      return [m, cM, xM];
    case 3:
      return [m, xM, cM];
    case 4:
      return [xM, m, cM];
    default:
      return [cM, m, xM];
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

export function isCustomParamId(value: string): boolean {
  return CUSTOM_PARAM_ID_RE.test(value);
}

export function buildCustomParamRef(paramId: string): ParamRef {
  if (!isCustomParamId(paramId)) {
    throw new Error(`カスタムパラメータIDが不正です: ${paramId}`);
  }
  return `${CUSTOM_PARAM_PREFIX}${paramId}`;
}

export function isValidParamName(value: string): value is ParamRef {
  return isBuiltinParamName(value) || (isCustomParamRef(value) && isCustomParamId(value.slice(CUSTOM_PARAM_PREFIX.length)));
}

export function isValidBlendMode(value: string): value is BlendMode {
  return BLEND_MODES.some(mode => mode.key === value);
}

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

export function normalizeCustomParamValue(value: number): number {
  return clamp01(Number.isFinite(value) ? value : 0);
}

export function parseCustomParamLabel(value: unknown): string {
  return parseNonEmptyText(value, 'customParam.label', MAX_CUSTOM_PARAM_LABEL_LENGTH);
}

export function isZipLikeFile(file: File): boolean {
  return isZipLikeFileDescriptor(file);
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

export function getParamLabel(param: ParamRef, customParams: readonly CustomParamModel[] = []): string {
  if (isCustomParamRef(param)) {
    const customParamId = parseCustomParamRef(param);
    const customParam = customParamId
      ? customParams.find(candidate => candidate.id === customParamId)
      : null;
    return customParam?.label ?? param;
  }
  const found = PARAMS.find(p => p.key === param);
  return found ? found.label : param;
}

export function getParamDef(param: ParamRef, customParams: readonly CustomParamModel[] = []): ParamDef {
  if (isCustomParamRef(param)) {
    const customParamId = parseCustomParamRef(param);
    const customParam = customParamId
      ? customParams.find(candidate => candidate.id === customParamId)
      : null;
    if (!customParam) {
      throw new Error(`未知のカスタムパラメータです: ${param}`);
    }
    return {
      key: param,
      label: customParam.label,
      description: `Custom float input (${customParam.id})`,
    };
  }
  const found = PARAMS.find(p => p.key === param);
  if (!found) {
    throw new Error(`未知のパラメータです: ${param}`);
  }
  return found;
}

export function getStepById(steps: StepModel[], stepId: string): StepModel | null {
  const parsedStepId = parseStepId(stepId);
  if (!Array.isArray(steps) || !parsedStepId) {
    return null;
  }
  return steps.find(step => step.id === parsedStepId) ?? null;
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
): CreatePipelineStepResult {
  if (!Array.isArray(steps) || !Array.isArray(luts)) {
    return { step: null, error: 'Step または LUT の状態が不正です。' };
  }

  if (steps.length >= MAX_STEPS) {
    return { step: null, error: `Step は最大 ${MAX_STEPS} 個までです。` };
  }

  const defaultLutId = luts[0]?.id ?? '';
  return {
    step: {
      id: uid('step'),
      lutId: defaultLutId,
      muted: false,
      blendMode: 'multiply',
      xParam: 'lightness',
      yParam: 'facing',
      ops: { ...DEFAULT_OPS },
    },
    error: null,
  };
}

export function createCustomParam(customParams: CustomParamModel[]): CreateCustomParamResult {
  if (!Array.isArray(customParams)) {
    return { customParam: null, error: 'Custom Param の状態が不正です。' };
  }

  const generateId = () => {
    let id = Math.random().toString(36).slice(2, 8);
    while (!CUSTOM_PARAM_ID_RE.test(id)) id = Math.random().toString(36).slice(2, 8);
    return id;
  }

  let suffix = customParams.length + 1;
  let id = generateId();
  while (customParams.some(param => param.id === id)) {
    suffix += 1;
    id = generateId();
  }

  return {
    customParam: {
      id,
      label: `Param ${suffix}`,
      defaultValue: 0.5,
    },
    error: null,
  };
}

export function canRemoveCustomParam(steps: readonly StepModel[], paramId: string): boolean {
  const paramRef = buildCustomParamRef(paramId);
  return !steps.some(step => step.xParam === paramRef || step.yParam === paramRef);
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
  stepId: string,
): DuplicatePipelineStepResult {
  if (!Array.isArray(steps)) {
    return { steps: [], duplicated: null, error: 'Step の状態が不正です。' };
  }

  const parsedStepId = parseStepId(stepId);
  if (!parsedStepId) {
    return { steps: [...steps], duplicated: null, error: '複製対象の Step ID が不正です。' };
  }

  if (steps.length >= MAX_STEPS) {
    return { steps: [...steps], duplicated: null, error: `Step は最大 ${MAX_STEPS} 個までです。` };
  }

  const sourceIndex = steps.findIndex(step => step.id === parsedStepId);
  if (sourceIndex < 0) {
    return { steps: [...steps], duplicated: null, error: `Step ${parsedStepId} が見つかりません。` };
  }

  const source = steps[sourceIndex];
  const duplicated: StepModel = {
    ...source,
    id: uid('step'),
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
    error: null,
  };
}

export function removeStepFromPipeline(steps: StepModel[], stepId: string): { steps: StepModel[]; removed: boolean } {
  const parsedStepId = parseStepId(stepId);
  if (!Array.isArray(steps) || !parsedStepId) {
    return { steps: Array.isArray(steps) ? [...steps] : [], removed: false };
  }

  const nextSteps = steps.filter(step => step.id !== parsedStepId);
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

export function createLutFromPainter(name: string, painter: (u: number, v: number) => ColorWithAlpha): LutModel {
  const safeName = parseNonEmptyText(name, 'name');
  if (typeof painter !== 'function') {
    throw new Error('LUT painter が不正です。');
  }
  return getPipelineImageAdapter().createLutFromPainter(safeName, painter);
}

function interpolateBuiltinRampStops(stops: readonly ColorStop[], t: number): [number, number, number, number] {
  if (stops.length === 0) return [0, 0, 0, 1];
  if (stops.length === 1) {
    const stop = stops[0]!;
    return [stop.color[0], stop.color[1], stop.color[2], stop.alpha];
  }

  const clamped = clamp01(t);
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  if (clamped <= first.position) return [first.color[0], first.color[1], first.color[2], first.alpha];
  if (clamped >= last.position) return [last.color[0], last.color[1], last.color[2], last.alpha];

  for (let index = 0; index < stops.length - 1; index++) {
    const a = stops[index]!;
    const b = stops[index + 1]!;
    if (clamped < a.position || clamped > b.position) {
      continue;
    }
    const span = b.position - a.position;
    const localT = span > 0 ? (clamped - a.position) / span : 0;
    return [
      a.color[0] + (b.color[0] - a.color[0]) * localT,
      a.color[1] + (b.color[1] - a.color[1]) * localT,
      a.color[2] + (b.color[2] - a.color[2]) * localT,
      a.alpha + (b.alpha - a.alpha) * localT,
    ];
  }

  return [last.color[0], last.color[1], last.color[2], last.alpha];
}

function sampleBuiltinRampData(data: ColorRamp2dLutData, u: number, v: number): [number, number, number, number] {
  const ramps = data.ramps;
  if (ramps.length === 0) return [0, 0, 0, 1];
  if (ramps.length === 1) return interpolateBuiltinRampStops(ramps[0]!.stops, u);

  const clamped = clamp01(v);
  const first = ramps[0]!;
  const last = ramps[ramps.length - 1]!;
  if (clamped <= first.position) return interpolateBuiltinRampStops(first.stops, u);
  if (clamped >= last.position) return interpolateBuiltinRampStops(last.stops, u);

  for (let index = 0; index < ramps.length - 1; index++) {
    const a = ramps[index]!;
    const b = ramps[index + 1]!;
    if (clamped < a.position || clamped > b.position) {
      continue;
    }
    const lo = interpolateBuiltinRampStops(a.stops, u);
    const hi = interpolateBuiltinRampStops(b.stops, u);
    const span = b.position - a.position;
    const localT = span > 0 ? (clamped - a.position) / span : 0;
    return [
      lo[0] + (hi[0] - lo[0]) * localT,
      lo[1] + (hi[1] - lo[1]) * localT,
      lo[2] + (hi[2] - lo[2]) * localT,
      lo[3] + (hi[3] - lo[3]) * localT,
    ];
  }

  return interpolateBuiltinRampStops(last.stops, u);
}

function createBuiltinRampData(name: string, rampStopResolution: number, painter: (u: number, v: number) => ColorWithAlpha): ColorRamp2dLutData {
  const ramps: ColorRamp[] = [];

  for (let rampIndex = 0; rampIndex < rampStopResolution; rampIndex++) {
    const v = rampStopResolution > 1 ? rampIndex / (rampStopResolution - 1) : 0;
    const stops: ColorStop[] = [];
    for (let stopIndex = 0; stopIndex < rampStopResolution; stopIndex++) {
      const u = rampStopResolution > 1 ? stopIndex / (rampStopResolution - 1) : 0;
      const color = painter(u, v);
      if (!hasFiniteColor(color)) {
        throw new Error('Builtin LUT painter が不正な色を返しました。');
      }
      stops.push({
        id: uid('stop'),
        position: u,
        color: [clamp01(color[0]), clamp01(color[1]), clamp01(color[2])],
        alpha: clamp01(color[3] ?? 1),
      });
    }
    ramps.push({
      id: uid('ramp'),
      position: v,
      stops,
    });
  }

  return {
    name,
    width: LUT_EDITOR_DEFAULT_WIDTH,
    height: LUT_EDITOR_DEFAULT_HEIGHT,
    ramps,
  };
}

function createBuiltinEditableLut(name: string, rampStopResolution: number, painter: (u: number, v: number) => ColorWithAlpha): LutModel {
  const ramp2dData = createBuiltinRampData(name, rampStopResolution, painter);
  return createBuiltinEditableLutFromRampData(ramp2dData);
}

function createBuiltinEditableLutFromRampData(ramp2dData: ColorRamp2dLutData): LutModel {
  const lut = createLutFromPainter(ramp2dData.name, (u, v) => {
    const [r, g, b, a] = sampleBuiltinRampData(ramp2dData, u, v);
    return [r, g, b, a];
  });
  return {
    ...lut,
    ramp2dData,
  };
}

export function createBuiltinLuts(): LutModel[] {
  const lutA = createBuiltinEditableLut('Cyan-Amber Sweep', 4, (u, v) => {
    const h = clamp01(0.08 + u * 0.55 + (1 - v) * 0.1);
    const s = clamp01(0.4 + v * 0.6);
    const val = clamp01(0.25 + (1 - Math.abs(u - 0.5) * 1.4) * 0.75);
    return hsvToRgb([h, s, val]);
  });

  const lutB = createBuiltinEditableLut('Soft Filmic', 2, (u, v) => {
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

  const lutC = createBuiltinEditableLut('Split Tones', 8, (u, v) => {
    const h = clamp01((u * 0.85 + v * 0.25) % 1);
    const s = clamp01(0.2 + Math.pow(v, 0.75) * 0.8);
    const val = clamp01(0.18 + (u * v) * 0.82);
    return hsvToRgb([h, s, val]);
  });

  return [lutA, lutB, lutC];
}

export async function createLutFromFile(file: File): Promise<LutModel> {
  if (!isRecord(file) || typeof file.name !== 'string' || typeof file.type !== 'string' || !Number.isFinite(file.size)) {
    throw new Error('LUTファイル入力が不正です。');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error(`画像ファイルのみ指定できます: ${file.name}`);
  }
  if (file.size > MAX_LUT_FILE_BYTES) {
    throw new Error(`ファイルサイズが大きすぎます (${file.name})。上限は 12MB です。`);
  }

  return getPipelineImageAdapter().createLutFromFile(file);
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

  // id can be either number or string for backward compatibility, but it will be normalized to string in the model.
  const id = typeof value.id === 'number'
    ? String(parsePositiveInteger(value.id, `${fieldPrefix}.id`))
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

// ---------------------------------------------------------------------------
// ZIP形式の保存・読み込み
// ---------------------------------------------------------------------------

export async function serializePipelineAsZip(
  luts: LutModel[],
  steps: StepModel[],
  customParams: CustomParamModel[] = [],
  previewPngBytes?: Uint8Array,
): Promise<Uint8Array> {
  if (!Array.isArray(luts) || !Array.isArray(steps) || !Array.isArray(customParams)) {
    throw new Error('パイプライン状態が不正です。');
  }

  const zipFiles: Record<string, Uint8Array> = {};
  const lutEntries: PipelineZipLutEntry[] = [];

  for (const lut of luts) {
    const filename = `luts/${lut.id}.png`;
    const pngBytes = await getPipelineImageAdapter().canvasToPngBytes(lut.image);
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
        return { id: stop.id as string, position: stop.position as number, color: [r, g, b] as [number, number, number], alpha: stop.alpha as number };
      });

      if (stops.some((s) => s === null)) return null;
      return { id: ramp.id as string, position: ramp.position as number, stops: stops as NonNullable<typeof stops[number]>[] };
    });

    if (ramps.some((r) => r === null)) return undefined;

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

export async function loadPipelineFromZip(data: ArrayBuffer): Promise<LoadedPipelineData> {
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
    const lut = await getPipelineImageAdapter().createLutFromZipPngBytes(entry, pngBytes);
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

  return {
    customParams,
    luts: loadedLuts,
    steps: loadedSteps,
  };
}
