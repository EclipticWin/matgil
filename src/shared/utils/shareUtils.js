import { ROUTES } from '../constants/routes.js';

/** Absolute, shareable URL for a place's own page (`/places/:placeId`), honoring
 *  Vite's base path so it resolves correctly both in dev (`/`) and under GitHub
 *  Pages (`/matgil/`) without hardcoding a domain or deploy path. */
export function buildPlaceShareUrl(placeId) {
  const base = import.meta.env.BASE_URL ?? '/';
  const basename = base === '/' ? '' : base.replace(/\/$/, '');
  return `${window.location.origin}${basename}${ROUTES.placeDetail(placeId)}`;
}

/** Same as buildPlaceShareUrl but for a place's reviews page (`/places/:placeId/reviews`). */
export function buildPlaceReviewsShareUrl(placeId) {
  const base = import.meta.env.BASE_URL ?? '/';
  const basename = base === '/' ? '' : base.replace(/\/$/, '');
  return `${window.location.origin}${basename}${ROUTES.placeReviews(placeId)}`;
}

/** Tries the Web Share API first, falling back to a clipboard copy of `url`
 *  when unsupported or when the share itself fails (but not on a user-cancelled
 *  share, which is silent — no toast, no clipboard fallback). navigator.share()
 *  is reached with no `await` before it, so callers invoking this from a click
 *  handler still satisfy browsers that require Web Share to start synchronously
 *  within the gesture. Returns 'shared' | 'cancelled' | 'copied' | 'copyFailed'. */
export async function shareOrCopyLink({ url, title, text }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      console.warn('Web Share failed, falling back to clipboard copy', err);
    }
  }
  const copied = await copyToClipboard(url);
  return copied ? 'copied' : 'copyFailed';
}

/** Copies text to the clipboard, returning true/false instead of throwing —
 *  falls back to a legacy textarea+execCommand path for browsers/contexts
 *  without the async Clipboard API. */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy fallback below
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
