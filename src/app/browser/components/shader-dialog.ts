import type { ShaderBuildInput, ShaderLanguage } from '../../../features/shader/shader-generator.ts';
import './svelte-shader-dialog.svelte';
import { mountSvelteHost } from './custom-element-host.ts';

type StatusKind = 'success' | 'error' | 'info';

interface ShaderDialogContentController {
  dispose: () => void;
  sync: (input: ShaderBuildInput, fragmentShader?: string) => void;
}

interface ShaderDialogShellOptions {
  dialogEl: HTMLDialogElement;
  surfaceEl: Element;
  onBeforeOpen?: () => void;
  onExport: (language: ShaderLanguage) => void | Promise<void>;
  onStatus: (message: string, kind?: StatusKind) => void;
}

interface ShaderDialogShellController extends ShaderDialogContentController {
  open: () => void;
}

interface ShaderDialogHostProps extends Record<string, unknown> {
  buildInput: ShaderBuildInput | null;
  fragmentShader?: string;
  onClose: () => void;
  onExport: (language: ShaderLanguage) => void | Promise<void>;
  onStatus: (message: string, kind?: StatusKind) => void;
}

let activeShaderDialogController: ShaderDialogShellController | null = null;

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

function mountShaderDialogContent(
  el: Element,
  options: {
    onClose: () => void;
    onExport: (language: ShaderLanguage) => void | Promise<void>;
    onStatus: (message: string, kind?: StatusKind) => void;
  },
): ShaderDialogContentController {
  if (!(el instanceof HTMLElement)) {
    throw new Error('mountShaderDialogContent: el must be an HTMLElement');
  }

  const host = mountSvelteHost<ShaderDialogHostProps>({
    tagName: 'lut-shader-dialog-content',
    target: el,
    props: {
      buildInput: null,
      fragmentShader: undefined,
      onClose: options.onClose,
      onExport: options.onExport,
      onStatus: options.onStatus,
    },
  });

  return {
    dispose: () => {
      host.destroyHost();
    },
    sync: (input: ShaderBuildInput, fragmentShader?: string) => {
      host.setHostProps({
        buildInput: input,
        fragmentShader,
      });
    },
  };
}

export function mountShaderDialogShell(options: ShaderDialogShellOptions): void {
  ensureShaderDialogShellOptions(options);

  if (activeShaderDialogController) {
    activeShaderDialogController.dispose();
    activeShaderDialogController = null;
  }

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

  const contentController = mountShaderDialogContent(options.surfaceEl, {
    onClose: closeShaderDialog,
    onExport: options.onExport,
    onStatus: options.onStatus,
  });

  const onCancel = (event: Event) => {
    event.preventDefault();
    closeShaderDialog();
  };

  const onDialogClick = (event: MouseEvent) => {
    if (event.target !== options.dialogEl) {
      return;
    }

    const rect = options.dialogEl.getBoundingClientRect();
    const isOutside = event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom;
    if (isOutside) {
      closeShaderDialog();
    }
  };

  options.dialogEl.addEventListener('cancel', onCancel);
  options.dialogEl.addEventListener('click', onDialogClick);

  const disposeShell = () => {
    options.dialogEl.removeEventListener('cancel', onCancel);
    options.dialogEl.removeEventListener('click', onDialogClick);
  };

  activeShaderDialogController = {
    dispose: () => {
      disposeShell();
      contentController.dispose();
    },
    open: openShaderDialog,
    sync: contentController.sync,
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
