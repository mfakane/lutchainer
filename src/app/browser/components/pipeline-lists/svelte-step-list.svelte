<svelte:options customElement={{ tag: 'lut-step-list', shadow: 'none' }} />

<script lang="ts">
  import { afterUpdate, beforeUpdate, onDestroy } from 'svelte';
  import * as pipelineModel from '../../../../features/pipeline/pipeline-model.ts';
  import type { BlendOp, ChannelName, CustomParamModel, LutModel, StepModel } from '../../../../features/step/step-model.ts';
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
  export let onCaptureScroll: ((top: number, left: number) => void) | undefined = undefined;
  export let onAddStep: () => void = () => undefined;
  export let onDuplicateStep: (stepId: string) => void = () => undefined;
  export let onRemoveStep: (stepId: string) => void = () => undefined;
  export let onStepMuteChange: (stepId: string, muted: boolean) => void = () => undefined;
  export let onStepLabelChange: (stepId: string, label: string | null) => void = () => undefined;
  export let onStepLutChange: (stepId: string, lutId: string) => void = () => undefined;
  export let onStepBlendModeChange: (stepId: string, blendMode: StepModel['blendMode']) => void = () => undefined;
  export let onStepOpChange: (stepId: string, channel: ChannelName, op: BlendOp) => void = () => undefined;
  export let shouldSuppressClick: (() => boolean) | undefined = undefined;
  export let onOpenPipelineFilePicker: () => void = () => undefined;
  export let onLoadExample: (example: import('../../ui/pipeline-presets.ts').PipelinePresetKey) => void | Promise<void> = () => undefined;
  export let onScheduleConnectionDraw: () => void = () => undefined;
  export let computeLutUv:
    | ((
        stepIndex: number,
        pixelX: number,
        pixelY: number,
        canvasWidth: number,
        canvasHeight: number,
      ) => { u: number; v: number } | null)
    | undefined = undefined;
  export let onStatus: (message: string, kind?: StatusKind) => void = () => undefined;

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

  function shouldIgnoreClick(): boolean {
    if (!shouldSuppressClick) {
      return false;
    }

    try {
      return shouldSuppressClick();
    } catch {
      onStatus(tr('pipeline.status.suppressClickFailed'), 'error');
      return false;
    }
  }

  function captureScrollPosition(): void {
    if (!scrollRoot) {
      return;
    }

    scrollState.savedTop = scrollRoot.scrollTop;
    scrollState.savedLeft = scrollRoot.scrollLeft;
    onCaptureScroll?.(scrollState.savedTop, scrollState.savedLeft);
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
    if (shouldIgnoreClick()) {
      return;
    }

    captureScrollPosition();
    onAddStep();
    scheduleScrollRestore();
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

<div
  class="step-root"
  use:bindScrollRoot
  on:scroll={() => {
    if (scrollState.restoring || pendingScrollRestore) {
      return;
    }
    captureScrollPosition();
    onScheduleConnectionDraw();
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
        shouldIgnoreClick={shouldIgnoreClick}
        onCaptureScroll={captureScrollPosition}
        {onStepMuteChange}
        {onDuplicateStep}
        {onRemoveStep}
        {onStepLabelChange}
        {onStepLutChange}
        {onStepBlendModeChange}
        {onStepOpChange}
        {computeLutUv}
        {onStatus}
      />
    {/each}
  {:else}
    <StepWelcome
      {tr}
      {onStatus}
      onOpenPipelineFilePicker={() => {
        if (shouldIgnoreClick()) {
          return;
        }
        onOpenPipelineFilePicker();
      }}
      onLoadExample={async example => {
        if (shouldIgnoreClick()) {
          return;
        }
        await onLoadExample(example);
      }}
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
