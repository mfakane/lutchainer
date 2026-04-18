<script lang="ts">
  import type { ColorRamp } from '../../../../features/lut-editor/lut-editor-model.ts';
  import Button from '../svelte-button.svelte';
  import DropdownMenu from '../svelte-dropdown-menu.svelte';
  import { formatPositionPercent, scheduleSelectAllTextIfFocused } from './shared.ts';

  export let ramps: readonly ColorRamp[] = [];
  export let selectedRamp: ColorRamp | null = null;
  export let selectedRampId: string | null = null;
  export let editingRampPositionId: string | null = null;
  export let rampPositionDraft = '';
  export let draggingRampListIdx: number | null = null;
  export let rampListLabel = '';
  export let addRampLabel = '';
  export let duplicateRampLabel = '';
  export let invertRampLabel = '';
  export let removeRampLabel = '';
  export let rampPositionLabel = '';
  export let rampMenuAriaLabel = '';
  export let maxRampsReached = false;
  export let canRemoveRamp: (rampId: string) => boolean = () => false;
  export let rampSwatchStyle: (ramp: ColorRamp) => string = () => '';
  export let onAddRamp: () => void = () => undefined;
  export let onSelectRamp: (rampId: string) => void = () => undefined;
  export let onStartRampListDrag: (rampIndex: number, event: PointerEvent) => void = () => undefined;
  export let onRemoveRamp: (rampId: string) => void = () => undefined;
  export let onDuplicateSelectedRamp: () => void = () => undefined;
  export let onInvertSelectedRamp: () => void = () => undefined;
  export let onBeginRampPositionEdit: (rampId: string, currentDraft: string) => void = () => undefined;
  export let onRampPositionInput: (rampId: string, nextDraft: string) => void = () => undefined;
  export let onCommitRampPosition: (rampId: string) => void = () => undefined;
  export let onCancelRampPositionEdit: (currentDraft: string) => void = () => undefined;
  export let onRampPositionWheel: (rampId: string, currentPosition: number, event: WheelEvent) => void = () => undefined;
  export let shouldSuppressRampClick: () => boolean = () => false;

  let rampPositionInputRef: HTMLInputElement | null = null;

</script>

<div class="ramp-section">
  <div class="section-header">
    <div class="section-label">{rampListLabel}</div>
    <div class="section-header-actions">
      <Button variant="secondary" handlePress={onAddRamp} disabled={maxRampsReached}>
        {addRampLabel}
      </Button>
      {#if selectedRamp}
        <DropdownMenu
          wrapperClass="lut-editor-menu-wrap"
          menuClass="ui-menu lut-editor-menu-panel lut-editor-kebab-menu"
          triggerClassName="ui-menu-trigger"
          triggerVariant="menu-trigger"
          triggerAriaLabel={rampMenuAriaLabel}
          menuRole="menu"
          floating={true}
        >
          <span slot="trigger" class="ui-symbol-kebab">...</span>
          <svelte:fragment slot="default" let:closeMenu>
            <button
              type="button"
              class="ui-menu-item"
              role="menuitem"
              disabled={maxRampsReached}
              on:click={() => {
                closeMenu();
                onDuplicateSelectedRamp();
              }}
            >
              {duplicateRampLabel}
            </button>
            <button
              type="button"
              class="ui-menu-item"
              role="menuitem"
              on:click={() => {
                closeMenu();
                onInvertSelectedRamp();
              }}
            >
              {invertRampLabel}
            </button>
          </svelte:fragment>
        </DropdownMenu>
      {/if}
    </div>
  </div>

  <div class="ramp-list">
    {#each ramps as ramp, index}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        data-ramp-id={ramp.id}
        class={`ramp-row ${selectedRampId === ramp.id ? 'ramp-row-selected' : ''} ${draggingRampListIdx === index ? 'ramp-row-dragging' : ''}`.trim()}
        on:pointerdown={event => onStartRampListDrag(index, event)}
        on:click={() => {
          if (!shouldSuppressRampClick()) {
            onSelectRamp(ramp.id);
          }
        }}
      >
        <div class="ramp-swatch" style={rampSwatchStyle(ramp)}></div>
        <span class="ramp-position-text">{rampPositionLabel}: {formatPositionPercent(ramp.position)}%</span>
        {#if canRemoveRamp(ramp.id)}
          <Button variant={["destructive", "small"]} handlePress={() => onRemoveRamp(ramp.id)}>
            {removeRampLabel}
          </Button>
        {/if}
      </div>
    {/each}
  </div>

  {#if selectedRamp}
    <div class="position-editor">
      <label class="editor-label" for="lut-editor-ramp-position">{rampPositionLabel}</label>
      <input
        bind:this={rampPositionInputRef}
        id="lut-editor-ramp-position"
        type="text"
        inputmode="decimal"
        class="pos-input"
        value={editingRampPositionId === selectedRamp.id ? rampPositionDraft : formatPositionPercent(selectedRamp.position)}
        on:focus={() => {
          onBeginRampPositionEdit(selectedRamp.id, formatPositionPercent(selectedRamp.position));
          scheduleSelectAllTextIfFocused(rampPositionInputRef ?? undefined);
        }}
        on:input={event => onRampPositionInput(selectedRamp.id, (event.currentTarget as HTMLInputElement).value)}
        on:blur={() => onCommitRampPosition(selectedRamp.id)}
        on:keydown={event => {
          if (event.key === 'Enter') {
            (event.currentTarget as HTMLInputElement).blur();
          } else if (event.key === 'Escape') {
            onCancelRampPositionEdit(formatPositionPercent(selectedRamp.position));
            (event.currentTarget as HTMLInputElement).blur();
          }
        }}
        on:wheel={event => onRampPositionWheel(selectedRamp.id, selectedRamp.position, event)}
      />
      <span class="editor-unit">%</span>
    </div>
  {/if}
</div>

<style>
  .ramp-section {
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
    border-bottom: 1px solid var(--color-line);
    padding: 12px 16px;
    gap: 8px;
    max-height: 50%;
    overflow: auto;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .section-header-actions {
    display: flex;
    align-items: stretch;
    gap: 8px;
    flex-shrink: 0;
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .ramp-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .ramp-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    border-radius: 6px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background 0.1s, opacity 0.1s;
    user-select: none;
  }

  .ramp-row:hover {
    background: color-mix(in srgb, var(--color-text-strong), transparent 95%);
  }

  .ramp-row-selected {
    border-color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent), transparent 92%);
  }

  .ramp-row-dragging {
    opacity: 0.35;
    pointer-events: none;
  }

  :global(.ramp-row[data-drop-position="before"]) {
    box-shadow: inset 0 3px 0 var(--color-accent);
  }

  :global(.ramp-row[data-drop-position="after"]) {
    box-shadow: inset 0 -3px 0 var(--color-accent);
  }

  .ramp-swatch {
    width: 48px;
    height: 14px;
    border-radius: 3px;
    border: 1px solid color-mix(in srgb, var(--color-text-strong), transparent 90%);
    flex-shrink: 0;
  }

  .ramp-position-text {
    font-size: 11px;
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
    flex: 1;
  }

  .position-editor {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 2px 2px;
  }

  .editor-label {
    font-size: 11px;
    color: var(--color-muted);
    min-width: 52px;
    flex-shrink: 0;
  }

  .editor-unit {
    font-size: 11px;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
    min-width: 34px;
  }

  .pos-input {
    width: calc(6ch + 16px);
    box-sizing: content-box;
    font-size: 12px;
    padding: 3px 6px;
    border: 1px solid var(--color-control-border);
    border-radius: 4px;
    background: var(--color-surface-inset);
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
</style>
