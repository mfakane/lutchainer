import { For, Show, createSignal, type JSX } from 'solid-js';
import * as pipelineModel from '../../../../features/pipeline/pipeline-model.ts';
import { getCustomChannelsForBlendMode, getSelectableBlendOpsForChannel } from '../../../../features/step/step-blend-strategies.ts';
import { BLEND_MODES, MAX_STEP_LABEL_LENGTH, type BlendOp, type ChannelName, type LutModel, type StepModel } from '../../../../features/step/step-model.ts';
import { t, useLanguage } from '../../i18n.ts';
import { cx } from '../../styles/cx.ts';
import * as ui from '../../styles/ui-primitives.css.ts';
import * as styles from './shared.css.ts';
import type { StepListProps } from './shared.ts';
import { isNonEmptyString } from './shared.ts';
import { StepWelcome } from './solid-step-welcome.tsx';

export function StepList(props: StepListProps): JSX.Element {
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

  const commitStepLabel = (stepId: string, displayIndex: number, inputElement: HTMLInputElement | null): void => {
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
      props.onStatus(tr('pipeline.status.stepLabelTooLong', { max: MAX_STEP_LABEL_LENGTH }), 'error');
      inputElement.value = trimmed.slice(0, MAX_STEP_LABEL_LENGTH);
      return;
    }

    props.onStepLabelChange(stepId, trimmed.length > 0 ? trimmed : null);
    inputElement.value = trimmed.length > 0 ? trimmed : `Step ${displayIndex}`;
  };

  return (
    <div class={styles.stepRoot}>
      <Show
        when={props.steps().length > 0}
        fallback={(
          <StepWelcome
            onOpenPipelineFilePicker={() => {
              if (shouldIgnoreClick()) {
                return;
              }

              props.onOpenPipelineFilePicker();
            }}
            onLoadExample={async example => {
              if (shouldIgnoreClick()) {
                return;
              }

              await props.onLoadExample(example);
            }}
            onStatus={props.onStatus}
          />
        )}
      >
        <For each={props.steps()}>
          {(step, index) => {
            const selectedLut = (): LutModel | null => resolveLut(step.lutId);
            const editableChannels = (): ChannelName[] => getCustomChannelsForBlendMode(step.blendMode);
            const selectableOps = (): BlendOp[] => getSelectableBlendOpsForChannel(step.blendMode);
            const displayIndex = (): number => index() + 1;
            const [crosshairUv, setCrosshairUv] = createSignal<{ u: number; v: number } | null>(null);

            return (
              <article data-step-item="true" data-step-id={step.id} data-muted={step.muted ? 'true' : undefined}>
                <section data-part="step-head">
                  <div data-part="step-title-row">
                    <button
                      type="button"
                      class={ui.ghostButton}
                      draggable={true}
                      data-step-drag-handle="true"
                      data-step-id={step.id}
                      title={tr('pipeline.step.dragMove')}
                    >
                      drag
                    </button>
                    <input
                      type="text"
                      class={cx(ui.editableTextInput, styles.stepTitleInput)}
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
                  <div data-part="step-actions">
                    <button
                      type="button"
                      class={cx(ui.buttonBase, ui.smallActionButton, step.muted && ui.activeAccent)}
                      data-step-id={step.id}
                      aria-pressed={step.muted ? 'true' : 'false'}
                      onClick={() => {
                        if (shouldIgnoreClick()) return;
                        props.onStepMuteChange(step.id, !step.muted);
                      }}
                    >
                      {step.muted ? tr('pipeline.step.unmute') : tr('pipeline.step.mute')}
                    </button>
                    <button
                      type="button"
                      class={cx(ui.buttonBase, ui.smallActionButton)}
                      data-step-id={step.id}
                      onClick={() => {
                        if (shouldIgnoreClick()) return;
                        props.onDuplicateStep(step.id);
                      }}
                    >
                      {tr('pipeline.step.duplicate')}
                    </button>
                    <button
                      type="button"
                      class={cx(ui.buttonBase, ui.smallActionButton, ui.removeText)}
                      data-step-id={step.id}
                      onClick={() => {
                        if (shouldIgnoreClick()) return;
                        props.onRemoveStep(step.id);
                      }}
                    >
                      {tr('pipeline.step.remove')}
                    </button>
                  </div>
                </section>

                <aside data-part="step-socket-rail">
                  <button type="button" class={styles.socketButton} data-step-socket="true" data-step-id={step.id} data-axis="x" title={`X: ${pipelineModel.getParamLabel(step.xParam, props.customParams())}`}>
                    <span data-part="socket-dot" aria-hidden="true"></span>
                    <span data-part="step-socket-axis-label">X</span>
                    <span data-part="step-socket-param">{pipelineModel.getParamLabel(step.xParam, props.customParams())}</span>
                  </button>
                  <button type="button" class={styles.socketButton} data-step-socket="true" data-step-id={step.id} data-axis="y" title={`Y: ${pipelineModel.getParamLabel(step.yParam, props.customParams())}`}>
                    <span data-part="socket-dot" aria-hidden="true"></span>
                    <span data-part="step-socket-axis-label">Y</span>
                    <span data-part="step-socket-param">{pipelineModel.getParamLabel(step.yParam, props.customParams())}</span>
                  </button>
                </aside>

                <section data-part="step-core">
                  <div data-part="lut-row">
                    <label data-part="lut-select-field">
                      <span data-part="lut-select-label">{tr('pipeline.step.lut')}</span>
                      <select
                        class={ui.controlSelect}
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

                    <div data-part="lut-thumb-wrap">
                      <img class={ui.checkerBg} data-part="lut-thumb" src={selectedLut()?.thumbUrl ?? ''} alt="LUT thumbnail" />
                      <Show when={crosshairUv() !== null}>
                        <div
                          data-part="lut-crosshair"
                          style={`--ch-x: ${(crosshairUv()?.u ?? 0) * 100}%; --ch-y: ${(crosshairUv()?.v ?? 0) * 100}%`}
                          aria-hidden="true"
                        />
                      </Show>
                    </div>
                  </div>

                  <div>
                    <label data-part="step-mode-field">
                      <span data-part="op-label">{tr('pipeline.step.blendMode')}</span>
                      <select
                        class={ui.controlSelect}
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
                    <div data-part="op-grid">
                      <For each={editableChannels()}>
                        {channel => (
                          <label data-part="op-item">
                            <span data-part="op-label">{channel.toUpperCase()}</span>
                            <select
                              class={ui.controlSelect}
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

                <aside data-part="step-preview">
                  <canvas
                    class={styles.stepPreviewCanvas}
                    data-part="preview-swatch"
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

      <button type="button" class={cx(ui.buttonBase, ui.secondaryButton, ui.inlineAddButton)} onClick={handleAddStepClick}>
        {tr('pipeline.step.add')}
      </button>
    </div>
  );
}
