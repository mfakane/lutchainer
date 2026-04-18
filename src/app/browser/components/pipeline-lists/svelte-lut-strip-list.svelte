<svelte:options customElement={{ tag: 'lut-lut-strip-list', shadow: 'none' }} />

<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import type { LutModel, StepModel } from '../../../../features/step/step-model.ts';
  import { getLanguage, subscribeLanguageChange, t } from '../../i18n.ts';
  import Button from '../svelte-button.svelte';
  import DropdownMenu from '../svelte-dropdown-menu.svelte';

  type StatusKind = 'success' | 'error' | 'info';

  const {
    luts = [],
    steps = [],
    canEditLut = false,
    canDuplicateLut = false,
    canCreateNewLut = false,
  }: {
    luts?: LutModel[];
    steps?: StepModel[];
    canEditLut?: boolean;
    canDuplicateLut?: boolean;
    canCreateNewLut?: boolean;
  } = $props();
  const dispatch = createEventDispatcher<{
    'remove-lut': { lutId: string };
    'add-lut-files': { files: File[] };
    'edit-lut': { lutId: string };
    'duplicate-lut': { lutId: string };
    'new-lut': undefined;
    'status-message': { message: string; kind?: StatusKind };
  }>();

  let language = $state(getLanguage());
  let fileInputRef = $state<HTMLInputElement | null>(null);
  let scrollRoot = $state<HTMLDivElement | null>(null);
  let frozenScrollLeft = $state<number | null>(null);
  const scrollState = {
    savedLeft: 0,
    restoring: false,
  };
  const disposeLanguageSync = subscribeLanguageChange((nextLanguage: ReturnType<typeof getLanguage>) => {
    language = nextLanguage;
  });

  function tr(key: Parameters<typeof t>[0], values?: Record<string, string | number>): string {
    language;
    return values ? t(key, values as never) : t(key);
  }

  function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function usageCount(lutId: string): number {
    return steps.reduce((count, step) => (step.lutId === lutId ? count + 1 : count), 0);
  }

  function handleRemoveLut(lutId: string): void {
    if (!isNonEmptyString(lutId)) {
      dispatch('status-message', { message: tr('pipeline.lut.invalidId'), kind: 'error' });
      return;
    }

    dispatch('remove-lut', { lutId });
  }

  function restoreScrollPosition(targetLeft: number): void {
    requestAnimationFrame(() => {
      if (!scrollRoot) {
        return;
      }

      scrollState.restoring = true;
      scrollState.savedLeft = targetLeft;
      scrollRoot.scrollLeft = targetLeft;
      requestAnimationFrame(() => {
        if (!scrollRoot) {
          scrollState.restoring = false;
          frozenScrollLeft = null;
          return;
        }

        scrollRoot.scrollLeft = targetLeft;
        scrollState.restoring = false;
        frozenScrollLeft = null;
      });
    });
  }

  function withPreservedScroll(action: () => void): void {
    const targetLeft = frozenScrollLeft ?? scrollRoot?.scrollLeft ?? scrollState.savedLeft;
    action();
    restoreScrollPosition(targetLeft);
  }

  function freezeScrollPosition(): void {
    frozenScrollLeft = scrollRoot?.scrollLeft ?? scrollState.savedLeft;
    scrollState.savedLeft = frozenScrollLeft;
  }

  function handleMenuClose(): void {
    if (frozenScrollLeft === null) {
      return;
    }

    restoreScrollPosition(frozenScrollLeft);
  }

  function openFilePicker(): void {
    if (!fileInputRef) {
      dispatch('status-message', { message: tr('pipeline.lut.fileInputMissing'), kind: 'error' });
      return;
    }

    fileInputRef.click();
  }

  async function handleFileInputChange(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      dispatch('status-message', { message: tr('pipeline.lut.fileInputFetchFailed'), kind: 'error' });
      return;
    }

    const rawFiles = input.files;
    if (!rawFiles || rawFiles.length === 0) {
      input.value = '';
      return;
    }

    const files = Array.from(rawFiles);
    if (files.some(file => !(file instanceof File))) {
      dispatch('status-message', { message: tr('pipeline.lut.fileInputInvalidValue'), kind: 'error' });
      input.value = '';
      return;
    }

    dispatch('add-lut-files', { files });
    input.value = '';
  }

  onDestroy(() => {
    disposeLanguageSync();
  });

  const structureKey = $derived(`${luts.map(lut => lut.id).join(',')}|${steps.map(step => step.id).join(',')}|${Number(canEditLut)}|${Number(canDuplicateLut)}|${Number(canCreateNewLut)}`);

  $effect(() => {
    structureKey;
    if (!scrollRoot) {
      return;
    }

    const targetLeft = scrollState.savedLeft;
    if (Math.abs(scrollRoot.scrollLeft - targetLeft) <= 1) {
      return;
    }

    requestAnimationFrame(() => {
      if (!scrollRoot) {
        return;
      }

      scrollState.restoring = true;
      scrollRoot.scrollLeft = targetLeft;
      requestAnimationFrame(() => {
        if (!scrollRoot) {
          scrollState.restoring = false;
          return;
        }

        scrollRoot.scrollLeft = targetLeft;
        scrollState.restoring = false;
      });
    });
  });
