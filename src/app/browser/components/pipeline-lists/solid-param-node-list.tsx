import { For, Index, Show, createSignal, onCleanup, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import * as pipelineModel from '../../../../features/pipeline/pipeline-model.ts';
import type { ParamName, ParamRef } from '../../../../features/step/step-model.ts';
import { drawParamPreviewSphereCpu } from '../../../../features/step/step-preview-cpu-render.ts';
import { t, useLanguage } from '../../i18n.ts';
import { cx } from '../../styles/cx.ts';
import * as ui from '../../styles/ui-primitives.css.ts';
import { CustomParamNode } from './custom-param-node.tsx';
import * as styles from './shared.css.ts';
import type { ParamNodeListProps, ParamPreviewState } from './shared.ts';
import { PARAM_PREVIEW_SIZE, PARAM_PREVIEW_TARGETS } from './shared.ts';

export function ParamNodeList(props: ParamNodeListProps): JSX.Element {
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
      props.onStatus(tr('pipeline.status.paramPreviewDrawFailed', { message }), 'error');
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
    const anchor = document.querySelector<HTMLElement>(`[data-param-socket="true"][data-param="${current.param}"]`);
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
    <div class={styles.paramRoot}>
      <For each={pipelineModel.PARAM_GROUPS}>
        {group => (
          <section data-param-group={group.key} data-param-group-tone={group.tone}>
            <header data-part="param-group-head">
              <div data-part="param-group-title-row">
                <div data-part="param-group-title">{group.label}</div>
                <Show when={group.tone === 'feedback'}>
                  <span data-part="param-group-badge">{tr('pipeline.paramGroup.prevColorBadge')}</span>
                </Show>
              </div>
              <div data-part="param-group-desc">{tr(group.descriptionKey)}</div>
            </header>

            <div data-part="param-group-nodes">
              <For each={group.params}>
                {paramName => {
                  const param = pipelineModel.getParamDef(paramName);

                  return (
                    <button
                      type="button"
                      class={ui.buttonBase}
                      data-param-socket="true"
                      data-param={param.key}
                      title={isPreviewTarget(param.key) ? undefined : tr('pipeline.param.connectTitle', { label: param.label })}
                      aria-label={tr('pipeline.param.connectTitle', { label: param.label })}
                      onMouseEnter={event => showPreview(param.key, event.currentTarget)}
                      onMouseLeave={hidePreview}
                      onFocus={event => showPreview(param.key, event.currentTarget)}
                      onBlur={hidePreview}
                      aria-describedby={isPreviewTarget(param.key) ? `param-preview-${param.key}` : undefined}
                    >
                      <span data-part="socket-dot" aria-hidden="true"></span>
                      <span data-part="param-name">{param.label}</span>
                      <span data-part="param-desc">{param.description}</span>
                    </button>
                  );
                }}
              </For>
            </div>
          </section>
        )}
      </For>
      <section data-param-group="custom-params" data-param-group-tone="default">
        <header data-part="param-group-head">
          <div data-part="param-group-title-row">
            <div data-part="param-group-title">Custom Params</div>
          </div>
          <div data-part="param-group-desc">{tr('pipeline.paramGroup.customParamsDesc')}</div>
        </header>

        <div data-part="param-group-nodes">
          <Index each={props.customParams()}>
            {customParam => (
              <CustomParamNode
                customParam={customParam}
                onRenameCustomParam={props.onRenameCustomParam}
                onSetCustomParamValue={props.onSetCustomParamValue}
                onCommitCustomParamValueChange={props.onCommitCustomParamValueChange}
                onRemoveCustomParam={props.onRemoveCustomParam}
              />
            )}
          </Index>

          <button type="button" class={cx(ui.buttonBase, ui.secondaryButton, ui.inlineAddButton)} onClick={props.onAddCustomParam}>
            {tr('pipeline.param.add')}
          </button>
        </div>
      </section>
      <Show when={previewState()}>
        {state => (
          <Portal>
            <span
              class={styles.tooltip}
              id={`param-preview-${state().param}`}
              role="tooltip"
              aria-label={tr('pipeline.param.previewTooltip', { label: pipelineModel.getParamDef(state().param).label })}
              style={{ left: `${state().left}px`, top: `${state().top}px` }}
            >
              <span class={styles.tooltipLabel}>{tr('pipeline.param.previewScale')}</span>
              <canvas
                class={styles.tooltipCanvas}
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
    </div>
  );
}
