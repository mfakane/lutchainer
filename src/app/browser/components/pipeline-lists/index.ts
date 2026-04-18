import type { CustomParamModel, LutModel, StepModel } from '../../../../features/step/step-model.ts';
import {
  cloneCustomParamArray,
  cloneLutArray,
  cloneStepArray,
  ensureLutStripListMountOptions,
  ensureParamNodeListMountOptions,
  ensureStepListMountOptions,
  isValidCustomParamModel,
  isValidLutModel,
  isValidStepModel,
  type LutStripListMountOptions,
  type ParamNodeListMountOptions,
  type StatusReporter,
  type StepListMountOptions,
} from './shared.ts';
import { mountSvelteHost, type SvelteHostElement } from '../custom-element-host.ts';
import './svelte-lut-strip-list.svelte';
import './svelte-param-node-list.svelte';
import './svelte-step-list.svelte';

let disposeParamNodeList: (() => void) | null = null;
let disposeStepList: (() => void) | null = null;
let disposeLutStripList: (() => void) | null = null;

let syncParamNodeListInternal: ((customParams: CustomParamModel[]) => void) | null = null;
let syncStepListInternal: ((steps: StepModel[], luts: LutModel[], customParams: CustomParamModel[]) => void) | null = null;
let syncLutStripListInternal: ((luts: LutModel[], steps: StepModel[]) => void) | null = null;

let paramNodeListStatusReporter: StatusReporter = () => undefined;
let stepListStatusReporter: StatusReporter = () => undefined;
let lutStripStatusReporter: StatusReporter = () => undefined;
let paramNodeHost: SvelteHostElement<Record<string, unknown>> | null = null;
let stepListHost: SvelteHostElement<Record<string, unknown>> | null = null;
let lutStripHost: SvelteHostElement<Record<string, unknown>> | null = null;

export function getMountedStepListElement(): HTMLElement | null {
  if (stepListHost instanceof HTMLElement) {
    return stepListHost;
  }

  const fallback = document.querySelector<HTMLElement>('#step-column');
  return fallback instanceof HTMLElement ? fallback : null;
}

function getStepListScrollRoot(): HTMLElement | null {
  return getMountedStepListElement()?.querySelector('.step-root') ?? null;
}

function captureStepListScrollSnapshot(): { top: number; left: number } {
  const scrollRoot = getStepListScrollRoot();
  if (!(scrollRoot instanceof HTMLElement)) {
    return { top: 0, left: 0 };
  }

  return {
    top: scrollRoot.scrollTop,
    left: scrollRoot.scrollLeft,
  };
}

export function mountParamNodeList(target: HTMLElement, options: ParamNodeListMountOptions): void {
  if (!(target instanceof HTMLElement)) {
    throw new Error('Paramノードリストの描画先要素が不正です。');
  }

  ensureParamNodeListMountOptions(options);
  paramNodeListStatusReporter = options.onStatus;

  if (disposeParamNodeList) {
    disposeParamNodeList();
    disposeParamNodeList = null;
  }

  paramNodeHost?.destroyHost();
  paramNodeHost = mountSvelteHost({
    tagName: 'lut-param-node-list',
    target,
    props: {
      getMaterialSettings: options.getMaterialSettings,
      customParams: cloneCustomParamArray(options.customParams),
      onAddCustomParam: options.onAddCustomParam,
      onRenameCustomParam: options.onRenameCustomParam,
      onSetCustomParamValue: options.onSetCustomParamValue,
      onCommitCustomParamValueChange: options.onCommitCustomParamValueChange,
      onRemoveCustomParam: options.onRemoveCustomParam,
      onStatus: options.onStatus,
    },
  });
  disposeParamNodeList = () => {
    paramNodeHost?.destroyHost();
    paramNodeHost = null;
  };
  syncParamNodeListInternal = nextCustomParams => {
    if (!Array.isArray(nextCustomParams) || nextCustomParams.some(customParam => !isValidCustomParamModel(customParam))) {
      paramNodeListStatusReporter('Paramノードリストの同期Custom Param配列が不正です。', 'error');
      return;
    }
    paramNodeHost?.setHostProps({
      customParams: cloneCustomParamArray(nextCustomParams),
    });
  };
}

