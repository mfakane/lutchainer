import { For, type JSX } from 'solid-js';
import * as pipelineModel from '../../../../features/pipeline/pipeline-model.ts';
import { t, useLanguage, type TranslationArgs, type TranslationKey } from '../../i18n.ts';
import { cx } from '../../styles/cx.ts';
import * as ui from '../../styles/ui-primitives.css.ts';
import { MATERIAL_PRESETS, type MaterialPresetDefinition } from '../../ui/preview-presets.ts';
import { DropdownMenu } from '../solid-dropdown-menu.tsx';
import * as styles from './shared.css.ts';
import type { MaterialPanelProps } from './shared.ts';
import { clamp, cloneMaterialSettings, getMaterialRangeStep, isValidMaterialSettings } from './shared.ts';

export function MaterialPanel(props: MaterialPanelProps): JSX.Element {
  const language = useLanguage();

  function tr<K extends TranslationKey>(key: K, ...args: TranslationArgs<K>): string {
    language();
    return t(key, ...args);
  }

  const handleBaseColorInput = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      props.onStatus(tr('panel.baseColorInputMissing'), 'error');
      return;
    }
    const parsed = pipelineModel.parseHexColor(input.value);
    if (!parsed) {
      props.onStatus(tr('panel.baseColorInvalid'), 'error');
      return;
    }
    const current = props.settings();
    props.commitSettings({ ...current, baseColor: [parsed[0], parsed[1], parsed[2]] });
  };

  const handleRangeInput = (event: Event, binding: pipelineModel.MaterialRangeBinding): void => {
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
    const next = cloneMaterialSettings(current);
    next[binding.key] = clamp(parsed, binding.min, binding.max);
    props.commitSettings(next);
  };

  const handleMaterialRangeWheel = (event: WheelEvent, binding: pipelineModel.MaterialRangeBinding): void => {
    event.preventDefault();
    const step = Number(getMaterialRangeStep(binding.key));
    const delta = event.deltaY < 0 ? step : -step;
    const current = props.settings();
    const next = cloneMaterialSettings(current);
    next[binding.key] = clamp(current[binding.key] + delta, binding.min, binding.max);
    props.commitSettings(next);
  };

  const applyMaterialPreset = (preset: MaterialPresetDefinition): boolean => {
    if (!isValidMaterialSettings(preset.settings)) {
      props.onStatus(tr('panel.status.materialPresetInvalidValue', { value: preset.key }), 'error');
      return false;
    }
    props.commitSettings(cloneMaterialSettings(preset.settings));
    props.onStatus(tr('panel.status.materialPresetApplied', { name: tr(preset.labelKey) }), 'info');
    return true;
  };

  return (
    <div class={styles.panelRoot}>
      <div class={styles.panelHead}>
        <div>
          <div class={ui.sectionLabel}>Material</div>
          <div class={styles.helpText}>{tr('panel.materialHelp')}</div>
        </div>
        <DropdownMenu
          wrapperClass={ui.menuWrap}
          triggerClass={cx(ui.buttonBase, ui.menuTrigger)}
          menuClass={ui.menu}
          triggerAriaLabel={tr('panel.materialPreset')}
          menuRole="menu"
        >
          {controls => (
            <>
              <div class={ui.menuHeader}>{tr('panel.materialPreset')}</div>
              <For each={MATERIAL_PRESETS}>
                {preset => (
                  <button
                    type="button"
                    class={ui.menuItem}
                    role="menuitem"
                    onClick={() => {
                      if (applyMaterialPreset(preset)) controls.closeMenu();
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

      <div class={styles.grid}>
        <label class={cx(styles.field, styles.colorField)}>
          <span class={styles.labelRow}>
            <span class={styles.labelText}>Base Color</span>
            <span class={styles.valueText} id="mat-base-color-value">{pipelineModel.colorToHex(props.settings().baseColor)}</span>
          </span>
          <input class={ui.colorInput} type="color" id="mat-base-color" value={pipelineModel.colorToHex(props.settings().baseColor)} onInput={handleBaseColorInput} />
        </label>

        <For each={pipelineModel.MATERIAL_RANGE_BINDINGS}>
          {binding => (
            <label class={styles.field}>
              <span class={styles.labelRow}>
                <span class={styles.labelText}>{binding.label}</span>
                <span class={styles.valueText} id={binding.outputId}>{props.settings()[binding.key].toFixed(binding.fractionDigits)}</span>
              </span>
              <input
                class={ui.rangeInput}
                type="range"
                id={binding.inputId}
                min={String(binding.min)}
                max={String(binding.max)}
                step={getMaterialRangeStep(binding.key)}
                value={String(props.settings()[binding.key])}
                onInput={event => handleRangeInput(event, binding)}
                onChange={event => handleRangeInput(event, binding)}
                onWheel={event => handleMaterialRangeWheel(event, binding)}
              />
            </label>
          )}
        </For>
      </div>
    </div>
  );
}
