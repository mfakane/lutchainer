import { createHistoryShortcutHandler } from '../interactions/keyboard-history.ts';
import {
    setupPipelineDndBindingsWithDispose,
    type PipelineDndBindingsDisposer,
} from './pipeline-dnd-bindings.ts';

type PipelineDndBindingsOptions = Parameters<typeof setupPipelineDndBindingsWithDispose>[0];

interface EventTargetLike {
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) => void;
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject, options?: EventListenerOptions | boolean) => void;
}

export type PipelineUiInteractionsDisposer = () => void;

let disposePipelineUiInteractionsInternal: PipelineUiInteractionsDisposer | null = null;

export interface SetupPipelineUiInteractionsOptions {
  dndBindings: PipelineDndBindingsOptions;
  stepListEl: HTMLElement;
  paramColumnEl: HTMLElement;
  onScheduleConnectionDraw: () => void;
  onUpdateStepSwatches: () => void;
  onUndoPipeline: () => void;
  onRedoPipeline: () => void;
  windowTarget?: EventTargetLike;
}

function isHTMLElement(value: unknown): value is HTMLElement {
  return value instanceof HTMLElement;
}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} が不正です。`);
  }
}

function ensureEventTargetLike(value: unknown, label: string): asserts value is EventTargetLike {
  if (!value || typeof value !== 'object') {
    throw new Error(`${label} が不正です。`);
  }

  const eventTarget = value as Partial<EventTargetLike>;
  ensureFunction(eventTarget.addEventListener, `${label}.addEventListener`);
  ensureFunction(eventTarget.removeEventListener, `${label}.removeEventListener`);
}

function ensureOptions(value: unknown): asserts value is SetupPipelineUiInteractionsOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Pipeline UI interactions options が不正です。');
  }

  const options = value as Partial<SetupPipelineUiInteractionsOptions>;
  if (!options.dndBindings || typeof options.dndBindings !== 'object') {
    throw new Error('Pipeline UI interactions: dndBindings が不正です。');
  }
  if (!isHTMLElement(options.stepListEl)) {
    throw new Error('Pipeline UI interactions: stepListEl が不正です。');
  }
  if (!isHTMLElement(options.paramColumnEl)) {
    throw new Error('Pipeline UI interactions: paramColumnEl が不正です。');
  }

  ensureFunction(options.onScheduleConnectionDraw, 'Pipeline UI interactions: onScheduleConnectionDraw');
  ensureFunction(options.onUpdateStepSwatches, 'Pipeline UI interactions: onUpdateStepSwatches');
  ensureFunction(options.onUndoPipeline, 'Pipeline UI interactions: onUndoPipeline');
  ensureFunction(options.onRedoPipeline, 'Pipeline UI interactions: onRedoPipeline');

  if (options.windowTarget !== undefined) {
    ensureEventTargetLike(options.windowTarget, 'Pipeline UI interactions: windowTarget');
  }
}

export function setupPipelineUiInteractions(options: SetupPipelineUiInteractionsOptions): PipelineUiInteractionsDisposer {
  ensureOptions(options);

  disposePipelineUiInteractionsInternal?.();

  const disposeDndBindings: PipelineDndBindingsDisposer = setupPipelineDndBindingsWithDispose(options.dndBindings);

  const handleParamColumnScroll = (): void => {
    options.onScheduleConnectionDraw();
  };

  options.paramColumnEl.addEventListener('scroll', handleParamColumnScroll);

  const windowTarget = options.windowTarget ?? window;
  ensureEventTargetLike(windowTarget, 'Pipeline UI interactions: resolved windowTarget');

  const historyShortcutHandler = createHistoryShortcutHandler({
    onUndo: options.onUndoPipeline,
    onRedo: options.onRedoPipeline,
  });

  const handleKeyDown = (event: Event): void => {
    historyShortcutHandler(event as KeyboardEvent);
  };
  windowTarget.addEventListener('keydown', handleKeyDown);

  const handleResize = (): void => {
    options.onScheduleConnectionDraw();
    options.onUpdateStepSwatches();
  };
  windowTarget.addEventListener('resize', handleResize);

  const dispose: PipelineUiInteractionsDisposer = () => {
    disposeDndBindings();
    options.paramColumnEl.removeEventListener('scroll', handleParamColumnScroll);
    windowTarget.removeEventListener('keydown', handleKeyDown);
    windowTarget.removeEventListener('resize', handleResize);
  };

  disposePipelineUiInteractionsInternal = dispose;
  return dispose;
}
