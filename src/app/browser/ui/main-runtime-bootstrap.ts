import { setupMainPipelineIoSystem } from '../pipeline/main-pipeline-io-setup.ts';
import {
  createPipelineDropIndicatorController,
  type PipelineDropIndicatorController,
} from '../pipeline/pipeline-drop-indicators.ts';
import type {
  LutReorderDragState,
  StepReorderDragState,
} from '../../../features/pipeline/pipeline-view.ts';
import type {
  StepPreviewDebugController,
} from '../../../features/step/step-preview-debug-controller.ts';
import type { AppTranslator } from '../../../shared/i18n/browser-translation-contract.ts';
import {
  createMainPreviewCaptureController,
  type MainPreviewCaptureController,
} from './main-preview-capture-controller.ts';
import {
  setupMainPreviewRuntime,
  type MainPreviewRuntimeSetupOptions,
  type MainPreviewRuntimeSetupResult,
} from './main-preview-runtime-setup.ts';
import {
  setupMainRenderPipeline,
  type MainRenderPipeline,
} from './main-render-pipeline-setup.ts';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

interface OrbitState {
  orbitPitchDeg: number;
  orbitYawDeg: number;
  orbitDist: number;
}

interface GizmoLightElements {
  layer: SVGSVGElement;
  origin: SVGCircleElement;
  tip: SVGCircleElement;
  label: SVGTextElement;
}

interface GizmoAxisElements {
  layer: SVGSVGElement;
  origin: SVGCircleElement;
  lineX: SVGPathElement;
  lineY: SVGPathElement;
  lineZ: SVGPathElement;
  tipX: SVGCircleElement;
  tipY: SVGCircleElement;
  tipZ: SVGCircleElement;
  labelX: SVGTextElement;
  labelY: SVGTextElement;
  labelZ: SVGTextElement;
}

export interface MainRuntimeBootstrapOptions {
  getStepListEl: () => HTMLElement;
  lutStripListEl: HTMLElement;
  parseStepId: (value: string | undefined) => string | null;
  getStepReorderDragState: () => StepReorderDragState | null;
  getLutReorderDragState: () => LutReorderDragState | null;
  previewRuntime: MainPreviewRuntimeSetupOptions;
  stepPreviewDebugController: StepPreviewDebugController;
  debugGlobalObject: Record<string, unknown>;
  onStatus: StatusReporter;
  t: AppTranslator;
  lightGizmoElements: GizmoLightElements;
  axisGizmoElements: GizmoAxisElements;
  getCameraOrbit: () => OrbitState;
  getLightDirectionWorld: () => [number, number, number];
}

