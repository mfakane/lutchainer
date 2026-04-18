import type { ShaderLanguage } from '../../../features/shader/shader-generator.ts';
import { t } from '../i18n.ts';
import type { PipelinePresetKey } from '../ui/pipeline-presets.ts';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

interface HeaderActionGroupMountOptions {
  initialCanUndo: boolean;
  initialCanRedo: boolean;
  onUndoPipeline: () => void;
  onRedoPipeline: () => void;
  onResetPresetSelected: (preset: PipelinePresetKey) => void | Promise<void>;
  onSavePipeline: () => void | Promise<void>;
  onPipelineFileSelected: (file: File) => void | Promise<void>;
  onOpenShaderDialog: () => void;
  onExportShaderZip: (language: ShaderLanguage) => void | Promise<void>;
  onStatus: StatusReporter;
}

interface StatusMessageDetail {
  message: string;
  kind?: StatusKind;
}

interface HeaderActionGroupElement extends HTMLElement {
  canUndo: boolean;
  canRedo: boolean;
}

let activeHeaderActionGroupElement: HeaderActionGroupElement | null = null;
let headerActionStatusReporter: StatusReporter = () => undefined;

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function ensureMountOptions(value: unknown): asserts value is HeaderActionGroupMountOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('ヘッダーアクションの初期化オプションが不正です。');
  }

  const options = value as Partial<HeaderActionGroupMountOptions>;
  if (!isBoolean(options.initialCanUndo)) {
    throw new Error('ヘッダーアクションの初期Undo状態が不正です。');
  }
  if (!isBoolean(options.initialCanRedo)) {
    throw new Error('ヘッダーアクションの初期Redo状態が不正です。');
  }
  if (typeof options.onUndoPipeline !== 'function') {
    throw new Error('ヘッダーアクションのUndoコールバックが不正です。');
  }
  if (typeof options.onRedoPipeline !== 'function') {
    throw new Error('ヘッダーアクションのRedoコールバックが不正です。');
  }
  if (typeof options.onResetPresetSelected !== 'function') {
    throw new Error('ヘッダーアクションの初期化コールバックが不正です。');
  }
  if (typeof options.onSavePipeline !== 'function') {
    throw new Error('ヘッダーアクションの保存コールバックが不正です。');
  }
  if (typeof options.onPipelineFileSelected !== 'function') {
    throw new Error('ヘッダーアクションの読み込みコールバックが不正です。');
  }
  if (typeof options.onOpenShaderDialog !== 'function') {
    throw new Error('ヘッダーアクションのコード表示コールバックが不正です。');
  }
  if (typeof options.onExportShaderZip !== 'function') {
    throw new Error('ヘッダーアクションのシェーダエクスポートコールバックが不正です。');
  }
  if (typeof options.onStatus !== 'function') {
    throw new Error('ヘッダーアクションのステータス通知コールバックが不正です。');
  }
}

export function mountLanguageSwitcher(target: HTMLElement): void {
  if (!(target instanceof HTMLElement)) {
    throw new Error('言語スイッチャーの描画先要素が不正です。');
  }

  target.addEventListener('status-message', event => {
    const detail = (event as CustomEvent<StatusMessageDetail>).detail;
    headerActionStatusReporter(detail.message, detail.kind);
  });
}

export function mountHeaderActionGroup(target: HTMLElement, options: HeaderActionGroupMountOptions): void {
  if (!(target instanceof HTMLElement)) {
    throw new Error('ヘッダーアクションの描画先要素が不正です。');
  }

  ensureMountOptions(options);
  headerActionStatusReporter = options.onStatus;

  const element = target as HeaderActionGroupElement;
  element.canUndo = options.initialCanUndo;
  element.canRedo = options.initialCanRedo;
  activeHeaderActionGroupElement = element;

  element.addEventListener('undo-pipeline', () => {
    options.onUndoPipeline();
  });
  element.addEventListener('redo-pipeline', () => {
    options.onRedoPipeline();
  });
  element.addEventListener('reset-preset-selected', event => {
    const detail = (event as CustomEvent<{ preset: PipelinePresetKey }>).detail;
    void options.onResetPresetSelected(detail.preset);
  });
  element.addEventListener('save-pipeline', () => {
    void options.onSavePipeline();
  });
  element.addEventListener('pipeline-file-selected', event => {
    const detail = (event as CustomEvent<{ file: File }>).detail;
    void options.onPipelineFileSelected(detail.file);
  });
  element.addEventListener('open-shader-dialog', () => {
    options.onOpenShaderDialog();
  });
  element.addEventListener('export-shader-zip', event => {
    const detail = (event as CustomEvent<{ language: ShaderLanguage }>).detail;
    void options.onExportShaderZip(detail.language);
  });
  element.addEventListener('status-message', event => {
    const detail = (event as CustomEvent<StatusMessageDetail>).detail;
    options.onStatus(detail.message, detail.kind);
  });
}

export function syncHeaderActionHistoryState(canUndo: boolean, canRedo: boolean): void {
  const element = activeHeaderActionGroupElement;
  if (!element) {
    return;
  }

  if (!isBoolean(canUndo) || !isBoolean(canRedo)) {
    headerActionStatusReporter(
      t('header.status.invalidHistorySyncArg', {
        value: `canUndo=${String(canUndo)}, canRedo=${String(canRedo)}`,
      }),
      'error',
    );
    return;
  }

  element.canUndo = canUndo;
  element.canRedo = canRedo;
}
