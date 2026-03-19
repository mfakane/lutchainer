import { createSignal, onCleanup, type Accessor } from 'solid-js';

export type Language = 'ja' | 'en';

type TemplateValue = string | number;
type TemplateValues = Record<string, TemplateValue>;
type LanguageChangeListener = (language: Language) => void;

type TranslationMap = Record<string, string>;

const STORAGE_KEY = 'lutchainer.language';
const SUPPORTED_LANGUAGES: Language[] = ['ja', 'en'];

const LANGUAGE_LABELS: Record<Language, string> = {
  ja: '日本語',
  en: 'English',
};

const TRANSLATIONS: Record<Language, TranslationMap> = {
  ja: {
    'common.unknownError': '不明なエラー',
    'common.on': 'ON',
    'common.off': 'OFF',

    'language.switchAria': '{language} に切り替える',

    'header.reset': '初期化',
    'header.load': '読み込み',
    'header.save': '保存',
    'header.autoApply': '自動反映',
    'header.apply': '適用',
    'header.openCode': 'コードを開く',
    'header.switchLanguage': '言語: {language}',
    'header.languageGroupAria': '表示言語',
    'header.status.missingPipelineFileInput': 'パイプライン読込用の入力要素が見つかりません。',
    'header.status.pipelineSaveFailed': 'パイプライン保存に失敗しました: {message}',
    'header.status.pipelineInputMissing': 'パイプライン入力要素の取得に失敗しました。',
    'header.status.invalidSelectedFile': '読み込み対象ファイルが不正です。',
    'header.status.emptyFile': '空のファイルは読み込めません。',
    'header.status.pipelineLoadFailed': 'パイプライン読み込みに失敗しました: {message}',
    'header.status.autoApplyCheckboxMissing': '自動反映チェックボックスの取得に失敗しました。',
    'header.status.autoApplyCheckboxInvalid': '自動反映チェック状態が不正です。',
    'header.status.invalidAutoApplySyncValue': '自動反映の同期値が不正です: {value}',
    'header.status.invalidAutoApplyInputValue': '自動反映の入力値が不正です: {value}',
    'header.status.invalidAutoApplySyncArg': '自動反映同期の引数が不正です: {value}',
    'header.status.invalidLanguageSelection': '言語選択値が不正です: {value}',
    'header.status.languageChanged': '表示言語を {language} に切り替えました。',

    'static.pipelineHelp': '左ノードを選択して、各StepのX/Yソケットへ接続',
    'static.previewHelp': 'ドラッグ: 回転 / ホイール: ズーム',
  },
  en: {
    'common.unknownError': 'Unknown error',
    'common.on': 'ON',
    'common.off': 'OFF',

    'language.switchAria': 'Switch language to {language}',

    'header.reset': 'Reset',
    'header.load': 'Load',
    'header.save': 'Save',
    'header.autoApply': 'Auto Apply',
    'header.apply': 'Apply',
    'header.openCode': 'Open Code',
    'header.switchLanguage': 'Language: {language}',
    'header.languageGroupAria': 'Display language',
    'header.status.missingPipelineFileInput': 'Pipeline file input element was not found.',
    'header.status.pipelineSaveFailed': 'Failed to save pipeline: {message}',
    'header.status.pipelineInputMissing': 'Failed to get the pipeline input element.',
    'header.status.invalidSelectedFile': 'The selected file is invalid.',
    'header.status.emptyFile': 'Cannot load an empty file.',
    'header.status.pipelineLoadFailed': 'Failed to load pipeline: {message}',
    'header.status.autoApplyCheckboxMissing': 'Failed to get the auto-apply checkbox.',
    'header.status.autoApplyCheckboxInvalid': 'Auto-apply checkbox state is invalid.',
    'header.status.invalidAutoApplySyncValue': 'Invalid auto-apply sync value: {value}',
    'header.status.invalidAutoApplyInputValue': 'Invalid auto-apply input value: {value}',
    'header.status.invalidAutoApplySyncArg': 'Invalid auto-apply sync argument: {value}',
    'header.status.invalidLanguageSelection': 'Invalid language selection value: {value}',
    'header.status.languageChanged': 'Switched display language to {language}.',

    'static.pipelineHelp': 'Select a left node and connect it to each Step X/Y socket',
    'static.previewHelp': 'Drag: Rotate / Wheel: Zoom',
  },
};

