import { For, Index, Show, createSignal, onCleanup, type Accessor, type JSX } from 'solid-js';
import { Portal, render } from 'solid-js/web';
import * as pipelineModel from '../../../features/pipeline/pipeline-model.ts';
import { getCustomChannelsForBlendMode, getSelectableBlendOpsForChannel } from '../../../features/step/step-blend-strategies.ts';
import {
  BLEND_MODES,
  MAX_STEP_LABEL_LENGTH,
  type BlendOp,
  type ChannelName,
  type CustomParamModel,
  type LutModel,
  type ParamName,
  type ParamRef,
  type StepModel
} from '../../../features/step/step-model.ts';
import {
  drawParamPreviewSphereCpu,
} from '../../../features/step/step-preview-cpu-render.ts';
import { t, useLanguage } from '../i18n.ts';
import { DropdownMenu } from './solid-dropdown-menu.tsx';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

const CHANNELS: ChannelName[] = ['r', 'g', 'b', 'h', 's', 'v'];

interface ParamNodeListMountOptions {
  getMaterialSettings: () => pipelineModel.MaterialSettings;
  customParams: CustomParamModel[];
  onAddCustomParam: () => void;
  onRenameCustomParam: (paramId: string, label: string) => void;
  onSetCustomParamValue: (paramId: string, value: number) => void;
  onRemoveCustomParam: (paramId: string) => void;
  onStatus: StatusReporter;
}

interface StepListMountOptions {
  steps: StepModel[];
  luts: LutModel[];
  customParams: CustomParamModel[];
  onAddStep: () => void;
  onDuplicateStep: (stepId: string) => void;
  onRemoveStep: (stepId: string) => void;
  onStepMuteChange: (stepId: string, muted: boolean) => void;
  onStepLabelChange: (stepId: string, label: string | null) => void;
  onStepLutChange: (stepId: string, lutId: string) => void;
  onStepBlendModeChange: (stepId: string, blendMode: StepModel['blendMode']) => void;
  onStepOpChange: (stepId: string, channel: ChannelName, op: BlendOp) => void;
  shouldSuppressClick?: () => boolean;
  computeLutUv?: (stepIndex: number, pixelX: number, pixelY: number, canvasWidth: number, canvasHeight: number) => { u: number; v: number } | null;
  onStatus: StatusReporter;
}

interface LutStripListMountOptions {
  luts: LutModel[];
  steps: StepModel[];
  onRemoveLut: (lutId: string) => void;
  onAddLutFiles: (files: File[]) => void | Promise<void>;
  onEditLut?: (lutId: string) => void;
  onDuplicateLut?: (lutId: string) => void;
  onNewLut?: () => void;
  onStatus: StatusReporter;
}

interface ParamNodeListProps {
  getMaterialSettings: () => pipelineModel.MaterialSettings;
  customParams: Accessor<CustomParamModel[]>;
  onAddCustomParam: () => void;
  onRenameCustomParam: (paramId: string, label: string) => void;
  onSetCustomParamValue: (paramId: string, value: number) => void;
  onRemoveCustomParam: (paramId: string) => void;
}

interface ParamPreviewState {
  param: ParamRef;
  left: number;
  top: number;
}

interface CustomParamNodeProps {
  customParam: Accessor<CustomParamModel>;
  onRenameCustomParam: (paramId: string, label: string) => void;
  onSetCustomParamValue: (paramId: string, value: number) => void;
  onRemoveCustomParam: (paramId: string) => void;
}

interface StepListProps {
  steps: Accessor<StepModel[]>;
  luts: Accessor<LutModel[]>;
  customParams: Accessor<CustomParamModel[]>;
  onAddStep: () => void;
  onDuplicateStep: (stepId: string) => void;
  onRemoveStep: (stepId: string) => void;
  onStepMuteChange: (stepId: string, muted: boolean) => void;
  onStepLabelChange: (stepId: string, label: string | null) => void;
  onStepLutChange: (stepId: string, lutId: string) => void;
  onStepBlendModeChange: (stepId: string, blendMode: StepModel['blendMode']) => void;
  onStepOpChange: (stepId: string, channel: ChannelName, op: BlendOp) => void;
  shouldSuppressClick?: () => boolean;
  computeLutUv?: (stepIndex: number, pixelX: number, pixelY: number, canvasWidth: number, canvasHeight: number) => { u: number; v: number } | null;
  onStatus: StatusReporter;
}

interface LutStripListProps {
  luts: Accessor<LutModel[]>;
  steps: Accessor<StepModel[]>;
  onRemoveLut: (lutId: string) => void;
  onAddLutFiles: (files: File[]) => void | Promise<void>;
  onEditLut?: (lutId: string) => void;
  onDuplicateLut?: (lutId: string) => void;
  onNewLut?: () => void;
  onStatus: StatusReporter;
}

let disposeParamNodeList: (() => void) | null = null;
let disposeStepList: (() => void) | null = null;
let disposeLutStripList: (() => void) | null = null;

