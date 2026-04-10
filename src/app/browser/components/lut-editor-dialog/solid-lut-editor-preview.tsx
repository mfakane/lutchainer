import { For, type Accessor, type JSX } from 'solid-js';
import type { ColorRamp, ColorRamp2dLutData, ColorStop } from '../../../../features/lut-editor/lut-editor-model.ts';
import { colorToHex } from '../../../../features/pipeline/pipeline-model.ts';
import { cx } from '../../styles/cx.ts';
import * as ui from '../../styles/ui-primitives.css.ts';
import * as styles from './shared.css.ts';

interface LutEditorPreviewProps {
  tr: (key: string, values?: Record<string, string | number>) => string;
  rampData: Accessor<ColorRamp2dLutData | null>;
  selectedRampId: Accessor<string | null>;
  focusedStopId: Accessor<string | null>;
  previewCanvasRef: () => HTMLCanvasElement | undefined;
  setPreviewCanvasRef: (element: HTMLCanvasElement | undefined) => void;
  rampKnobStripRef: () => HTMLDivElement | undefined;
  setRampKnobStripRef: (element: HTMLDivElement | undefined) => void;
  stopKnobStripRef: () => HTMLDivElement | undefined;
  setStopKnobStripRef: (element: HTMLDivElement | undefined) => void;
  isRampBoundary: (rampId: string) => boolean;
  isStopBoundary: (stopId: string) => boolean;
  draggingRampDeleteId: Accessor<string | null>;
  draggingStopDeleteId: Accessor<string | null>;
  onCanvasClick: (event: MouseEvent) => void;
  onRampStripPointerDown: (event: PointerEvent) => void;
  onStopStripPointerDown: (event: PointerEvent) => void;
  onRampPointerDown: (rampId: string, event: PointerEvent) => void;
  onStopPointerDown: (stopId: string, event: PointerEvent) => void;
  onSelectRamp: (rampId: string) => void;
  onSelectStop: (stopId: string) => void;
  onAxisSwapChange: (swapped: boolean) => void;
}

export function LutEditorPreview(props: LutEditorPreviewProps): JSX.Element {
  const rampKnobClass = (ramp: ColorRamp): string => cx(
    styles.rampKnob,
    props.selectedRampId() === ramp.id && styles.selected,
    props.isRampBoundary(ramp.id) && styles.boundary,
    props.draggingRampDeleteId() === ramp.id && styles.pendingDeleteRamp,
  );

  const stopKnobClass = (stop: ColorStop): string => cx(
    styles.stopKnob,
    props.focusedStopId() === stop.id && styles.focused,
    props.isStopBoundary(stop.id) && styles.boundary,
    props.draggingStopDeleteId() === stop.id && styles.pendingDeleteStop,
  );

  return (
    <div class={styles.previewCol}>
      <div class={cx(styles.canvasArea, props.rampData()?.axisSwap && styles.axisSwapped)}>
        <div class={cx(styles.canvasWrap, ui.checkerBg)} onClick={props.onCanvasClick}>
          <canvas
            ref={element => props.setPreviewCanvasRef(element)}
            class={styles.canvas}
            width={props.rampData()?.width ?? 256}
            height={props.rampData()?.height ?? 256}
          />
        </div>

        <div
          class={styles.rampKnobStrip}
          ref={element => props.setRampKnobStripRef(element)}
          title={props.tr('lutEditor.rampRailHint')}
          onPointerDown={props.onRampStripPointerDown}
        >
          <For each={props.rampData()?.ramps ?? []}>
            {ramp => (
              <div
                class={rampKnobClass(ramp)}
                style={props.rampData()?.axisSwap ? { left: `${ramp.position * 100}%` } : { top: `${ramp.position * 100}%` }}
                onPointerDown={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  props.onSelectRamp(ramp.id);
                  props.onRampPointerDown(ramp.id, event);
                }}
              />
            )}
          </For>
        </div>

        <div
          class={styles.stopKnobStrip}
          ref={element => props.setStopKnobStripRef(element)}
          title={props.tr('lutEditor.stopRailHint')}
          onPointerDown={props.onStopStripPointerDown}
        >
          <For each={props.rampData()?.ramps.find(ramp => ramp.id === props.selectedRampId())?.stops ?? []}>
            {stop => (
              <div
                class={stopKnobClass(stop)}
                style={props.rampData()?.axisSwap
                  ? { top: `${stop.position * 100}%`, 'background-color': colorToHex(stop.color) }
                  : { left: `${stop.position * 100}%`, 'background-color': colorToHex(stop.color) }}
                onPointerDown={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  props.onSelectStop(stop.id);
                  props.onStopPointerDown(stop.id, event);
                }}
              />
            )}
          </For>
        </div>
      </div>

      <div class={styles.axisOptions}>
        <label class={styles.axisOption}>
          <input
            type="radio"
            name="lut-editor-axis"
            checked={!props.rampData()?.axisSwap}
            onChange={() => props.onAxisSwapChange(false)}
          />
          {props.tr('lutEditor.axisStopXRampY')}
        </label>
        <label class={styles.axisOption}>
          <input
            type="radio"
            name="lut-editor-axis"
            checked={!!props.rampData()?.axisSwap}
            onChange={() => props.onAxisSwapChange(true)}
          />
          {props.tr('lutEditor.axisRampXStopY')}
        </label>
      </div>
    </div>
  );
}
