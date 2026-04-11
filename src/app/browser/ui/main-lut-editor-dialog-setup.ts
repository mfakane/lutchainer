import { createDefaultColorRamp2dLutData } from '../../../features/lut-editor/lut-editor-runtime.ts';
import type { LutModel } from '../../../features/step/step-model.ts';
import type { AppTranslator } from '../../../shared/i18n/browser-translation-contract.ts';
import {
  mountLutEditorDialogShell,
  syncLutEditorDialogState,
} from '../components/lut-editor-dialog/index.tsx';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

export interface SetupMainLutEditorDialogOptions {
  dialogEl: HTMLDialogElement;
  surfaceEl: Element;
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
}

export interface LutEditorDialogController {
  openForLut: (lutId: string) => void;
  createNewLut: () => void;
}

function ensureOptions(value: unknown): asserts value is SetupMainLutEditorDialogOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('setupMainLutEditorDialog: options が不正です。');
  }
  const o = value as Partial<SetupMainLutEditorDialogOptions>;
  if (!(o.dialogEl instanceof HTMLDialogElement)) {
    throw new Error('setupMainLutEditorDialog: dialogEl が不正です。');
  }
  if (!(o.surfaceEl instanceof Element)) {
    throw new Error('setupMainLutEditorDialog: surfaceEl が不正です。');
  }
  if (typeof o.getLuts !== 'function') {
    throw new Error('setupMainLutEditorDialog: getLuts が不正です。');
  }
  if (typeof o.setLuts !== 'function') {
    throw new Error('setupMainLutEditorDialog: setLuts が不正です。');
  }
  if (!Number.isInteger(o.maxLuts) || (o.maxLuts ?? 0) <= 0) {
    throw new Error('setupMainLutEditorDialog: maxLuts が不正です。');
  }
  if (typeof o.captureHistorySnapshot !== 'function') {
    throw new Error('setupMainLutEditorDialog: captureHistorySnapshot が不正です。');
  }
  if (typeof o.commitHistorySnapshot !== 'function') {
    throw new Error('setupMainLutEditorDialog: commitHistorySnapshot が不正です。');
  }
  if (typeof o.renderSteps !== 'function') {
    throw new Error('setupMainLutEditorDialog: renderSteps が不正です。');
  }
  if (typeof o.scheduleApply !== 'function') {
    throw new Error('setupMainLutEditorDialog: scheduleApply が不正です。');
  }
  if (typeof o.renderLutStrip !== 'function') {
    throw new Error('setupMainLutEditorDialog: renderLutStrip が不正です。');
  }
  if (typeof o.onStatus !== 'function') {
    throw new Error('setupMainLutEditorDialog: onStatus が不正です。');
  }
  if (typeof o.t !== 'function') {
    throw new Error('setupMainLutEditorDialog: t が不正です。');
  }
}

export function setupMainLutEditorDialog(
  options: SetupMainLutEditorDialogOptions,
): LutEditorDialogController {
  ensureOptions(options);

  const openLutEditorDialog = (): void => {
    if (typeof options.dialogEl.showModal === 'function') {
      if (!options.dialogEl.open) {
        options.dialogEl.showModal();
      }
      return;
    }
    options.dialogEl.setAttribute('open', '');
  };

  // lutId === null → 新規追加、非null → 既存置換
  const onApply = (lutId: string | null, updatedLut: LutModel): void => {
    const luts = options.getLuts();

    if (lutId === null) {
      // 新規追加
      if (luts.length >= options.maxLuts) {
        options.onStatus(options.t('main.status.maxLutLimit', { max: options.maxLuts }) as string, 'error');
        return;
      }
      const before = options.captureHistorySnapshot();
      options.setLuts([...luts, updatedLut]);
      options.commitHistorySnapshot(before);
      options.renderSteps();
      options.scheduleApply();
      options.renderLutStrip();
      options.onStatus(options.t('lutEditor.status.created', { name: updatedLut.name }) as string, 'success');
      return;
    }

    // 既存置換
    const target = luts.find(l => l.id === lutId);
    if (!target) {
      options.onStatus(options.t('lutEditor.status.notFound') as string, 'error');
      return;
    }
    const before = options.captureHistorySnapshot();
    const nextLuts = luts.map(l => l.id === lutId ? { ...updatedLut, id: lutId } : l);
    options.setLuts(nextLuts);
    options.commitHistorySnapshot(before);
    options.renderSteps();
    options.scheduleApply();
    options.renderLutStrip();
    options.onStatus(options.t('lutEditor.status.applied', { name: target.name }) as string, 'success');
  };

  mountLutEditorDialogShell({
    dialogEl: options.dialogEl,
    surfaceEl: options.surfaceEl,
    onApply,
  });

  return {
    openForLut: (lutId: string) => {
      const luts = options.getLuts();
      const lut = luts.find(l => l.id === lutId);
      if (!lut) {
        options.onStatus(options.t('lutEditor.status.notFound') as string, 'error');
        return;
      }
      const rampData = lut.ramp2dData ?? createDefaultColorRamp2dLutData(lut.name);
      syncLutEditorDialogState(rampData, lutId);
      openLutEditorDialog();
    },

    createNewLut: () => {
      const luts = options.getLuts();
      if (luts.length >= options.maxLuts) {
        options.onStatus(options.t('main.status.maxLutLimit', { max: options.maxLuts }) as string, 'error');
        return;
      }
      const name = options.t('lutEditor.newLutName') as string;
      const rampData = createDefaultColorRamp2dLutData(name);
      // null = 新規作成モード
      syncLutEditorDialogState(rampData, null);
      openLutEditorDialog();
    },
  };
}
