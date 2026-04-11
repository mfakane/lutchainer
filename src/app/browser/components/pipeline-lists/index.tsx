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
  restoreElementScrollPosition,
  type LutStripListMountOptions,
  type ParamNodeListMountOptions,
  type StatusReporter,
  type StepListMountOptions,
} from './shared.ts';
import { LutStripList } from './solid-lut-strip-list.tsx';
import { ParamNodeList } from './solid-param-node-list.tsx';
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

  target.textContent = '';
  disposeParamNodeList = render(() => {
    const [customParams, setCustomParams] = createSignal<CustomParamModel[]>(cloneCustomParamArray(options.customParams));
    syncParamNodeListInternal = nextCustomParams => {
      if (!Array.isArray(nextCustomParams) || nextCustomParams.some(customParam => !isValidCustomParamModel(customParam))) {
        paramNodeListStatusReporter('Paramノードリストの同期Custom Param配列が不正です。', 'error');
        return;
      }
      setCustomParams(cloneCustomParamArray(nextCustomParams));
    };

    return (
      <ParamNodeList
        getMaterialSettings={options.getMaterialSettings}
        customParams={customParams}
        onAddCustomParam={options.onAddCustomParam}
        onRenameCustomParam={options.onRenameCustomParam}
        onSetCustomParamValue={options.onSetCustomParamValue}
        onCommitCustomParamValueChange={options.onCommitCustomParamValueChange}
        onRemoveCustomParam={options.onRemoveCustomParam}
        onStatus={options.onStatus}
      />
    );
  }, target);
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

      const scrollTop = target.scrollTop;
      const scrollLeft = target.scrollLeft;
      setSteps(cloneStepArray(nextSteps));
      setLuts(cloneLutArray(nextLuts));
      setCustomParams(cloneCustomParamArray(nextCustomParams));
      restoreElementScrollPosition(target, scrollTop, scrollLeft);
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

  target.textContent = '';
  disposeLutStripList = render(() => {
    const [luts, setLuts] = createSignal<LutModel[]>(cloneLutArray(options.luts));
    const [steps, setSteps] = createSignal<StepModel[]>(cloneStepArray(options.steps));

    syncLutStripListInternal = (nextLuts, nextSteps) => {
      if (!Array.isArray(nextLuts) || nextLuts.some(lut => !isValidLutModel(lut))) {
        lutStripStatusReporter('LUTストリップの同期LUT配列が不正です。', 'error');
        return;
      }
      if (!Array.isArray(nextSteps) || nextSteps.some(step => !isValidStepModel(step))) {
        lutStripStatusReporter('LUTストリップの同期Step配列が不正です。', 'error');
        return;
      }

      setLuts(cloneLutArray(nextLuts));
      setSteps(cloneStepArray(nextSteps));
    };

    return (
      <LutStripList
        luts={luts}
        steps={steps}
        onRemoveLut={options.onRemoveLut}
        onAddLutFiles={options.onAddLutFiles}
        onEditLut={options.onEditLut}
        onDuplicateLut={options.onDuplicateLut}
        onNewLut={options.onNewLut}
        onStatus={options.onStatus}
      />
    );
  }, target);
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
