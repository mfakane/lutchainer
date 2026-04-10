import type { SocketAxis, SocketDragState, SocketDropTarget } from '../../../features/pipeline/pipeline-view.ts';
import type { ParamRef } from '../../../features/step/step-model.ts';
import {
  isValidSocketDragState,
  isValidSocketDropTarget,
} from './socket-validation.ts';

interface ResolveSocketDropTargetOptions {
  socketDragState: SocketDragState | null;
  clientX: number;
  clientY: number;
  parseStepId: (value: string | undefined) => string | null;
  isValidSocketAxis: (value: string) => value is SocketAxis;
  isValidParamName: (value: string) => value is ParamRef;
  elementFromPoint?: (x: number, y: number) => Element | null;
}

interface SocketDropTargetResolverOptions {
  parseStepId: (value: string | undefined) => string | null;
  isValidSocketAxis: (value: string) => value is SocketAxis;
  isValidParamName: (value: string) => value is ParamRef;
  elementFromPoint?: (x: number, y: number) => Element | null;
}

interface SyncSocketDropTargetStateOptions {
  currentTarget: SocketDropTarget | null;
  nextTarget: SocketDropTarget | null;
  setState: (nextTarget: SocketDropTarget | null) => void;
  attributeName?: string;
}

interface ApplySocketDropConnectionOptions {
  dragState: SocketDragState;
  dropTarget: SocketDropTarget | null;
  assignParamToSocket: (stepId: string, axis: SocketAxis, param: ParamRef) => boolean;
}

interface HandleSocketDragMoveOptions {
  event: PointerEvent;
  socketDragState: SocketDragState | null;
  updateDragState: (dragState: SocketDragState, clientX: number, clientY: number) => SocketDragState;
  setSocketDragState: (nextState: SocketDragState) => void;
  resolveDropTarget: (dragState: SocketDragState, clientX: number, clientY: number) => SocketDropTarget | null;
  setSocketDropTarget: (nextTarget: SocketDropTarget | null) => void;
  onDragStart: (dragState: SocketDragState) => void;
  onDragProgress: () => void;
}

interface HandleSocketDragEndOptions {
  event: PointerEvent;
  socketDragState: SocketDragState | null;
  resolveDropTarget: (dragState: SocketDragState, clientX: number, clientY: number) => SocketDropTarget | null;
  applyDropConnection: (dragState: SocketDragState, dropTarget: SocketDropTarget) => boolean;
  onDidDrag: () => void;
  onApplied: () => void;
  cleanup: () => void;
}

interface CleanupSocketDragInteractionOptions {
  socketDragState: SocketDragState | null;
  clearSocketDragState: () => void;
  clearSocketDropTarget: () => void;
  clearUserSelect: () => void;
  onAfterCleanup?: () => void;
  sourceActiveAttributeName?: string;
}

interface AnchorPoint {
  x: number;
  y: number;
}

interface ResolveSocketDragPreviewColorOptions {
  socketDragState: SocketDragState | null;
  socketDropTarget: SocketDropTarget | null;
  fallbackColor: string;
  getStepConnectionColor: (stepId: string) => string;
}

interface ResolveSocketDragPreviewStartOptions {
  socketDragState: SocketDragState | null;
  workspaceRect: DOMRect;
  getParamSocketAnchorPoint: (element: HTMLElement, workspaceRect: DOMRect) => AnchorPoint;
  getStepSocketAnchorPoint: (element: HTMLElement, workspaceRect: DOMRect) => AnchorPoint;
}

interface ResolveSocketDragPreviewEndOptions {
  socketDragState: SocketDragState | null;
  socketDropTarget: SocketDropTarget | null;
  workspaceRect: DOMRect;
  getParamSocketAnchorPoint: (element: HTMLElement, workspaceRect: DOMRect) => AnchorPoint;
  getStepSocketAnchorPoint: (element: HTMLElement, workspaceRect: DOMRect) => AnchorPoint;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

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

function isPointerEventLike(value: unknown): value is Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'> {
  if (!isObject(value)) {
    return false;
  }

  const candidate = value as Partial<Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>>;
  return isValidPointerId(candidate.pointerId) && isFiniteCoord(candidate.clientX) && isFiniteCoord(candidate.clientY);
}

function isValidWorkspaceRect(value: unknown): value is DOMRect {
  return value instanceof DOMRect;
}

