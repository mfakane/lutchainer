import type { ShaderBuildInput, ShaderLanguage } from '../../../features/shader/shader-generator.ts';

type StatusKind = 'success' | 'error' | 'info';

interface ShaderDialogContentElement extends HTMLElement {
  buildInput: ShaderBuildInput | null;
  fragmentShader?: string;
}

interface ShaderDialogShellOptions {
  dialogEl: HTMLDialogElement;
  surfaceEl: Element;
  onBeforeOpen?: () => void;
  onExport: (language: ShaderLanguage) => void | Promise<void>;
  onStatus: (message: string, kind?: StatusKind) => void;
}

interface ShaderDialogShellController {
  open: () => void;
  sync: (input: ShaderBuildInput, fragmentShader?: string) => void;
}

let activeShaderDialogController: ShaderDialogShellController | null = null;

function applyShaderDialogState(
  element: ShaderDialogContentElement,
  input: ShaderBuildInput | null,
  fragmentShader?: string,
): void {
  element.buildInput = input;
  element.fragmentShader = fragmentShader;
}

function createShaderDialogContentElement(
  sourceEl: Element,
  input: ShaderBuildInput | null,
  fragmentShader?: string,
): ShaderDialogContentElement {
  const nextElement = document.createElement('lut-shader-dialog-content') as ShaderDialogContentElement;

  if (typeof sourceEl.id === 'string' && sourceEl.id.length > 0) {
    nextElement.id = sourceEl.id;
  }
  nextElement.className = sourceEl.className;

  applyShaderDialogState(nextElement, input, fragmentShader);
  return nextElement;
}

function bindShaderDialogContentEvents(
  contentEl: ShaderDialogContentElement,
  options: ShaderDialogShellOptions,
  closeShaderDialog: () => void,
): void {
  contentEl.addEventListener('request-close', () => {
    closeShaderDialog();
  });
  contentEl.addEventListener('export-shader', event => {
    const detail = (event as CustomEvent<{ language: ShaderLanguage }>).detail;
    void options.onExport(detail.language);
  });
  contentEl.addEventListener('status-message', event => {
    const detail = (event as CustomEvent<{ message: string; kind?: StatusKind }>).detail;
    options.onStatus(detail.message, detail.kind);
  });
}

function ensureShaderDialogShellOptions(value: unknown): asserts value is ShaderDialogShellOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('mountShaderDialogShell: options must be an object');
  }

  const options = value as Partial<ShaderDialogShellOptions>;
  if (!(options.dialogEl instanceof HTMLDialogElement)) {
    throw new Error('mountShaderDialogShell: dialogEl must be an HTMLDialogElement');
  }
  if (!(options.surfaceEl instanceof Element)) {
    throw new Error('mountShaderDialogShell: surfaceEl must be a DOM Element');
  }
  if (options.onBeforeOpen !== undefined && typeof options.onBeforeOpen !== 'function') {
    throw new Error('mountShaderDialogShell: onBeforeOpen must be a function when provided');
  }
  if (typeof options.onExport !== 'function') {
    throw new Error('mountShaderDialogShell: onExport must be a function');
  }
  if (typeof options.onStatus !== 'function') {
    throw new Error('mountShaderDialogShell: onStatus must be a function');
  }
}

export function mountShaderDialogShell(options: ShaderDialogShellOptions): void {
  ensureShaderDialogShellOptions(options);

  let contentEl = createShaderDialogContentElement(options.surfaceEl, null, undefined);
  options.surfaceEl.replaceWith(contentEl);

  const closeShaderDialog = (): void => {
    if (typeof options.dialogEl.close === 'function') {
      if (options.dialogEl.open) {
        options.dialogEl.close();
      }
      return;
    }

    options.dialogEl.removeAttribute('open');
  };

  const openShaderDialog = (): void => {
    options.onBeforeOpen?.();

    if (typeof options.dialogEl.showModal === 'function') {
      if (!options.dialogEl.open) {
        options.dialogEl.showModal();
      }
      return;
    }

    options.dialogEl.setAttribute('open', '');
  };

  options.dialogEl.addEventListener('cancel', event => {
    event.preventDefault();
    closeShaderDialog();
  });
  options.dialogEl.addEventListener('click', event => {
    if (event.target !== options.dialogEl) {
      return;
    }

    const rect = options.dialogEl.getBoundingClientRect();
    const isOutside = event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom;
    if (isOutside) {
      closeShaderDialog();
    }
  });

  bindShaderDialogContentEvents(contentEl, options, closeShaderDialog);

  activeShaderDialogController = {
    open: openShaderDialog,
    sync: (input, fragmentShader) => {
      const nextContentEl = createShaderDialogContentElement(contentEl, input, fragmentShader);
      contentEl.replaceWith(nextContentEl);
      bindShaderDialogContentEvents(nextContentEl, options, closeShaderDialog);
      contentEl = nextContentEl;
    },
  };
}

export function openShaderDialog(): void {
  activeShaderDialogController?.open();
}

export function syncShaderDialogState(
  input: ShaderBuildInput,
  fragmentShader?: string,
): void {
  activeShaderDialogController?.sync(input, fragmentShader);
}
