import { For, createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import {
    getShaderGenerator,
    type ShaderBuildInput,
    type ShaderGenerator,
    type ShaderLanguage,
} from '../../../features/shader/shader-generator.ts';
import { t, useLanguage } from '../i18n.ts';
import { cx } from '../styles/cx.ts';
import * as ui from '../styles/ui-primitives.css.ts';
import * as styles from './solid-shader-dialog.css.ts';

type StatusKind = 'success' | 'error' | 'info';

// --- Types ---

interface ShaderDialogContentOptions {
  onClose: () => void;
  onExport: () => void | Promise<void>;
  onStatus: (message: string, kind?: StatusKind) => void;
}

interface ShaderDialogShellOptions {
  dialogEl: HTMLDialogElement;
  openButtonEl: HTMLButtonElement;
  surfaceEl: Element;
  onBeforeOpen?: () => void;
  onExport: () => void | Promise<void>;
  onStatus: (message: string, kind?: StatusKind) => void;
}

// --- Constants ---

type ShaderCodeEntryId = 'glsl-fragment' | 'glsl-vertex' | 'hlsl-fragment';

interface ShaderCodeEntry {
  id: ShaderCodeEntryId;
  label: string;
  stageLabel: string;
  language: ShaderLanguage;
  getSource: (generator: ShaderGenerator, input: ShaderBuildInput, cachedFragShader?: string) => string;
}

const SHADER_CODE_ENTRIES: readonly ShaderCodeEntry[] = [
  {
    id: 'glsl-fragment',
    label: 'GLSL Fragment',
    stageLabel: 'Fragment',
    language: 'glsl',
    getSource: (generator, input, cachedFragShader) => cachedFragShader ?? generator.buildFragment(input),
  },
  {
    id: 'glsl-vertex',
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
  {
    id: 'hlsl-fragment',
    label: 'HLSL',
    stageLabel: 'HLSL',
    language: 'hlsl',
    getSource: (generator, input) => generator.buildFragment(input),
  },
];

// --- Module-level state (populated when component renders) ---

let syncShaderDialogInternal: ((input: ShaderBuildInput, fragmentShader?: string) => void) | null = null;
let disposeShaderDialogContent: (() => void) | null = null;
let disposeShaderDialogShell: (() => void) | null = null;

function ensureShaderDialogShellOptions(value: unknown): asserts value is ShaderDialogShellOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('mountShaderDialogShell: options must be an object');
  }

  const options = value as Partial<ShaderDialogShellOptions>;
  if (!(options.dialogEl instanceof HTMLDialogElement)) {
    throw new Error('mountShaderDialogShell: dialogEl must be an HTMLDialogElement');
  }
  if (!(options.openButtonEl instanceof HTMLButtonElement)) {
    throw new Error('mountShaderDialogShell: openButtonEl must be an HTMLButtonElement');
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

function ShaderDialogContent(props: { options: ShaderDialogContentOptions }) {
  const language = useLanguage();
  const tr = (key: string, values?: Record<string, string | number>): string => {
    language();
    return t(key, values);
  };

  const [activeEntryId, setActiveEntryId] = createSignal<ShaderCodeEntryId>('glsl-fragment');
  const [buildInput, setBuildInput] = createSignal<ShaderBuildInput | null>(null);
  const [cachedFragShader, setCachedFragShader] = createSignal<string | undefined>(undefined);

  syncShaderDialogInternal = (input: ShaderBuildInput, fragmentShader?: string) => {
    setBuildInput(input);
    setCachedFragShader(fragmentShader);
  };

  const activeEntry = () => SHADER_CODE_ENTRIES.find(entry => entry.id === activeEntryId()) ?? SHADER_CODE_ENTRIES[0];

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
      await props.options.onExport();
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
          <For each={SHADER_CODE_ENTRIES}>
            {entry => (
              <button
                type="button"
                class={cx(ui.buttonBase, styles.tab, activeEntryId() === entry.id ? styles.tabState.active : styles.tabState.inactive)}
                data-shader-stage={entry.id}
                aria-pressed={activeEntryId() === entry.id ? 'true' : 'false'}
                onClick={() => setActiveEntryId(entry.id)}
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
            {tr('shader.export')}
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

export function mountShaderDialogContent(
  el: Element,
  options: ShaderDialogContentOptions,
): void {
  if (!(el instanceof Element)) {
    throw new Error('mountShaderDialogContent: el must be a DOM Element');
  }

  if (disposeShaderDialogContent) {
    disposeShaderDialogContent();
    disposeShaderDialogContent = null;
  }

  syncShaderDialogInternal = null;
  disposeShaderDialogContent = render(() => <ShaderDialogContent options={options} />, el);
}

export function mountShaderDialogShell(options: ShaderDialogShellOptions): void {
  ensureShaderDialogShellOptions(options);

  if (disposeShaderDialogShell) {
    disposeShaderDialogShell();
    disposeShaderDialogShell = null;
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

  mountShaderDialogContent(options.surfaceEl, {
    onClose: closeShaderDialog,
    onExport: options.onExport,
    onStatus: options.onStatus,
  });

  const onOpenClick = () => {
    openShaderDialog();
  };

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

  options.openButtonEl.addEventListener('click', onOpenClick);
  options.dialogEl.addEventListener('cancel', onCancel);
  options.dialogEl.addEventListener('click', onDialogClick);

  disposeShaderDialogShell = () => {
    options.openButtonEl.removeEventListener('click', onOpenClick);
    options.dialogEl.removeEventListener('cancel', onCancel);
    options.dialogEl.removeEventListener('click', onDialogClick);
  };
}

export function syncShaderDialogState(
  input: ShaderBuildInput,
  fragmentShader?: string,
): void {
  syncShaderDialogInternal?.(input, fragmentShader);
}
