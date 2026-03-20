import type { PipelineDropIndicatorController } from '../../features/pipeline/pipeline-drop-indicators.ts';
import type { PipelineHeaderActionController } from '../../features/pipeline/pipeline-header-actions-controller.ts';
import { setupPipelineUiInteractions } from '../../features/pipeline/pipeline-ui-interactions.ts';
import type { PipelineSocketDndController } from '../../features/pipeline/pipeline-socket-dnd-controller.ts';
import type { LightSettings, MaterialSettings } from '../../features/pipeline/pipeline-model.ts';
import type { SocketAxis, SocketDragState, StepReorderDragState, LutReorderDragState } from '../../features/pipeline/pipeline-view.ts';
import type { ShaderBuildInput } from '../../features/shader/shader-generator.ts';
import type { ParamName } from '../../features/step/step-model.ts';
import { setupStepPreviewShapeUi } from '../../features/step/step-preview-shape-ui.ts';
import {
  mountHeaderActionGroup,
  mountLanguageSwitcher,
} from '../components/solid-header-actions.tsx';
import type { MainPreviewCaptureController } from './main-preview-capture-controller.ts';
import { setupMainPanels } from './main-panels-setup.ts';
import type { PreviewShapeController } from './preview-shape-controller.ts';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

type DomSelector = <T extends Element>(selector: string) => T;

