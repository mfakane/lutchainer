<svelte:options customElement={{ tag: 'lut-header-action-group', shadow: 'none' }} />

<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import type { ShaderLanguage } from '../../../features/shader/shader-generator.ts';
  import type { PipelinePresetKey } from '../ui/pipeline-presets.ts';
  import { getLanguage, subscribeLanguageChange, t } from '../i18n.ts';
  import Button from './svelte-button.svelte';
  import DropdownMenu from './svelte-dropdown-menu.svelte';

  type StatusKind = 'success' | 'error' | 'info';

  const RESET_PRESETS: readonly PipelinePresetKey[] = [
    'StandardToon',
    'HueShiftToon',
    'HueSatShiftToon',
    'Gradient',
    'Plastic',
    'Metallic',
  ];

  export let canUndo = false;
  export let canRedo = false;
  const dispatch = createEventDispatcher<{
    'undo-pipeline': undefined;
    'redo-pipeline': undefined;
    'reset-preset-selected': { preset: PipelinePresetKey };
    'save-pipeline': undefined;
    'pipeline-file-selected': { file: File };
    'open-shader-dialog': undefined;
    'export-shader-zip': { language: ShaderLanguage };
    'status-message': { message: string; kind?: StatusKind };
  }>();

  let pipelineFileInputRef: HTMLInputElement | null = null;
  let language = getLanguage();
  const disposeLanguageSync = subscribeLanguageChange(nextLanguage => {
    language = nextLanguage;
  });

  function tr(key: Parameters<typeof t>[0], values?: Record<string, string | number>): string {
    language;
    return values ? t(key, values as never) : t(key);
  }

  function emitStatus(message: string, kind: StatusKind = 'info'): void {
    dispatch('status-message', { message, kind });
  }

  function handleSavePipeline(): void {
    dispatch('save-pipeline');
  }

  function handleResetPresetSelect(preset: PipelinePresetKey): void {
    dispatch('reset-preset-selected', { preset });
  }

  function openPipelineFilePicker(): void {
    if (!pipelineFileInputRef) {
      emitStatus(tr('header.status.missingPipelineFileInput'), 'error');
      return;
    }

    pipelineFileInputRef.click();
  }

  function handlePipelineFileInputChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      emitStatus(tr('header.status.pipelineInputMissing'), 'error');
      return;
    }

    const file = input.files?.[0];
    if (!file) {
      input.value = '';
      return;
    }

    if (!(file instanceof File)) {
      emitStatus(tr('header.status.invalidSelectedFile'), 'error');
      input.value = '';
      return;
    }

    if (!Number.isFinite(file.size) || file.size <= 0) {
      emitStatus(tr('header.status.emptyFile'), 'error');
      input.value = '';
      return;
    }

    dispatch('pipeline-file-selected', { file });
    input.value = '';
  }

  function handleExportShaderZip(nextLanguage: ShaderLanguage): void {
    dispatch('export-shader-zip', { language: nextLanguage });
  }

  onDestroy(() => {
    disposeLanguageSync();
  });
</script>

<Button
  variant="secondary"
  id="btn-undo-pipeline"
  ariaLabel={tr('header.undoAria')}
  disabled={!canUndo}
  handlePress={() => dispatch('undo-pipeline')}
>
  {tr('header.undo')}
</Button>

<Button
  variant="secondary"
  id="btn-redo-pipeline"
  ariaLabel={tr('header.redoAria')}
  disabled={!canRedo}
  handlePress={() => dispatch('redo-pipeline')}
>
  {tr('header.redo')}
</Button>

<DropdownMenu
  wrapperClass="ui-menu-wrap"
  menuClass="ui-menu"
  triggerAriaLabel={tr('header.reset')}
  menuRole="menu"
  triggerText={tr('header.reset')}
  triggerVariant="secondary"
>
  <svelte:fragment let:closeMenu>
    <button
      type="button"
      class="ui-menu-item"
      role="menuitem"
      on:click={() => {
        closeMenu();
        handleResetPresetSelect('Initial');
      }}
    >
      {tr('header.resetInitial')}
    </button>
    <div class="ui-menu-header">{tr('header.resetExamples')}</div>
    {#each RESET_PRESETS as preset}
      <button
        type="button"
        class="ui-menu-item"
        role="menuitem"
        on:click={() => {
          closeMenu();
          handleResetPresetSelect(preset);
        }}
      >
        {preset}
      </button>
    {/each}
  </svelte:fragment>
</DropdownMenu>

<Button variant="secondary" id="btn-load-pipeline" handlePress={openPipelineFilePicker}>
  {tr('header.load')}
</Button>
<Button variant="secondary" id="btn-save-pipeline" handlePress={handleSavePipeline}>
  {tr('header.save')}
</Button>

<input
  bind:this={pipelineFileInputRef}
  type="file"
  id="pipeline-file-input"
  accept=".lutchain,application/x-lutchain"
  hidden
  on:change={handlePipelineFileInputChange}
/>

<DropdownMenu
  wrapperClass="ui-menu-wrap shader-open-button"
  menuClass="ui-menu"
  triggerAriaLabel={tr('header.exportMenuAria')}
  menuRole="menu"
  triggerText={tr('header.export')}
  triggerVariant="submit"
>
  <svelte:fragment let:closeMenu>
    <button
      type="button"
      class="ui-menu-item"
      role="menuitem"
      on:click={() => {
        closeMenu();
        dispatch('open-shader-dialog');
      }}
    >
      {tr('header.openCode')}
    </button>
    <div class="ui-menu-header">{tr('header.downloadZip')}</div>
    <button
      type="button"
      class="ui-menu-item"
      role="menuitem"
      on:click={() => {
        closeMenu();
        handleExportShaderZip('glsl');
      }}
    >
      {tr('header.exportShaderZip', { language: 'GLSL' })}
    </button>
    <button
      type="button"
      class="ui-menu-item"
      role="menuitem"
      on:click={() => {
        closeMenu();
        handleExportShaderZip('hlsl');
      }}
    >
      {tr('header.exportShaderZip', { language: 'HLSL' })}
    </button>
    <button
      type="button"
      class="ui-menu-item"
      role="menuitem"
      on:click={() => {
        closeMenu();
        handleExportShaderZip('mme');
      }}
    >
      {tr('header.exportShaderZip', { language: 'MMEffect' })}
    </button>
  </svelte:fragment>
</DropdownMenu>
