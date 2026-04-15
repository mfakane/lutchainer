export interface LinearDropCandidate<TId extends string | number> {
  id: TId;
  midpoint: number;
}

export interface LinearDropPlacement<TId extends string | number> {
  targetId: TId | null;
  after: boolean;
}

export type DragStartResolution<TId extends string | number> =
  | { kind: 'ignore' }
  | { kind: 'invalid'; message: string }
  | { kind: 'ready'; id: TId; transferText?: string };

export interface ReorderDragBinding<TId extends string | number, TState extends { dropAfter: boolean }> {
  containerEl: HTMLElement;
  resolveDragStart: (eventTarget: HTMLElement) => DragStartResolution<TId>;
  createDragState: (id: TId) => TState;
  getDragState: () => TState | null;
  setDragState: (state: TState | null) => void;
  clearDragState: () => void;
  getPlacement: (event: DragEvent) => LinearDropPlacement<TId>;
  applyPlacement: (state: TState, placement: LinearDropPlacement<TId>) => TState;
  getDraggedId: (state: TState) => TId;
  getTargetId: (state: TState) => TId | null;
  updateIndicators: () => void;
  clearIndicators: () => void;
  commitMove: (draggedId: TId, targetId: TId | null, after: boolean) => void;
  onInvalid: (message: string) => void;
  serializeId?: (id: TId) => string;
}

export interface PointerDragStateBase {
  pointerId: number;
  startX: number;
  startY: number;
  pointerX: number;
  pointerY: number;
  dragging: boolean;
}

export type PointerDragStartResolution<TSeed extends object> =
  | { kind: 'ignore' }
  | { kind: 'invalid'; message: string }
  | { kind: 'ready'; seed: TSeed };

export interface PointerDragSourceBinding<TSeed extends object> {
  containerEl: HTMLElement;
  resolvePointerDown: (eventTarget: HTMLElement) => PointerDragStartResolution<TSeed>;
}

export interface PointerDragSourceBindingOptions<TSeed extends object, TState extends PointerDragStateBase> {
  bindings: PointerDragSourceBinding<TSeed>[];
  onInvalid: (message: string) => void;
  setDragState: (state: TState) => void;
  createDragState: (seed: TSeed, event: PointerEvent) => TState;
  onPointerMove: (event: PointerEvent) => void;
  onPointerEnd: (event: PointerEvent) => void;
}

export type DndBindingDisposer = () => void;

export const INTERNAL_REORDER_DRAG_MIME_TYPE = 'application/x-lutchainer-reorder-drag';

function isFiniteCoord(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidPointerId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isHtmlElement(value: unknown): value is HTMLElement {
  return value instanceof HTMLElement;
}

function assertValidObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new Error(`${label} が不正です。`);
  }
}

function assertValidReorderDragBinding<TId extends string | number, TState extends { dropAfter: boolean }>(
  binding: ReorderDragBinding<TId, TState>,
): void {
  if (!isHtmlElement(binding.containerEl)) {
    throw new Error('reorder drag containerEl が不正です。');
  }

  const requiredCallbacks = [
    binding.resolveDragStart,
    binding.createDragState,
    binding.getDragState,
    binding.setDragState,
    binding.clearDragState,
    binding.getPlacement,
    binding.applyPlacement,
    binding.getDraggedId,
    binding.getTargetId,
    binding.updateIndicators,
    binding.clearIndicators,
    binding.commitMove,
    binding.onInvalid,
  ];

  if (requiredCallbacks.some(callback => typeof callback !== 'function')) {
    throw new Error('reorder drag binding のコールバック設定が不正です。');
  }

  if (binding.serializeId !== undefined && typeof binding.serializeId !== 'function') {
    throw new Error('reorder drag serializeId が不正です。');
  }
}

