import { updatePointerDragStateForMove } from '../../shared/interactions/dnd.ts';
import {
  applySocketDropConnection,
  cleanupSocketDragInteraction,
  handleSocketDragEnd as processSocketDragEnd,
  handleSocketDragMove as processSocketDragMove,
  syncSocketDropTargetState,
} from '../../shared/interactions/socket-dnd.ts';
import type { ParamName } from '../step/step-model.ts';
import type { SocketAxis, SocketDragState, SocketDropTarget } from './pipeline-view.ts';

type StatusKind = 'success' | 'error' | 'info';

interface PointerEventLike {
  pointerId: number;
  clientX: number;
  clientY: number;
}

export interface PipelineSocketDndControllerOptions {
  getSocketDragState: () => SocketDragState | null;
  setSocketDragState: (nextState: SocketDragState | null) => void;
  clearSocketDragState: () => void;
  getSocketDropTargetState: () => SocketDropTarget | null;
  setSocketDropTargetState: (nextTarget: SocketDropTarget | null) => void;
  resolveDropTarget: (dragState: SocketDragState, clientX: number, clientY: number) => SocketDropTarget | null;
  assignParamToSocket: (stepId: string, axis: SocketAxis, param: ParamName) => boolean;
  scheduleConnectionDraw: () => void;
  setSuppressClickUntil: (until: number) => void;
  setUserSelect: (value: string) => void;
  onStatus: (message: string, kind?: StatusKind) => void;
  t: (key: unknown, values?: Record<string, string | number>) => string;
  now?: () => number;
}

export interface PipelineSocketDndController {
  clearSocketDropTarget: () => void;
  setSocketDropTarget: (nextTarget: SocketDropTarget | null) => void;
  handleSocketDragMove: (event: PointerEvent) => void;
  handleSocketDragEnd: (event: PointerEvent) => void;
}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} が不正です。`);
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidPointerEventLike(value: unknown): value is PointerEventLike {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const event = value as Partial<PointerEventLike>;
  return Number.isInteger(event.pointerId)
    && isFiniteNumber(event.clientX)
    && isFiniteNumber(event.clientY);
}

function ensureOptions(value: unknown): asserts value is PipelineSocketDndControllerOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('PipelineSocketDndController の options が不正です。');
  }

  const options = value as Partial<PipelineSocketDndControllerOptions>;
  ensureFunction(options.getSocketDragState, 'PipelineSocketDndController: getSocketDragState');
  ensureFunction(options.setSocketDragState, 'PipelineSocketDndController: setSocketDragState');
  ensureFunction(options.clearSocketDragState, 'PipelineSocketDndController: clearSocketDragState');
  ensureFunction(options.getSocketDropTargetState, 'PipelineSocketDndController: getSocketDropTargetState');
  ensureFunction(options.setSocketDropTargetState, 'PipelineSocketDndController: setSocketDropTargetState');
  ensureFunction(options.resolveDropTarget, 'PipelineSocketDndController: resolveDropTarget');
  ensureFunction(options.assignParamToSocket, 'PipelineSocketDndController: assignParamToSocket');
  ensureFunction(options.scheduleConnectionDraw, 'PipelineSocketDndController: scheduleConnectionDraw');
  ensureFunction(options.setSuppressClickUntil, 'PipelineSocketDndController: setSuppressClickUntil');
  ensureFunction(options.setUserSelect, 'PipelineSocketDndController: setUserSelect');
  ensureFunction(options.onStatus, 'PipelineSocketDndController: onStatus');
  ensureFunction(options.t, 'PipelineSocketDndController: t');
  if (options.now !== undefined) {
    ensureFunction(options.now, 'PipelineSocketDndController: now');
  }
}

export function createPipelineSocketDndController(
  options: PipelineSocketDndControllerOptions,
): PipelineSocketDndController {
  ensureOptions(options);

  const now = options.now ?? (() => performance.now());

  const setSocketDropTarget = (nextTarget: SocketDropTarget | null): void => {
    syncSocketDropTargetState({
      currentTarget: options.getSocketDropTargetState(),
      nextTarget,
      setState: options.setSocketDropTargetState,
    });
  };

  const clearSocketDropTarget = (): void => {
    setSocketDropTarget(null);
  };

  const handleSocketDragMove = (event: PointerEvent): void => {
    if (!isValidPointerEventLike(event)) {
      throw new Error('Socket DnD move event が不正です。');
    }

    processSocketDragMove({
      event,
      socketDragState: options.getSocketDragState(),
      updateDragState: (dragState, clientX, clientY) => updatePointerDragStateForMove(dragState, clientX, clientY),
      setSocketDragState: nextState => options.setSocketDragState(nextState),
      resolveDropTarget: options.resolveDropTarget,
      setSocketDropTarget,
      onDragStart: dragState => {
        dragState.sourceEl.classList.add('socket-source-active');
        options.setUserSelect('none');
      },
      onDragProgress: options.scheduleConnectionDraw,
    });
  };

  const handleSocketDragEnd = (event: PointerEvent): void => {
    if (!isValidPointerEventLike(event)) {
      throw new Error('Socket DnD end event が不正です。');
    }

    processSocketDragEnd({
      event,
      socketDragState: options.getSocketDragState(),
      resolveDropTarget: options.resolveDropTarget,
      applyDropConnection: (dragState, dropTarget) => applySocketDropConnection({
        dragState,
        dropTarget,
        assignParamToSocket: options.assignParamToSocket,
      }),
      onDidDrag: () => {
        const timestamp = now() + 240;
        if (!isFiniteNumber(timestamp)) {
          throw new Error('Socket DnD suppressClick の時刻計算に失敗しました。');
        }
        options.setSuppressClickUntil(timestamp);
      },
      onApplied: () => {
        options.onStatus(options.t('main.status.socketConnected'), 'info');
      },
      cleanup: () => {
        cleanupSocketDragInteraction({
          socketDragState: options.getSocketDragState(),
          clearSocketDragState: options.clearSocketDragState,
          clearSocketDropTarget,
          clearUserSelect: () => {
            options.setUserSelect('');
          },
          onAfterCleanup: options.scheduleConnectionDraw,
        });
      },
    });
  };

  return {
    clearSocketDropTarget,
    setSocketDropTarget,
    handleSocketDragMove,
    handleSocketDragEnd,
  };
}
