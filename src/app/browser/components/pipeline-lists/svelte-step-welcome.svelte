<script lang="ts">
  import type { PipelinePresetKey } from '../../ui/pipeline-presets.ts';
  import { t } from '../../i18n.ts';
  import Button from '../svelte-button.svelte';

  type StatusKind = 'success' | 'error' | 'info';

  const WELCOME_EXAMPLES: PipelinePresetKey[] = ['StandardToon', 'HueShiftToon', 'HueSatShiftToon', 'Gradient', 'Plastic', 'Metallic'];
  const GITHUB_URL = 'https://github.com/mfakane/lutchainer';
  const BLENDER_ADDON_URL = 'https://github.com/mfakane/lutchainer/releases';

  let {
    tr,
    onOpenPipelineFilePicker = () => undefined,
    onLoadExample = () => undefined,
    onStatus = () => undefined,
  }: {
    tr: (key: Parameters<typeof t>[0], values?: Record<string, string | number>) => string;
    onOpenPipelineFilePicker?: () => void;
    onLoadExample?: (example: PipelinePresetKey) => void | Promise<void>;
    onStatus?: (message: string, kind?: StatusKind) => void;
  } = $props();

  async function handleLoadExample(example: PipelinePresetKey): Promise<void> {
    try {
      await onLoadExample(example);
    } catch (error) {
      const message = error instanceof Error ? error.message : tr('common.unknownError');
      onStatus(tr('header.status.pipelineLoadFailed', { message }), 'error');
    }
  }
</script>

<section data-step-empty="true" class="step-welcome">
  <div data-part="welcome-eyebrow">{tr('pipeline.welcome.eyebrow')}</div>
  <h2 data-part="welcome-title">{tr('pipeline.welcome.title')}</h2>
  <p data-part="welcome-copy">{tr('pipeline.welcome.description')}</p>

  <div data-part="welcome-actions">
    <Button variant="secondary" handlePress={onOpenPipelineFilePicker}>
      {tr('pipeline.welcome.load')}
    </Button>
    <a class="welcome-link-button" href={GITHUB_URL} target="_blank" rel="noreferrer">
      {tr('pipeline.welcome.github')}
    </a>
    <a class="welcome-link-button" href={BLENDER_ADDON_URL} target="_blank" rel="noreferrer">
      {tr('pipeline.welcome.blenderAddon')}
    </a>
  </div>

  <div data-part="welcome-examples">
    <div data-part="welcome-section-title">{tr('pipeline.welcome.examplesTitle')}</div>
    <div data-part="welcome-example-list">
      {#each WELCOME_EXAMPLES as example}
        <Button className="welcome-example-button" handlePress={() => void handleLoadExample(example)}>
          {example}
        </Button>
      {/each}
    </div>
  </div>

  <p data-part="welcome-step-hint">{tr('pipeline.welcome.stepHint')}</p>
</section>

<style>
  [data-step-empty="true"] {
    min-width: 0;
    border: 1px solid var(--color-panel-border-strong);
    border-radius: 14px;
    padding: 18px;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--color-panel-2), var(--color-bg) 2%),
      color-mix(in srgb, var(--color-panel), var(--color-bg) 10%)
    );
    display: grid;
    gap: 14px;
  }

  [data-part="welcome-eyebrow"] {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-accent);
    font-weight: 700;
  }

  [data-part="welcome-title"] {
    margin: 0;
    font-size: 24px;
    line-height: 1.1;
    color: var(--color-text-strong);
  }

  [data-part="welcome-copy"],
  [data-part="welcome-step-hint"] {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--color-text);
  }

  [data-part="welcome-actions"] {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  [data-part="welcome-examples"] {
    padding-top: 8px;
    border-top: 1px solid color-mix(in srgb, var(--color-line), transparent 30%);
  }

  [data-part="welcome-section-title"] {
    font-size: 11px;
    font-weight: 700;
    color: var(--color-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 8px;
  }

  [data-part="welcome-example-list"] {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .welcome-link-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-line);
    background: var(--color-panel);
    border-radius: 8px;
    padding: 6px 11px;
    font-size: 12px;
    color: var(--color-muted);
    text-decoration: none;
    cursor: pointer;
    transition: 120ms ease;
  }

  .welcome-link-button:hover {
    border-color: var(--color-accent);
    transform: translateY(-1px);
  }

  :global(button.button.welcome-example-button) {
    padding: 4px 8px;
    font-size: 11px;
  }
</style>
