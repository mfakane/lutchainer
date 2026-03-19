import * as pipelineModel from '../../features/pipeline/pipeline-model';
import * as pipelineView from '../../features/pipeline/pipeline-view';

export type SocketDragState = pipelineView.SocketDragState;
export type SocketDropTarget = pipelineView.SocketDropTarget;
export type StepReorderDragState = pipelineView.StepReorderDragState;
export type LutReorderDragState = pipelineView.LutReorderDragState;

interface InteractionState {
  socketDragState: SocketDragState | null;
  socketDropTarget: SocketDropTarget | null;
  stepReorderDragState: StepReorderDragState | null;
  lutReorderDragState: LutReorderDragState | null;
  suppressClickUntil: number;
}

const interactionState: InteractionState = {
  socketDragState: null,
  socketDropTarget: null,
  stepReorderDragState: null,
  lutReorderDragState: null,
  suppressClickUntil: 0,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidPointerId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isValidPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isHtmlButtonElement(value: unknown): value is HTMLButtonElement {
  return value instanceof HTMLButtonElement;
}

function isValidDragMode(value: unknown): value is SocketDragState['mode'] {
  return value === 'param' || value === 'step';
}

function assertValidSocketDragState(value: unknown): asserts value is SocketDragState {
  if (!value || typeof value !== 'object') {
    throw new Error('Socket drag state must be an object.');
  }

  const candidate = value as Partial<SocketDragState> & {
    mode?: unknown;
    sourceEl?: unknown;
    param?: unknown;
    stepId?: unknown;
    axis?: unknown;
    pointerId?: unknown;
    startX?: unknown;
    startY?: unknown;
    pointerX?: unknown;
    pointerY?: unknown;
    dragging?: unknown;
  };

  if (!isValidDragMode(candidate.mode)) {
    throw new Error(`Invalid socket drag mode: ${String(candidate.mode)}`);
  }
  if (!isHtmlButtonElement(candidate.sourceEl)) {
    throw new Error('Socket drag sourceEl must be an HTMLButtonElement.');
  }
  if (!isValidPointerId(candidate.pointerId)) {
    throw new Error(`Invalid socket drag pointerId: ${String(candidate.pointerId)}`);
  }
  if (!isFiniteNumber(candidate.startX) || !isFiniteNumber(candidate.startY)) {
    throw new Error('Socket drag start coordinates must be finite numbers.');
  }
  if (!isFiniteNumber(candidate.pointerX) || !isFiniteNumber(candidate.pointerY)) {
    throw new Error('Socket drag pointer coordinates must be finite numbers.');
  }
  if (typeof candidate.dragging !== 'boolean') {
    throw new Error('Socket drag dragging flag must be a boolean.');
  }

  if (candidate.mode === 'param') {
    if (typeof candidate.param !== 'string' || !pipelineModel.isValidParamName(candidate.param)) {
      throw new Error(`Invalid socket drag parameter: ${String(candidate.param)}`);
    }
    return;
  }

  if (!isValidPositiveInteger(candidate.stepId)) {
    throw new Error(`Invalid socket drag stepId: ${String(candidate.stepId)}`);
  }
  if (typeof candidate.axis !== 'string' || !pipelineView.isValidSocketAxis(candidate.axis)) {
    throw new Error(`Invalid socket drag axis: ${String(candidate.axis)}`);
  }
}

function assertValidSocketDropTarget(value: unknown): asserts value is SocketDropTarget {
  if (!value || typeof value !== 'object') {
    throw new Error('Socket drop target must be an object.');
  }

  const candidate = value as Partial<SocketDropTarget> & {
    kind?: unknown;
    element?: unknown;
    param?: unknown;
    stepId?: unknown;
    axis?: unknown;
  };

  if (!isHtmlButtonElement(candidate.element)) {
    throw new Error('Socket drop target element must be an HTMLButtonElement.');
  }

  if (candidate.kind === 'param') {
    if (typeof candidate.param !== 'string' || !pipelineModel.isValidParamName(candidate.param)) {
      throw new Error(`Invalid socket drop parameter: ${String(candidate.param)}`);
    }
    return;
  }

  if (candidate.kind === 'step') {
    if (!isValidPositiveInteger(candidate.stepId)) {
      throw new Error(`Invalid socket drop stepId: ${String(candidate.stepId)}`);
    }
    if (typeof candidate.axis !== 'string' || !pipelineView.isValidSocketAxis(candidate.axis)) {
      throw new Error(`Invalid socket drop axis: ${String(candidate.axis)}`);
    }
    return;
  }

  throw new Error(`Invalid socket drop target kind: ${String(candidate.kind)}`);
}

function assertValidStepReorderDragState(value: unknown): asserts value is StepReorderDragState {
  if (!value || typeof value !== 'object') {
    throw new Error('Step reorder drag state must be an object.');
  }

  const candidate = value as Partial<StepReorderDragState>;
  if (!isValidPositiveInteger(candidate.stepId)) {
    throw new Error(`Invalid step reorder stepId: ${String(candidate.stepId)}`);
  }
  if (!(candidate.overStepId === null || isValidPositiveInteger(candidate.overStepId))) {
    throw new Error(`Invalid step reorder overStepId: ${String(candidate.overStepId)}`);
  }
  if (typeof candidate.dropAfter !== 'boolean') {
    throw new Error('Step reorder dropAfter must be a boolean.');
  }
}

function assertValidLutReorderDragState(value: unknown): asserts value is LutReorderDragState {
  if (!value || typeof value !== 'object') {
    throw new Error('LUT reorder drag state must be an object.');
  }

  const candidate = value as Partial<LutReorderDragState>;
  if (typeof candidate.lutId !== 'string' || candidate.lutId.length === 0) {
    throw new Error(`Invalid LUT reorder lutId: ${String(candidate.lutId)}`);
  }
  if (!(candidate.overLutId === null || (typeof candidate.overLutId === 'string' && candidate.overLutId.length > 0))) {
    throw new Error(`Invalid LUT reorder overLutId: ${String(candidate.overLutId)}`);
  }
  if (typeof candidate.dropAfter !== 'boolean') {
    throw new Error('LUT reorder dropAfter must be a boolean.');
  }
}

function assertValidSuppressClickUntil(value: unknown): asserts value is number {
  if (!isFiniteNumber(value) || value < 0) {
    throw new Error(`Invalid suppressClickUntil value: ${String(value)}`);
  }
}

export function getSocketDragState(): SocketDragState | null {
  return interactionState.socketDragState;
}

export function setSocketDragState(nextState: SocketDragState | null): void {
  if (nextState !== null) {
    assertValidSocketDragState(nextState);
  }
  interactionState.socketDragState = nextState;
}

export function clearSocketDragState(): void {
  interactionState.socketDragState = null;
}

export function getSocketDropTargetState(): SocketDropTarget | null {
  return interactionState.socketDropTarget;
}

export function setSocketDropTargetState(nextState: SocketDropTarget | null): void {
  if (nextState !== null) {
    assertValidSocketDropTarget(nextState);
  }
  interactionState.socketDropTarget = nextState;
}

export function clearSocketDropTargetState(): void {
  interactionState.socketDropTarget = null;
}

export function getStepReorderDragState(): StepReorderDragState | null {
  return interactionState.stepReorderDragState;
}

export function setStepReorderDragState(nextState: StepReorderDragState | null): void {
  if (nextState !== null) {
    assertValidStepReorderDragState(nextState);
  }
  interactionState.stepReorderDragState = nextState;
}

export function clearStepReorderDragState(): void {
  interactionState.stepReorderDragState = null;
}

export function getLutReorderDragState(): LutReorderDragState | null {
  return interactionState.lutReorderDragState;
}

export function setLutReorderDragState(nextState: LutReorderDragState | null): void {
  if (nextState !== null) {
    assertValidLutReorderDragState(nextState);
  }
  interactionState.lutReorderDragState = nextState;
}

export function clearLutReorderDragState(): void {
  interactionState.lutReorderDragState = null;
}

export function getSuppressClickUntil(): number {
  return interactionState.suppressClickUntil;
}

export function setSuppressClickUntil(value: number): void {
  assertValidSuppressClickUntil(value);
  interactionState.suppressClickUntil = value;
}
