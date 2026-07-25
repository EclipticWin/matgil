import { ROUTES } from '../constants/routes.js';

/** Existing default post-login destination (unchanged) — used whenever no
 *  valid `returnTo` was carried into the login screen. */
export const DEFAULT_AFTER_LOGIN_PATH = ROUTES.my;

const OAUTH_RETURN_TO_KEY = 'matgil_oauth_return_to';

/** Open-redirect guard: only an app-internal relative path is ever accepted as
 *  a post-login return target — never an absolute/external URL, a
 *  protocol-relative URL (`//evil.example`), a backslash trick (`/\evil.example`,
 *  which some browsers normalize to `//`), or anything carrying a URL scheme
 *  (`javascript:`, `data:`, ...). */
export function isSafeInternalPath(path) {
  if (typeof path !== 'string' || path.length === 0) return false;
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//') || path.startsWith('/\\')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return false;
  return true;
}

/** App-relative path (no origin, no basename) built from a react-router
 *  location — this is what <Route path>/navigate() expect, since
 *  BrowserRouter's basename is applied automatically on both ends. */
export function buildReturnTo(location) {
  return `${location.pathname}${location.search}${location.hash}`;
}

/** Shared primitive behind every "go to login, remember where to come back"
 *  call — takes an already-resolved returnTo string rather than a live
 *  location, so a caller that captured returnTo earlier (e.g. the shared
 *  auth prompt, which captures it the moment it opens — see useAuthPrompt.jsx)
 *  can use the exact same navigation as goToLoginWithReturn() below without
 *  re-deriving it from whatever the current location happens to be by the
 *  time the login button is actually clicked. */
export function navigateToLogin(navigate, returnTo) {
  navigate(ROUTES.login, { state: { returnTo } });
}

/** Single entry point for every direct "log in required" click that has no
 *  intervening modal (page-level gates like CoursesPage's login button) —
 *  captures the current location at click time, since there's no delay
 *  between the click and the navigation here. */
export function goToLoginWithReturn(navigate, location) {
  navigateToLogin(navigate, buildReturnTo(location));
}

/** Resolves the path to land on after a successful login: the carried
 *  `returnTo` if it's a safe internal path, otherwise the existing default. */
export function resolveAfterLoginPath(returnTo) {
  return isSafeInternalPath(returnTo) ? returnTo : DEFAULT_AFTER_LOGIN_PATH;
}

/** OAuth (Google/Facebook) leaves the SPA entirely and comes back on a fresh
 *  page load, so react-router's location.state can't survive the round trip —
 *  bridge it through sessionStorage instead. Call this right before
 *  supabase.auth.signInWithOAuth(); consumeOAuthReturnTo() reads it back once
 *  (and removes it immediately) after the OAuth redirect lands. */
export function storeOAuthReturnTo(returnTo) {
  if (!isSafeInternalPath(returnTo)) return;
  try {
    sessionStorage.setItem(OAUTH_RETURN_TO_KEY, returnTo);
  } catch {
    // best-effort — worst case the OAuth login falls back to DEFAULT_AFTER_LOGIN_PATH
  }
}

/** Undoes storeOAuthReturnTo() — call this when the OAuth call itself fails
 *  synchronously (before the browser ever actually leaves the app), so a
 *  stored returnTo from an attempt that never really started doesn't sit in
 *  sessionStorage and get wrongly picked up by a later, unrelated sign-in
 *  (e.g. the user falls back to email/password login right after). */
export function clearOAuthReturnTo() {
  try {
    sessionStorage.removeItem(OAUTH_RETURN_TO_KEY);
  } catch {
    // best-effort
  }
}

/** Reads and immediately clears the pending OAuth return path, so it can
 *  never be replayed on a later, unrelated sign-in. */
export function consumeOAuthReturnTo() {
  let value = null;
  try {
    value = sessionStorage.getItem(OAUTH_RETURN_TO_KEY);
    if (value != null) sessionStorage.removeItem(OAUTH_RETURN_TO_KEY);
  } catch {
    return null;
  }
  return isSafeInternalPath(value) ? value : null;
}
