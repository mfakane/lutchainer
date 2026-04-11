import type { JSX } from 'solid-js';
import * as pipelineModel from '../../../../features/pipeline/pipeline-model.ts';
import { t, useLanguage, type TranslationArgs, type TranslationKey } from '../../i18n.ts';
import { cx } from '../../styles/cx.ts';
import * as ui from '../../styles/ui-primitives.css.ts';
import * as styles from './shared.css.ts';
import type { CustomParamNodeProps } from './shared.ts';
import { stopPointerPropagation } from './shared.ts';

export function CustomParamNode(props: CustomParamNodeProps): JSX.Element {
  const language = useLanguage();

  function tr<K extends TranslationKey>(key: K, ...args: TranslationArgs<K>): string {
    language();
    return t(key, ...args);
  }

  const handleValueSliderInput = (event: InputEvent): void => {
    const target = event.currentTarget as HTMLInputElement;
    const nextValue = Number(target.value);
    props.onSetCustomParamValue(props.customParam().id, nextValue, { recordHistory: false });
  };

  const handleValueSliderChange = (): void => {
    props.onCommitCustomParamValueChange();
  };

  const handleValueSliderWheel = (event: WheelEvent): void => {
    const delta = event.deltaY < 0 ? 0.01 : -0.01;
    const nextValue = Math.max(0, Math.min(1, props.customParam().defaultValue + delta));
    props.onSetCustomParamValue(props.customParam().id, nextValue);
    event.preventDefault();
  };

  return (
    <div
      class={ui.buttonBase}
      data-param-id={props.customParam().id}
      data-param={pipelineModel.buildCustomParamRef(props.customParam().id)}
      data-param-socket="true"
      data-custom-param-item="true"
      aria-label={`Connect ${props.customParam().label}`}
      title={`Connect ${props.customParam().label}`}
    >
      <span data-part="socket-dot" aria-hidden="true"></span>
      <div data-part="custom-param-header" data-socket-drag-ignore="true">
        <button
          type="button"
          class={ui.ghostButton}
          data-socket-drag-ignore="true"
          data-custom-param-handle="true"
          draggable={true}
          aria-label={`Reorder ${props.customParam().label}`}
          onPointerDown={stopPointerPropagation}
        >
          <span data-part="custom-param-grip" aria-hidden="true"></span>
        </button>
        <input
          class={cx(ui.editableTextInput, styles.customParamInput)}
          data-socket-drag-ignore="true"
          value={props.customParam().label}
          maxLength={pipelineModel.MAX_CUSTOM_PARAM_LABEL_LENGTH}
          aria-label={`Custom param label ${props.customParam().id}`}
          onBlur={event => props.onRenameCustomParam(props.customParam().id, event.currentTarget.value)}
        />
        <button
          type="button"
          class={cx(ui.buttonBase, ui.smallActionButton, ui.removeText)}
          data-socket-drag-ignore="true"
          onClick={() => props.onRemoveCustomParam(props.customParam().id)}
        >
          {tr('pipeline.param.remove')}
        </button>
      </div>
      <div data-part="custom-param-meta">
        <span data-part="param-desc">{`u_param_${props.customParam().id}`}</span>
      </div>
      <div data-part="custom-param-slider-row" data-socket-drag-ignore="true">
        <input
          type="range"
          class={ui.rangeInput}
          data-socket-drag-ignore="true"
          min="0"
          max="1"
          step="0.01"
          value={String(props.customParam().defaultValue)}
          onInput={handleValueSliderInput}
          onChange={handleValueSliderChange}
          onWheel={handleValueSliderWheel}
        />
        <span data-part="custom-param-value">{props.customParam().defaultValue.toFixed(2)}</span>
      </div>
    </div>
  );
}
