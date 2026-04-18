import type { MaterialSettings } from '../../../features/pipeline/pipeline-model.ts';
import type { PipelineStateSnapshot } from '../../../features/pipeline/pipeline-state.ts';
import type {
    BlendOp,
    ChannelName,
    CustomParamModel,
    LutModel,
    StepModel,
} from '../../../features/step/step-model.ts';
import type { AppTranslator } from '../../../shared/i18n/browser-translation-contract.ts';
import { cloneMaterialSettings } from '../components/panels/shared.ts';
import {
  cloneCustomParamArray,
  cloneLutArray,
  cloneStepArray,
} from '../components/pipeline-lists/shared.ts';
import {
    bindReorderDragHandlers,
    type DndBindingDisposer,
    type ReorderDragBinding,
} from '../interactions/dnd.ts';
import { getReorderPlacementFromElements } from '../interactions/reorder-list.ts';
import type { PipelinePresetKey } from './pipeline-presets.ts';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

interface CustomParamReorderDragState {
  paramId: string;
  overParamId: string | null;
  dropAfter: boolean;
}

let disposeCustomParamReorderBindings: DndBindingDisposer | null = null;

export interface MainPipelineListsController {
  addLutFiles: (files: File[]) => Promise<void>;
  syncParamNodeListState: (customParams: CustomParamModel[]) => void;
  syncParamNodeMaterialSettings: (materialSettings: MaterialSettings) => void;
  syncStepListState: (steps: StepModel[], luts: LutModel[], customParams: CustomParamModel[]) => void;
  syncLutStripListState: (luts: LutModel[], steps: StepModel[]) => void;
}

interface ParamNodeListElement extends HTMLElement {
  materialSettings: MaterialSettings;
  customParams: CustomParamModel[];
}

interface StepListElement extends HTMLElement {
  steps: StepModel[];
  luts: LutModel[];
  customParams: CustomParamModel[];
  preservedScrollTop: number;
  preservedScrollLeft: number;
  restoreNonce: number;
  computeLutUv?: SetupMainPipelineListsOptions['computeLutUv'];
}

interface LutStripListElement extends HTMLElement {
  luts: LutModel[];
  steps: StepModel[];
  canEditLut: boolean;
  canDuplicateLut: boolean;
  canCreateNewLut: boolean;
}

function readCustomEventDetail<Detail>(event: Event): Detail {
  return (event as CustomEvent<Detail>).detail;
}