function assertValidPointerDragSourceBinding<TSeed extends object>(binding: PointerDragSourceBinding<TSeed>): void {
  if (!isHtmlElement(binding.containerEl)) {
    throw new Error('pointer drag source binding の containerEl が不正です。');
  }
  if (typeof binding.resolvePointerDown !== 'function') {
    throw new Error('pointer drag source binding の resolvePointerDown が不正です。');
  }
}

function assertValidPointerDragOptions<TSeed extends object, TState extends PointerDragStateBase>(
  options: PointerDragSourceBindingOptions<TSeed, TState>,
): void {
  if (!Array.isArray(options.bindings) || options.bindings.length === 0) {
    throw new Error('pointer drag bindings 配列が不正です。');
  }
  if (typeof options.onInvalid !== 'function') {
    throw new Error('pointer drag onInvalid が不正です。');
  }
  if (typeof options.setDragState !== 'function') {
    throw new Error('pointer drag setDragState が不正です。');
  }
  if (typeof options.createDragState !== 'function') {
    throw new Error('pointer drag createDragState が不正です。');
  }
  if (typeof options.onPointerMove !== 'function') {
    throw new Error('pointer drag onPointerMove が不正です。');
  }
  if (typeof options.onPointerEnd !== 'function') {
    throw new Error('pointer drag onPointerEnd が不正です。');
  }
}

export function getLinearDropPlacement<TId extends string | number>(
  candidates: LinearDropCandidate<TId>[],
  pointerCoord: number,
): LinearDropPlacement<TId> {
  if (!Array.isArray(candidates)) {
    throw new Error('ドロップ候補配列が不正です。');
  }
  if (!isFiniteCoord(pointerCoord)) {
    throw new Error(`ドロップ座標が不正です: ${String(pointerCoord)}`);
  }

  if (candidates.length === 0) {
    return { targetId: null, after: true };
  }

  for (const candidate of candidates) {
    assertValidObject(candidate, 'ドロップ候補');

    if (!isFiniteCoord(candidate.midpoint)) {
      throw new Error(`ドロップ候補の midpoint が不正です: ${String(candidate.midpoint)}`);
    }

    if (pointerCoord < candidate.midpoint) {
      return { targetId: candidate.id, after: false };
    }
  }

  return { targetId: candidates[candidates.length - 1].id, after: true };
}

export function bindReorderDragHandlers<TId extends string | number, TState extends { dropAfter: boolean }>(
  binding: ReorderDragBinding<TId, TState>,
): DndBindingDisposer {
  assertValidReorderDragBinding(binding);

  const transferId = (id: TId): string => binding.serializeId ? binding.serializeId(id) : String(id);

  const onDragStart = (event: DragEvent): void => {
    if (!isHtmlElement(event.target)) {
      event.preventDefault();
      return;
    }

    const resolution = binding.resolveDragStart(event.target);
    if (resolution.kind === 'ignore') {
      event.preventDefault();
      return;
    }

    if (resolution.kind === 'invalid') {
      event.preventDefault();
      binding.onInvalid(resolution.message);
      return;
    }

    binding.setDragState(binding.createDragState(resolution.id));

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(INTERNAL_REORDER_DRAG_MIME_TYPE, 'true');
      event.dataTransfer.setData('text/plain', resolution.transferText ?? transferId(resolution.id));
    }

    requestAnimationFrame(() => {
      binding.updateIndicators();
    });
  };

  const onDragOver = (event: DragEvent): void => {
    const dragState = binding.getDragState();
    if (!dragState) {
      return;
    }

    event.preventDefault();
    const placement = binding.getPlacement(event);
    binding.setDragState(binding.applyPlacement(dragState, placement));
    binding.updateIndicators();
  };

  const onDrop = (event: DragEvent): void => {
    const dragState = binding.getDragState();
    if (!dragState) {
      return;
    }

    event.preventDefault();
    const draggedId = binding.getDraggedId(dragState);
    const targetId = binding.getTargetId(dragState);
    const { dropAfter } = dragState;
    binding.clearDragState();
    binding.clearIndicators();
    binding.commitMove(draggedId, targetId, dropAfter);
  };

  const onDragEnd = (): void => {
    binding.clearDragState();
    binding.clearIndicators();
  };

  binding.containerEl.addEventListener('dragstart', onDragStart);
  binding.containerEl.addEventListener('dragover', onDragOver);
  binding.containerEl.addEventListener('drop', onDrop);
  binding.containerEl.addEventListener('dragend', onDragEnd);

  return () => {
    binding.containerEl.removeEventListener('dragstart', onDragStart);
    binding.containerEl.removeEventListener('dragover', onDragOver);
    binding.containerEl.removeEventListener('drop', onDrop);
    binding.containerEl.removeEventListener('dragend', onDragEnd);
  };
}

