<svelte:options customElement={{ tag: 'lut-light-panel', shadow: 'none' }} />

<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import * as pipelineModel from '../../../../features/pipeline/pipeline-model.ts';
  import { getLanguage, subscribeLanguageChange, t } from '../../i18n.ts';
  import { LIGHT_PRESETS, type LightPresetDefinition } from '../../ui/preview-presets.ts';
  import DropdownMenu from '../svelte-dropdown-menu.svelte';
  import { clamp, cloneLightSettings, getLightRangeStep, isLightAngleBinding, isValidLightSettings } from './shared.ts';

  type StatusKind = 'success' | 'error' | 'info';

  let {
    settings = cloneLightSettings(pipelineModel.DEFAULT_LIGHT_SETTINGS),
  }: {
    settings?: pipelineModel.LightSettings;
  } = $props();
  const dispatch = createEventDispatcher<{
    'settings-change': { settings: pipelineModel.LightSettings };
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

  function handleColorInput(event: Event, kind: 'light' | 'ambient'): void {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      dispatch('status-message', {
        message: tr(kind === 'light' ? 'panel.lightColorInputMissing' : 'panel.ambientColorInputMissing'),
        kind: 'error',
      });
      return;
    }

    const parsed = pipelineModel.parseHexColor(input.value);
    if (!parsed) {
      dispatch('status-message', {
        message: tr(kind === 'light' ? 'panel.lightColorInvalid' : 'panel.ambientColorInvalid'),
        kind: 'error',
      });
      return;
    }

    dispatch('settings-change', { settings: {
      ...settings,
      ...(kind === 'light'
        ? { lightColor: [parsed[0], parsed[1], parsed[2]] as [number, number, number] }
        : { ambientColor: [parsed[0], parsed[1], parsed[2]] as [number, number, number] }),
    } });
  }

  function handleRangeInput(event: Event, binding: pipelineModel.LightRangeBinding): void {
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

    const next = cloneLightSettings(settings);
    next[binding.key] = clamp(parsed, binding.min, binding.max);
    dispatch('settings-change', { settings: next });
  }

  function handleLightRangeWheel(event: WheelEvent, binding: pipelineModel.LightRangeBinding): void {
    event.preventDefault();
    const step = Number(getLightRangeStep(binding));
    const delta = event.deltaY < 0 ? step : -step;
    const next = cloneLightSettings(settings);
    next[binding.key] = clamp(settings[binding.key] + delta, binding.min, binding.max);
    dispatch('settings-change', { settings: next });
  }

  function toggleGizmo(): void {
    dispatch('settings-change', { settings: { ...settings, showGizmo: !settings.showGizmo } });
  }

  function applyLightPreset(preset: LightPresetDefinition): boolean {
    if (!isValidLightSettings(preset.settings)) {
      dispatch('status-message', {
        message: tr('panel.status.lightPresetInvalidValue', { value: preset.key }),
        kind: 'error',
      });
      return false;
    }

    dispatch('settings-change', { settings: cloneLightSettings(preset.settings) });
    dispatch('status-message', {
      message: tr('panel.status.lightPresetApplied', { name: tr(preset.labelKey) }),
      kind: 'info',
    });
    return true;
  }

  const lightColorHex = $derived(pipelineModel.colorToHex(settings.lightColor));
  const ambientColorHex = $derived(pipelineModel.colorToHex(settings.ambientColor));
</script>

{#key language}
<div class="panel-root">
  <div class="panel-head">
    <div>
      <div class="section-label">{tr('panel.lightTitle')}</div>
      <div class="help-text">{tr('panel.lightHelp')}</div>
    </div>
    <div class="light-actions">
      <button
        type="button"
        class="guide-button"
        id="btn-toggle-light-gizmo"
        aria-pressed={settings.showGizmo ? 'true' : 'false'}
        onclick={toggleGizmo}
      >
        {tr('panel.guide')}
      </button>

      <DropdownMenu
        wrapperClass="ui-menu-wrap"
        triggerClassName="ui-menu-trigger"
        menuClass="ui-menu"
        triggerAriaLabel={tr('panel.lightPreset')}
        menuRole="menu"
        triggerVariant="menu-trigger"
      >
        {#snippet trigger()}
          <span class="ui-symbol-kebab">...</span>
        {/snippet}
        {#snippet children(closeMenu)}
          <div class="ui-menu-header">{tr('panel.lightPreset')}</div>
          {#each LIGHT_PRESETS as preset}
            <button
              type="button"
              class="ui-menu-item"
              role="menuitem"
              onclick={() => {
                if (applyLightPreset(preset)) {
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
  </div>

  <div class="grid">
    <label class="field color-field">
      <span class="label-row">
        <span class="label-text">{tr('panel.lightColor')}</span>
        <span class="value-text" id="light-color-value">{lightColorHex}</span>
      </span>
      <input class="color-input" type="color" id="light-color" value={lightColorHex} oninput={event => handleColorInput(event, 'light')} />
    </label>

    <label class="field color-field">
      <span class="label-row">
        <span class="label-text">{tr('panel.ambientColor')}</span>
        <span class="value-text" id="light-ambient-color-value">{ambientColorHex}</span>
      </span>
      <input class="color-input" type="color" id="light-ambient-color" value={ambientColorHex} oninput={event => handleColorInput(event, 'ambient')} />
    </label>

    {#each pipelineModel.LIGHT_RANGE_BINDINGS as binding}
      <label class="field">
        <span class="label-row">
          <span class="label-text">{binding.label}</span>
          <span class="value-text" id={binding.outputId}>
            {#if isLightAngleBinding(binding)}
              {settings[binding.key].toFixed(binding.fractionDigits)}°
            {:else}
              {settings[binding.key].toFixed(binding.fractionDigits)}
            {/if}
          </span>
        </span>
        <input
          class="range-input"
          type="range"
          id={binding.inputId}
          min={String(binding.min)}
          max={String(binding.max)}
          step={getLightRangeStep(binding)}
          value={String(settings[binding.key])}
          oninput={event => handleRangeInput(event, binding)}
          onchange={event => handleRangeInput(event, binding)}
          onwheel={event => handleLightRangeWheel(event, binding)}
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

  .light-actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .light-actions > * {
    flex-shrink: 0;
  }

  .guide-button {
    border: 1px solid var(--color-line);
    background: var(--color-panel);
    border-radius: 8px;
    padding: 6px 11px;
    font-size: 12px;
    color: var(--color-muted);
    cursor: pointer;
    transition: 120ms ease;
  }

  .guide-button:hover {
    border-color: var(--color-accent);
    transform: translateY(-1px);
  }

  .guide-button[aria-pressed="true"] {
    border-color: var(--color-accent);
    color: color-mix(in srgb, var(--color-text-strong), var(--color-accent) 24%);
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

    .light-actions {
      width: 100%;
      justify-content: space-between;
    }
  }
</style>
