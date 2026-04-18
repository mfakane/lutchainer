<svelte:options customElement={{ tag: 'lut-step-list', shadow: 'none' }} />

<script lang="ts">
  import { afterUpdate, beforeUpdate, createEventDispatcher, onDestroy } from 'svelte';
  import * as pipelineModel from '../../../../features/pipeline/pipeline-model.ts';
  import type { BlendOp, ChannelName, CustomParamModel, LutModel, StepModel } from '../../../../features/step/step-model.ts';
  import type { PipelinePresetKey } from '../../ui/pipeline-presets.ts';
  import { getLanguage, subscribeLanguageChange, t } from '../../i18n.ts';
  import Button from '../svelte-button.svelte';
  import StepRow from './svelte-step-row.svelte';
  import StepWelcome from './svelte-step-welcome.svelte';

  type StatusKind = 'success' | 'error' | 'info';

  export let steps: StepModel[] = [];
  export let luts: LutModel[] = [];
  export let customParams: CustomParamModel[] = [];
  export let preservedScrollTop = 0;
  export let preservedScrollLeft = 0;
  export let restoreNonce = 0;
  export let computeLutUv:
    | ((
        stepIndex: number,
        pixelX: number,
        pixelY: number,
        canvasWidth: number,
        canvasHeight: number,
      ) => { u: number; v: number } | null)
    | undefined = undefined;
  const dispatch = createEventDispatcher<{
    'add-step': undefined;
    'duplicate-step': { stepId: string };
    'remove-step': { stepId: string };
    'step-mute-change': { stepId: string; muted: boolean };
    'step-label-change': { stepId: string; label: string | null };
    'step-lut-change': { stepId: string; lutId: string };
    'step-blend-mode-change': { stepId: string; blendMode: StepModel['blendMode'] };
    'step-op-change': { stepId: string; channel: ChannelName; op: BlendOp };
    'open-pipeline-file-picker': undefined;
    'load-example': { example: PipelinePresetKey };
    'schedule-connection-draw': undefined;
    'status-message': { message: string; kind?: StatusKind };
  }>();

  let language = getLanguage();
  let scrollRoot: HTMLDivElement | null = null;
  let pendingScrollRestore = false;
  let previousRestoreNonce = 0;
  const scrollState = {
    savedTop: 0,
    savedLeft: 0,
    restoring: false,
  };
  const disposeLanguageSync = subscribeLanguageChange(nextLanguage => {
    language = nextLanguage;
  });

  $: {
    scrollState.savedTop = preservedScrollTop;
    scrollState.savedLeft = preservedScrollLeft;
  }

  $: if (restoreNonce > 0) {
    pendingScrollRestore = true;
    scrollState.restoring = true;
  }

  beforeUpdate(() => {
    if (restoreNonce === previousRestoreNonce) {
      return;
    }

    previousRestoreNonce = restoreNonce;
    if (!scrollRoot) {
      return;
    }

    scrollState.savedTop = scrollRoot.scrollTop;
    scrollState.savedLeft = scrollRoot.scrollLeft;
    pendingScrollRestore = true;
    scrollState.restoring = true;
  });

  function tr(key: Parameters<typeof t>[0], values?: Record<string, string | number>): string {
    language;
    return values ? t(key, values as never) : t(key);
  }

  function emitStatus(message: string, kind: StatusKind = 'info'): void {
    dispatch('status-message', { message, kind });
  }

  function captureScrollPosition(): void {
    if (!scrollRoot) {
      return;
    }

    scrollState.savedTop = scrollRoot.scrollTop;
    scrollState.savedLeft = scrollRoot.scrollLeft;
  }

  function restoreScrollPosition(target: HTMLElement): void {
    target.scrollTop = scrollState.savedTop;
    target.scrollLeft = scrollState.savedLeft;
  }

  function scheduleScrollRestore(): void {
    pendingScrollRestore = true;
    queueMicrotask(() => {
      if (!scrollRoot) {
        pendingScrollRestore = false;
        return;
      }

      scrollState.restoring = true;
      restoreScrollPosition(scrollRoot);
      requestAnimationFrame(() => {
        if (!scrollRoot) {
          scrollState.restoring = false;
          pendingScrollRestore = false;
          return;
        }

        restoreScrollPosition(scrollRoot);
        requestAnimationFrame(() => {
          if (!scrollRoot) {
            scrollState.restoring = false;
            pendingScrollRestore = false;
            return;
          }

          restoreScrollPosition(scrollRoot);
          scrollState.restoring = false;
          pendingScrollRestore = false;
        });
      });
    });
  }

  function bindScrollRoot(node: HTMLDivElement): { destroy: () => void } {
    scrollRoot = node;
    restoreScrollPosition(node);
    const observer = new MutationObserver(() => {
      if (scrollState.restoring) {
        return;
      }
      if (Math.abs(node.scrollTop - scrollState.savedTop) <= 1 && Math.abs(node.scrollLeft - scrollState.savedLeft) <= 1) {
        return;
      }
      scrollState.restoring = true;
      restoreScrollPosition(node);
      queueMicrotask(() => {
        if (scrollRoot === node) {
          restoreScrollPosition(node);
        }
        scrollState.restoring = false;
      });
    });
    observer.observe(node, { childList: true, subtree: true });
    return {
      destroy: () => {
        observer.disconnect();
        if (scrollRoot === node) {
          scrollRoot = null;
        }
      },
    };
  }

  function handleAddStepClick(): void {
    captureScrollPosition();
    dispatch('add-step');
    scheduleScrollRestore();
  }

  function handleStepMuteChange(stepId: string, muted: boolean): void {
    dispatch('step-mute-change', { stepId, muted });
  }

  function handleDuplicateStep(stepId: string): void {
    dispatch('duplicate-step', { stepId });
  }

  function handleRemoveStep(stepId: string): void {
    dispatch('remove-step', { stepId });
  }

  function handleStepLabelChange(stepId: string, label: string | null): void {
    dispatch('step-label-change', { stepId, label });
  }

  function handleStepLutChange(stepId: string, lutId: string): void {
    dispatch('step-lut-change', { stepId, lutId });
  }

  function handleStepBlendModeChange(stepId: string, blendMode: StepModel['blendMode']): void {
    dispatch('step-blend-mode-change', { stepId, blendMode });
  }

  function handleStepOpChange(stepId: string, channel: ChannelName, op: BlendOp): void {
    dispatch('step-op-change', { stepId, channel, op });
  }

  afterUpdate(() => {
    if (!scrollRoot) {
      return;
    }

    const deltaTop = Math.abs(scrollRoot.scrollTop - scrollState.savedTop);
    const deltaLeft = Math.abs(scrollRoot.scrollLeft - scrollState.savedLeft);
    if (deltaTop <= 1 && deltaLeft <= 1) {
      if (pendingScrollRestore) {
        pendingScrollRestore = false;
      }
      scrollState.restoring = false;
      return;
    }

    scrollState.restoring = true;
    scrollRoot.scrollTop = scrollState.savedTop;
    scrollRoot.scrollLeft = scrollState.savedLeft;
    requestAnimationFrame(() => {
        if (!scrollRoot) {
          scrollState.restoring = false;
          pendingScrollRestore = false;
          return;
        }

        scrollRoot.scrollTop = scrollState.savedTop;
        scrollRoot.scrollLeft = scrollState.savedLeft;
        requestAnimationFrame(() => {
          if (!scrollRoot) {
            scrollState.restoring = false;
            pendingScrollRestore = false;
            return;
          }

          scrollRoot.scrollTop = scrollState.savedTop;
          scrollRoot.scrollLeft = scrollState.savedLeft;
          scrollState.restoring = false;
          pendingScrollRestore = false;
        });
      });
  });

  onDestroy(() => {
    disposeLanguageSync();
  });
