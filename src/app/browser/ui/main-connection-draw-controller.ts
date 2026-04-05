import {
  createConnectionDrawScheduler,
  renderConnectionLayer,
} from '../connection-renderer.ts';
import type {
  SocketDragState,
  SocketDropTarget,
} from '../../../features/pipeline/pipeline-view.ts';
import type {
  StepModel,
} from '../../../features/step/step-model.ts';

interface SetupMainConnectionDrawControllerOptions {
  getPipelineWorkspaceEl: () => HTMLElement;
  getConnectionLayerEl: () => SVGSVGElement;
  getSteps: () => StepModel[];
  getSocketDragState: () => SocketDragState | null;
  getSocketDropTarget: () => SocketDropTarget | null;
}

export interface MainConnectionDrawController {
  scheduleConnectionDraw: () => void;
}

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

function ensureHtmlElement(value: unknown, label: string): asserts value is HTMLElement {
  if (!(value instanceof HTMLElement)) {
    throw new Error(`${label} must be an HTMLElement.`);
  }
}

function ensureSvgElement(value: unknown, label: string): asserts value is SVGSVGElement {
  if (!(value instanceof SVGSVGElement)) {
    throw new Error(`${label} must be an SVGSVGElement.`);
  }
}

function assertOptions(options: SetupMainConnectionDrawControllerOptions): void {
  ensureObject(options, 'Main connection draw options');
  ensureFunction(options.getPipelineWorkspaceEl, 'Main connection draw options.getPipelineWorkspaceEl');
  ensureFunction(options.getConnectionLayerEl, 'Main connection draw options.getConnectionLayerEl');
  ensureFunction(options.getSteps, 'Main connection draw options.getSteps');
  ensureFunction(options.getSocketDragState, 'Main connection draw options.getSocketDragState');
  ensureFunction(options.getSocketDropTarget, 'Main connection draw options.getSocketDropTarget');
}

export function setupMainConnectionDrawController(
  options: SetupMainConnectionDrawControllerOptions,
): MainConnectionDrawController {
  assertOptions(options);

  const scheduler = createConnectionDrawScheduler({
    draw: () => {
      const pipelineWorkspaceEl = options.getPipelineWorkspaceEl();
      const connectionLayerEl = options.getConnectionLayerEl();
      const steps = options.getSteps();

      ensureHtmlElement(pipelineWorkspaceEl, 'Main connection draw pipelineWorkspaceEl');
      ensureSvgElement(connectionLayerEl, 'Main connection draw connectionLayerEl');
      if (!Array.isArray(steps)) {
        throw new Error('Main connection draw options.getSteps must return an array.');
      }

      renderConnectionLayer({
        pipelineWorkspaceEl,
        connectionLayerEl,
        steps,
        socketDragState: options.getSocketDragState(),
        socketDropTarget: options.getSocketDropTarget(),
      });
    },
  });

  return {
    scheduleConnectionDraw: () => {
      scheduler.schedule();
    },
  };
}
