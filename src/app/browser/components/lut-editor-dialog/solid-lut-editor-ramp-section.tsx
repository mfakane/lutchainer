import { For, Show, type Accessor, type JSX } from 'solid-js';
import { MAX_RAMPS, type ColorRamp, type ColorRamp2dLutData } from '../../../../features/lut-editor/lut-editor-model.ts';
import { cx } from '../../styles/cx.ts';
import * as ui from '../../styles/ui-primitives.css.ts';
import { DropdownMenu } from '../solid-dropdown-menu.tsx';
import * as styles from './shared.css.ts';
import { formatPositionPercent, scheduleSelectAllTextIfFocused } from './shared.ts';

interface LutEditorRampSectionProps {
  tr: (key: string, values?: Record<string, string | number>) => string;
  rampData: Accessor<ColorRamp2dLutData | null>;
  selectedRamp: Accessor<ColorRamp | null>;
  selectedRampId: Accessor<string | null>;
  draggingRampListIdx: Accessor<number | null>;
  showDropBefore: (idx: number) => boolean;
  showDropAfterLast: () => boolean;
  canRemoveRamp: (rampId: string) => boolean;
  rampSwatchStyle: (ramp: ColorRamp) => string;
  rampRowElMap: Map<string, HTMLElement>;
  editingRampPositionId: Accessor<string | null>;
  rampPositionDraft: Accessor<string>;
  rampPositionInputRef: () => HTMLInputElement | undefined;
  setRampPositionInputRef: (input: HTMLInputElement | undefined) => void;
  onAddRamp: () => void;
  onSelectRamp: (rampId: string) => void;
  onRemoveRamp: (rampId: string) => void;
  onDuplicateSelectedRamp: () => void;
  onInvertSelectedRamp: () => void;
  onStartRampListDrag: (rampIdx: number, event: PointerEvent) => void;
  didRampListDragOccur: () => boolean;
  onBeginRampPositionEdit: (rampId: string, position: number) => void;
  onRampPositionInput: (rampId: string, value: string) => void;
  onCommitRampPositionDraft: (rampId: string) => void;
  onCancelRampPositionDraft: (position: number) => void;
  onRampPositionWheel: (rampId: string, currentPosition: number, event: WheelEvent) => void;
}

export function LutEditorRampSection(props: LutEditorRampSectionProps): JSX.Element {
  return (
    <div class={styles.rampSection}>
      <div class={styles.sectionHeader}>
        <div class={styles.sectionLabel}>{props.tr('lutEditor.rampListLabel')}</div>
        <div class={styles.sectionHeaderActions}>
          <button
            type="button"
            class={cx(ui.buttonBase, ui.secondaryButton)}
            onClick={props.onAddRamp}
            disabled={!props.rampData() || (props.rampData()?.ramps.length ?? 0) >= MAX_RAMPS}
          >
            {props.tr('lutEditor.addRamp')}
          </button>
          <Show when={props.selectedRamp()}>
            <DropdownMenu
              wrapperClass={ui.menuWrap}
              triggerClass={cx(ui.buttonBase, ui.menuTrigger)}
              menuClass={cx(ui.menu, styles.kebabMenu)}
              triggerAriaLabel={props.tr('lutEditor.rampMenuAria')}
              menuRole="menu"
            >
              {controls => (
                <>
                  <button
                    type="button"
                    class={ui.menuItem}
                    role="menuitem"
                    disabled={(props.rampData()?.ramps.length ?? 0) >= MAX_RAMPS}
                    onClick={() => { controls.closeMenu(); props.onDuplicateSelectedRamp(); }}
                  >
                    {props.tr('lutEditor.duplicateRamp')}
                  </button>
                  <button type="button" class={ui.menuItem} role="menuitem" onClick={() => { controls.closeMenu(); props.onInvertSelectedRamp(); }}>
                    {props.tr('lutEditor.invertRamp')}
                  </button>
                </>
              )}
            </DropdownMenu>
          </Show>
        </div>
      </div>
      <div class={styles.rampList}>
        <For each={props.rampData()?.ramps ?? []}>
          {(ramp, getIdx) => (
            <>
              <Show when={props.showDropBefore(getIdx())}>
                <div class={styles.rampDropIndicator} />
              </Show>
              <div
                class={cx(styles.rampRow, props.selectedRampId() === ramp.id && styles.rampRowSelected, props.draggingRampListIdx() === getIdx() && styles.rampRowDragging)}
                ref={element => { props.rampRowElMap.set(ramp.id, element); }}
                onPointerDown={event => props.onStartRampListDrag(getIdx(), event)}
                onClick={() => { if (!props.didRampListDragOccur()) props.onSelectRamp(ramp.id); }}
              >
                <div class={styles.rampSwatch} style={props.rampSwatchStyle(ramp)} />
                <span class={styles.rampY}>{props.tr('lutEditor.rampPosition')}: {formatPositionPercent(ramp.position)}%</span>
                <Show when={props.canRemoveRamp(ramp.id)}>
                  <button type="button" class={cx(ui.buttonBase, ui.ghostButton, ui.removeText)} onClick={event => { event.stopPropagation(); props.onRemoveRamp(ramp.id); }}>
                    {props.tr('lutEditor.removeRamp')}
                  </button>
                </Show>
              </div>
            </>
          )}
        </For>
        <Show when={props.showDropAfterLast()}>
          <div class={styles.rampDropIndicator} />
        </Show>
      </div>
      <Show when={props.selectedRamp()}>
        {getSelectedRamp => (
          <div class={styles.rampPositionEditor}>
            <label class={styles.stopEditorLabel}>{props.tr('lutEditor.rampPosition')}</label>
            <input
              ref={input => props.setRampPositionInputRef(input)}
              type="text"
              inputmode="decimal"
              class={styles.posInput}
              value={props.editingRampPositionId() === getSelectedRamp().id ? props.rampPositionDraft() : formatPositionPercent(getSelectedRamp().position)}
              onFocusIn={() => {
                props.onBeginRampPositionEdit(getSelectedRamp().id, getSelectedRamp().position);
                scheduleSelectAllTextIfFocused(props.rampPositionInputRef());
              }}
              onInput={event => props.onRampPositionInput(getSelectedRamp().id, (event.currentTarget as HTMLInputElement).value)}
              onBlur={() => props.onCommitRampPositionDraft(getSelectedRamp().id)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  (event.currentTarget as HTMLInputElement).blur();
                } else if (event.key === 'Escape') {
                  props.onCancelRampPositionDraft(getSelectedRamp().position);
                  (event.currentTarget as HTMLInputElement).blur();
                }
              }}
              onWheel={event => props.onRampPositionWheel(getSelectedRamp().id, getSelectedRamp().position, event)}
            />
            <span class={styles.stopEditorUnit}>%</span>
          </div>
        )}
      </Show>
    </div>
  );
}
