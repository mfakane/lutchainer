import {
  syncParamNodeListState,
  syncLutStripListState,
  syncStepListState,
} from '../components/pipeline-lists/index.ts';
import type {
  LightSettings,
  MaterialSettings,
} from '../../../features/pipeline/pipeline-model.ts';
import * as pipelineModel from '../../../features/pipeline/pipeline-model.ts';
import type {
  CustomParamModel,
  LutModel,
  StepModel,
} from '../../../features/step/step-model.ts';
import type { AppTranslator } from '../../../shared/i18n/browser-translation-contract.ts';
import type { StepPreviewRenderer } from '../../../platforms/webgl/step-preview-renderer.ts';
import { updateStepSwatches as updateStepSwatchesHelper } from './step-swatch-updater.ts';

interface StepPreviewSystemLike {
  bumpPipelineVersion: () => void;
  ensureStepPreviewProgram: () => boolean;
  drawSpherePreview: (canvas: HTMLCanvasElement, stepIndex: number) => void;
  reportError: (message: string) => void;
}

export interface MainStepRenderingControllerOptions {
  getStepListElement: () => HTMLElement;
  getSteps: () => StepModel[];
  getLuts: () => LutModel[];
  getCustomParams: () => CustomParamModel[];
  getMaterialSettings: () => MaterialSettings;
  getLightSettings: () => LightSettings;
  getStepPreviewRenderer: () => StepPreviewRenderer | null;
  getStepPreviewSystem: () => StepPreviewSystemLike | null;
  onUpdateShaderCodePanel: () => void;
  onScheduleConnectionDraw: () => void;
  t: AppTranslator;
}

export interface MainStepRenderingController {
  normalizeSteps: () => void;
  renderLutStrip: () => void;
  renderSteps: () => void;
  updateStepSwatches: () => void;
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

function assertOptions(options: MainStepRenderingControllerOptions): void {
  ensureObject(options, 'Main step rendering options');
  ensureFunction(options.getStepListElement, 'Main step rendering getStepListElement');
  ensureFunction(options.getSteps, 'Main step rendering getSteps');
  ensureFunction(options.getLuts, 'Main step rendering getLuts');
  ensureFunction(options.getCustomParams, 'Main step rendering getCustomParams');
  ensureFunction(options.getMaterialSettings, 'Main step rendering getMaterialSettings');
  ensureFunction(options.getLightSettings, 'Main step rendering getLightSettings');
  ensureFunction(options.getStepPreviewRenderer, 'Main step rendering getStepPreviewRenderer');
  ensureFunction(options.getStepPreviewSystem, 'Main step rendering getStepPreviewSystem');
  ensureFunction(options.onUpdateShaderCodePanel, 'Main step rendering onUpdateShaderCodePanel');
  ensureFunction(options.onScheduleConnectionDraw, 'Main step rendering onScheduleConnectionDraw');
  ensureFunction(options.t, 'Main step rendering t');
}

export function createMainStepRenderingController(
  options: MainStepRenderingControllerOptions,
): MainStepRenderingController {
  assertOptions(options);

  const scheduleConnectionDrawAfterStepListSync = (): void => {
    // 現状はこれでよいが、もしスクロール状態で step を編集した際に線が暴れるようなら queueMicrotask(f) や setTimeout(f, 0) を挟むことも検討する
    options.onScheduleConnectionDraw();
  };

  const normalizeSteps = (): void => {
    pipelineModel.normalizeSteps(options.getSteps(), options.getLuts());
  };

  const renderLutStrip = (): void => {
    syncLutStripListState(options.getLuts(), options.getSteps());
  };

  const updateStepSwatches = (): void => {
    const stepPreviewSystem = options.getStepPreviewSystem();
    if (!stepPreviewSystem) {
      return;
    }

    const steps = options.getSteps();
    if (steps.length === 0) {
      return;
    }

    const stepListEl = options.getStepListElement();
    if (!(stepListEl instanceof HTMLElement)) {
      throw new Error('Main step rendering stepListEl must be an HTMLElement.');
    }

    updateStepSwatchesHelper({
      stepListEl,
      steps,
      customParams: options.getCustomParams(),
      materialSettings: options.getMaterialSettings(),
      lightSettings: options.getLightSettings(),
      stepPreviewRenderer: options.getStepPreviewRenderer(),
      canUseWebglPreview: stepPreviewSystem.ensureStepPreviewProgram(),
      drawSpherePreviewCpu: (canvas, index) => stepPreviewSystem.drawSpherePreview(canvas, index),
      onWebglDrawError: message => stepPreviewSystem.reportError(
        options.t('main.status.stepPreviewWebglDrawFailed', { message }),
      ),
    });
  };

  const renderSteps = (): void => {
    const steps = options.getSteps();
    const luts = options.getLuts();
    const customParams = options.getCustomParams();
    options.getStepPreviewSystem()?.bumpPipelineVersion();

    syncStepListState(steps, luts, customParams);
    syncParamNodeListState(customParams);
    renderLutStrip();
    options.onUpdateShaderCodePanel();

    if (steps.length === 0) {
      scheduleConnectionDrawAfterStepListSync();
      return;
    }

    updateStepSwatches();
    scheduleConnectionDrawAfterStepListSync();
  };

  return {
    normalizeSteps,
    renderLutStrip,
    renderSteps,
    updateStepSwatches,
  };
}
