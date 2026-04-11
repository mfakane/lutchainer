import { createSignal, type Accessor, type JSX } from 'solid-js';
import { render } from 'solid-js/web';
import {
  getLanguageLabel,
  setLanguage,
  t,
  useLanguage,
  type Language,
} from '../i18n.ts';
import { cx } from '../styles/cx.ts';
import * as ui from '../styles/ui-primitives.css.ts';
import type { PipelinePresetKey } from '../ui/pipeline-presets.ts';
import { DropdownMenu } from './solid-dropdown-menu.tsx';
import * as styles from './solid-header-actions.css.ts';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

const RESET_PRESETS: readonly PipelinePresetKey[] = ['StandardToon', 'HueShiftToon', 'HueSatShiftToon', 'Metallic'];

interface HeaderActionGroupMountOptions {
  initialAutoApplyEnabled: boolean;
  initialCanUndo: boolean;
  initialCanRedo: boolean;
  onUndoPipeline: () => void;
  onRedoPipeline: () => void;
  onResetPresetSelected: (preset: PipelinePresetKey) => void | Promise<void>;
  onSavePipeline: () => void | Promise<void>;
  onApplyPipeline: () => void;
  onPipelineFileSelected: (file: File) => void | Promise<void>;
  onAutoApplyChange: (enabled: boolean) => void;
  onStatus: StatusReporter;
}

interface HeaderActionGroupProps {
  autoApplyEnabled: Accessor<boolean>;
  canUndo: Accessor<boolean>;
  canRedo: Accessor<boolean>;
  onUndoPipeline: () => void;
  onRedoPipeline: () => void;
  onResetPresetSelected: (preset: PipelinePresetKey) => void | Promise<void>;
  onSavePipeline: () => void | Promise<void>;
  onApplyPipeline: () => void;
  onPipelineFileSelected: (file: File) => void | Promise<void>;
  onAutoApplyChange: (enabled: boolean) => void;
  onStatus: StatusReporter;
}

let disposeHeaderActionGroup: (() => void) | null = null;
let syncHeaderActionAutoApplyInternal: ((enabled: boolean) => void) | null = null;
let syncHeaderActionHistoryInternal: ((canUndo: boolean, canRedo: boolean) => void) | null = null;
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
  if (!isBoolean(options.initialAutoApplyEnabled)) {
    throw new Error('ヘッダーアクションの初期自動反映状態が不正です。');
  }
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
  if (typeof options.onApplyPipeline !== 'function') {
    throw new Error('ヘッダーアクションの適用コールバックが不正です。');
  }
  if (typeof options.onPipelineFileSelected !== 'function') {
    throw new Error('ヘッダーアクションの読み込みコールバックが不正です。');
  }
  if (typeof options.onAutoApplyChange !== 'function') {
    throw new Error('ヘッダーアクションの自動反映コールバックが不正です。');
  }
  if (typeof options.onStatus !== 'function') {
    throw new Error('ヘッダーアクションのステータス通知コールバックが不正です。');
  }
}