interface SetupMainUiOptions {
  select: DomSelector;
  pipelineHeaderActions: PipelineHeaderActionController;
  previewShapeController: PreviewShapeController;
  mainPreviewCapture: MainPreviewCaptureController;
  isPreviewWireframeOverlayEnabled: () => boolean;
  lightGizmoLayerEl: SVGSVGElement;
  getMaterialSettings: () => MaterialSettings;
  setMaterialSettings: (next: MaterialSettings) => void;
  getLightSettings: () => LightSettings;
  setLightSettings: (next: LightSettings) => void;
  getShaderBuildInput: () => ShaderBuildInput;
  onUpdateStepSwatches: () => void;
  onUpdateShaderCodePanel: () => void;
  onScheduleApply: () => void;
  paramNodeListEl: HTMLElement;
  stepListEl: HTMLElement;
  lutStripListEl: HTMLElement;
  paramColumnEl: HTMLElement;
  parseStepId: (value: string | undefined) => number | null;
  parseLutId: (value: string | undefined) => string | null;
  isValidParamName: (value: string) => value is ParamName;
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
  moveStepToPosition: (stepId: number, targetStepId: number | null, after: boolean) => void;
  onScheduleConnectionDraw: () => void;
  onUndoPipeline: () => void;
  onRedoPipeline: () => void;
  onStatus: StatusReporter;
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

function assertSetupMainUiOptions(options: SetupMainUiOptions): void {
  ensureObject(options, 'Main UI setup options');

  ensureFunction(options.select, 'Main UI setup select');
  ensureObject(options.pipelineHeaderActions, 'Main UI setup pipelineHeaderActions');
  ensureFunction(options.pipelineHeaderActions.buildMountOptions, 'Main UI setup pipelineHeaderActions.buildMountOptions');

  ensureObject(options.previewShapeController, 'Main UI setup previewShapeController');
  ensureFunction(options.previewShapeController.getCurrentShape, 'Main UI setup previewShapeController.getCurrentShape');
  ensureFunction(options.previewShapeController.setActiveShape, 'Main UI setup previewShapeController.setActiveShape');
  ensureFunction(options.previewShapeController.setWireframeOverlayEnabled, 'Main UI setup previewShapeController.setWireframeOverlayEnabled');

  ensureObject(options.mainPreviewCapture, 'Main UI setup mainPreviewCapture');
  ensureFunction(options.mainPreviewCapture.exportMainPreviewPng, 'Main UI setup mainPreviewCapture.exportMainPreviewPng');
  ensureFunction(options.mainPreviewCapture.exportStepPreviewPng, 'Main UI setup mainPreviewCapture.exportStepPreviewPng');

  ensureSvgElement(options.lightGizmoLayerEl, 'Main UI setup lightGizmoLayerEl');
  ensureHTMLElement(options.paramNodeListEl, 'Main UI setup paramNodeListEl');
  ensureHTMLElement(options.stepListEl, 'Main UI setup stepListEl');
  ensureHTMLElement(options.lutStripListEl, 'Main UI setup lutStripListEl');
  ensureHTMLElement(options.paramColumnEl, 'Main UI setup paramColumnEl');

  ensureFunction(options.isPreviewWireframeOverlayEnabled, 'Main UI setup isPreviewWireframeOverlayEnabled');
  ensureFunction(options.getMaterialSettings, 'Main UI setup getMaterialSettings');
  ensureFunction(options.setMaterialSettings, 'Main UI setup setMaterialSettings');
  ensureFunction(options.getLightSettings, 'Main UI setup getLightSettings');
  ensureFunction(options.setLightSettings, 'Main UI setup setLightSettings');
  ensureFunction(options.getShaderBuildInput, 'Main UI setup getShaderBuildInput');
  ensureFunction(options.onUpdateStepSwatches, 'Main UI setup onUpdateStepSwatches');
  ensureFunction(options.onUpdateShaderCodePanel, 'Main UI setup onUpdateShaderCodePanel');
  ensureFunction(options.onScheduleApply, 'Main UI setup onScheduleApply');

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
  ensureFunction(options.onUndoPipeline, 'Main UI setup onUndoPipeline');
  ensureFunction(options.onRedoPipeline, 'Main UI setup onRedoPipeline');
  ensureFunction(options.onStatus, 'Main UI setup onStatus');
}

export function setupMainUi(options: SetupMainUiOptions): void {
  assertSetupMainUiOptions(options);

  mountLanguageSwitcher(options.select<HTMLElement>('#header-language-switcher'));
  mountHeaderActionGroup(
    options.select<HTMLElement>('#header-action-group'),
    options.pipelineHeaderActions.buildMountOptions(),
  );

  setupStepPreviewShapeUi({
    target: options.select<HTMLElement>('#preview-shape-bar'),
    initialShape: options.previewShapeController.getCurrentShape(),
    isWireframeEnabled: options.isPreviewWireframeOverlayEnabled,
    onShapeChange: nextShape => {
      options.previewShapeController.setActiveShape(nextShape);
    },
    onWireframeChange: enabled => {
      options.previewShapeController.setWireframeOverlayEnabled(enabled);
    },
    onExportMainPreviewPng: async () => {
      await options.mainPreviewCapture.exportMainPreviewPng();
    },
    onExportStepPreviewPng: async () => {
      await options.mainPreviewCapture.exportStepPreviewPng();
    },
    onStatus: options.onStatus,
  });

  setupMainPanels({
    materialPanelEl: options.select<HTMLElement>('#material-panel'),
    lightPanelEl: options.select<HTMLElement>('#light-panel'),
    shaderDialogEl: options.select<HTMLDialogElement>('#shader-dialog'),
    shaderOpenButtonEl: options.select<HTMLButtonElement>('#btn-open-shader-dialog'),
    shaderSurfaceEl: options.select<Element>('.shader-dialog-surface'),
    lightGizmoLayerEl: options.lightGizmoLayerEl,
    getMaterialSettings: options.getMaterialSettings,
    setMaterialSettings: options.setMaterialSettings,
    getLightSettings: options.getLightSettings,
    setLightSettings: options.setLightSettings,
    getShaderBuildInput: options.getShaderBuildInput,
    onUpdateStepSwatches: options.onUpdateStepSwatches,
    onUpdateShaderCodePanel: options.onUpdateShaderCodePanel,
    onScheduleApply: options.onScheduleApply,
    onStatus: options.onStatus,
  });

  setupPipelineUiInteractions({
    dndBindings: {
      lutReorder: {
        lutStripListEl: options.lutStripListEl,
        parseLutId: options.parseLutId,
        getLutDropPlacement: options.pipelineDropIndicators.getLutDropPlacement,
        getLutReorderDragState: options.getLutReorderDragState,
        setLutReorderDragState: options.setLutReorderDragState,
        clearLutReorderDragState: options.clearLutReorderDragState,
        updateLutDropIndicators: options.pipelineDropIndicators.updateLutDropIndicators,
        clearLutDropIndicators: options.pipelineDropIndicators.clearLutDropIndicators,
        moveLutToPosition: options.moveLutToPosition,
        onStatus: options.onStatus,
      },
      socketPointer: {
        paramNodeListEl: options.paramNodeListEl,
        stepListEl: options.stepListEl,
        parseStepId: options.parseStepId,
        isValidParamName: options.isValidParamName,
        isValidSocketAxis: options.isValidSocketAxis,
        setSocketDragState: options.setSocketDragState,
        handleSocketDragMove: options.pipelineSocketDnd.handleSocketDragMove,
        handleSocketDragEnd: options.pipelineSocketDnd.handleSocketDragEnd,
        onStatus: options.onStatus,
      },
      stepReorder: {
        stepListEl: options.stepListEl,
        parseStepId: options.parseStepId,
        getStepDropPlacement: options.pipelineDropIndicators.getStepDropPlacement,
        getStepReorderDragState: options.getStepReorderDragState,
        setStepReorderDragState: options.setStepReorderDragState,
        clearStepReorderDragState: options.clearStepReorderDragState,
        updateStepDropIndicators: options.pipelineDropIndicators.updateStepDropIndicators,
        clearStepDropIndicators: options.pipelineDropIndicators.clearStepDropIndicators,
        moveStepToPosition: options.moveStepToPosition,
        onStatus: options.onStatus,
      },
    },
    stepListEl: options.stepListEl,
    paramColumnEl: options.paramColumnEl,
    onScheduleConnectionDraw: options.onScheduleConnectionDraw,
    onUpdateStepSwatches: options.onUpdateStepSwatches,
    onUndoPipeline: options.onUndoPipeline,
    onRedoPipeline: options.onRedoPipeline,
  });

  options.previewShapeController.setActiveShape('sphere');
}
