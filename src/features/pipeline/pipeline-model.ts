import type { ParamGroupDescriptionTranslationKey } from '../../shared/i18n/browser-translation-contract.ts';
import { isRecord, parseNonEmptyText, type PipelineZipLutEntry } from '../../shared/lutchain/lutchain-archive.ts';
import { clamp01, hsvToRgb } from '../../shared/utils/color.ts';
import {
  LUT_EDITOR_DEFAULT_HEIGHT,
  LUT_EDITOR_DEFAULT_WIDTH,
  type ColorRamp,
  type ColorRamp2dLutData,
  type ColorStop,
} from '../lut-editor/lut-editor-model.ts';
import {
  DEFAULT_OPS,
  isCustomParamRef,
  MAX_STEP_LABEL_LENGTH,
  parseCustomParamRef,
  type Color,
  type ColorWithAlpha,
  type CustomParamModel,
  type LutModel,
  type ParamName,
  type ParamRef,
  type StepModel,
} from '../step/step-model.ts';
import { MAX_STEPS } from './pipeline-constants.ts';
import {
  buildCustomParamRef,
  CUSTOM_PARAM_ID_RE,
  MAX_LUT_FILE_BYTES,
  parseLutId,
  parseStepId
} from './pipeline-validators.ts';
export {
  parseNonEmptyText,
  toErrorMessage,
  type PipelineStepEntry,
  type PipelineStepOpsEntry,
  type PipelineZipData,
  type PipelineZipLutEntry
} from '../../shared/lutchain/lutchain-archive.ts';
export {
  buildCustomParamRef,
  buildPipelineDownloadFilename,
  CUSTOM_PARAM_ID_RE,
  isCustomParamId,
  isValidBlendMode,
  isValidBlendOp,
  isValidChannelName,
  isValidParamName,
  isZipLikeFile,
  MAX_CUSTOM_PARAM_LABEL_LENGTH,
  MAX_LUT_FILE_BYTES,
  MAX_PIPELINE_FILE_BYTES,
  MAX_PIPELINE_IMAGE_SIDE,
  normalizeCustomParamValue,
  parseCustomParamId,
  parseCustomParamLabel,
  parseLutId,
  parseStepId
} from './pipeline-validators.ts';

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

function hasFiniteColor(value: ColorWithAlpha): boolean {
  if (!Array.isArray(value) || value.length < 3 || value.length > 4) return false;
  if (!value.slice(0, 3).every(c => typeof c === 'number' && Number.isFinite(c))) return false;
  if (value.length === 4 && (typeof value[3] !== 'number' || !Number.isFinite(value[3]))) return false;
  return true;
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

// ---------------------------------------------------------------------------
// Archive I/O — delegated to pipeline-archive-io.ts
// ---------------------------------------------------------------------------
import {
  loadPipelineFromZip as _loadPipelineFromZipImpl,
  serializePipelineAsZip as _serializePipelineAsZipImpl,
} from './pipeline-archive-io.ts';

export async function serializePipelineAsZip(
  luts: LutModel[],
  steps: StepModel[],
  customParams: CustomParamModel[] = [],
  previewPngBytes?: Uint8Array,
): Promise<Uint8Array> {
  return _serializePipelineAsZipImpl(luts, steps, customParams, previewPngBytes, getPipelineImageAdapter());
}

export async function loadPipelineFromZip(data: ArrayBuffer): Promise<LoadedPipelineData> {
  return _loadPipelineFromZipImpl(data, getPipelineImageAdapter());
}
