<svelte:options customElement={{ tag: 'lut-param-node-list', shadow: 'none' }} />

<script lang="ts">
  import { createEventDispatcher, onDestroy, tick } from 'svelte';
  import type { MaterialSettings } from '../../../../features/pipeline/pipeline-model.ts';
  import * as pipelineModel from '../../../../features/pipeline/pipeline-model.ts';
  import type { CustomParamModel, ParamName, ParamRef } from '../../../../features/step/step-model.ts';
  import { drawParamPreviewSphereCpu } from '../../../../platforms/browser/step-preview-cpu-render.ts';
  import { getLanguage, subscribeLanguageChange, t } from '../../i18n.ts';
  import Button from '../svelte-button.svelte';
  import { PARAM_PREVIEW_SIZE, PARAM_PREVIEW_TARGETS } from './shared.ts';

  type StatusKind = 'success' | 'error' | 'info';
  type PreviewState = { param: ParamRef; left: number; top: number };

  export let materialSettings: MaterialSettings = pipelineModel.DEFAULT_MATERIAL_SETTINGS;
  export let customParams: CustomParamModel[] = [];
  const dispatch = createEventDispatcher<{
    'add-custom-param': undefined;
    'rename-custom-param': { paramId: string; label: string };
    'set-custom-param-value': { paramId: string; value: number; recordHistory?: boolean };
    'commit-custom-param-value-change': undefined;
    'remove-custom-param': { paramId: string };
    'status-message': { message: string; kind?: StatusKind };
  }>();

  let language = getLanguage();
  let previewState: PreviewState | null = null;
  let previewCanvas: HTMLCanvasElement | null = null;
  const disposeLanguageSync = subscribeLanguageChange(nextLanguage => {
    language = nextLanguage;
  });

  function portal(node: HTMLElement) {
    if (typeof document === 'undefined') {
      return {
        destroy() {
          return undefined;
        },
      };
    }

    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      },
    };
  }

  function tr(key: Parameters<typeof t>[0], values?: Record<string, string | number>): string {
    language;
    return values ? t(key, values as never) : t(key);
  }

  function isPreviewTarget(param: ParamRef): boolean {
    return PARAM_PREVIEW_TARGETS.has(param as ParamName);
  }

  function drawPreview(param: ParamRef): void {
    if (!previewCanvas || !isPreviewTarget(param)) {
      return;
    }

    try {
      drawParamPreviewSphereCpu({
        canvas: previewCanvas,
        param: param as ParamName,
        pixelWidth: PARAM_PREVIEW_SIZE,
        pixelHeight: PARAM_PREVIEW_SIZE,
        materialSettings,
        lightDirection: pipelineModel.STEP_PREVIEW_LIGHT_DIR,
        viewDirection: pipelineModel.STEP_PREVIEW_VIEW_DIR,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : tr('common.unknownError');
      dispatch('status-message', {
        message: tr('pipeline.status.paramPreviewDrawFailed', { message }),
        kind: 'error',
      });
    }
  }

  function hidePreview(): void {
    previewState = null;
    previewCanvas = null;
  }

  function updatePreviewPosition(anchor: HTMLElement, param: ParamRef): void {
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

    previewState = { param, left, top };
  }

  async function showPreview(param: ParamRef, anchor: HTMLElement): Promise<void> {
    if (!isPreviewTarget(param)) {
      return;
    }

    updatePreviewPosition(anchor, param);
    await tick();
    if (previewState?.param === param) {
      drawPreview(param);
    }
  }

  function syncActivePreviewPosition(): void {
    if (!previewState) {
      return;
    }

    const anchor = document.querySelector<HTMLElement>(`[data-param-socket="true"][data-param="${previewState.param}"]`);
    if (!(anchor instanceof HTMLElement)) {
      hidePreview();
      return;
    }

    updatePreviewPosition(anchor, previewState.param);
  }

  function handleValueSliderInput(paramId: string, event: Event): void {
    const target = event.currentTarget as HTMLInputElement | null;
    if (!target) {
      return;
    }

    dispatch('set-custom-param-value', {
      paramId,
      value: Number(target.value),
      recordHistory: false,
    });
  }

  function handleValueSliderWheel(customParam: CustomParamModel, event: WheelEvent): void {
    const delta = event.deltaY < 0 ? 0.01 : -0.01;
    const nextValue = Math.max(0, Math.min(1, customParam.defaultValue + delta));
    dispatch('set-custom-param-value', {
      paramId: customParam.id,
      value: nextValue,
    });
    event.preventDefault();
  }

  onDestroy(() => {
    disposeLanguageSync();
  });
</script>

<svelte:window on:scroll={syncActivePreviewPosition} on:resize={syncActivePreviewPosition} />

<div class="param-root">
  {#each pipelineModel.PARAM_GROUPS as group}
    <section data-param-group={group.key} data-param-group-tone={group.tone}>
      <header data-part="param-group-head">
        <div data-part="param-group-title-row">
          <div data-part="param-group-title">{group.label}</div>
          {#if group.tone === 'feedback'}
            <span data-part="param-group-badge">{tr('pipeline.paramGroup.prevColorBadge')}</span>
          {/if}
        </div>
        <div data-part="param-group-desc">{tr(group.descriptionKey)}</div>
      </header>

      <div data-part="param-group-nodes">
        {#each group.params as paramName}
          {@const param = pipelineModel.getParamDef(paramName)}
          <button
            type="button"
            class="param-socket"
            data-param-socket="true"
            data-param={param.key}
            title={isPreviewTarget(param.key) ? undefined : tr('pipeline.param.connectTitle', { label: param.label })}
            aria-label={tr('pipeline.param.connectTitle', { label: param.label })}
            aria-describedby={isPreviewTarget(param.key) ? `param-preview-${param.key}` : undefined}
            on:mouseenter={event => void showPreview(param.key, event.currentTarget)}
            on:mouseleave={hidePreview}
            on:focus={event => void showPreview(param.key, event.currentTarget)}
            on:blur={hidePreview}
          >
            <span data-part="socket-dot" aria-hidden="true"></span>
            <span data-part="param-name">{param.label}</span>
            <span data-part="param-desc">{param.description}</span>
          </button>
        {/each}
      </div>
    </section>
  {/each}

  <section data-param-group="custom-params" data-param-group-tone="default">
    <header data-part="param-group-head">
      <div data-part="param-group-title-row">
        <div data-part="param-group-title">Custom Params</div>
      </div>
      <div data-part="param-group-desc">{tr('pipeline.paramGroup.customParamsDesc')}</div>
    </header>

    <div data-part="param-group-nodes">
      {#each customParams as customParam}
        <div
          class="custom-param-item"
          data-param-id={customParam.id}
          data-param={pipelineModel.buildCustomParamRef(customParam.id)}
          data-param-socket="true"
          data-custom-param-item="true"
          aria-label={`Connect ${customParam.label}`}
          title={`Connect ${customParam.label}`}
        >
          <span data-part="socket-dot" aria-hidden="true"></span>
          <div data-part="custom-param-header" data-socket-drag-ignore="true">
            <button
              type="button"
              class="custom-param-handle"
              data-socket-drag-ignore="true"
              data-custom-param-handle="true"
              draggable={true}
              aria-label={`Reorder ${customParam.label}`}
              on:pointerdown={event => event.stopPropagation()}
            >
              <span data-part="custom-param-grip" aria-hidden="true"></span>
            </button>
            <input
              class="custom-param-input"
              data-socket-drag-ignore="true"
              value={customParam.label}
              maxlength={pipelineModel.MAX_CUSTOM_PARAM_LABEL_LENGTH}
              aria-label={`Custom param label ${customParam.id}`}
              on:blur={event => dispatch('rename-custom-param', {
                paramId: customParam.id,
                label: event.currentTarget.value,
              })}
            />
            <Button
              variant={["destructive", "small"]}
              className="custom-param-remove"
              handlePress={() => dispatch('remove-custom-param', { paramId: customParam.id })}
            >
              {tr('pipeline.param.remove')}
            </Button>
          </div>
          <div data-part="custom-param-meta">
            <span data-part="param-desc">{`u_param_${customParam.id}`}</span>
          </div>
          <div data-part="custom-param-slider-row" data-socket-drag-ignore="true">
            <input
              type="range"
              class="custom-param-range"
              data-socket-drag-ignore="true"
              min="0"
              max="1"
              step="0.01"
              value={String(customParam.defaultValue)}
              on:input={event => handleValueSliderInput(customParam.id, event)}
              on:change={() => dispatch('commit-custom-param-value-change')}
              on:wheel={event => handleValueSliderWheel(customParam, event)}
            />
            <span data-part="custom-param-value">{customParam.defaultValue.toFixed(2)}</span>
          </div>
        </div>
      {/each}

      <Button variant="secondary" className="add-param-button" handlePress={() => dispatch('add-custom-param')}>
        {tr('pipeline.param.add')}
      </Button>
    </div>
  </section>

  {#if previewState}
    <span
      use:portal
      class="tooltip"
      id={`param-preview-${previewState.param}`}
      role="tooltip"
      aria-label={tr('pipeline.param.previewTooltip', { label: pipelineModel.getParamDef(previewState.param as ParamName).label })}
      style={`left:${previewState.left}px;top:${previewState.top}px;`}
    >
      <span class="tooltip-label">{tr('pipeline.param.previewScale')}</span>
      <canvas
        class="tooltip-canvas"
        width={PARAM_PREVIEW_SIZE}
        height={PARAM_PREVIEW_SIZE}
        bind:this={previewCanvas}
      ></canvas>
    </span>
  {/if}
</div>

<style>
  .param-root {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  [data-param-group] {
    border: 1px solid var(--color-line);
    border-radius: 14px;
    padding: 10px;
    background: color-mix(in srgb, var(--color-panel), var(--color-bg) 12%);
  }

  [data-param-group-tone="feedback"] {
    border-color: var(--color-feedback-border, var(--color-accent));
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--color-accent), transparent 92%), color-mix(in srgb, var(--color-accent), transparent 98%)),
      color-mix(in srgb, var(--color-panel), var(--color-bg) 8%);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent), transparent 92%);
  }

  [data-part="param-group-head"] {
    margin-bottom: 8px;
  }

  [data-part="param-group-title-row"] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  [data-part="param-group-title"] {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-strong);
  }

  [data-part="param-group-badge"] {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 8px;
    border-radius: 999px;
    border: 1px solid var(--color-feedback-badge-border, var(--color-accent));
    background: var(--color-feedback-badge-bg, color-mix(in srgb, var(--color-accent), transparent 88%));
    color: var(--color-feedback-badge-text, var(--color-accent));
    font-size: 10px;
    font-weight: 700;
  }

  [data-part="param-group-desc"] {
    margin-top: 4px;
    font-size: 11px;
    line-height: 1.45;
    color: var(--color-muted);
  }

  [data-part="param-group-nodes"] {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .param-socket,
  .custom-param-item {
    position: relative;
    width: 100%;
    text-align: left;
    border: 1px solid var(--color-line);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-panel), var(--color-bg) 10%);
    color: var(--color-text);
    padding: 10px 34px 10px 10px;
    min-height: 54px;
    transition: 120ms ease;
  }

  .param-socket {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    cursor: pointer;
    user-select: none;
  }

  .param-socket:hover,
  .param-socket:focus-visible,
  .custom-param-item:hover,
  .custom-param-item:focus-within {
    border-color: var(--color-accent);
    transform: translateY(-1px);
  }

  .custom-param-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
    cursor: grab;
    padding-right: 10px;
  }

  :global([data-custom-param-item="true"][data-dragging="true"]) {
    opacity: 0.42;
  }

  :global([data-custom-param-item="true"][data-drop-position="before"]) {
    box-shadow: inset 0 3px 0 var(--color-accent);
  }

  :global([data-custom-param-item="true"][data-drop-position="after"]) {
    box-shadow: inset 0 -3px 0 var(--color-accent);
  }

  [data-part="socket-dot"] {
    position: absolute;
    top: 50%;
    right: 8px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--color-socket-border, var(--color-accent));
    background: var(--color-socket-bg, var(--color-panel));
    transform: translateY(-50%);
    pointer-events: none;
  }

  [data-part="param-name"] {
    font-size: 12px;
    font-weight: 700;
    color: var(--color-text-strong);
  }

  [data-part="param-desc"] {
    font-size: 11px;
    color: var(--color-muted);
  }

  [data-part="custom-param-header"],
  [data-part="custom-param-slider-row"] {
    display: grid;
    align-items: center;
    grid-template-columns: auto 1fr auto;
    gap: 4px;
    width: 100%;
    min-width: 0;
  }

  [data-part="custom-param-meta"] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
  }

  .custom-param-handle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: stretch;
    min-width: 8px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--color-muted);
    cursor: grab;
  }

  .custom-param-handle:active {
    cursor: grabbing;
  }

  [data-part="custom-param-grip"] {
    width: 8px;
    height: 18px;
    opacity: 0.9;
    background-image:
      radial-gradient(circle, currentColor 1.1px, transparent 1.2px),
      radial-gradient(circle, currentColor 1.1px, transparent 1.2px);
    background-position: 0 0, 4px 0;
    background-size: 4px 6px;
    background-repeat: repeat-y;
  }

  .custom-param-input {
    min-width: 0;
    width: 100%;
    padding: 4px 6px;
    border: 1px solid var(--color-line);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-panel), white 4%);
    color: var(--color-text-strong);
    font-size: 12px;
    font-weight: 700;
  }

  .custom-param-range {
    width: 100%;
    accent-color: var(--color-accent);
  }

  [data-part="custom-param-value"] {
    min-width: 32px;
    text-align: right;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--color-text-strong);
  }

  :global(.add-param-button) {
    width: 100%;
    justify-content: center;
  }

  .tooltip {
    position: fixed;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--color-line), var(--color-text-strong) 12%);
    background: color-mix(in srgb, var(--color-panel), var(--color-bg) 18%);
    box-shadow: 0 12px 28px color-mix(in srgb, var(--color-bg), transparent 72%);
    z-index: 20;
    pointer-events: none;
  }

  .tooltip-label {
    font-size: 10px;
    line-height: 1.2;
    letter-spacing: 0.04em;
    color: var(--color-muted);
  }

  .tooltip-canvas {
    width: 112px;
    height: 112px;
    display: block;
    border-radius: 8px;
    background:
      radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--color-text-strong), transparent 88%), transparent 58%),
      color-mix(in srgb, var(--color-panel), var(--color-bg) 32%);
  }
</style>
