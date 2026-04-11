export type TranslationValue = string | number;

export type TranslationValues = Record<string, TranslationValue>;

export type TranslationArgs<
  TKey extends PropertyKey,
  TParams,
> = TKey extends keyof TParams
  ? TParams[TKey] extends TranslationValues
    ? [values: TParams[TKey]]
    : []
  : [];

export type Translator<
  TKey extends PropertyKey,
  TParams,
> = <K extends TKey>(key: K, ...args: TranslationArgs<K, TParams>) => string;
