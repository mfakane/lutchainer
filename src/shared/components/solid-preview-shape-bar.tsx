import { For, createSignal, type Accessor, type JSX } from 'solid-js';
import { render } from 'solid-js/web';
import { t, useLanguage } from '../i18n';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

export type PreviewShapeType = 'sphere' | 'cube' | 'torus';

interface PreviewShapeBarMountOptions {
  initialShape: PreviewShapeType;
  onShapeChange: (shape: PreviewShapeType) => void;
  onStatus: StatusReporter;
}

interface PreviewShapeBarProps {
  activeShape: Accessor<PreviewShapeType>;
  onSelectShape: (shape: PreviewShapeType) => void;
}

const PREVIEW_SHAPES: Array<{ key: PreviewShapeType; label: string }> = [
  { key: 'sphere', label: 'Sphere' },
  { key: 'cube', label: 'Cube' },
  { key: 'torus', label: 'Torus' },
];

let disposePreviewShapeBar: (() => void) | null = null;
let syncPreviewShapeBarStateInternal: ((nextShape: PreviewShapeType) => void) | null = null;
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
  if (typeof options.onShapeChange !== 'function') {
    throw new Error('Shapeバーの変更コールバックが不正です。');
  }
  if (typeof options.onStatus !== 'function') {
    throw new Error('Shapeバーのステータス通知コールバックが不正です。');
  }
}

function PreviewShapeBar(props: PreviewShapeBarProps): JSX.Element {
  const language = useLanguage();

  const shapeLabel = (): string => {
    language();
    return t('preview.shapeLabel');
  };

  return (
    <>
      <div class="section-label">{shapeLabel()}</div>
      <div class="shape-group preview-shape-group">
        <For each={PREVIEW_SHAPES}>
          {shape => (
            <button
              type="button"
              class={props.activeShape() === shape.key ? 'btn-shape active' : 'btn-shape'}
              onClick={() => props.onSelectShape(shape.key)}
            >
              {shape.label}
            </button>
          )}
        </For>
      </div>
    </>
  );
}

export function mountPreviewShapeBar(target: HTMLElement, options: PreviewShapeBarMountOptions): void {
  if (!(target instanceof HTMLElement)) {
    throw new Error('Shapeバーの描画先要素が不正です。');
  }

  ensureMountOptions(options);
  previewShapeStatusReporter = options.onStatus;

  if (disposePreviewShapeBar) {
    disposePreviewShapeBar();
    disposePreviewShapeBar = null;
  }

  target.textContent = '';

  disposePreviewShapeBar = render(() => {
    const [activeShape, setActiveShape] = createSignal<PreviewShapeType>(options.initialShape);

    syncPreviewShapeBarStateInternal = nextShape => {
      if (!isValidPreviewShapeType(nextShape)) {
        previewShapeStatusReporter(
          t('preview.status.invalidSyncValue', { value: String(nextShape) }),
          'error',
        );
        return;
      }

      setActiveShape(nextShape);
    };

    const handleSelectShape = (nextShape: PreviewShapeType): void => {
      if (!isValidPreviewShapeType(nextShape)) {
        previewShapeStatusReporter(
          t('preview.status.invalidSelectedShape', { value: String(nextShape) }),
          'error',
        );
        return;
      }

      if (nextShape === activeShape()) {
        return;
      }

      setActiveShape(nextShape);
      options.onShapeChange(nextShape);
    };

    return (
      <PreviewShapeBar
        activeShape={activeShape}
        onSelectShape={handleSelectShape}
      />
    );
  }, target);
}

export function syncPreviewShapeBarState(nextShape: PreviewShapeType): void {
  if (!syncPreviewShapeBarStateInternal) {
    return;
  }

  if (!isValidPreviewShapeType(nextShape)) {
    previewShapeStatusReporter(
      t('preview.status.invalidSyncArg', { value: String(nextShape) }),
      'error',
    );
    return;
  }

  syncPreviewShapeBarStateInternal(nextShape);
}
