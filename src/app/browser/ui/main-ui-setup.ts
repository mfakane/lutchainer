import type { LightSettings, MaterialSettings } from '../../../features/pipeline/pipeline-model.ts';
import type { LutReorderDragState, SocketAxis, SocketDragState, StepReorderDragState } from '../../../features/pipeline/pipeline-view.ts';
import type { ShaderBuildInput, ShaderLanguage } from '../../../features/shader/shader-generator.ts';
import type { ParamRef } from '../../../features/step/step-model.ts';
import {
  mountHeaderActionGroup,
  mountLanguageSwitcher,
} from '../components/solid-header-actions.tsx';
import { openShaderDialog } from '../components/solid-shader-dialog.tsx';
import type { PipelineDropIndicatorController } from '../pipeline/pipeline-drop-indicators.ts';
import type { PipelineHeaderActionController } from '../pipeline/pipeline-header-actions-controller.ts';
import type { PipelineSocketDndController } from '../pipeline/pipeline-socket-dnd-controller.ts';
import { setupPipelineUiInteractions } from '../pipeline/pipeline-ui-interactions.ts';
import { setupStepPreviewShapeUi } from '../step/step-preview-shape-ui.ts';
import { setupMainPanels } from './main-panels-setup.ts';
import type { MainPreviewCaptureController } from './main-preview-capture-controller.ts';
import type { PreviewShapeController } from './preview-shape-controller.ts';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

type DomSelector = <T extends Element>(selector: string) => T;

interface MainUiShellOptions {
  select: DomSelector;
  pipelineHeaderActions: PipelineHeaderActionController;
  previewShapeController: PreviewShapeController;
  mainPreviewCapture: MainPreviewCaptureController;
  isPreviewWireframeOverlayEnabled: () => boolean;
  onExportShaderZip: (language: ShaderLanguage) => void | Promise<void>;
  onStatus: StatusReporter;
}

interface MainUiPanelsOptions {
  select: DomSelector;
  initialStatusMessage: string;
  initialStatusKind?: StatusKind;
  lightGizmoLayerEl: SVGSVGElement;
  getMaterialSettings: () => MaterialSettings;
  setMaterialSettings: (next: MaterialSettings) => void;
  getLightSettings: () => LightSettings;
  setLightSettings: (next: LightSettings) => void;
  getShaderBuildInput: () => ShaderBuildInput;
  onExportShaderZip: (language: ShaderLanguage) => void | Promise<void>;
  onUpdateStepSwatches: () => void;
  onUpdateShaderCodePanel: () => void;
  onScheduleApply: () => void;
  onStatus: StatusReporter;
}

interface MainUiInteractionsOptions {
  paramNodeListEl: HTMLElement;
  getStepListEl: () => HTMLElement;
  lutStripListEl: HTMLElement;
  paramColumnEl: HTMLElement;
  parseStepId: (value: string | undefined) => string | null;
  parseLutId: (value: string | undefined) => string | null;
  isValidParamName: (value: string) => value is ParamRef;
  isValidSocketAxis: (value: string) => value is SocketAxis;
  pipelineDropIndicators: PipelineDropIndicatorController;
  getLutReorderDragState: () => LutReorderDragState | null;
  setLutReorderDragState: (state: LutReorderDragState | null) => void;
  clearLutReorderDragState: () => void;
  getStepReorderDragState: () => StepReorderDragState | null;
  setStepReorderDragState: (state: StepReorderDragState | null) => void;
  clearStepReorderDragState: () => void;
  setSocketDragState: (state: SocketDragState | null) => void;
  pipelineSocketDnd: PipelineSocketDndController;
  moveLutToPosition: (lutId: string, targetLutId: string | null, after: boolean) => void;
  moveStepToPosition: (stepId: string, targetStepId: string | null, after: boolean) => void;
  onScheduleConnectionDraw: () => void;
  onUndoPipeline: () => void;
  onRedoPipeline: () => void;
  onUpdateStepSwatches: () => void;
  onStatus: StatusReporter;
}

