import { For, createSignal, type Accessor, type JSX } from 'solid-js';
import { render } from 'solid-js/web';
import { t, useLanguage } from '../i18n.ts';
import { cx } from '../styles/cx.ts';
import * as ui from '../styles/ui-primitives.css.ts';
import * as styles from './solid-preview-shape-bar.css.ts';
import { DropdownMenu } from './solid-dropdown-menu.tsx';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

export type PreviewShapeType = 'sphere' | 'cube' | 'torus';
type PreviewActionMenuValue = '' | 'toggle-wireframe' | 'export-main-preview' | 'export-step-preview';

interface PreviewShapeBarMountOptions {
  initialShape: PreviewShapeType;
  initialWireframeEnabled: boolean;
  onShapeChange: (shape: PreviewShapeType) => void;
  onWireframeChange: (enabled: boolean) => void;
  onExportMainPreviewPng: () => void | Promise<void>;
  onExportStepPreviewPng: () => void | Promise<void>;
  onStatus: StatusReporter;
}

interface PreviewShapeBarProps {
  activeShape: Accessor<PreviewShapeType>;
  wireframeEnabled: Accessor<boolean>;
  onSelectShape: (shape: PreviewShapeType) => void;
  onSelectActionMenu: (value: PreviewActionMenuValue) => void;
}

const PREVIEW_SHAPES: Array<{ key: PreviewShapeType; label: string }> = [
  { key: 'sphere', label: 'Sphere' },
  { key: 'cube', label: 'Cube' },
  { key: 'torus', label: 'Torus' },
];

let disposePreviewShapeBar: (() => void) | null = null;
let syncPreviewShapeBarStateInternal: ((nextShape: PreviewShapeType) => void) | null = null;
let syncPreviewWireframeStateInternal: ((enabled: boolean) => void) | null = null;
let previewShapeStatusReporter: StatusReporter = () => undefined;

function isValidPreviewShapeType(value: unknown): value is PreviewShapeType {
  return value === 'sphere' || value === 'cube' || value === 'torus';
}

function isValidActionMenuValue(value: unknown): value is PreviewActionMenuValue {
  return value === ''
    || value === 'toggle-wireframe'
    || value === 'export-main-preview'
    || value === 'export-step-preview';
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

function PreviewShapeBar(props: PreviewShapeBarProps): JSX.Element {
  const language = useLanguage();

  const tr = (key: string, values?: Record<string, string | number>): string => {
    language();
    return t(key, values);
  };

  const handleMenuAction = (action: PreviewActionMenuValue): void => {
    if (!isValidActionMenuValue(action)) {
      return;
    }

    if (action === '') {
      return;
    }

    props.onSelectActionMenu(action);
  };

  return (
    <>
      <div class={ui.sectionLabel}>{tr('preview.shapeLabel')}</div>
      <div class={styles.shapeGroup}>
        <For each={PREVIEW_SHAPES}>
          {shape => (
            <button
              type="button"
              class={cx(ui.buttonBase, props.activeShape() === shape.key && ui.activeAccent)}
              onClick={() => props.onSelectShape(shape.key)}
            >
              {shape.label}
            </button>
          )}
        </For>
      </div>
      <DropdownMenu
        wrapperClass={cx(ui.menuWrap, styles.actionMenuWrap)}
        triggerClass={cx(ui.buttonBase, ui.menuTrigger)}
        menuClass={cx(ui.menu, styles.kebabMenu)}
        triggerAriaLabel={tr('preview.menuButtonAria')}
        menuRole="menu"
      >
        {controls => (
          <>
            <button
              type="button"
              class={ui.menuItem}
              role="menuitem"
              onClick={() => {
                handleMenuAction('toggle-wireframe');
                controls.closeMenu();
              }}
            >
              {tr('preview.menuWireframeToggle', {
                state: props.wireframeEnabled() ? tr('common.on') : tr('common.off'),
              })}
            </button>
            <button
              type="button"
              class={ui.menuItem}
              role="menuitem"
              onClick={() => {
                handleMenuAction('export-main-preview');
                controls.closeMenu();
              }}
            >
              {tr('preview.menuExportMainPng')}
            </button>
            <button
              type="button"
              class={ui.menuItem}
              role="menuitem"
              onClick={() => {
                handleMenuAction('export-step-preview');
                controls.closeMenu();
              }}
            >
              {tr('preview.menuExportStepPng')}
            </button>
          </>
        )}
      </DropdownMenu>
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
    const [wireframeEnabled, setWireframeEnabled] = createSignal<boolean>(options.initialWireframeEnabled);

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

    syncPreviewWireframeStateInternal = enabled => {
      if (typeof enabled !== 'boolean') {
        previewShapeStatusReporter(
          t('preview.status.invalidWireframeSyncValue', { value: String(enabled) }),
          'error',
        );
        return;
      }

      setWireframeEnabled(enabled);
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

    const handleSelectActionMenu = (action: PreviewActionMenuValue): void => {
      if (!isValidActionMenuValue(action)) {
        previewShapeStatusReporter(
          t('preview.status.invalidMenuAction', { value: String(action) }),
          'error',
        );
        return;
      }

      if (action === '') {
        return;
      }

      if (action === 'toggle-wireframe') {
        const next = !wireframeEnabled();
        try {
          options.onWireframeChange(next);
          setWireframeEnabled(next);
        } catch (error) {
          const message = error instanceof Error ? error.message : t('common.unknownError');
          previewShapeStatusReporter(
            t('preview.status.menuActionFailed', { message }),
            'error',
          );
        }
        return;
      }

      if (action === 'export-main-preview') {
        Promise.resolve()
          .then(() => options.onExportMainPreviewPng())
          .catch(error => {
            const message = error instanceof Error ? error.message : t('common.unknownError');
            previewShapeStatusReporter(
              t('preview.status.menuActionFailed', { message }),
              'error',
            );
          });
        return;
      }

      Promise.resolve()
        .then(() => options.onExportStepPreviewPng())
        .catch(error => {
          const message = error instanceof Error ? error.message : t('common.unknownError');
          previewShapeStatusReporter(
            t('preview.status.menuActionFailed', { message }),
            'error',
          );
        });
    };

    return (
      <PreviewShapeBar
        activeShape={activeShape}
        wireframeEnabled={wireframeEnabled}
        onSelectShape={handleSelectShape}
        onSelectActionMenu={handleSelectActionMenu}
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

export function syncPreviewWireframeState(enabled: boolean): void {
  if (!syncPreviewWireframeStateInternal) {
    return;
  }

  if (typeof enabled !== 'boolean') {
    previewShapeStatusReporter(
      t('preview.status.invalidWireframeSyncArg', { value: String(enabled) }),
      'error',
    );
    return;
  }

  syncPreviewWireframeStateInternal(enabled);
}