function HeaderActionGroup(props: HeaderActionGroupProps): JSX.Element {
  let pipelineFileInputRef: HTMLInputElement | null = null;
  const language = useLanguage();

  const tr = (key: string, values?: Record<string, string | number>): string => {
    language();
    return t(key, values);
  };

  const openPipelineFilePicker = (): void => {
    if (!pipelineFileInputRef) {
      props.onStatus(t('header.status.missingPipelineFileInput'), 'error');
      return;
    }

    pipelineFileInputRef.click();
  };

  const handleSavePipeline = async (): Promise<void> => {
    try {
      await props.onSavePipeline();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.unknownError');
      props.onStatus(t('header.status.pipelineSaveFailed', { message }), 'error');
    }
  };

  const handleResetPresetSelect = async (preset: PipelinePresetKey): Promise<void> => {
    try {
      await props.onResetPresetSelected(preset);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.unknownError');
      props.onStatus(t('header.status.pipelineLoadFailed', { message }), 'error');
    }
  };

  const handlePipelineFileInputChange = async (event: Event): Promise<void> => {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      props.onStatus(t('header.status.pipelineInputMissing'), 'error');
      return;
    }

    const file = input.files?.[0];
    if (!file) {
      input.value = '';
      return;
    }

    if (!(file instanceof File)) {
      props.onStatus(t('header.status.invalidSelectedFile'), 'error');
      input.value = '';
      return;
    }

    if (!Number.isFinite(file.size) || file.size <= 0) {
      props.onStatus(t('header.status.emptyFile'), 'error');
      input.value = '';
      return;
    }

    try {
      await props.onPipelineFileSelected(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.unknownError');
      props.onStatus(t('header.status.pipelineLoadFailed', { message }), 'error');
    } finally {
      input.value = '';
    }
  };

  const handleAutoApplyChange = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      props.onStatus(t('header.status.autoApplyCheckboxMissing'), 'error');
      return;
    }

    if (!isBoolean(input.checked)) {
      props.onStatus(t('header.status.autoApplyCheckboxInvalid'), 'error');
      return;
    }

    props.onAutoApplyChange(input.checked);
  };

  return (
    <>
      <button
        class={cx(ui.buttonBase, ui.secondaryButton)}
        id="btn-undo-pipeline"
        aria-label={tr('header.undoAria')}
        disabled={!props.canUndo()}
        onClick={props.onUndoPipeline}
      >{tr('header.undo')}</button>
      <button
        class={cx(ui.buttonBase, ui.secondaryButton)}
        id="btn-redo-pipeline"
        aria-label={tr('header.redoAria')}
        disabled={!props.canRedo()}
        onClick={props.onRedoPipeline}
      >{tr('header.redo')}</button>
      <DropdownMenu
        wrapperClass={ui.menuWrap}
        triggerClass={cx(ui.buttonBase, ui.secondaryButton)}
        menuClass={ui.menu}
        triggerAriaLabel={tr('header.reset')}
        triggerContent={<span>{tr('header.reset')}</span>}
        menuRole="menu"
      >
        {controls => (
          <>
            <button
              type="button"
              class={ui.menuItem}
              role="menuitem"
              onClick={() => {
                controls.closeMenu();
                void handleResetPresetSelect('Initial');
              }}
            >
              {tr('header.resetInitial')}
            </button>
            <div class={ui.menuHeader}>{tr('header.resetExamples')}</div>
            {RESET_PRESETS.map(preset => (
              <button
                type="button"
                class={ui.menuItem}
                role="menuitem"
                onClick={() => {
                  controls.closeMenu();
                  void handleResetPresetSelect(preset);
                }}
              >
                {preset}
              </button>
            ))}
          </>
        )}
      </DropdownMenu>
      <button class={cx(ui.buttonBase, ui.secondaryButton)} id="btn-load-pipeline" onClick={openPipelineFilePicker}>{tr('header.load')}</button>
      <button class={cx(ui.buttonBase, ui.secondaryButton)} id="btn-save-pipeline" onClick={() => void handleSavePipeline()}>{tr('header.save')}</button>
      <input
        ref={element => {
          pipelineFileInputRef = element;
        }}
        type="file"
        id="pipeline-file-input"
        accept=".lutchain,application/x-lutchain"
        hidden
        onChange={event => void handlePipelineFileInputChange(event)}
      />
      <label class={styles.autoLabel}>
        <input
          type="checkbox"
          id="chk-auto-apply"
          checked={props.autoApplyEnabled()}
          onChange={handleAutoApplyChange}
        />
        {tr('header.autoApply')}
      </label>
      <button class={cx(ui.buttonBase, ui.secondaryButton)} id="btn-apply-pipeline" onClick={props.onApplyPipeline}>{tr('header.apply')}</button>
      <button type="button" class={cx(ui.buttonBase, ui.submitButton, styles.shaderOpenButton)} id="btn-open-shader-dialog">{tr('header.openCode')}</button>
    </>
  );
}

let disposeLanguageSwitcher: (() => void) | null = null;

