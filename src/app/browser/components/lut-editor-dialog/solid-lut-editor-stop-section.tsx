import { For, Show, type Accessor, type JSX } from 'solid-js';
import { MAX_STOPS_PER_RAMP, type ColorRamp, type ColorStop } from '../../../../features/lut-editor/lut-editor-model.ts';
import { colorToHex } from '../../../../features/pipeline/pipeline-model.ts';
import { cx } from '../../styles/cx.ts';
import * as ui from '../../styles/ui-primitives.css.ts';
import { DropdownMenu } from '../solid-dropdown-menu.tsx';
import * as styles from './shared.css.ts';
import { formatPositionPercent, scheduleSelectAllTextIfFocused } from './shared.ts';

interface LutEditorStopSectionProps {
  tr: (key: string, values?: Record<string, string | number>) => string;
  selectedRamp: Accessor<ColorRamp | null>;
  focusedStop: Accessor<ColorStop | null>;
  stopKnobPlacements: Accessor<Map<string, 'below' | 'above'>>;
  stopPreviewBarRef: () => HTMLDivElement | undefined;
  setStopPreviewBarRef: (element: HTMLDivElement | undefined) => void;
  editingStopPositionId: Accessor<string | null>;
  stopPositionDraft: Accessor<string>;
  stopPositionInputRef: () => HTMLInputElement | undefined;
  setStopPositionInputRef: (input: HTMLInputElement | undefined) => void;
  isStopBoundary: (stopId: string) => boolean;
  onAddStop: () => void;
  onRemoveStop: (stopId: string) => void;
  onDuplicateFocusedStop: () => void;
  onInvertFocusedStop: () => void;
  onSelectStop: (stopId: string) => void;
  onPreviewStopPointerDown: (stopId: string, event: PointerEvent) => void;
  onStopColorChange: (stopId: string, hexValue: string) => void;
  onStopAlphaChange: (stopId: string, value: string) => void;
  onBeginStopPositionEdit: (stopId: string, position: number) => void;
  onStopPositionInput: (stopId: string, value: string) => void;
  onCommitStopPositionDraft: (stopId: string) => void;
  onCancelStopPositionDraft: (position: number) => void;
  onStopPositionWheel: (stopId: string, position: number, event: WheelEvent) => void;
  onStopAlphaWheel: (stopId: string, alpha: number, event: WheelEvent) => void;
  rampSwatchStyle: (ramp: ColorRamp) => string;
}

