import type { AppTranslator, StaticTranslationKey } from '../../../shared/i18n/browser-translation-contract.ts';

type TranslationTarget = {
  selector: string;
  key: StaticTranslationKey;
  attribute?: 'textContent' | 'aria-label';
};

interface SyncMainStaticLocaleTextOptions {
  getLanguage: () => string;
  t: AppTranslator;
}

const STATIC_TRANSLATION_TARGETS: TranslationTarget[] = [
  {
    selector: '#pipeline-help-text',
    key: 'static.pipelineHelp',
    attribute: 'textContent',
  },
  {
    selector: '#preview-help-text',
    key: 'static.previewHelp',
    attribute: 'textContent',
  },
  {
    selector: '#preview-layout-resizer',
    key: 'static.previewResizerAria',
    attribute: 'aria-label',
  },
  {
    selector: '#pipeline-file-drop-title',
    key: 'static.pipelineFileDropTitle',
    attribute: 'textContent',
  },
  {
    selector: '#pipeline-file-drop-description',
    key: 'static.pipelineFileDropDescription',
    attribute: 'textContent',
  },
];

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} must be a function.`);
  }
}

function ensureDocumentAvailable(): void {
  if (typeof document === 'undefined') {
    throw new Error('Document is not available in this environment.');
  }
}

function assertOptions(options: SyncMainStaticLocaleTextOptions): void {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('Main static locale sync options must be an object.');
  }

  ensureFunction(options.getLanguage, 'Main static locale sync getLanguage');
  ensureFunction(options.t, 'Main static locale sync t');
}

export function syncMainStaticLocaleText(options: SyncMainStaticLocaleTextOptions): void {
  assertOptions(options);
  ensureDocumentAvailable();

  const language = options.getLanguage();
  if (typeof language !== 'string' || language.trim().length === 0) {
    throw new Error('Main static locale sync getLanguage returned an invalid value.');
  }

  document.documentElement.setAttribute('lang', language);

  for (const target of STATIC_TRANSLATION_TARGETS) {
    const element = document.querySelector(target.selector);
    if (!element) {
      continue;
    }

    const translated = options.t(target.key);
    if (target.attribute === 'aria-label') {
      element.setAttribute('aria-label', translated);
      continue;
    }

    element.textContent = translated;
  }
}
