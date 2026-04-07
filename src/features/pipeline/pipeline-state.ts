import type { CustomParamModel, LutModel, StepModel } from '../step/step-model';

export interface PipelineStateSnapshot {
  steps: StepModel[];
  luts: LutModel[];
  customParams: CustomParamModel[];
}

const pipelineState: PipelineStateSnapshot = {
  steps: [],
  luts: [],
  customParams: [],
};

function assertValidSteps(value: unknown): asserts value is StepModel[] {
  if (!Array.isArray(value)) {
    throw new Error('Pipeline steps must be an array.');
  }
}

function assertValidLuts(value: unknown): asserts value is LutModel[] {
  if (!Array.isArray(value)) {
    throw new Error('Pipeline LUTs must be an array.');
  }
}

function assertValidCustomParams(value: unknown): asserts value is CustomParamModel[] {
  if (!Array.isArray(value)) {
    throw new Error('Pipeline custom params must be an array.');
  }
}

function assertValidPipelineSnapshot(value: unknown): asserts value is PipelineStateSnapshot {
  if (!value || typeof value !== 'object') {
    throw new Error('Pipeline state must be an object.');
  }

  const candidate = value as Partial<PipelineStateSnapshot>;
  assertValidSteps(candidate.steps);
  assertValidLuts(candidate.luts);
  assertValidCustomParams(candidate.customParams);
}

export function getSteps(): StepModel[] {
  return pipelineState.steps;
}

export function setSteps(steps: StepModel[]): void {
  assertValidSteps(steps);
  pipelineState.steps = steps;
}

export function getLuts(): LutModel[] {
  return pipelineState.luts;
}

export function getCustomParams(): CustomParamModel[] {
  return pipelineState.customParams;
}

export function setCustomParams(customParams: CustomParamModel[]): void {
  assertValidCustomParams(customParams);
  pipelineState.customParams = customParams;
}

export function setLuts(luts: LutModel[]): void {
  assertValidLuts(luts);
  pipelineState.luts = luts;
}

export function replacePipelineState(nextState: PipelineStateSnapshot): void {
  assertValidPipelineSnapshot(nextState);
  pipelineState.steps = nextState.steps;
  pipelineState.luts = nextState.luts;
  pipelineState.customParams = nextState.customParams;
}