export function LutEditorStopSection(props: LutEditorStopSectionProps): JSX.Element {
  const previewStopKnobClass = (stop: ColorStop): string => {
    const placement = props.stopKnobPlacements().get(stop.id) ?? 'below';
    return cx(
      styles.previewStopKnob,
      placement === 'above' && styles.above,
      props.focusedStop()?.id === stop.id && styles.focused,
      props.isStopBoundary(stop.id) && styles.boundary,
    );
  };

  return (
    <div class={styles.stopSection}>
      <div class={styles.sectionHeader}>
        <div class={styles.sectionLabel}>{props.tr('lutEditor.stopEditorLabel')}</div>
        <div class={styles.sectionHeaderActions}>
          <button
            type="button"
            class={cx(ui.buttonBase, ui.secondaryButton)}
            onClick={props.onAddStop}
            disabled={!props.selectedRamp() || (props.selectedRamp()?.stops.length ?? 0) >= MAX_STOPS_PER_RAMP}
          >
            {props.tr('lutEditor.addStop')}
          </button>
          <Show when={props.focusedStop() && !props.isStopBoundary(props.focusedStop()!.id)}>
            <button type="button" class={cx(ui.buttonBase, ui.ghostButton, ui.removeText)} onClick={() => { const stop = props.focusedStop(); if (stop) props.onRemoveStop(stop.id); }}>
              {props.tr('lutEditor.removeStop')}
            </button>
          </Show>
          <Show when={props.focusedStop()}>
            <DropdownMenu
              wrapperClass={ui.menuWrap}
              triggerClass={cx(ui.buttonBase, ui.menuTrigger)}
              menuClass={cx(ui.menu, styles.kebabMenu)}
              triggerAriaLabel={props.tr('lutEditor.stopMenuAria')}
              menuRole="menu"
            >
              {controls => (
                <>
                  <button
                    type="button"
                    class={ui.menuItem}
                    role="menuitem"
                    disabled={(props.selectedRamp()?.stops.length ?? 0) >= MAX_STOPS_PER_RAMP}
                    onClick={() => { controls.closeMenu(); props.onDuplicateFocusedStop(); }}
                  >
                    {props.tr('lutEditor.duplicateStop')}
                  </button>
                  <button type="button" class={ui.menuItem} role="menuitem" onClick={() => { controls.closeMenu(); props.onInvertFocusedStop(); }}>
                    {props.tr('lutEditor.invertStop')}
                  </button>
                </>
              )}
            </DropdownMenu>
          </Show>
        </div>
      </div>

      <Show when={props.selectedRamp()}>
        {getSelectedRamp => (
          <div class={styles.stopPreviewArea}>
            <div class={styles.stopPreview} ref={element => props.setStopPreviewBarRef(element as HTMLDivElement)} style={props.rampSwatchStyle(getSelectedRamp())}>
              <For each={getSelectedRamp().stops}>
                {stop => (
                  <div
                    class={previewStopKnobClass(stop)}
                    style={{ left: `${stop.position * 100}%`, 'background-color': colorToHex(stop.color) }}
                    onPointerDown={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      props.onSelectStop(stop.id);
                      props.onPreviewStopPointerDown(stop.id, event);
                    }}
                  />
                )}
              </For>
            </div>
          </div>
        )}
      </Show>

      <Show when={props.focusedStop()} fallback={<div class={styles.noRamp}>{props.tr('lutEditor.noStopSelected')}</div>}>
        {getStop => (
          <div class={styles.stopEditor}>
            <div class={styles.stopEditorField}>
              <label class={styles.stopEditorLabel}>{props.tr('lutEditor.stopColor')}</label>
              <input type="color" class={styles.stopColorInput} value={colorToHex(getStop().color)} onInput={event => props.onStopColorChange(getStop().id, (event.currentTarget as HTMLInputElement).value)} />
            </div>
            <div class={styles.stopEditorField}>
              <label class={styles.stopEditorLabel}>{props.tr('lutEditor.stopPosition')}</label>
              <input
                ref={input => props.setStopPositionInputRef(input)}
                type="text"
                inputmode="decimal"
                class={styles.posInput}
                value={props.editingStopPositionId() === getStop().id ? props.stopPositionDraft() : formatPositionPercent(getStop().position)}
                onFocusIn={() => {
                  props.onBeginStopPositionEdit(getStop().id, getStop().position);
                  scheduleSelectAllTextIfFocused(props.stopPositionInputRef());
                }}
                onInput={event => props.onStopPositionInput(getStop().id, (event.currentTarget as HTMLInputElement).value)}
                onBlur={() => props.onCommitStopPositionDraft(getStop().id)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    (event.currentTarget as HTMLInputElement).blur();
                  } else if (event.key === 'Escape') {
                    props.onCancelStopPositionDraft(getStop().position);
                    (event.currentTarget as HTMLInputElement).blur();
                  }
                }}
                onWheel={event => props.onStopPositionWheel(getStop().id, getStop().position, event)}
              />
              <span class={styles.stopEditorUnit}>%</span>
            </div>
            <div class={styles.stopEditorField}>
              <label class={styles.stopEditorLabel}>{props.tr('lutEditor.alpha')}</label>
              <input
                type="range"
                class={styles.stopAlphaInput}
                min="0"
                max="100"
                value={Math.round(getStop().alpha * 100)}
                onInput={event => props.onStopAlphaChange(getStop().id, (event.currentTarget as HTMLInputElement).value)}
                onWheel={event => props.onStopAlphaWheel(getStop().id, getStop().alpha, event)}
              />
              <span class={styles.stopEditorUnit}>{Math.round(getStop().alpha * 100)}%</span>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
