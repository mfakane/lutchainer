import { For, Show, createSignal, type Accessor, type JSX } from 'solid-js';
import { render } from 'solid-js/web';
import * as pipelineModel from '../../features/pipeline/pipeline-model';
import {
  BLEND_MODES,
  BLEND_OPS,
  MAX_STEP_LABEL_LENGTH,
  type BlendOp,
  type ChannelName,
  type LutModel,
  type StepModel,
} from '../../features/step/step-model';
import { getCustomChannelsForBlendMode } from '../../features/step/step-runtime';
import { t, useLanguage } from '../i18n';

type StatusKind = 'success' | 'error' | 'info';
type StatusReporter = (message: string, kind?: StatusKind) => void;

const CHANNELS: ChannelName[] = ['r', 'g', 'b', 'h', 's', 'v'];
const PARAM_GROUP_DESCRIPTION_KEYS: Record<string, string> = {
  'lighting-derived': 'pipeline.paramGroup.lightingDerivedDesc',
  'feedback-rgb': 'pipeline.paramGroup.feedbackRgbDesc',
  'feedback-hsv': 'pipeline.paramGroup.feedbackHsvDesc',
  'uv': 'pipeline.paramGroup.uvDesc',
};

interface ParamNodeListMountOptions {
  onStatus: StatusReporter;
}

interface StepListMountOptions {
  steps: StepModel[];
  luts: LutModel[];
  onAddStep: () => void;
  onDuplicateStep: (stepId: number) => void;
  onRemoveStep: (stepId: number) => void;
  onStepMuteChange: (stepId: number, muted: boolean) => void;
  onStepLabelChange: (stepId: number, label: string | null) => void;
  onStepLutChange: (stepId: number, lutId: string) => void;
  onStepBlendModeChange: (stepId: number, blendMode: StepModel['blendMode']) => void;
  onStepOpChange: (stepId: number, channel: ChannelName, op: BlendOp) => void;
  shouldSuppressClick?: () => boolean;
  onStatus: StatusReporter;
}

interface LutStripListMountOptions {
  luts: LutModel[];
  steps: StepModel[];
  onRemoveLut: (lutId: string) => void;
  onAddLutFiles: (files: File[]) => void | Promise<void>;
  onStatus: StatusReporter;
}

interface ParamNodeListProps {}

interface StepListProps {
  steps: Accessor<StepModel[]>;
  luts: Accessor<LutModel[]>;
  onAddStep: () => void;
  onDuplicateStep: (stepId: number) => void;
  onRemoveStep: (stepId: number) => void;
  onStepMuteChange: (stepId: number, muted: boolean) => void;
  onStepLabelChange: (stepId: number, label: string | null) => void;
  onStepLutChange: (stepId: number, lutId: string) => void;
  onStepBlendModeChange: (stepId: number, blendMode: StepModel['blendMode']) => void;
  onStepOpChange: (stepId: number, channel: ChannelName, op: BlendOp) => void;
  shouldSuppressClick?: () => boolean;
  onStatus: StatusReporter;
}

interface LutStripListProps {
  luts: Accessor<LutModel[]>;
  steps: Accessor<StepModel[]>;
  onRemoveLut: (lutId: string) => void;
  onAddLutFiles: (files: File[]) => void | Promise<void>;
  onStatus: StatusReporter;
}

let disposeParamNodeList: (() => void) | null = null;
let disposeStepList: (() => void) | null = null;
let disposeLutStripList: (() => void) | null = null;

let syncStepListInternal: ((steps: StepModel[], luts: LutModel[]) => void) | null = null;
let syncLutStripListInternal: ((luts: LutModel[], steps: StepModel[]) => void) | null = null;

let stepListStatusReporter: StatusReporter = () => undefined;
let lutStripStatusReporter: StatusReporter = () => undefined;

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
  return Number.isInteger(step.id)
    && (step.id ?? 0) > 0
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
  };
}

function cloneStepArray(steps: StepModel[]): StepModel[] {
  return steps.map(step => cloneStepModel(step));
}

function cloneLutArray(luts: LutModel[]): LutModel[] {
  return luts.map(lut => cloneLutModel(lut));
}

function ensureStatusReporter(value: unknown, context: string): asserts value is StatusReporter {
  if (typeof value !== 'function') {
    throw new Error(`${context} のステータス通知コールバックが不正です。`);
  }
}

function ensureParamNodeListMountOptions(value: unknown): asserts value is ParamNodeListMountOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Paramノードリストの初期化オプションが不正です。');
  }

  const options = value as Partial<ParamNodeListMountOptions>;
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

