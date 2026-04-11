import type { PreviewShapeType } from '../components/solid-preview-shape-bar.tsx';
import type { Renderer } from '../../../platforms/webgl/renderer.ts';
import type { AppTranslator } from '../../../shared/i18n/browser-translation-contract.ts';
import { createCube, createSphere, createTorus } from '../../../shared/utils/geometry.ts';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

export interface PreviewShapeControllerOptions {
  renderer: Renderer;
  initialShape?: PreviewShapeType;
  getWireframeEnabled: () => boolean;
  setWireframeEnabled: (enabled: boolean) => void;
  syncPreviewShapeState: (shape: PreviewShapeType) => void;
  syncPreviewWireframeState: (enabled: boolean) => void;
  onStatus: StatusReporter;
  t: AppTranslator;
}

export interface PreviewShapeController {
  getCurrentShape: () => PreviewShapeType;
  setActiveShape: (shape: PreviewShapeType) => void;
  setWireframeOverlayEnabled: (enabled: unknown) => void;
}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} が不正です。`);
  }
}

function isValidPreviewShapeType(value: unknown): value is PreviewShapeType {
  return value === 'sphere' || value === 'cube' || value === 'torus';
}

function ensureOptions(value: unknown): asserts value is PreviewShapeControllerOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('PreviewShapeController options が不正です。');
  }

  const options = value as Partial<PreviewShapeControllerOptions>;
  if (!(options.renderer instanceof Object)) {
    throw new Error('PreviewShapeController: renderer が不正です。');
  }
  ensureFunction(options.getWireframeEnabled, 'PreviewShapeController: getWireframeEnabled');
  ensureFunction(options.setWireframeEnabled, 'PreviewShapeController: setWireframeEnabled');
  ensureFunction(options.syncPreviewShapeState, 'PreviewShapeController: syncPreviewShapeState');
  ensureFunction(options.syncPreviewWireframeState, 'PreviewShapeController: syncPreviewWireframeState');
  ensureFunction(options.onStatus, 'PreviewShapeController: onStatus');
  ensureFunction(options.t, 'PreviewShapeController: t');

  if (options.initialShape !== undefined && !isValidPreviewShapeType(options.initialShape)) {
    throw new Error(`PreviewShapeController: initialShape が不正です: ${String(options.initialShape)}`);
  }
}

function buildGeometry(type: PreviewShapeType) {
  switch (type) {
    case 'sphere': return createSphere(1.0, 40, 40);
    case 'cube': return createCube(1.6);
    case 'torus': return createTorus(0.65, 0.28, 48, 24);
  }
}

export function createPreviewShapeController(options: PreviewShapeControllerOptions): PreviewShapeController {
  ensureOptions(options);

  let currentShape: PreviewShapeType = options.initialShape ?? 'sphere';

  const getCurrentShape = (): PreviewShapeType => {
    return currentShape;
  };

  const setActiveShape = (shape: PreviewShapeType): void => {
    if (!isValidPreviewShapeType(shape)) {
      options.onStatus(`プレビュー形状が不正です: ${String(shape)}`, 'error');
      return;
    }

    currentShape = shape;
    options.renderer.uploadGeometry(buildGeometry(shape));
    options.syncPreviewShapeState(shape);
  };

  const setWireframeOverlayEnabled = (enabled: unknown): void => {
    if (typeof enabled !== 'boolean') {
      options.onStatus(options.t('main.status.wireframeInvalidValue', { value: String(enabled) }), 'error');
      return;
    }

    try {
      options.setWireframeEnabled(enabled);
      options.renderer.setWireframeOverlayEnabled(enabled);
      options.syncPreviewWireframeState(options.getWireframeEnabled());
      options.onStatus(
        options.t('main.status.wireframeChanged', {
          state: enabled ? options.t('common.on') : options.t('common.off'),
        }),
        'info',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : options.t('common.unknownError');
      options.onStatus(message, 'error');
    }
  };

  return {
    getCurrentShape,
    setActiveShape,
    setWireframeOverlayEnabled,
  };
}
