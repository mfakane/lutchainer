import { For, Show, type JSX } from 'solid-js';
import { t, useLanguage } from '../../i18n.ts';
import { cx } from '../../styles/cx.ts';
import * as ui from '../../styles/ui-primitives.css.ts';
import { DropdownMenu } from '../solid-dropdown-menu.tsx';
import * as styles from './shared.css.ts';
import type { LutStripListProps } from './shared.ts';
import { isNonEmptyString } from './shared.ts';

export function LutStripList(props: LutStripListProps): JSX.Element {
  let fileInputRef: HTMLInputElement | null = null;
  const language = useLanguage();

  const tr = (key: string, values?: Record<string, string | number>): string => {
    language();
    return t(key, values);
  };

  const usageCount = (lutId: string): number => props.steps().reduce((count, step) => (step.lutId === lutId ? count + 1 : count), 0);

  const handleRemoveLut = (lutId: string): void => {
    if (!isNonEmptyString(lutId)) {
      props.onStatus(tr('pipeline.lut.invalidId'), 'error');
      return;
    }
    props.onRemoveLut(lutId);
  };

  const openFilePicker = (): void => {
    if (!fileInputRef) {
      props.onStatus(tr('pipeline.lut.fileInputMissing'), 'error');
      return;
    }
    fileInputRef.click();
  };

  const handleFileInputChange = async (event: Event): Promise<void> => {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) {
      props.onStatus(tr('pipeline.lut.fileInputFetchFailed'), 'error');
      return;
    }

    const rawFiles = input.files;
    if (!rawFiles || rawFiles.length === 0) {
      input.value = '';
      return;
    }

    const files = Array.from(rawFiles);
    if (files.some(file => !(file instanceof File))) {
      props.onStatus(tr('pipeline.lut.fileInputInvalidValue'), 'error');
      input.value = '';
      return;
    }

    try {
      await props.onAddLutFiles(files);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.unknownError');
      props.onStatus(tr('pipeline.lut.addFailed', { message }), 'error');
    } finally {
      input.value = '';
    }
  };

  return (
    <div class={styles.lutRoot}>
      <Show when={props.luts().length > 0} fallback={<div data-lut-empty="true">{tr('pipeline.lut.empty')}</div>}>
        <For each={props.luts()}>
          {lut => (
            <article data-lut-item="true" draggable={true} data-lut-id={lut.id}>
              <div class={ui.checkerBg} data-part="lut-thumb-wrap">
                <img data-part="lut-thumb" src={lut.thumbUrl} alt={`${lut.name} thumbnail`} loading="lazy" />
              </div>
              <div data-part="lut-meta">
                <div data-part="lut-name">{lut.name}</div>
                <div data-part="lut-stats">{tr('pipeline.lut.stats', { width: lut.width, height: lut.height, count: usageCount(lut.id) })}</div>
                <div data-part="lut-actions">
                  <Show
                    when={lut.ramp2dData}
                    fallback={
                      <button
                        type="button"
                        class={cx(ui.buttonBase, ui.smallActionButton, ui.removeText)}
                        data-lut-id={lut.id}
                        data-lut-remove="true"
                        aria-label={tr('pipeline.lut.removeAria', { name: lut.name })}
                        onClick={() => handleRemoveLut(lut.id)}
                      >
                        {tr('pipeline.step.remove')}
                      </button>
                    }
                  >
                    <DropdownMenu
                      wrapperClass={ui.menuWrap}
                      triggerClass={cx(ui.buttonBase, ui.secondaryButton, styles.lutKebabTrigger)}
                      menuClass={cx(ui.menu, styles.lutMenu)}
                      triggerAriaLabel={tr('pipeline.lut.kebabAria', { name: lut.name })}
                      menuRole="menu"
                      floating={true}
                    >
                      {controls => (
                        <>
                          <button type="button" class={ui.menuItem} role="menuitem" onClick={() => { controls.closeMenu(); props.onEditLut?.(lut.id); }}>
                            {tr('pipeline.lut.edit')}
                          </button>
                          <button type="button" class={ui.menuItem} role="menuitem" onClick={() => { controls.closeMenu(); props.onDuplicateLut?.(lut.id); }}>
                            {tr('pipeline.lut.duplicate')}
                          </button>
                          <button type="button" class={cx(ui.menuItem, ui.removeText)} role="menuitem" onClick={() => { controls.closeMenu(); handleRemoveLut(lut.id); }}>
                            {tr('pipeline.step.remove')}
                          </button>
                        </>
                      )}
                    </DropdownMenu>
                  </Show>
                </div>
              </div>
            </article>
          )}
        </For>
        <Show
          when={props.onNewLut}
          fallback={
            <div data-part="lut-add-item" onClick={openFilePicker} title={tr('pipeline.lut.add')}>
              <button type="button" class={ui.ghostButton}>{tr('pipeline.lut.add')}</button>
            </div>
          }
        >
          <div data-part="lut-add-item">
            <button type="button" data-part="lut-add-new" aria-label={tr('lutEditor.newLutAria')} onClick={props.onNewLut}>
              {tr('lutEditor.newLut')}
            </button>
            <button type="button" data-part="lut-add-browse" aria-label={tr('pipeline.lut.browseAria')} onClick={openFilePicker}>
              {tr('pipeline.lut.browse')}
            </button>
          </div>
        </Show>
      </Show>
      <input
        ref={element => {
          fileInputRef = element;
        }}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={event => void handleFileInputChange(event)}
      />
    </div>
  );
}
