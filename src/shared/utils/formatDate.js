const INTL_LOCALE_BY_APP_LOCALE = {
  ko: 'ko-KR',
  'zh-CN': 'zh-CN',
};

/**
 * Formats an ISO date string as a localized short date.
 * locale 'ko' → 'ko-KR', 'zh-CN' → 'zh-CN', others → 'en-US'.
 * Example outputs: "2024년 3월 12일" / "2024年3月12日" / "Mar 12, 2024"
 */
export function formatSavedDate(iso, locale) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(INTL_LOCALE_BY_APP_LOCALE[locale] ?? 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
