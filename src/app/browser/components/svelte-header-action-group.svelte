<svelte:options customElement={{ tag: 'lut-header-action-group', shadow: 'none' }} />

<script lang="ts">
  import { onDestroy } from 'svelte';
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
  export let onUndoPipeline: () => void = () => undefined;
  export let onRedoPipeline: () => void = () => undefined;
  export let onResetPresetSelected: (preset: PipelinePresetKey) => void | Promise<void> = () => undefined;
  export let onSavePipeline: () => void | Promise<void> = () => undefined;
  export let onPipelineFileSelected: (file: File) => void | Promise<void> = () => undefined;
  export let onOpenShaderDialog: () => void = () => undefined;
  export let onExportShaderZip: (language: ShaderLanguage) => void | Promise<void> = () => undefined;
  export let onStatus: (message: string, kind?: StatusKind) => void = () => undefined;

  let pipelineFileInputRef: HTMLInputElement | null = null;
  let language = getLanguage();
  const disposeLanguageSync = subscribeLanguageChange(nextLanguage => {
    language = nextLanguage;
  });

  function tr(key: Parameters<typeof t>[0], values?: Record<string, string | number>): string {
    language;
    return values ? t(key, values as never) : t(key);
  }

  async function handleSavePipeline(): Promise<void> {
    try {
      await onSavePipeline();
    } catch (error) {
      const message = error instanceof Error ? error.message : tr('common.unknownError');
      onStatus(tr('header.status.pipelineSaveFailed', { message }), 'error');
    }
  }

  async function handleResetPresetSelect(preset: PipelinePresetKey): Promise<void> {
    try {
      await onResetPresetSelected(preset);
    } catch (error) {
      const message = error instanceof Error ? error.message : tr('common.unknownError');
      onStatus(tr('header.status.pipelineLoadFailed', { message }), 'error');
    }
  }

  function openPipelineFilePicker(): void {
    if (!pipelineFileInputRef) {
      onStatus(tr('header.status.missingPipelineFileInput'), 'error');
      return;
    }

    pipelineFileInputRef.click();
  }

  async function handlePipelineFileInputChange(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      onStatus(tr('header.status.pipelineInputMissing'), 'error');
      return;
    }

    const file = input.files?.[0];
    if (!file) {
      input.value = '';
      return;
    }

    if (!(file instanceof File)) {
      onStatus(tr('header.status.invalidSelectedFile'), 'error');
      input.value = '';
      return;
    }

    if (!Number.isFinite(file.size) || file.size <= 0) {
      onStatus(tr('header.status.emptyFile'), 'error');
      input.value = '';
      return;
    }

    try {
      await onPipelineFileSelected(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : tr('common.unknownError');
      onStatus(tr('header.status.pipelineLoadFailed', { message }), 'error');
    } finally {
      input.value = '';
    }
  }

  async function handleExportShaderZip(nextLanguage: ShaderLanguage): Promise<void> {
    try {
      await onExportShaderZip(nextLanguage);
    } catch (error) {
      const message = error instanceof Error ? error.message : tr('common.unknownError');
      onStatus(tr('shader.status.exportFailed', { message }), 'error');
    }
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
  handlePress={onUndoPipeline}
>
  {tr('header.undo')}
</Button>

<Button
  variant="secondary"
  id="btn-redo-pipeline"
  ariaLabel={tr('header.redoAria')}
  disabled={!canRedo}
  handlePress={onRedoPipeline}
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
        void handleResetPresetSelect('Initial');
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
          void handleResetPresetSelect(preset);
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
<Button variant="secondary" id="btn-save-pipeline" handlePress={() => void handleSavePipeline()}>
  {tr('header.save')}
</Button>

<input
  bind:this={pipelineFileInputRef}
  type="file"
  id="pipeline-file-input"
  accept=".lutchain,application/x-lutchain"
  hidden
  on:change={event => void handlePipelineFileInputChange(event)}
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
        onOpenShaderDialog();
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
        void handleExportShaderZip('glsl');
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
        void handleExportShaderZip('hlsl');
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
        void handleExportShaderZip('mme');
      }}
    >
      {tr('header.exportShaderZip', { language: 'MMEffect' })}
    </button>
  </svelte:fragment>
</DropdownMenu>
