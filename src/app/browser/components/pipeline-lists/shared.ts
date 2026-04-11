import type { Accessor } from 'solid-js';
import * as pipelineModel from '../../../../features/pipeline/pipeline-model.ts';
import {
  MAX_STEP_LABEL_LENGTH,
  type BlendOp,
  type ChannelName,
  type CustomParamModel,
  type LutModel,
  type ParamName,
  type ParamRef,
  type StepModel,
} from '../../../../features/step/step-model.ts';
import type { PipelinePresetKey } from '../../ui/pipeline-presets.ts';

export type StatusKind = 'success' | 'error' | 'info';
export type StatusReporter = (message: string, kind?: StatusKind) => void;

export const CHANNELS: ChannelName[] = ['r', 'g', 'b', 'h', 's', 'v'];
export const PARAM_PREVIEW_SIZE = 112;
export const PARAM_PREVIEW_TARGETS = new Set<ParamName>([
  'lightness',
  'specular',
  'halfLambert',
  'fresnel',
  'facing',
  'nDotH',
  'linearDepth',
  'texU',
  'texV',
  'zero',
  'one',
]);

export interface ParamNodeListMountOptions {
  getMaterialSettings: () => pipelineModel.MaterialSettings;
  customParams: CustomParamModel[];
  onAddCustomParam: () => void;
  onRenameCustomParam: (paramId: string, label: string) => void;
  onSetCustomParamValue: (paramId: string, value: number, options?: { recordHistory?: boolean }) => void;
  onCommitCustomParamValueChange: () => void;
  onRemoveCustomParam: (paramId: string) => void;
  onStatus: StatusReporter;
}

export interface StepListMountOptions {
  steps: StepModel[];
  luts: LutModel[];
  customParams: CustomParamModel[];
  onAddStep: () => void;
  onDuplicateStep: (stepId: string) => void;
  onRemoveStep: (stepId: string) => void;
  onStepMuteChange: (stepId: string, muted: boolean) => void;
  onStepLabelChange: (stepId: string, label: string | null) => void;
  onStepLutChange: (stepId: string, lutId: string) => void;
  onStepBlendModeChange: (stepId: string, blendMode: StepModel['blendMode']) => void;
  onStepOpChange: (stepId: string, channel: ChannelName, op: BlendOp) => void;
  shouldSuppressClick?: () => boolean;
  onOpenPipelineFilePicker: () => void;
  onLoadExample: (example: PipelinePresetKey) => void | Promise<void>;
  computeLutUv?: (
    stepIndex: number,
    pixelX: number,
    pixelY: number,
    canvasWidth: number,
    canvasHeight: number,
  ) => { u: number; v: number } | null;
  onStatus: StatusReporter;
}

export interface LutStripListMountOptions {
  luts: LutModel[];
  steps: StepModel[];
  onRemoveLut: (lutId: string) => void;
  onAddLutFiles: (files: File[]) => void | Promise<void>;
  onEditLut?: (lutId: string) => void;
  onDuplicateLut?: (lutId: string) => void;
  onNewLut?: () => void;
  onStatus: StatusReporter;
}

export interface ParamNodeListProps {
  getMaterialSettings: () => pipelineModel.MaterialSettings;
  customParams: Accessor<CustomParamModel[]>;
  onAddCustomParam: () => void;
  onRenameCustomParam: (paramId: string, label: string) => void;
  onSetCustomParamValue: (paramId: string, value: number, options?: { recordHistory?: boolean }) => void;
  onCommitCustomParamValueChange: () => void;
  onRemoveCustomParam: (paramId: string) => void;
  onStatus: StatusReporter;
}

export interface ParamPreviewState {
  param: ParamRef;
  left: number;
  top: number;
}

export interface CustomParamNodeProps {
  customParam: Accessor<CustomParamModel>;
  onRenameCustomParam: (paramId: string, label: string) => void;
  onSetCustomParamValue: (paramId: string, value: number, options?: { recordHistory?: boolean }) => void;
  onCommitCustomParamValueChange: () => void;
  onRemoveCustomParam: (paramId: string) => void;
}

export interface StepListProps {
  steps: Accessor<StepModel[]>;
  luts: Accessor<LutModel[]>;
  customParams: Accessor<CustomParamModel[]>;
  onAddStep: () => void;
  onDuplicateStep: (stepId: string) => void;
  onRemoveStep: (stepId: string) => void;
  onStepMuteChange: (stepId: string, muted: boolean) => void;
  onStepLabelChange: (stepId: string, label: string | null) => void;
  onStepLutChange: (stepId: string, lutId: string) => void;
  onStepBlendModeChange: (stepId: string, blendMode: StepModel['blendMode']) => void;
  onStepOpChange: (stepId: string, channel: ChannelName, op: BlendOp) => void;
  shouldSuppressClick?: () => boolean;
  onOpenPipelineFilePicker: () => void;
  onLoadExample: (example: PipelinePresetKey) => void | Promise<void>;
  computeLutUv?: (
    stepIndex: number,
    pixelX: number,
    pixelY: number,
    canvasWidth: number,
    canvasHeight: number,
  ) => { u: number; v: number } | null;
  onStatus: StatusReporter;
}

