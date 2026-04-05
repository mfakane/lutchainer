import {
  createPipelineSocketDndController,
  type PipelineSocketDndController,
  type PipelineSocketDndControllerOptions,
} from './pipeline-socket-dnd-controller.ts';

export interface SetupMainPipelineSocketDndOptions extends Omit<PipelineSocketDndControllerOptions, 'setUserSelect'> {}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} must be a function.`);
  }
}

function ensureObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertOptions(options: SetupMainPipelineSocketDndOptions): void {
  ensureObject(options, 'Main pipeline socket DnD options');

  ensureFunction(options.getSocketDragState, 'Main pipeline socket DnD options.getSocketDragState');
  ensureFunction(options.setSocketDragState, 'Main pipeline socket DnD options.setSocketDragState');
  ensureFunction(options.clearSocketDragState, 'Main pipeline socket DnD options.clearSocketDragState');
  ensureFunction(options.getSocketDropTargetState, 'Main pipeline socket DnD options.getSocketDropTargetState');
  ensureFunction(options.setSocketDropTargetState, 'Main pipeline socket DnD options.setSocketDropTargetState');
  ensureFunction(options.resolveDropTarget, 'Main pipeline socket DnD options.resolveDropTarget');
  ensureFunction(options.assignParamToSocket, 'Main pipeline socket DnD options.assignParamToSocket');
  ensureFunction(options.scheduleConnectionDraw, 'Main pipeline socket DnD options.scheduleConnectionDraw');
  ensureFunction(options.setSuppressClickUntil, 'Main pipeline socket DnD options.setSuppressClickUntil');
  ensureFunction(options.onStatus, 'Main pipeline socket DnD options.onStatus');
  ensureFunction(options.t, 'Main pipeline socket DnD options.t');
  if (options.now !== undefined) {
    ensureFunction(options.now, 'Main pipeline socket DnD options.now');
  }
}

export function setupMainPipelineSocketDnd(
  options: SetupMainPipelineSocketDndOptions,
): PipelineSocketDndController {
  assertOptions(options);

  return createPipelineSocketDndController({
    ...options,
    setUserSelect: value => {
      if (typeof value !== 'string') {
        throw new Error('Main pipeline socket DnD setUserSelect value must be a string.');
      }

      const body = document.body;
      if (!(body instanceof HTMLBodyElement)) {
        throw new Error('Main pipeline socket DnD requires document.body to be available.');
      }

      body.style.userSelect = value;
    },
  });
}