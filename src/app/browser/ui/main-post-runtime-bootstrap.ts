import { MAX_LUTS } from '../../../features/pipeline/pipeline-constants.ts';
import type {
  PipelineHistoryActionsController,
} from '../../../features/pipeline/pipeline-history-actions.ts';
import * as pipelineModel from '../../../features/pipeline/pipeline-model.ts';
import {
  getCustomParams as getPipelineCustomParams,
  getLuts as getPipelineLuts,
  getSteps as getPipelineSteps,
  replacePipelineState,
  setLuts as setPipelineLuts,
} from '../../../features/pipeline/pipeline-state.ts';
import * as pipelineView from '../../../features/pipeline/pipeline-view.ts';
import {
  resolveLutUvAtPixel,
} from '../../../features/step/step-lut-uv-resolver.ts';
import type {
  BlendOp,
  ChannelName,
  LutModel,
  StepModel,
} from '../../../features/step/step-model.ts';
import type {
  CameraOrbitState,
} from '../interactions/layout-interactions.ts';
import {
  type PipelineApplyController,
} from '../pipeline/pipeline-apply.ts';
import type {
  PipelineDropIndicatorController,
} from '../pipeline/pipeline-drop-indicators.ts';
import type {
  PipelineHeaderActionController,
} from '../pipeline/pipeline-header-actions-controller.ts';
import type {
  PipelineSocketDndController,
} from '../pipeline/pipeline-socket-dnd-controller.ts';
import type {
  MainStepRenderingController,
} from '../step/main-step-rendering-controller.ts';
import {
  clearLutReorderDragState,
  clearStepReorderDragState,
  getLutReorderDragState,
  getStepReorderDragState,
  getSuppressClickUntil,
  setLutReorderDragState,
  setSocketDragState,
  setStepReorderDragState,
} from './interaction-state.ts';
import {
  setupMainLayoutControls,
} from './main-layout-controls-setup.ts';
import {
  setupMainLutEditorDialog,
} from './main-lut-editor-dialog-setup.ts';
import {
  setupMainPipelineEditor,
} from './main-pipeline-editor-setup.ts';
import type {
  MainPreviewCaptureController,
} from './main-preview-capture-controller.ts';
import type {
  MainRenderPipeline,
} from './main-render-pipeline-setup.ts';
import {
  setupMainUi,
} from './main-ui-setup.ts';
import type {
  PreviewShapeController,
} from './preview-shape-controller.ts';
import type { AppTranslator } from '../../../shared/i18n/browser-translation-contract.ts';
import {
  getLightSettings,
  getMaterialSettings,
  setLightSettings,
  setMaterialSettings,
} from './scene-state.ts';
import {
  isPreviewWireframeOverlayEnabled,
} from './ui-state.ts';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;
type DomSelector = <T extends Element>(selector: string) => T;

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
  duplicateLut: (lutId: string) => void;
  addCustomParam: () => void;
  renameCustomParam: (paramId: string, label: string) => void;
  setCustomParamValue: (paramId: string, value: number) => void;
  removeCustomParam: (paramId: string) => void;
  moveCustomParamToPosition: (paramId: string, targetParamId: string | null, after: boolean) => void;
  moveLutToPosition: (lutId: string, targetLutId: string | null, after: boolean) => void;
  moveStepToPosition: (stepId: string, targetStepId: string | null, after: boolean) => void;
}

