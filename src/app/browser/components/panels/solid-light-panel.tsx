import { For, type JSX } from 'solid-js';
import * as pipelineModel from '../../../../features/pipeline/pipeline-model.ts';
import { t, useLanguage, type TranslationArgs, type TranslationKey } from '../../i18n.ts';
import { cx } from '../../styles/cx.ts';
import * as ui from '../../styles/ui-primitives.css.ts';
import { LIGHT_PRESETS, type LightPresetDefinition } from '../../ui/preview-presets.ts';
import { DropdownMenu } from '../solid-dropdown-menu.tsx';
import * as styles from './shared.css.ts';
import type { LightPanelProps } from './shared.ts';
import { clamp, cloneLightSettings, getLightRangeStep, isLightAngleBinding, isValidLightSettings } from './shared.ts';

export function LightPanel(props: LightPanelProps): JSX.Element {
  const language = useLanguage();

  function tr<K extends TranslationKey>(key: K, ...args: TranslationArgs<K>): string {
    language();
    return t(key, ...args);
  }

  const handleLightColorInput = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      props.onStatus(tr('panel.lightColorInputMissing'), 'error');
      return;
    }
    const parsed = pipelineModel.parseHexColor(input.value);
    if (!parsed) {
      props.onStatus(tr('panel.lightColorInvalid'), 'error');
      return;
    }
    const current = props.settings();
    props.commitSettings({ ...current, lightColor: [parsed[0], parsed[1], parsed[2]] });
  };

  const handleAmbientColorInput = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      props.onStatus(tr('panel.ambientColorInputMissing'), 'error');
      return;
    }
    const parsed = pipelineModel.parseHexColor(input.value);
    if (!parsed) {
      props.onStatus(tr('panel.ambientColorInvalid'), 'error');
      return;
    }
    const current = props.settings();
    props.commitSettings({ ...current, ambientColor: [parsed[0], parsed[1], parsed[2]] });
  };

  const handleRangeInput = (event: Event, binding: pipelineModel.LightRangeBinding): void => {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      props.onStatus(tr('panel.rangeInputMissing', { label: binding.label }), 'error');
      return;
    }
    const parsed = Number(input.value);
    if (!Number.isFinite(parsed)) {
      props.onStatus(tr('panel.rangeInvalid', { label: binding.label }), 'error');
      return;
    }
    const current = props.settings();
    const next = cloneLightSettings(current);
    next[binding.key] = clamp(parsed, binding.min, binding.max);
    props.commitSettings(next);
  };

  const handleLightRangeWheel = (event: WheelEvent, binding: pipelineModel.LightRangeBinding): void => {
    event.preventDefault();
    const step = Number(getLightRangeStep(binding));
    const delta = event.deltaY < 0 ? step : -step;
    const current = props.settings();
    const next = cloneLightSettings(current);
    next[binding.key] = clamp(current[binding.key] + delta, binding.min, binding.max);
    props.commitSettings(next);
  };

  const toggleGizmo = (): void => {
    const current = props.settings();
    props.commitSettings({ ...current, showGizmo: !current.showGizmo });
  };

  const applyLightPreset = (preset: LightPresetDefinition): boolean => {
    if (!isValidLightSettings(preset.settings)) {
      props.onStatus(tr('panel.status.lightPresetInvalidValue', { value: preset.key }), 'error');
      return false;
    }
    props.commitSettings(cloneLightSettings(preset.settings));
    props.onStatus(tr('panel.status.lightPresetApplied', { name: tr(preset.labelKey) }), 'info');
    return true;
  };

  return (
    <div class={styles.panelRoot}>
      <div class={styles.panelHead}>
        <div>
          <div class={ui.sectionLabel}>Light</div>
          <div class={styles.helpText}>{tr('panel.lightHelp')}</div>
        </div>
        <div class={styles.lightActions}>
          <button
            type="button"
            class={cx(ui.buttonBase, ui.secondaryButton, styles.lightToggleButton)}
            id="btn-toggle-light-gizmo"
            aria-pressed={props.settings().showGizmo ? 'true' : 'false'}
            onClick={toggleGizmo}
          >
            {tr('panel.guide')}
          </button>

          <DropdownMenu
            wrapperClass={ui.menuWrap}
            triggerClass={cx(ui.buttonBase, ui.menuTrigger)}
            menuClass={ui.menu}
            triggerAriaLabel={tr('panel.lightPreset')}
            menuRole="menu"
          >
            {controls => (
              <>
                <div class={ui.menuHeader}>{tr('panel.lightPreset')}</div>
                <For each={LIGHT_PRESETS}>
                  {preset => (
                    <button
                      type="button"
                      class={ui.menuItem}
                      role="menuitem"
                      onClick={() => {
                        if (applyLightPreset(preset)) controls.closeMenu();
                      }}
                    >
                      {tr(preset.labelKey)}
                    </button>
                  )}
                </For>
              </>
            )}
          </DropdownMenu>
        </div>
      </div>

      <div class={styles.grid}>
        <label class={cx(styles.field, styles.colorField)}>
          <span class={styles.labelRow}>
            <span class={styles.labelText}>Light Color</span>
            <span class={styles.valueText} id="light-color-value">{pipelineModel.colorToHex(props.settings().lightColor)}</span>
          </span>
          <input class={ui.colorInput} type="color" id="light-color" value={pipelineModel.colorToHex(props.settings().lightColor)} onInput={handleLightColorInput} />
        </label>

        <label class={cx(styles.field, styles.colorField)}>
          <span class={styles.labelRow}>
            <span class={styles.labelText}>Ambient Color</span>
            <span class={styles.valueText} id="light-ambient-color-value">{pipelineModel.colorToHex(props.settings().ambientColor)}</span>
          </span>
          <input class={ui.colorInput} type="color" id="light-ambient-color" value={pipelineModel.colorToHex(props.settings().ambientColor)} onInput={handleAmbientColorInput} />
        </label>

        <For each={pipelineModel.LIGHT_RANGE_BINDINGS}>
          {binding => (
            <label class={styles.field}>
              <span class={styles.labelRow}>
                <span class={styles.labelText}>{binding.label}</span>
                <span class={styles.valueText} id={binding.outputId}>
                  {isLightAngleBinding(binding)
                    ? `${props.settings()[binding.key].toFixed(binding.fractionDigits)}°`
                    : props.settings()[binding.key].toFixed(binding.fractionDigits)}
                </span>
              </span>
              <input
                class={ui.rangeInput}
                type="range"
                id={binding.inputId}
                min={String(binding.min)}
                max={String(binding.max)}
                step={getLightRangeStep(binding)}
                value={String(props.settings()[binding.key])}
                onInput={event => handleRangeInput(event, binding)}
                onChange={event => handleRangeInput(event, binding)}
                onWheel={event => handleLightRangeWheel(event, binding)}
              />
            </label>
          )}
        </For>
      </div>
    </div>
  );
}
