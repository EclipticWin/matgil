import { createContext, useContext, useState } from 'react';
import { DICTIONARY } from './dictionary.js';

const LocaleContext = createContext(null);

/** Walk nested object by dot-separated key. Returns undefined when path is missing. */
function resolvePath(obj, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc === undefined || acc === null) return undefined;
    return acc[key];
  }, obj);
}

/** Replace {placeholder} tokens in a template string. */
function interpolate(str, params) {
  return str.replace(/\{(\w+)\}/g, (_, key) => (params[key] ?? `{${key}}`));
}

export function LocaleProvider({ children }) {
  const [locale, setLocale] = useState('en');

  /**
   * Translate a dot-separated dictionary key with optional {param} interpolation.
   * Falls back to en dictionary when locale key is missing.
   * Returns null when the value is explicitly null (e.g. gps.unsupported.body).
   * Returns the raw key string when the key is not found in either locale.
   */
  function t(key, params = {}) {
    const dict = DICTIONARY[locale] ?? DICTIONARY.en;
    let template = resolvePath(dict, key);

    // Try en fallback when locale entry is missing
    if (template === undefined) {
      template = resolvePath(DICTIONARY.en, key);
    }

    if (template === undefined) return key;   // key not found at all
    if (template === null) return null;        // explicit null (e.g. gps body)

    return typeof template === 'string' ? interpolate(template, params) : template;
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
