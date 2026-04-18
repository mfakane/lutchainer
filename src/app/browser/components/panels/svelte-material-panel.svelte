<svelte:options customElement={{ tag: 'lut-material-panel', shadow: 'none' }} />

<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import * as pipelineModel from '../../../../features/pipeline/pipeline-model.ts';
  import { getLanguage, subscribeLanguageChange, t } from '../../i18n.ts';
  import { MATERIAL_PRESETS, type MaterialPresetDefinition } from '../../ui/preview-presets.ts';
  import DropdownMenu from '../svelte-dropdown-menu.svelte';
  import { clamp, cloneMaterialSettings, getMaterialRangeStep, isValidMaterialSettings } from './shared.ts';

  type StatusKind = 'success' | 'error' | 'info';

  let {
    settings = cloneMaterialSettings(pipelineModel.DEFAULT_MATERIAL_SETTINGS),
  }: {
    settings?: pipelineModel.MaterialSettings;
  } = $props();
  const dispatch = createEventDispatcher<{
    'settings-change': { settings: pipelineModel.MaterialSettings };
    'status-message': { message: string; kind?: StatusKind };
  }>();

  let language = $state(getLanguage());
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

  function handleBaseColorInput(event: Event): void {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      dispatch('status-message', { message: tr('panel.baseColorInputMissing'), kind: 'error' });
      return;
    }

    const parsed = pipelineModel.parseHexColor(input.value);
    if (!parsed) {
      dispatch('status-message', { message: tr('panel.baseColorInvalid'), kind: 'error' });
      return;
    }

    dispatch('settings-change', { settings: {
      ...settings,
      baseColor: [parsed[0], parsed[1], parsed[2]],
    } });
  }

  function handleRangeInput(event: Event, binding: pipelineModel.MaterialRangeBinding): void {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      dispatch('status-message', { message: tr('panel.rangeInputMissing', { label: binding.label }), kind: 'error' });
      return;
    }

    const parsed = Number(input.value);
    if (!Number.isFinite(parsed)) {
      dispatch('status-message', { message: tr('panel.rangeInvalid', { label: binding.label }), kind: 'error' });
      return;
    }

    const next = cloneMaterialSettings(settings);
    next[binding.key] = clamp(parsed, binding.min, binding.max);
    dispatch('settings-change', { settings: next });
  }

  function handleMaterialRangeWheel(event: WheelEvent, binding: pipelineModel.MaterialRangeBinding): void {
    event.preventDefault();
    const step = Number(getMaterialRangeStep(binding.key));
    const next = cloneMaterialSettings(settings);
    const delta = event.deltaY < 0 ? step : -step;
    next[binding.key] = clamp(settings[binding.key] + delta, binding.min, binding.max);
    dispatch('settings-change', { settings: next });
  }

  function applyMaterialPreset(preset: MaterialPresetDefinition): boolean {
    if (!isValidMaterialSettings(preset.settings)) {
      dispatch('status-message', {
        message: tr('panel.status.materialPresetInvalidValue', { value: preset.key }),
        kind: 'error',
      });
      return false;
    }

    dispatch('settings-change', { settings: cloneMaterialSettings(preset.settings) });
    dispatch('status-message', {
      message: tr('panel.status.materialPresetApplied', { name: tr(preset.labelKey) }),
      kind: 'info',
    });
    return true;
  }

  const baseColorHex = $derived(pipelineModel.colorToHex(settings.baseColor));
</script>

{#key language}
<div class="panel-root">
  <div class="panel-head">
    <div>
      <div class="section-label">{tr('panel.materialTitle')}</div>
      <div class="help-text">{tr('panel.materialHelp')}</div>
    </div>
    <DropdownMenu
      wrapperClass="ui-menu-wrap"
      triggerClassName="ui-menu-trigger"
      menuClass="ui-menu"
      triggerAriaLabel={tr('panel.materialPreset')}
      menuRole="menu"
      triggerVariant="menu-trigger"
    >
      {#snippet trigger()}
        <span class="ui-symbol-kebab">...</span>
      {/snippet}
      {#snippet children(closeMenu)}
        <div class="ui-menu-header">{tr('panel.materialPreset')}</div>
        {#each MATERIAL_PRESETS as preset}
          <button
            type="button"
            class="ui-menu-item"
            role="menuitem"
            onclick={() => {
              if (applyMaterialPreset(preset)) {
                closeMenu();
              }
            }}
          >
            {tr(preset.labelKey)}
          </button>
        {/each}
      {/snippet}
    </DropdownMenu>
  </div>

  <div class="grid">
    <label class="field color-field">
      <span class="label-row">
        <span class="label-text">{tr('panel.baseColor')}</span>
        <span class="value-text" id="mat-base-color-value">{baseColorHex}</span>
      </span>
      <input class="color-input" type="color" id="mat-base-color" value={baseColorHex} oninput={handleBaseColorInput} />
    </label>

    {#each pipelineModel.MATERIAL_RANGE_BINDINGS as binding}
      <label class="field">
        <span class="label-row">
          <span class="label-text">{binding.label}</span>
          <span class="value-text" id={binding.outputId}>{settings[binding.key].toFixed(binding.fractionDigits)}</span>
        </span>
        <input
          class="range-input"
          type="range"
          id={binding.inputId}
          min={String(binding.min)}
          max={String(binding.max)}
          step={getMaterialRangeStep(binding.key)}
          value={String(settings[binding.key])}
          oninput={event => handleRangeInput(event, binding)}
          onchange={event => handleRangeInput(event, binding)}
          onwheel={event => handleMaterialRangeWheel(event, binding)}
        />
      </label>
    {/each}
  </div>
</div>
{/key}

<style>
  .panel-root {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .panel-head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .help-text {
    font-size: 11px;
    color: var(--color-muted);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 9px 10px;
    border: 1px solid var(--color-panel-border-strong, #464646);
    border-radius: 12px;
    background: color-mix(in srgb, var(--color-panel), var(--color-bg) 4%);
  }

  .color-field {
    grid-column: span 2;
  }

  .label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .label-text {
    font-size: 11px;
    font-weight: 700;
    color: var(--color-text-strong);
  }

  .value-text {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--color-muted);
  }

  .color-input {
    width: 100%;
    height: 34px;
    border: 1px solid var(--color-control-border, var(--color-line));
    border-radius: 9px;
    background: var(--color-control-bg, var(--color-panel));
    padding: 4px;
  }

  .range-input {
    width: 100%;
    accent-color: var(--color-accent);
  }

  @media (max-width: 1180px) {
    .grid {
      grid-template-columns: 1fr;
    }

    .color-field {
      grid-column: span 1;
    }
  }

  @media (max-width: 900px) {
    .panel-head {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