interface SetupMainUiOptions {
  shell: MainUiShellOptions;
  panels: MainUiPanelsOptions;
  interactions: MainUiInteractionsOptions;
}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} must be a function.`);
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

function ensureObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertMainUiShellOptions(options: MainUiShellOptions): void {
  ensureObject(options, 'Main UI shell options');
  ensureFunction(options.select, 'Main UI shell select');
  ensureObject(options.pipelineHeaderActions, 'Main UI shell pipelineHeaderActions');
  ensureFunction(options.pipelineHeaderActions.buildMountOptions, 'Main UI shell pipelineHeaderActions.buildMountOptions');
  ensureObject(options.previewShapeController, 'Main UI shell previewShapeController');
  ensureFunction(options.previewShapeController.getCurrentShape, 'Main UI shell previewShapeController.getCurrentShape');
  ensureFunction(options.previewShapeController.setActiveShape, 'Main UI shell previewShapeController.setActiveShape');
  ensureFunction(options.previewShapeController.setWireframeOverlayEnabled, 'Main UI shell previewShapeController.setWireframeOverlayEnabled');
  ensureObject(options.mainPreviewCapture, 'Main UI shell mainPreviewCapture');
  ensureFunction(options.mainPreviewCapture.exportMainPreviewPng, 'Main UI shell mainPreviewCapture.exportMainPreviewPng');
  ensureFunction(options.mainPreviewCapture.exportStepPreviewPng, 'Main UI shell mainPreviewCapture.exportStepPreviewPng');
  ensureFunction(options.isPreviewWireframeOverlayEnabled, 'Main UI shell isPreviewWireframeOverlayEnabled');
  ensureFunction(options.onExportShaderZip, 'Main UI shell onExportShaderZip');
  ensureFunction(options.onStatus, 'Main UI shell onStatus');
}

function assertMainUiPanelsOptions(options: MainUiPanelsOptions): void {
  ensureObject(options, 'Main UI panels options');
  ensureFunction(options.select, 'Main UI panels select');
  if (typeof options.initialStatusMessage !== 'string') {
    throw new Error('Main UI setup initialStatusMessage must be a string.');
  }
  if (
    options.initialStatusKind !== undefined
      && options.initialStatusKind !== 'success'
      && options.initialStatusKind !== 'error'
      && options.initialStatusKind !== 'info'
  ) {
    throw new Error('Main UI setup initialStatusKind must be a valid status kind.');
  }
  ensureSvgElement(options.lightGizmoLayerEl, 'Main UI setup lightGizmoLayerEl');
  ensureFunction(options.getMaterialSettings, 'Main UI setup getMaterialSettings');
  ensureFunction(options.setMaterialSettings, 'Main UI setup setMaterialSettings');
  ensureFunction(options.getLightSettings, 'Main UI setup getLightSettings');
  ensureFunction(options.setLightSettings, 'Main UI setup setLightSettings');
  ensureFunction(options.getShaderBuildInput, 'Main UI setup getShaderBuildInput');
  ensureFunction(options.onExportShaderZip, 'Main UI setup onExportShaderZip');
  ensureFunction(options.onUpdateStepSwatches, 'Main UI setup onUpdateStepSwatches');
  ensureFunction(options.onUpdateShaderCodePanel, 'Main UI setup onUpdateShaderCodePanel');
  ensureFunction(options.onScheduleApply, 'Main UI setup onScheduleApply');
  ensureFunction(options.onStatus, 'Main UI setup onStatus');
}

function assertMainUiInteractionsOptions(options: MainUiInteractionsOptions): void {
  ensureObject(options, 'Main UI interactions options');
  ensureHTMLElement(options.paramNodeListEl, 'Main UI setup paramNodeListEl');
  ensureFunction(options.getStepListEl, 'Main UI setup getStepListEl');
  ensureHTMLElement(options.lutStripListEl, 'Main UI setup lutStripListEl');
  ensureHTMLElement(options.paramColumnEl, 'Main UI setup paramColumnEl');

  ensureFunction(options.parseStepId, 'Main UI setup parseStepId');
  ensureFunction(options.parseLutId, 'Main UI setup parseLutId');
  ensureFunction(options.isValidParamName, 'Main UI setup isValidParamName');
  ensureFunction(options.isValidSocketAxis, 'Main UI setup isValidSocketAxis');

  ensureObject(options.pipelineDropIndicators, 'Main UI setup pipelineDropIndicators');
  ensureFunction(options.pipelineDropIndicators.getLutDropPlacement, 'Main UI setup pipelineDropIndicators.getLutDropPlacement');
  ensureFunction(options.pipelineDropIndicators.getStepDropPlacement, 'Main UI setup pipelineDropIndicators.getStepDropPlacement');
  ensureFunction(options.pipelineDropIndicators.updateLutDropIndicators, 'Main UI setup pipelineDropIndicators.updateLutDropIndicators');
  ensureFunction(options.pipelineDropIndicators.clearLutDropIndicators, 'Main UI setup pipelineDropIndicators.clearLutDropIndicators');
  ensureFunction(options.pipelineDropIndicators.updateStepDropIndicators, 'Main UI setup pipelineDropIndicators.updateStepDropIndicators');
  ensureFunction(options.pipelineDropIndicators.clearStepDropIndicators, 'Main UI setup pipelineDropIndicators.clearStepDropIndicators');

  ensureFunction(options.getLutReorderDragState, 'Main UI setup getLutReorderDragState');
  ensureFunction(options.setLutReorderDragState, 'Main UI setup setLutReorderDragState');
  ensureFunction(options.clearLutReorderDragState, 'Main UI setup clearLutReorderDragState');
  ensureFunction(options.getStepReorderDragState, 'Main UI setup getStepReorderDragState');
  ensureFunction(options.setStepReorderDragState, 'Main UI setup setStepReorderDragState');
  ensureFunction(options.clearStepReorderDragState, 'Main UI setup clearStepReorderDragState');
  ensureFunction(options.setSocketDragState, 'Main UI setup setSocketDragState');

  ensureObject(options.pipelineSocketDnd, 'Main UI setup pipelineSocketDnd');
  ensureFunction(options.pipelineSocketDnd.handleSocketDragMove, 'Main UI setup pipelineSocketDnd.handleSocketDragMove');
  ensureFunction(options.pipelineSocketDnd.handleSocketDragEnd, 'Main UI setup pipelineSocketDnd.handleSocketDragEnd');

  ensureFunction(options.moveLutToPosition, 'Main UI setup moveLutToPosition');
  ensureFunction(options.moveStepToPosition, 'Main UI setup moveStepToPosition');
  ensureFunction(options.onScheduleConnectionDraw, 'Main UI setup onScheduleConnectionDraw');
  ensureFunction(options.onUpdateStepSwatches, 'Main UI setup onUpdateStepSwatches');
  ensureFunction(options.onUndoPipeline, 'Main UI setup onUndoPipeline');
  ensureFunction(options.onRedoPipeline, 'Main UI setup onRedoPipeline');
  ensureFunction(options.onStatus, 'Main UI setup onStatus');
}

function assertSetupMainUiOptions(options: SetupMainUiOptions): void {
  ensureObject(options, 'Main UI setup options');
  assertMainUiShellOptions(options.shell);
  assertMainUiPanelsOptions(options.panels);
  assertMainUiInteractionsOptions(options.interactions);
}

export function setupMainUi(options: SetupMainUiOptions): void {
  assertSetupMainUiOptions(options);

  mountLanguageSwitcher(options.shell.select<HTMLElement>('#header-language-switcher'));
  mountHeaderActionGroup(
    options.shell.select<HTMLElement>('#header-action-group'),
    {
      ...options.shell.pipelineHeaderActions.buildMountOptions(),
      onOpenShaderDialog: () => {
        openShaderDialog();
      },
      onExportShaderZip: options.shell.onExportShaderZip,
    },
  );

  setupStepPreviewShapeUi({
    target: options.shell.select<HTMLElement>('#preview-shape-bar'),
    initialShape: options.shell.previewShapeController.getCurrentShape(),
    isWireframeEnabled: options.shell.isPreviewWireframeOverlayEnabled,
    onShapeChange: nextShape => {
      options.shell.previewShapeController.setActiveShape(nextShape);
    },
    onWireframeChange: enabled => {
      options.shell.previewShapeController.setWireframeOverlayEnabled(enabled);
    },
    onExportMainPreviewPng: async () => {
      await options.shell.mainPreviewCapture.exportMainPreviewPng();
    },
    onExportStepPreviewPng: async () => {
      await options.shell.mainPreviewCapture.exportStepPreviewPng();
    },
    onStatus: options.shell.onStatus,
  });

  setupMainPanels({
    materialPanelEl: options.panels.select<HTMLElement>('#material-panel'),
    lightPanelEl: options.panels.select<HTMLElement>('#light-panel'),
    statusPanelEl: options.panels.select<HTMLElement>('#statusbar'),
    initialStatusMessage: options.panels.initialStatusMessage,
    initialStatusKind: options.panels.initialStatusKind,
    shaderDialogEl: options.panels.select<HTMLDialogElement>('#shader-dialog'),
    shaderSurfaceEl: options.panels.select<Element>('.shader-dialog-surface'),
    lightGizmoLayerEl: options.panels.lightGizmoLayerEl,
    getMaterialSettings: options.panels.getMaterialSettings,
    setMaterialSettings: options.panels.setMaterialSettings,
    getLightSettings: options.panels.getLightSettings,
    setLightSettings: options.panels.setLightSettings,
    getShaderBuildInput: options.panels.getShaderBuildInput,
    onExportShaderZip: options.panels.onExportShaderZip,
    onUpdateStepSwatches: options.panels.onUpdateStepSwatches,
    onUpdateShaderCodePanel: options.panels.onUpdateShaderCodePanel,
    onScheduleApply: options.panels.onScheduleApply,
    onStatus: options.panels.onStatus,
  });

  setupPipelineUiInteractions({
    dndBindings: {
      lutReorder: {
        lutStripListEl: options.interactions.lutStripListEl,
        parseLutId: options.interactions.parseLutId,
        getLutDropPlacement: options.interactions.pipelineDropIndicators.getLutDropPlacement,
        getLutReorderDragState: options.interactions.getLutReorderDragState,
        setLutReorderDragState: options.interactions.setLutReorderDragState,
        clearLutReorderDragState: options.interactions.clearLutReorderDragState,
        updateLutDropIndicators: options.interactions.pipelineDropIndicators.updateLutDropIndicators,
        clearLutDropIndicators: options.interactions.pipelineDropIndicators.clearLutDropIndicators,
        moveLutToPosition: options.interactions.moveLutToPosition,
        onStatus: options.interactions.onStatus,
      },
      socketPointer: {
        paramNodeListEl: options.interactions.paramNodeListEl,
        getStepListEl: options.interactions.getStepListEl,
        parseStepId: options.interactions.parseStepId,
        isValidParamName: options.interactions.isValidParamName,
        isValidSocketAxis: options.interactions.isValidSocketAxis,
        setSocketDragState: options.interactions.setSocketDragState,
        handleSocketDragMove: options.interactions.pipelineSocketDnd.handleSocketDragMove,
        handleSocketDragEnd: options.interactions.pipelineSocketDnd.handleSocketDragEnd,
        onStatus: options.interactions.onStatus,
      },
      stepReorder: {
        getStepListEl: options.interactions.getStepListEl,
        parseStepId: options.interactions.parseStepId,
        getStepDropPlacement: options.interactions.pipelineDropIndicators.getStepDropPlacement,
        getStepReorderDragState: options.interactions.getStepReorderDragState,
        setStepReorderDragState: options.interactions.setStepReorderDragState,
        clearStepReorderDragState: options.interactions.clearStepReorderDragState,
        updateStepDropIndicators: options.interactions.pipelineDropIndicators.updateStepDropIndicators,
        clearStepDropIndicators: options.interactions.pipelineDropIndicators.clearStepDropIndicators,
        moveStepToPosition: options.interactions.moveStepToPosition,
        onStatus: options.interactions.onStatus,
      },
    },
    getStepListEl: options.interactions.getStepListEl,
    paramColumnEl: options.interactions.paramColumnEl,
    onScheduleConnectionDraw: options.interactions.onScheduleConnectionDraw,
    onUpdateStepSwatches: options.interactions.onUpdateStepSwatches,
    onUndoPipeline: options.interactions.onUndoPipeline,
    onRedoPipeline: options.interactions.onRedoPipeline,
  });

  options.shell.previewShapeController.setActiveShape('sphere');
}