let syncParamNodeListInternal: ((customParams: CustomParamModel[]) => void) | null = null;
let syncStepListInternal: ((steps: StepModel[], luts: LutModel[], customParams: CustomParamModel[]) => void) | null = null;
let syncLutStripListInternal: ((luts: LutModel[], steps: StepModel[]) => void) | null = null;

let paramNodeListStatusReporter: StatusReporter = () => undefined;
let stepListStatusReporter: StatusReporter = () => undefined;
let lutStripStatusReporter: StatusReporter = () => undefined;
const PARAM_PREVIEW_SIZE = 112;
const PARAM_PREVIEW_TARGETS = new Set<ParamName>([
  'lightness',
  'specular',
  'halfLambert',
  'fresnel',
  'facing',
  'nDotH',
  'linearDepth',
  'texU',
  'texV',
  'zero',
  'one',
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidStepOps(value: unknown): value is Record<ChannelName, BlendOp> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const ops = value as Partial<Record<ChannelName, BlendOp>>;
  for (const channel of CHANNELS) {
    const op = ops[channel];
    if (typeof op !== 'string' || !pipelineModel.isValidBlendOp(op)) {
      return false;
    }
  }

  return true;
}

function isValidStepModel(value: unknown): value is StepModel {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const step = value as Partial<StepModel>;
  return isNonEmptyString(step.id)
    && isNonEmptyString(step.lutId)
    && typeof step.muted === 'boolean'
    && (step.label === undefined || (isNonEmptyString(step.label) && step.label.trim().length <= MAX_STEP_LABEL_LENGTH))
    && typeof step.blendMode === 'string'
    && pipelineModel.isValidBlendMode(step.blendMode)
    && typeof step.xParam === 'string'
    && pipelineModel.isValidParamName(step.xParam)
    && typeof step.yParam === 'string'
    && pipelineModel.isValidParamName(step.yParam)
    && isValidStepOps(step.ops);
}

function isValidLutModel(value: unknown): value is LutModel {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const lut = value as Partial<LutModel>;
  return isNonEmptyString(lut.id)
    && typeof lut.name === 'string'
    && lut.image instanceof HTMLCanvasElement
    && Number.isInteger(lut.width)
    && (lut.width ?? 0) > 0
    && Number.isInteger(lut.height)
    && (lut.height ?? 0) > 0
    && lut.pixels instanceof Uint8ClampedArray
    && typeof lut.thumbUrl === 'string';
}

function isValidCustomParamModel(value: unknown): value is CustomParamModel {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const customParam = value as Partial<CustomParamModel>;
  return isNonEmptyString(customParam.id)
    && isNonEmptyString(customParam.label)
    && typeof customParam.defaultValue === 'number'
    && Number.isFinite(customParam.defaultValue);
}

function cloneStepModel(step: StepModel): StepModel {
  return {
    id: step.id,
    lutId: step.lutId,
    label: step.label,
    muted: step.muted,
    blendMode: step.blendMode,
    xParam: step.xParam,
    yParam: step.yParam,
    ops: { ...step.ops },
  };
}

function cloneLutModel(lut: LutModel): LutModel {
  return {
    id: lut.id,
    name: lut.name,
    image: lut.image,
    width: lut.width,
    height: lut.height,
    pixels: lut.pixels,
    thumbUrl: lut.thumbUrl,
    ramp2dData: lut.ramp2dData,
  };
}

function cloneCustomParamModel(customParam: CustomParamModel): CustomParamModel {
  return {
    id: customParam.id,
    label: customParam.label,
    defaultValue: customParam.defaultValue,
  };
}

function cloneStepArray(steps: StepModel[]): StepModel[] {
  return steps.map(step => cloneStepModel(step));
}

function cloneLutArray(luts: LutModel[]): LutModel[] {
  return luts.map(lut => cloneLutModel(lut));
}

function cloneCustomParamArray(customParams: CustomParamModel[]): CustomParamModel[] {
  return customParams.map(customParam => cloneCustomParamModel(customParam));
}

function restoreElementScrollPosition(element: HTMLElement, top: number, left: number): void {
  requestAnimationFrame(() => {
    element.scrollTop = top;
    element.scrollLeft = left;
  });
}

function ensureStatusReporter(value: unknown, context: string): asserts value is StatusReporter {
  if (typeof value !== 'function') {
    throw new Error(`${context} のステータス通知コールバックが不正です。`);
  }
}

function stopPointerPropagation(event: PointerEvent): void {
  event.stopPropagation();
}

function CustomParamNode(props: CustomParamNodeProps): JSX.Element {
  const language = useLanguage();

  const tr = (key: string, values?: Record<string, string | number>): string => {
    language();
    return t(key, values);
  };
  const handleValueSliderInput = (event: InputEvent): void => {
    const target = event.currentTarget as HTMLInputElement;
    const nextValue = Number(target.value);
    props.onSetCustomParamValue(props.customParam().id, nextValue);
  };
  const handleValueSliderWheel = (event: WheelEvent): void => {
    const delta = event.deltaY < 0 ? 0.01 : -0.01;
    const nextValue = Math.max(0, Math.min(1, props.customParam().defaultValue + delta));
    props.onSetCustomParamValue(props.customParam().id, nextValue);
    event.preventDefault();
  };

  return (
    <div
      class="param-node param-socket param-node-custom"
      data-param-id={props.customParam().id}
      data-param={pipelineModel.buildCustomParamRef(props.customParam().id)}
      aria-label={`Connect ${props.customParam().label}`}
      title={`Connect ${props.customParam().label}`}
    >
      <span class="param-socket-dot" aria-hidden="true"></span>
      <div class="param-node-custom-header" data-socket-drag-ignore="true">
        <button
          type="button"
          class="custom-param-drag-handle"
          data-socket-drag-ignore="true"
          draggable={true}
          aria-label={`Reorder ${props.customParam().label}`}
          onPointerDown={stopPointerPropagation}
        >
          <span class="custom-param-drag-grip" aria-hidden="true"></span>
        </button>
        <input
          class="step-title-input param-node-custom-input"
          data-socket-drag-ignore="true"
          value={props.customParam().label}
          maxLength={pipelineModel.MAX_CUSTOM_PARAM_LABEL_LENGTH}
          aria-label={`Custom param label ${props.customParam().id}`}
          onBlur={event => props.onRenameCustomParam(props.customParam().id, event.currentTarget.value)}
        />
        <button
          type="button"
          class="step-remove param-node-custom-remove"
          data-socket-drag-ignore="true"
          onClick={() => props.onRemoveCustomParam(props.customParam().id)}
        >
          {tr('pipeline.param.remove')}
        </button>
      </div>
      <div class="param-node-custom-meta">
        <span class="param-desc">{`u_param_${props.customParam().id}`}</span>
      </div>
      <div class="param-node-custom-slider-row" data-socket-drag-ignore="true">
        <input
          type="range"
          class="material-range-input param-node-custom-slider"
          data-socket-drag-ignore="true"
          min="0"
          max="1"
          step="0.01"
          value={String(props.customParam().defaultValue)}
          onInput={handleValueSliderInput}
          onWheel={handleValueSliderWheel}
        />
        <span class="param-node-custom-value">{props.customParam().defaultValue.toFixed(2)}</span>
      </div>
    </div>
  );
}

function ensureParamNodeListMountOptions(value: unknown): asserts value is ParamNodeListMountOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Paramノードリストの初期化オプションが不正です。');
  }

  const options = value as Partial<ParamNodeListMountOptions>;
  if (typeof options.getMaterialSettings !== 'function') {
    throw new Error('ParamノードリストのMaterial設定取得コールバックが不正です。');
  }
  if (!Array.isArray(options.customParams) || options.customParams.some(customParam => !isValidCustomParamModel(customParam))) {
    throw new Error('ParamノードリストのCustom Param配列が不正です。');
  }
  if (typeof options.onAddCustomParam !== 'function') {
    throw new Error('ParamノードリストのCustom Param追加コールバックが不正です。');
  }
  if (typeof options.onRenameCustomParam !== 'function') {
    throw new Error('ParamノードリストのCustom Param名称変更コールバックが不正です。');
  }
  if (typeof options.onSetCustomParamValue !== 'function') {
    throw new Error('ParamノードリストのCustom Param値変更コールバックが不正です。');
  }
  if (typeof options.onRemoveCustomParam !== 'function') {
    throw new Error('ParamノードリストのCustom Param削除コールバックが不正です。');
  }
  ensureStatusReporter(options.onStatus, 'Paramノードリスト');
}