export interface SetupMainPipelineListsOptions {
  paramNodeListEl: HTMLElement;
  stepListEl: HTMLElement;
  lutStripListEl: HTMLElement;
  getSteps: () => StepModel[];
  getLuts: () => LutModel[];
  getCustomParams: () => CustomParamModel[];
  getMaterialSettings: () => MaterialSettings;
  shouldSuppressClick: () => boolean;
  onOpenPipelineFilePicker: () => void;
  onLoadExample: (example: PipelinePresetKey) => void | Promise<void>;
  onScheduleConnectionDraw: () => void;
  computeLutUv?: (stepIndex: number, pixelX: number, pixelY: number, canvasWidth: number, canvasHeight: number) => { u: number; v: number } | null;
  onAddStep: () => void;
  onDuplicateStep: (stepId: string) => void;
  onRemoveStep: (stepId: string) => void;
  onStepMuteChange: (stepId: string, muted: boolean) => void;
  onStepLabelChange: (stepId: string, label: string | null) => void;
  onStepLutChange: (stepId: string, lutId: string) => void;
  onStepBlendModeChange: (stepId: string, blendMode: StepModel['blendMode']) => void;
  onStepOpChange: (stepId: string, channel: ChannelName, op: BlendOp) => void;
  onAddCustomParam: () => void;
  onRenameCustomParam: (paramId: string, label: string) => void;
  onSetCustomParamValue: (paramId: string, value: number, options?: { recordHistory?: boolean }) => void;
  onCommitCustomParamValueChange: () => void;
  onRemoveCustomParam: (paramId: string) => void;
  onMoveCustomParam: (paramId: string, targetParamId: string | null, after: boolean) => void;
  onRemoveLut: (lutId: string) => void;
  onEditLut?: (lutId: string) => void;
  onDuplicateLut?: (lutId: string) => void;
  onNewLut?: () => void;
  createLutFromFile: (file: File) => Promise<LutModel>;
  maxLuts: number;
  captureHistorySnapshot: () => PipelineStateSnapshot;
  commitHistorySnapshot: (before: PipelineStateSnapshot) => boolean;
  normalizeSteps: () => void;
  renderSteps: () => void;
  scheduleApply: () => void;
  renderLutStrip: () => void;
  onStatus: StatusReporter;
  t: AppTranslator;
}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} が不正です。`);
  }
}

function ensureOptions(value: unknown): asserts value is SetupMainPipelineListsOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Main pipeline lists setup options が不正です。');
  }

  const options = value as Partial<SetupMainPipelineListsOptions>;
  if (!(options.paramNodeListEl instanceof HTMLElement)) {
    throw new Error('Main pipeline lists setup: paramNodeListEl が不正です。');
  }
  if (!(options.stepListEl instanceof HTMLElement)) {
    throw new Error('Main pipeline lists setup: stepListEl が不正です。');
  }
  if (!(options.lutStripListEl instanceof HTMLElement)) {
    throw new Error('Main pipeline lists setup: lutStripListEl が不正です。');
  }

  ensureFunction(options.getSteps, 'Main pipeline lists setup: getSteps');
  ensureFunction(options.getLuts, 'Main pipeline lists setup: getLuts');
  ensureFunction(options.getCustomParams, 'Main pipeline lists setup: getCustomParams');
  ensureFunction(options.getMaterialSettings, 'Main pipeline lists setup: getMaterialSettings');
  ensureFunction(options.shouldSuppressClick, 'Main pipeline lists setup: shouldSuppressClick');
  ensureFunction(options.onOpenPipelineFilePicker, 'Main pipeline lists setup: onOpenPipelineFilePicker');
  ensureFunction(options.onLoadExample, 'Main pipeline lists setup: onLoadExample');
  ensureFunction(options.onAddStep, 'Main pipeline lists setup: onAddStep');
  ensureFunction(options.onDuplicateStep, 'Main pipeline lists setup: onDuplicateStep');
  ensureFunction(options.onRemoveStep, 'Main pipeline lists setup: onRemoveStep');
  ensureFunction(options.onStepMuteChange, 'Main pipeline lists setup: onStepMuteChange');
  ensureFunction(options.onStepLabelChange, 'Main pipeline lists setup: onStepLabelChange');
  ensureFunction(options.onStepLutChange, 'Main pipeline lists setup: onStepLutChange');
  ensureFunction(options.onStepBlendModeChange, 'Main pipeline lists setup: onStepBlendModeChange');
  ensureFunction(options.onStepOpChange, 'Main pipeline lists setup: onStepOpChange');
  ensureFunction(options.onAddCustomParam, 'Main pipeline lists setup: onAddCustomParam');
  ensureFunction(options.onRenameCustomParam, 'Main pipeline lists setup: onRenameCustomParam');
  ensureFunction(options.onSetCustomParamValue, 'Main pipeline lists setup: onSetCustomParamValue');
  ensureFunction(options.onCommitCustomParamValueChange, 'Main pipeline lists setup: onCommitCustomParamValueChange');
  ensureFunction(options.onRemoveCustomParam, 'Main pipeline lists setup: onRemoveCustomParam');
  ensureFunction(options.onMoveCustomParam, 'Main pipeline lists setup: onMoveCustomParam');
  ensureFunction(options.onRemoveLut, 'Main pipeline lists setup: onRemoveLut');
  ensureFunction(options.createLutFromFile, 'Main pipeline lists setup: createLutFromFile');

  if (!Number.isInteger(options.maxLuts) || (options.maxLuts ?? 0) <= 0) {
    throw new Error(`Main pipeline lists setup: maxLuts が不正です: ${String(options.maxLuts)}`);
  }

  ensureFunction(options.captureHistorySnapshot, 'Main pipeline lists setup: captureHistorySnapshot');
  ensureFunction(options.commitHistorySnapshot, 'Main pipeline lists setup: commitHistorySnapshot');
  ensureFunction(options.normalizeSteps, 'Main pipeline lists setup: normalizeSteps');
  ensureFunction(options.renderSteps, 'Main pipeline lists setup: renderSteps');
  ensureFunction(options.scheduleApply, 'Main pipeline lists setup: scheduleApply');
  ensureFunction(options.renderLutStrip, 'Main pipeline lists setup: renderLutStrip');
  ensureFunction(options.onStatus, 'Main pipeline lists setup: onStatus');
  ensureFunction(options.t, 'Main pipeline lists setup: t');
}

function updateCustomParamDropIndicators(
  paramNodeListEl: HTMLElement,
  dragState: CustomParamReorderDragState | null,
): void {
  const items = Array.from(paramNodeListEl.querySelectorAll<HTMLElement>('[data-custom-param-item="true"]'));
  for (const item of items) {
    delete item.dataset.dragging;
    delete item.dataset.dropPosition;
  }

  if (!dragState) {
    return;
  }

  for (const item of items) {
    const itemParamId = item.dataset.paramId;
    if (!itemParamId) {
      continue;
    }
    if (itemParamId === dragState.paramId) {
      item.dataset.dragging = 'true';
    }
    if (itemParamId === dragState.overParamId) {
      item.dataset.dropPosition = dragState.dropAfter ? 'after' : 'before';
    }
  }
}

function clearCustomParamDropIndicators(paramNodeListEl: HTMLElement): void {
  updateCustomParamDropIndicators(paramNodeListEl, null);
}

function setupCustomParamReorderBindings(options: {
  paramNodeListEl: HTMLElement;
  onMoveCustomParam: (paramId: string, targetParamId: string | null, after: boolean) => void;
  onStatus: StatusReporter;
}): void {
  disposeCustomParamReorderBindings?.();

  let customParamReorderDragState: CustomParamReorderDragState | null = null;

  const binding: ReorderDragBinding<string, CustomParamReorderDragState> = {
    containerEl: options.paramNodeListEl,
    resolveDragStart: eventTarget => {
      const handle = eventTarget.closest<HTMLButtonElement>('[data-custom-param-handle="true"]');
      if (!handle) {
        return { kind: 'ignore' };
      }

      const item = handle.closest<HTMLElement>('[data-custom-param-item="true"]');
      const paramId = item?.dataset.paramId;
      if (!paramId) {
        return { kind: 'invalid', message: 'Custom param ID is invalid.' };
      }

      return { kind: 'ready', id: paramId };
    },
    createDragState: paramId => ({ paramId, overParamId: paramId, dropAfter: true }),
    getDragState: () => customParamReorderDragState,
    setDragState: state => {
      customParamReorderDragState = state;
    },
    clearDragState: () => {
      customParamReorderDragState = null;
    },
    getPlacement: event => {
      const dragState = customParamReorderDragState;
      const placement = getReorderPlacementFromElements({
        elements: Array.from(options.paramNodeListEl.querySelectorAll<HTMLElement>('[data-custom-param-item="true"]')),
        getElementItemId: element => element.dataset.paramId ?? null,
        excludeId: dragState?.paramId ?? null,
        axis: 'vertical',
        pointerCoord: event.clientY,
      });
      return { targetId: placement.targetId, after: placement.after };
    },
    applyPlacement: (dragState, placement) => ({
      ...dragState,
      overParamId: placement.targetId,
      dropAfter: placement.after,
    }),
    getDraggedId: dragState => dragState.paramId,
    getTargetId: dragState => dragState.overParamId,
    updateIndicators: () => {
      updateCustomParamDropIndicators(options.paramNodeListEl, customParamReorderDragState);
    },
    clearIndicators: () => {
      clearCustomParamDropIndicators(options.paramNodeListEl);
    },
    commitMove: options.onMoveCustomParam,
    onInvalid: message => options.onStatus(message, 'error'),
  };

  disposeCustomParamReorderBindings = bindReorderDragHandlers(binding);
}

export function setupMainPipelineLists(options: SetupMainPipelineListsOptions): MainPipelineListsController {
  ensureOptions(options);
  const paramNodeListEl = options.paramNodeListEl as ParamNodeListElement;
  const stepListEl = options.stepListEl as StepListElement;
  const lutStripListEl = options.lutStripListEl as LutStripListElement;

  const addLutFiles = async (files: File[]): Promise<void> => {
    if (!Array.isArray(files) || files.some(file => !(file instanceof File))) {
      options.onStatus(options.t('main.status.invalidLutAddInput'), 'error');
      return;
    }

    const luts = options.getLuts();
    const room = Math.max(0, options.maxLuts - luts.length);
    if (room === 0) {
      options.onStatus(options.t('main.status.maxLutLimit', { max: options.maxLuts }), 'error');
      return;
    }

    const selected = files.slice(0, room);
    const errors: string[] = [];
    let added = 0;
    const before = options.captureHistorySnapshot();

    for (const file of selected) {
      try {
        const lut = await options.createLutFromFile(file);
        luts.push(lut);
        added += 1;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : `${options.t('common.unknownError')}: ${file.name}`);
      }
    }

    options.normalizeSteps();
    options.commitHistorySnapshot(before);
    options.renderSteps();
    options.scheduleApply();

    if (errors.length > 0) {
      options.onStatus(errors.join('\n'), 'error');
    } else {
      options.onStatus(options.t('main.status.lutAdded', { count: added }), 'success');
    }
  };

  const syncParamNodeListState = (customParams: CustomParamModel[]): void => {
    paramNodeListEl.customParams = cloneCustomParamArray(customParams);
  };

  const syncParamNodeMaterialSettings = (materialSettings: MaterialSettings): void => {
    paramNodeListEl.materialSettings = cloneMaterialSettings(materialSettings);
  };

  let preservedScrollTop = 0;
  let preservedScrollLeft = 0;
  let restoreNonce = 0;
  let hasPendingMutationSnapshot = false;
  let deferredZeroCaptureTimer: number | null = null;

  const getStepListScrollRoot = (): HTMLElement | null => {
    return stepListEl.querySelector<HTMLElement>('.step-root');
  };

  const captureStepListScrollSnapshot = (): { top: number; left: number } => {
    const scrollRoot = getStepListScrollRoot();
    if (!(scrollRoot instanceof HTMLElement)) {
      return { top: 0, left: 0 };
    }

    return {
      top: scrollRoot.scrollTop,
      left: scrollRoot.scrollLeft,
    };
  };

  const syncPreservedScroll = (top: number, left: number): void => {
    preservedScrollTop = top;
    preservedScrollLeft = left;
  };

  const clearDeferredZeroCapture = (): void => {
    if (deferredZeroCaptureTimer === null) {
      return;
    }
    window.clearTimeout(deferredZeroCaptureTimer);
    deferredZeroCaptureTimer = null;
  };

  const captureBeforeMutation = (): void => {
    clearDeferredZeroCapture();
    if (preservedScrollTop === 0 && preservedScrollLeft === 0) {
      const snapshot = captureStepListScrollSnapshot();
      syncPreservedScroll(snapshot.top, snapshot.left);
    }
    hasPendingMutationSnapshot = true;
  };

  const shouldIgnoreClick = (): boolean => {
    try {
      return options.shouldSuppressClick();
    } catch {
      options.onStatus(options.t('pipeline.status.suppressClickFailed'), 'error');
      return false;
    }
  };

  const withStepMutation = (callback: () => void): void => {
    if (shouldIgnoreClick()) {
      return;
    }
    captureBeforeMutation();
    callback();
  };

  const syncStepListState = (steps: StepModel[], luts: LutModel[], customParams: CustomParamModel[]): void => {
    if (!hasPendingMutationSnapshot) {
      const snapshot = captureStepListScrollSnapshot();
      syncPreservedScroll(snapshot.top, snapshot.left);
    }
    clearDeferredZeroCapture();
    restoreNonce += 1;
    stepListEl.preservedScrollTop = preservedScrollTop;
    stepListEl.preservedScrollLeft = preservedScrollLeft;
    stepListEl.restoreNonce = restoreNonce;
    stepListEl.steps = cloneStepArray(steps);
    stepListEl.luts = cloneLutArray(luts);
    stepListEl.customParams = cloneCustomParamArray(customParams);
    hasPendingMutationSnapshot = false;
  };

  const syncLutStripListState = (luts: LutModel[], steps: StepModel[]): void => {
    lutStripListEl.luts = cloneLutArray(luts);
    lutStripListEl.steps = cloneStepArray(steps);
  };

  syncParamNodeMaterialSettings(options.getMaterialSettings());
  syncParamNodeListState(options.getCustomParams());
  stepListEl.computeLutUv = options.computeLutUv;
  syncStepListState(options.getSteps(), options.getLuts(), options.getCustomParams());
  lutStripListEl.canEditLut = typeof options.onEditLut === 'function';
  lutStripListEl.canDuplicateLut = typeof options.onDuplicateLut === 'function';
  lutStripListEl.canCreateNewLut = typeof options.onNewLut === 'function';
  syncLutStripListState(options.getLuts(), options.getSteps());

  paramNodeListEl.addEventListener('add-custom-param', () => {
    options.onAddCustomParam();
  });
  paramNodeListEl.addEventListener('rename-custom-param', event => {
    const detail = readCustomEventDetail<{ paramId: string; label: string }>(event);
    options.onRenameCustomParam(detail.paramId, detail.label);
  });
  paramNodeListEl.addEventListener('set-custom-param-value', event => {
    const detail = readCustomEventDetail<{ paramId: string; value: number; recordHistory?: boolean }>(event);
    options.onSetCustomParamValue(detail.paramId, detail.value, {
      recordHistory: detail.recordHistory,
    });
  });
  paramNodeListEl.addEventListener('commit-custom-param-value-change', () => {
    options.onCommitCustomParamValueChange();
  });
  paramNodeListEl.addEventListener('remove-custom-param', event => {
    const detail = readCustomEventDetail<{ paramId: string }>(event);
    options.onRemoveCustomParam(detail.paramId);
  });
  paramNodeListEl.addEventListener('status-message', event => {
    const detail = readCustomEventDetail<{ message: string; kind?: StatusKind }>(event);
    options.onStatus(detail.message, detail.kind);
  });

  setupCustomParamReorderBindings({
    paramNodeListEl: options.paramNodeListEl,
    onMoveCustomParam: options.onMoveCustomParam,
    onStatus: options.onStatus,
  });

  stepListEl.addEventListener('add-step', () => {
    withStepMutation(() => options.onAddStep());
  });
  stepListEl.addEventListener('duplicate-step', event => {
    const detail = readCustomEventDetail<{ stepId: string }>(event);
    withStepMutation(() => options.onDuplicateStep(detail.stepId));
  });
  stepListEl.addEventListener('remove-step', event => {
    const detail = readCustomEventDetail<{ stepId: string }>(event);
    withStepMutation(() => options.onRemoveStep(detail.stepId));
  });
  stepListEl.addEventListener('step-mute-change', event => {
    const detail = readCustomEventDetail<{ stepId: string; muted: boolean }>(event);
    withStepMutation(() => options.onStepMuteChange(detail.stepId, detail.muted));
  });
  stepListEl.addEventListener('step-label-change', event => {
    const detail = readCustomEventDetail<{ stepId: string; label: string | null }>(event);
    withStepMutation(() => options.onStepLabelChange(detail.stepId, detail.label));
  });
  stepListEl.addEventListener('step-lut-change', event => {
    const detail = readCustomEventDetail<{ stepId: string; lutId: string }>(event);
    withStepMutation(() => options.onStepLutChange(detail.stepId, detail.lutId));
  });
  stepListEl.addEventListener('step-blend-mode-change', event => {
    const detail = readCustomEventDetail<{ stepId: string; blendMode: StepModel['blendMode'] }>(event);
    withStepMutation(() => options.onStepBlendModeChange(detail.stepId, detail.blendMode));
  });
  stepListEl.addEventListener('step-op-change', event => {
    const detail = readCustomEventDetail<{ stepId: string; channel: ChannelName; op: BlendOp }>(event);
    withStepMutation(() => options.onStepOpChange(detail.stepId, detail.channel, detail.op));
  });
  stepListEl.addEventListener('open-pipeline-file-picker', () => {
    if (shouldIgnoreClick()) {
      return;
    }
    options.onOpenPipelineFilePicker();
  });
  stepListEl.addEventListener('load-example', event => {
    if (shouldIgnoreClick()) {
      return;
    }
    const detail = readCustomEventDetail<{ example: PipelinePresetKey }>(event);
    void options.onLoadExample(detail.example);
  });
  stepListEl.addEventListener('schedule-connection-draw', () => {
    if (!hasPendingMutationSnapshot) {
      const snapshot = captureStepListScrollSnapshot();
      const shouldDeferZeroCapture = (snapshot.top === 0 && preservedScrollTop > 0)
        || (snapshot.left === 0 && preservedScrollLeft > 0);
      if (shouldDeferZeroCapture) {
        clearDeferredZeroCapture();
        deferredZeroCaptureTimer = window.setTimeout(() => {
          deferredZeroCaptureTimer = null;
          if (hasPendingMutationSnapshot) {
            return;
          }
          syncPreservedScroll(snapshot.top, snapshot.left);
        }, 120);
      } else {
        clearDeferredZeroCapture();
        syncPreservedScroll(snapshot.top, snapshot.left);
      }
    }
    options.onScheduleConnectionDraw();
  });
  stepListEl.addEventListener('status-message', event => {
    const detail = readCustomEventDetail<{ message: string; kind?: StatusKind }>(event);
    options.onStatus(detail.message, detail.kind);
  });

  lutStripListEl.addEventListener('remove-lut', event => {
    const detail = readCustomEventDetail<{ lutId: string }>(event);
    options.onRemoveLut(detail.lutId);
  });
  lutStripListEl.addEventListener('add-lut-files', event => {
    const detail = readCustomEventDetail<{ files: File[] }>(event);
    void addLutFiles(detail.files);
  });
  lutStripListEl.addEventListener('edit-lut', event => {
    const detail = readCustomEventDetail<{ lutId: string }>(event);
    options.onEditLut?.(detail.lutId);
  });
  lutStripListEl.addEventListener('duplicate-lut', event => {
    const detail = readCustomEventDetail<{ lutId: string }>(event);
    options.onDuplicateLut?.(detail.lutId);
  });
  lutStripListEl.addEventListener('new-lut', () => {
    options.onNewLut?.();
  });
  lutStripListEl.addEventListener('status-message', event => {
    const detail = readCustomEventDetail<{ message: string; kind?: StatusKind }>(event);
    options.onStatus(detail.message, detail.kind);
  });

  options.renderLutStrip();

  return {
    addLutFiles,
    syncParamNodeListState,
    syncParamNodeMaterialSettings,
    syncStepListState,
    syncLutStripListState,
  };
}
