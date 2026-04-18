import type { ColorRamp2dLutData } from '../../../../features/lut-editor/lut-editor-model.ts';
import type { LutModel } from '../../../../features/step/step-model.ts';
import {
  ensureLutEditorDialogShellOptions,
  type LutEditorDialogShellOptions,
} from './shared.ts';

interface LutEditorDialogContentElement extends HTMLElement {
  rampData: ColorRamp2dLutData | null;
  lutId: string | null;
}

interface DirtyChangeEvent extends Event {
  detail?: boolean;
}

let activeLutEditorDialogElement: LutEditorDialogContentElement | null = null;

export function mountLutEditorDialogShell(options: LutEditorDialogShellOptions): void {
  ensureLutEditorDialogShellOptions(options);

  let allowClose = false;
  const element = options.surfaceEl as LutEditorDialogContentElement;
  element.rampData = null;
  element.lutId = null;
  activeLutEditorDialogElement = element;

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

  element.addEventListener('apply-lut', event => {
    const detail = (event as CustomEvent<{ lutId: string | null; updatedLut: LutModel }>).detail;
    options.onApply(detail.lutId, detail.updatedLut);
  });
  element.addEventListener('request-close', () => {
    closeLutEditorDialog();
  });
  element.addEventListener('dirtychange', event => {
    const dirty = (event as DirtyChangeEvent).detail === true;
    options.dialogEl.dataset.dirty = dirty ? 'true' : 'false';
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
}

export function syncLutEditorDialogState(data: ColorRamp2dLutData | null, lutId: string | null): void {
  if (!activeLutEditorDialogElement) {
    return;
  }

  activeLutEditorDialogElement.rampData = data;
  activeLutEditorDialogElement.lutId = lutId;
}
