export type PreviewShapeType = 'sphere' | 'cube' | 'torus';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

interface PreviewShapeBarMountOptions {
  initialShape: PreviewShapeType;
  initialWireframeEnabled: boolean;
  onShapeChange: (shape: PreviewShapeType) => void;
  onWireframeChange: (enabled: boolean) => void;
  onExportMainPreviewPng: () => void | Promise<void>;
  onExportStepPreviewPng: () => void | Promise<void>;
  onStatus: StatusReporter;
}

interface PreviewShapeBarElement extends HTMLElement {
  activeShape: PreviewShapeType;
  wireframeEnabled: boolean;
}

let activePreviewShapeBarElement: PreviewShapeBarElement | null = null;
let previewShapeStatusReporter: StatusReporter = () => undefined;

function isValidPreviewShapeType(value: unknown): value is PreviewShapeType {
  return value === 'sphere' || value === 'cube' || value === 'torus';
}

function ensureMountOptions(value: unknown): asserts value is PreviewShapeBarMountOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Shapeバーの初期化オプションが不正です。');
  }

  const options = value as Partial<PreviewShapeBarMountOptions>;
  if (!isValidPreviewShapeType(options.initialShape)) {
    throw new Error('Shapeバーの初期Shapeが不正です。');
  }
  if (typeof options.initialWireframeEnabled !== 'boolean') {
    throw new Error('Shapeバーの初期Wireframe状態が不正です。');
  }
  if (typeof options.onShapeChange !== 'function') {
    throw new Error('Shapeバーの変更コールバックが不正です。');
  }
  if (typeof options.onWireframeChange !== 'function') {
    throw new Error('ShapeバーのWireframe変更コールバックが不正です。');
  }
  if (typeof options.onExportMainPreviewPng !== 'function') {
    throw new Error('Shapeバーの3Dプレビュー書き出しコールバックが不正です。');
  }
  if (typeof options.onExportStepPreviewPng !== 'function') {
    throw new Error('ShapeバーのStepプレビュー書き出しコールバックが不正です。');
  }
  if (typeof options.onStatus !== 'function') {
    throw new Error('Shapeバーのステータス通知コールバックが不正です。');
  }
}

export function mountPreviewShapeBar(target: HTMLElement, options: PreviewShapeBarMountOptions): void {
  if (!(target instanceof HTMLElement)) {
    throw new Error('Shapeバーの描画先要素が不正です。');
  }

  ensureMountOptions(options);
  previewShapeStatusReporter = options.onStatus;

  const element = target as PreviewShapeBarElement;
  element.activeShape = options.initialShape;
  element.wireframeEnabled = options.initialWireframeEnabled;
  activePreviewShapeBarElement = element;

  element.addEventListener('preview-shape-change', event => {
    const detail = (event as CustomEvent<{ shape: PreviewShapeType }>).detail;
    options.onShapeChange(detail.shape);
  });
  element.addEventListener('preview-wireframe-change', event => {
    const detail = (event as CustomEvent<{ enabled: boolean }>).detail;
    options.onWireframeChange(detail.enabled);
  });
  element.addEventListener('export-main-preview-png', () => {
    void options.onExportMainPreviewPng();
  });
  element.addEventListener('export-step-preview-png', () => {
    void options.onExportStepPreviewPng();
  });
  element.addEventListener('status-message', event => {
    const detail = (event as CustomEvent<{ message: string; kind?: StatusKind }>).detail;
    options.onStatus(detail.message, detail.kind);
  });
}

export function syncPreviewShapeBarState(nextShape: PreviewShapeType): void {
  if (!isValidPreviewShapeType(nextShape)) {
    previewShapeStatusReporter(`invalid preview shape: ${String(nextShape)}`, 'error');
    return;
  }

  activePreviewShapeBarElement?.setAttribute('data-shape-sync', nextShape);
  if (activePreviewShapeBarElement) {
    activePreviewShapeBarElement.activeShape = nextShape;
  }
}

export function syncPreviewWireframeState(enabled: boolean): void {
  if (typeof enabled !== 'boolean') {
    previewShapeStatusReporter(`invalid wireframe state: ${String(enabled)}`, 'error');
    return;
  }

  if (activePreviewShapeBarElement) {
    activePreviewShapeBarElement.wireframeEnabled = enabled;
  }
}
