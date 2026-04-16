<svelte:options customElement={{ tag: 'lut-language-switcher', shadow: 'none' }} />

<script lang="ts">
  import { onDestroy } from 'svelte';
  import { getLanguage, getLanguageLabel, setLanguage, subscribeLanguageChange, t } from '../i18n.ts';
  import Button from './svelte-button.svelte';

  export let onStatus: (message: string, kind?: 'success' | 'error' | 'info') => void = () => undefined;

  type Language = 'ja' | 'en';

  let language: Language = getLanguage();
  const disposeLanguageSync = subscribeLanguageChange(nextLanguage => {
    language = nextLanguage;
  });

  function isLanguage(value: unknown): value is Language {
    return value === 'ja' || value === 'en';
  }

  function handleLanguageSelect(nextLanguage: unknown): void {
    if (!isLanguage(nextLanguage)) {
      onStatus(t('header.status.invalidLanguageSelection', { value: String(nextLanguage) }), 'error');
      return;
    }

    if (nextLanguage === language) {
      return;
    }

    setLanguage(nextLanguage);
  }

  function tr(key: Parameters<typeof t>[0], values?: Record<string, string | number>): string {
    language;
    return values ? t(key, values as never) : t(key);
  }

  onDestroy(() => {
    disposeLanguageSync();
  });
</script>

<div class="header-language-switcher" role="group" aria-label={tr('header.languageGroupAria')}>
  <Button
    type="button"
    variant="secondary"
    active={language === 'en'}
    className="language-button"
    id="btn-set-language-en"
    ariaLabel={tr('language.switchAria', { language: getLanguageLabel('en') })}
    ariaPressed={language === 'en' ? 'true' : 'false'}
    handlePress={() => handleLanguageSelect('en')}
  >en</Button>
  <Button
    type="button"
    variant="secondary"
    active={language === 'ja'}
    className="language-button"
    id="btn-set-language-ja"
    ariaLabel={tr('language.switchAria', { language: getLanguageLabel('ja') })}
    ariaPressed={language === 'ja' ? 'true' : 'false'}
    handlePress={() => handleLanguageSelect('ja')}
  >ja</Button>
</div>

<style>
  .header-language-switcher {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  :global(.button.language-button) {
    width: 32px;
    min-width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 999px;
    text-transform: lowercase;
  }
</style>
