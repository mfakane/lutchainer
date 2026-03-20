import { reorderItemsById } from '../../shared/interactions/dnd';
import type {
  LutModel,
  ParamName,
  StepModel,
} from '../step/types';
import * as pipelineModel from './pipeline-model';
import type { PipelineStateSnapshot } from './pipeline-state';
import type { SocketAxis } from './pipeline-view';

type StatusKind = 'success' | 'error' | 'info';
type TemplateValue = string | number;
type TemplateValues = Record<string, TemplateValue>;

export interface AddStepOptions {
  recordHistory?: boolean;
}

interface PipelineCommandControllerOptions {
  maxStepLabelLength: number;
  getSteps: () => StepModel[];
  setSteps: (steps: StepModel[]) => void;
  getLuts: () => LutModel[];
  setLuts: (luts: LutModel[]) => void;
  getNextStepId: () => number;
  setNextStepId: (nextStepId: number) => void;
  parseLutId: (value: string | undefined) => string | null;
  isValidParamName: (value: string) => value is ParamName;
  isValidSocketAxis: (value: string) => value is SocketAxis;
  captureSnapshot: () => PipelineStateSnapshot;
  commitSnapshot: (before: PipelineStateSnapshot) => boolean;
  renderSteps: () => void;
  scheduleApply: () => void;
  onStepOpsChanged?: () => void;
  status: (message: string, kind?: StatusKind) => void;
  t: (key: unknown, params?: TemplateValues) => string;
}