function ensureStepListMountOptions(value: unknown): asserts value is StepListMountOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Stepリストの初期化オプションが不正です。');
  }

  const options = value as Partial<StepListMountOptions>;
  if (!Array.isArray(options.steps) || options.steps.some(step => !isValidStepModel(step))) {
    throw new Error('Stepリストの初期Step配列が不正です。');
  }
  if (!Array.isArray(options.luts) || options.luts.some(lut => !isValidLutModel(lut))) {
    throw new Error('Stepリストの初期LUT配列が不正です。');
  }
  if (!Array.isArray(options.customParams) || options.customParams.some(customParam => !isValidCustomParamModel(customParam))) {
    throw new Error('Stepリストの初期Custom Param配列が不正です。');
  }
  if (typeof options.onAddStep !== 'function') {
    throw new Error('Stepリストの追加コールバックが不正です。');
  }
  if (typeof options.onDuplicateStep !== 'function') {
    throw new Error('Stepリストの複製コールバックが不正です。');
  }
  if (typeof options.onRemoveStep !== 'function') {
    throw new Error('Stepリストの削除コールバックが不正です。');
  }
  if (typeof options.onStepMuteChange !== 'function') {
    throw new Error('Stepリストのミュート変更コールバックが不正です。');
  }
  if (typeof options.onStepLabelChange !== 'function') {
    throw new Error('Stepリストのラベル変更コールバックが不正です。');
  }
  if (typeof options.onStepLutChange !== 'function') {
    throw new Error('StepリストのLUT変更コールバックが不正です。');
  }
  if (typeof options.onStepBlendModeChange !== 'function') {
    throw new Error('StepリストのBlendMode変更コールバックが不正です。');
  }
  if (typeof options.onStepOpChange !== 'function') {
    throw new Error('Stepリストの演算変更コールバックが不正です。');
  }
  if (options.shouldSuppressClick !== undefined && typeof options.shouldSuppressClick !== 'function') {
    throw new Error('Stepリストのクリック抑止判定コールバックが不正です。');
  }
  if (options.computeLutUv !== undefined && typeof options.computeLutUv !== 'function') {
    throw new Error('StepリストのLUT UV計算コールバックが不正です。');
  }
  ensureStatusReporter(options.onStatus, 'Stepリスト');
}

