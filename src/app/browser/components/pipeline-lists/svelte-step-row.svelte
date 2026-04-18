<script lang="ts">
  import * as pipelineModel from '../../../../features/pipeline/pipeline-model.ts';
  import { getCustomChannelsForBlendMode, getSelectableBlendOpsForChannel } from '../../../../features/step/step-blend-strategies.ts';
  import { BLEND_MODES, type BlendOp, type ChannelName, type CustomParamModel, type LutModel, type StepModel } from '../../../../features/step/step-model.ts';
  import { type TranslationKey } from '../../i18n.ts';
  import StepHeader from './svelte-step-header.svelte';
  import StepPreview from './svelte-step-preview.svelte';

  type StatusKind = 'success' | 'error' | 'info';

  export let step: StepModel;
  export let stepIndex: number;
  export let luts: LutModel[] = [];
  export let customParams: CustomParamModel[] = [];
  export let tr: (key: TranslationKey, values?: Record<string, string | number>) => string;
  export let onCaptureScroll: () => void = () => undefined;
  export let onStepMuteChange: (stepId: string, muted: boolean) => void = () => undefined;
  export let onDuplicateStep: (stepId: string) => void = () => undefined;
  export let onRemoveStep: (stepId: string) => void = () => undefined;
  export let onStepLabelChange: (stepId: string, label: string | null) => void = () => undefined;
  export let onStepLutChange: (stepId: string, lutId: string) => void = () => undefined;
  export let onStepBlendModeChange: (stepId: string, blendMode: StepModel['blendMode']) => void = () => undefined;
  export let onStepOpChange: (stepId: string, channel: ChannelName, op: BlendOp) => void = () => undefined;
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

  function resolveLut(lutId: string): LutModel | null {
    return luts.find(item => item.id === lutId) ?? luts[0] ?? null;
  }

  function handleLutChange(event: Event): void {
    const input = event.currentTarget as HTMLSelectElement | null;
    if (!input) {
      onStatus(tr('pipeline.status.stepLutSelectMissing'), 'error');
      return;
    }

    const lutId = input.value;
    if (typeof lutId !== 'string' || lutId.trim().length === 0) {
      onStatus(tr('pipeline.status.selectedLutIdInvalid'), 'error');
      return;
    }

    if (!luts.some(lut => lut.id === lutId)) {
      onStatus(tr('pipeline.status.selectedLutMissing'), 'error');
      return;
    }

    onCaptureScroll();
    onStepLutChange(step.id, lutId);
  }

  function handleBlendModeChange(event: Event): void {
    const input = event.currentTarget as HTMLSelectElement | null;
    if (!input) {
      onStatus(tr('pipeline.status.blendModeSelectMissing'), 'error');
      return;
    }

    const blendMode = input.value;
    if (!pipelineModel.isValidBlendMode(blendMode)) {
      onStatus(tr('pipeline.status.invalidBlendMode', { blendMode }), 'error');
      return;
    }

    onCaptureScroll();
    onStepBlendModeChange(step.id, blendMode);
  }

  function handleOpChange(channel: ChannelName, event: Event): void {
    const input = event.currentTarget as HTMLSelectElement | null;
    if (!input) {
      onStatus(tr('pipeline.status.stepOpSelectMissing'), 'error');
      return;
    }

    const op = input.value;
    if (!pipelineModel.isValidBlendOp(op)) {
      onStatus(tr('pipeline.status.invalidOp', { op }), 'error');
      return;
    }

    onCaptureScroll();
    onStepOpChange(step.id, channel, op);
  }

</script>