function isValidAnchorPoint(value: unknown): value is AnchorPoint {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const point = value as Partial<AnchorPoint>;
  return isFiniteCoord(point.x) && isFiniteCoord(point.y);
}

function assertValidResolveSocketDropTargetOptions(
  options: ResolveSocketDropTargetOptions,
): void {
  if (!isFiniteCoord(options.clientX) || !isFiniteCoord(options.clientY)) {
    throw new Error(`drop target 座標が不正です: (${String(options.clientX)}, ${String(options.clientY)})`);
  }
  if (typeof options.parseStepId !== 'function') {
    throw new Error('parseStepId が不正です。');
  }
  if (typeof options.isValidSocketAxis !== 'function') {
    throw new Error('isValidSocketAxis が不正です。');
  }
  if (typeof options.isValidParamName !== 'function') {
    throw new Error('isValidParamName が不正です。');
  }
  if (options.elementFromPoint !== undefined && typeof options.elementFromPoint !== 'function') {
    throw new Error('elementFromPoint が不正です。');
  }

  if (options.socketDragState !== null && !isValidSocketDragState(options.socketDragState)) {
    throw new Error('socketDragState が不正です。');
  }
}

function assertValidSocketDropTargetResolverOptions(
  options: SocketDropTargetResolverOptions,
): void {
  if (typeof options.parseStepId !== 'function') {
    throw new Error('parseStepId が不正です。');
  }
  if (typeof options.isValidSocketAxis !== 'function') {
    throw new Error('isValidSocketAxis が不正です。');
  }
  if (typeof options.isValidParamName !== 'function') {
    throw new Error('isValidParamName が不正です。');
  }
  if (options.elementFromPoint !== undefined && typeof options.elementFromPoint !== 'function') {
    throw new Error('elementFromPoint が不正です。');
  }
}

function assertValidSyncSocketDropTargetStateOptions(
  options: SyncSocketDropTargetStateOptions,
): string {
  if (typeof options.setState !== 'function') {
    throw new Error('setState が不正です。');
  }

  if (options.currentTarget !== null && !isValidSocketDropTarget(options.currentTarget)) {
    throw new Error('currentTarget が不正です。');
  }

  if (options.nextTarget !== null && !isValidSocketDropTarget(options.nextTarget)) {
    throw new Error('nextTarget が不正です。');
  }

  const attributeName = options.attributeName ?? 'data-socket-target';
  if (!isNonEmptyString(attributeName)) {
    throw new Error('attributeName が不正です。');
  }

  return attributeName;
}

function assertValidApplySocketDropConnectionOptions(
  options: ApplySocketDropConnectionOptions,
): void {
  if (!isValidSocketDragState(options.dragState)) {
    throw new Error('dragState が不正です。');
  }

  if (options.dropTarget !== null && !isValidSocketDropTarget(options.dropTarget)) {
    throw new Error('dropTarget が不正です。');
  }

  if (typeof options.assignParamToSocket !== 'function') {
    throw new Error('assignParamToSocket が不正です。');
  }
}

function assertValidResolveSocketDragPreviewColorOptions(
  options: ResolveSocketDragPreviewColorOptions,
): void {
  if (options.socketDragState !== null && !isValidSocketDragState(options.socketDragState)) {
    throw new Error('socketDragState が不正です。');
  }

  if (options.socketDropTarget !== null && !isValidSocketDropTarget(options.socketDropTarget)) {
    throw new Error('socketDropTarget が不正です。');
  }

  if (!isNonEmptyString(options.fallbackColor)) {
    throw new Error('fallbackColor が不正です。');
  }

  if (typeof options.getStepConnectionColor !== 'function') {
    throw new Error('getStepConnectionColor が不正です。');
  }
}

function assertValidResolveSocketDragPreviewStartOptions(
  options: ResolveSocketDragPreviewStartOptions,
): void {
  if (options.socketDragState !== null && !isValidSocketDragState(options.socketDragState)) {
    throw new Error('socketDragState が不正です。');
  }

  if (!isValidWorkspaceRect(options.workspaceRect)) {
    throw new Error('workspaceRect が不正です。');
  }

  if (typeof options.getParamSocketAnchorPoint !== 'function') {
    throw new Error('getParamSocketAnchorPoint が不正です。');
  }

  if (typeof options.getStepSocketAnchorPoint !== 'function') {
    throw new Error('getStepSocketAnchorPoint が不正です。');
  }
}