interface PipelineCommandController {
  addStep: (options?: AddStepOptions) => void;
  duplicateStep: (stepId: number) => void;
  setStepMuted: (stepId: number, muted: unknown) => void;
  setStepLabel: (stepId: number, label: unknown) => void;
  setStepLut: (stepId: number, lutId: unknown) => void;
  setStepBlendMode: (stepId: number, blendMode: unknown) => void;
  setStepChannelOp: (stepId: number, channel: unknown, op: unknown) => void;
  removeStep: (stepId: number) => void;
  removeLut: (lutId: string) => void;
  assignParamToSocket: (stepId: number, axis: SocketAxis, param: ParamName) => boolean;
  moveStepToPosition: (stepId: number, targetStepId: number | null, after: boolean) => void;
  moveLutToPosition: (lutId: string, targetLutId: string | null, after: boolean) => void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertValidOptions(value: unknown): asserts value is PipelineCommandControllerOptions {
  if (!isObject(value)) {
    throw new Error('Pipeline command controller options が不正です。');
  }

  const options = value as Partial<PipelineCommandControllerOptions>;
  if (!isPositiveInteger(options.maxStepLabelLength)) {
    throw new Error(`maxStepLabelLength が不正です: ${String(options.maxStepLabelLength)}`);
  }

  const requiredCallbacks = [
    options.getSteps,
    options.setSteps,
    options.getLuts,
    options.setLuts,
    options.getNextStepId,
    options.setNextStepId,
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

function parseAddStepOptions(options: AddStepOptions | undefined): { recordHistory: boolean } {
  if (options === undefined) {
    return { recordHistory: true };
  }

  if (!isObject(options)) {
    throw new Error('addStep オプションが不正です。');
  }

  if (options.recordHistory !== undefined && typeof options.recordHistory !== 'boolean') {
    throw new Error(`addStep.recordHistory は boolean で指定してください: ${String(options.recordHistory)}`);
  }

  return {
    recordHistory: options.recordHistory ?? true,
  };
}

function normalizeStepLabelInput(
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

  return pipelineModel.parseNonEmptyText(trimmed, 'step.label', maxStepLabelLength);
}

function getStepById(
  steps: StepModel[],
  stepId: number,
  onNotFound: () => void,
): StepModel | null {
  if (!isPositiveInteger(stepId)) {
    onNotFound();
    return null;
  }

  const step = pipelineModel.getStepById(steps, stepId);
  if (!step) {
    onNotFound();
    return null;
  }

  return step;
}

export function createPipelineCommandController(options: PipelineCommandControllerOptions): PipelineCommandController {
  assertValidOptions(options);

  const addStep = (addStepOptions?: AddStepOptions): void => {
    let parsedOptions: { recordHistory: boolean };
    try {
      parsedOptions = parseAddStepOptions(addStepOptions);
    } catch (error) {
      options.status(pipelineModel.toErrorMessage(error), 'error');
      return;
    }

    const before = parsedOptions.recordHistory ? options.captureSnapshot() : null;
    const steps = options.getSteps();
    const luts = options.getLuts();
    const result = pipelineModel.createPipelineStep(steps, luts, options.getNextStepId());
    if (!result.step) {
      if (result.error) {
        options.status(result.error, 'error');
      }
      return;
    }

    options.setNextStepId(result.nextStepId);
    steps.push(result.step);
    if (before) {
      options.commitSnapshot(before);
    }
    options.renderSteps();
    options.scheduleApply();
  };

  const duplicateStep = (stepId: number): void => {
    if (!isPositiveInteger(stepId)) {
      options.status(options.t('main.status.stepNotFound', { stepId }), 'error');
      return;
    }

    const before = options.captureSnapshot();
    const result = pipelineModel.duplicatePipelineStep(options.getSteps(), stepId, options.getNextStepId());
    if (result.error || !result.duplicated) {
      options.status(result.error ?? options.t('common.unknownError'), 'error');
      return;
    }

    options.setSteps(result.steps);
    options.setNextStepId(result.nextStepId);
    options.commitSnapshot(before);
    options.renderSteps();
    options.scheduleApply();
    options.status(options.t('main.status.stepDuplicated', { stepId: result.duplicated.id }), 'info');
  };

  const setStepMuted = (stepId: number, muted: unknown): void => {
    if (typeof muted !== 'boolean') {
      options.status(options.t('main.status.stepMuteInvalidValue', { value: String(muted) }), 'error');
      return;
    }

    const step = getStepById(options.getSteps(), stepId, () => {
      options.status(options.t('main.status.stepNotFound', { stepId }), 'error');
    });
    if (!step) {
      return;
    }

    if (step.muted === muted) {
      return;
    }

    const before = options.captureSnapshot();
    step.muted = muted;
    options.commitSnapshot(before);
    options.renderSteps();
    options.scheduleApply();
  };

  const setStepLabel = (stepId: number, label: unknown): void => {
    const step = getStepById(options.getSteps(), stepId, () => {
      options.status(options.t('main.status.stepNotFound', { stepId }), 'error');
    });
    if (!step) {
      return;
    }

    let normalized: string | null;
    try {
      normalized = normalizeStepLabelInput(label, options.maxStepLabelLength);
    } catch (error) {
      options.status(pipelineModel.toErrorMessage(error), 'error');
      return;
    }

    const nextLabel = normalized ?? undefined;
    if (step.label === nextLabel) {
      return;
    }

    const before = options.captureSnapshot();
    step.label = nextLabel;
    options.commitSnapshot(before);
    options.renderSteps();
  };

  const setStepLut = (stepId: number, lutId: unknown): void => {
    if (typeof lutId !== 'string') {
      options.status(options.t('pipeline.status.selectedLutIdInvalid'), 'error');
      return;
    }

    const validatedLutId = options.parseLutId(lutId);
    if (!validatedLutId) {
      options.status(options.t('pipeline.status.selectedLutIdInvalid'), 'error');
      return;
    }

    const lutExists = options.getLuts().some(lut => lut.id === validatedLutId);
    if (!lutExists) {
      options.status(options.t('pipeline.status.selectedLutMissing'), 'error');
      return;
    }

    const step = getStepById(options.getSteps(), stepId, () => {
      options.status(options.t('main.status.stepNotFound', { stepId }), 'error');
    });
    if (!step) {
      return;
    }

    if (step.lutId === validatedLutId) {
      return;
    }

    const before = options.captureSnapshot();
    step.lutId = validatedLutId;
    options.commitSnapshot(before);
    options.renderSteps();
    options.scheduleApply();
  };

  const setStepBlendMode = (stepId: number, blendMode: unknown): void => {
    if (typeof blendMode !== 'string' || !pipelineModel.isValidBlendMode(blendMode)) {
      options.status(options.t('pipeline.status.invalidBlendMode', { blendMode: String(blendMode) }), 'error');
      return;
    }

    const step = getStepById(options.getSteps(), stepId, () => {
      options.status(options.t('main.status.stepNotFound', { stepId }), 'error');
    });
    if (!step) {
      return;
    }

    if (step.blendMode === blendMode) {
      return;
    }

    const before = options.captureSnapshot();
    step.blendMode = blendMode;
    options.commitSnapshot(before);
    options.renderSteps();
    options.scheduleApply();
  };

  const setStepChannelOp = (stepId: number, channel: unknown, op: unknown): void => {
    if (typeof channel !== 'string' || !pipelineModel.isValidChannelName(channel)) {
      options.status(options.t('pipeline.status.invalidOp', { op: String(op) }), 'error');
      return;
    }

    if (typeof op !== 'string' || !pipelineModel.isValidBlendOp(op)) {
      options.status(options.t('pipeline.status.invalidOp', { op: String(op) }), 'error');
      return;
    }

    const step = getStepById(options.getSteps(), stepId, () => {
      options.status(options.t('main.status.stepNotFound', { stepId }), 'error');
    });
    if (!step) {
      return;
    }

    if (step.ops[channel] === op) {
      return;
    }

    const before = options.captureSnapshot();
    step.ops[channel] = op;
    options.commitSnapshot(before);
    options.onStepOpsChanged?.();
    options.scheduleApply();
  };

  const removeStep = (stepId: number): void => {
    if (!isPositiveInteger(stepId)) {
      options.status(options.t('main.status.removeStepNotFound', { stepId }), 'error');
      return;
    }

    const before = options.captureSnapshot();
    const result = pipelineModel.removeStepFromPipeline(options.getSteps(), stepId);
    if (!result.removed) {
      options.status(options.t('main.status.removeStepNotFound', { stepId }), 'error');
      return;
    }

    options.setSteps(result.steps);
    options.commitSnapshot(before);
    options.renderSteps();
    options.scheduleApply();
  };

  const removeLut = (lutId: string): void => {
    if (!isNonEmptyString(lutId)) {
      options.status(options.t('main.status.moveLutNotFound'), 'error');
      return;
    }

    const before = options.captureSnapshot();
    const result = pipelineModel.removeLutFromPipeline(options.getLuts(), options.getSteps(), lutId);
    if (result.error) {
      options.status(result.error, 'error');
      return;
    }

    options.setLuts(result.luts);
    options.setSteps(result.steps);
    options.commitSnapshot(before);
    options.renderSteps();
    options.scheduleApply();
    if (result.removed) {
      options.status(options.t('main.status.lutRemoved', { name: result.removed.name }), 'info');
    }
  };

  const assignParamToSocket = (stepId: number, axis: SocketAxis, param: ParamName): boolean => {
    if (typeof axis !== 'string' || !options.isValidSocketAxis(axis)) {
      return false;
    }

    if (typeof param !== 'string' || !options.isValidParamName(param)) {
      return false;
    }

    const step = getStepById(options.getSteps(), stepId, () => {
      options.status(options.t('main.status.stepNotFound', { stepId }), 'error');
    });
    if (!step) {
      return false;
    }

    const currentParam = axis === 'x' ? step.xParam : step.yParam;
    if (currentParam === param) {
      return false;
    }

    const before = options.captureSnapshot();
    if (axis === 'x') {
      step.xParam = param;
    } else {
      step.yParam = param;
    }

    options.commitSnapshot(before);
    options.renderSteps();
    options.scheduleApply();
    return true;
  };

  const moveStepToPosition = (stepId: number, targetStepId: number | null, after: boolean): void => {
    if (!isPositiveInteger(stepId)) {
      options.status(options.t('main.status.moveStepNotFound', { stepId }), 'error');
      return;
    }
    if (!(targetStepId === null || isPositiveInteger(targetStepId))) {
      options.status(options.t('main.status.moveStepNotFound', { stepId }), 'error');
      return;
    }
    if (typeof after !== 'boolean') {
      options.status(options.t('main.status.stepOrderUpdated'), 'error');
      return;
    }

    const before = options.captureSnapshot();
    const steps = options.getSteps();
    const draggedExists = steps.some(step => step.id === stepId);
    if (!draggedExists) {
      options.status(options.t('main.status.moveStepNotFound', { stepId }), 'error');
      return;
    }

    const nextSteps = reorderItemsById(steps, stepId, targetStepId, after, step => step.id);
    if (!nextSteps) {
      return;
    }

    options.setSteps(nextSteps);
    options.commitSnapshot(before);
    options.renderSteps();
    options.scheduleApply();
    options.status(options.t('main.status.stepOrderUpdated'), 'info');
  };

  const moveLutToPosition = (lutId: string, targetLutId: string | null, after: boolean): void => {
    if (!isNonEmptyString(lutId)) {
      options.status(options.t('main.status.moveLutNotFound'), 'error');
      return;
    }
    if (!(targetLutId === null || isNonEmptyString(targetLutId))) {
      options.status(options.t('main.status.moveLutNotFound'), 'error');
      return;
    }
    if (typeof after !== 'boolean') {
      options.status(options.t('main.status.lutOrderUpdated'), 'error');
      return;
    }

    const before = options.captureSnapshot();
    const luts = options.getLuts();
    const draggedExists = luts.some(lut => lut.id === lutId);
    if (!draggedExists) {
      options.status(options.t('main.status.moveLutNotFound'), 'error');
      return;
    }

    const nextLuts = reorderItemsById(luts, lutId, targetLutId, after, lut => lut.id);
    if (!nextLuts) {
      return;
    }

    options.setLuts(nextLuts);
    options.commitSnapshot(before);
    options.renderSteps();
    options.scheduleApply();
    options.status(options.t('main.status.lutOrderUpdated'), 'info');
  };

  return {
    addStep,
    duplicateStep,
    setStepMuted,
    setStepLabel,
    setStepLut,
    setStepBlendMode,
    setStepChannelOp,
    removeStep,
    removeLut,
    assignParamToSocket,
    moveStepToPosition,
    moveLutToPosition,
  };
}
