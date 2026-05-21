import type { ColorRamp2dLutData } from './lut-editor-model.ts';

const LUT_TAB_HISTORY_LIMIT = 50;
const LUT_TAB_HISTORY_DEBOUNCE_MS = 600;

export interface LutEditorTabHistoryController {
  /**
   * 変更後の状態を記録する（内部でデバウンス処理）。
   * undo/redo スタックをクリアしてからプッシュはしない点に注意。
   */
  recordChange: (data: ColorRamp2dLutData) => void;
  /** 保留中のデバウンスエントリを即座にコミットする（タブクローズ時等に呼ぶ）。 */
  flush: () => void;
  /**
   * アンドゥ。
   * - 保留中の未コミット変更がある場合: 変更を破棄して最後のコミット済み状態を返す。
   * - それ以外: スタックを1つ戻して状態を返す。
   * - 戻れない場合は null を返す。
   */
  undo: () => ColorRamp2dLutData | null;
  /** リドゥ。スタックを1つ進めて状態を返す。進めない場合は null を返す。 */
  redo: () => ColorRamp2dLutData | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
  dispose: () => void;
}

export function createLutEditorTabHistoryController(
  initialData: ColorRamp2dLutData,
): LutEditorTabHistoryController {
  // undoStack の末尾が「現在コミット済みの状態」。
  let undoStack: ColorRamp2dLutData[] = [initialData];
  let redoStack: ColorRamp2dLutData[] = [];
  let pendingData: ColorRamp2dLutData | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const clearDebounce = (): void => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  const commitPending = (): void => {
    if (pendingData === null) {
      return;
    }
    const data = pendingData;
    pendingData = null;
    clearDebounce();
    undoStack.push(data);
    if (undoStack.length > LUT_TAB_HISTORY_LIMIT + 1) {
      undoStack.shift();
    }
    redoStack = [];
  };

  return {
    recordChange(data: ColorRamp2dLutData): void {
      pendingData = data;
      clearDebounce();
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        commitPending();
      }, LUT_TAB_HISTORY_DEBOUNCE_MS);
    },

    flush(): void {
      commitPending();
    },

    undo(): ColorRamp2dLutData | null {
      if (pendingData !== null) {
        // 保留中の未コミット変更を破棄して、最後のコミット済み状態へ戻す
        clearDebounce();
        pendingData = null;
        return undoStack[undoStack.length - 1] ?? null;
      }
      if (undoStack.length <= 1) {
        return null;
      }
      const current = undoStack.pop()!;
      redoStack.push(current);
      if (redoStack.length > LUT_TAB_HISTORY_LIMIT) {
        redoStack.shift();
      }
      return undoStack[undoStack.length - 1] ?? null;
    },

    redo(): ColorRamp2dLutData | null {
      if (redoStack.length === 0) {
        return null;
      }
      const next = redoStack.pop()!;
      undoStack.push(next);
      if (undoStack.length > LUT_TAB_HISTORY_LIMIT + 1) {
        undoStack.shift();
      }
      return next;
    },

    canUndo(): boolean {
      return pendingData !== null || undoStack.length > 1;
    },

    canRedo(): boolean {
      return redoStack.length > 0;
    },

    clearHistory(): void {
      clearDebounce();
      pendingData = null;
      undoStack = [];
      redoStack = [];
    },

    dispose(): void {
      clearDebounce();
    },
  };
}
