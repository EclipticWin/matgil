import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const AuthPromptContext = createContext(null);

/** App-wide "please log in" prompt state — every login-required entry point
 *  (place bookmark/review, course save, phrase bookmark, community post/like,
 *  ...) calls openAuthPrompt() instead of rendering its own modal instance, so
 *  there is exactly one <AuthRequiredModal/> in the whole app (mounted once in
 *  App.jsx, above the route tree — see its own doc comment for why). Only the
 *  dictionary key for the body copy and the returnTo path are kept here —
 *  never a place/course object or "what to do after login" action, so nothing
 *  here can auto-run a like/bookmark/post once the user signs back in.
 *
 *  `returnTo` is captured by the caller (via buildReturnTo(useLocation()))
 *  at the moment openAuthPrompt() is called — i.e. the instant the user
 *  clicked the heart/post/save button — not re-derived later when the
 *  modal's login button is actually clicked. The modal itself is mounted at
 *  the App root regardless of route, so if it re-read the "current" location
 *  at click time, any navigation that happened while it sat open (e.g. a
 *  browser back/forward) would leak into returnTo instead of the screen the
 *  prompt was actually opened from. */
export function AuthPromptProvider({ children }) {
  const [prompt, setPrompt] = useState(null); // null | { messageKey, returnTo }

  const openAuthPrompt = useCallback(({ messageKey, returnTo }) => {
    setPrompt({ messageKey, returnTo });
  }, []);

  const closeAuthPrompt = useCallback(() => setPrompt(null), []);

  const value = useMemo(
    () => ({ prompt, openAuthPrompt, closeAuthPrompt }),
    [prompt, openAuthPrompt, closeAuthPrompt],
  );

  return <AuthPromptContext.Provider value={value}>{children}</AuthPromptContext.Provider>;
}

export function useAuthPrompt() {
  const ctx = useContext(AuthPromptContext);
  if (!ctx) throw new Error('useAuthPrompt must be used within an AuthPromptProvider');
  return ctx;
}
