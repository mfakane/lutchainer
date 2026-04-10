import { render } from 'solid-js/web';
import { LutEditorDialogContent, createLutEditorContentSync } from './solid-lut-editor-content.tsx';
import {
  ensureLutEditorDialogShellOptions,
  type LutEditorDialogContentOptions,
  type LutEditorDialogShellOptions,
} from './shared.ts';

const syncApi = createLutEditorContentSync();
let disposeLutEditorDialogContent: (() => void) | null = null;
let disposeLutEditorDialogShell: (() => void) | null = null;

export function mountLutEditorDialogContent(el: Element, options: LutEditorDialogContentOptions): void {
  if (!(el instanceof Element)) {
    throw new Error('mountLutEditorDialogContent: el must be a DOM Element');
  }

  if (disposeLutEditorDialogContent) {
    disposeLutEditorDialogContent();
    disposeLutEditorDialogContent = null;
  }

  disposeLutEditorDialogContent = render(() => <LutEditorDialogContent options={options} syncApi={syncApi} />, el);
}

export function mountLutEditorDialogShell(options: LutEditorDialogShellOptions): void {
  ensureLutEditorDialogShellOptions(options);

  if (disposeLutEditorDialogShell) {
    disposeLutEditorDialogShell();
    disposeLutEditorDialogShell = null;
  }

  const closeLutEditorDialog = (): void => {
    if (typeof options.dialogEl.close === 'function') {
      if (options.dialogEl.open) {
        options.dialogEl.close();
      }
      return;
    }
    options.dialogEl.removeAttribute('open');
  };

  mountLutEditorDialogContent(options.surfaceEl, {
    onApply: options.onApply,
    onClose: closeLutEditorDialog,
    onDirtyChange: dirty => {
      options.dialogEl.dataset.dirty = dirty ? 'true' : 'false';
    },
  });

  const onCancel = (event: Event) => {
    event.preventDefault();
    if (options.dialogEl.dataset.dirty === 'true') return;
    closeLutEditorDialog();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !options.dialogEl.open || options.dialogEl.dataset.dirty !== 'true') return;
    event.preventDefault();
    event.stopPropagation();
  };

  const onDialogClick = (event: MouseEvent) => {
    if (event.target !== options.dialogEl) return;
    if (options.dialogEl.dataset.dirty === 'true') return;
    closeLutEditorDialog();
  };

  options.dialogEl.addEventListener('cancel', onCancel);
  options.dialogEl.addEventListener('keydown', onKeyDown, true);
  options.dialogEl.addEventListener('click', onDialogClick);

  disposeLutEditorDialogShell = () => {
    options.dialogEl.removeEventListener('cancel', onCancel);
    options.dialogEl.removeEventListener('keydown', onKeyDown, true);
    options.dialogEl.removeEventListener('click', onDialogClick);
  };
}

export function syncLutEditorDialogState(data: import('../../../../features/lut-editor/lut-editor-model.ts').ColorRamp2dLutData | null, lutId: string | null): void {
  syncApi.sync(data, lutId);
}