export interface BootstrapMainPostRuntimeOptions {
  select: DomSelector;
  canvas: HTMLCanvasElement;
  paramNodeListEl: HTMLElement;
  stepListEl: HTMLElement;
  lutStripListEl: HTMLElement;
  paramColumnEl: HTMLElement;
  lightGizmoLayerEl: SVGSVGElement;
  pipelineCommands: PipelineCommandsLike;
  pipelineHistoryActions: PipelineHistoryActionsController;
  pipelineHeaderActions: PipelineHeaderActionController;
  previewShapeController: PreviewShapeController;
  mainPreviewCapture: MainPreviewCaptureController;
  pipelineDropIndicators: PipelineDropIndicatorController;
  pipelineSocketDnd: PipelineSocketDndController;
  pipelineApply: Pick<PipelineApplyController, 'scheduleApply' | 'applyNow'>;
  mainRenderPipeline: MainRenderPipeline | null;
  mainStepRendering: MainStepRenderingController;
  getShaderBuildInput: () => {
    steps: StepModel[];
    luts: LutModel[];
    customParams: import('../../../features/step/step-model.ts').CustomParamModel[];
    materialSettings: pipelineModel.MaterialSettings;
  };
  onExportShaderZip: () => void | Promise<void>;
  onUpdateShaderCodePanel: () => void;
  getOrbitState: () => CameraOrbitState;
  setOrbitState: (nextState: CameraOrbitState) => void;
  onScheduleConnectionDraw: () => void;
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

function ensureHTMLElement(value: unknown, label: string): asserts value is HTMLElement {
  if (!(value instanceof HTMLElement)) {
    throw new Error(`${label} must be an HTMLElement.`);
  }
}

function ensureSvgElement(value: unknown, label: string): asserts value is SVGSVGElement {
  if (!(value instanceof SVGSVGElement)) {
    throw new Error(`${label} must be an SVGSVGElement.`);
  }
}

function assertPipelineCommands(value: unknown): asserts value is PipelineCommandsLike {
  ensureObject(value, 'Main post-runtime pipelineCommands');
  const commands = value as Partial<PipelineCommandsLike>;

  ensureFunction(commands.addStep, 'Main post-runtime pipelineCommands.addStep');
  ensureFunction(commands.duplicateStep, 'Main post-runtime pipelineCommands.duplicateStep');
  ensureFunction(commands.removeStep, 'Main post-runtime pipelineCommands.removeStep');
  ensureFunction(commands.setStepMuted, 'Main post-runtime pipelineCommands.setStepMuted');
  ensureFunction(commands.setStepLabel, 'Main post-runtime pipelineCommands.setStepLabel');
  ensureFunction(commands.setStepLut, 'Main post-runtime pipelineCommands.setStepLut');
  ensureFunction(commands.setStepBlendMode, 'Main post-runtime pipelineCommands.setStepBlendMode');
  ensureFunction(commands.setStepChannelOp, 'Main post-runtime pipelineCommands.setStepChannelOp');
  ensureFunction(commands.removeLut, 'Main post-runtime pipelineCommands.removeLut');
  ensureFunction(commands.duplicateLut, 'Main post-runtime pipelineCommands.duplicateLut');
  ensureFunction(commands.moveLutToPosition, 'Main post-runtime pipelineCommands.moveLutToPosition');
  ensureFunction(commands.moveStepToPosition, 'Main post-runtime pipelineCommands.moveStepToPosition');
}

function assertOptions(options: BootstrapMainPostRuntimeOptions): void {
  ensureObject(options, 'Main post-runtime options');

  ensureFunction(options.select, 'Main post-runtime select');
  if (!(options.canvas instanceof HTMLCanvasElement)) {
    throw new Error('Main post-runtime canvas must be an HTMLCanvasElement.');
  }
  ensureHTMLElement(options.paramNodeListEl, 'Main post-runtime paramNodeListEl');
  ensureHTMLElement(options.stepListEl, 'Main post-runtime stepListEl');
  ensureHTMLElement(options.lutStripListEl, 'Main post-runtime lutStripListEl');
  ensureHTMLElement(options.paramColumnEl, 'Main post-runtime paramColumnEl');
  ensureSvgElement(options.lightGizmoLayerEl, 'Main post-runtime lightGizmoLayerEl');

  assertPipelineCommands(options.pipelineCommands);

  ensureObject(options.pipelineHistoryActions, 'Main post-runtime pipelineHistoryActions');
  ensureFunction(options.pipelineHistoryActions.captureSnapshot, 'Main post-runtime pipelineHistoryActions.captureSnapshot');
  ensureFunction(options.pipelineHistoryActions.commitSnapshot, 'Main post-runtime pipelineHistoryActions.commitSnapshot');
  ensureFunction(options.pipelineHistoryActions.undo, 'Main post-runtime pipelineHistoryActions.undo');
  ensureFunction(options.pipelineHistoryActions.redo, 'Main post-runtime pipelineHistoryActions.redo');
  ensureFunction(options.pipelineHistoryActions.clearHistory, 'Main post-runtime pipelineHistoryActions.clearHistory');

  ensureObject(options.pipelineHeaderActions, 'Main post-runtime pipelineHeaderActions');
  ensureFunction(options.pipelineHeaderActions.buildMountOptions, 'Main post-runtime pipelineHeaderActions.buildMountOptions');

  ensureObject(options.previewShapeController, 'Main post-runtime previewShapeController');
  ensureFunction(options.previewShapeController.getCurrentShape, 'Main post-runtime previewShapeController.getCurrentShape');
  ensureFunction(options.previewShapeController.setActiveShape, 'Main post-runtime previewShapeController.setActiveShape');
  ensureFunction(options.previewShapeController.setWireframeOverlayEnabled, 'Main post-runtime previewShapeController.setWireframeOverlayEnabled');

  ensureObject(options.mainPreviewCapture, 'Main post-runtime mainPreviewCapture');
  ensureFunction(options.mainPreviewCapture.exportMainPreviewPng, 'Main post-runtime mainPreviewCapture.exportMainPreviewPng');
  ensureFunction(options.mainPreviewCapture.exportStepPreviewPng, 'Main post-runtime mainPreviewCapture.exportStepPreviewPng');

  ensureObject(options.pipelineDropIndicators, 'Main post-runtime pipelineDropIndicators');
  ensureFunction(options.pipelineDropIndicators.getLutDropPlacement, 'Main post-runtime pipelineDropIndicators.getLutDropPlacement');
  ensureFunction(options.pipelineDropIndicators.getStepDropPlacement, 'Main post-runtime pipelineDropIndicators.getStepDropPlacement');
  ensureFunction(options.pipelineDropIndicators.updateLutDropIndicators, 'Main post-runtime pipelineDropIndicators.updateLutDropIndicators');
  ensureFunction(options.pipelineDropIndicators.clearLutDropIndicators, 'Main post-runtime pipelineDropIndicators.clearLutDropIndicators');
  ensureFunction(options.pipelineDropIndicators.updateStepDropIndicators, 'Main post-runtime pipelineDropIndicators.updateStepDropIndicators');
  ensureFunction(options.pipelineDropIndicators.clearStepDropIndicators, 'Main post-runtime pipelineDropIndicators.clearStepDropIndicators');

  ensureObject(options.pipelineSocketDnd, 'Main post-runtime pipelineSocketDnd');
  ensureFunction(options.pipelineSocketDnd.handleSocketDragMove, 'Main post-runtime pipelineSocketDnd.handleSocketDragMove');
  ensureFunction(options.pipelineSocketDnd.handleSocketDragEnd, 'Main post-runtime pipelineSocketDnd.handleSocketDragEnd');

  ensureObject(options.pipelineApply, 'Main post-runtime pipelineApply');
  ensureFunction(options.pipelineApply.scheduleApply, 'Main post-runtime pipelineApply.scheduleApply');
  ensureFunction(options.pipelineApply.applyNow, 'Main post-runtime pipelineApply.applyNow');

  if (options.mainRenderPipeline !== null) {
    ensureObject(options.mainRenderPipeline, 'Main post-runtime mainRenderPipeline');
    ensureObject(options.mainRenderPipeline.renderSystem, 'Main post-runtime mainRenderPipeline.renderSystem');
    ensureFunction(options.mainRenderPipeline.renderSystem.isRunning, 'Main post-runtime mainRenderPipeline.renderSystem.isRunning');
    ensureFunction(options.mainRenderPipeline.renderSystem.start, 'Main post-runtime mainRenderPipeline.renderSystem.start');
  }

  ensureObject(options.mainStepRendering, 'Main post-runtime mainStepRendering');
  ensureFunction(options.mainStepRendering.normalizeSteps, 'Main post-runtime mainStepRendering.normalizeSteps');
  ensureFunction(options.mainStepRendering.renderLutStrip, 'Main post-runtime mainStepRendering.renderLutStrip');
  ensureFunction(options.mainStepRendering.renderSteps, 'Main post-runtime mainStepRendering.renderSteps');
  ensureFunction(options.mainStepRendering.updateStepSwatches, 'Main post-runtime mainStepRendering.updateStepSwatches');

  ensureFunction(options.getShaderBuildInput, 'Main post-runtime getShaderBuildInput');
  ensureFunction(options.onExportShaderZip, 'Main post-runtime onExportShaderZip');
  ensureFunction(options.onUpdateShaderCodePanel, 'Main post-runtime onUpdateShaderCodePanel');
  ensureFunction(options.getOrbitState, 'Main post-runtime getOrbitState');
  ensureFunction(options.setOrbitState, 'Main post-runtime setOrbitState');
  ensureFunction(options.onScheduleConnectionDraw, 'Main post-runtime onScheduleConnectionDraw');
  ensureFunction(options.onStatus, 'Main post-runtime onStatus');
  ensureFunction(options.t, 'Main post-runtime t');
}

export function bootstrapMainPostRuntime(options: BootstrapMainPostRuntimeOptions): void {
  assertOptions(options);

  replacePipelineState({
    luts: pipelineModel.createBuiltinLuts(),
    steps: [],
    customParams: [],
  });
  options.pipelineHistoryActions.clearHistory();

  const lutEditorDialogEl = options.select<HTMLDialogElement>('#lut-editor-dialog');
  const lutEditorSurfaceEl = options.select<HTMLElement>('.lut-editor-dialog-surface');
  const lutEditorController = setupMainLutEditorDialog({
    dialogEl: lutEditorDialogEl,
    surfaceEl: lutEditorSurfaceEl,
    getLuts: getPipelineLuts,
    setLuts: setPipelineLuts,
    maxLuts: MAX_LUTS,
    captureHistorySnapshot: () => options.pipelineHistoryActions.captureSnapshot(),
    commitHistorySnapshot: before => options.pipelineHistoryActions.commitSnapshot(before as ReturnType<typeof options.pipelineHistoryActions.captureSnapshot>),
    renderSteps: () => options.mainStepRendering.renderSteps(),
    scheduleApply: () => options.pipelineApply.scheduleApply(),
    renderLutStrip: () => options.mainStepRendering.renderLutStrip(),
    onStatus: options.onStatus,
    t: options.t,
  });

  setupMainPipelineEditor({
    paramNodeListEl: options.paramNodeListEl,
    stepListEl: options.stepListEl,
    lutStripListEl: options.lutStripListEl,
    getSteps: getPipelineSteps,
    getLuts: getPipelineLuts,
    getCustomParams: getPipelineCustomParams,
    getMaterialSettings,
    shouldSuppressClick: () => performance.now() < getSuppressClickUntil(),
    onOpenPipelineFilePicker: () => {
      const pipelineFileInput = document.querySelector<HTMLInputElement>('#pipeline-file-input');
      if (!(pipelineFileInput instanceof HTMLInputElement)) {
        options.onStatus(options.t('header.status.missingPipelineFileInput'), 'error');
        return;
      }

      pipelineFileInput.click();
    },
    onLoadExample: async example => {
      await options.pipelineHeaderActions.buildMountOptions().onResetPresetSelected(example);
    },
    onScheduleConnectionDraw: () => options.onScheduleConnectionDraw(),
    computeLutUv: (stepIndex, pixelX, pixelY, canvasWidth, canvasHeight) =>
      resolveLutUvAtPixel({
        pixelX,
        pixelY,
        canvasWidth,
        canvasHeight,
        targetStepIndex: stepIndex,
        steps: getPipelineSteps(),
        luts: getPipelineLuts(),
        customParams: getPipelineCustomParams(),
        materialSettings: getMaterialSettings(),
        lightSettings: getLightSettings(),
      }),
    pipelineCommands: options.pipelineCommands,
    onEditLut: lutId => lutEditorController.openForLut(lutId),
    onDuplicateLut: lutId => options.pipelineCommands.duplicateLut(lutId),
    onNewLut: () => lutEditorController.createNewLut(),
    createLutFromFile: pipelineModel.createLutFromFile,
    maxLuts: MAX_LUTS,
    pipelineHistoryActions: options.pipelineHistoryActions,
    normalizeSteps: () => options.mainStepRendering.normalizeSteps(),
    renderSteps: () => options.mainStepRendering.renderSteps(),
    scheduleApply: () => options.pipelineApply.scheduleApply(),
    renderLutStrip: () => options.mainStepRendering.renderLutStrip(),
    onStatus: options.onStatus,
    t: options.t,
  });

  setupMainUi({
    select: options.select,
    pipelineHeaderActions: options.pipelineHeaderActions,
    previewShapeController: options.previewShapeController,
    mainPreviewCapture: options.mainPreviewCapture,
    isPreviewWireframeOverlayEnabled,
    lightGizmoLayerEl: options.lightGizmoLayerEl,
    getMaterialSettings,
    setMaterialSettings,
    getLightSettings,
    setLightSettings,
    getShaderBuildInput: options.getShaderBuildInput,
    onExportShaderZip: options.onExportShaderZip,
    onUpdateStepSwatches: () => options.mainStepRendering.updateStepSwatches(),
    onUpdateShaderCodePanel: options.onUpdateShaderCodePanel,
    onScheduleApply: () => options.pipelineApply.scheduleApply(),
    paramNodeListEl: options.paramNodeListEl,
    stepListEl: options.stepListEl,
    lutStripListEl: options.lutStripListEl,
    paramColumnEl: options.paramColumnEl,
    parseStepId: pipelineModel.parseStepId,
    parseLutId: pipelineModel.parseLutId,
    isValidParamName: pipelineModel.isValidParamName,
    isValidSocketAxis: pipelineView.isValidSocketAxis,
    pipelineDropIndicators: options.pipelineDropIndicators,
    getLutReorderDragState,
    setLutReorderDragState,
    clearLutReorderDragState,
    getStepReorderDragState,
    setStepReorderDragState,
    clearStepReorderDragState,
    setSocketDragState,
    pipelineSocketDnd: options.pipelineSocketDnd,
    moveLutToPosition: options.pipelineCommands.moveLutToPosition,
    moveStepToPosition: options.pipelineCommands.moveStepToPosition,
    onScheduleConnectionDraw: options.onScheduleConnectionDraw,
    onUndoPipeline: options.pipelineHistoryActions.undo,
    onRedoPipeline: options.pipelineHistoryActions.redo,
    onStatus: options.onStatus,
    initialStatusMessage: options.t('main.status.initialPrompt'),
    initialStatusKind: 'info',
  });

  setupMainLayoutControls({
    canvas: options.canvas,
    pipelinePanel: options.select<HTMLElement>('#pipeline-panel'),
    pipelineResizer: options.select<HTMLElement>('#resizer'),
    previewPanel: options.select<HTMLElement>('.preview-panel'),
    previewDisplay: options.select<HTMLElement>('#preview-display-section'),
    previewResizer: options.select<HTMLElement>('#preview-layout-resizer'),
    getOrbitState: options.getOrbitState,
    setOrbitState: options.setOrbitState,
    onPanelResized: options.onScheduleConnectionDraw,
    onStatus: options.onStatus,
  });

  options.pipelineApply.applyNow();
  if (options.mainRenderPipeline && !options.mainRenderPipeline.renderSystem.isRunning()) {
    options.mainRenderPipeline.renderSystem.start();
  }

  options.onScheduleConnectionDraw();
}
