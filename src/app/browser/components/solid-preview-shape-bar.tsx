import { t } from '../i18n.ts';
import { mountSvelteHost } from './custom-element-host.ts';
import './svelte-preview-shape-bar.svelte';

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

export type PreviewShapeType = 'sphere' | 'cube' | 'torus';

interface PreviewShapeBarController {
  dispose: () => void;
  syncShape: (nextShape: PreviewShapeType) => void;
  syncWireframe: (enabled: boolean) => void;
  onStatus: StatusReporter;
}

const PREVIEW_SHAPE_BAR_TAG = 'lut-preview-shape-bar';

let activePreviewShapeBarController: PreviewShapeBarController | null = null;
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

  if (activePreviewShapeBarController) {
    activePreviewShapeBarController.dispose();
    activePreviewShapeBarController = null;
  }

  const host = mountSvelteHost({
    tagName: PREVIEW_SHAPE_BAR_TAG,
    target,
    props: {
      activeShape: options.initialShape,
      wireframeEnabled: options.initialWireframeEnabled,
      onShapeChange: options.onShapeChange,
      onWireframeChange: options.onWireframeChange,
      onExportMainPreviewPng: options.onExportMainPreviewPng,
      onExportStepPreviewPng: options.onExportStepPreviewPng,
      onStatus: options.onStatus,
    },
  });

  activePreviewShapeBarController = {
    dispose: () => host.destroyHost(),
    syncShape: nextShape => {
      if (!isValidPreviewShapeType(nextShape)) {
        previewShapeStatusReporter(
          t('preview.status.invalidSyncValue', { value: String(nextShape) }),
          'error',
        );
        return;
      }

      host.setHostProps({ activeShape: nextShape });
    },
    syncWireframe: enabled => {
      if (typeof enabled !== 'boolean') {
        previewShapeStatusReporter(
          t('preview.status.invalidWireframeSyncValue', { value: String(enabled) }),
          'error',
        );
        return;
      }

      host.setHostProps({ wireframeEnabled: enabled });
    },
    onStatus: options.onStatus,
  };
}

export function syncPreviewShapeBarState(nextShape: PreviewShapeType): void {
  const controller = activePreviewShapeBarController;
  if (!controller) {
    return;
  }

  if (!isValidPreviewShapeType(nextShape)) {
    controller.onStatus(
      t('preview.status.invalidSyncArg', { value: String(nextShape) }),
      'error',
    );
    return;
  }

  controller.syncShape(nextShape);
}

export function syncPreviewWireframeState(enabled: boolean): void {
  const controller = activePreviewShapeBarController;
  if (!controller) {
    return;
  }

  if (typeof enabled !== 'boolean') {
    controller.onStatus(
      t('preview.status.invalidWireframeSyncArg', { value: String(enabled) }),
      'error',
    );
    return;
  }

  controller.syncWireframe(enabled);
}