function ensureLutStripListMountOptions(value: unknown): asserts value is LutStripListMountOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('LUTストリップの初期化オプションが不正です。');
  }

  const options = value as Partial<LutStripListMountOptions>;
  if (!Array.isArray(options.luts) || options.luts.some(lut => !isValidLutModel(lut))) {
    throw new Error('LUTストリップの初期LUT配列が不正です。');
  }
  if (!Array.isArray(options.steps) || options.steps.some(step => !isValidStepModel(step))) {
    throw new Error('LUTストリップの初期Step配列が不正です。');
  }
  if (typeof options.onRemoveLut !== 'function') {
    throw new Error('LUTストリップの削除コールバックが不正です。');
  }
  ensureStatusReporter(options.onStatus, 'LUTストリップ');
}

function ParamNodeList(props: ParamNodeListProps): JSX.Element {
  const language = useLanguage();
  const [previewState, setPreviewState] = createSignal<ParamPreviewState | null>(null);
  const previewCanvases = new Map<ParamRef, HTMLCanvasElement>();

  const tr = (key: string, values?: Record<string, string | number>): string => {
    language();
    return t(key, values);
  };

  const isPreviewTarget = (param: ParamRef): boolean => PARAM_PREVIEW_TARGETS.has(param as ParamName);

  const drawPreview = (param: ParamRef): void => {
    if (!PARAM_PREVIEW_TARGETS.has(param as ParamName)) {
      return;
    }
    const canvas = previewCanvases.get(param);
    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }

    try {
      drawParamPreviewSphereCpu({
        canvas,
        param: param as ParamName,
        pixelWidth: PARAM_PREVIEW_SIZE,
        pixelHeight: PARAM_PREVIEW_SIZE,
        materialSettings: props.getMaterialSettings(),
        lightDirection: pipelineModel.STEP_PREVIEW_LIGHT_DIR,
        viewDirection: pipelineModel.STEP_PREVIEW_VIEW_DIR,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : tr('common.unknownError');
      paramNodeListStatusReporter(tr('pipeline.status.paramPreviewDrawFailed', { message }), 'error');
    }
  };

  const hidePreview = (): void => {
    setPreviewState(null);
  };

  const updatePreviewPosition = (anchor: HTMLElement, param: ParamRef): void => {
    const rect = anchor.getBoundingClientRect();
    const previewWidth = PARAM_PREVIEW_SIZE + 20;
    const previewHeight = PARAM_PREVIEW_SIZE + 38;
    let left = rect.right + 10;
    let top = rect.top + rect.height * 0.5;

    if (left + previewWidth > window.innerWidth - 12) {
      left = Math.max(12, rect.left - previewWidth - 10);
    }
    if (top + previewHeight * 0.5 > window.innerHeight - 12) {
      top = window.innerHeight - 12 - previewHeight * 0.5;
    }
    if (top - previewHeight * 0.5 < 12) {
      top = 12 + previewHeight * 0.5;
    }

    setPreviewState({ param, left, top });
  };

  const showPreview = (param: ParamRef, anchor: HTMLElement): void => {
    if (!isPreviewTarget(param)) {
      return;
    }
    updatePreviewPosition(anchor, param);
    queueMicrotask(() => {
      if (previewState()?.param === param) {
        drawPreview(param);
      }
    });
  };

  const syncActivePreviewPosition = (): void => {
    const current = previewState();
    if (!current) {
      return;
    }
    const anchor = document.querySelector<HTMLElement>(`.param-node[data-param="${current.param}"]`);
    if (!(anchor instanceof HTMLElement)) {
      hidePreview();
      return;
    }
    updatePreviewPosition(anchor, current.param);
  };

  window.addEventListener('scroll', syncActivePreviewPosition, true);
  window.addEventListener('resize', syncActivePreviewPosition);
  onCleanup(() => {
    window.removeEventListener('scroll', syncActivePreviewPosition, true);
    window.removeEventListener('resize', syncActivePreviewPosition);
  });

  return (
    <>
      <For each={pipelineModel.PARAM_GROUPS}>
        {group => (
          <section class={`param-group param-group-${group.tone}`} data-group={group.key}>
            <header class="param-group-head">
              <div class="param-group-title-row">
                <div class="param-group-title">{group.label}</div>
                <Show when={group.tone === 'feedback'}>
                  <span class="param-group-badge">{tr('pipeline.paramGroup.prevColorBadge')}</span>
                </Show>
              </div>
              <div class="param-group-desc">{tr(group.descriptionKey)}</div>
            </header>

            <div class="param-group-nodes">
              <For each={group.params}>
                {paramName => {
                  const param = pipelineModel.getParamDef(paramName);

                  return (
                    <button
                      type="button"
                      class="param-node param-socket"
                      data-param={param.key}
                      title={isPreviewTarget(param.key) ? undefined : tr('pipeline.param.connectTitle', { label: param.label })}
                      aria-label={tr('pipeline.param.connectTitle', { label: param.label })}
                      onMouseEnter={event => showPreview(param.key, event.currentTarget)}
                      onMouseLeave={hidePreview}
                      onFocus={event => showPreview(param.key, event.currentTarget)}
                      onBlur={hidePreview}
                      aria-describedby={isPreviewTarget(param.key) ? `param-preview-${param.key}` : undefined}
                    >
                      <span class="param-socket-dot" aria-hidden="true"></span>
                      <span class="param-name">{param.label}</span>
                      <span class="param-desc">{param.description}</span>
                    </button>
                  );
                }}
              </For>
            </div>
          </section>
        )}
      </For>
      <section class="param-group param-group-default" data-group="custom-params">
        <header class="param-group-head">
          <div class="param-group-title-row">
            <div class="param-group-title">Custom Params</div>
          </div>
          <div class="param-group-desc">{tr('pipeline.paramGroup.customParamsDesc')}</div>
        </header>

        <div class="param-group-nodes">
          <Index each={props.customParams()}>
            {customParam => (
              <CustomParamNode
                customParam={customParam}
                onRenameCustomParam={props.onRenameCustomParam}
                onSetCustomParamValue={props.onSetCustomParamValue}
                onRemoveCustomParam={props.onRemoveCustomParam}
              />
            )}
          </Index>
          
          <button type="button" class="btn btn-secondary btn-inline-add" onClick={props.onAddCustomParam}>{tr('pipeline.param.add')}</button>
        </div>
      </section>
      <Show when={previewState()}>
        {state => (
          <Portal>
            <span
              class="param-preview-tooltip"
              id={`param-preview-${state().param}`}
              role="tooltip"
              aria-label={tr('pipeline.param.previewTooltip', { label: pipelineModel.getParamDef(state().param).label })}
              style={{
                left: `${state().left}px`,
                top: `${state().top}px`,
              }}
            >
              <span class="param-preview-tooltip-label">{tr('pipeline.param.previewScale')}</span>
              <canvas
                class="param-preview-tooltip-canvas"
                width={PARAM_PREVIEW_SIZE}
                height={PARAM_PREVIEW_SIZE}
                ref={element => {
                  previewCanvases.set(state().param, element);
                  drawPreview(state().param);
                }}
              ></canvas>
            </span>
          </Portal>
        )}
      </Show>
    </>
  );
}

function StepList(props: StepListProps): JSX.Element {
  const language = useLanguage();

  const tr = (key: string, values?: Record<string, string | number>): string => {
    language();
    return t(key, values);
  };

  const resolveLut = (lutId: string): LutModel | null => {
    const candidates = props.luts();
    return candidates.find(item => item.id === lutId) ?? candidates[0] ?? null;
  };

  const shouldIgnoreClick = (): boolean => {
    if (!props.shouldSuppressClick) {
      return false;
    }

    try {
      return props.shouldSuppressClick();
    } catch {
      props.onStatus(tr('pipeline.status.suppressClickFailed'), 'error');
      return false;
    }
  };

  const handleAddStepClick = (): void => {
    if (shouldIgnoreClick()) {
      return;
    }

    props.onAddStep();
  };

  const resolveStepLabel = (step: StepModel, displayIndex: number): string => {
    const customLabel = typeof step.label === 'string' ? step.label.trim() : '';
    if (customLabel.length > 0) {
      return customLabel;
    }
    return `Step ${displayIndex}`;
  };

  const commitStepLabel = (
    stepId: string,
    displayIndex: number,
    inputElement: HTMLInputElement | null,
  ): void => {
    if (!inputElement) {
      props.onStatus(tr('pipeline.status.stepLabelInputMissing'), 'error');
      return;
    }

    const rawValue = inputElement.value;
    if (typeof rawValue !== 'string') {
      props.onStatus(tr('pipeline.status.stepLabelInvalidValue'), 'error');
      inputElement.value = `Step ${displayIndex}`;
      return;
    }

    const trimmed = rawValue.trim();
    if (trimmed.length > MAX_STEP_LABEL_LENGTH) {
      props.onStatus(
        tr('pipeline.status.stepLabelTooLong', { max: MAX_STEP_LABEL_LENGTH }),
        'error',
      );
      inputElement.value = trimmed.slice(0, MAX_STEP_LABEL_LENGTH);
      return;
    }

    props.onStepLabelChange(stepId, trimmed.length > 0 ? trimmed : null);
    inputElement.value = trimmed.length > 0 ? trimmed : `Step ${displayIndex}`;
  };

  return (
    <>
      <Show
        when={props.steps().length > 0}
        fallback={<div class="step-core">{tr('pipeline.step.empty')}</div>}
      >
        <For each={props.steps()}>
          {(step, index) => {
            const selectedLut = (): LutModel | null => resolveLut(step.lutId);
            const editableChannels = (): ChannelName[] => getCustomChannelsForBlendMode(step.blendMode);
            const selectableOps = (): BlendOp[] => getSelectableBlendOpsForChannel(step.blendMode);
            const displayIndex = (): number => index() + 1;
            const [crosshairUv, setCrosshairUv] = createSignal<{ u: number; v: number } | null>(null);

            return (
              <article class={step.muted ? 'step-item step-item-muted' : 'step-item'} data-step-id={step.id}>
                <section class="step-head">
                  <div class="step-title-row">
                    <button
                      type="button"
                      class="step-drag-handle"
                      draggable={true}
                      data-step-id={step.id}
                      title={tr('pipeline.step.dragMove')}
                    >
                      drag
                    </button>
                    <input
                      type="text"
                      class="step-title-input"
                      value={resolveStepLabel(step, displayIndex())}
                      maxLength={MAX_STEP_LABEL_LENGTH}
                      aria-label={tr('pipeline.step.titleAria', { index: displayIndex() })}
                      onBlur={event => {
                        const input = event.currentTarget as HTMLInputElement | null;
                        commitStepLabel(step.id, displayIndex(), input);
                      }}
                      onKeyDown={event => {
                        const input = event.currentTarget as HTMLInputElement | null;
                        if (!input) {
                          props.onStatus(tr('pipeline.status.stepLabelInputMissing'), 'error');
                          return;
                        }

                        if (event.key === 'Enter') {
                          event.preventDefault();
                          input.blur();
                          return;
                        }

                        if (event.key === 'Escape') {
                          event.preventDefault();
                          input.value = resolveStepLabel(step, displayIndex());
                          input.blur();
                        }
                      }}
                    />
                  </div>
                  <div class="step-actions">
                    <button
                      type="button"
                      class={step.muted ? 'btn btn-step-action step-mute active' : 'btn btn-step-action step-mute'}
                      data-step-id={step.id}
                      aria-pressed={step.muted ? 'true' : 'false'}
                      onClick={() => {
                        if (shouldIgnoreClick()) {
                          return;
                        }

                        props.onStepMuteChange(step.id, !step.muted);
                      }}
                    >
                      {step.muted ? tr('pipeline.step.unmute') : tr('pipeline.step.mute')}
                    </button>
                    <button
                      type="button"
                      class="btn btn-step-action step-duplicate"
                      data-step-id={step.id}
                      onClick={() => {
                        if (shouldIgnoreClick()) {
                          return;
                        }

                        props.onDuplicateStep(step.id);
                      }}
                    >
                      {tr('pipeline.step.duplicate')}
                    </button>
                    <button
                      type="button"
                      class="btn btn-step-action step-remove"
                      data-step-id={step.id}
                      onClick={() => {
                        if (shouldIgnoreClick()) {
                          return;
                        }

                        props.onRemoveStep(step.id);
                      }}
                    >
                      {tr('pipeline.step.remove')}
                    </button>
                  </div>
                </section>

                <aside class="step-socket-rail">
                  <button
                    type="button"
                    class="step-socket"
                    data-step-id={step.id}
                    data-axis="x"
                    title={`X: ${pipelineModel.getParamLabel(step.xParam, props.customParams())}`}
                  >
                    <span class="step-socket-dot" aria-hidden="true"></span>
                    <span class="step-socket-axis-label">X</span>
                    <span class="step-socket-param">{pipelineModel.getParamLabel(step.xParam, props.customParams())}</span>
                  </button>
                  <button
                    type="button"
                    class="step-socket"
                    data-step-id={step.id}
                    data-axis="y"
                    title={`Y: ${pipelineModel.getParamLabel(step.yParam, props.customParams())}`}
                  >
                    <span class="step-socket-dot" aria-hidden="true"></span>
                    <span class="step-socket-axis-label">Y</span>
                    <span class="step-socket-param">{pipelineModel.getParamLabel(step.yParam, props.customParams())}</span>
                  </button>
                </aside>

                <section class="step-core">
                  <div class="lut-row">
                    <label class="lut-select-field">
                      <span class="lut-select-label">{tr('pipeline.step.lut')}</span>
                      <select
                        class="control-select step-lut-select"
                        data-step-id={step.id}
                        onChange={event => {
                          const input = event.currentTarget as HTMLSelectElement | null;
                          if (!input) {
                            props.onStatus(tr('pipeline.status.stepLutSelectMissing'), 'error');
                            return;
                          }

                          const lutId = input.value;
                          if (!isNonEmptyString(lutId)) {
                            props.onStatus(tr('pipeline.status.selectedLutIdInvalid'), 'error');
                            return;
                          }

                          const availableLuts = props.luts();
                          if (!availableLuts.some(lut => lut.id === lutId)) {
                            props.onStatus(tr('pipeline.status.selectedLutMissing'), 'error');
                            return;
                          }

                          props.onStepLutChange(step.id, lutId);
                        }}
                      >
                        <For each={props.luts()}>
                          {lutOpt => <option value={lutOpt.id} selected={lutOpt.id === step.lutId}>{lutOpt.name}</option>}
                        </For>
                      </select>
                    </label>

                    <div class="lut-thumb-wrap">
                      <img class="lut-thumb checker-bg" src={selectedLut()?.thumbUrl ?? ''} alt="LUT thumbnail" />
                      <Show when={crosshairUv() !== null}>
                        <div
                          class="lut-crosshair"
                          style={`--ch-x: ${(crosshairUv()?.u ?? 0) * 100}%; --ch-y: ${(crosshairUv()?.v ?? 0) * 100}%`}
                          aria-hidden="true"
                        />
                      </Show>
                    </div>
                  </div>

                  <div class="step-mode-row">
                    <label class="step-mode-field">
                      <span class="op-label">{tr('pipeline.step.blendMode')}</span>
                      <select
                        class="control-select step-blend-mode-select"
                        data-step-id={step.id}
                        value={step.blendMode}
                        onChange={event => {
                          const input = event.currentTarget as HTMLSelectElement | null;
                          if (!input) {
                            props.onStatus(tr('pipeline.status.blendModeSelectMissing'), 'error');
                            return;
                          }

                          const blendMode = input.value;
                          if (!pipelineModel.isValidBlendMode(blendMode)) {
                            props.onStatus(tr('pipeline.status.invalidBlendMode', { blendMode }), 'error');
                            return;
                          }

                          props.onStepBlendModeChange(step.id, blendMode);
                        }}
                      >
                        <For each={BLEND_MODES}>
                          {mode => <option value={mode.key}>{mode.label}</option>}
                        </For>
                      </select>
                    </label>
                  </div>

                  <Show when={editableChannels().length > 0}>
                    <div class="op-grid">
                      <For each={editableChannels()}>
                        {channel => (
                          <label class="op-item">
                            <span class="op-label">{channel.toUpperCase()}</span>
                            <select
                              class="control-select step-op-select"
                              data-step-id={step.id}
                              data-channel={channel}
                              value={step.ops[channel]}
                              onChange={event => {
                                const input = event.currentTarget as HTMLSelectElement | null;
                                if (!input) {
                                  props.onStatus(tr('pipeline.status.stepOpSelectMissing'), 'error');
                                  return;
                                }

                                const op = input.value;
                                if (!pipelineModel.isValidBlendOp(op)) {
                                  props.onStatus(tr('pipeline.status.invalidOp', { op }), 'error');
                                  return;
                                }

                                props.onStepOpChange(step.id, channel, op);
                              }}
                            >
                              <For each={selectableOps()}>
                                {op => <option value={op}>{op}</option>}
                              </For>
                            </select>
                          </label>
                        )}
                      </For>
                    </div>
                  </Show>
                </section>

                <aside class="step-preview">
                  <canvas
                    class="preview-swatch preview-sphere"
                    data-step-id={step.id}
                    data-preview="after"
                    aria-label={tr('pipeline.step.previewAria', { index: index() + 1 })}
                    onMouseMove={event => {
                      if (!props.computeLutUv) return;
                      const canvas = event.currentTarget as HTMLCanvasElement;
                      const rect = canvas.getBoundingClientRect();
                      const scaleX = canvas.width / rect.width;
                      const scaleY = canvas.height / rect.height;
                      const pixelX = (event.clientX - rect.left) * scaleX;
                      const pixelY = (event.clientY - rect.top) * scaleY;
                      setCrosshairUv(props.computeLutUv(index(), pixelX, pixelY, canvas.width, canvas.height));
                    }}
                    onMouseLeave={() => setCrosshairUv(null)}
                  ></canvas>
                </aside>
              </article>
            );
          }}
        </For>
      </Show>

      <button type="button" class="btn btn-secondary btn-inline-add" onClick={handleAddStepClick}>{tr('pipeline.step.add')}</button>
    </>
  );
}

function LutStripList(props: LutStripListProps): JSX.Element {
  let fileInputRef: HTMLInputElement | null = null;
  const language = useLanguage();

  const tr = (key: string, values?: Record<string, string | number>): string => {
    language();
    return t(key, values);
  };

  const usageCount = (lutId: string): number => {
    return props.steps().reduce((count, step) => (step.lutId === lutId ? count + 1 : count), 0);
  };

  const handleRemoveLut = (lutId: string): void => {
    if (!isNonEmptyString(lutId)) {
      props.onStatus(tr('pipeline.lut.invalidId'), 'error');
      return;
    }

    props.onRemoveLut(lutId);
  };

  const openFilePicker = (): void => {
    if (!fileInputRef) {
      props.onStatus(tr('pipeline.lut.fileInputMissing'), 'error');
      return;
    }

    fileInputRef.click();
  };

  const handleFileInputChange = async (event: Event): Promise<void> => {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      props.onStatus(tr('pipeline.lut.fileInputFetchFailed'), 'error');
      return;
    }

    const rawFiles = input.files;
    if (!rawFiles || rawFiles.length === 0) {
      input.value = '';
      return;
    }

    const files = Array.from(rawFiles);
    if (files.some(file => !(file instanceof File))) {
      props.onStatus(tr('pipeline.lut.fileInputInvalidValue'), 'error');
      input.value = '';
      return;
    }

    try {
      await props.onAddLutFiles(files);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.unknownError');
      props.onStatus(tr('pipeline.lut.addFailed', { message }), 'error');
    } finally {
      input.value = '';
    }
  };

  return (
    <>
      <Show when={props.luts().length > 0} fallback={<div class="lut-strip-empty">{tr('pipeline.lut.empty')}</div>}>
        <For each={props.luts()}>
          {lut => (
            <article class="lut-strip-item" draggable={true} data-lut-id={lut.id}>
              <div class="lut-strip-thumb-wrap checker-bg">
                <img class="lut-strip-thumb" src={lut.thumbUrl} alt={`${lut.name} thumbnail`} loading="lazy" />
              </div>
              <div class="lut-strip-meta">
                <div class="lut-strip-name">{lut.name}</div>
                <div class="lut-strip-stats">{tr('pipeline.lut.stats', { width: lut.width, height: lut.height, count: usageCount(lut.id) })}</div>
                <div class="lut-strip-actions">
                  <Show
                    when={lut.ramp2dData}
                    fallback={
                      <button
                        type="button"
                        class="lut-strip-remove"
                        data-lut-id={lut.id}
                        aria-label={tr('pipeline.lut.removeAria', { name: lut.name })}
                        onClick={() => handleRemoveLut(lut.id)}
                      >
                        {tr('pipeline.step.remove')}
                      </button>
                    }
                  >
                    <DropdownMenu
                      wrapperClass="lut-strip-kebab-wrap"
                      triggerClass="lut-strip-kebab"
                      menuClass="lut-strip-menu"
                      triggerAriaLabel={tr('pipeline.lut.kebabAria', { name: lut.name })}
                      menuRole="menu"
                      floating={true}
                    >
                      {controls => (
                        <>
                          <button
                            type="button"
                            class="lut-strip-menu-item"
                            role="menuitem"
                            onClick={() => { controls.closeMenu(); props.onEditLut?.(lut.id); }}
                          >{tr('pipeline.lut.edit')}</button>
                          <button
                            type="button"
                            class="lut-strip-menu-item"
                            role="menuitem"
                            onClick={() => { controls.closeMenu(); props.onDuplicateLut?.(lut.id); }}
                          >{tr('pipeline.lut.duplicate')}</button>
                          <button
                            type="button"
                            class="lut-strip-menu-item lut-strip-menu-item--danger"
                            role="menuitem"
                            onClick={() => { controls.closeMenu(); handleRemoveLut(lut.id); }}
                          >{tr('pipeline.step.remove')}</button>
                        </>
                      )}
                    </DropdownMenu>
                  </Show>
                </div>
              </div>
            </article>
          )}
        </For>
        <Show
          when={props.onNewLut}
          fallback={
            <div class="lut-strip-add-item" onClick={openFilePicker} title={tr('pipeline.lut.add')}>
              <button type="button">{tr('pipeline.lut.add')}</button>
            </div>
          }
        >
          <div class="lut-strip-add-item lut-strip-add-item--split">
            <button
              type="button"
              class="lut-strip-add-new"
              aria-label={tr('lutEditor.newLutAria')}
              onClick={props.onNewLut}
            >
              {tr('lutEditor.newLut')}
            </button>
            <button
              type="button"
              class="lut-strip-add-browse"
              aria-label={tr('pipeline.lut.browseAria')}
              onClick={openFilePicker}
            >
              {tr('pipeline.lut.browse')}
            </button>
          </div>
        </Show>
      </Show>
      <input
        ref={element => {
          fileInputRef = element;
        }}
        type="file"
        class="lut-strip-file-input"
        accept="image/*"
        multiple
        hidden
        onChange={event => void handleFileInputChange(event)}
      />
    </>
  );
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
        onRemoveCustomParam={options.onRemoveCustomParam}
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

  const initialSteps = cloneStepArray(options.steps);
  const initialLuts = cloneLutArray(options.luts);
  const initialCustomParams = cloneCustomParamArray(options.customParams);

  target.textContent = '';
  disposeStepList = render(() => {
    const [steps, setSteps] = createSignal<StepModel[]>(initialSteps);
    const [luts, setLuts] = createSignal<LutModel[]>(initialLuts);
    const [customParams, setCustomParams] = createSignal<CustomParamModel[]>(initialCustomParams);

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

  const initialLuts = cloneLutArray(options.luts);
  const initialSteps = cloneStepArray(options.steps);

  target.textContent = '';
  disposeLutStripList = render(() => {
    const [luts, setLuts] = createSignal<LutModel[]>(initialLuts);
    const [steps, setSteps] = createSignal<StepModel[]>(initialSteps);

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

  if (syncStepListInternal) {
    syncStepListInternal(steps, luts, customParams);
  }
}

export function syncParamNodeListState(customParams: CustomParamModel[]): void {
  if (!Array.isArray(customParams) || customParams.some(customParam => !isValidCustomParamModel(customParam))) {
    paramNodeListStatusReporter('Paramノードリスト同期に失敗しました: Custom Param配列が不正です。', 'error');
    return;
  }

  if (syncParamNodeListInternal) {
    syncParamNodeListInternal(customParams);
  }
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

  if (syncLutStripListInternal) {
    syncLutStripListInternal(luts, steps);
  }
}
