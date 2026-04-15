import { For, createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import {
  getShaderGenerator,
  type ShaderBuildInput,
  type ShaderGenerator,
  type ShaderLanguage,
} from '../../../features/shader/shader-generator.ts';
import { t, useLanguage, type TranslationArgs, type TranslationKey } from '../i18n.ts';
import { cx } from '../styles/cx.ts';
import * as ui from '../styles/ui-primitives.css.ts';
import * as styles from './solid-shader-dialog.css.ts';

type StatusKind = 'success' | 'error' | 'info';

// --- Types ---

interface ShaderDialogContentOptions {
  onClose: () => void;
  onExport: (language: ShaderLanguage) => void | Promise<void>;
  onStatus: (message: string, kind?: StatusKind) => void;
}

interface ShaderDialogShellOptions {
  dialogEl: HTMLDialogElement;
  surfaceEl: Element;
  onBeforeOpen?: () => void;
  onExport: (language: ShaderLanguage) => void | Promise<void>;
  onStatus: (message: string, kind?: StatusKind) => void;
}

// --- Constants ---

type ShaderCodeEntryId = 'glsl-fragment' | 'glsl-vertex' | 'hlsl-fragment' | 'mme-fragment';

interface ShaderCodeEntry {
  label: string;
  stageLabel: string;
  language: ShaderLanguage;
  getSource: (generator: ShaderGenerator, input: ShaderBuildInput, cachedFragShader?: string) => string;
}

const SHADER_CODE_ENTRIES: Record<ShaderCodeEntryId, ShaderCodeEntry> = {
  'glsl-fragment': {
    label: 'GLSL Fragment',
    stageLabel: 'Fragment',
    language: 'glsl',
    getSource: (generator, input, cachedFragShader) => cachedFragShader ?? generator.buildFragment(input),
  },
  'glsl-vertex': {
    label: 'GLSL Vertex',
    stageLabel: 'Vertex',
    language: 'glsl',
    getSource: generator => {
      if (typeof generator.buildVertex !== 'function') {
        throw new Error('GLSL generator does not provide a vertex shader.');
      }
      return generator.buildVertex();
    },
  },
  'hlsl-fragment': {
    label: 'HLSL',
    stageLabel: 'HLSL',
    language: 'hlsl',
    getSource: (generator, input) => generator.buildFragment(input),
  },
  'mme-fragment': {
    label: 'MMEffect',
    stageLabel: 'MMEffect',
    language: 'mme',
    getSource: (generator, input) => generator.buildFragment(input),
  },
};

interface ShaderDialogContentController {
  dispose: () => void;
  sync: (input: ShaderBuildInput, fragmentShader?: string) => void;
}

interface ShaderDialogShellController extends ShaderDialogContentController {
  open: () => void;
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

// --- Component ---

function ShaderDialogContent(props: {
  options: ShaderDialogContentOptions;
  onRegisterSync: (sync: (input: ShaderBuildInput, fragmentShader?: string) => void) => void;
}) {
  const language = useLanguage();
  function tr<K extends TranslationKey>(key: K, ...args: TranslationArgs<K>): string {
    language();
    return t(key, ...args);
  }

  const [activeEntryId, setActiveEntryId] = createSignal<ShaderCodeEntryId>('glsl-fragment');
  const [buildInput, setBuildInput] = createSignal<ShaderBuildInput | null>(null);
  const [cachedFragShader, setCachedFragShader] = createSignal<string | undefined>(undefined);

  props.onRegisterSync((input: ShaderBuildInput, fragmentShader?: string) => {
    setBuildInput(input);
    setCachedFragShader(fragmentShader);
  });

  const activeEntry = () => SHADER_CODE_ENTRIES[activeEntryId()] ?? SHADER_CODE_ENTRIES['glsl-fragment'];

  const shaderSource = () => {
    const input = buildInput();
    if (!input) return '';
    const entry = activeEntry();
    return entry.getSource(getShaderGenerator(entry.language), input, cachedFragShader());
  };

  const metaText = () => {
    const source = shaderSource();
    return tr('shader.meta', {
      stage: activeEntry().stageLabel,
      lines: source.split('\n').length,
    });
  };

  const handleCopy = async () => {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      props.options.onStatus(tr('shader.status.clipboardUnavailable'), 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(shaderSource());
      props.options.onStatus(
        tr('shader.status.copySuccess', {
          stage: activeEntry().stageLabel,
        }),
        'success',
      );
    } catch {
      props.options.onStatus(tr('shader.status.copyFailed'), 'error');
    }
  };

  const handleExport = async () => {
    try {
      await props.options.onExport(activeEntry().language);
    } catch (error) {
      const message = error instanceof Error ? error.message : tr('common.unknownError');
      props.options.onStatus(tr('shader.status.exportFailed', { message }), 'error');
    }
  };

  return (
    <>
      <div class={styles.header}>
        <div>
          <div class={ui.sectionLabel} id="shader-dialog-title">Generated Shader</div>
          <div class={styles.helpText}>{tr('shader.help')}</div>
        </div>
        <div class={styles.tabs} aria-label={tr('shader.tabsAria')}>
          <For each={Object.entries(SHADER_CODE_ENTRIES)}>
            {([id, entry]) => (
              <button
                type="button"
                class={cx(ui.buttonBase, styles.tab, activeEntryId() === id ? styles.tabState.active : styles.tabState.inactive)}
                data-shader-stage={id}
                aria-pressed={activeEntryId() === id ? 'true' : 'false'}
                onClick={() => setActiveEntryId(id as ShaderCodeEntryId)}
              >
                {entry.label}
              </button>
            )}
          </For>
        </div>
        <div class={styles.toolbar}>
          <button
            type="button"
            class={cx(ui.buttonBase, ui.secondaryButton)}
            onClick={() => void handleCopy()}
          >
            {tr('shader.copy')}
          </button>
          <button
            type="button"
            class={cx(ui.buttonBase, ui.submitButton)}
            onClick={() => void handleExport()}
          >
            {tr('shader.download')}
          </button>
          <button
            type="button"
            class={cx(ui.buttonBase, ui.secondaryButton)}
            aria-label={tr('shader.closeAria')}
            onClick={props.options.onClose}
          >
            {tr('shader.close')}
          </button>
        </div>
      </div>
      <div class={styles.meta}>{metaText()}</div>
      <pre class={styles.codeOutput}>{shaderSource()}</pre>
    </>
  );
}

// --- Public API ---

function mountShaderDialogContent(
  el: Element,
  options: ShaderDialogContentOptions,
): ShaderDialogContentController {
  if (!(el instanceof Element)) {
    throw new Error('mountShaderDialogContent: el must be a DOM Element');
  }

  let sync: ((input: ShaderBuildInput, fragmentShader?: string) => void) | null = null;

  const dispose = render(() => (
    <ShaderDialogContent
      options={options}
      onRegisterSync={nextSync => {
        sync = nextSync;
      }}
    />
  ), el);

  if (!sync) {
    dispose();
    throw new Error('mountShaderDialogContent: sync handler was not initialized');
  }

  return {
    dispose,
    sync,
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