export function mountStepList(target: HTMLElement, options: StepListMountOptions): void {
  if (!(target instanceof HTMLElement)) {
    throw new Error('Stepリストの描画先要素が不正です。');
  }

  ensureStepListMountOptions(options);
  stepListStatusReporter = options.onStatus;

  if (disposeStepList) {
    disposeStepList();
    disposeStepList = null;
  }

  stepListHost?.destroyHost();
  let preservedScrollTop = 0;
  let preservedScrollLeft = 0;
  let restoreNonce = 0;
  let hasPendingMutationSnapshot = false;
  let deferredZeroCaptureTimer: number | null = null;

  const syncPreservedScroll = (top: number, left: number): void => {
    preservedScrollTop = top;
    preservedScrollLeft = left;
  };
  const clearDeferredZeroCapture = (): void => {
    if (deferredZeroCaptureTimer === null) {
      return;
    }
    window.clearTimeout(deferredZeroCaptureTimer);
    deferredZeroCaptureTimer = null;
  };
  const captureBeforeMutation = (): void => {
    clearDeferredZeroCapture();
    if (preservedScrollTop === 0 && preservedScrollLeft === 0) {
      const snapshot = captureStepListScrollSnapshot();
      syncPreservedScroll(snapshot.top, snapshot.left);
    }
    hasPendingMutationSnapshot = true;
  };
  const wrapMutation = <Args extends unknown[]>(callback: (...args: Args) => void) => (...args: Args): void => {
    captureBeforeMutation();
    callback(...args);
  };

  stepListHost = mountSvelteHost({
    tagName: 'lut-step-list',
    target,
    replayProps: false,
    props: {
      preservedScrollTop,
      preservedScrollLeft,
      restoreNonce,
      steps: cloneStepArray(options.steps),
      luts: cloneLutArray(options.luts),
      customParams: cloneCustomParamArray(options.customParams),
      onCaptureScroll: (top: number, left: number) => {
        if (hasPendingMutationSnapshot) {
          return;
        }
        const shouldDeferZeroCapture = (top === 0 && preservedScrollTop > 0) || (left === 0 && preservedScrollLeft > 0);
        if (shouldDeferZeroCapture) {
          clearDeferredZeroCapture();
          deferredZeroCaptureTimer = window.setTimeout(() => {
            deferredZeroCaptureTimer = null;
            if (hasPendingMutationSnapshot) {
              return;
            }
            syncPreservedScroll(top, left);
          }, 120);
          return;
        }
        clearDeferredZeroCapture();
        syncPreservedScroll(top, left);
      },
      onAddStep: wrapMutation(options.onAddStep),
      onDuplicateStep: wrapMutation(options.onDuplicateStep),
      onRemoveStep: wrapMutation(options.onRemoveStep),
      onStepMuteChange: wrapMutation(options.onStepMuteChange),
      onStepLabelChange: wrapMutation(options.onStepLabelChange),
      onStepLutChange: wrapMutation(options.onStepLutChange),
      onStepBlendModeChange: wrapMutation(options.onStepBlendModeChange),
      onStepOpChange: wrapMutation(options.onStepOpChange),
      shouldSuppressClick: options.shouldSuppressClick,
      onOpenPipelineFilePicker: options.onOpenPipelineFilePicker,
      onLoadExample: options.onLoadExample,
      onScheduleConnectionDraw: options.onScheduleConnectionDraw,
      computeLutUv: options.computeLutUv,
      onStatus: options.onStatus,
    },
  });
  disposeStepList = () => {
    stepListHost?.destroyHost();
    stepListHost = null;
  };

  syncStepListInternal = (nextSteps, nextLuts, nextCustomParams) => {
    if (!Array.isArray(nextSteps) || nextSteps.some(step => !isValidStepModel(step))) {
      stepListStatusReporter('Stepリストの同期Step配列が不正です。', 'error');
      return;
    }
    if (!Array.isArray(nextLuts) || nextLuts.some(lut => !isValidLutModel(lut))) {
      stepListStatusReporter('Stepリストの同期LUT配列が不正です。', 'error');
      return;
    }
    if (!Array.isArray(nextCustomParams) || nextCustomParams.some(customParam => !isValidCustomParamModel(customParam))) {
      stepListStatusReporter('Stepリストの同期Custom Param配列が不正です。', 'error');
      return;
    }

    if (!hasPendingMutationSnapshot) {
      const snapshot = captureStepListScrollSnapshot();
      syncPreservedScroll(snapshot.top, snapshot.left);
    }
    clearDeferredZeroCapture();
    restoreNonce += 1;
    stepListHost?.setHostProps({
      preservedScrollTop,
      preservedScrollLeft,
      restoreNonce,
      steps: cloneStepArray(nextSteps),
      luts: cloneLutArray(nextLuts),
      customParams: cloneCustomParamArray(nextCustomParams),
    });
    hasPendingMutationSnapshot = false;
  };
}

export function mountLutStripList(target: HTMLElement, options: LutStripListMountOptions): void {
  if (!(target instanceof HTMLElement)) {
    throw new Error('LUTストリップリストの描画先要素が不正です。');
  }

  ensureLutStripListMountOptions(options);
  lutStripStatusReporter = options.onStatus;

  if (disposeLutStripList) {
    disposeLutStripList();
    disposeLutStripList = null;
  }

  lutStripHost?.destroyHost();
  lutStripHost = mountSvelteHost({
    tagName: 'lut-lut-strip-list',
    target,
    props: {
      luts: cloneLutArray(options.luts),
      steps: cloneStepArray(options.steps),
      onRemoveLut: options.onRemoveLut,
      onAddLutFiles: options.onAddLutFiles,
      onEditLut: options.onEditLut,
      onDuplicateLut: options.onDuplicateLut,
      onNewLut: options.onNewLut,
      onStatus: options.onStatus,
    },
  });
  disposeLutStripList = () => {
    lutStripHost?.destroyHost();
    lutStripHost = null;
  };
  syncLutStripListInternal = (nextLuts, nextSteps) => {
    if (!Array.isArray(nextLuts) || nextLuts.some(lut => !isValidLutModel(lut))) {
      lutStripStatusReporter('LUTストリップの同期LUT配列が不正です。', 'error');
      return;
    }
    if (!Array.isArray(nextSteps) || nextSteps.some(step => !isValidStepModel(step))) {
      lutStripStatusReporter('LUTストリップの同期Step配列が不正です。', 'error');
      return;
    }

    lutStripHost?.setHostProps({
      luts: cloneLutArray(nextLuts),
      steps: cloneStepArray(nextSteps),
    });
  };
}

export function syncParamNodeListState(nextCustomParams: CustomParamModel[]): void {
  syncParamNodeListInternal?.(nextCustomParams);
}

export function syncStepListState(nextSteps: StepModel[], nextLuts: LutModel[], nextCustomParams: CustomParamModel[]): void {
  syncStepListInternal?.(nextSteps, nextLuts, nextCustomParams);
}

export function syncLutStripListState(nextLuts: LutModel[], nextSteps: StepModel[]): void {
  syncLutStripListInternal?.(nextLuts, nextSteps);
}
