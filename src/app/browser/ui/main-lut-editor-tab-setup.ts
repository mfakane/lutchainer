import type { ColorRamp2dLutData } from '../../../features/lut-editor/lut-editor-model.ts';
import { createLutFromColorRamp2d } from '../../../features/lut-editor/lut-editor-painter.ts';
import { createDefaultColorRamp2dLutData } from '../../../features/lut-editor/lut-editor-runtime.ts';
import type { LutModel } from '../../../features/step/step-model.ts';
import type { AppTranslator } from '../../../shared/i18n/browser-translation-contract.ts';
import {
  createPipelineTabsController,
  type PipelineTab,
  type PipelineTabsController,
} from '../pipeline/pipeline-tabs-controller.ts';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

interface LutEditorTabContentElement extends HTMLElement {
  rampData: ColorRamp2dLutData | null;
  lutId: string | null;
}

interface PipelineTabBarElement extends HTMLElement {
  tabs: PipelineTab[];
  activeTabId: string;
}

export interface SetupMainLutEditorTabsOptions {
  /** タブコンテンツを含む親要素（Pipeline タブペインと LUT タブペインが追加される） */
  pipelineTabContentEl: HTMLElement;
  /** タブバーカスタム要素 */
  tabBarEl: HTMLElement;
  getLuts: () => LutModel[];
  setLuts: (luts: LutModel[]) => void;
  maxLuts: number;
  captureHistorySnapshot: () => unknown;
  commitHistorySnapshot: (before: unknown) => boolean;
  renderSteps: () => void;
  scheduleApply: () => void;
  renderLutStrip: () => void;
  onStatus: StatusReporter;
  t: AppTranslator;
  onActiveTabHistoryStateChange?: (state: { isLutTabActive: boolean; canUndo: boolean; canRedo: boolean }) => void;
  onScheduleConnectionDraw?: () => void;
}

export interface LutEditorTabsController {
  openForLut: (lutId: string) => void;
  createNewLut: () => void;
  /** 現在アクティブなタブが LUT タブのとき、per-tab undo を実行する。実行したら true を返す。 */
  tryUndoInActiveTab: () => boolean;
  /** 現在アクティブなタブが LUT タブのとき、per-tab redo を実行する。実行したら true を返す。 */
  tryRedoInActiveTab: () => boolean;
  dispose: () => void;
}

// LUT 変更のリアルタイム反映に使うデバウンスタイマー
const LIVE_APPLY_DEBOUNCE_MS = 220;

function debounce<T extends () => void>(fn: T, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, ms);
  };
}

