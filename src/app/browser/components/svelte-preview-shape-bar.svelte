<svelte:options customElement={{ tag: 'lut-preview-shape-bar', shadow: 'none' }} />

<script lang="ts">
  import { onDestroy } from 'svelte';
  import { getLanguage, subscribeLanguageChange, t } from '../i18n.ts';
  import Button from './svelte-button.svelte';
  import DropdownMenu from './svelte-dropdown-menu.svelte';

  export type PreviewShapeType = 'sphere' | 'cube' | 'torus';

  type StatusKind = 'success' | 'error' | 'info';
  type PreviewActionMenuValue = 'toggle-wireframe' | 'export-main-preview' | 'export-step-preview';

  const PREVIEW_SHAPES: Array<{ key: PreviewShapeType; label: string }> = [
    { key: 'sphere', label: 'Sphere' },
    { key: 'cube', label: 'Cube' },
    { key: 'torus', label: 'Torus' },
  ];

  export let activeShape: PreviewShapeType = 'sphere';
  export let wireframeEnabled = false;
  export let onShapeChange: (shape: PreviewShapeType) => void = () => undefined;
  export let onWireframeChange: (enabled: boolean) => void = () => undefined;
  export let onExportMainPreviewPng: () => void | Promise<void> = () => undefined;
  export let onExportStepPreviewPng: () => void | Promise<void> = () => undefined;
  export let onStatus: (message: string, kind?: StatusKind) => void = () => undefined;

  let language = getLanguage();
  const disposeLanguageSync = subscribeLanguageChange(nextLanguage => {
    language = nextLanguage;
  });

  function tr(key: Parameters<typeof t>[0], values?: Record<string, string | number>): string {
    language;
    return values ? t(key, values as never) : t(key);
  }

  $: wireframeLabel = tr('preview.menuWireframeToggle', {
    state: wireframeEnabled ? tr('common.on') : tr('common.off'),
  });

  function isValidPreviewShapeType(value: unknown): value is PreviewShapeType {
    return value === 'sphere' || value === 'cube' || value === 'torus';
  }

  function handleSelectShape(nextShape: PreviewShapeType): void {
    if (!isValidPreviewShapeType(nextShape)) {
      onStatus(t('preview.status.invalidSelectedShape', { value: String(nextShape) }), 'error');
      return;
    }

    if (nextShape === activeShape) {
      return;
    }

    activeShape = nextShape;
    onShapeChange(nextShape);
  }

  async function handleSelectActionMenu(action: PreviewActionMenuValue): Promise<void> {
    try {
      if (action === 'toggle-wireframe') {
        const next = !wireframeEnabled;
        onWireframeChange(next);
        wireframeEnabled = next;
        return;
      }

      if (action === 'export-main-preview') {
        await onExportMainPreviewPng();
        return;
      }

      await onExportStepPreviewPng();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.unknownError');
      onStatus(tr('preview.status.menuActionFailed', { message }), 'error');
    }
  }

  onDestroy(() => {
    disposeLanguageSync();
  });
</script>

<div class="section-label">{tr('preview.shapeLabel')}</div>
<div class="preview-shape-group">
  {#each PREVIEW_SHAPES as shape}
    <Button
      type="button"
      active={activeShape === shape.key}
      handlePress={() => handleSelectShape(shape.key)}
    >
      {shape.label}
    </Button>
  {/each}
</div>
<DropdownMenu
  wrapperClass="ui-menu-wrap preview-action-menu-wrap"
  menuClass="ui-menu preview-kebab-menu"
  triggerAriaLabel={tr('preview.menuButtonAria')}
  menuRole="menu"
  triggerVariant="menu-trigger"
>
  <span slot="trigger" class="ui-symbol-kebab">･･･</span>
  <svelte:fragment let:closeMenu>
    <button
      type="button"
      class="ui-menu-item"
      role="menuitem"
      on:click={() => {
        closeMenu();
        void handleSelectActionMenu('toggle-wireframe');
      }}
    >
      {wireframeLabel}
    </button>
    <button
      type="button"
      class="ui-menu-item"
      role="menuitem"
      on:click={() => {
        closeMenu();
        void handleSelectActionMenu('export-main-preview');
      }}
    >
      {tr('preview.menuExportMainPng')}
    </button>
    <button
      type="button"
      class="ui-menu-item"
      role="menuitem"
      on:click={() => {
        closeMenu();
        void handleSelectActionMenu('export-step-preview');
      }}
    >
      {tr('preview.menuExportStepPng')}
    </button>
  </svelte:fragment>
</DropdownMenu>

<style>
  .preview-shape-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-start;
  }
  @media (max-width: 900px) {
    .preview-shape-group {
      width: 100%;
      justify-content: flex-start;
    }
  }
</style>
