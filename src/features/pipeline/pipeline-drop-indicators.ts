import {
  getLinearDropPlacement,
  type LinearDropCandidate,
} from '../../shared/interactions/dnd.ts';
import * as pipelineView from './pipeline-view.ts';
import type {
  LutReorderDragState,
  StepReorderDragState,
} from './pipeline-view.ts';

export interface StepDropPlacement {
  stepId: number | null;
  after: boolean;
}

export interface LutDropPlacement {
  lutId: string | null;
  after: boolean;
}

export interface PipelineDropIndicatorController {
  clearStepDropIndicators: () => void;
  updateStepDropIndicators: () => void;
  getStepDropPlacement: (clientY: number) => StepDropPlacement;
  clearLutDropIndicators: () => void;
  updateLutDropIndicators: () => void;
  getLutDropPlacement: (clientX: number) => LutDropPlacement;
}

export interface PipelineDropIndicatorControllerOptions {
  stepListEl: HTMLElement;
  lutStripListEl: HTMLElement;
  parseStepId: (value: string | undefined) => number | null;
  getStepReorderDragState: () => StepReorderDragState | null;
  getLutReorderDragState: () => LutReorderDragState | null;
}

function isHTMLElement(value: unknown): value is HTMLElement {
  return value instanceof HTMLElement;
}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} が不正です。`);
  }
}

function ensureFiniteNumber(value: unknown, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} は有限の数値で指定してください。`);
  }
}

function ensureOptions(value: unknown): asserts value is PipelineDropIndicatorControllerOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('PipelineDropIndicatorController の options が不正です。');
  }

  const options = value as Partial<PipelineDropIndicatorControllerOptions>;
  if (!isHTMLElement(options.stepListEl)) {
    throw new Error('PipelineDropIndicatorController: stepListEl が不正です。');
  }
  if (!isHTMLElement(options.lutStripListEl)) {
    throw new Error('PipelineDropIndicatorController: lutStripListEl が不正です。');
  }

  ensureFunction(options.parseStepId, 'PipelineDropIndicatorController: parseStepId');
  ensureFunction(options.getStepReorderDragState, 'PipelineDropIndicatorController: getStepReorderDragState');
  ensureFunction(options.getLutReorderDragState, 'PipelineDropIndicatorController: getLutReorderDragState');
}

export function createPipelineDropIndicatorController(
  options: PipelineDropIndicatorControllerOptions,
): PipelineDropIndicatorController {
  ensureOptions(options);

  const clearStepDropIndicators = (): void => {
    pipelineView.clearStepDropIndicators(options.stepListEl);
  };

  const updateStepDropIndicators = (): void => {
    pipelineView.updateStepDropIndicators(options.stepListEl, options.getStepReorderDragState());
  };

  const getStepDropPlacement = (clientY: number): StepDropPlacement => {
    ensureFiniteNumber(clientY, 'Step ドロップ位置(clientY)');

    const stepReorderDragState = options.getStepReorderDragState();
    const candidates: LinearDropCandidate<number>[] = [];

    for (const item of Array.from(options.stepListEl.querySelectorAll<HTMLElement>('.step-item'))) {
      const itemStepId = options.parseStepId(item.dataset.stepId);
      if (itemStepId === null || itemStepId === stepReorderDragState?.stepId) {
        continue;
      }

      const rect = item.getBoundingClientRect();
      candidates.push({
        id: itemStepId,
        midpoint: rect.top + rect.height * 0.5,
      });
    }

    const placement = getLinearDropPlacement(candidates, clientY);
    return { stepId: placement.targetId, after: placement.after };
  };

  const clearLutDropIndicators = (): void => {
    pipelineView.clearLutDropIndicators(options.lutStripListEl);
  };

  const updateLutDropIndicators = (): void => {
    pipelineView.updateLutDropIndicators(options.lutStripListEl, options.getLutReorderDragState());
  };

  const getLutDropPlacement = (clientX: number): LutDropPlacement => {
    ensureFiniteNumber(clientX, 'LUT ドロップ位置(clientX)');

    const lutReorderDragState = options.getLutReorderDragState();
    const candidates: LinearDropCandidate<string>[] = [];

    for (const item of Array.from(options.lutStripListEl.querySelectorAll<HTMLElement>('.lut-strip-item'))) {
      const lutId = item.dataset.lutId;
      if (!lutId || lutId === lutReorderDragState?.lutId) {
        continue;
      }

      const rect = item.getBoundingClientRect();
      candidates.push({
        id: lutId,
        midpoint: rect.left + rect.width * 0.5,
      });
    }

    const placement = getLinearDropPlacement(candidates, clientX);
    return { lutId: placement.targetId, after: placement.after };
  };

  return {
    clearStepDropIndicators,
    updateStepDropIndicators,
    getStepDropPlacement,
    clearLutDropIndicators,
    updateLutDropIndicators,
    getLutDropPlacement,
  };
}
