function getSafeLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readTextFromLocalStorage(storageKey: string): string | null {
  if (typeof storageKey !== 'string' || storageKey.trim().length === 0) {
    throw new Error('Storage key must be a non-empty string.');
  }

  const storage = getSafeLocalStorage();
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(storageKey);
  } catch {
    return null;
  }
}

export function writeTextToLocalStorage(storageKey: string, value: string): void {
  if (typeof storageKey !== 'string' || storageKey.trim().length === 0) {
    throw new Error('Storage key must be a non-empty string.');
  }
  if (typeof value !== 'string') {
    throw new Error('Storage value must be a string.');
  }

  const storage = getSafeLocalStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(storageKey, value);
  } catch {
    // Ignore storage errors and keep in-memory state.
  }
}

export function readJsonFromLocalStorage(storageKey: string): unknown | null {
  const raw = readTextFromLocalStorage(storageKey);
  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeJsonToLocalStorage(storageKey: string, value: unknown): void {
  if (value === undefined) {
    throw new Error('Storage value cannot be undefined.');
  }

  writeTextToLocalStorage(storageKey, JSON.stringify(value));
}
