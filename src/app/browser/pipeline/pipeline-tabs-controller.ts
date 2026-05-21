import type { ColorRamp2dLutData } from '../../../features/lut-editor/lut-editor-model.ts';
import {
    createLutEditorTabHistoryController,
    type LutEditorTabHistoryController,
} from '../../../features/lut-editor/lut-editor-tab-history.ts';
import type { LutModel } from '../../../features/step/step-model.ts';

export interface LutEditorTabState {
  lutId: string;
  /** タブを開いた時点の元の LUT データ（キャンセル時の revert に使う） */
  originalLutModel: LutModel;
  historyController: LutEditorTabHistoryController;
  /** Apply 前の未コミット変更があるかどうか */
  isDirty: boolean;
}

export interface PipelineTab {
  id: string;
  label: string;
  isDirty: boolean;
  kind: 'pipeline' | 'lut';
}

interface PipelineTabsControllerOptions {
  onTabsChange?: (tabs: PipelineTab[], activeTabId: string) => void;
}

export interface PipelineTabsController {
  /** 現在の全タブリスト（Pipeline タブ + LUT タブ） */
  getTabs: () => PipelineTab[];
  /** 現在アクティブなタブ ID */
  getActiveTabId: () => string;
  /** 指定 lutId の LUT タブを開く（既に開いていればそちらへ切り替えるだけ）。返値は「新たに開いたか」 */
  openLutTab: (lutId: string, lutModel: LutModel, initialRampData: ColorRamp2dLutData) => boolean;
  /** LUT タブを閉じる */
  closeLutTab: (lutId: string) => void;
  /** タブをアクティブにする */
  setActiveTab: (tabId: string) => void;
  /** LUT タブの状態を取得する */
  getLutTabState: (lutId: string) => LutEditorTabState | null;
  /** LUT タブのダーティフラグを更新する */
  setLutTabDirty: (lutId: string, isDirty: boolean) => void;
  /** LUT タブの名前ラベルを更新する（LUT 名変更時） */
  updateLutTabLabel: (lutId: string, label: string) => void;
  /** 指定 lutId の LUT タブが開かれているかどうか */
  isLutTabOpen: (lutId: string) => boolean;
}

const PIPELINE_TAB_ID = 'pipeline';

export function createPipelineTabsController(
  options: PipelineTabsControllerOptions = {},
): PipelineTabsController {
  const pipelineTab: PipelineTab = {
    id: PIPELINE_TAB_ID,
    label: 'Pipeline',
    isDirty: false,
    kind: 'pipeline',
  };

  let activeTabId = PIPELINE_TAB_ID;
  const lutTabStates = new Map<string, LutEditorTabState>();
  const lutTabOrder: string[] = [];

  const buildTabs = (): PipelineTab[] => {
    const result: PipelineTab[] = [pipelineTab];
    for (const lutId of lutTabOrder) {
      const state = lutTabStates.get(lutId);
      if (!state) {
        continue;
      }
      result.push({
        id: `lut:${lutId}`,
        label: state.originalLutModel.name,
        isDirty: state.isDirty,
        kind: 'lut',
      });
    }
    return result;
  };

  const notifyChange = (): void => {
    if (options.onTabsChange) {
      options.onTabsChange(buildTabs(), activeTabId);
    }
  };

  const tabIdForLut = (lutId: string): string => `lut:${lutId}`;

  return {
    getTabs: () => buildTabs(),

    getActiveTabId: () => activeTabId,

    openLutTab(lutId: string, lutModel: LutModel, initialRampData: ColorRamp2dLutData): boolean {
      if (lutTabStates.has(lutId)) {
        // 既に開いている → フォーカスのみ
        activeTabId = tabIdForLut(lutId);
        notifyChange();
        return false;
      }

      const historyController = createLutEditorTabHistoryController(initialRampData);
      const state: LutEditorTabState = {
        lutId,
        originalLutModel: lutModel,
        historyController,
        isDirty: false,
      };
      lutTabStates.set(lutId, state);
      lutTabOrder.push(lutId);
      activeTabId = tabIdForLut(lutId);
      notifyChange();
      return true;
    },

    closeLutTab(lutId: string): void {
      const state = lutTabStates.get(lutId);
      if (!state) {
        return;
      }
      state.historyController.dispose();
      lutTabStates.delete(lutId);
      const orderIndex = lutTabOrder.indexOf(lutId);
      if (orderIndex >= 0) {
        lutTabOrder.splice(orderIndex, 1);
      }

      // アクティブだったタブを閉じた場合は Pipeline タブへ戻る
      if (activeTabId === tabIdForLut(lutId)) {
        // 隣のタブがあればそちらへ、なければ Pipeline タブへ
        if (lutTabOrder.length > 0) {
          const nextIndex = Math.min(orderIndex, lutTabOrder.length - 1);
          const nextLutId = lutTabOrder[nextIndex];
          activeTabId = nextLutId ? tabIdForLut(nextLutId) : PIPELINE_TAB_ID;
        } else {
          activeTabId = PIPELINE_TAB_ID;
        }
      }
      notifyChange();
    },

    setActiveTab(tabId: string): void {
      const isValid = tabId === PIPELINE_TAB_ID
        || (tabId.startsWith('lut:') && lutTabStates.has(tabId.slice(4)));
      if (!isValid) {
        return;
      }
      activeTabId = tabId;
      notifyChange();
    },

    getLutTabState(lutId: string): LutEditorTabState | null {
      return lutTabStates.get(lutId) ?? null;
    },

    setLutTabDirty(lutId: string, isDirty: boolean): void {
      const state = lutTabStates.get(lutId);
      if (!state || state.isDirty === isDirty) {
        return;
      }
      state.isDirty = isDirty;
      notifyChange();
    },

    updateLutTabLabel(lutId: string, label: string): void {
      const state = lutTabStates.get(lutId);
      if (!state) {
        return;
      }
      state.originalLutModel = { ...state.originalLutModel, name: label };
      notifyChange();
    },

    isLutTabOpen(lutId: string): boolean {
      return lutTabStates.has(lutId);
    },
  };
}
