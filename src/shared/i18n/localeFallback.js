/** Shared locale fallback policy — the single place that decides "if the
 *  current locale's value is missing, what do we show instead?" for every
 *  translated field/label/template in the app (place text, category labels,
 *  phrase text, course titles, location names, ...).
 *
 *  Before this file existed, that decision was duplicated as
 *  `locale === 'ko' ? a : locale === 'zh-CN' ? b : c` in a dozen different
 *  components. Adding a new locale (e.g. 'ja') meant hunting down every one of
 *  those conditionals. Now it means adding one line to LOCALE_FALLBACKS below —
 *  callers never branch on `locale` themselves, they just describe what they
 *  have per locale and ask pickTranslated()/pickTranslatedRow() to resolve it. */

export const SUPPORTED_LOCALES = ['ko', 'en', 'zh-CN'];

/** locale -> ordered list of locales to try, starting with itself.
 *  Deliberately NOT symmetric: ko/en only ever fall back to each other
 *  (unchanged 2-locale behavior from before zh-CN existed), while zh-CN falls
 *  through to en and then ko, since zh-CN data is the newest/sparsest. */
const LOCALE_FALLBACKS = {
  ko: ['ko', 'en'],
  en: ['en', 'ko'],
  'zh-CN': ['zh-CN', 'en', 'ko'],
};

/** Any locale not explicitly listed above (e.g. a future 'ja' before it gets
 *  its own LOCALE_FALLBACKS entry) falls back to itself, then en, then ko —
 *  the same shape zh-CN uses, so a new locale works reasonably out of the box
 *  even before anyone tunes its exact fallback order. */
export function getLocaleChain(locale) {
  return LOCALE_FALLBACKS[locale] ?? [locale, 'en', 'ko'];
}

/** Picks the first defined (non-null/undefined) value from `fieldsByLocale`
 *  (a plain object keyed by locale, e.g. { ko: cat.labelKo, en: cat.label,
 *  'zh-CN': cat.labelZh }) by walking getLocaleChain(locale). Returns
 *  `undefined` if the current locale has no such field. Replaces the
 *  `locale === 'ko' ? A : locale === 'zh-CN' ? B : C` shape everywhere it
 *  appeared: `pickTranslated({ ko: A, en: C, 'zh-CN': B }, locale)`. */
export function pickTranslated(fieldsByLocale, locale) {
  for (const loc of getLocaleChain(locale)) {
    const value = fieldsByLocale[loc];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

/** Same idea as pickTranslated(), but over an array of locale-tagged rows
 *  (e.g. mg_place_texts rows: [{ locale, name, address, ... }, ...]) instead
 *  of a single field per locale. Returns the first matching row (not a single
 *  field), or `undefined` if none of the chain's locales are present. */
export function pickTranslatedRow(rows, locale, localeKey = 'locale') {
  if (!rows || rows.length === 0) return undefined;
  const byLocale = new Map(rows.map((row) => [row[localeKey], row]));
  for (const loc of getLocaleChain(locale)) {
    if (byLocale.has(loc)) return byLocale.get(loc);
  }
  return undefined;
}
