import type { PipelineStateSnapshot } from '../../features/pipeline/pipeline-state.ts';
import type {
  BlendOp,
  ChannelName,
  LutModel,
  StepModel,
} from '../../features/step/step-model.ts';
import { setupMainPipelineLists } from './main-pipeline-lists-setup.ts';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;
type Translator = (key: unknown, values?: Record<string, string | number>) => string;

interface PipelineCommandsLike {
  addStep: (options?: { recordHistory?: boolean }) => void;
  duplicateStep: (stepId: number) => void;
  removeStep: (stepId: number) => void;
  setStepMuted: (stepId: number, muted: boolean) => void;
  setStepLabel: (stepId: number, label: string | null) => void;
  setStepLut: (stepId: number, lutId: string) => void;
  setStepBlendMode: (stepId: number, blendMode: StepModel['blendMode']) => void;
  setStepChannelOp: (stepId: number, channel: ChannelName, op: BlendOp) => void;
  removeLut: (lutId: string) => void;
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
  shouldSuppressClick: () => boolean;
  computeLutUv?: (stepIndex: number, pixelX: number, pixelY: number, canvasWidth: number, canvasHeight: number) => { u: number; v: number } | null;
  pipelineCommands: PipelineCommandsLike;
  createLutFromFile: (file: File) => Promise<LutModel>;
  maxLuts: number;
  pipelineHistoryActions: PipelineHistoryActionsLike;
  normalizeSteps: () => void;
  renderSteps: () => void;
  scheduleApply: () => void;
  renderLutStrip: () => void;
  onStatus: StatusReporter;
  t: Translator;
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
  ensureFunction(options.shouldSuppressClick, 'Main pipeline editor shouldSuppressClick');
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

  setupMainPipelineLists({
    paramNodeListEl: options.paramNodeListEl,
    stepListEl: options.stepListEl,
    lutStripListEl: options.lutStripListEl,
    getSteps: options.getSteps,
    getLuts: options.getLuts,
    shouldSuppressClick: options.shouldSuppressClick,
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
