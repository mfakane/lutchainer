import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
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
import { StepList } from './solid-step-list.tsx';

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
let lutStripHost: SvelteHostElement<Record<string, unknown>> | null = null;

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

  target.textContent = '';
  disposeStepList = render(() => {
    const [steps, setSteps] = createSignal<StepModel[]>(cloneStepArray(options.steps));
    const [luts, setLuts] = createSignal<LutModel[]>(cloneLutArray(options.luts));
    const [customParams, setCustomParams] = createSignal<CustomParamModel[]>(cloneCustomParamArray(options.customParams));

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

      setSteps(cloneStepArray(nextSteps));
      setLuts(cloneLutArray(nextLuts));
      setCustomParams(cloneCustomParamArray(nextCustomParams));
    };

    return (
      <StepList
        steps={steps}
        luts={luts}
        customParams={customParams}
        onAddStep={options.onAddStep}
        onDuplicateStep={options.onDuplicateStep}
        onRemoveStep={options.onRemoveStep}
        onStepMuteChange={options.onStepMuteChange}
        onStepLabelChange={options.onStepLabelChange}
        onStepLutChange={options.onStepLutChange}
        onStepBlendModeChange={options.onStepBlendModeChange}
        onStepOpChange={options.onStepOpChange}
        shouldSuppressClick={options.shouldSuppressClick}
        onOpenPipelineFilePicker={options.onOpenPipelineFilePicker}
        onLoadExample={options.onLoadExample}
        onScheduleConnectionDraw={options.onScheduleConnectionDraw}
        computeLutUv={options.computeLutUv}
        onStatus={options.onStatus}
      />
    );
  }, target);
}

export function mountLutStripList(target: HTMLElement, options: LutStripListMountOptions): void {
  if (!(target instanceof HTMLElement)) {
    throw new Error('LUTストリップの描画先要素が不正です。');
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

export function syncStepListState(steps: StepModel[], luts: LutModel[], customParams: CustomParamModel[]): void {
  if (!Array.isArray(steps) || steps.some(step => !isValidStepModel(step))) {
    stepListStatusReporter('Stepリスト同期に失敗しました: Step配列が不正です。', 'error');
    return;
  }
  if (!Array.isArray(luts) || luts.some(lut => !isValidLutModel(lut))) {
    stepListStatusReporter('Stepリスト同期に失敗しました: LUT配列が不正です。', 'error');
    return;
  }
  if (!Array.isArray(customParams) || customParams.some(customParam => !isValidCustomParamModel(customParam))) {
    stepListStatusReporter('Stepリスト同期に失敗しました: Custom Param配列が不正です。', 'error');
    return;
  }

  syncStepListInternal?.(steps, luts, customParams);
}

export function syncParamNodeListState(customParams: CustomParamModel[]): void {
  if (!Array.isArray(customParams) || customParams.some(customParam => !isValidCustomParamModel(customParam))) {
    paramNodeListStatusReporter('Paramノードリスト同期に失敗しました: Custom Param配列が不正です。', 'error');
    return;
  }

  syncParamNodeListInternal?.(customParams);
}

export function syncLutStripListState(luts: LutModel[], steps: StepModel[]): void {
  if (!Array.isArray(luts) || luts.some(lut => !isValidLutModel(lut))) {
    lutStripStatusReporter('LUTストリップ同期に失敗しました: LUT配列が不正です。', 'error');
    return;
  }
  if (!Array.isArray(steps) || steps.some(step => !isValidStepModel(step))) {
    lutStripStatusReporter('LUTストリップ同期に失敗しました: Step配列が不正です。', 'error');
    return;
  }

  syncLutStripListInternal?.(luts, steps);
}