export function setupMainLutEditorTabs(
  options: SetupMainLutEditorTabsOptions,
): LutEditorTabsController {
  const tabBarEl = options.tabBarEl as PipelineTabBarElement;
  const tabContentEl = options.pipelineTabContentEl;

  // デバウンス済みの「ライブ適用」（LUT 変更を 3D プレビューに反映）
  const debouncedLiveApply = debounce(() => {
    options.scheduleApply();
    options.renderSteps();
    options.renderLutStrip();
  }, LIVE_APPLY_DEBOUNCE_MS);

  // タブコントローラー
  const tabsController: PipelineTabsController = createPipelineTabsController({
    onTabsChange: (tabs, activeTabId) => {
      syncTabBarState(tabs, activeTabId);
      syncTabPaneVisibility(activeTabId);
      emitActiveTabHistoryState();
    },
  });

  function emitActiveTabHistoryState(): void {
    const callback = options.onActiveTabHistoryStateChange;
    if (!callback) {
      return;
    }

    const activeTabId = tabsController.getActiveTabId();
    if (!activeTabId.startsWith('lut:')) {
      callback({ isLutTabActive: false, canUndo: false, canRedo: false });
      return;
    }

    const lutId = activeTabId.slice(4);
    const tabState = tabsController.getLutTabState(lutId);
    if (!tabState) {
      callback({ isLutTabActive: false, canUndo: false, canRedo: false });
      return;
    }

    callback({
      isLutTabActive: true,
      canUndo: tabState.historyController.canUndo(),
      canRedo: tabState.historyController.canRedo(),
    });
  }

  // タブバーの状態同期
  function syncTabBarState(tabs: PipelineTab[], activeTabId: string): void {
    tabBarEl.tabs = tabs;
    tabBarEl.activeTabId = activeTabId;
  }

  // タブペインの表示切り替え
  function syncTabPaneVisibility(activeTabId: string): void {
    const panes = tabContentEl.querySelectorAll<HTMLElement>('[data-tab-id]');
    for (const pane of Array.from(panes)) {
      pane.style.display = pane.dataset.tabId === activeTabId ? '' : 'none';
    }
    // タブ切り替え時に接続線を再描画
    options.onScheduleConnectionDraw?.();
  }

  // タブバーのイベント（タブ選択・クローズ要求）を配線
  tabBarEl.addEventListener('tab-select', event => {
    const detail = (event as CustomEvent<{ tabId: string }>).detail;
    tabsController.setActiveTab(detail.tabId);
  });

  tabBarEl.addEventListener('tab-close-request', event => {
    const detail = (event as CustomEvent<{ tabId: string }>).detail;
    if (!detail.tabId.startsWith('lut:')) {
      return;
    }
    const lutId = detail.tabId.slice(4);
    requestCloseLutTab(lutId);
  });

  // タブコンテンツエリアで lut-change / apply-lut イベントをバブルキャッチ
  tabContentEl.addEventListener('lut-change', event => {
    const detail = (event as CustomEvent<{ lutId: string | null; rampData: ColorRamp2dLutData }>).detail;
    if (!detail.lutId) {
      return;
    }
    handleLutChange(detail.lutId, detail.rampData);
  });

  tabContentEl.addEventListener('apply-lut', event => {
    const detail = (event as CustomEvent<{ lutId: string | null; updatedLut: LutModel }>).detail;
    if (!detail.lutId) {
      return;
    }
    handleLutApply(detail.lutId, detail.updatedLut);
  });

  /**
   * LUT 変更ハンドラ（リアルタイムプレビュー用）
   */
  function handleLutChange(lutId: string, rampData: ColorRamp2dLutData): void {
    const tabState = tabsController.getLutTabState(lutId);
    if (!tabState) {
      return;
    }

    // per-tab undo スタックに変更を記録（デバウンス）
    tabState.historyController.recordChange(rampData);

    // LUT テクスチャ生成と暫定反映
    const updatedLut = createLutFromColorRamp2d(rampData);
    const luts = options.getLuts();
    const nextLuts = luts.map(l => l.id === lutId ? { ...updatedLut, id: lutId } : l);
    options.setLuts(nextLuts);

    // 外部からの rampData 同期キーを最新化して、直後の undo でもエディタ表示を確実に同期させる
    const pane = options.pipelineTabContentEl.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(`lut:${lutId}`)}"]`);
    const tabEl = pane?.querySelector('lut-lut-editor-tab') as LutEditorTabContentElement | null;
    if (tabEl) {
      tabEl.rampData = rampData;
    }

    // ダーティフラグを立てる
    tabsController.setLutTabDirty(lutId, true);

    // LUT 名が変わっていればタブラベルも更新
    if (rampData.name !== tabState.originalLutModel.name) {
      tabsController.updateLutTabLabel(lutId, rampData.name);
    }

    // デバウンス済みでプレビューを更新
    debouncedLiveApply();
    emitActiveTabHistoryState();
  }

  /**
   * Apply ボタン押下ハンドラ（グローバル history にコミットしてタブを閉じる）
   */
  function handleLutApply(lutId: string, updatedLut: LutModel): void {
    const luts = options.getLuts();
    const target = luts.find(l => l.id === lutId);
    if (!target) {
      options.onStatus(options.t('lutEditor.status.notFound'), 'error');
      return;
    }

    const before = options.captureHistorySnapshot();
    const nextLuts = luts.map(l => l.id === lutId ? { ...updatedLut, id: lutId } : l);
    options.setLuts(nextLuts);
    options.commitHistorySnapshot(before);
    options.renderSteps();
    options.scheduleApply();
    options.renderLutStrip();
    options.onStatus(options.t('lutEditor.status.applied', { name: target.name }), 'success');

    // タブを閉じる（dirty クリア後）
    tabsController.setLutTabDirty(lutId, false);
    closeLutTab(lutId);
    emitActiveTabHistoryState();
  }

  /**
   * タブクローズ要求（dirty であれば確認ダイアログ）
   */
  function requestCloseLutTab(lutId: string): void {
    const tabState = tabsController.getLutTabState(lutId);
    if (!tabState) {
      return;
    }

    if (tabState.isDirty) {
      const confirmed = window.confirm(options.t('lutEditor.tab.discardConfirm'));
      if (!confirmed) {
        return;
      }
      // 変更を元に戻す
      revertLutToOriginal(lutId, tabState.originalLutModel);
    }
    closeLutTab(lutId);
  }

  /**
   * LUT を元のデータに戻す
   */
  function revertLutToOriginal(lutId: string, originalLutModel: LutModel): void {
    const luts = options.getLuts();
    const nextLuts = luts.map(l => l.id === lutId ? originalLutModel : l);
    options.setLuts(nextLuts);
    options.scheduleApply();
    options.renderSteps();
    options.renderLutStrip();
  }

  /**
   * タブを DOM から削除して閉じる
   */
  function closeLutTab(lutId: string): void {
    const tabId = `lut:${lutId}`;
    const pane = tabContentEl.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(tabId)}"]`);
    if (pane) {
      pane.remove();
    }
    tabsController.closeLutTab(lutId);
  }

  /**
   * LUT タブを開いてコンポーネントをマウントする
   */
  function openLutEditorTab(lutId: string): void {
    const luts = options.getLuts();
    const lut = luts.find(l => l.id === lutId);
    if (!lut) {
      options.onStatus(options.t('lutEditor.status.notFound'), 'error');
      return;
    }

    const rampData = lut.ramp2dData ?? createDefaultColorRamp2dLutData(lut.name);
    const tabId = `lut:${lutId}`;

    const isNew = tabsController.openLutTab(lutId, lut, rampData);

    if (isNew) {
      // 新規タブペインを DOM に追加
      const pane = document.createElement('div');
      pane.className = 'pipeline-tab-pane lut-editor-tab-pane';
      pane.dataset.tabId = tabId;
      pane.style.display = '';

      const tabEl = document.createElement('lut-lut-editor-tab') as LutEditorTabContentElement;
      tabEl.className = 'lut-editor-tab-surface';
      pane.appendChild(tabEl);
      tabContentEl.appendChild(pane);

      // プロパティをセット（カスタム要素の rampData / lutId props）
      tabEl.rampData = rampData;
      tabEl.lutId = lutId;
    }
    // 既存タブへの切り替えは tabsController.openLutTab が onTabsChange 経由で DOM を更新する
  }

  // 初期 tab-bar 状態を設定
  syncTabBarState(tabsController.getTabs(), tabsController.getActiveTabId());

  return {
    openForLut(lutId: string): void {
      openLutEditorTab(lutId);
    },

    createNewLut(): void {
      const luts = options.getLuts();
      if (luts.length >= options.maxLuts) {
        options.onStatus(options.t('main.status.maxLutLimit', { max: options.maxLuts }), 'error');
        return;
      }

      // 新規 LUT を一時的に作成してタブを開く
      const name = options.t('lutEditor.newLutName');
      const rampData = createDefaultColorRamp2dLutData(name);
      const newLut = createLutFromColorRamp2d(rampData);

      const before = options.captureHistorySnapshot();
      options.setLuts([...luts, newLut]);
      options.commitHistorySnapshot(before);
      options.renderSteps();
      options.scheduleApply();
      options.renderLutStrip();

      openLutEditorTab(newLut.id);
    },

    tryUndoInActiveTab(): boolean {
      const activeTabId = tabsController.getActiveTabId();
      if (!activeTabId.startsWith('lut:')) {
        return false;
      }
      const lutId = activeTabId.slice(4);
      const tabState = tabsController.getLutTabState(lutId);
      if (!tabState) {
        return false;
      }

      const prevData = tabState.historyController.undo();
      if (prevData === null) {
        return true; // キャプチャはしたが戻れなかった（但しグローバルには渡さない）
      }

      // LUT を per-tab undo で復元した状態に適用
      const updatedLut = createLutFromColorRamp2d(prevData);
      const luts = options.getLuts();
      const nextLuts = luts.map(l => l.id === lutId ? { ...updatedLut, id: lutId } : l);
      options.setLuts(nextLuts);
      debouncedLiveApply();

      // タブコンポーネントの表示も同期（rampData プロパティ更新）
      const pane = options.pipelineTabContentEl.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(`lut:${lutId}`)}"]`);
      const tabEl = pane?.querySelector('lut-lut-editor-tab') as LutEditorTabContentElement | null;
      if (tabEl) {
        tabEl.rampData = prevData;
      }

      // dirty フラグ更新（undo で初期状態に戻ったかを判定）
      tabsController.setLutTabDirty(lutId, tabState.historyController.canUndo());
      emitActiveTabHistoryState();
      return true;
    },

    tryRedoInActiveTab(): boolean {
      const activeTabId = tabsController.getActiveTabId();
      if (!activeTabId.startsWith('lut:')) {
        return false;
      }
      const lutId = activeTabId.slice(4);
      const tabState = tabsController.getLutTabState(lutId);
      if (!tabState) {
        return false;
      }

      const nextData = tabState.historyController.redo();
      if (nextData === null) {
        return true;
      }

      const updatedLut = createLutFromColorRamp2d(nextData);
      const luts = options.getLuts();
      const nextLuts = luts.map(l => l.id === lutId ? { ...updatedLut, id: lutId } : l);
      options.setLuts(nextLuts);
      debouncedLiveApply();

      const pane = options.pipelineTabContentEl.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(`lut:${lutId}`)}"]`);
      const tabEl = pane?.querySelector('lut-lut-editor-tab') as LutEditorTabContentElement | null;
      if (tabEl) {
        tabEl.rampData = nextData;
      }

      tabsController.setLutTabDirty(lutId, true);
      emitActiveTabHistoryState();
      return true;
    },

    dispose(): void {
      // 全 LUT タブを強制クローズ（revert なし）
      for (const tab of tabsController.getTabs()) {
        if (tab.kind === 'lut') {
          const lutId = tab.id.slice(4);
          closeLutTab(lutId);
        }
      }
      emitActiveTabHistoryState();
    },
  };
}
