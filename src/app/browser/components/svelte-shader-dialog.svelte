<svelte:options customElement={{ tag: 'lut-shader-dialog-content', shadow: 'none' }} />

<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import {
    getShaderGenerator,
    type ShaderBuildInput,
    type ShaderGenerator,
    type ShaderLanguage,
  } from '../../../features/shader/shader-generator.ts';
  import { getLanguage, subscribeLanguageChange, t } from '../i18n.ts';
  import Button from './svelte-button.svelte';

  type StatusKind = 'success' | 'error' | 'info';
  type ShaderCodeEntryId = 'glsl-fragment' | 'glsl-vertex' | 'hlsl-fragment' | 'mme-fragment';

  interface ShaderCodeEntry {
    label: string;
    stageLabel: string;
    language: ShaderLanguage;
    getSource: (generator: ShaderGenerator, input: ShaderBuildInput, cachedFragShader?: string) => string;
  }

  const SHADER_CODE_ENTRIES: Record<ShaderCodeEntryId, ShaderCodeEntry> = {
    'glsl-fragment': {
      label: 'GLSL Fragment',
      stageLabel: 'Fragment',
      language: 'glsl',
      getSource: (generator, input, cachedFragShader) => cachedFragShader ?? generator.buildFragment(input),
    },
    'glsl-vertex': {
      label: 'GLSL Vertex',
      stageLabel: 'Vertex',
      language: 'glsl',
      getSource: generator => {
        if (typeof generator.buildVertex !== 'function') {
          throw new Error('GLSL generator does not provide a vertex shader.');
        }
        return generator.buildVertex();
      },
    },
    'hlsl-fragment': {
      label: 'HLSL',
      stageLabel: 'HLSL',
      language: 'hlsl',
      getSource: (generator, input) => generator.buildFragment(input),
    },
    'mme-fragment': {
      label: 'MMEffect',
      stageLabel: 'MMEffect',
      language: 'mme',
      getSource: (generator, input) => generator.buildFragment(input),
    },
  };

  const {
    buildInput = null,
    fragmentShader = undefined,
  }: {
    buildInput?: ShaderBuildInput | null;
    fragmentShader?: string | undefined;
  } = $props();
  const dispatch = createEventDispatcher<{
    'request-close': undefined;
    'export-shader': { language: ShaderLanguage };
    'status-message': { message: string; kind?: StatusKind };
  }>();

  let language = $state(getLanguage());
  let activeEntryId = $state<ShaderCodeEntryId>('glsl-fragment');

  const disposeLanguageSync = subscribeLanguageChange(nextLanguage => {
    language = nextLanguage;
  });

  onDestroy(() => {
    disposeLanguageSync();
  });

  function tr(key: Parameters<typeof t>[0], values?: Record<string, string | number>): string {
    language;
    return values ? t(key, values as never) : t(key);
  }

  function getActiveEntry(): ShaderCodeEntry {
    return SHADER_CODE_ENTRIES[activeEntryId] ?? SHADER_CODE_ENTRIES['glsl-fragment'];
  }

  function getShaderSource(): string {
    if (!buildInput) {
      return '// Shader is not ready yet.';
    }

    const entry = getActiveEntry();
    return entry.getSource(getShaderGenerator(entry.language), buildInput, fragmentShader);
  }

  function getMetaText(): string {
    const source = getShaderSource();
    return tr('shader.meta', {
      stage: getActiveEntry().stageLabel,
      lines: source.split('\n').length,
    });
  }

  async function handleCopy(): Promise<void> {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      dispatch('status-message', { message: tr('shader.status.clipboardUnavailable'), kind: 'error' });
      return;
    }

    try {
      await navigator.clipboard.writeText(getShaderSource());
      dispatch('status-message', {
        message: tr('shader.status.copySuccess', {
          stage: getActiveEntry().stageLabel,
        }),
        kind: 'success',
      });
    } catch {
      dispatch('status-message', { message: tr('shader.status.copyFailed'), kind: 'error' });
    }
  }

  function handleExport(): void {
    dispatch('export-shader', { language: getActiveEntry().language });
  }
</script>

{#key language}
<div class="shader-root">
  <div class="shader-header">
    <div>
      <div class="section-label" id="shader-dialog-title">{tr('shader.title')}</div>
      <div class="shader-help-text">{tr('shader.help')}</div>
    </div>
    <div class="shader-tabs" aria-label={tr('shader.tabsAria')}>
      {#each Object.entries(SHADER_CODE_ENTRIES) as [id, entry] (id)}
        <button
          type="button"
          class={`shader-tab ${activeEntryId === id ? 'shader-tab-active' : 'shader-tab-inactive'}`}
          data-shader-stage={id}
          aria-pressed={activeEntryId === id ? 'true' : 'false'}
          onclick={() => {
            activeEntryId = id as ShaderCodeEntryId;
          }}
        >
          {entry.label}
        </button>
      {/each}
    </div>
    <div class="shader-toolbar">
      <Button variant="secondary" handlePress={() => void handleCopy()}>
        {tr('shader.copy')}
      </Button>
      <Button variant="submit" handlePress={() => void handleExport()}>
        {tr('shader.download')}
      </Button>
      <Button
        variant="secondary"
        ariaLabel={tr('shader.closeAria')}
        handlePress={() => dispatch('request-close')}
      >
        {tr('shader.close')}
      </Button>
    </div>
  </div>
  <div class="shader-meta">{getMetaText()}</div>
  <pre class="shader-code-output">{getShaderSource()}</pre>
</div>
{/key}

<style>
  .shader-root {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }

  .shader-header {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--color-line);
  }

  .shader-help-text {
    margin-top: 4px;
    font-size: 11px;
    color: var(--color-muted);
  }

  .shader-tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    margin-right: auto;
    padding: 3px;
    border: 1px solid var(--color-panel-border-strong, #464646);
    border-radius: 999px;
    background: var(--color-tab-pill-bg, color-mix(in srgb, var(--color-panel), white 4%));
  }

  .shader-tab {
    border: 1px solid transparent;
    background: transparent;
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 11px;
    color: var(--color-muted);
    cursor: pointer;
  }

  .shader-tab:hover {
    transform: none;
  }

  .shader-tab-active {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: var(--color-accent-ink);
  }

  .shader-toolbar {
    display: flex;
    align-items: stretch;
    gap: 8px;
    margin-left: auto;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .shader-meta {
    padding: 8px 12px;
    border-bottom: 1px solid var(--color-line);
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--color-muted);
  }

  .shader-code-output {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 12px;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    line-height: 1.5;
    white-space: pre;
    color: var(--color-code-text, var(--color-text));
    user-select: text;
    margin: 0;
  }

  @media (max-width: 900px) {
    .shader-header {
      grid-template-columns: 1fr;
    }

    .shader-toolbar {
      width: 100%;
      justify-content: space-between;
    }
  }
</style>