export interface StepWelcomeProps {
  onOpenPipelineFilePicker: () => void;
  onLoadExample: (example: PipelinePresetKey) => void | Promise<void>;
}

export interface LutStripListProps {
  luts: Accessor<LutModel[]>;
  steps: Accessor<StepModel[]>;
  onRemoveLut: (lutId: string) => void;
  onAddLutFiles: (files: File[]) => void | Promise<void>;
  onEditLut?: (lutId: string) => void;
  onDuplicateLut?: (lutId: string) => void;
  onNewLut?: () => void;
  onStatus: StatusReporter;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isValidStepOps(value: unknown): value is Record<ChannelName, BlendOp> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const ops = value as Partial<Record<ChannelName, BlendOp>>;
  for (const channel of CHANNELS) {
    const op = ops[channel];
    if (typeof op !== 'string' || !pipelineModel.isValidBlendOp(op)) {
      return false;
    }
  }

  return true;
}

export function isValidStepModel(value: unknown): value is StepModel {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const step = value as Partial<StepModel>;
  return isNonEmptyString(step.id)
    && isNonEmptyString(step.lutId)
    && typeof step.muted === 'boolean'
    && (step.label === undefined || (isNonEmptyString(step.label) && step.label.trim().length <= MAX_STEP_LABEL_LENGTH))
    && typeof step.blendMode === 'string'
    && pipelineModel.isValidBlendMode(step.blendMode)
    && typeof step.xParam === 'string'
    && pipelineModel.isValidParamName(step.xParam)
    && typeof step.yParam === 'string'
    && pipelineModel.isValidParamName(step.yParam)
    && isValidStepOps(step.ops);
}

export function isValidLutModel(value: unknown): value is LutModel {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const lut = value as Partial<LutModel>;
  return isNonEmptyString(lut.id)
    && typeof lut.name === 'string'
    && lut.image instanceof HTMLCanvasElement
    && Number.isInteger(lut.width)
    && (lut.width ?? 0) > 0
    && Number.isInteger(lut.height)
    && (lut.height ?? 0) > 0
    && lut.pixels instanceof Uint8ClampedArray
    && typeof lut.thumbUrl === 'string';
}

export function isValidCustomParamModel(value: unknown): value is CustomParamModel {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const customParam = value as Partial<CustomParamModel>;
  return isNonEmptyString(customParam.id)
    && isNonEmptyString(customParam.label)
    && typeof customParam.defaultValue === 'number'
    && Number.isFinite(customParam.defaultValue);
}

export function cloneStepModel(step: StepModel): StepModel {
  return {
    id: step.id,
    lutId: step.lutId,
    label: step.label,
    muted: step.muted,
    blendMode: step.blendMode,
    xParam: step.xParam,
    yParam: step.yParam,
    ops: { ...step.ops },
  };
}

export function cloneLutModel(lut: LutModel): LutModel {
  return {
    id: lut.id,
    name: lut.name,
    image: lut.image,
    width: lut.width,
    height: lut.height,
    pixels: lut.pixels,
    thumbUrl: lut.thumbUrl,
    ramp2dData: lut.ramp2dData,
  };
}

export function cloneCustomParamModel(customParam: CustomParamModel): CustomParamModel {
  return {
    id: customParam.id,
    label: customParam.label,
    defaultValue: customParam.defaultValue,
  };
}

export function cloneStepArray(steps: StepModel[]): StepModel[] {
  return steps.map(step => cloneStepModel(step));
}

export function cloneLutArray(luts: LutModel[]): LutModel[] {
  return luts.map(lut => cloneLutModel(lut));
}

export function cloneCustomParamArray(customParams: CustomParamModel[]): CustomParamModel[] {
  return customParams.map(customParam => cloneCustomParamModel(customParam));
}

export function restoreElementScrollPosition(element: HTMLElement, top: number, left: number): void {
  requestAnimationFrame(() => {
    element.scrollTop = top;
    element.scrollLeft = left;
  });
}

export function ensureStatusReporter(value: unknown, context: string): asserts value is StatusReporter {
  if (typeof value !== 'function') {
    throw new Error(`${context} のステータス通知コールバックが不正です。`);
  }
}

