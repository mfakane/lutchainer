import {
  setupOrbitPointerControls,
  setupPipelinePanelResizer,
  setupPreviewPanelLayoutResizer,
  type CameraOrbitState,
  type StatusKind,
} from '../interactions/layout-interactions.ts';

interface SetupMainLayoutControlsOptions {
  canvas: HTMLCanvasElement;
  pipelinePanel: HTMLElement;
  pipelineResizer: HTMLElement;
  previewPanel: HTMLElement;
  previewDisplay: HTMLElement;
  previewResizer: HTMLElement;
  getOrbitState: () => CameraOrbitState;
  setOrbitState: (nextState: CameraOrbitState) => void;
  onPanelResized: () => void;
  onStatus: (message: string, kind: StatusKind) => void;
}

function assertHtmlElement(value: unknown, name: string): asserts value is HTMLElement {
  if (!(value instanceof HTMLElement)) {
    throw new Error(`${name} must be an HTMLElement.`);
  }
}

function assertHtmlCanvasElement(value: unknown, name: string): asserts value is HTMLCanvasElement {
  if (!(value instanceof HTMLCanvasElement)) {
    throw new Error(`${name} must be an HTMLCanvasElement.`);
  }
}

function assertMainLayoutControlOptions(options: SetupMainLayoutControlsOptions): void {
  if (!options || typeof options !== 'object') {
    throw new Error('Main layout control options must be an object.');
  }

  assertHtmlCanvasElement(options.canvas, 'Layout control canvas');
  assertHtmlElement(options.pipelinePanel, 'Layout control pipeline panel');
  assertHtmlElement(options.pipelineResizer, 'Layout control pipeline resizer');
  assertHtmlElement(options.previewPanel, 'Layout control preview panel');
  assertHtmlElement(options.previewDisplay, 'Layout control preview display');
  assertHtmlElement(options.previewResizer, 'Layout control preview resizer');

  if (typeof options.getOrbitState !== 'function') {
    throw new Error('Layout control getOrbitState must be a function.');
  }
  if (typeof options.setOrbitState !== 'function') {
    throw new Error('Layout control setOrbitState must be a function.');
  }
  if (typeof options.onPanelResized !== 'function') {
    throw new Error('Layout control onPanelResized must be a function.');
  }
  if (typeof options.onStatus !== 'function') {
    throw new Error('Layout control onStatus must be a function.');
  }
}

export function setupMainLayoutControls(options: SetupMainLayoutControlsOptions): void {
  assertMainLayoutControlOptions(options);

  const {
    canvas,
    pipelinePanel,
    pipelineResizer,
    previewPanel,
    previewDisplay,
    previewResizer,
    getOrbitState,
    setOrbitState,
    onPanelResized,
    onStatus,
  } = options;

  setupPipelinePanelResizer({
    panel: pipelinePanel,
    resizer: pipelineResizer,
    onResized: onPanelResized,
  });

  setupPreviewPanelLayoutResizer({
    previewPanel,
    previewDisplay,
    previewResizer,
    onStatus,
  });

  setupOrbitPointerControls({
    canvas,
    getOrbitState,
    setOrbitState,
  });
}