</script>

{#key language}
<div
  class="step-root"
  use:bindScrollRoot
  on:scroll={() => {
    if (scrollState.restoring || pendingScrollRestore) {
      return;
    }
    captureScrollPosition();
    dispatch('schedule-connection-draw');
  }}
>
  {#if steps.length > 0}
    {#each steps as step, index (step.id)}
      <StepRow
        {step}
        stepIndex={index}
        {luts}
        {customParams}
        {tr}
        onCaptureScroll={captureScrollPosition}
        onStepMuteChange={handleStepMuteChange}
        onDuplicateStep={handleDuplicateStep}
        onRemoveStep={handleRemoveStep}
        onStepLabelChange={handleStepLabelChange}
        onStepLutChange={handleStepLutChange}
        onStepBlendModeChange={handleStepBlendModeChange}
        onStepOpChange={handleStepOpChange}
        {computeLutUv}
        onStatus={emitStatus}
      />
    {/each}
  {:else}
    <StepWelcome
      {tr}
      onStatus={emitStatus}
      onOpenPipelineFilePicker={() => dispatch('open-pipeline-file-picker')}
      onLoadExample={example => dispatch('load-example', { example })}
    />
  {/if}

  <Button
    variant="secondary"
    className="inline-add-button"
    blurOnPress={true}
    handleMouseDown={event => {
      pendingScrollRestore = true;
      captureScrollPosition();
      event.preventDefault();
    }}
    handlePress={handleAddStepClick}
  >
    {tr('pipeline.step.add')}
  </Button>
</div>
{/key}

<style>
  .step-root {
    position: relative;
    z-index: 4;
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 12px 12px 12px 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  :global([data-step-item="true"][data-dragging="true"]) {
    opacity: 0.42;
  }

  :global([data-step-item="true"][data-drop-position="before"]) {
    box-shadow: inset 0 3px 0 var(--color-accent);
  }

  :global([data-step-item="true"][data-drop-position="after"]) {
    box-shadow: inset 0 -3px 0 var(--color-accent);
  }

  :global(.step-action-button) {
    padding: 4px 8px;
    font-size: 11px;
  }

  :global(.step-remove-button) {
    color: var(--color-danger-text);
  }

  :global([data-step-socket="true"][data-socket-target="true"]) {
    border-color: var(--color-socket-target-border);
    box-shadow: 0 0 0 3px var(--color-accent-ring-strong);
  }

  :global([data-step-socket="true"][data-socket-source-active="true"]) {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-ring);
  }

  :global(.inline-add-button) {
    width: 100%;
    border-style: dashed;
    border-radius: 12px;
    background: transparent;
    padding: 8px;
  }

  :global(.inline-add-button:hover) {
    transform: none;
    border-color: var(--color-accent);
    background: color-mix(in srgb, var(--color-surface-inset), var(--color-accent) 8%);
  }
</style>