</script>

{#key language}
<div
  class="lut-root"
  bind:this={scrollRoot}
  onscroll={() => {
    if (!scrollRoot || scrollState.restoring || frozenScrollLeft !== null) {
      return;
    }
    scrollState.savedLeft = scrollRoot.scrollLeft;
  }}
>
  {#if luts.length > 0}
    {#each luts as lut (lut.id)}
      <article data-lut-item="true" draggable={true} data-lut-id={lut.id}>
        <div data-part="lut-thumb-wrap">
          <img data-part="lut-thumb" src={lut.thumbUrl} alt={`${lut.name} thumbnail`} loading="lazy" />
        </div>
        <div data-part="lut-meta">
          <div data-part="lut-name">{lut.name}</div>
          <div data-part="lut-stats">{tr('pipeline.lut.stats', { width: lut.width, height: lut.height, count: usageCount(lut.id) })}</div>
          <div data-part="lut-actions">
            {#if lut.ramp2dData && (canEditLut || canDuplicateLut)}
              <DropdownMenu
                wrapperClass="ui-menu-wrap"
                menuClass="ui-menu lut-menu"
                triggerAriaLabel={tr('pipeline.lut.kebabAria', { name: lut.name })}
                menuRole="menu"
                triggerVariant="menu-trigger"
                floating={true}
                onOpen={freezeScrollPosition}
                onClose={handleMenuClose}
              >
                {#snippet trigger()}
                  <span class="ui-symbol-kebab">...</span>
                {/snippet}
                {#snippet children(closeMenu)}
                  <button
                    type="button"
                    class="ui-menu-item"
                    role="menuitem"
                    onclick={() => {
                      withPreservedScroll(() => {
                        closeMenu();
                        dispatch('edit-lut', { lutId: lut.id });
                      });
                    }}
                  >
                    {tr('pipeline.lut.edit')}
                  </button>
                  <button
                    type="button"
                    class="ui-menu-item"
                    role="menuitem"
                    onclick={() => {
                      withPreservedScroll(() => {
                        closeMenu();
                        dispatch('duplicate-lut', { lutId: lut.id });
                      });
                    }}
                  >
                    {tr('pipeline.lut.duplicate')}
                  </button>
                  <button
                    type="button"
                    class="ui-menu-item lut-remove-menu-item"
                    role="menuitem"
                    onclick={() => {
                      withPreservedScroll(() => {
                        closeMenu();
                        handleRemoveLut(lut.id);
                      });
                    }}
                  >
                    {tr('pipeline.step.remove')}
                  </button>
                {/snippet}
              </DropdownMenu>
            {:else}
              <Button
                variant="destructive"
                className="lut-remove-button"
                id={undefined}
                handlePress={() => handleRemoveLut(lut.id)}
                ariaLabel={tr('pipeline.lut.removeAria', { name: lut.name })}
              >
                {tr('pipeline.step.remove')}
              </Button>
            {/if}
          </div>
        </div>
      </article>
    {/each}
    {#if canCreateNewLut}
      <div data-part="lut-add-item">
        <button
          type="button"
          data-part="lut-add-new"
          aria-label={tr('lutEditor.newLutAria')}
          onclick={() => dispatch('new-lut')}
        >
          {tr('lutEditor.newLut')}
        </button>
        <button type="button" data-part="lut-add-browse" aria-label={tr('pipeline.lut.browseAria')} onclick={openFilePicker}>
          {tr('pipeline.lut.browse')}
        </button>
      </div>
    {:else}
      <div data-part="lut-add-item" title={tr('pipeline.lut.add')}>
        <button type="button" data-part="lut-add-browse" class="single-action" onclick={openFilePicker}>
          {tr('pipeline.lut.add')}
        </button>
      </div>
    {/if}
  {:else}
    <div data-lut-empty="true">{tr('pipeline.lut.empty')}</div>
  {/if}

  <input
    bind:this={fileInputRef}
    type="file"
    accept="image/*"
    multiple
    hidden
    onchange={event => void handleFileInputChange(event)}
  />
</div>
{/key}

<style>
  .lut-root {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    overflow-y: hidden;
    min-height: 122px;
    padding: 12px;
    padding-top: 0;
  }

  [data-lut-empty="true"] {
    width: 100%;
    min-height: 92px;
    border: 1px dashed var(--color-panel-border-strong, #464646);
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: var(--color-muted);
    font-size: 12px;
  }

  [data-lut-item="true"] {
    flex: 0 0 120px;
    aspect-ratio: 1 / 1;
    border: 1px solid var(--color-panel-border-strong, #464646);
    border-radius: 12px;
    background: var(--color-surface-inset, #171c25);
    position: relative;
    cursor: grab;
  }

  :global([data-lut-item="true"][data-dragging="true"]) {
    opacity: 0.42;
  }

  :global([data-lut-item="true"][data-drop-position="before"]) {
    box-shadow: -3px 0 0 var(--color-accent);
  }

  :global([data-lut-item="true"][data-drop-position="after"]) {
    box-shadow: 3px 0 0 var(--color-accent);
  }

  [data-part="lut-thumb-wrap"] {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    overflow: hidden;
  }

  [data-part="lut-thumb"] {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }

  [data-part="lut-meta"] {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    gap: 2px;
    padding: 5px 7px;
    background: color-mix(in srgb, var(--color-bg, #111111), transparent 28%);
    backdrop-filter: blur(3px);
  }

  [data-part="lut-name"] {
    font-size: 11px;
    line-height: 1.35;
    color: var(--color-text-strong);
    overflow-wrap: anywhere;
    grid-row: 1;
    grid-column: 1 / -1;
  }

  [data-part="lut-stats"] {
    font-size: 10px;
    color: var(--color-muted);
    grid-row: 2;
  }

  [data-part="lut-actions"] {
    display: flex;
    gap: 4px;
    align-items: stretch;
    justify-content: flex-end;
    grid-row: 2;
    margin-top: auto;
  }

  :global(.lut-remove-button) {
    margin-top: auto;
    font-size: 10px;
    padding: 4px 7px;
    height: 16px;
    box-sizing: content-box;
  }

  :global(.lut-menu) {
    z-index: 200;
    min-width: 110px;
  }

  .lut-remove-menu-item {
    color: var(--color-danger-text);
  }

  [data-part="lut-add-item"] {
    flex: 0 0 120px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    cursor: default;
    aspect-ratio: 1 / 1;
    border: 1px dashed var(--color-line);
    border-radius: 12px;
    padding: 0;
    overflow: hidden;
  }

  [data-part="lut-add-new"],
  [data-part="lut-add-browse"] {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--color-muted);
    padding: 0;
    font-size: 12px;
    cursor: pointer;
    transition: 120ms ease;
  }

  [data-part="lut-add-new"] {
    flex: 2 0 0;
  }

  [data-part="lut-add-browse"] {
    flex: 1 0 0;
  }

  [data-part="lut-add-browse"].single-action {
    flex: 1 1 auto;
  }

  [data-part="lut-add-new"]:hover,
  [data-part="lut-add-browse"]:hover {
    color: var(--color-accent);
    background: color-mix(in srgb, var(--color-surface-inset, #171c25), var(--color-accent) 8%);
  }
</style>