export interface MainRuntimeBootstrapResult extends MainPreviewRuntimeSetupResult {
  pipelineDropIndicators: PipelineDropIndicatorController;
  mainPreviewCapture: MainPreviewCaptureController;
  pipelineIoSystem: ReturnType<typeof setupMainPipelineIoSystem>;
  mainRenderPipeline: MainRenderPipeline;
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

function ensureHtmlElement(value: unknown, label: string): asserts value is HTMLElement {
  if (!(value instanceof HTMLElement)) {
    throw new Error(`${label} must be an HTMLElement.`);
  }
}

function ensureSvgElement<T extends SVGElement>(
  value: unknown,
  label: string,
  ctor: new (...args: unknown[]) => T,
): asserts value is T {
  if (!(value instanceof ctor)) {
    throw new Error(`${label} must be a ${ctor.name}.`);
  }
}

function ensureLightElements(value: unknown): asserts value is GizmoLightElements {
  ensureObject(value, 'Main runtime bootstrap lightGizmoElements');
  const light = value as Partial<GizmoLightElements>;
  ensureSvgElement(light.layer, 'Main runtime bootstrap light layer', SVGSVGElement);
  ensureSvgElement(light.origin, 'Main runtime bootstrap light origin', SVGCircleElement);
  ensureSvgElement(light.tip, 'Main runtime bootstrap light tip', SVGCircleElement);
  ensureSvgElement(light.label, 'Main runtime bootstrap light label', SVGTextElement);
}

function ensureAxisElements(value: unknown): asserts value is GizmoAxisElements {
  ensureObject(value, 'Main runtime bootstrap axisGizmoElements');
  const axis = value as Partial<GizmoAxisElements>;
  ensureSvgElement(axis.layer, 'Main runtime bootstrap axis layer', SVGSVGElement);
  ensureSvgElement(axis.origin, 'Main runtime bootstrap axis origin', SVGCircleElement);
  ensureSvgElement(axis.lineX, 'Main runtime bootstrap axis lineX', SVGPathElement);
  ensureSvgElement(axis.lineY, 'Main runtime bootstrap axis lineY', SVGPathElement);
  ensureSvgElement(axis.lineZ, 'Main runtime bootstrap axis lineZ', SVGPathElement);
  ensureSvgElement(axis.tipX, 'Main runtime bootstrap axis tipX', SVGCircleElement);
  ensureSvgElement(axis.tipY, 'Main runtime bootstrap axis tipY', SVGCircleElement);
  ensureSvgElement(axis.tipZ, 'Main runtime bootstrap axis tipZ', SVGCircleElement);
  ensureSvgElement(axis.labelX, 'Main runtime bootstrap axis labelX', SVGTextElement);
  ensureSvgElement(axis.labelY, 'Main runtime bootstrap axis labelY', SVGTextElement);
  ensureSvgElement(axis.labelZ, 'Main runtime bootstrap axis labelZ', SVGTextElement);
}

function assertOptions(options: MainRuntimeBootstrapOptions): void {
  ensureObject(options, 'Main runtime bootstrap options');

  ensureFunction(options.getStepListEl, 'Main runtime bootstrap getStepListEl');
  ensureHtmlElement(options.lutStripListEl, 'Main runtime bootstrap lutStripListEl');

  ensureFunction(options.parseStepId, 'Main runtime bootstrap parseStepId');
  ensureFunction(options.getStepReorderDragState, 'Main runtime bootstrap getStepReorderDragState');
  ensureFunction(options.getLutReorderDragState, 'Main runtime bootstrap getLutReorderDragState');

  ensureObject(options.previewRuntime, 'Main runtime bootstrap previewRuntime');
  if (!(options.previewRuntime.canvas instanceof HTMLCanvasElement)) {
    throw new Error('Main runtime bootstrap previewRuntime.canvas must be an HTMLCanvasElement.');
  }

  ensureObject(options.stepPreviewDebugController, 'Main runtime bootstrap stepPreviewDebugController');
  ensureFunction(options.stepPreviewDebugController.registerGlobalDebugApi, 'Main runtime bootstrap stepPreviewDebugController.registerGlobalDebugApi');

  ensureObject(options.debugGlobalObject, 'Main runtime bootstrap debugGlobalObject');
  ensureFunction(options.onStatus, 'Main runtime bootstrap onStatus');
  ensureFunction(options.t, 'Main runtime bootstrap t');

  ensureLightElements(options.lightGizmoElements);
  ensureAxisElements(options.axisGizmoElements);
  ensureFunction(options.getCameraOrbit, 'Main runtime bootstrap getCameraOrbit');
  ensureFunction(options.getLightDirectionWorld, 'Main runtime bootstrap getLightDirectionWorld');
}

export function bootstrapMainRuntime(
  options: MainRuntimeBootstrapOptions,
): MainRuntimeBootstrapResult {
  assertOptions(options);

  const pipelineDropIndicators = createPipelineDropIndicatorController({
    getStepListEl: options.getStepListEl,
    lutStripListEl: options.lutStripListEl,
    parseStepId: options.parseStepId,
    getStepReorderDragState: options.getStepReorderDragState,
    getLutReorderDragState: options.getLutReorderDragState,
  });

  const previewRuntime = setupMainPreviewRuntime(options.previewRuntime);

  options.stepPreviewDebugController.registerGlobalDebugApi({
    globalObject: options.debugGlobalObject,
  });

  let mainRenderPipeline: MainRenderPipeline | null = null;

  const mainPreviewCapture = createMainPreviewCaptureController({
    getRenderer: () => previewRuntime.renderer,
    getRenderSystem: () => mainRenderPipeline?.renderSystem ?? null,
    getStepPreviewSystem: () => previewRuntime.stepPreviewSystem,
    onStatus: options.onStatus,
    t: options.t,
  });

  const pipelineIoSystem = setupMainPipelineIoSystem({
    getLuts: options.previewRuntime.getLuts,
    getSteps: options.previewRuntime.getSteps,
    getCustomParams: options.previewRuntime.getCustomParams,
    getStepPreviewSystem: () => previewRuntime.stepPreviewSystem,
    t: options.t,
  });

  mainRenderPipeline = setupMainRenderPipeline({
    renderer: previewRuntime.renderer,
    lightGizmoElements: options.lightGizmoElements,
    axisGizmoElements: options.axisGizmoElements,
    getCameraOrbit: options.getCameraOrbit,
    getLightSettings: options.previewRuntime.getLightSettings,
    getLightDirectionWorld: options.getLightDirectionWorld,
    getMaterialSettings: options.previewRuntime.getMaterialSettings,
    getCustomParams: options.previewRuntime.getCustomParams,
    shouldSuppressLightGuide: () => mainPreviewCapture.isSuppressLightGuide(),
    onSettleFrameCapture: canvas => mainPreviewCapture.settleFromFrame(canvas),
  });

  return {
    pipelineDropIndicators,
    renderer: previewRuntime.renderer,
    pipelineApply: previewRuntime.pipelineApply,
    previewShapeController: previewRuntime.previewShapeController,
    stepPreviewRenderer: previewRuntime.stepPreviewRenderer,
    stepPreviewSystem: previewRuntime.stepPreviewSystem,
    mainPreviewCapture,
    pipelineIoSystem,
    mainRenderPipeline,
  };
}