function assertValidResolveSocketDragPreviewEndOptions(
  options: ResolveSocketDragPreviewEndOptions,
): void {
  if (options.socketDragState !== null && !isValidSocketDragState(options.socketDragState)) {
    throw new Error('socketDragState が不正です。');
  }

  if (options.socketDropTarget !== null && !isValidSocketDropTarget(options.socketDropTarget)) {
    throw new Error('socketDropTarget が不正です。');
  }

  if (!isValidWorkspaceRect(options.workspaceRect)) {
    throw new Error('workspaceRect が不正です。');
  }

  if (typeof options.getParamSocketAnchorPoint !== 'function') {
    throw new Error('getParamSocketAnchorPoint が不正です。');
  }

  if (typeof options.getStepSocketAnchorPoint !== 'function') {
    throw new Error('getStepSocketAnchorPoint が不正です。');
  }
}

function assertValidResolvedAnchorPoint(point: unknown, context: string): asserts point is AnchorPoint {
  if (!isValidAnchorPoint(point)) {
    throw new Error(`${context} のアンカーポイントが不正です。`);
  }
}

function assertValidHandleSocketDragMoveOptions(options: HandleSocketDragMoveOptions): void {
  if (!isPointerEventLike(options.event)) {
    throw new Error('event が不正です。');
  }

  if (options.socketDragState !== null && !isValidSocketDragState(options.socketDragState)) {
    throw new Error('socketDragState が不正です。');
  }

  if (typeof options.updateDragState !== 'function') {
    throw new Error('updateDragState が不正です。');
  }

  if (typeof options.setSocketDragState !== 'function') {
    throw new Error('setSocketDragState が不正です。');
  }

  if (typeof options.resolveDropTarget !== 'function') {
    throw new Error('resolveDropTarget が不正です。');
  }

  if (typeof options.setSocketDropTarget !== 'function') {
    throw new Error('setSocketDropTarget が不正です。');
  }

  if (typeof options.onDragStart !== 'function') {
    throw new Error('onDragStart が不正です。');
  }

  if (typeof options.onDragProgress !== 'function') {
    throw new Error('onDragProgress が不正です。');
  }
}

function assertValidHandleSocketDragEndOptions(options: HandleSocketDragEndOptions): void {
  if (!isPointerEventLike(options.event)) {
    throw new Error('event が不正です。');
  }

  if (options.socketDragState !== null && !isValidSocketDragState(options.socketDragState)) {
    throw new Error('socketDragState が不正です。');
  }

  if (typeof options.resolveDropTarget !== 'function') {
    throw new Error('resolveDropTarget が不正です。');
  }

  if (typeof options.applyDropConnection !== 'function') {
    throw new Error('applyDropConnection が不正です。');
  }

  if (typeof options.onDidDrag !== 'function') {
    throw new Error('onDidDrag が不正です。');
  }

  if (typeof options.onApplied !== 'function') {
    throw new Error('onApplied が不正です。');
  }

  if (typeof options.cleanup !== 'function') {
    throw new Error('cleanup が不正です。');
  }
}

function assertValidCleanupSocketDragInteractionOptions(
  options: CleanupSocketDragInteractionOptions,
): string {
  if (options.socketDragState !== null && !isValidSocketDragState(options.socketDragState)) {
    throw new Error('socketDragState が不正です。');
  }

  if (typeof options.clearSocketDragState !== 'function') {
    throw new Error('clearSocketDragState が不正です。');
  }

  if (typeof options.clearSocketDropTarget !== 'function') {
    throw new Error('clearSocketDropTarget が不正です。');
  }

  if (typeof options.clearUserSelect !== 'function') {
    throw new Error('clearUserSelect が不正です。');
  }

  if (options.onAfterCleanup !== undefined && typeof options.onAfterCleanup !== 'function') {
    throw new Error('onAfterCleanup が不正です。');
  }

  const attributeName = options.sourceActiveAttributeName ?? 'data-socket-source-active';
  if (!isNonEmptyString(attributeName)) {
    throw new Error('sourceActiveAttributeName が不正です。');
  }

  return attributeName;
}

export function createSocketDropTargetResolver(options: SocketDropTargetResolverOptions): (
  socketDragState: SocketDragState,
  clientX: number,
  clientY: number,
) => SocketDropTarget | null {
  assertValidObject(options, 'SocketDropTargetResolverOptions');
  assertValidSocketDropTargetResolverOptions(options);

  return (socketDragState, clientX, clientY) => resolveSocketDropTarget({
    socketDragState,
    clientX,
    clientY,
    parseStepId: options.parseStepId,
    isValidSocketAxis: options.isValidSocketAxis,
    isValidParamName: options.isValidParamName,
    elementFromPoint: options.elementFromPoint,
  });
}

