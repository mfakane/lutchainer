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
import { setupMainPipelineLists } from './main-pipeline-lists-setup.ts';
import type { PipelinePresetKey } from './pipeline-presets.ts';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

interface PipelineCommandsLike {
  addStep: (options?: { recordHistory?: boolean }) => void;
  duplicateStep: (stepId: string) => void;
  removeStep: (stepId: string) => void;
  setStepMuted: (stepId: string, muted: boolean) => void;
  setStepLabel: (stepId: string, label: string | null) => void;
  setStepLut: (stepId: string, lutId: string) => void;
  setStepBlendMode: (stepId: string, blendMode: StepModel['blendMode']) => void;
  setStepChannelOp: (stepId: string, channel: ChannelName, op: BlendOp) => void;
  removeLut: (lutId: string) => void;
  addCustomParam: () => void;
  renameCustomParam: (paramId: string, label: string) => void;
  setCustomParamValue: (paramId: string, value: number, options?: { recordHistory?: boolean }) => void;
  removeCustomParam: (paramId: string) => void;
  moveCustomParamToPosition: (paramId: string, targetParamId: string | null, after: boolean) => void;
}

interface PipelineHistoryActionsLike {
  captureSnapshot: () => PipelineStateSnapshot;
  commitSnapshot: (before: PipelineStateSnapshot) => boolean;
}

