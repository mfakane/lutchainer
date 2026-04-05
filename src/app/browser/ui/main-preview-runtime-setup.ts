import type { PipelineApplyController } from '../pipeline/pipeline-apply.ts';
import { createPipelineApplyController } from '../pipeline/pipeline-apply.ts';
import type { LightSettings, MaterialSettings } from '../../../features/pipeline/pipeline-model.ts';
import type { LutModel, StepModel } from '../../../features/step/step-model.ts';
import {
  createStepPreviewSystem,
} from '../step/step-preview-system.ts';
import {
  createStepPreviewRenderer,
  type StepPreviewRenderer,
} from '../../../platforms/webgl/step-preview-renderer.ts';
import type { ShaderBuildInput } from '../../../features/shader/shader-generator.ts';
import type { PreviewShapeType } from '../components/solid-preview-shape-bar.tsx';
import type { PreviewShapeController } from './preview-shape-controller.ts';
import { createPreviewShapeController } from './preview-shape-controller.ts';
import { Renderer } from '../../../platforms/webgl/renderer.ts';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;
type Translator = (key: unknown, values?: Record<string, string | number>) => string;

export interface MainPreviewRuntimeSetupOptions {
  canvas: HTMLCanvasElement;
  getShaderBuildInput: () => ShaderBuildInput;
  isAutoApplyEnabled: () => boolean;
  onUpdateShaderCodePanel: (frag: string) => void;
  onStatus: StatusReporter;
  t: Translator;
  getWireframeEnabled: () => boolean;
  setWireframeEnabled: (enabled: boolean) => void;
  syncPreviewShapeState: (shape: PreviewShapeType) => void;
  syncPreviewWireframeState: (enabled: boolean) => void;
  getSteps: () => StepModel[];
  getLuts: () => LutModel[];
  getMaterialSettings: () => MaterialSettings;
  getLightSettings: () => LightSettings;
  stepPreviewLightDirection: readonly [number, number, number];
  stepPreviewViewDirection: readonly [number, number, number];
}

export interface MainPreviewRuntimeSetupResult {
  renderer: Renderer;
  pipelineApply: PipelineApplyController;
  previewShapeController: PreviewShapeController;
  stepPreviewRenderer: StepPreviewRenderer | null;
  stepPreviewSystem: ReturnType<typeof createStepPreviewSystem>;
}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} が不正です。`);
  }
}

function isFiniteTuple3(value: unknown): value is readonly [number, number, number] {
  return Array.isArray(value)
    && value.length === 3
    && Number.isFinite(value[0])
    && Number.isFinite(value[1])
    && Number.isFinite(value[2]);
}

function ensureOptions(value: unknown): asserts value is MainPreviewRuntimeSetupOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Main preview runtime setup options が不正です。');
  }

  const options = value as Partial<MainPreviewRuntimeSetupOptions>;
  if (!(options.canvas instanceof HTMLCanvasElement)) {
    throw new Error('Main preview runtime setup: canvas が不正です。');
  }

  ensureFunction(options.getShaderBuildInput, 'Main preview runtime setup: getShaderBuildInput');
  ensureFunction(options.isAutoApplyEnabled, 'Main preview runtime setup: isAutoApplyEnabled');
  ensureFunction(options.onUpdateShaderCodePanel, 'Main preview runtime setup: onUpdateShaderCodePanel');
  ensureFunction(options.onStatus, 'Main preview runtime setup: onStatus');
  ensureFunction(options.t, 'Main preview runtime setup: t');
  ensureFunction(options.getWireframeEnabled, 'Main preview runtime setup: getWireframeEnabled');
  ensureFunction(options.setWireframeEnabled, 'Main preview runtime setup: setWireframeEnabled');
  ensureFunction(options.syncPreviewShapeState, 'Main preview runtime setup: syncPreviewShapeState');
  ensureFunction(options.syncPreviewWireframeState, 'Main preview runtime setup: syncPreviewWireframeState');
  ensureFunction(options.getSteps, 'Main preview runtime setup: getSteps');
  ensureFunction(options.getLuts, 'Main preview runtime setup: getLuts');
  ensureFunction(options.getMaterialSettings, 'Main preview runtime setup: getMaterialSettings');
  ensureFunction(options.getLightSettings, 'Main preview runtime setup: getLightSettings');

  if (!isFiniteTuple3(options.stepPreviewLightDirection)) {
    throw new Error('Main preview runtime setup: stepPreviewLightDirection が不正です。');
  }
  if (!isFiniteTuple3(options.stepPreviewViewDirection)) {
    throw new Error('Main preview runtime setup: stepPreviewViewDirection が不正です。');
  }
}

export function setupMainPreviewRuntime(options: MainPreviewRuntimeSetupOptions): MainPreviewRuntimeSetupResult {
  ensureOptions(options);

  const renderer = new Renderer(options.canvas);

  const pipelineApply = createPipelineApplyController({
    getShaderBuildInput: options.getShaderBuildInput,
    renderer,
    isAutoApplyEnabled: options.isAutoApplyEnabled,
    onUpdateShaderCodePanel: options.onUpdateShaderCodePanel,
    onStatus: options.onStatus,
    t: options.t,
  });

  const previewShapeController = createPreviewShapeController({
    renderer,
    initialShape: 'sphere',
    getWireframeEnabled: options.getWireframeEnabled,
    setWireframeEnabled: options.setWireframeEnabled,
    syncPreviewShapeState: options.syncPreviewShapeState,
    syncPreviewWireframeState: options.syncPreviewWireframeState,
    onStatus: options.onStatus,
    t: options.t,
  });

  const wireframeEnabled = options.getWireframeEnabled();
  if (typeof wireframeEnabled !== 'boolean') {
    throw new Error('Main preview runtime setup: getWireframeEnabled の戻り値が不正です。');
  }
  renderer.setWireframeOverlayEnabled(wireframeEnabled);

  const stepPreviewCanvas = document.createElement('canvas');
  const stepPreviewRenderer = createStepPreviewRenderer({
    canvas: stepPreviewCanvas,
  });
  const stepPreviewSystem = createStepPreviewSystem({
    getSteps: options.getSteps,
    getLuts: options.getLuts,
    getMaterialSettings: options.getMaterialSettings,
    getLightSettings: options.getLightSettings,
    getStepPreviewRenderer: () => stepPreviewRenderer,
    onError: message => options.onStatus(message, 'error'),
    lightDirection: options.stepPreviewLightDirection,
    viewDirection: options.stepPreviewViewDirection,
  });

  return {
    renderer,
    pipelineApply,
    previewShapeController,
    stepPreviewRenderer,
    stepPreviewSystem,
  };
}
