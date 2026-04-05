import { type ParamName } from '../step/step-model';

export type SocketAxis = 'x' | 'y';

export type SocketDragState =
  | {
      mode: 'param';
      sourceEl: HTMLButtonElement;
      param: ParamName;
      pointerId: number;
      startX: number;
      startY: number;
      pointerX: number;
      pointerY: number;
      dragging: boolean;
    }
  | {
      mode: 'step';
      sourceEl: HTMLButtonElement;
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
      element: HTMLButtonElement;
      param: ParamName;
    }
  | {
      kind: 'step';
      element: HTMLButtonElement;
      stepId: string;
      axis: SocketAxis;
    };

export interface StepReorderDragState {
  stepId: string;
  overStepId: string | null;
  dropAfter: boolean;
}

export interface LutReorderDragState {
  lutId: string;
  overLutId: string | null;
  dropAfter: boolean;
}

export interface ReorderIndicatorState<TId extends string | number> {
  draggedId: TId;
  overId: TId | null;
  dropAfter: boolean;
}

export interface ReorderIndicatorBinding<TId extends string | number> {
  containerEl: HTMLElement;
  itemSelector: string;
  getItemId: (item: HTMLElement) => TId | null;
  draggingClass: string;
  dropBeforeClass: string;
  dropAfterClass: string;
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
  if (!isNonEmptyString(binding.draggingClass)) {
    throw new Error('Reorder indicator draggingClass must be a non-empty string.');
  }
  if (!isNonEmptyString(binding.dropBeforeClass)) {
    throw new Error('Reorder indicator dropBeforeClass must be a non-empty string.');
  }
  if (!isNonEmptyString(binding.dropAfterClass)) {
    throw new Error('Reorder indicator dropAfterClass must be a non-empty string.');
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

export function isValidSocketAxis(value: string): value is SocketAxis {
  return value === 'x' || value === 'y';
}

export function getParamSocketAnchorPoint(element: HTMLElement, workspaceRect: DOMRect): AnchorPoint {
  const anchor = element.querySelector<HTMLElement>('.param-socket-dot') ?? element;
  const rect = anchor.getBoundingClientRect();
  return {
    x: rect.left + rect.width * 0.5 - workspaceRect.left,
    y: rect.top + rect.height * 0.5 - workspaceRect.top,
  };
}

export function getStepSocketAnchorPoint(element: HTMLElement, workspaceRect: DOMRect): AnchorPoint {
  const anchor = element.querySelector<HTMLElement>('.step-socket-dot') ?? element;
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

function isValidConnectionColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value)
    || /^hsl\(\s*(?:\d+(?:\.\d+)?)\s*,\s*(?:\d+(?:\.\d+)?)%\s*,\s*(?:\d+(?:\.\d+)?)%\s*\)$/.test(value);
}

function assertValidConnectionPathSpec(spec: ConnectionPathSpec, index: number): void {
  if (!spec || typeof spec !== 'object') {
    throw new Error(`ConnectionPathSpec at index ${index} must be an object.`);
  }
  if (!isNonEmptyString(spec.key)) {
    throw new Error(`ConnectionPathSpec key at index ${index} must be a non-empty string.`);
  }
  if (
    !Number.isFinite(spec.start.x)
    || !Number.isFinite(spec.start.y)
    || !Number.isFinite(spec.end.x)
    || !Number.isFinite(spec.end.y)
  ) {
    throw new Error(`ConnectionPathSpec coordinates at index ${index} must be finite numbers.`);
  }
  if (spec.options !== undefined && (spec.options === null || typeof spec.options !== 'object')) {
    throw new Error(`ConnectionPathSpec options at index ${index} must be an object when provided.`);
  }
}

function resolveConnectionClassName(extraClass: string | undefined): string {
  const normalizedExtraClass = typeof extraClass === 'string' ? extraClass.trim() : '';
  return normalizedExtraClass ? `connection-path ${normalizedExtraClass}` : 'connection-path';
}

function resolveConnectionStrokeColor(strokeColor: string | undefined): string {
  const rawStrokeColor = typeof strokeColor === 'string' ? strokeColor.trim() : '';
  return isValidConnectionColor(rawStrokeColor) ? rawStrokeColor : '';
}

function applyConnectionPathAttributes(
  path: SVGPathElement,
  start: AnchorPoint,
  end: AnchorPoint,
  options: ConnectionPathOptions = {},
): void {
  path.setAttribute('class', resolveConnectionClassName(options.extraClass));
  path.setAttribute('d', buildConnectionPath(start.x, start.y, end.x, end.y));

  const strokeColor = resolveConnectionStrokeColor(options.strokeColor);
  if (strokeColor) {
    path.style.setProperty('--connection-color', strokeColor);
  } else {
    path.style.removeProperty('--connection-color');
  }
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

export function appendConnectionPath(
  connectionLayerEl: SVGSVGElement,
  start: AnchorPoint,
  end: AnchorPoint,
  options: ConnectionPathOptions = {},
): void {
  if (
    !(connectionLayerEl instanceof SVGSVGElement)
    || !Number.isFinite(start.x)
    || !Number.isFinite(start.y)
    || !Number.isFinite(end.x)
    || !Number.isFinite(end.y)
  ) {
    return;
  }

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  applyConnectionPathAttributes(path, start, end, options);
  connectionLayerEl.appendChild(path);
}

export function syncConnectionPaths(connectionLayerEl: SVGSVGElement, specs: ConnectionPathSpec[]): void {
  if (!(connectionLayerEl instanceof SVGSVGElement)) {
    throw new Error('syncConnectionPaths connectionLayerEl must be an SVGSVGElement.');
  }
  if (!Array.isArray(specs)) {
    throw new Error('syncConnectionPaths specs must be an array.');
  }

  const keyedExistingPaths = new Map<string, SVGPathElement>();

  for (const path of Array.from(connectionLayerEl.querySelectorAll<SVGPathElement>('path.connection-path[data-connection-key]'))) {
    const key = path.dataset.connectionKey?.trim() ?? '';
    if (!isNonEmptyString(key)) {
      path.remove();
      continue;
    }

    if (keyedExistingPaths.has(key)) {
      path.remove();
      continue;
    }

    keyedExistingPaths.set(key, path);
  }

  for (const stalePath of Array.from(connectionLayerEl.querySelectorAll<SVGPathElement>('path.connection-path:not([data-connection-key])'))) {
    stalePath.remove();
  }

  for (let index = 0; index < specs.length; index++) {
    const spec = specs[index];
    assertValidConnectionPathSpec(spec, index);

    const key = spec.key.trim();
    let path = keyedExistingPaths.get(key);
    if (!path) {
      path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    }

    path.dataset.connectionKey = key;
    applyConnectionPathAttributes(path, spec.start, spec.end, spec.options);
    connectionLayerEl.appendChild(path);
    keyedExistingPaths.delete(key);
  }

  for (const stalePath of keyedExistingPaths.values()) {
    stalePath.remove();
  }
}

export function clearReorderDropIndicators<TId extends string | number>(binding: ReorderIndicatorBinding<TId>): void {
  assertValidReorderIndicatorBinding(binding);
  const items = getItemElements(binding);
  items.forEach(item => {
    item.classList.remove(binding.draggingClass, binding.dropBeforeClass, binding.dropAfterClass);
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
  draggingEl?.classList.add(binding.draggingClass);

  if (state.overId === null || state.overId === state.draggedId) {
    return;
  }

  const targetEl = findIndicatorItemById(binding, state.overId);
  if (!targetEl) {
    return;
  }

  targetEl.classList.add(state.dropAfter ? binding.dropAfterClass : binding.dropBeforeClass);
}

function createStepReorderBinding(stepListEl: HTMLElement): ReorderIndicatorBinding<string> {
  if (!isHtmlElement(stepListEl)) {
    throw new Error('Step reorder indicator container must be an HTMLElement.');
  }

  return {
    containerEl: stepListEl,
    itemSelector: '.step-item',
    getItemId: item => {
      const rawStepId = item.dataset.stepId;
      return isNonEmptyString(rawStepId) ? rawStepId : null;
    },
    draggingClass: 'dragging-step',
    dropBeforeClass: 'step-drop-before',
    dropAfterClass: 'step-drop-after',
  };
}

function createLutReorderBinding(lutStripListEl: HTMLElement): ReorderIndicatorBinding<string> {
  if (!isHtmlElement(lutStripListEl)) {
    throw new Error('LUT reorder indicator container must be an HTMLElement.');
  }

  return {
    containerEl: lutStripListEl,
    itemSelector: '.lut-strip-item',
    getItemId: item => {
      const lutId = item.dataset.lutId;
      return isNonEmptyString(lutId) ? lutId : null;
    },
    draggingClass: 'dragging-lut',
    dropBeforeClass: 'lut-drop-before',
    dropAfterClass: 'lut-drop-after',
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