export function mountLanguageSwitcher(target: HTMLElement): void {
  if (!(target instanceof HTMLElement)) {
    throw new Error('言語スイッチャーの描画先要素が不正です。');
  }

  if (disposeLanguageSwitcher) {
    disposeLanguageSwitcher();
    disposeLanguageSwitcher = null;
  }

  target.textContent = '';

  disposeLanguageSwitcher = render(() => {
    const language = useLanguage();
    const tr = (key: string, values?: Record<string, string | number>): string => {
      language();
      return t(key, values);
    };
    const isLanguageActive = (candidate: Language): boolean => language() === candidate;
    const handleLanguageSelect = (value: unknown): void => {
      if (!isLanguage(value)) {
        headerActionStatusReporter(t('header.status.invalidLanguageSelection', { value: String(value) }), 'error');
        return;
      }
      if (isLanguageActive(value)) return;
      setLanguage(value);
    };
    return (
      <div class={styles.languageSwitcher} role="group" aria-label={tr('header.languageGroupAria')}>
        <button
          type="button"
          class={cx(ui.buttonBase, ui.secondaryButton, ui.languageButton, isLanguageActive('en') && ui.activeAccent)}
          id="btn-set-language-en"
          aria-label={tr('language.switchAria', { language: getLanguageLabel('en') })}
          aria-pressed={isLanguageActive('en') ? 'true' : 'false'}
          onClick={() => handleLanguageSelect('en')}
        >en</button>
        <button
          type="button"
          class={cx(ui.buttonBase, ui.secondaryButton, ui.languageButton, isLanguageActive('ja') && ui.activeAccent)}
          id="btn-set-language-ja"
          aria-label={tr('language.switchAria', { language: getLanguageLabel('ja') })}
          aria-pressed={isLanguageActive('ja') ? 'true' : 'false'}
          onClick={() => handleLanguageSelect('ja')}
        >ja</button>
      </div>
    );
  }, target);
}

export function mountHeaderActionGroup(target: HTMLElement, options: HeaderActionGroupMountOptions): void {
  if (!(target instanceof HTMLElement)) {
    throw new Error('ヘッダーアクションの描画先要素が不正です。');
  }

  ensureMountOptions(options);
  headerActionStatusReporter = options.onStatus;

  if (disposeHeaderActionGroup) {
    disposeHeaderActionGroup();
    disposeHeaderActionGroup = null;
  }

  target.textContent = '';

  disposeHeaderActionGroup = render(() => {
    const [autoApplyEnabled, setAutoApplyEnabled] = createSignal(options.initialAutoApplyEnabled);
    const [canUndo, setCanUndo] = createSignal(options.initialCanUndo);
    const [canRedo, setCanRedo] = createSignal(options.initialCanRedo);

    syncHeaderActionAutoApplyInternal = enabled => {
      if (!isBoolean(enabled)) {
        headerActionStatusReporter(
          t('header.status.invalidAutoApplySyncValue', { value: String(enabled) }),
          'error',
        );
        return;
      }
      setAutoApplyEnabled(enabled);
    };

    syncHeaderActionHistoryInternal = (nextCanUndo, nextCanRedo) => {
      if (!isBoolean(nextCanUndo) || !isBoolean(nextCanRedo)) {
        headerActionStatusReporter(
          t('header.status.invalidHistorySyncValue', {
            value: `canUndo=${String(nextCanUndo)}, canRedo=${String(nextCanRedo)}`,
          }),
          'error',
        );
        return;
      }

      setCanUndo(nextCanUndo);
      setCanRedo(nextCanRedo);
    };

    const handleAutoApplyChange = (enabled: boolean): void => {
      if (!isBoolean(enabled)) {
        headerActionStatusReporter(
          t('header.status.invalidAutoApplyInputValue', { value: String(enabled) }),
          'error',
        );
        return;
      }

      setAutoApplyEnabled(enabled);
      options.onAutoApplyChange(enabled);
    };

    return (
      <HeaderActionGroup
        autoApplyEnabled={autoApplyEnabled}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndoPipeline={options.onUndoPipeline}
        onRedoPipeline={options.onRedoPipeline}
        onResetPresetSelected={options.onResetPresetSelected}
        onSavePipeline={options.onSavePipeline}
        onApplyPipeline={options.onApplyPipeline}
        onPipelineFileSelected={options.onPipelineFileSelected}
        onAutoApplyChange={handleAutoApplyChange}
        onStatus={options.onStatus}
      />
    );
  }, target);
}

export function syncHeaderActionAutoApplyState(enabled: boolean): void {
  if (!syncHeaderActionAutoApplyInternal) {
    return;
  }

  if (!isBoolean(enabled)) {
    headerActionStatusReporter(
      t('header.status.invalidAutoApplySyncArg', { value: String(enabled) }),
      'error',
    );
    return;
  }

  syncHeaderActionAutoApplyInternal(enabled);
}

export function syncHeaderActionHistoryState(canUndo: boolean, canRedo: boolean): void {
  if (!syncHeaderActionHistoryInternal) {
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

  syncHeaderActionHistoryInternal(canUndo, canRedo);
}