<article data-step-item="true" data-step-id={step.id} data-muted={step.muted ? 'true' : undefined}>
  <StepHeader
    {step}
    {stepIndex}
    {tr}
    {onCaptureScroll}
    {onStepMuteChange}
    {onDuplicateStep}
    {onRemoveStep}
    {onStepLabelChange}
    {onStatus}
  />

  <aside data-part="step-socket-rail">
    <button
      type="button"
      class="step-socket"
      data-step-socket="true"
      data-step-id={step.id}
      data-axis="x"
      title={`X: ${pipelineModel.getParamLabel(step.xParam, customParams)}`}
    >
      <span data-part="socket-dot" aria-hidden="true"></span>
      <span data-part="step-socket-axis-label">X</span>
      <span data-part="step-socket-param">{pipelineModel.getParamLabel(step.xParam, customParams)}</span>
    </button>
    <button
      type="button"
      class="step-socket"
      data-step-socket="true"
      data-step-id={step.id}
      data-axis="y"
      title={`Y: ${pipelineModel.getParamLabel(step.yParam, customParams)}`}
    >
      <span data-part="socket-dot" aria-hidden="true"></span>
      <span data-part="step-socket-axis-label">Y</span>
      <span data-part="step-socket-param">{pipelineModel.getParamLabel(step.yParam, customParams)}</span>
    </button>
  </aside>

  <section data-part="step-core">
    <div data-part="lut-row">
      <label data-part="lut-select-field">
        <span data-part="lut-select-label">{tr('pipeline.step.lut')}</span>
        <select class="control-select" data-step-id={step.id} on:change={handleLutChange}>
          {#each luts as lutOpt}
            <option value={lutOpt.id} selected={lutOpt.id === step.lutId}>{lutOpt.name}</option>
          {/each}
        </select>
      </label>

      <div data-part="lut-thumb-wrap">
        <img class="checker-bg" data-part="lut-thumb" src={resolveLut(step.lutId)?.thumbUrl ?? ''} alt="LUT thumbnail" />
      </div>
    </div>

    <div>
      <label data-part="step-mode-field">
        <span data-part="op-label">{tr('pipeline.step.blendMode')}</span>
        <select class="control-select" data-step-id={step.id} value={step.blendMode} on:change={handleBlendModeChange}>
          {#each BLEND_MODES as mode}
            <option value={mode.key}>{mode.label}</option>
          {/each}
        </select>
      </label>
    </div>

    {#if getCustomChannelsForBlendMode(step.blendMode).length > 0}
      <div data-part="op-grid">
        {#each getCustomChannelsForBlendMode(step.blendMode) as channel}
          <label data-part="op-item">
            <span data-part="op-label">{channel.toUpperCase()}</span>
            <select
              class="control-select"
              data-step-id={step.id}
              data-channel={channel}
              value={step.ops[channel]}
              on:change={event => handleOpChange(channel, event)}
            >
              {#each getSelectableBlendOpsForChannel(step.blendMode) as op}
                <option value={op}>{op}</option>
              {/each}
            </select>
          </label>
        {/each}
      </div>
    {/if}
  </section>

  <StepPreview
    stepId={step.id}
    {stepIndex}
    ariaLabel={tr('pipeline.step.previewAria', { index: stepIndex + 1 })}
    {computeLutUv}
  />
</article>

<style>
  article[data-step-item="true"] {
    display: grid;
    grid-template-rows: auto auto;
    grid-template-columns: 10ch minmax(0, 1fr) 120px;
    gap: 10px;
    border: 1px solid var(--color-line);
    border-radius: 12px;
    padding: 8px;
    background: color-mix(in srgb, var(--color-panel-2), var(--color-bg) 5%);
  }

  article[data-step-item="true"][data-muted="true"] {
    border-color: color-mix(in srgb, var(--color-line), var(--color-warn) 22%);
    background: color-mix(in srgb, var(--color-panel-2), var(--color-warn) 4%);
  }

  [data-part="step-socket-rail"] {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
  }

  .step-socket {
    position: relative;
    text-align: left;
    min-height: 58px;
    padding: 8px 8px 8px 26px;
    font-size: 11px;
    line-height: 1.2;
    white-space: normal;
    overflow-wrap: anywhere;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    border: 1px solid var(--color-line);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-panel), var(--color-bg) 10%);
  }

  .step-socket [data-part="socket-dot"] {
    position: absolute;
    top: 50%;
    left: 8px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--color-socket-border);
    background: var(--color-socket-bg);
    transform: translateY(-50%);
    pointer-events: none;
  }

  [data-part="step-socket-axis-label"] {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--color-step-socket-axis);
  }

  [data-part="step-socket-param"] {
    font-size: 10px;
    color: var(--color-text);
  }

  [data-part="step-core"] {
    min-width: 0;
    border: 1px solid var(--color-panel-border-strong);
    border-radius: 10px;
    padding: 8px;
    background: color-mix(in srgb, var(--color-panel), var(--color-bg) 8%);
  }

  [data-part="lut-row"] {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 72px;
    gap: 8px;
    margin-bottom: 8px;
    align-items: center;
  }

  [data-part="lut-select-field"],
  [data-part="step-mode-field"] {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  [data-part="lut-select-label"],
  [data-part="op-label"] {
    font-size: 10px;
    color: var(--color-muted);
  }

  .control-select {
    width: 100%;
    border: 1px solid var(--color-control-border);
    border-radius: 8px;
    background: var(--color-control-bg);
    color: var(--color-text);
    font-size: 12px;
    padding: 6px 8px;
  }

  [data-part="lut-thumb-wrap"] {
    position: relative;
    width: 72px;
    height: 72px;
    flex-shrink: 0;
  }

  .checker-bg {
    background-color: var(--color-checker-a);
    background-image:
      linear-gradient(45deg, var(--color-checker-b) 25%, transparent 25%, transparent 75%, var(--color-checker-b) 75%),
      linear-gradient(45deg, var(--color-checker-b) 25%, transparent 25%, transparent 75%, var(--color-checker-b) 75%);
    background-size: var(--size-checker) var(--size-checker);
    background-position: 0 0, calc(var(--size-checker) / 2) calc(var(--size-checker) / 2);
  }

  [data-part="lut-thumb"] {
    width: 100%;
    height: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    border: 1px solid var(--color-panel-border-strong);
  }

  [data-part="op-grid"] {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  [data-part="op-item"] {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  @media (max-width: 1180px) {
    article[data-step-item="true"] {
      grid-template-columns: 7ch minmax(0, 1fr) 90px;
      hyphens: auto;
    }
  }
</style>
