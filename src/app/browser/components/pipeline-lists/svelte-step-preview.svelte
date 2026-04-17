<script lang="ts">
  export let stepId: string;
  export let stepIndex: number;
  export let ariaLabel: string;
  export let computeLutUv:
    | ((
        stepIndex: number,
        pixelX: number,
        pixelY: number,
        canvasWidth: number,
        canvasHeight: number,
      ) => { u: number; v: number } | null)
    | undefined = undefined;

  let crosshairUv: { u: number; v: number } | null = null;

  function handlePreviewMouseMove(event: MouseEvent): void {
    if (!computeLutUv) {
      return;
    }

    const canvas = event.currentTarget as HTMLCanvasElement | null;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      crosshairUv = null;
      return;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const pixelX = (event.clientX - rect.left) * scaleX;
    const pixelY = (event.clientY - rect.top) * scaleY;
    crosshairUv = computeLutUv(stepIndex, pixelX, pixelY, canvas.width, canvas.height);
  }
</script>

<aside data-part="step-preview">
  <canvas
    class="step-preview-canvas"
    data-part="preview-swatch"
    data-step-id={stepId}
    data-preview="after"
    aria-label={ariaLabel}
    on:mousemove={handlePreviewMouseMove}
    on:mouseleave={() => {
      crosshairUv = null;
    }}
  ></canvas>
</aside>

<style>
  [data-part="step-preview"] {
    border: 1px solid var(--color-panel-border-strong);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-bg), var(--color-bg3) 8%);
  }

  .step-preview-canvas {
    display: block;
    width: 100%;
    height: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 10px;
    image-rendering: auto;
  }
</style>
