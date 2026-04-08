import * as pipelineModel from '../../features/pipeline/pipeline-model.ts';
import type { SocketAxis, SocketDragState, SocketDropTarget } from '../../features/pipeline/pipeline-view.ts';
import * as pipelineView from '../../features/pipeline/pipeline-view.ts';
import type { ParamRef, StepModel } from '../../features/step/step-model.ts';
import {
  resolveSocketDragPreviewColor,
  resolveSocketDragPreviewEnd,
  resolveSocketDragPreviewStart,
} from './interactions/socket-dnd.ts';
import {
  isValidSocketDragState,
  isValidSocketDropTarget,
} from './interactions/socket-validation.ts';

export interface ConnectionLayerRenderOptions {
  pipelineWorkspaceEl: HTMLElement;
  connectionLayerEl: SVGSVGElement;
  steps: StepModel[];
  socketDragState: SocketDragState | null;
  socketDropTarget: SocketDropTarget | null;
}

export interface ConnectionDrawSchedulerOptions {
  draw: () => void;
  requestAnimationFrameImpl?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrameImpl?: (handle: number) => void;
}

export interface ConnectionDrawScheduler {
  schedule: () => void;
  cancel: () => void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isHtmlElement(value: unknown): value is HTMLElement {
  return value instanceof HTMLElement;
}

function isSvgElement(value: unknown): value is SVGSVGElement {
  return value instanceof SVGSVGElement;
}

function isValidConnectionStep(step: unknown): step is StepModel {
  if (!isObject(step)) {
    return false;
  }

  const candidate = step as Partial<StepModel>;
  return typeof candidate.id === 'string'
    && candidate.id.trim().length > 0
    && typeof candidate.muted === 'boolean'
    && typeof candidate.xParam === 'string'
    && pipelineModel.isValidParamName(candidate.xParam)
    && typeof candidate.yParam === 'string'
    && pipelineModel.isValidParamName(candidate.yParam);
}

function assertValidRenderOptions(value: unknown): asserts value is ConnectionLayerRenderOptions {
  if (!isObject(value)) {
    throw new Error('ConnectionLayerRenderOptions must be an object.');
  }

  const options = value as Partial<ConnectionLayerRenderOptions>;
  if (!isHtmlElement(options.pipelineWorkspaceEl)) {
    throw new Error('pipelineWorkspaceEl must be an HTMLElement.');
  }

  if (!isSvgElement(options.connectionLayerEl)) {
    throw new Error('connectionLayerEl must be an SVGSVGElement.');
  }

  if (!Array.isArray(options.steps)) {
    throw new Error('steps must be an array.');
  }

  for (let index = 0; index < options.steps.length; index++) {
    if (!isValidConnectionStep(options.steps[index])) {
      throw new Error(`steps[${index}] is invalid for connection rendering.`);
    }
  }

  if (options.socketDragState !== null && options.socketDragState !== undefined && !isValidSocketDragState(options.socketDragState)) {
    throw new Error('socketDragState is invalid.');
  }

  if (options.socketDropTarget !== null && options.socketDropTarget !== undefined && !isValidSocketDropTarget(options.socketDropTarget)) {
    throw new Error('socketDropTarget is invalid.');
  }
}

function assertValidSchedulerOptions(value: unknown): asserts value is ConnectionDrawSchedulerOptions {
  if (!isObject(value)) {
    throw new Error('ConnectionDrawSchedulerOptions must be an object.');
  }

  const options = value as Partial<ConnectionDrawSchedulerOptions>;
  if (typeof options.draw !== 'function') {
    throw new Error('draw must be a function.');
  }

  if (options.requestAnimationFrameImpl !== undefined && typeof options.requestAnimationFrameImpl !== 'function') {
    throw new Error('requestAnimationFrameImpl must be a function when provided.');
  }

  if (options.cancelAnimationFrameImpl !== undefined && typeof options.cancelAnimationFrameImpl !== 'function') {
    throw new Error('cancelAnimationFrameImpl must be a function when provided.');
  }
}

function buildStepConnectionSpecs(
  pipelineWorkspaceEl: HTMLElement,
  workspaceRect: DOMRect,
  steps: StepModel[],
): pipelineView.ConnectionPathSpec[] {
  const specs: pipelineView.ConnectionPathSpec[] = [];

  for (const step of steps) {
    const stepConnectionColor = pipelineView.getStepConnectionColor(step.id);
    const edges: Array<{ param: ParamRef; axis: SocketAxis }> = [
      { param: step.xParam, axis: 'x' },
      { param: step.yParam, axis: 'y' },
    ];

    for (const edge of edges) {
      const source = pipelineWorkspaceEl.querySelector<HTMLElement>(`.param-socket[data-param="${edge.param}"]`);
      const target = pipelineWorkspaceEl.querySelector<HTMLElement>(`.step-socket[data-step-id="${step.id}"][data-axis="${edge.axis}"]`);
      if (!source || !target) {
        continue;
      }

      specs.push({
        key: `step-${step.id}-${edge.axis}`,
        start: pipelineView.getParamSocketAnchorPoint(source, workspaceRect),
        end: pipelineView.getStepSocketAnchorPoint(target, workspaceRect),
        options: { strokeColor: stepConnectionColor },
      });
    }
  }

  return specs;
}

function buildPreviewConnectionSpec(
  workspaceRect: DOMRect,
  socketDragState: SocketDragState | null,
  socketDropTarget: SocketDropTarget | null,
): pipelineView.ConnectionPathSpec | null {
  if (!socketDragState?.dragging) {
    return null;
  }

  const start = resolveSocketDragPreviewStart({
    socketDragState,
    workspaceRect,
    getParamSocketAnchorPoint: pipelineView.getParamSocketAnchorPoint,
    getStepSocketAnchorPoint: pipelineView.getStepSocketAnchorPoint,
  });
  const end = resolveSocketDragPreviewEnd({
    socketDragState,
    socketDropTarget,
    workspaceRect,
    getParamSocketAnchorPoint: pipelineView.getParamSocketAnchorPoint,
    getStepSocketAnchorPoint: pipelineView.getStepSocketAnchorPoint,
  });
  if (!start || !end) {
    return null;
  }

  return {
    key: 'preview',
    start,
    end,
    options: {
      extraClass: 'connection-path-preview',
      strokeColor: resolveSocketDragPreviewColor({
        socketDragState,
        socketDropTarget,
        fallbackColor: pipelineView.CONNECTION_DRAG_PREVIEW_COLOR,
        getStepConnectionColor: pipelineView.getStepConnectionColor,
      }),
    },
  };
}

export function renderConnectionLayer(options: ConnectionLayerRenderOptions): void {
  assertValidRenderOptions(options);

  const workspaceRect = options.pipelineWorkspaceEl.getBoundingClientRect();
  const width = Math.max(1, Math.floor(workspaceRect.width));
  const height = Math.max(1, Math.floor(workspaceRect.height));

  options.connectionLayerEl.setAttribute('width', String(width));
  options.connectionLayerEl.setAttribute('height', String(height));
  options.connectionLayerEl.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const pathSpecs = buildStepConnectionSpecs(options.pipelineWorkspaceEl, workspaceRect, options.steps);
  const previewSpec = buildPreviewConnectionSpec(workspaceRect, options.socketDragState, options.socketDropTarget);
  if (previewSpec) {
    pathSpecs.push(previewSpec);
  }

  pipelineView.syncConnectionPaths(options.connectionLayerEl, pathSpecs);
}

export function createConnectionDrawScheduler(options: ConnectionDrawSchedulerOptions): ConnectionDrawScheduler {
  assertValidSchedulerOptions(options);

  const requestFrame = options.requestAnimationFrameImpl ?? requestAnimationFrame;
  const cancelFrame = options.cancelAnimationFrameImpl ?? cancelAnimationFrame;
  let pendingFrameId: number | null = null;

  return {
    schedule: () => {
      if (pendingFrameId !== null) {
        return;
      }

      pendingFrameId = requestFrame(() => {
        pendingFrameId = null;
        options.draw();
      });
    },
    cancel: () => {
      if (pendingFrameId === null) {
        return;
      }

      cancelFrame(pendingFrameId);
      pendingFrameId = null;
    },
  };
}