function ParamNodeList(_props: ParamNodeListProps): JSX.Element {
  const language = useLanguage();

  const tr = (key: string, values?: Record<string, string | number>): string => {
    language();
    return t(key, values);
  };

  const resolveGroupDescription = (group: pipelineModel.ParamGroupDef): string => {
    const key = PARAM_GROUP_DESCRIPTION_KEYS[group.key];
    if (!key) {
      return group.description;
    }

    return tr(key);
  };

  return (
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
            <div class="param-group-desc">{resolveGroupDescription(group)}</div>
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
                    title={tr('pipeline.param.connectTitle', { label: param.label })}
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
    stepId: number,
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
            const displayIndex = (): number => index() + 1;

            return (
              <article class={step.muted ? 'step-item step-item-muted' : 'step-item'} data-step-id={String(step.id)}>
                <section class="step-head">
                  <div class="step-title-row">
                    <button
                      type="button"
                      class="step-drag-handle"
                      draggable={true}
                      data-step-id={String(step.id)}
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
                      class={step.muted ? 'step-mute active' : 'step-mute'}
                      data-step-id={String(step.id)}
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
                      class="step-duplicate"
                      data-step-id={String(step.id)}
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
                      class="step-remove"
                      data-step-id={String(step.id)}
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
                    data-step-id={String(step.id)}
                    data-axis="x"
                    title={`X: ${pipelineModel.getParamLabel(step.xParam)}`}
                  >
                    <span class="step-socket-dot" aria-hidden="true"></span>
                    <span class="step-socket-axis-label">X</span>
                    <span class="step-socket-param">{pipelineModel.getParamLabel(step.xParam)}</span>
                  </button>
                  <button
                    type="button"
                    class="step-socket"
                    data-step-id={String(step.id)}
                    data-axis="y"
                    title={`Y: ${pipelineModel.getParamLabel(step.yParam)}`}
                  >
                    <span class="step-socket-dot" aria-hidden="true"></span>
                    <span class="step-socket-axis-label">Y</span>
                    <span class="step-socket-param">{pipelineModel.getParamLabel(step.yParam)}</span>
                  </button>
                </aside>

                <section class="step-core">
                  <div class="lut-row">
                    <img class="lut-thumb" src={selectedLut()?.thumbUrl ?? ''} alt="LUT thumbnail" />
                    <select
                      class="step-lut-select"
                      data-step-id={String(step.id)}
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
                  </div>

                  <div class="step-mode-row">
                    <label class="step-mode-field">
                      <span class="op-label">{tr('pipeline.step.blendMode')}</span>
                      <select
                        class="step-blend-mode-select"
                        data-step-id={String(step.id)}
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
                              class="step-op-select"
                              data-step-id={String(step.id)}
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
                              <For each={BLEND_OPS}>
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
                    data-step-id={String(step.id)}
                    data-preview="after"
                    aria-label={tr('pipeline.step.previewAria', { index: index() + 1 })}
                  ></canvas>
                </aside>
              </article>
            );
          }}
        </For>
      </Show>

      <button type="button" class="btn-secondary step-add-inline-btn" onClick={handleAddStepClick}>{tr('pipeline.step.add')}</button>
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
              <div class="lut-strip-thumb-wrap">
                <img class="lut-strip-thumb" src={lut.thumbUrl} alt={`${lut.name} thumbnail`} loading="lazy" />
              </div>
              <div class="lut-strip-meta">
                <div class="lut-strip-name">{lut.name}</div>
                <div class="lut-strip-stats">{tr('pipeline.lut.stats', { width: lut.width, height: lut.height, count: usageCount(lut.id) })}</div>
                <button
                  type="button"
                  class="lut-strip-remove"
                  data-lut-id={lut.id}
                  aria-label={tr('pipeline.lut.removeAria', { name: lut.name })}
                  onClick={() => handleRemoveLut(lut.id)}
                >
                  {tr('pipeline.step.remove')}
                </button>
              </div>
            </article>
          )}
        </For>
        <div class="lut-strip-add-item" onClick={openFilePicker} title={tr('pipeline.lut.add')}>
          <button type="button">{tr('pipeline.lut.add')}</button>
        </div>
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

  if (disposeParamNodeList) {
    disposeParamNodeList();
    disposeParamNodeList = null;
  }

  target.textContent = '';
  disposeParamNodeList = render(() => <ParamNodeList />, target);
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

  target.textContent = '';
  disposeStepList = render(() => {
    const [steps, setSteps] = createSignal<StepModel[]>(initialSteps);
    const [luts, setLuts] = createSignal<LutModel[]>(initialLuts);

    syncStepListInternal = (nextSteps, nextLuts) => {
      if (!Array.isArray(nextSteps) || nextSteps.some(step => !isValidStepModel(step))) {
        stepListStatusReporter('Stepリストの同期Step配列が不正です。', 'error');
        return;
      }
      if (!Array.isArray(nextLuts) || nextLuts.some(lut => !isValidLutModel(lut))) {
        stepListStatusReporter('Stepリストの同期LUT配列が不正です。', 'error');
        return;
      }

      setSteps(cloneStepArray(nextSteps));
      setLuts(cloneLutArray(nextLuts));
    };

    return (
      <StepList
        steps={steps}
        luts={luts}
        onAddStep={options.onAddStep}
        onDuplicateStep={options.onDuplicateStep}
        onRemoveStep={options.onRemoveStep}
        onStepMuteChange={options.onStepMuteChange}
        onStepLabelChange={options.onStepLabelChange}
        onStepLutChange={options.onStepLutChange}
        onStepBlendModeChange={options.onStepBlendModeChange}
        onStepOpChange={options.onStepOpChange}
        shouldSuppressClick={options.shouldSuppressClick}
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
        onStatus={options.onStatus}
      />
    );
  }, target);
}

export function syncStepListState(steps: StepModel[], luts: LutModel[]): void {
  if (!Array.isArray(steps) || steps.some(step => !isValidStepModel(step))) {
    stepListStatusReporter('Stepリスト同期に失敗しました: Step配列が不正です。', 'error');
    return;
  }
  if (!Array.isArray(luts) || luts.some(lut => !isValidLutModel(lut))) {
    stepListStatusReporter('Stepリスト同期に失敗しました: LUT配列が不正です。', 'error');
    return;
  }

  if (syncStepListInternal) {
    syncStepListInternal(steps, luts);
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
