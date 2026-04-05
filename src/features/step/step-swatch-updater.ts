import type {
  LightSettings,
  MaterialSettings,
} from '../pipeline/pipeline-model';
import {
  STEP_PREVIEW_LIGHT_DIR,
} from '../pipeline/pipeline-model';
import type { StepModel } from './step-model';
import { StepPreviewRenderer } from './step-preview-renderer';

export interface UpdateStepSwatchesInput {
  stepListEl: HTMLElement;
  steps: readonly StepModel[];
  materialSettings: MaterialSettings;
  lightSettings: LightSettings;
  stepPreviewRenderer: StepPreviewRenderer | null;
  canUseWebglPreview: boolean;
  drawSpherePreviewCpu: (canvas: HTMLCanvasElement, stepIndex: number) => void;
  onWebglDrawError: (message: string) => void;
}

function assertValidInput(input: UpdateStepSwatchesInput): void {
  if (!input || typeof input !== 'object') {
    throw new Error('step swatch 更新入力が不正です。');
  }
  if (!(input.stepListEl instanceof HTMLElement)) {
    throw new Error('stepListEl が不正です。');
  }
  if (!Array.isArray(input.steps)) {
    throw new Error('steps は配列で指定してください。');
  }
  if (typeof input.drawSpherePreviewCpu !== 'function') {
    throw new Error('drawSpherePreviewCpu は関数で指定してください。');
  }
  if (typeof input.onWebglDrawError !== 'function') {
    throw new Error('onWebglDrawError は関数で指定してください。');
  }
}

export function updateStepSwatches(input: UpdateStepSwatchesInput): void {
  assertValidInput(input);

  const {
    stepListEl,
    steps,
    materialSettings,
    lightSettings,
    stepPreviewRenderer,
    canUseWebglPreview,
    drawSpherePreviewCpu,
    onWebglDrawError,
  } = input;

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (!step || typeof step.id !== 'string' || step.id.trim().length === 0) {
      continue;
    }

    const stepId = step.id;
    const afterCanvas = stepListEl.querySelector<HTMLCanvasElement>(
      `.preview-sphere[data-step-id="${stepId}"][data-preview="after"]`,
    );
    if (!afterCanvas) {
      continue;
    }

    if (canUseWebglPreview && stepPreviewRenderer) {
      const drawError = stepPreviewRenderer.drawToCanvas(afterCanvas, {
        targetStepIndex: index,
        baseColor: materialSettings.baseColor,
        lightIntensity: lightSettings.lightIntensity,
        lightColor: lightSettings.lightColor,
        ambientColor: lightSettings.ambientColor,
        specularStrength: materialSettings.specularStrength,
        specularPower: materialSettings.specularPower,
        fresnelStrength: materialSettings.fresnelStrength,
        fresnelPower: materialSettings.fresnelPower,
        lightDirection: STEP_PREVIEW_LIGHT_DIR,
      });

      if (!drawError) {
        continue;
      }

      onWebglDrawError(drawError);
    }

    drawSpherePreviewCpu(afterCanvas, index);
  }
}