const languageListeners = new Set<LanguageChangeListener>();
const [languageState, setLanguageState] = createSignal<Language>(resolveInitialLanguage());

function isLanguage(value: unknown): value is Language {
  return value === 'ja' || value === 'en';
}

function isTemplateValues(value: unknown): value is TemplateValues {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(candidate => typeof candidate === 'string' || Number.isFinite(candidate));
}

function normalizeLanguageTag(value: unknown): Language | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) {
    return null;
  }

  const primary = trimmed.split('-')[0];
  if (primary === 'ja' || primary === 'en') {
    return primary;
  }

  return null;
}

function readStoredLanguage(): Language | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeLanguageTag(raw);
  } catch {
    return null;
  }
}

function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') {
    return 'en';
  }

  const candidates: unknown[] = [];
  if (Array.isArray(navigator.languages)) {
    candidates.push(...navigator.languages);
  }
  candidates.push(navigator.language);

  for (const candidate of candidates) {
    const parsed = normalizeLanguageTag(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return 'en';
}

function resolveInitialLanguage(): Language {
  const stored = readStoredLanguage();
  if (stored) {
    return stored;
  }

  return detectBrowserLanguage();
}

function persistLanguage(language: Language): void {
  if (!isLanguage(language)) {
    throw new Error(`Invalid language to persist: ${String(language)}`);
  }

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Ignore storage errors and keep in-memory language state.
  }
}

function notifyLanguageListeners(language: Language): void {
  for (const listener of languageListeners) {
    listener(language);
  }
}

function formatTemplate(template: string, values?: TemplateValues): string {
  if (typeof template !== 'string') {
    throw new Error('formatTemplate: template must be a string.');
  }

  if (values === undefined) {
    return template;
  }

  if (!isTemplateValues(values)) {
    throw new Error('formatTemplate: values must be a plain object of string/number values.');
  }

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
    const replacement = values[key];
    if (replacement === undefined) {
      return `{${key}}`;
    }
    return String(replacement);
  });
}

function ensureSupportedLanguage(language: unknown): asserts language is Language {
  if (!isLanguage(language)) {
    throw new Error(`Unsupported language: ${String(language)}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
  }
}

export function getLanguage(): Language {
  return languageState();
}

export function setLanguage(language: unknown): Language {
  ensureSupportedLanguage(language);

  if (languageState() === language) {
    return languageState();
  }

  setLanguageState(language);
  persistLanguage(language);
  notifyLanguageListeners(language);
  return language;
}

export function toggleLanguage(): Language {
  const next: Language = getLanguage() === 'ja' ? 'en' : 'ja';
  return setLanguage(next);
}

export function getLanguageLabel(language: unknown, displayLanguage: unknown = getLanguage()): string {
  ensureSupportedLanguage(language);
  ensureSupportedLanguage(displayLanguage);
  return LANGUAGE_LABELS[language];
}

export function t(key: unknown, values?: TemplateValues): string {
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new Error(`Invalid translation key: ${String(key)}`);
  }

  const currentLanguage = getLanguage();
  const template = TRANSLATIONS[currentLanguage][key] ?? TRANSLATIONS.en[key] ?? key;
  return formatTemplate(template, values);
}

export function subscribeLanguageChange(listener: unknown): () => void {
  if (typeof listener !== 'function') {
    throw new Error('subscribeLanguageChange: listener must be a function.');
  }

  const typedListener = listener as LanguageChangeListener;
  languageListeners.add(typedListener);

  return () => {
    languageListeners.delete(typedListener);
  };
}

export function useLanguage(): Accessor<Language> {
  const [language, setLanguageSignal] = createSignal<Language>(getLanguage());
  const dispose = subscribeLanguageChange((nextLanguage: Language) => {
    setLanguageSignal(nextLanguage);
  });

  onCleanup(dispose);
  return language;
}
