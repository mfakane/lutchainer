import * as pipelineView from '../pipeline/pipeline-view.ts';
import {
  isValidSocketDragState,
  isValidSocketDropTarget,
} from '../interactions/socket-validation.ts';

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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertValidSocketDragState(value: unknown): asserts value is SocketDragState {
  if (!isValidSocketDragState(value)) {
    throw new Error('Socket drag state is invalid.');
  }
}

function assertValidSocketDropTarget(value: unknown): asserts value is SocketDropTarget {
  if (!isValidSocketDropTarget(value)) {
    throw new Error('Socket drop target is invalid.');
  }
}

function assertValidStepReorderDragState(value: unknown): asserts value is StepReorderDragState {
  if (!value || typeof value !== 'object') {
    throw new Error('Step reorder drag state must be an object.');
  }

  const candidate = value as Partial<StepReorderDragState>;
  if (!isNonEmptyString(candidate.stepId)) {
    throw new Error(`Invalid step reorder stepId: ${String(candidate.stepId)}`);
  }
  if (!(candidate.overStepId === null || isNonEmptyString(candidate.overStepId))) {
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
