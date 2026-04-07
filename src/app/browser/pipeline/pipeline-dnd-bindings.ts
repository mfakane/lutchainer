import {
  bindPointerDragSources,
  bindReorderDragHandlers,
  createPointerDragState,
} from '../interactions/dnd';
import type { ParamRef } from '../../../features/step/step-model';
import type {
  LutReorderDragState,
  SocketAxis,
  SocketDragState,
  StepReorderDragState,
} from '../../../features/pipeline/pipeline-view';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

interface LutDropPlacement {
  lutId: string | null;
  after: boolean;
}

interface StepDropPlacement {
  stepId: string | null;
  after: boolean;
}

interface SetupLutReorderBindingsOptions {
  lutStripListEl: HTMLElement;
  parseLutId: (value: string | undefined) => string | null;
  getLutDropPlacement: (clientX: number) => LutDropPlacement;
  getLutReorderDragState: () => LutReorderDragState | null;
  setLutReorderDragState: (state: LutReorderDragState | null) => void;
  clearLutReorderDragState: () => void;
  updateLutDropIndicators: () => void;
  clearLutDropIndicators: () => void;
  moveLutToPosition: (lutId: string, targetLutId: string | null, after: boolean) => void;
  onStatus: StatusReporter;
}

interface SetupStepReorderBindingsOptions {
  stepListEl: HTMLElement;
  parseStepId: (value: string | undefined) => string | null;
  getStepDropPlacement: (clientY: number) => StepDropPlacement;
  getStepReorderDragState: () => StepReorderDragState | null;
  setStepReorderDragState: (state: StepReorderDragState | null) => void;
  clearStepReorderDragState: () => void;
  updateStepDropIndicators: () => void;
  clearStepDropIndicators: () => void;
  moveStepToPosition: (stepId: string, targetStepId: string | null, after: boolean) => void;
  onStatus: StatusReporter;
}

interface SetupSocketPointerBindingsOptions {
  paramNodeListEl: HTMLElement;
  stepListEl: HTMLElement;
  parseStepId: (value: string | undefined) => string | null;
  isValidParamName: (value: string) => value is ParamRef;
  isValidSocketAxis: (value: string) => value is SocketAxis;
  setSocketDragState: (state: SocketDragState | null) => void;
  handleSocketDragMove: (event: PointerEvent) => void;
  handleSocketDragEnd: (event: PointerEvent) => void;
  onStatus: StatusReporter;
}

interface SetupPipelineDndBindingsOptions {
  lutReorder: SetupLutReorderBindingsOptions;
  socketPointer: SetupSocketPointerBindingsOptions;
  stepReorder: SetupStepReorderBindingsOptions;
}

type SocketDragStartSeed =
  | {
      mode: 'param';
      sourceEl: HTMLElement;
      param: ParamRef;
    }
  | {
      mode: 'step';
      sourceEl: HTMLElement;
      stepId: string;
      axis: SocketAxis;
    };

function isHTMLElement(value: unknown): value is HTMLElement {
  return value instanceof HTMLElement;
}

function isLutDropPlacement(value: unknown): value is LutDropPlacement {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const placement = value as Partial<LutDropPlacement>;
  const validTarget = placement.lutId === null || typeof placement.lutId === 'string';
  return validTarget && typeof placement.after === 'boolean';
}