export function stopPointerPropagation(event: PointerEvent): void {
  event.stopPropagation();
}

export function ensureParamNodeListMountOptions(value: unknown): asserts value is ParamNodeListMountOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Paramノードリストの初期化オプションが不正です。');
  }

  const options = value as Partial<ParamNodeListMountOptions>;
  if (typeof options.getMaterialSettings !== 'function') {
    throw new Error('ParamノードリストのMaterial設定取得コールバックが不正です。');
  }
  if (!Array.isArray(options.customParams) || options.customParams.some(customParam => !isValidCustomParamModel(customParam))) {
    throw new Error('ParamノードリストのCustom Param配列が不正です。');
  }
  if (typeof options.onAddCustomParam !== 'function') {
    throw new Error('ParamノードリストのCustom Param追加コールバックが不正です。');
  }
  if (typeof options.onRenameCustomParam !== 'function') {
    throw new Error('ParamノードリストのCustom Param名称変更コールバックが不正です。');
  }
  if (typeof options.onSetCustomParamValue !== 'function') {
    throw new Error('ParamノードリストのCustom Param値変更コールバックが不正です。');
  }
  if (typeof options.onCommitCustomParamValueChange !== 'function') {
    throw new Error('ParamノードリストのCustom Param値確定コールバックが不正です。');
  }
  if (typeof options.onRemoveCustomParam !== 'function') {
    throw new Error('ParamノードリストのCustom Param削除コールバックが不正です。');
  }
  ensureStatusReporter(options.onStatus, 'Paramノードリスト');
}

export function ensureStepListMountOptions(value: unknown): asserts value is StepListMountOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Stepリストの初期化オプションが不正です。');
  }

  const options = value as Partial<StepListMountOptions>;
  if (!Array.isArray(options.steps) || options.steps.some(step => !isValidStepModel(step))) {
    throw new Error('Stepリストの初期Step配列が不正です。');
  }
  if (!Array.isArray(options.luts) || options.luts.some(lut => !isValidLutModel(lut))) {
    throw new Error('Stepリストの初期LUT配列が不正です。');
  }
  if (!Array.isArray(options.customParams) || options.customParams.some(customParam => !isValidCustomParamModel(customParam))) {
    throw new Error('Stepリストの初期Custom Param配列が不正です。');
  }
  if (typeof options.onAddStep !== 'function') {
    throw new Error('Stepリストの追加コールバックが不正です。');
  }
  if (typeof options.onDuplicateStep !== 'function') {
    throw new Error('Stepリストの複製コールバックが不正です。');
  }
  if (typeof options.onRemoveStep !== 'function') {
    throw new Error('Stepリストの削除コールバックが不正です。');
  }
  if (typeof options.onStepMuteChange !== 'function') {
    throw new Error('Stepリストのミュート変更コールバックが不正です。');
  }
  if (typeof options.onStepLabelChange !== 'function') {
    throw new Error('Stepリストのラベル変更コールバックが不正です。');
  }
  if (typeof options.onStepLutChange !== 'function') {
    throw new Error('StepリストのLUT変更コールバックが不正です。');
  }
  if (typeof options.onStepBlendModeChange !== 'function') {
    throw new Error('StepリストのBlendMode変更コールバックが不正です。');
  }
  if (typeof options.onStepOpChange !== 'function') {
    throw new Error('Stepリストの演算変更コールバックが不正です。');
  }
  if (options.shouldSuppressClick !== undefined && typeof options.shouldSuppressClick !== 'function') {
    throw new Error('Stepリストのクリック抑止判定コールバックが不正です。');
  }
  if (options.computeLutUv !== undefined && typeof options.computeLutUv !== 'function') {
    throw new Error('StepリストのLUT UV計算コールバックが不正です。');
  }
  ensureStatusReporter(options.onStatus, 'Stepリスト');
}

export function ensureLutStripListMountOptions(value: unknown): asserts value is LutStripListMountOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('LUTストリップの初期化オプションが不正です。');
  }

  const options = value as Partial<LutStripListMountOptions>;
  if (!Array.isArray(options.luts) || options.luts.some(lut => !isValidLutModel(lut))) {
    throw new Error('LUTストリップの初期LUT配列が不正です。');
  }
  if (!Array.isArray(options.steps) || options.steps.some(step => !isValidStepModel(step))) {
    throw new Error('LUTストリップの初期Step配列が不正です。');
  }
  if (typeof options.onRemoveLut !== 'function') {
    throw new Error('LUTストリップの削除コールバックが不正です。');
  }
  ensureStatusReporter(options.onStatus, 'LUTストリップ');
}
