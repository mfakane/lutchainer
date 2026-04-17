<script lang="ts">
  import { MAX_STEP_LABEL_LENGTH, type StepModel } from '../../../../features/step/step-model.ts';
  import Button from '../svelte-button.svelte';

  type StatusKind = 'success' | 'error' | 'info';

  export let step: StepModel;
  export let stepIndex: number;
  export let tr: (key: string, values?: Record<string, string | number>) => string;
  export let shouldIgnoreClick: () => boolean = () => false;
  export let onCaptureScroll: () => void = () => undefined;
  export let onStepMuteChange: (stepId: string, muted: boolean) => void = () => undefined;
  export let onDuplicateStep: (stepId: string) => void = () => undefined;
  export let onRemoveStep: (stepId: string) => void = () => undefined;
  export let onStepLabelChange: (stepId: string, label: string | null) => void = () => undefined;
  export let onStatus: (message: string, kind?: StatusKind) => void = () => undefined;

  function resolveStepLabel(): string {
    const customLabel = typeof step.label === 'string' ? step.label.trim() : '';
    return customLabel.length > 0 ? customLabel : `Step ${stepIndex + 1}`;
  }

  function captureBeforeAction(): boolean {
    if (shouldIgnoreClick()) {
      return false;
    }
    onCaptureScroll();
    return true;
  }

  function commitStepLabel(inputElement: HTMLInputElement | null): void {
    if (!inputElement) {
      onStatus(tr('pipeline.status.stepLabelInputMissing'), 'error');
      return;
    }

    const rawValue = inputElement.value;
    if (typeof rawValue !== 'string') {
      onStatus(tr('pipeline.status.stepLabelInvalidValue'), 'error');
      inputElement.value = resolveStepLabel();
      return;
    }

    const trimmed = rawValue.trim();
    if (trimmed.length > MAX_STEP_LABEL_LENGTH) {
      onStatus(tr('pipeline.status.stepLabelTooLong', { max: MAX_STEP_LABEL_LENGTH }), 'error');
      inputElement.value = trimmed.slice(0, MAX_STEP_LABEL_LENGTH);
      return;
    }

    onCaptureScroll();
    onStepLabelChange(step.id, trimmed.length > 0 ? trimmed : null);
    inputElement.value = trimmed.length > 0 ? trimmed : resolveStepLabel();
  }
</script>

<section data-part="step-head">
  <div data-part="step-title-row">
    <button
      type="button"
      class="step-drag-handle"
      draggable={true}
      data-step-drag-handle="true"
      data-step-id={step.id}
      title={tr('pipeline.step.dragMove')}
    >
      drag
    </button>
    <input
      type="text"
      class="step-title-input"
      value={resolveStepLabel()}
      maxlength={MAX_STEP_LABEL_LENGTH}
      aria-label={tr('pipeline.step.titleAria', { index: stepIndex + 1 })}
      on:blur={event => commitStepLabel(event.currentTarget as HTMLInputElement | null)}
      on:keydown={event => {
        const input = event.currentTarget as HTMLInputElement | null;
        if (!input) {
          onStatus(tr('pipeline.status.stepLabelInputMissing'), 'error');
          return;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          input.blur();
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          input.value = resolveStepLabel();
          input.blur();
        }
      }}
    />
  </div>
  <div data-part="step-actions">
    <Button
      className="step-action-button"
      active={step.muted}
      ariaPressed={step.muted ? 'true' : 'false'}
      blurOnPress={true}
      handleMouseDown={event => {
        onCaptureScroll();
        event.preventDefault();
      }}
      handlePress={() => {
        if (!captureBeforeAction()) return;
        onStepMuteChange(step.id, !step.muted);
      }}
    >
      {step.muted ? tr('pipeline.step.unmute') : tr('pipeline.step.mute')}
    </Button>
    <Button
      className="step-action-button"
      blurOnPress={true}
      handleMouseDown={event => {
        onCaptureScroll();
        event.preventDefault();
      }}
      handlePress={() => {
        if (!captureBeforeAction()) return;
        onDuplicateStep(step.id);
      }}
    >
      {tr('pipeline.step.duplicate')}
    </Button>
    <Button
      className="step-action-button step-remove-button"
      blurOnPress={true}
      handleMouseDown={event => {
        onCaptureScroll();
        event.preventDefault();
      }}
      handlePress={() => {
        if (!captureBeforeAction()) return;
        onRemoveStep(step.id);
      }}
    >
      {tr('pipeline.step.remove')}
    </Button>
  </div>
</section>

<style>
  [data-part="step-head"] {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    grid-column: 1 / -1;
    gap: 8px;
  }

  [data-part="step-title-row"] {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .step-drag-handle {
    padding: 4px 7px;
    min-width: 0;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-muted);
    cursor: grab;
    background: transparent;
    border: 1px solid var(--color-line);
    border-radius: 8px;
  }

  .step-drag-handle:active {
    cursor: grabbing;
  }

  .step-title-input {
    min-width: 0;
    width: min(180px, 38vw);
    color: var(--color-text-strong);
    font-size: 12px;
    font-weight: 700;
    padding: 4px 6px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
  }

  .step-title-input:hover {
    border-color: color-mix(in srgb, var(--color-line), var(--color-accent) 32%);
    background: color-mix(in srgb, var(--color-panel), var(--color-bg) 10%);
  }

  .step-title-input:focus {
    outline: none;
    border-color: var(--color-accent);
    background: color-mix(in srgb, var(--color-panel), var(--color-bg) 6%);
  }

  [data-part="step-actions"] {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    flex-wrap: wrap;
  }

  :global(.step-action-button) {
    padding: 4px 8px;
    font-size: 11px;
  }

  :global(.step-remove-button) {
    color: var(--color-danger-text);
  }
</style>
