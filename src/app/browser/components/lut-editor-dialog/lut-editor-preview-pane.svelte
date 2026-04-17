<script lang="ts">
  import { colorToHex } from '../../../../features/pipeline/pipeline-model.ts';
  import type { ColorRamp, ColorRamp2dLutData } from '../../../../features/lut-editor/lut-editor-model.ts';

  export let editorRampData: ColorRamp2dLutData | null = null;
  export let selectedRampId: string | null = null;
  export let focusedStopId: string | null = null;
  export let selectedRamp: ColorRamp | null = null;
  export let draggingRampDeleteId: string | null = null;
  export let draggingStopDeleteId: string | null = null;
  export let isRampBoundary: (rampId: string) => boolean = () => false;
  export let isStopBoundary: (stopId: string) => boolean = () => false;
  export let rampRailHint = '';
  export let stopRailHint = '';
  export let axisStopXRampYLabel = '';
  export let axisRampXStopYLabel = '';
  export let onCanvasRef: ((element: HTMLCanvasElement | null) => void) | undefined = undefined;
  export let onCanvasClick: (event: MouseEvent, canvasEl: HTMLCanvasElement | null) => void = () => undefined;
  export let onRampStripPointerDown: (event: PointerEvent, stripEl: HTMLDivElement | null) => void = () => undefined;
  export let onStopStripPointerDown: (event: PointerEvent, stripEl: HTMLDivElement | null) => void = () => undefined;
  export let onRampKnobPointerDown:
    (rampId: string, event: PointerEvent, stripEl: HTMLDivElement | null) => void = () => undefined;
  export let onStopKnobPointerDown:
    (stopId: string, event: PointerEvent, stripEl: HTMLDivElement | null) => void = () => undefined;
  export let onAxisSwapChange: (nextAxisSwap: boolean) => void = () => undefined;
  export let onSelectRamp: (rampId: string) => void = () => undefined;
  export let onSelectStop: (stopId: string) => void = () => undefined;

  let previewCanvasRef: HTMLCanvasElement | null = null;
  let rampKnobStripRef: HTMLDivElement | null = null;
  let stopKnobStripRef: HTMLDivElement | null = null;
  $: onCanvasRef?.(previewCanvasRef);
</script>

