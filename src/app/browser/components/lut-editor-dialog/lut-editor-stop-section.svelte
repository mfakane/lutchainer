<script lang="ts">
  import type { ColorRamp, ColorStop } from '../../../../features/lut-editor/lut-editor-model.ts';
  import { colorToHex } from '../../../../features/pipeline/pipeline-model.ts';
  import Button from '../svelte-button.svelte';
  import DropdownMenu from '../svelte-dropdown-menu.svelte';
  import { formatPositionPercent, scheduleSelectAllTextIfFocused } from './shared.ts';

  let {
    selectedRamp = null,
    focusedStop = null,
    stopPositionDraft = '',
    editingStopPositionId = null,
    stopEditorLabel = '',
    addStopLabel = '',
    removeStopLabel = '',
    duplicateStopLabel = '',
    invertStopLabel = '',
    stopMenuAriaLabel = '',
    stopColorLabel = '',
    stopPositionLabel = '',
    alphaLabel = '',
    noStopSelectedLabel = '',
    maxStopsReached = false,
    isStopBoundary = () => false,
    onAddStop = () => undefined,
    onRemoveStop = () => undefined,
    onDuplicateFocusedStop = () => undefined,
    onInvertFocusedStop = () => undefined,
    onSelectStop = () => undefined,
    onPreviewStopPointerDown = () => undefined,
    onStopColorInput = () => undefined,
    onBeginStopPositionEdit = () => undefined,
    onStopPositionInput = () => undefined,
    onCommitStopPosition = () => undefined,
    onCancelStopPositionEdit = () => undefined,
    onStopPositionWheel = () => undefined,
    onStopAlphaInput = () => undefined,
    onStopAlphaWheel = () => undefined,
  }: {
    selectedRamp?: ColorRamp | null;
    focusedStop?: ColorStop | null;
    stopPositionDraft?: string;
    editingStopPositionId?: string | null;
    stopEditorLabel?: string;
    addStopLabel?: string;
    removeStopLabel?: string;
    duplicateStopLabel?: string;
    invertStopLabel?: string;
    stopMenuAriaLabel?: string;
    stopColorLabel?: string;
    stopPositionLabel?: string;
    alphaLabel?: string;
    noStopSelectedLabel?: string;
    maxStopsReached?: boolean;
    isStopBoundary?: (stopId: string) => boolean;
    onAddStop?: () => void;
    onRemoveStop?: (stopId: string) => void;
    onDuplicateFocusedStop?: () => void;
    onInvertFocusedStop?: () => void;
    onSelectStop?: (stopId: string) => void;
    onPreviewStopPointerDown?: (stopId: string, event: PointerEvent, barEl: HTMLDivElement | null) => void;
    onStopColorInput?: (stopId: string, value: string) => void;
    onBeginStopPositionEdit?: (stopId: string, currentDraft: string) => void;
    onStopPositionInput?: (stopId: string, nextDraft: string) => void;
    onCommitStopPosition?: (stopId: string) => void;
    onCancelStopPositionEdit?: (currentDraft: string) => void;
    onStopPositionWheel?: (stopId: string, currentPosition: number, event: WheelEvent) => void;
    onStopAlphaInput?: (stopId: string, value: string) => void;
    onStopAlphaWheel?: (stopId: string, currentAlpha: number, event: WheelEvent) => void;
  } = $props();

  let stopPositionInputRef = $state<HTMLInputElement | null>(null);
  let stopPreviewBarRef = $state<HTMLDivElement | null>(null);

  const stopKnobPlacementMap = $derived(computeStopKnobPlacements(selectedRamp, stopPreviewBarRef));

  function computeStopKnobPlacements(
    ramp: ColorRamp | null,
    bar: HTMLDivElement | null,
  ): Map<string, 'below' | 'above'> {
    const placements = new Map<string, 'below' | 'above'>();
    if (!ramp) {
      return placements;
    }

    const rawWidth = bar?.getBoundingClientRect().width ?? 0;
    const barWidth = rawWidth > 0 ? rawWidth : 256;
    const threshold = 14 / barWidth;
    const sorted = [...ramp.stops].sort((a, b) => a.position - b.position);
    let lastBelowPos = -Infinity;
    let lastAbovePos = -Infinity;

    for (const stop of sorted) {
      const belowClear = stop.position - lastBelowPos >= threshold;
      const aboveClear = stop.position - lastAbovePos >= threshold;
      if (belowClear) {
        placements.set(stop.id, 'below');
        lastBelowPos = stop.position;
      } else if (aboveClear) {
        placements.set(stop.id, 'above');
        lastAbovePos = stop.position;
      } else {
        placements.set(stop.id, 'below');
        lastBelowPos = stop.position;
      }
    }

    return placements;
  }

  function rampSwatchStyle(ramp: ColorRamp): string {
    const stops = ramp.stops.map(stop => `${colorToHex(stop.color)} ${Math.round(stop.position * 100)}%`);
    return `background: linear-gradient(to right, ${stops.join(', ')})`;
  }
</script>

