import type { MaterialSettings } from '../../../../features/pipeline/pipeline-model.ts';
import type { CustomParamModel, LutModel, StepModel } from '../../../../features/step/step-model.ts';
import { cloneMaterialSettings } from '../panels/shared.ts';
import { cloneCustomParamArray, cloneLutArray, cloneStepArray } from './shared.ts';

export interface ParamNodeListElement extends HTMLElement {
  materialSettings: MaterialSettings;
  customParams: CustomParamModel[];
}

export interface StepListElement extends HTMLElement {
  steps: StepModel[];
  luts: LutModel[];
  customParams: CustomParamModel[];
  preservedScrollTop: number;
  preservedScrollLeft: number;
  restoreNonce: number;
}

export interface LutStripListElement extends HTMLElement {
  luts: LutModel[];
  steps: StepModel[];
}

export function getMountedStepListElement(): HTMLElement | null {
  const element = document.querySelector<HTMLElement>('#step-column');
  return element instanceof HTMLElement ? element : null;
}

export function syncParamNodeListMaterialSettings(nextSettings: MaterialSettings): void {
  const element = document.querySelector<ParamNodeListElement>('#param-node-list');
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.materialSettings = cloneMaterialSettings(nextSettings);
}

export function syncParamNodeListState(nextCustomParams: CustomParamModel[]): void {
  const element = document.querySelector<ParamNodeListElement>('#param-node-list');
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.customParams = cloneCustomParamArray(nextCustomParams);
}

function getStepListScrollRoot(): HTMLElement | null {
  return getMountedStepListElement()?.querySelector<HTMLElement>('.step-root') ?? null;
}

let preservedScrollTop = 0;
let preservedScrollLeft = 0;
let restoreNonce = 0;

export function syncStepListState(nextSteps: StepModel[], nextLuts: LutModel[], nextCustomParams: CustomParamModel[]): void {
  const element = document.querySelector<StepListElement>('#step-column');
  if (!(element instanceof HTMLElement)) {
    return;
  }

  const scrollRoot = getStepListScrollRoot();
  if (scrollRoot instanceof HTMLElement) {
    preservedScrollTop = scrollRoot.scrollTop;
    preservedScrollLeft = scrollRoot.scrollLeft;
  }

  restoreNonce += 1;
  element.preservedScrollTop = preservedScrollTop;
  element.preservedScrollLeft = preservedScrollLeft;
  element.restoreNonce = restoreNonce;
  element.steps = cloneStepArray(nextSteps);
  element.luts = cloneLutArray(nextLuts);
  element.customParams = cloneCustomParamArray(nextCustomParams);
}

export function syncLutStripListState(nextLuts: LutModel[], nextSteps: StepModel[]): void {
  const element = document.querySelector<LutStripListElement>('#lut-strip-list');
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.luts = cloneLutArray(nextLuts);
  element.steps = cloneStepArray(nextSteps);
}
