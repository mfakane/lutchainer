import { type ParamRef } from '../../../features/step/step-model.ts';
import {
  isValidSocketAxis,
  type LutReorderDragState,
  type SocketAxis,
  type StepReorderDragState,
} from '../../../features/pipeline/pipeline-socket-types.ts';

export {
  isValidSocketAxis,
  type LutReorderDragState,
  type SocketAxis,
  type StepReorderDragState,
} from '../../../features/pipeline/pipeline-socket-types.ts';

export type SocketDragState =
  | {
      mode: 'param';
      sourceEl: HTMLElement;
      param: ParamRef;
      pointerId: number;
      startX: number;
      startY: number;
      pointerX: number;
      pointerY: number;
      dragging: boolean;
    }
  | {
      mode: 'step';
      sourceEl: HTMLElement;
      stepId: string;
      axis: SocketAxis;
      pointerId: number;
      startX: number;
      startY: number;
      pointerX: number;
      pointerY: number;
      dragging: boolean;
    };

export type SocketDropTarget =
  | {
      kind: 'param';
      element: HTMLElement;
      param: ParamRef;
    }
  | {
      kind: 'step';
      element: HTMLElement;
      stepId: string;
      axis: SocketAxis;
    };

export interface ReorderIndicatorState<TId extends string | number> {
  draggedId: TId;
  overId: TId | null;
  dropAfter: boolean;
}

export interface ReorderIndicatorBinding<TId extends string | number> {
  containerEl: HTMLElement;
  itemSelector: string;
  getItemId: (item: HTMLElement) => TId | null;
  draggingAttribute: string;
  dropPositionAttribute: string;
}

export interface ConnectionPathOptions {
  extraClass?: string;
  strokeColor?: string;
}

export interface ConnectionPathSpec {
  key: string;
  start: {
    x: number;
    y: number;
  };
  end: {
    x: number;
    y: number;
  };
  options?: ConnectionPathOptions;
}

interface AnchorPoint {
  x: number;
  y: number;
}

export const CONNECTION_FALLBACK_COLOR = '#78d9c4';
export const CONNECTION_DRAG_PREVIEW_COLOR = '#c6fff1';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHtmlElement(value: unknown): value is HTMLElement {
  return value instanceof HTMLElement;
}

function assertValidReorderIndicatorBinding<TId extends string | number>(
  binding: ReorderIndicatorBinding<TId>,
): void {
  if (!isHtmlElement(binding.containerEl)) {
    throw new Error('Reorder indicator containerEl must be an HTMLElement.');
  }
  if (!isNonEmptyString(binding.itemSelector)) {
    throw new Error('Reorder indicator itemSelector must be a non-empty string.');
  }
  if (typeof binding.getItemId !== 'function') {
    throw new Error('Reorder indicator getItemId must be a function.');
  }
  if (!isNonEmptyString(binding.draggingAttribute)) {
    throw new Error('Reorder indicator draggingAttribute must be a non-empty string.');
  }
  if (!isNonEmptyString(binding.dropPositionAttribute)) {
    throw new Error('Reorder indicator dropPositionAttribute must be a non-empty string.');
  }
}

function assertValidReorderIndicatorState<TId extends string | number>(
  state: ReorderIndicatorState<TId>,
): void {
  if (typeof state.dropAfter !== 'boolean') {
    throw new Error('Reorder indicator dropAfter must be a boolean.');
  }
}

function getItemElements<TId extends string | number>(binding: ReorderIndicatorBinding<TId>): HTMLElement[] {
  return Array.from(binding.containerEl.querySelectorAll<HTMLElement>(binding.itemSelector));
}

function findIndicatorItemById<TId extends string | number>(
  binding: ReorderIndicatorBinding<TId>,
  id: TId,
): HTMLElement | null {
  for (const item of getItemElements(binding)) {
    const itemId = binding.getItemId(item);
    if (
      itemId !== null
      && typeof itemId !== 'string'
      && typeof itemId !== 'number'
    ) {
      throw new Error(`Reorder indicator item id must be string|number|null: ${String(itemId)}`);
    }

    if (itemId === id) {
      return item;
    }
  }

  return null;
}

export function getParamSocketAnchorPoint(element: HTMLElement, workspaceRect: DOMRect): AnchorPoint {
  const anchor = element.querySelector<HTMLElement>('[data-part="socket-dot"]') ?? element;
  const rect = anchor.getBoundingClientRect();
  return {
    x: rect.left + rect.width * 0.5 - workspaceRect.left,
    y: rect.top + rect.height * 0.5 - workspaceRect.top,
  };
}

