import type { PipelineStateSnapshot } from '../../features/pipeline/pipeline-state.ts';
import type {
  BlendOp,
  ChannelName,
  LutModel,
  StepModel,
} from '../../features/step/step-model.ts';
import {
  mountLutStripList,
  mountParamNodeList,
  mountStepList,
} from '../components/solid-pipeline-lists.tsx';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;
type Translator = (key: unknown, values?: Record<string, string | number>) => string;

export interface SetupMainPipelineListsOptions {
  paramNodeListEl: HTMLElement;
  stepListEl: HTMLElement;
  lutStripListEl: HTMLElement;
  getSteps: () => StepModel[];
  getLuts: () => LutModel[];
  shouldSuppressClick: () => boolean;
  computeLutUv?: (stepIndex: number, pixelX: number, pixelY: number, canvasWidth: number, canvasHeight: number) => { u: number; v: number } | null;
  onAddStep: () => void;
  onDuplicateStep: (stepId: number) => void;
  onRemoveStep: (stepId: number) => void;
  onStepMuteChange: (stepId: number, muted: boolean) => void;
  onStepLabelChange: (stepId: number, label: string | null) => void;
  onStepLutChange: (stepId: number, lutId: string) => void;
  onStepBlendModeChange: (stepId: number, blendMode: StepModel['blendMode']) => void;
  onStepOpChange: (stepId: number, channel: ChannelName, op: BlendOp) => void;
  onRemoveLut: (lutId: string) => void;
  createLutFromFile: (file: File) => Promise<LutModel>;
  maxLuts: number;
  captureHistorySnapshot: () => PipelineStateSnapshot;
  commitHistorySnapshot: (before: PipelineStateSnapshot) => boolean;
  normalizeSteps: () => void;
  renderSteps: () => void;
  scheduleApply: () => void;
  renderLutStrip: () => void;
  onStatus: StatusReporter;
  t: Translator;
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
  ensureFunction(options.shouldSuppressClick, 'Main pipeline lists setup: shouldSuppressClick');
  ensureFunction(options.onAddStep, 'Main pipeline lists setup: onAddStep');
  ensureFunction(options.onDuplicateStep, 'Main pipeline lists setup: onDuplicateStep');
  ensureFunction(options.onRemoveStep, 'Main pipeline lists setup: onRemoveStep');
  ensureFunction(options.onStepMuteChange, 'Main pipeline lists setup: onStepMuteChange');
  ensureFunction(options.onStepLabelChange, 'Main pipeline lists setup: onStepLabelChange');
  ensureFunction(options.onStepLutChange, 'Main pipeline lists setup: onStepLutChange');
  ensureFunction(options.onStepBlendModeChange, 'Main pipeline lists setup: onStepBlendModeChange');
  ensureFunction(options.onStepOpChange, 'Main pipeline lists setup: onStepOpChange');
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

export function setupMainPipelineLists(options: SetupMainPipelineListsOptions): void {
  ensureOptions(options);

  mountParamNodeList(options.paramNodeListEl, {
    onStatus: options.onStatus,
  });

  mountStepList(options.stepListEl, {
    steps: options.getSteps(),
    luts: options.getLuts(),
    onAddStep: options.onAddStep,
    onDuplicateStep: options.onDuplicateStep,
    onRemoveStep: options.onRemoveStep,
    onStepMuteChange: options.onStepMuteChange,
    onStepLabelChange: options.onStepLabelChange,
    onStepLutChange: options.onStepLutChange,
    onStepBlendModeChange: options.onStepBlendModeChange,
    onStepOpChange: options.onStepOpChange,
    shouldSuppressClick: options.shouldSuppressClick,
    computeLutUv: options.computeLutUv,
    onStatus: options.onStatus,
  });

  mountLutStripList(options.lutStripListEl, {
    luts: options.getLuts(),
    steps: options.getSteps(),
    onRemoveLut: options.onRemoveLut,
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
