import type { MaterialSettings } from '../../../features/pipeline/pipeline-model.ts';
import type { PipelineStateSnapshot } from '../../../features/pipeline/pipeline-state.ts';
import type { AppTranslator } from '../../../shared/i18n/browser-translation-contract.ts';
import type {
  BlendOp,
  ChannelName,
  CustomParamModel,
  LutModel,
  StepModel,
} from '../../../features/step/step-model.ts';
import {
  mountLutStripList,
  mountParamNodeList,
  mountStepList,
} from '../components/pipeline-lists/index.tsx';
import {
  bindReorderDragHandlers,
  getLinearDropPlacement,
  type LinearDropCandidate,
  type LinearDropPlacement,
  type ReorderDragBinding,
} from '../interactions/dnd.ts';
import type { PipelinePresetKey } from './pipeline-presets.ts';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

interface CustomParamReorderDragState {
  paramId: string;
  overParamId: string | null;
  dropAfter: boolean;
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
      const candidates: LinearDropCandidate<string>[] = [];

      for (const item of Array.from(options.paramNodeListEl.querySelectorAll<HTMLElement>('[data-custom-param-item="true"]'))) {
        const paramId = item.dataset.paramId;
        if (!paramId || paramId === dragState?.paramId) {
          continue;
        }

        const rect = item.getBoundingClientRect();
        candidates.push({
          id: paramId,
          midpoint: rect.top + rect.height * 0.5,
        });
      }

      const placement: LinearDropPlacement<string> = getLinearDropPlacement(candidates, event.clientY);
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

  bindReorderDragHandlers(binding);
}

export function setupMainPipelineLists(options: SetupMainPipelineListsOptions): void {
  ensureOptions(options);

  mountParamNodeList(options.paramNodeListEl, {
    getMaterialSettings: options.getMaterialSettings,
    customParams: options.getCustomParams(),
    onAddCustomParam: options.onAddCustomParam,
    onRenameCustomParam: options.onRenameCustomParam,
    onSetCustomParamValue: options.onSetCustomParamValue,
    onCommitCustomParamValueChange: options.onCommitCustomParamValueChange,
    onRemoveCustomParam: options.onRemoveCustomParam,
    onStatus: options.onStatus,
  });

  setupCustomParamReorderBindings({
    paramNodeListEl: options.paramNodeListEl,
    onMoveCustomParam: options.onMoveCustomParam,
    onStatus: options.onStatus,
  });

  mountStepList(options.stepListEl, {
    steps: options.getSteps(),
    luts: options.getLuts(),
    customParams: options.getCustomParams(),
    onAddStep: options.onAddStep,
    onDuplicateStep: options.onDuplicateStep,
    onRemoveStep: options.onRemoveStep,
    onStepMuteChange: options.onStepMuteChange,
    onStepLabelChange: options.onStepLabelChange,
    onStepLutChange: options.onStepLutChange,
    onStepBlendModeChange: options.onStepBlendModeChange,
    onStepOpChange: options.onStepOpChange,
    shouldSuppressClick: options.shouldSuppressClick,
    onOpenPipelineFilePicker: options.onOpenPipelineFilePicker,
    onLoadExample: options.onLoadExample,
    onScheduleConnectionDraw: options.onScheduleConnectionDraw,
    computeLutUv: options.computeLutUv,
    onStatus: options.onStatus,
  });

  mountLutStripList(options.lutStripListEl, {
    luts: options.getLuts(),
    steps: options.getSteps(),
    onRemoveLut: options.onRemoveLut,
    onEditLut: options.onEditLut,
    onDuplicateLut: options.onDuplicateLut,
    onNewLut: options.onNewLut,
    onAddLutFiles: async files => {
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
    },
    onStatus: options.onStatus,
  });

  options.renderLutStrip();
}
