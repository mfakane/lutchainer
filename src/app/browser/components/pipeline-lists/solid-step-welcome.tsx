import { For, type JSX } from 'solid-js';
import { t, useLanguage } from '../../i18n.ts';
import { cx } from '../../styles/cx.ts';
import * as ui from '../../styles/ui-primitives.css.ts';
import type { PipelinePresetKey } from '../../ui/pipeline-presets.ts';
import * as styles from './shared.css.ts';
import type { StepWelcomeProps } from './shared.ts';

interface SolidStepWelcomeProps extends StepWelcomeProps {
  onStatus: (message: string, kind?: 'success' | 'error' | 'info') => void;
}

export function StepWelcome(props: SolidStepWelcomeProps): JSX.Element {
  const language = useLanguage();

  const tr = (key: string, values?: Record<string, string | number>): string => {
    language();
    return t(key, values);
  };

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
          href={props.welcomeGithubUrl}
          target="_blank"
          rel="noreferrer"
        >
          {tr('pipeline.welcome.github')}
        </a>
      </div>

      <div data-part="welcome-examples">
        <div data-part="welcome-section-title">{tr('pipeline.welcome.examplesTitle')}</div>
        <div data-part="welcome-example-list">
          <For each={props.welcomeExamples}>
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
