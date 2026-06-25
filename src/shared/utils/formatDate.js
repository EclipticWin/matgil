/**
 * Formats an ISO date string as a localized short date.
 * locale 'ko' → 'ko-KR', others → 'en-US'.
 * Example outputs: "2024년 3월 12일" / "Mar 12, 2024"
 */
export function formatSavedDate(iso, locale) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
