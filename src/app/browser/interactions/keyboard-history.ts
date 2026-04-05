function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  if (
    target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
  ) {
    return true;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    return true;
  }

  return (
    target.closest('[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]') !== null
  );
}

export interface HistoryShortcutHandlerOptions {
  onUndo: () => void;
  onRedo: () => void;
}

function assertValidOptions(options: HistoryShortcutHandlerOptions): void {
  if (!options || typeof options !== 'object') {
    throw new Error('keyboard-history options が不正です。');
  }
  if (typeof options.onUndo !== 'function') {
    throw new Error('onUndo は関数で指定してください。');
  }
  if (typeof options.onRedo !== 'function') {
    throw new Error('onRedo は関数で指定してください。');
  }
}

export function createHistoryShortcutHandler(
  options: HistoryShortcutHandlerOptions,
): (event: KeyboardEvent) => void {
  assertValidOptions(options);

  return (event: KeyboardEvent): void => {
    if (!(event instanceof KeyboardEvent)) {
      return;
    }

    if (event.defaultPrevented) {
      return;
    }

    if (isEditableEventTarget(event.target)) {
      return;
    }

    const hasModifier = event.ctrlKey || event.metaKey;
    if (!hasModifier || event.altKey) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        options.onRedo();
        return;
      }

      options.onUndo();
      return;
    }

    if (key === 'y' && !event.shiftKey) {
      event.preventDefault();
      options.onRedo();
    }
  };
}
