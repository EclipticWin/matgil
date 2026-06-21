/** Returns a relative time string for < 2 days, or YYYY.MM.DD HH:mm for older dates. */
export function formatRelativeOrAbsolute(isoStr) {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 2880) {
    if (mins < 60) return `${Math.max(1, mins)}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    return `${Math.floor(mins / 1440)}d`;
  }
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}.${mo}.${d} ${h}:${mi}`;
}
