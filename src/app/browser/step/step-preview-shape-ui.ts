import {
  mountPreviewShapeBar,
  type PreviewShapeType,
} from '../components/preview-shape-bar.ts';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

export interface SetupStepPreviewShapeUiOptions {
  target: HTMLElement;
  initialShape: PreviewShapeType;
  isWireframeEnabled: () => boolean;
  onShapeChange: (shape: PreviewShapeType) => void;
  onWireframeChange: (enabled: boolean) => void;
  onExportMainPreviewPng: () => void | Promise<void>;
  onExportStepPreviewPng: () => void | Promise<void>;
  onStatus: StatusReporter;
}

function isValidPreviewShapeType(value: unknown): value is PreviewShapeType {
  return value === 'sphere' || value === 'cube' || value === 'torus';
}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} が不正です。`);
  }
}

function ensureOptions(value: unknown): asserts value is SetupStepPreviewShapeUiOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Step Preview Shape UI options が不正です。');
  }

  const options = value as Partial<SetupStepPreviewShapeUiOptions>;
  if (!(options.target instanceof HTMLElement)) {
    throw new Error('Step Preview Shape UI: target が不正です。');
  }
  if (!isValidPreviewShapeType(options.initialShape)) {
    throw new Error('Step Preview Shape UI: initialShape が不正です。');
  }

  ensureFunction(options.isWireframeEnabled, 'Step Preview Shape UI: isWireframeEnabled');
  ensureFunction(options.onShapeChange, 'Step Preview Shape UI: onShapeChange');
  ensureFunction(options.onWireframeChange, 'Step Preview Shape UI: onWireframeChange');
  ensureFunction(options.onExportMainPreviewPng, 'Step Preview Shape UI: onExportMainPreviewPng');
  ensureFunction(options.onExportStepPreviewPng, 'Step Preview Shape UI: onExportStepPreviewPng');
  ensureFunction(options.onStatus, 'Step Preview Shape UI: onStatus');
}

export function setupStepPreviewShapeUi(options: SetupStepPreviewShapeUiOptions): void {
  ensureOptions(options);

  const initialWireframeEnabled = options.isWireframeEnabled();
  if (typeof initialWireframeEnabled !== 'boolean') {
    throw new Error('Step Preview Shape UI: isWireframeEnabled の戻り値が不正です。');
  }

  mountPreviewShapeBar(options.target, {
    initialShape: options.initialShape,
    initialWireframeEnabled,
    onShapeChange: shape => {
      options.onShapeChange(shape);
    },
    onWireframeChange: enabled => {
      if (typeof enabled !== 'boolean') {
        options.onStatus('ワイヤーフレーム設定値が不正です。', 'error');
        return;
      }
      options.onWireframeChange(enabled);
    },
    onExportMainPreviewPng: async () => {
      await options.onExportMainPreviewPng();
    },
    onExportStepPreviewPng: async () => {
      await options.onExportStepPreviewPng();
    },
    onStatus: options.onStatus,
  });
}