export function createPointerDragState<TSeed extends object>(
  seed: TSeed,
  event: PointerEvent,
): TSeed & PointerDragStateBase {
  assertValidObject(seed, 'pointer drag seed');

  if (!isValidPointerId(event.pointerId)) {
    throw new Error(`pointerId が不正です: ${String(event.pointerId)}`);
  }
  if (!isFiniteCoord(event.clientX) || !isFiniteCoord(event.clientY)) {
    throw new Error(`pointer 座標が不正です: (${String(event.clientX)}, ${String(event.clientY)})`);
  }

  return {
    ...seed,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    pointerX: event.clientX,
    pointerY: event.clientY,
    dragging: false,
  };
}

export function updatePointerDragStateForMove<TState extends PointerDragStateBase>(
  dragState: TState,
  clientX: number,
  clientY: number,
  dragThreshold = 6,
): TState {
  assertValidObject(dragState, 'pointer drag state');

  if (!isFiniteCoord(clientX) || !isFiniteCoord(clientY)) {
    throw new Error(`pointer move 座標が不正です: (${String(clientX)}, ${String(clientY)})`);
  }
  if (!isFiniteCoord(dragThreshold) || dragThreshold < 0) {
    throw new Error(`dragThreshold が不正です: ${String(dragThreshold)}`);
  }

  const nextDragState = {
    ...dragState,
    pointerX: clientX,
    pointerY: clientY,
    dragging: dragState.dragging,
  } as TState;

  if (!nextDragState.dragging) {
    const distance = Math.hypot(clientX - dragState.startX, clientY - dragState.startY);
    if (distance >= dragThreshold) {
      nextDragState.dragging = true;
    }
  }

  return nextDragState;
}

export function bindPointerDragSources<TSeed extends object, TState extends PointerDragStateBase>(
  options: PointerDragSourceBindingOptions<TSeed, TState>,
): DndBindingDisposer {
  assertValidObject(options, 'pointer drag options');
  assertValidPointerDragOptions(options);

  const pointerDownEntries: Array<{
    containerEl: HTMLElement;
    listener: (event: PointerEvent) => void;
  }> = [];

  for (const binding of options.bindings) {
    assertValidPointerDragSourceBinding(binding);

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0 || !isHtmlElement(event.target)) {
        return;
      }

      const resolution = binding.resolvePointerDown(event.target);
      if (resolution.kind === 'ignore') {
        return;
      }

      if (resolution.kind === 'invalid') {
        options.onInvalid(resolution.message);
        return;
      }

      options.setDragState(options.createDragState(resolution.seed, event));
    };

    binding.containerEl.addEventListener('pointerdown', onPointerDown);
    pointerDownEntries.push({
      containerEl: binding.containerEl,
      listener: onPointerDown,
    });
  }

  window.addEventListener('pointermove', options.onPointerMove);
  window.addEventListener('pointerup', options.onPointerEnd);
  window.addEventListener('pointercancel', options.onPointerEnd);

  return () => {
    for (const entry of pointerDownEntries) {
      entry.containerEl.removeEventListener('pointerdown', entry.listener);
    }

    window.removeEventListener('pointermove', options.onPointerMove);
    window.removeEventListener('pointerup', options.onPointerEnd);
    window.removeEventListener('pointercancel', options.onPointerEnd);
  };
}