<div class="preview-col">
  <div class={`canvas-area ${editorRampData?.axisSwap ? 'axis-swapped' : ''}`}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="canvas-wrap ui-checker-bg" on:click={event => onCanvasClick(event, previewCanvasRef)}>
      <canvas
        bind:this={previewCanvasRef}
        class="canvas"
        width={editorRampData?.width ?? 256}
        height={editorRampData?.height ?? 256}
      ></canvas>
    </div>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={rampKnobStripRef}
      class="ramp-knob-strip"
      title={rampRailHint}
      on:pointerdown={event => onRampStripPointerDown(event, rampKnobStripRef)}
    >
      {#each editorRampData?.ramps ?? [] as ramp}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class={`ramp-knob ${selectedRampId === ramp.id ? 'selected' : ''} ${isRampBoundary(ramp.id) ? 'boundary' : ''} ${draggingRampDeleteId === ramp.id ? 'pending-delete-ramp' : ''}`.trim()}
          style={editorRampData?.axisSwap ? `left:${ramp.position * 100}%` : `top:${ramp.position * 100}%`}
          on:pointerdown|preventDefault|stopPropagation={event => {
            onSelectRamp(ramp.id);
            onRampKnobPointerDown(ramp.id, event, rampKnobStripRef);
          }}
        ></div>
      {/each}
    </div>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={stopKnobStripRef}
      class="stop-knob-strip"
      title={stopRailHint}
      on:pointerdown={event => onStopStripPointerDown(event, stopKnobStripRef)}
    >
      {#each selectedRamp?.stops ?? [] as stop}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class={`stop-knob ${focusedStopId === stop.id ? 'focused' : ''} ${isStopBoundary(stop.id) ? 'boundary' : ''} ${draggingStopDeleteId === stop.id ? 'pending-delete-stop' : ''}`.trim()}
          style={editorRampData?.axisSwap
            ? `top:${stop.position * 100}%;background-color:${colorToHex(stop.color)}`
            : `left:${stop.position * 100}%;background-color:${colorToHex(stop.color)}`}
          on:pointerdown|preventDefault|stopPropagation={event => {
            onSelectStop(stop.id);
            onStopKnobPointerDown(stop.id, event, stopKnobStripRef);
          }}
        ></div>
      {/each}
    </div>
  </div>

  <div class="axis-options">
    <label class="axis-option">
      <input
        type="radio"
        name="lut-editor-axis"
        checked={!editorRampData?.axisSwap}
        on:change={() => onAxisSwapChange(false)}
      />
      {axisStopXRampYLabel}
    </label>
    <label class="axis-option">
      <input
        type="radio"
        name="lut-editor-axis"
        checked={!!editorRampData?.axisSwap}
        on:change={() => onAxisSwapChange(true)}
      />
      {axisRampXStopYLabel}
    </label>
  </div>
</div>

<style>
  .preview-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    gap: 8px;
    border-right: 1px solid var(--color-line);
    flex-shrink: 0;
  }

  .canvas-area {
    display: grid;
    grid-template-columns: 256px 24px;
    grid-template-rows: 256px 24px;
  }

  .axis-swapped .ramp-knob-strip {
    grid-row: 2;
    grid-column: 1;
  }

  .axis-swapped .stop-knob-strip {
    grid-row: 1;
    grid-column: 2;
  }

  .axis-swapped .ramp-knob {
    left: auto;
    top: 4px;
    transform: translateX(-50%);
    cursor: ew-resize;
  }

  .axis-swapped .pending-delete-ramp {
    transform: translateX(-50%) scale(0.75);
  }

  .axis-swapped .stop-knob {
    top: auto;
    left: 4px;
    transform: translateY(-50%);
    cursor: ns-resize;
  }

  .axis-swapped .pending-delete-stop {
    transform: translateY(-50%) scale(0.75);
  }

  .canvas-wrap {
    position: relative;
    width: 256px;
    height: 256px;
    border: 1px solid var(--color-control-border);
    border-radius: 4px;
    cursor: crosshair;
  }

  .canvas {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  .ramp-knob-strip {
    position: relative;
    grid-row: 1;
    grid-column: 2;
    cursor: crosshair;
  }

  .ramp-knob {
    position: absolute;
    left: 4px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--color-muted);
    border: 2px solid color-mix(in srgb, var(--color-surface-inset), var(--color-bg) 30%);
    transform: translateY(-50%);
    cursor: ns-resize;
    touch-action: none;
    transition: background 0.1s, box-shadow 0.1s, opacity 0.1s, transform 0.1s;
  }

  .selected {
    background: var(--color-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent), transparent 60%);
  }

  .boundary {
    opacity: 0.6;
  }

  .pending-delete-ramp {
    background: transparent;
    border-color: var(--color-warn);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-warn), transparent 40%);
    opacity: 0.55;
    transform: translateY(-50%) scale(0.75);
    cursor: no-drop;
  }

  .stop-knob-strip {
    position: relative;
    grid-row: 2;
    grid-column: 1;
    cursor: crosshair;
  }

  .stop-knob {
    position: absolute;
    top: 4px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid color-mix(in srgb, var(--color-surface-inset), var(--color-bg) 30%);
    transform: translateX(-50%);
    cursor: ew-resize;
    touch-action: none;
    box-shadow: 0 0 0 0 transparent;
    transition: box-shadow 0.1s, opacity 0.1s, transform 0.1s;
  }

  .focused {
    box-shadow: 0 0 0 2px var(--color-accent);
  }

  .pending-delete-stop {
    background: var(--color-warn) !important;
    opacity: 0.55;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-warn), transparent 40%);
    transform: translateX(-50%) scale(0.75);
    border-color: var(--color-warn);
    cursor: no-drop;
  }

  .axis-options {
    display: flex;
    gap: 10px;
    padding: 4px 2px 0;
  }

  .axis-option {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--color-muted);
    cursor: pointer;
    user-select: none;
  }
  @media (max-width: 1120px) {
    .preview-col {
      border-right: none;
      border-bottom: 1px solid var(--color-line);
    }
  }
</style>
