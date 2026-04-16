import type { ShaderLanguage } from '../../../features/shader/shader-generator.ts';
import { t, type Language } from '../i18n.ts';
import type { PipelinePresetKey } from '../ui/pipeline-presets.ts';
import { mountSvelteHost } from './custom-element-host.ts';
import './svelte-header-action-group.svelte';
import './svelte-language-switcher.svelte';

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

interface HeaderActionGroupController {
  dispose: () => void;
  syncHistory: (canUndo: boolean, canRedo: boolean) => void;
  onStatus: StatusReporter;
}

const LANGUAGE_SWITCHER_TAG = 'lut-language-switcher';
const HEADER_ACTION_GROUP_TAG = 'lut-header-action-group';

let activeHeaderActionGroupController: HeaderActionGroupController | null = null;
let headerActionStatusReporter: StatusReporter = () => undefined;

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isLanguage(value: unknown): value is Language {
  return value === 'ja' || value === 'en';
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

  mountSvelteHost({
    tagName: LANGUAGE_SWITCHER_TAG,
    target,
    props: {
      onStatus: headerActionStatusReporter,
    },
  });
}

export function mountHeaderActionGroup(target: HTMLElement, options: HeaderActionGroupMountOptions): void {
  if (!(target instanceof HTMLElement)) {
    throw new Error('ヘッダーアクションの描画先要素が不正です。');
  }

  ensureMountOptions(options);
  headerActionStatusReporter = options.onStatus;

  if (activeHeaderActionGroupController) {
    activeHeaderActionGroupController.dispose();
    activeHeaderActionGroupController = null;
  }

  const host = mountSvelteHost({
    tagName: HEADER_ACTION_GROUP_TAG,
    target,
    props: {
      canUndo: options.initialCanUndo,
      canRedo: options.initialCanRedo,
      onUndoPipeline: options.onUndoPipeline,
      onRedoPipeline: options.onRedoPipeline,
      onResetPresetSelected: options.onResetPresetSelected,
      onSavePipeline: options.onSavePipeline,
      onPipelineFileSelected: options.onPipelineFileSelected,
      onOpenShaderDialog: options.onOpenShaderDialog,
      onExportShaderZip: options.onExportShaderZip,
      onStatus: options.onStatus,
    },
  });

  activeHeaderActionGroupController = {
    dispose: () => host.destroyHost(),
    syncHistory: (canUndo, canRedo) => {
      if (!isBoolean(canUndo) || !isBoolean(canRedo)) {
        headerActionStatusReporter(
          t('header.status.invalidHistorySyncValue', {
            value: `canUndo=${String(canUndo)}, canRedo=${String(canRedo)}`,
          }),
          'error',
        );
        return;
      }

      host.setHostProps({ canUndo, canRedo });
    },
    onStatus: options.onStatus,
  };
}

export function syncHeaderActionHistoryState(canUndo: boolean, canRedo: boolean): void {
  const controller = activeHeaderActionGroupController;
  if (!controller) {
    return;
  }

  if (!isBoolean(canUndo) || !isBoolean(canRedo)) {
    controller.onStatus(
      t('header.status.invalidHistorySyncArg', {
        value: `canUndo=${String(canUndo)}, canRedo=${String(canRedo)}`,
      }),
      'error',
    );
    return;
  }

  controller.syncHistory(canUndo, canRedo);
}
