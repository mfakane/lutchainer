import * as pipelineModel from '../../../features/pipeline/pipeline-model.ts';
import type { SocketDragState, SocketDropTarget } from '../../../features/pipeline/pipeline-view.ts';
import * as pipelineView from '../../../features/pipeline/pipeline-view.ts';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidPointerId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHtmlElement(value: unknown): value is HTMLElement {
  return value instanceof HTMLElement;
}

function isSocketAxis(value: unknown): value is pipelineView.SocketAxis {
  return typeof value === 'string' && pipelineView.isValidSocketAxis(value);
}

function isParamName(value: unknown): boolean {
  return typeof value === 'string' && pipelineModel.isValidParamName(value);
}

export function isValidSocketDragState(value: unknown): value is SocketDragState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SocketDragState> & {
    mode?: unknown;
    sourceEl?: unknown;
    pointerId?: unknown;
    startX?: unknown;
    startY?: unknown;
    pointerX?: unknown;
    pointerY?: unknown;
    dragging?: unknown;
    param?: unknown;
    stepId?: unknown;
    axis?: unknown;
  };

  if (!isHtmlElement(candidate.sourceEl)) {
    return false;
  }
  if (!isValidPointerId(candidate.pointerId)) {
    return false;
  }
  if (!isFiniteNumber(candidate.startX) || !isFiniteNumber(candidate.startY)) {
    return false;
  }
  if (!isFiniteNumber(candidate.pointerX) || !isFiniteNumber(candidate.pointerY)) {
    return false;
  }
  if (typeof candidate.dragging !== 'boolean') {
    return false;
  }

  if (candidate.mode === 'param') {
    return isParamName(candidate.param);
  }

  if (candidate.mode === 'step') {
    return isNonEmptyString(candidate.stepId) && isSocketAxis(candidate.axis);
  }

  return false;
}

export function isValidSocketDropTarget(value: unknown): value is SocketDropTarget {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SocketDropTarget> & {
    kind?: unknown;
    element?: unknown;
    param?: unknown;
    stepId?: unknown;
    axis?: unknown;
  };

  if (!isHtmlElement(candidate.element)) {
    return false;
  }

  if (candidate.kind === 'param') {
    return isParamName(candidate.param);
  }

  if (candidate.kind === 'step') {
    return isNonEmptyString(candidate.stepId) && isSocketAxis(candidate.axis);
  }

  return false;
}
