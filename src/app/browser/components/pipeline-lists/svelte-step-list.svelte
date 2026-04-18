<svelte:options customElement={{ tag: 'lut-step-list', shadow: 'none' }} />

<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import type { BlendOp, ChannelName, CustomParamModel, LutModel, StepModel } from '../../../../features/step/step-model.ts';
  import { getLanguage, subscribeLanguageChange, t } from '../../i18n.ts';
  import type { PipelinePresetKey } from '../../ui/pipeline-presets.ts';
  import Button from '../svelte-button.svelte';
  import StepRow from './svelte-step-row.svelte';
  import StepWelcome from './svelte-step-welcome.svelte';

  type StatusKind = 'success' | 'error' | 'info';

  let {
    steps = [],
    luts = [],
    customParams = [],
    preservedScrollTop = 0,
    preservedScrollLeft = 0,
    restoreNonce = 0,
    computeLutUv = undefined,
  }: {
    steps?: StepModel[];
    luts?: LutModel[];
    customParams?: CustomParamModel[];
    preservedScrollTop?: number;
    preservedScrollLeft?: number;
    restoreNonce?: number;
    computeLutUv?:
    | ((
        stepIndex: number,
        pixelX: number,
        pixelY: number,
        canvasWidth: number,
        canvasHeight: number,
      ) => { u: number; v: number } | null)
    | undefined;
  } = $props();
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

  let language = $state(getLanguage());
  let scrollRoot = $state<HTMLDivElement | null>(null);
  const scrollState = {
    savedTop: 0,
    savedLeft: 0,
    restoring: false,
    appliedRestoreNonce: -1,
    appliedRestoreNode: null as HTMLDivElement | null,
  };
  const disposeLanguageSync = subscribeLanguageChange((nextLanguage: ReturnType<typeof getLanguage>) => {
    language = nextLanguage;
  });

  function tr(key: Parameters<typeof t>[0], values?: Record<string, string | number>): string {
    language;
    return values ? t(key, values as never) : t(key);
  }

  function emitStatus(message: string, kind: StatusKind = 'info'): void {
    dispatch('status-message', { message, kind });
  }

  function captureScrollPosition(syncParent = false): void {
    if (!scrollRoot) {
      return;
    }

    scrollState.savedTop = scrollRoot.scrollTop;
    scrollState.savedLeft = scrollRoot.scrollLeft;
    if (syncParent && !scrollState.restoring) {
      dispatch('schedule-connection-draw');
    }
  }

  function restoreScrollPosition(target: HTMLElement): void {
    target.scrollTop = scrollState.savedTop;
    target.scrollLeft = scrollState.savedLeft;
  }

  function bindScrollRoot(node: HTMLDivElement): { destroy: () => void } {
    scrollRoot = node;
    scrollState.savedTop = node.scrollTop;
    scrollState.savedLeft = node.scrollLeft;
    return {
      destroy: () => {
        if (scrollRoot === node) {
          scrollRoot = null;
        }
      },
    };
  }

  function handleAddStepClick(): void {
    captureScrollPosition();
    dispatch('add-step');
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

  $effect(() => {
    const node = scrollRoot;
    if (!node) {
      return;
    }
    const nextRestoreNonce = restoreNonce;
    if (nextRestoreNonce === scrollState.appliedRestoreNonce && node === scrollState.appliedRestoreNode) {
      return;
    }

    if (!(preservedScrollTop === 0 && scrollState.savedTop > 0)) {
      scrollState.savedTop = preservedScrollTop;
    }
    if (!(preservedScrollLeft === 0 && scrollState.savedLeft > 0)) {
      scrollState.savedLeft = preservedScrollLeft;
    }
    scrollState.appliedRestoreNonce = nextRestoreNonce;
    scrollState.appliedRestoreNode = node;
    scrollState.restoring = true;

    restoreScrollPosition(node);
    requestAnimationFrame(() => {
        if (scrollRoot !== node) {
          scrollState.restoring = false;
          return;
        }

        restoreScrollPosition(node);
        requestAnimationFrame(() => {
          if (scrollRoot !== node) {
            scrollState.restoring = false;
            return;
          }

          restoreScrollPosition(node);
          scrollState.restoring = false;
          dispatch('schedule-connection-draw');
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
  onscroll={() => {
    if (scrollState.restoring) {
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
        onCaptureScroll={() => captureScrollPosition(true)}
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
      onLoadExample={example => {
        dispatch('load-example', { example });
      }}
    />
  {/if}

  <Button
    variant="secondary"
    className="inline-add-button"
    blurOnPress={true}
    handleMouseDown={event => {
      captureScrollPosition(true);
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