<div class="stop-section">
  <div class="section-header">
    <div class="section-label">{stopEditorLabel}</div>
    <div class="section-header-actions">
      <Button variant="secondary" handlePress={onAddStop} disabled={maxStopsReached || !selectedRamp}>
        {addStopLabel}
      </Button>
      {#if focusedStop && !isStopBoundary(focusedStop.id)}
        <Button variant="destructive" handlePress={() => onRemoveStop(focusedStop.id)}>
          {removeStopLabel}
        </Button>
      {/if}
      {#if focusedStop}
        <DropdownMenu
          wrapperClass="lut-editor-menu-wrap"
          menuClass="ui-menu lut-editor-menu-panel lut-editor-kebab-menu"
          triggerClassName="ui-menu-trigger"
          triggerVariant="menu-trigger"
          triggerAriaLabel={stopMenuAriaLabel}
          menuRole="menu"
          floating={true}
        >
          {#snippet trigger()}
            <span class="ui-symbol-kebab">...</span>
          {/snippet}
          {#snippet children(closeMenu)}
            <button
              type="button"
              class="ui-menu-item"
              role="menuitem"
              disabled={maxStopsReached}
              onclick={() => {
                closeMenu();
                onDuplicateFocusedStop();
              }}
            >
              {duplicateStopLabel}
            </button>
            <button
              type="button"
              class="ui-menu-item"
              role="menuitem"
              onclick={() => {
                closeMenu();
                onInvertFocusedStop();
              }}
            >
              {invertStopLabel}
            </button>
          {/snippet}
        </DropdownMenu>
      {/if}
    </div>
  </div>

  {#if selectedRamp}
    <div class="stop-preview-area">
      <div bind:this={stopPreviewBarRef} class="stop-preview" style={rampSwatchStyle(selectedRamp)}>
        {#each selectedRamp.stops as stop}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class={`preview-stop-knob ${(stopKnobPlacementMap.get(stop.id) ?? 'below') === 'above' ? 'above' : ''} ${focusedStop?.id === stop.id ? 'focused' : ''} ${isStopBoundary(stop.id) ? 'boundary' : ''}`.trim()}
            style={`left:${stop.position * 100}%;background-color:${colorToHex(stop.color)}`}
            onpointerdown={event => {
              event.preventDefault();
              event.stopPropagation();
              onSelectStop(stop.id);
              onPreviewStopPointerDown(stop.id, event, stopPreviewBarRef);
            }}
          ></div>
        {/each}
      </div>
    </div>
  {/if}

  {#if focusedStop}
    <div class="stop-editor">
      <div class="stop-editor-field">
        <label class="editor-label" for="lut-editor-stop-color">{stopColorLabel}</label>
        <input
          id="lut-editor-stop-color"
          type="color"
          class="stop-color-input"
          value={colorToHex(focusedStop.color)}
          oninput={event => onStopColorInput(focusedStop.id, (event.currentTarget as HTMLInputElement).value)}
        />
      </div>

      <div class="stop-editor-field">
        <label class="editor-label" for="lut-editor-stop-position">{stopPositionLabel}</label>
        <input
          bind:this={stopPositionInputRef}
          id="lut-editor-stop-position"
          type="text"
          inputmode="decimal"
          class="pos-input"
          value={editingStopPositionId === focusedStop.id ? stopPositionDraft : formatPositionPercent(focusedStop.position)}
          onfocus={() => {
            onBeginStopPositionEdit(focusedStop.id, formatPositionPercent(focusedStop.position));
            scheduleSelectAllTextIfFocused(stopPositionInputRef ?? undefined);
          }}
          oninput={event => onStopPositionInput(focusedStop.id, (event.currentTarget as HTMLInputElement).value)}
          onblur={() => onCommitStopPosition(focusedStop.id)}
          onkeydown={event => {
            if (event.key === 'Enter') {
              (event.currentTarget as HTMLInputElement).blur();
            } else if (event.key === 'Escape') {
              onCancelStopPositionEdit(formatPositionPercent(focusedStop.position));
              (event.currentTarget as HTMLInputElement).blur();
            }
          }}
          onwheel={event => onStopPositionWheel(focusedStop.id, focusedStop.position, event)}
        />
        <span class="editor-unit">%</span>
      </div>

      <div class="stop-editor-field">
        <label class="editor-label" for="lut-editor-stop-alpha">{alphaLabel}</label>
        <input
          id="lut-editor-stop-alpha"
          type="range"
          class="stop-alpha-input"
          min="0"
          max="100"
          value={Math.round(focusedStop.alpha * 100)}
          oninput={event => onStopAlphaInput(focusedStop.id, (event.currentTarget as HTMLInputElement).value)}
          onwheel={event => onStopAlphaWheel(focusedStop.id, focusedStop.alpha, event)}
        />
        <span class="editor-unit">{Math.round(focusedStop.alpha * 100)}%</span>
      </div>
    </div>
  {:else}
    <div class="empty-note">{noStopSelectedLabel}</div>
  {/if}
</div>

<style>
  .stop-section {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: auto;
    padding: 12px 16px;
    gap: 8px;
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

  .stop-preview-area {
    flex-shrink: 0;
  }

  .stop-preview {
    position: relative;
    width: 100%;
    height: 18px;
    border-radius: 4px;
    border: 1px solid var(--color-control-border);
    overflow: visible;
    margin: 14px 0;
  }

  .preview-stop-knob {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid color-mix(in srgb, var(--color-bg), transparent 70%);
    transform: translateX(-50%);
    cursor: ew-resize;
    touch-action: none;
    transition: box-shadow 0.1s;
    top: calc(100% + 3px);
  }

  .above {
    top: auto;
    bottom: calc(100% + 3px);
  }

  .focused {
    box-shadow: 0 0 0 2px var(--color-accent);
  }

  .boundary {
    opacity: 0.6;
  }

  .stop-editor {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .stop-editor-field {
    display: flex;
    align-items: center;
    gap: 8px;
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

  .stop-color-input {
    width: 32px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    background: none;
  }

  .stop-alpha-input {
    width: 100%;
    height: 4px;
    accent-color: var(--color-accent);
  }

  .empty-note {
    font-size: 12px;
    color: var(--color-muted);
    padding: 12px 0;
  }
</style>