export interface SetupMainPipelineEditorOptions {
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
  pipelineCommands: PipelineCommandsLike;
  onEditLut?: (lutId: string) => void;
  onDuplicateLut?: (lutId: string) => void;
  onNewLut?: () => void;
  createLutFromFile: (file: File) => Promise<LutModel>;
  maxLuts: number;
  pipelineHistoryActions: PipelineHistoryActionsLike;
  normalizeSteps: () => void;
  renderSteps: () => void;
  scheduleApply: () => void;
  renderLutStrip: () => void;
  onStatus: StatusReporter;
  t: AppTranslator;
}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} must be a function.`);
  }
}

function ensureObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertPipelineCommandsLike(value: unknown): asserts value is PipelineCommandsLike {
  ensureObject(value, 'Main pipeline editor pipelineCommands');
  const commands = value as Partial<PipelineCommandsLike>;

  ensureFunction(commands.addStep, 'Main pipeline editor pipelineCommands.addStep');
  ensureFunction(commands.duplicateStep, 'Main pipeline editor pipelineCommands.duplicateStep');
  ensureFunction(commands.removeStep, 'Main pipeline editor pipelineCommands.removeStep');
  ensureFunction(commands.setStepMuted, 'Main pipeline editor pipelineCommands.setStepMuted');
  ensureFunction(commands.setStepLabel, 'Main pipeline editor pipelineCommands.setStepLabel');
  ensureFunction(commands.setStepLut, 'Main pipeline editor pipelineCommands.setStepLut');
  ensureFunction(commands.setStepBlendMode, 'Main pipeline editor pipelineCommands.setStepBlendMode');
  ensureFunction(commands.setStepChannelOp, 'Main pipeline editor pipelineCommands.setStepChannelOp');
  ensureFunction(commands.removeLut, 'Main pipeline editor pipelineCommands.removeLut');
  ensureFunction(commands.addCustomParam, 'Main pipeline editor pipelineCommands.addCustomParam');
  ensureFunction(commands.renameCustomParam, 'Main pipeline editor pipelineCommands.renameCustomParam');
  ensureFunction(commands.setCustomParamValue, 'Main pipeline editor pipelineCommands.setCustomParamValue');
  ensureFunction(commands.removeCustomParam, 'Main pipeline editor pipelineCommands.removeCustomParam');
  ensureFunction(commands.moveCustomParamToPosition, 'Main pipeline editor pipelineCommands.moveCustomParamToPosition');
}

function assertPipelineHistoryActionsLike(value: unknown): asserts value is PipelineHistoryActionsLike {
  ensureObject(value, 'Main pipeline editor pipelineHistoryActions');
  const historyActions = value as Partial<PipelineHistoryActionsLike>;

  ensureFunction(historyActions.captureSnapshot, 'Main pipeline editor pipelineHistoryActions.captureSnapshot');
  ensureFunction(historyActions.commitSnapshot, 'Main pipeline editor pipelineHistoryActions.commitSnapshot');
}

function assertSetupMainPipelineEditorOptions(options: SetupMainPipelineEditorOptions): void {
  ensureObject(options, 'Main pipeline editor options');

  if (!(options.paramNodeListEl instanceof HTMLElement)) {
    throw new Error('Main pipeline editor paramNodeListEl must be an HTMLElement.');
  }
  if (!(options.stepListEl instanceof HTMLElement)) {
    throw new Error('Main pipeline editor stepListEl must be an HTMLElement.');
  }
  if (!(options.lutStripListEl instanceof HTMLElement)) {
    throw new Error('Main pipeline editor lutStripListEl must be an HTMLElement.');
  }

  ensureFunction(options.getSteps, 'Main pipeline editor getSteps');
  ensureFunction(options.getLuts, 'Main pipeline editor getLuts');
  ensureFunction(options.getCustomParams, 'Main pipeline editor getCustomParams');
  ensureFunction(options.getMaterialSettings, 'Main pipeline editor getMaterialSettings');
  ensureFunction(options.shouldSuppressClick, 'Main pipeline editor shouldSuppressClick');
  ensureFunction(options.onOpenPipelineFilePicker, 'Main pipeline editor onOpenPipelineFilePicker');
  ensureFunction(options.onLoadExample, 'Main pipeline editor onLoadExample');
  assertPipelineCommandsLike(options.pipelineCommands);
  ensureFunction(options.createLutFromFile, 'Main pipeline editor createLutFromFile');

  if (!Number.isInteger(options.maxLuts) || options.maxLuts <= 0) {
    throw new Error(`Main pipeline editor maxLuts must be a positive integer: ${String(options.maxLuts)}`);
  }

  assertPipelineHistoryActionsLike(options.pipelineHistoryActions);
  ensureFunction(options.normalizeSteps, 'Main pipeline editor normalizeSteps');
  ensureFunction(options.renderSteps, 'Main pipeline editor renderSteps');
  ensureFunction(options.scheduleApply, 'Main pipeline editor scheduleApply');
  ensureFunction(options.renderLutStrip, 'Main pipeline editor renderLutStrip');
  ensureFunction(options.onStatus, 'Main pipeline editor onStatus');
  ensureFunction(options.t, 'Main pipeline editor t');
}

export function setupMainPipelineEditor(options: SetupMainPipelineEditorOptions): void {
  assertSetupMainPipelineEditorOptions(options);
  let pendingCustomParamValueSnapshot: PipelineStateSnapshot | null = null;

  setupMainPipelineLists({
    paramNodeListEl: options.paramNodeListEl,
    stepListEl: options.stepListEl,
    lutStripListEl: options.lutStripListEl,
    getSteps: options.getSteps,
    getLuts: options.getLuts,
    getCustomParams: options.getCustomParams,
    getMaterialSettings: options.getMaterialSettings,
    shouldSuppressClick: options.shouldSuppressClick,
    onOpenPipelineFilePicker: options.onOpenPipelineFilePicker,
    onLoadExample: options.onLoadExample,
    onScheduleConnectionDraw: options.onScheduleConnectionDraw,
    computeLutUv: options.computeLutUv,
    onAddStep: () => {
      options.pipelineCommands.addStep();
    },
    onDuplicateStep: stepId => {
      options.pipelineCommands.duplicateStep(stepId);
    },
    onRemoveStep: stepId => {
      options.pipelineCommands.removeStep(stepId);
    },
    onStepMuteChange: (stepId, muted) => {
      options.pipelineCommands.setStepMuted(stepId, muted);
    },
    onStepLabelChange: (stepId, label) => {
      options.pipelineCommands.setStepLabel(stepId, label);
    },
    onStepLutChange: (stepId, lutId) => {
      options.pipelineCommands.setStepLut(stepId, lutId);
    },
    onStepBlendModeChange: (stepId, blendMode) => {
      options.pipelineCommands.setStepBlendMode(stepId, blendMode);
    },
    onStepOpChange: (stepId, channel, op) => {
      options.pipelineCommands.setStepChannelOp(stepId, channel, op);
    },
    onRemoveLut: lutId => {
      options.pipelineCommands.removeLut(lutId);
    },
    onAddCustomParam: () => {
      options.pipelineCommands.addCustomParam();
    },
    onRenameCustomParam: (paramId, label) => {
      options.pipelineCommands.renameCustomParam(paramId, label);
    },
    onSetCustomParamValue: (paramId, value, setValueOptions) => {
      if (setValueOptions?.recordHistory === false && pendingCustomParamValueSnapshot === null) {
        pendingCustomParamValueSnapshot = options.pipelineHistoryActions.captureSnapshot();
      }
      options.pipelineCommands.setCustomParamValue(paramId, value, setValueOptions);
    },
    onCommitCustomParamValueChange: () => {
      if (pendingCustomParamValueSnapshot === null) {
        return;
      }

      options.pipelineHistoryActions.commitSnapshot(pendingCustomParamValueSnapshot);
      pendingCustomParamValueSnapshot = null;
    },
    onRemoveCustomParam: paramId => {
      options.pipelineCommands.removeCustomParam(paramId);
    },
    onMoveCustomParam: (paramId, targetParamId, after) => {
      options.pipelineCommands.moveCustomParamToPosition(paramId, targetParamId, after);
    },
    onEditLut: options.onEditLut,
    onDuplicateLut: options.onDuplicateLut,
    onNewLut: options.onNewLut,
    createLutFromFile: options.createLutFromFile,
    maxLuts: options.maxLuts,
    captureHistorySnapshot: () => options.pipelineHistoryActions.captureSnapshot(),
    commitHistorySnapshot: before => options.pipelineHistoryActions.commitSnapshot(before),
    normalizeSteps: options.normalizeSteps,
    renderSteps: options.renderSteps,
    scheduleApply: options.scheduleApply,
    renderLutStrip: options.renderLutStrip,
    onStatus: options.onStatus,
    t: options.t,
  });
}
