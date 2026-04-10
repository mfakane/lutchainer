import type { ColorRamp2dLutData } from '../../../../features/lut-editor/lut-editor-model.ts';
import type { LutModel } from '../../../../features/step/step-model.ts';

export const DRAG_DELETE_THRESHOLD = 36;
export const POSITION_PERCENT_STEP = 0.01;
export const POSITION_PERCENT_DRAFT_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d*)?$/;

export interface LutEditorDialogContentOptions {
  onApply: (lutId: string | null, updatedLut: LutModel) => void;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

export interface LutEditorDialogShellOptions {
  dialogEl: HTMLDialogElement;
  surfaceEl: Element;
  onApply: (lutId: string | null, updatedLut: LutModel) => void;
}

export function serializeRampData(data: ColorRamp2dLutData | null): string {
  return data ? JSON.stringify(data) : '';
}

export function formatPositionPercent(position: number): string {
  return (position * 100).toFixed(2);
}

export function isValidPositionPercentDraft(value: string): boolean {
  return POSITION_PERCENT_DRAFT_PATTERN.test(value);
}

export function selectAllTextIfFocused(input: HTMLInputElement | undefined): void {
  if (input && document.activeElement === input) {
    input.setSelectionRange(0, input.value.length);
  }
}

export function scheduleSelectAllTextIfFocused(input: HTMLInputElement | undefined): void {
  setTimeout(() => selectAllTextIfFocused(input), 0);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => selectAllTextIfFocused(input));
  });
}

export function ensureLutEditorDialogShellOptions(value: unknown): asserts value is LutEditorDialogShellOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('mountLutEditorDialogShell: options must be an object');
  }
  const options = value as Partial<LutEditorDialogShellOptions>;
  if (!(options.dialogEl instanceof HTMLDialogElement)) {
    throw new Error('mountLutEditorDialogShell: dialogEl must be an HTMLDialogElement');
  }
  if (!(options.surfaceEl instanceof Element)) {
    throw new Error('mountLutEditorDialogShell: surfaceEl must be a DOM Element');
  }
  if (typeof options.onApply !== 'function') {
    throw new Error('mountLutEditorDialogShell: onApply must be a function');
  }
}
