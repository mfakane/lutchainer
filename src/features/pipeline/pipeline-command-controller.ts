import { reorderItemsById } from '../../shared/utils/reorder.ts';
import type { LutModel, ParamRef, StepModel } from '../step/step-model.ts';
import {
    assertValidPipelineCommandControllerOptions,
    isNonEmptyString,
    normalizeStepLabelInput,
    parseAddStepOptions,
    parseSetCustomParamValueOptions,
    type AddStepOptions,
    type PipelineCommandController,
    type PipelineCommandControllerOptions,
    type SetCustomParamValueOptions,
} from './pipeline-command-controller-options.ts';
import * as pipelineModel from './pipeline-model.ts';
import type { SocketAxis } from './pipeline-socket-types.ts';

export type {
    AddStepOptions,
    PipelineCommandController,
    PipelineCommandControllerOptions,
    SetCustomParamValueOptions
} from './pipeline-command-controller-options.ts';

function getStepById(
  steps: StepModel[],
  stepId: string,
  onNotFound: () => void,
): StepModel | null {
  if (!isNonEmptyString(stepId)) {
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
  assertValidPipelineCommandControllerOptions(options);

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
    const result = pipelineModel.createPipelineStep(steps, luts);
    if (!result.step) {
      if (result.error) {
        options.status(result.error, 'error');
      }
      return;
    }

    steps.push(result.step);
    if (before) {
      options.commitSnapshot(before);
    }
    options.renderSteps();
    options.scheduleApply();
  };

  const duplicateStep = (stepId: string): void => {
    if (!isNonEmptyString(stepId)) {
      options.status(options.t('main.status.stepNotFound', { stepId }), 'error');
      return;
    }

    const before = options.captureSnapshot();
    const result = pipelineModel.duplicatePipelineStep(options.getSteps(), stepId);
    if (result.error || !result.duplicated) {
      options.status(result.error ?? options.t('common.unknownError'), 'error');
      return;
    }

    options.setSteps(result.steps);
    options.commitSnapshot(before);
    options.renderSteps();
    options.scheduleApply();
    options.status(options.t('main.status.stepDuplicated', { stepId: result.duplicated.id }), 'info');
  };

  const setStepMuted = (stepId: string, muted: unknown): void => {
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

  const setStepLabel = (stepId: string, label: unknown): void => {
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

  const setStepLut = (stepId: string, lutId: unknown): void => {
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

  const setStepBlendMode = (stepId: string, blendMode: unknown): void => {
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

  const setStepChannelOp = (stepId: string, channel: unknown, op: unknown): void => {
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

  const removeStep = (stepId: string): void => {
    if (!isNonEmptyString(stepId)) {
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

  const duplicateLut = (lutId: string): void => {
    if (!isNonEmptyString(lutId)) {
      options.status(options.t('main.status.moveLutNotFound'), 'error');
      return;
    }

    const luts = options.getLuts();
    const idx = luts.findIndex(l => l.id === lutId);
    if (idx < 0) {
      options.status(options.t('main.status.moveLutNotFound'), 'error');
      return;
    }

    const original = luts[idx]!;
    const before = options.captureSnapshot();
    const suffix = options.t('pipeline.lut.copyNameSuffix');
    const newLut: LutModel = {
      ...original,
      id: pipelineModel.uid('lut'),
      name: `${original.name} (${suffix})`,
    };
    const newLuts = [...luts.slice(0, idx + 1), newLut, ...luts.slice(idx + 1)];
    options.setLuts(newLuts);
    options.commitSnapshot(before);
    options.renderSteps();
    options.scheduleApply();
    options.status(options.t('main.status.lutDuplicated', { name: newLut.name }), 'success');
  };

  const addCustomParam = (): void => {
    const before = options.captureSnapshot();
    const result = pipelineModel.createCustomParam(options.getCustomParams());
    if (!result.customParam) {
      options.status(result.error ?? options.t('common.unknownError'), 'error');
      return;
    }

    options.setCustomParams([...options.getCustomParams(), result.customParam]);
    options.commitSnapshot(before);
    options.renderSteps();
    options.scheduleApply();
  };

  const renameCustomParam = (paramId: string, label: unknown): void => {
    if (!isNonEmptyString(paramId)) {
      return;
    }

    let parsedLabel: string;
    try {
      parsedLabel = pipelineModel.parseNonEmptyText(label, 'customParam.label', pipelineModel.MAX_CUSTOM_PARAM_LABEL_LENGTH);
    } catch (error) {
      options.status(pipelineModel.toErrorMessage(error), 'error');
      return;
    }

    const customParams = options.getCustomParams();
    const targetIndex = customParams.findIndex(param => param.id === paramId);
    if (targetIndex < 0 || customParams[targetIndex].label === parsedLabel) {
      return;
    }

    const before = options.captureSnapshot();
    const nextCustomParams = customParams.map((param, index) => (index === targetIndex ? { ...param, label: parsedLabel } : param));
    options.setCustomParams(nextCustomParams);
    options.commitSnapshot(before);
    options.renderSteps();
    options.scheduleApply();
  };

  const setCustomParamValue = (paramId: string, value: unknown, setValueOptions?: SetCustomParamValueOptions): void => {
    if (!isNonEmptyString(paramId) || typeof value !== 'number' || !Number.isFinite(value)) {
      return;
    }

    let parsedOptions: { recordHistory: boolean };
    try {
      parsedOptions = parseSetCustomParamValueOptions(setValueOptions);
    } catch (error) {
      options.status(pipelineModel.toErrorMessage(error), 'error');
      return;
    }

    const customParams = options.getCustomParams();
    const targetIndex = customParams.findIndex(param => param.id === paramId);
    if (targetIndex < 0) {
      return;
    }

    const normalizedValue = pipelineModel.normalizeCustomParamValue(value);
    if (customParams[targetIndex].defaultValue === normalizedValue) {
      return;
    }

    const before = parsedOptions.recordHistory ? options.captureSnapshot() : null;
    const nextCustomParams = customParams.map((param, index) => (index === targetIndex ? { ...param, defaultValue: normalizedValue } : param));
    options.setCustomParams(nextCustomParams);
    if (before) {
      options.commitSnapshot(before);
    }
    options.renderSteps();
    options.scheduleApply();
  };

  const removeCustomParam = (paramId: string): void => {
    if (!isNonEmptyString(paramId)) {
      return;
    }

    if (!pipelineModel.canRemoveCustomParam(options.getSteps(), paramId)) {
      options.status(`Custom param '${paramId}' is still in use.`, 'error');
      return;
    }

    const customParams = options.getCustomParams();
    const nextCustomParams = customParams.filter(param => param.id !== paramId);
    if (nextCustomParams.length === customParams.length) {
      return;
    }

    const before = options.captureSnapshot();
    options.setCustomParams(nextCustomParams);
    options.commitSnapshot(before);
    options.renderSteps();
    options.scheduleApply();
  };

  const assignParamToSocket = (stepId: string, axis: SocketAxis, param: ParamRef): boolean => {
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

  const moveStepToPosition = (stepId: string, targetStepId: string | null, after: boolean): void => {
    if (!isNonEmptyString(stepId)) {
      options.status(options.t('main.status.moveStepNotFound', { stepId }), 'error');
      return;
    }
    if (!(targetStepId === null || isNonEmptyString(targetStepId))) {
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

  const moveCustomParamToPosition = (paramId: string, targetParamId: string | null, after: boolean): void => {
    if (!isNonEmptyString(paramId)) {
      options.status('Custom param reorder source is invalid.', 'error');
      return;
    }
    if (!(targetParamId === null || isNonEmptyString(targetParamId))) {
      options.status('Custom param reorder target is invalid.', 'error');
      return;
    }
    if (typeof after !== 'boolean') {
      options.status('Custom param reorder position is invalid.', 'error');
      return;
    }

    const before = options.captureSnapshot();
    const customParams = options.getCustomParams();
    const draggedExists = customParams.some(param => param.id === paramId);
    if (!draggedExists) {
      options.status(`Custom param '${paramId}' was not found.`, 'error');
      return;
    }

    const nextCustomParams = reorderItemsById(customParams, paramId, targetParamId, after, param => param.id);
    if (!nextCustomParams) {
      return;
    }

    options.setCustomParams(nextCustomParams);
    options.commitSnapshot(before);
    options.renderSteps();
    options.scheduleApply();
    options.status('Custom param order updated.', 'info');
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
    duplicateLut,
    addCustomParam,
    renameCustomParam,
    setCustomParamValue,
    removeCustomParam,
    assignParamToSocket,
    moveCustomParamToPosition,
    moveStepToPosition,
    moveLutToPosition,
  };
}
