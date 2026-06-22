import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DICTIONARY } from './dictionary.js';
import { supabase } from '../../lib/supabase.js';

const LOCALE_KEY = 'matgil_locale';
const LocaleContext = createContext(null);

function resolvePath(obj, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc === undefined || acc === null) return undefined;
    return acc[key];
  }, obj);
}

function interpolate(str, params) {
  return str.replace(/\{(\w+)\}/g, (_, key) => (params[key] ?? `{${key}}`));
}

export function LocaleProvider({ children }) {
  // Init immediately from localStorage so there's no flash on reload
  const [locale, setLocaleState] = useState(
    () => localStorage.getItem(LOCALE_KEY) || 'en',
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          setLocaleState('en');
          localStorage.removeItem(LOCALE_KEY);
          return;
        }
        if (session) {
          // INITIAL_SESSION / SIGNED_IN / USER_UPDATED / TOKEN_REFRESHED with user
          const preferred = session.user?.user_metadata?.preferred_locale || 'en';
          setLocaleState(preferred);
          localStorage.setItem(LOCALE_KEY, preferred);
        } else {
          // INITIAL_SESSION with no session (not logged in)
          setLocaleState('en');
          localStorage.removeItem(LOCALE_KEY);
        }
      },
    );
    return () => subscription.unsubscribe();
  }, []);

  const setLocale = useCallback((code) => {
    setLocaleState(code);
    localStorage.setItem(LOCALE_KEY, code);
    // Non-blocking save to user_metadata (best-effort)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase.auth.updateUser({ data: { preferred_locale: code } }).catch(() => {});
      }
    });
  }, []);

  function t(key, params = {}) {
    const dict = DICTIONARY[locale] ?? DICTIONARY.en;
    let template = resolvePath(dict, key);
    if (template === undefined) template = resolvePath(DICTIONARY.en, key);
    if (template === undefined) return key;
    if (template === null) return null;
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
