import { For, type JSX } from 'solid-js';
import { t, useLanguage, type TranslationArgs, type TranslationKey } from '../../i18n.ts';
import { cx } from '../../styles/cx.ts';
import * as ui from '../../styles/ui-primitives.css.ts';
import type { PipelinePresetKey } from '../../ui/pipeline-presets.ts';
import * as styles from './shared.css.ts';
import type { StepWelcomeProps } from './shared.ts';

const WELCOME_EXAMPLES: PipelinePresetKey[] = ['StandardToon', 'HueShiftToon', 'HueSatShiftToon', 'Gradient', 'Plastic', 'Metallic'];
const GITHUB_URL = 'https://github.com/mfakane/lutchainer';
const BLENDER_ADDON_URL = 'https://github.com/mfakane/lutchainer/releases';

interface SolidStepWelcomeProps extends StepWelcomeProps {
  onStatus: (message: string, kind?: 'success' | 'error' | 'info') => void;
}

export function StepWelcome(props: SolidStepWelcomeProps): JSX.Element {
  const language = useLanguage();

  function tr<K extends TranslationKey>(key: K, ...args: TranslationArgs<K>): string {
    language();
    return t(key, ...args);
  }

  const handleLoadExample = async (example: PipelinePresetKey): Promise<void> => {
    try {
      await props.onLoadExample(example);
    } catch (error) {
      const message = error instanceof Error ? error.message : tr('common.unknownError');
      props.onStatus(tr('header.status.pipelineLoadFailed', { message }), 'error');
    }
  };

  return (
    <section data-step-empty="true" data-part="step-welcome">
      <div data-part="welcome-eyebrow">{tr('pipeline.welcome.eyebrow')}</div>
      <h2 data-part="welcome-title">{tr('pipeline.welcome.title')}</h2>
      <p data-part="welcome-copy">{tr('pipeline.welcome.description')}</p>

      <div data-part="welcome-actions">
        <button
          type="button"
          class={cx(ui.buttonBase, ui.secondaryButton)}
          onClick={props.onOpenPipelineFilePicker}
        >
          {tr('pipeline.welcome.load')}
        </button>
        <a
          class={cx(ui.buttonBase, ui.secondaryButton, styles.welcomeLinkButton)}
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
        >
          {tr('pipeline.welcome.github')}
        </a>
        <a
          class={cx(ui.buttonBase, ui.secondaryButton, styles.welcomeLinkButton)}
          href={BLENDER_ADDON_URL}
          target="_blank"
          rel="noreferrer"
        >
          {tr('pipeline.welcome.blenderAddon')}
        </a>
      </div>

      <div data-part="welcome-examples">
        <div data-part="welcome-section-title">{tr('pipeline.welcome.examplesTitle')}</div>
        <div data-part="welcome-example-list">
          <For each={WELCOME_EXAMPLES}>
            {example => (
              <button
                type="button"
                class={cx(ui.buttonBase, ui.smallActionButton)}
                onClick={() => {
                  void handleLoadExample(example);
                }}
              >
                {example}
              </button>
            )}
          </For>
        </div>
      </div>

      <p data-part="welcome-step-hint">{tr('pipeline.welcome.stepHint')}</p>
    </section>
  );
}