export function resolveSocketDropTarget(options: ResolveSocketDropTargetOptions): SocketDropTarget | null {
  assertValidObject(options, 'ResolveSocketDropTargetOptions');
  assertValidResolveSocketDropTargetOptions(options);

  const {
    socketDragState,
    clientX,
    clientY,
    parseStepId,
    isValidSocketAxis,
    isValidParamName,
  } = options;

  if (!socketDragState) {
    return null;
  }

  const resolveElement = options.elementFromPoint ?? ((x: number, y: number) => document.elementFromPoint(x, y));
  const rawElement = resolveElement(clientX, clientY);
  if (!(rawElement instanceof HTMLElement)) {
    return null;
  }

  if (socketDragState.mode === 'param') {
    const target = rawElement.closest('[data-step-socket="true"]');
    if (!isHtmlElement(target)) {
      return null;
    }

    const stepId = parseStepId(target.dataset.stepId);
    const axis = target.dataset.axis ?? '';
    if (stepId === null || !isValidSocketAxis(axis)) {
      return null;
    }

    return {
      kind: 'step',
      element: target,
      stepId,
      axis,
    };
  }

  const target = rawElement.closest('[data-param-socket="true"]');
  if (!isHtmlElement(target)) {
    return null;
  }

  const param = target.dataset.param ?? '';
  if (!isValidParamName(param)) {
    return null;
  }

  return {
    kind: 'param',
    element: target,
    param,
  };
}

export function syncSocketDropTargetState(options: SyncSocketDropTargetStateOptions): void {
  assertValidObject(options, 'SyncSocketDropTargetStateOptions');
  const attributeName = assertValidSyncSocketDropTargetStateOptions(options);

  const { currentTarget, nextTarget, setState } = options;
  if (
    currentTarget
    && nextTarget
    && currentTarget.kind === nextTarget.kind
    && currentTarget.element === nextTarget.element
  ) {
    return;
  }

  if (currentTarget) {
    currentTarget.element.removeAttribute(attributeName);
  }

  setState(nextTarget);

  if (nextTarget) {
    nextTarget.element.setAttribute(attributeName, 'true');
  }
}

export function applySocketDropConnection(options: ApplySocketDropConnectionOptions): boolean {
  assertValidObject(options, 'ApplySocketDropConnectionOptions');
  assertValidApplySocketDropConnectionOptions(options);

  const { dragState, dropTarget, assignParamToSocket } = options;
  if (!dropTarget) {
    return false;
  }

  let applied = false;
  if (dragState.mode === 'param' && dropTarget.kind === 'step') {
    applied = assignParamToSocket(dropTarget.stepId, dropTarget.axis, dragState.param);
  } else if (dragState.mode === 'step' && dropTarget.kind === 'param') {
    applied = assignParamToSocket(dragState.stepId, dragState.axis, dropTarget.param);
  }

  if (typeof applied !== 'boolean') {
    throw new Error(`assignParamToSocket の戻り値が不正です: ${String(applied)}`);
  }

  return applied;
}

export function resolveSocketDragPreviewColor(options: ResolveSocketDragPreviewColorOptions): string {
  assertValidObject(options, 'ResolveSocketDragPreviewColorOptions');
  assertValidResolveSocketDragPreviewColorOptions(options);

  const { socketDragState, socketDropTarget, fallbackColor, getStepConnectionColor } = options;
  if (!socketDragState) {
    return fallbackColor;
  }

  if (socketDragState.mode === 'step') {
    return getStepConnectionColor(socketDragState.stepId);
  }

  if (socketDropTarget?.kind === 'step') {
    return getStepConnectionColor(socketDropTarget.stepId);
  }

  return fallbackColor;
}

