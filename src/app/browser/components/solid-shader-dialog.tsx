import { For, createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import * as shaderGenerator from '../../../features/shader/shader-generator';
import { t, useLanguage } from '../i18n';

type ShaderStage = shaderGenerator.ShaderStage;
type ShaderBuildInput = shaderGenerator.ShaderBuildInput;
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

const SHADER_STAGES: { stage: ShaderStage; label: string }[] = [
  { stage: 'fragment', label: 'GLSL Fragment' },
  { stage: 'vertex', label: 'GLSL Vertex' },
  { stage: 'hlsl', label: 'HLSL' },
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

  const [activeStage, setActiveStage] = createSignal<ShaderStage>('fragment');
  const [buildInput, setBuildInput] = createSignal<ShaderBuildInput | null>(null);
  const [cachedFragShader, setCachedFragShader] = createSignal<string | undefined>(undefined);

  syncShaderDialogInternal = (input: ShaderBuildInput, fragmentShader?: string) => {
    setBuildInput(input);
    setCachedFragShader(fragmentShader);
  };

  const shaderSource = () => {
    const input = buildInput();
    if (!input) return '';
    return shaderGenerator.getShaderSource(activeStage(), input, cachedFragShader());
  };

  const metaText = () => {
    const source = shaderSource();
    return tr('shader.meta', {
      stage: shaderGenerator.getShaderStageLabel(activeStage()),
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
          stage: shaderGenerator.getShaderStageLabel(activeStage()),
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
      <div class="shader-panel-head shader-dialog-head">
        <div>
          <div class="section-label" id="shader-dialog-title">Generated Shader</div>
          <div class="shader-help">{tr('shader.help')}</div>
        </div>
        <div class="shader-toolbar">
          <div class="shader-tabs" aria-label={tr('shader.tabsAria')}>
            <For each={SHADER_STAGES}>
              {({ stage, label }) => (
                <button
                  type="button"
                  class={`shader-tab${activeStage() === stage ? ' active' : ''}`}
                  data-shader-stage={stage}
                  aria-pressed={activeStage() === stage ? 'true' : 'false'}
                  onClick={() => setActiveStage(stage)}
                >
                  {label}
                </button>
              )}
            </For>
          </div>
          <button
            type="button"
            class="btn-secondary shader-copy-btn"
            onClick={() => void handleCopy()}
          >
            {tr('shader.copy')}
          </button>
          <button
            type="button"
            class="btn-submit shader-export-btn"
            onClick={() => void handleExport()}
          >
            {tr('shader.export')}
          </button>
          <button
            type="button"
            class="btn-secondary"
            aria-label={tr('shader.closeAria')}
            onClick={props.options.onClose}
          >
            {tr('shader.close')}
          </button>
        </div>
      </div>
      <div class="shader-meta">{metaText()}</div>
      <pre class="shader-code-output">{shaderSource()}</pre>
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
  input: shaderGenerator.ShaderBuildInput,
  fragmentShader?: string,
): void {
  syncShaderDialogInternal?.(input, fragmentShader);
}