export function getStepSocketAnchorPoint(element: HTMLElement, workspaceRect: DOMRect): AnchorPoint {
  const anchor = element.querySelector<HTMLElement>('[data-part="socket-dot"]') ?? element;
  const rect = anchor.getBoundingClientRect();
  return {
    x: rect.left + rect.width * 0.5 - workspaceRect.left,
    y: rect.top + rect.height * 0.5 - workspaceRect.top,
  };
}

export function buildConnectionPath(startX: number, startY: number, endX: number, endY: number): string {
  const direction = endX >= startX ? 1 : -1;
  const curve = Math.max(36, Math.abs(endX - startX) * 0.48);
  const c1x = startX + curve * direction;
  const c2x = endX - curve * direction;
  return `M ${startX} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${endX} ${endY}`;
}

export function getStepConnectionColor(stepId: string): string {
  if (!isNonEmptyString(stepId)) {
    return CONNECTION_FALLBACK_COLOR;
  }

  let normalizedSeed = 0;
  for (let index = 0; index < stepId.length; index += 1) {
    normalizedSeed = (normalizedSeed * 31 + stepId.charCodeAt(index)) % 360;
  }
  const hue = (normalizedSeed * 137.50776405003785 + 24) % 360;
  return `hsl(${hue.toFixed(1)}, 78%, 68%)`;
}

export function clearReorderDropIndicators<TId extends string | number>(binding: ReorderIndicatorBinding<TId>): void {
  assertValidReorderIndicatorBinding(binding);
  const items = getItemElements(binding);
  items.forEach(item => {
    delete item.dataset[binding.draggingAttribute];
    delete item.dataset[binding.dropPositionAttribute];
  });
}

export function updateReorderDropIndicators<TId extends string | number>(
  binding: ReorderIndicatorBinding<TId>,
  state: ReorderIndicatorState<TId> | null,
): void {
  clearReorderDropIndicators(binding);
  if (!state) {
    return;
  }

  assertValidReorderIndicatorState(state);

  const draggingEl = findIndicatorItemById(binding, state.draggedId);
  if (draggingEl) {
    draggingEl.dataset[binding.draggingAttribute] = 'true';
  }

  if (state.overId === null || state.overId === state.draggedId) {
    return;
  }

  const targetEl = findIndicatorItemById(binding, state.overId);
  if (!targetEl) {
    return;
  }

  targetEl.dataset[binding.dropPositionAttribute] = state.dropAfter ? 'after' : 'before';
}

function createStepReorderBinding(stepListEl: HTMLElement): ReorderIndicatorBinding<string> {
  if (!isHtmlElement(stepListEl)) {
    throw new Error('Step reorder indicator container must be an HTMLElement.');
  }

  return {
    containerEl: stepListEl,
    itemSelector: '[data-step-item="true"]',
    getItemId: item => {
      const rawStepId = item.dataset.stepId;
      return isNonEmptyString(rawStepId) ? rawStepId : null;
    },
    draggingAttribute: 'dragging',
    dropPositionAttribute: 'dropPosition',
  };
}

function createLutReorderBinding(lutStripListEl: HTMLElement): ReorderIndicatorBinding<string> {
  if (!isHtmlElement(lutStripListEl)) {
    throw new Error('LUT reorder indicator container must be an HTMLElement.');
  }

  return {
    containerEl: lutStripListEl,
    itemSelector: '[data-lut-item="true"]',
    getItemId: item => {
      const lutId = item.dataset.lutId;
      return isNonEmptyString(lutId) ? lutId : null;
    },
    draggingAttribute: 'dragging',
    dropPositionAttribute: 'dropPosition',
  };
}

export function clearStepDropIndicators(stepListEl: HTMLElement): void {
  clearReorderDropIndicators<string>(createStepReorderBinding(stepListEl));
}

export function updateStepDropIndicators(stepListEl: HTMLElement, stepReorderDragState: StepReorderDragState | null): void {
  updateReorderDropIndicators<string>(
    createStepReorderBinding(stepListEl),
    stepReorderDragState
      ? {
          draggedId: stepReorderDragState.stepId,
          overId: stepReorderDragState.overStepId,
          dropAfter: stepReorderDragState.dropAfter,
        }
      : null,
  );
}

export function clearLutDropIndicators(lutStripListEl: HTMLElement): void {
  clearReorderDropIndicators<string>(createLutReorderBinding(lutStripListEl));
}

export function updateLutDropIndicators(lutStripListEl: HTMLElement, lutReorderDragState: LutReorderDragState | null): void {
  updateReorderDropIndicators<string>(
    createLutReorderBinding(lutStripListEl),
    lutReorderDragState
      ? {
          draggedId: lutReorderDragState.lutId,
          overId: lutReorderDragState.overLutId,
          dropAfter: lutReorderDragState.dropAfter,
        }
      : null,
  );
}