export function resolveSocketDragPreviewStart(options: ResolveSocketDragPreviewStartOptions): AnchorPoint | null {
  assertValidObject(options, 'ResolveSocketDragPreviewStartOptions');
  assertValidResolveSocketDragPreviewStartOptions(options);

  const { socketDragState, workspaceRect, getParamSocketAnchorPoint, getStepSocketAnchorPoint } = options;
  if (!socketDragState) {
    return null;
  }

  if (socketDragState.mode === 'param') {
    const point = getParamSocketAnchorPoint(socketDragState.sourceEl, workspaceRect);
    assertValidResolvedAnchorPoint(point, 'param source');
    return point;
  }

  const point = getStepSocketAnchorPoint(socketDragState.sourceEl, workspaceRect);
  assertValidResolvedAnchorPoint(point, 'step source');
  return point;
}

export function resolveSocketDragPreviewEnd(options: ResolveSocketDragPreviewEndOptions): AnchorPoint | null {
  assertValidObject(options, 'ResolveSocketDragPreviewEndOptions');
  assertValidResolveSocketDragPreviewEndOptions(options);

  const {
    socketDragState,
    socketDropTarget,
    workspaceRect,
    getParamSocketAnchorPoint,
    getStepSocketAnchorPoint,
  } = options;

  if (!socketDragState) {
    return null;
  }

  if (socketDropTarget) {
    if (socketDropTarget.kind === 'param') {
      const point = getParamSocketAnchorPoint(socketDropTarget.element, workspaceRect);
      assertValidResolvedAnchorPoint(point, 'param target');
      return point;
    }

    const point = getStepSocketAnchorPoint(socketDropTarget.element, workspaceRect);
    assertValidResolvedAnchorPoint(point, 'step target');
    return point;
  }

  return {
    x: socketDragState.pointerX - workspaceRect.left,
    y: socketDragState.pointerY - workspaceRect.top,
  };
}

export function handleSocketDragMove(options: HandleSocketDragMoveOptions): boolean {
  assertValidObject(options, 'HandleSocketDragMoveOptions');
  assertValidHandleSocketDragMoveOptions(options);

  const { event, socketDragState, updateDragState, setSocketDragState, resolveDropTarget, setSocketDropTarget, onDragStart, onDragProgress } = options;
  if (!socketDragState || event.pointerId !== socketDragState.pointerId) {
    return false;
  }

  const nextDragState = updateDragState(socketDragState, event.clientX, event.clientY);
  if (!isValidSocketDragState(nextDragState)) {
    throw new Error('updateDragState の戻り値が不正です。');
  }

  setSocketDragState(nextDragState);

  if (!nextDragState.dragging) {
    return true;
  }

  if (!socketDragState.dragging) {
    onDragStart(nextDragState);
  }

  const dropTarget = resolveDropTarget(nextDragState, event.clientX, event.clientY);
  if (dropTarget !== null && !isValidSocketDropTarget(dropTarget)) {
    throw new Error('resolveDropTarget の戻り値が不正です。');
  }

  setSocketDropTarget(dropTarget);
  onDragProgress();
  return true;
}

export function handleSocketDragEnd(options: HandleSocketDragEndOptions): boolean {
  assertValidObject(options, 'HandleSocketDragEndOptions');
  assertValidHandleSocketDragEndOptions(options);

  const { event, socketDragState, resolveDropTarget, applyDropConnection, onDidDrag, onApplied, cleanup } = options;
  if (!socketDragState || event.pointerId !== socketDragState.pointerId) {
    return false;
  }

  const dropTarget = socketDragState.dragging
    ? resolveDropTarget(socketDragState, event.clientX, event.clientY)
    : null;
  if (dropTarget !== null && !isValidSocketDropTarget(dropTarget)) {
    throw new Error('resolveDropTarget の戻り値が不正です。');
  }

  if (socketDragState.dragging) {
    onDidDrag();
  }

  let applied = false;
  if (socketDragState.dragging && dropTarget) {
    applied = applyDropConnection(socketDragState, dropTarget);
    if (typeof applied !== 'boolean') {
      throw new Error(`applyDropConnection の戻り値が不正です: ${String(applied)}`);
    }
  }

  if (applied) {
    onApplied();
  }

  cleanup();
  return true;
}

export function cleanupSocketDragInteraction(options: CleanupSocketDragInteractionOptions): void {
  assertValidObject(options, 'CleanupSocketDragInteractionOptions');
  const sourceActiveAttributeName = assertValidCleanupSocketDragInteractionOptions(options);

  if (options.socketDragState) {
    options.socketDragState.sourceEl.removeAttribute(sourceActiveAttributeName);
  }

  options.clearSocketDragState();
  options.clearSocketDropTarget();
  options.clearUserSelect();
  options.onAfterCleanup?.();
}