function isStepDropPlacement(value: unknown): value is StepDropPlacement {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const placement = value as Partial<StepDropPlacement>;
  const validTarget = placement.stepId === null || typeof placement.stepId === 'string';
  return validTarget && typeof placement.after === 'boolean';
}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} が不正です。`);
  }
}

function ensureStatusReporter(value: unknown, label: string): asserts value is StatusReporter {
  if (typeof value !== 'function') {
    throw new Error(`${label} が不正です。`);
  }
}

function ensureSetupLutReorderBindingsOptions(value: unknown): asserts value is SetupLutReorderBindingsOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('LUT reorder D&D オプションが不正です。');
  }

  const options = value as Partial<SetupLutReorderBindingsOptions>;
  if (!isHTMLElement(options.lutStripListEl)) {
    throw new Error('LUT reorder D&D: lutStripListEl が不正です。');
  }

  ensureFunction(options.parseLutId, 'LUT reorder D&D: parseLutId');
  ensureFunction(options.getLutDropPlacement, 'LUT reorder D&D: getLutDropPlacement');
  ensureFunction(options.getLutReorderDragState, 'LUT reorder D&D: getLutReorderDragState');
  ensureFunction(options.setLutReorderDragState, 'LUT reorder D&D: setLutReorderDragState');
  ensureFunction(options.clearLutReorderDragState, 'LUT reorder D&D: clearLutReorderDragState');
  ensureFunction(options.updateLutDropIndicators, 'LUT reorder D&D: updateLutDropIndicators');
  ensureFunction(options.clearLutDropIndicators, 'LUT reorder D&D: clearLutDropIndicators');
  ensureFunction(options.moveLutToPosition, 'LUT reorder D&D: moveLutToPosition');
  ensureStatusReporter(options.onStatus, 'LUT reorder D&D: onStatus');
}

function ensureSetupStepReorderBindingsOptions(value: unknown): asserts value is SetupStepReorderBindingsOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Step reorder D&D オプションが不正です。');
  }

  const options = value as Partial<SetupStepReorderBindingsOptions>;
  if (!isHTMLElement(options.stepListEl)) {
    throw new Error('Step reorder D&D: stepListEl が不正です。');
  }

  ensureFunction(options.parseStepId, 'Step reorder D&D: parseStepId');
  ensureFunction(options.getStepDropPlacement, 'Step reorder D&D: getStepDropPlacement');
  ensureFunction(options.getStepReorderDragState, 'Step reorder D&D: getStepReorderDragState');
  ensureFunction(options.setStepReorderDragState, 'Step reorder D&D: setStepReorderDragState');
  ensureFunction(options.clearStepReorderDragState, 'Step reorder D&D: clearStepReorderDragState');
  ensureFunction(options.updateStepDropIndicators, 'Step reorder D&D: updateStepDropIndicators');
  ensureFunction(options.clearStepDropIndicators, 'Step reorder D&D: clearStepDropIndicators');
  ensureFunction(options.moveStepToPosition, 'Step reorder D&D: moveStepToPosition');
  ensureStatusReporter(options.onStatus, 'Step reorder D&D: onStatus');
}

function ensureSetupSocketPointerBindingsOptions(value: unknown): asserts value is SetupSocketPointerBindingsOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Socket pointer D&D オプションが不正です。');
  }

  const options = value as Partial<SetupSocketPointerBindingsOptions>;
  if (!isHTMLElement(options.paramNodeListEl)) {
    throw new Error('Socket pointer D&D: paramNodeListEl が不正です。');
  }
  if (!isHTMLElement(options.stepListEl)) {
    throw new Error('Socket pointer D&D: stepListEl が不正です。');
  }

  ensureFunction(options.parseStepId, 'Socket pointer D&D: parseStepId');
  ensureFunction(options.isValidParamName, 'Socket pointer D&D: isValidParamName');
  ensureFunction(options.isValidSocketAxis, 'Socket pointer D&D: isValidSocketAxis');
  ensureFunction(options.setSocketDragState, 'Socket pointer D&D: setSocketDragState');
  ensureFunction(options.handleSocketDragMove, 'Socket pointer D&D: handleSocketDragMove');
  ensureFunction(options.handleSocketDragEnd, 'Socket pointer D&D: handleSocketDragEnd');
  ensureStatusReporter(options.onStatus, 'Socket pointer D&D: onStatus');
}

function ensureSetupPipelineDndBindingsOptions(value: unknown): asserts value is SetupPipelineDndBindingsOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Pipeline D&D オプションが不正です。');
  }

  const options = value as Partial<SetupPipelineDndBindingsOptions>;
  ensureSetupLutReorderBindingsOptions(options.lutReorder);
  ensureSetupSocketPointerBindingsOptions(options.socketPointer);
  ensureSetupStepReorderBindingsOptions(options.stepReorder);
}

export function setupPipelineDndBindings(options: SetupPipelineDndBindingsOptions): void {
  ensureSetupPipelineDndBindingsOptions(options);
  setupLutReorderBindings(options.lutReorder);
  setupSocketPointerBindings(options.socketPointer);
  setupStepReorderBindings(options.stepReorder);
}

export function setupLutReorderBindings(options: SetupLutReorderBindingsOptions): void {
  ensureSetupLutReorderBindingsOptions(options);

  bindReorderDragHandlers({
    containerEl: options.lutStripListEl,
    resolveDragStart: eventTarget => {
      if (eventTarget.closest('.lut-strip-remove')) {
        return { kind: 'ignore' };
      }

      const item = eventTarget.closest<HTMLElement>('.lut-strip-item');
      if (!item) {
        return { kind: 'ignore' };
      }

      const lutId = options.parseLutId(item.dataset.lutId);
      if (!lutId) {
        return { kind: 'invalid', message: '不正なLUT IDです。' };
      }

      return { kind: 'ready', id: lutId };
    },
    createDragState: lutId => ({ lutId, overLutId: lutId, dropAfter: true }),
    getDragState: options.getLutReorderDragState,
    setDragState: options.setLutReorderDragState,
    clearDragState: options.clearLutReorderDragState,
    getPlacement: event => {
      const placement = options.getLutDropPlacement(event.clientX);
      if (!isLutDropPlacement(placement)) {
        options.onStatus('LUTドロップ位置の判定結果が不正です。', 'error');
        return { targetId: null, after: true };
      }
      return { targetId: placement.lutId, after: placement.after };
    },
    applyPlacement: (dragState, placement) => ({
      ...dragState,
      overLutId: placement.targetId,
      dropAfter: placement.after,
    }),
    getDraggedId: dragState => dragState.lutId,
    getTargetId: dragState => dragState.overLutId,
    updateIndicators: options.updateLutDropIndicators,
    clearIndicators: options.clearLutDropIndicators,
    commitMove: options.moveLutToPosition,
    onInvalid: message => options.onStatus(message, 'error'),
  });
}

export function setupStepReorderBindings(options: SetupStepReorderBindingsOptions): void {
  ensureSetupStepReorderBindingsOptions(options);

  bindReorderDragHandlers({
    containerEl: options.stepListEl,
    resolveDragStart: eventTarget => {
      const handle = eventTarget.closest<HTMLButtonElement>('.step-drag-handle');
      if (!handle) {
        return { kind: 'ignore' };
      }

      const stepId = options.parseStepId(handle.dataset.stepId);
      if (stepId === null) {
        return { kind: 'invalid', message: '不正なStep IDです。' };
      }

      return { kind: 'ready', id: stepId };
    },
    createDragState: stepId => ({
      stepId,
      overStepId: stepId,
      dropAfter: true,
    }),
    getDragState: options.getStepReorderDragState,
    setDragState: options.setStepReorderDragState,
    clearDragState: options.clearStepReorderDragState,
    getPlacement: event => {
      const placement = options.getStepDropPlacement(event.clientY);
      if (!isStepDropPlacement(placement)) {
        options.onStatus('Stepドロップ位置の判定結果が不正です。', 'error');
        return { targetId: null, after: true };
      }
      return { targetId: placement.stepId, after: placement.after };
    },
    applyPlacement: (dragState, placement) => ({
      ...dragState,
      overStepId: placement.targetId,
      dropAfter: placement.after,
    }),
    getDraggedId: dragState => dragState.stepId,
    getTargetId: dragState => dragState.overStepId,
    updateIndicators: options.updateStepDropIndicators,
    clearIndicators: options.clearStepDropIndicators,
    commitMove: options.moveStepToPosition,
    onInvalid: message => options.onStatus(message, 'error'),
  });
}

export function setupSocketPointerBindings(options: SetupSocketPointerBindingsOptions): void {
  ensureSetupSocketPointerBindingsOptions(options);

  bindPointerDragSources<SocketDragStartSeed, SocketDragState>({
    bindings: [
      {
        containerEl: options.paramNodeListEl,
        resolvePointerDown: eventTarget => {
          if (eventTarget.closest('[data-socket-drag-ignore="true"]')) {
            return { kind: 'ignore' };
          }

          const target = eventTarget.closest<HTMLElement>('.param-socket');
          if (!target) {
            return { kind: 'ignore' };
          }

          const interactiveChild = eventTarget.closest<HTMLElement>('input, select, textarea, button');
          if (interactiveChild && interactiveChild !== target) {
            return { kind: 'ignore' };
          }

          const rawParam = target.dataset.param ?? '';
          if (!options.isValidParamName(rawParam)) {
            return { kind: 'invalid', message: `無効なパラメータです: ${rawParam}` };
          }

          return {
            kind: 'ready',
            seed: {
              mode: 'param',
              sourceEl: target,
              param: rawParam,
            },
          };
        },
      },
      {
        containerEl: options.stepListEl,
        resolvePointerDown: eventTarget => {
          const target = eventTarget.closest<HTMLButtonElement>('.step-socket');
          if (!target) {
            return { kind: 'ignore' };
          }

          const stepId = options.parseStepId(target.dataset.stepId);
          if (stepId === null) {
            return { kind: 'invalid', message: '不正なStep IDです。' };
          }

          const axis = target.dataset.axis ?? '';
          if (!options.isValidSocketAxis(axis)) {
            return { kind: 'invalid', message: `不正なソケット軸です: ${axis}` };
          }

          return {
            kind: 'ready',
            seed: {
              mode: 'step',
              sourceEl: target,
              stepId,
              axis,
            },
          };
        },
      },
    ],
    onInvalid: message => options.onStatus(message, 'error'),
    setDragState: state => options.setSocketDragState(state),
    createDragState: (seed, event): SocketDragState => createPointerDragState(seed, event),
    onPointerMove: options.handleSocketDragMove,
    onPointerEnd: options.handleSocketDragEnd,
  });
}
