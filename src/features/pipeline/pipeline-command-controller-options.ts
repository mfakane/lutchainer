import type { AppTranslator } from '../../shared/i18n/browser-translation-contract.ts';
import { parseNonEmptyText } from '../../shared/lutchain/lutchain-archive.ts';
import type { CustomParamModel, LutModel, ParamRef, StepModel } from '../step/step-model.ts';
import type { PipelineStateSnapshot } from './pipeline-state.ts';
import type { SocketAxis } from './pipeline-view.ts';

export type StatusKind = 'success' | 'error' | 'info';

export interface AddStepOptions {
  recordHistory?: boolean;
}

export interface SetCustomParamValueOptions {
  recordHistory?: boolean;
}

export interface PipelineCommandControllerOptions {
  maxStepLabelLength: number;
  getSteps: () => StepModel[];
  setSteps: (steps: StepModel[]) => void;
  getLuts: () => LutModel[];
  setLuts: (luts: LutModel[]) => void;
  getCustomParams: () => CustomParamModel[];
  setCustomParams: (customParams: CustomParamModel[]) => void;
  parseLutId: (value: string | undefined) => string | null;
  isValidParamName: (value: string) => value is ParamRef;
  isValidSocketAxis: (value: string) => value is SocketAxis;
  captureSnapshot: () => PipelineStateSnapshot;
  commitSnapshot: (before: PipelineStateSnapshot) => boolean;
  renderSteps: () => void;
  scheduleApply: () => void;
  onStepOpsChanged?: () => void;
  status: (message: string, kind?: StatusKind) => void;
  t: AppTranslator;
}

export interface PipelineCommandController {
  addStep: (options?: AddStepOptions) => void;
  duplicateStep: (stepId: string) => void;
  setStepMuted: (stepId: string, muted: unknown) => void;
  setStepLabel: (stepId: string, label: unknown) => void;
  setStepLut: (stepId: string, lutId: unknown) => void;
  setStepBlendMode: (stepId: string, blendMode: unknown) => void;
  setStepChannelOp: (stepId: string, channel: unknown, op: unknown) => void;
  removeStep: (stepId: string) => void;
  removeLut: (lutId: string) => void;
  duplicateLut: (lutId: string) => void;
  addCustomParam: () => void;
  renameCustomParam: (paramId: string, label: unknown) => void;
  setCustomParamValue: (paramId: string, value: unknown, options?: SetCustomParamValueOptions) => void;
  removeCustomParam: (paramId: string) => void;
  assignParamToSocket: (stepId: string, axis: SocketAxis, param: ParamRef) => boolean;
  moveCustomParamToPosition: (paramId: string, targetParamId: string | null, after: boolean) => void;
  moveStepToPosition: (stepId: string, targetStepId: string | null, after: boolean) => void;
  moveLutToPosition: (lutId: string, targetLutId: string | null, after: boolean) => void;
}

interface RecordHistoryOption {
  recordHistory?: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function assertValidPipelineCommandControllerOptions(
  value: unknown,
): asserts value is PipelineCommandControllerOptions {
  if (!isObject(value)) {
    throw new Error('Pipeline command controller options が不正です。');
  }

  const options = value as Partial<PipelineCommandControllerOptions>;
  if (!(typeof options.maxStepLabelLength === 'number' && Number.isInteger(options.maxStepLabelLength) && options.maxStepLabelLength > 0)) {
    throw new Error(`maxStepLabelLength が不正です: ${String(options.maxStepLabelLength)}`);
  }

  const requiredCallbacks = [
    options.getSteps,
    options.setSteps,
    options.getLuts,
    options.setLuts,
    options.getCustomParams,
    options.setCustomParams,
    options.parseLutId,
    options.isValidParamName,
    options.isValidSocketAxis,
    options.captureSnapshot,
    options.commitSnapshot,
    options.renderSteps,
    options.scheduleApply,
    options.status,
    options.t,
  ];

  if (requiredCallbacks.some(callback => typeof callback !== 'function')) {
    throw new Error('Pipeline command controller のコールバック設定が不正です。');
  }

  if (options.onStepOpsChanged !== undefined && typeof options.onStepOpsChanged !== 'function') {
    throw new Error('onStepOpsChanged が不正です。');
  }
}

function parseRecordHistoryOption(
  options: RecordHistoryOption | undefined,
  errorLabel: string,
): { recordHistory: boolean } {
  if (options === undefined) {
    return { recordHistory: true };
  }

  if (!isObject(options)) {
    throw new Error(`${errorLabel} オプションが不正です。`);
  }

  if (options.recordHistory !== undefined && typeof options.recordHistory !== 'boolean') {
    throw new Error(`${errorLabel}.recordHistory は boolean で指定してください: ${String(options.recordHistory)}`);
  }

  return {
    recordHistory: options.recordHistory ?? true,
  };
}

export function parseAddStepOptions(options: AddStepOptions | undefined): { recordHistory: boolean } {
  return parseRecordHistoryOption(options, 'addStep');
}

export function parseSetCustomParamValueOptions(
  options: SetCustomParamValueOptions | undefined,
): { recordHistory: boolean } {
  return parseRecordHistoryOption(options, 'setCustomParamValue');
}

export function normalizeStepLabelInput(
  value: unknown,
  maxStepLabelLength: number,
): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error('Stepラベルは文字列で指定してください。');
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return parseNonEmptyText(trimmed, 'step.label', maxStepLabelLength);
}