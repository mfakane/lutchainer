import type { ColorRamp2dLutData } from '../../../../features/lut-editor/lut-editor-model.ts';
import type { LutModel } from '../../../../features/step/step-model.ts';
import './svelte-lut-editor-dialog.svelte';
import { mountSvelteHost, type SvelteHostElement } from '../custom-element-host.ts';
import {
  ensureLutEditorDialogShellOptions,
  type LutEditorDialogShellOptions,
} from './shared.ts';

interface LutEditorDialogHostProps extends Record<string, unknown> {
  rampData: ColorRamp2dLutData | null;
  lutId: string | null;
  onApply: (lutId: string | null, updatedLut: LutModel) => void;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

interface LutEditorDialogContentController {
  dispose: () => void;
  sync: (data: ColorRamp2dLutData | null, lutId: string | null) => void;
}

interface DirtyChangeEvent extends Event {
  detail?: boolean;
}

let activeLutEditorDialogController: LutEditorDialogContentController | null = null;

function mountLutEditorDialogContent(
  el: Element,
  options: {
    onApply: (lutId: string | null, updatedLut: LutModel) => void;
    onClose: () => void;
    onDirtyChange: (dirty: boolean) => void;
  },
): LutEditorDialogContentController {
  if (!(el instanceof HTMLElement)) {
    throw new Error('mountLutEditorDialogContent: el must be an HTMLElement');
  }

  const host = mountSvelteHost<LutEditorDialogHostProps>({
    tagName: 'lut-lut-editor-dialog-content',
    target: el,
    props: {
      rampData: null,
      lutId: null,
      onApply: options.onApply,
      onClose: options.onClose,
      onDirtyChange: options.onDirtyChange,
    },
  });

  const onDirtyChangeEvent = (event: Event) => {
    const dirty = (event as DirtyChangeEvent).detail === true;
    options.onDirtyChange(dirty);
  };
  host.addEventListener('dirtychange', onDirtyChangeEvent);

  return {
    dispose: () => {
      host.removeEventListener('dirtychange', onDirtyChangeEvent);
      host.destroyHost();
    },
    sync: (data: ColorRamp2dLutData | null, lutId: string | null) => {
      host.setHostProps({ rampData: data, lutId });
    },
  };
}

export function mountLutEditorDialogShell(options: LutEditorDialogShellOptions): void {
  ensureLutEditorDialogShellOptions(options);

  if (activeLutEditorDialogController) {
    activeLutEditorDialogController.dispose();
    activeLutEditorDialogController = null;
  }

  let allowClose = false;

  const closeLutEditorDialog = (): void => {
    allowClose = true;
    if (typeof options.dialogEl.close === 'function') {
      if (options.dialogEl.open) {
        options.dialogEl.close();
      }
      return;
    }
    options.dialogEl.removeAttribute('open');
  };

  const contentController = mountLutEditorDialogContent(options.surfaceEl, {
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

  const onDialogPointerDown = (event: PointerEvent) => {
    if (event.target !== options.dialogEl) {
      return;
    }
    if (options.dialogEl.dataset.dirty !== 'true') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const onDialogClose = () => {
    if (options.dialogEl.dataset.dirty === 'true' && !allowClose) {
      if (typeof options.dialogEl.showModal === 'function') {
        options.dialogEl.showModal();
      } else {
        options.dialogEl.setAttribute('open', '');
      }
      return;
    }
    allowClose = false;
  };

  options.dialogEl.addEventListener('cancel', onCancel);
  options.dialogEl.addEventListener('close', onDialogClose);
  options.dialogEl.addEventListener('keydown', onKeyDown, true);
  options.dialogEl.addEventListener('pointerdown', onDialogPointerDown, true);
  options.dialogEl.addEventListener('click', onDialogClick);

  activeLutEditorDialogController = {
    dispose: () => {
      options.dialogEl.removeEventListener('cancel', onCancel);
      options.dialogEl.removeEventListener('close', onDialogClose);
      options.dialogEl.removeEventListener('keydown', onKeyDown, true);
      options.dialogEl.removeEventListener('pointerdown', onDialogPointerDown, true);
      options.dialogEl.removeEventListener('click', onDialogClick);
      contentController.dispose();
    },
    sync: contentController.sync,
  };
}

export function syncLutEditorDialogState(data: ColorRamp2dLutData | null, lutId: string | null): void {
  activeLutEditorDialogController?.sync(data, lutId);
}
