export interface SetupStaticLocaleSyncOptions {
  syncStaticLocaleText: () => void;
  subscribeLanguageChange: (listener: () => void) => () => void;
  windowTarget?: {
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => void;
  };
}

function ensureFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} が不正です。`);
  }
}

function ensureOptions(value: unknown): asserts value is SetupStaticLocaleSyncOptions {
  if (!value || typeof value !== 'object') {
    throw new Error('Static locale sync options が不正です。');
  }

  const options = value as Partial<SetupStaticLocaleSyncOptions>;
  ensureFunction(options.syncStaticLocaleText, 'Static locale sync: syncStaticLocaleText');
  ensureFunction(options.subscribeLanguageChange, 'Static locale sync: subscribeLanguageChange');

  if (options.windowTarget !== undefined) {
    const eventTarget = options.windowTarget;
    if (!eventTarget || typeof eventTarget !== 'object') {
      throw new Error('Static locale sync: windowTarget が不正です。');
    }

    const typedEventTarget = eventTarget as { addEventListener?: unknown };
    ensureFunction(typedEventTarget.addEventListener, 'Static locale sync: windowTarget.addEventListener');
  }
}

export function setupStaticLocaleSync(options: SetupStaticLocaleSyncOptions): void {
  ensureOptions(options);

  options.syncStaticLocaleText();
  const disposeLanguageSync = options.subscribeLanguageChange(() => {
    options.syncStaticLocaleText();
  });

  const windowTarget = options.windowTarget ?? window;
  windowTarget.addEventListener('beforeunload', () => {
    disposeLanguageSync();
  }, { once: true });
}
