import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';

const AuthContext = createContext(null);

/** Wraps a raw Supabase auth user into the shape the app uses. Nickname comes only
 *  from user_metadata.display_name — never derived from the email or a generic
 *  placeholder ("Traveller" etc). `name` is null when display_name isn't set yet;
 *  use `resolveUser` (not this directly) whenever that might be the case, so a real
 *  guaranteed-unique nickname gets backfilled before the user is exposed to the app. */
function normalizeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.user_metadata?.display_name || null,
  };
}

// Coalesces concurrent set_my_nickname(null) calls for the same user id into a single
// in-flight request. Without this, a fresh signup with no chosen nickname reliably has
// two near-simultaneous callers (the post-signup resolution and the SIGNED_IN auth
// event's own resolution) that both try to insert the same brand-new profile row — the
// loser's INSERT collides on the mg_user_profiles primary key (user_id), which the RPC's
// retry loop can't distinguish from "this random nickname is taken" and keeps retrying
// with fresh random values that hit the very same conflict every time, eventually giving
// up. A shared in-flight promise per user id means only one such call ever happens.
const ensureNicknamePromises = new Map(); // userId -> Promise<{ nickname, generated } | undefined>

function ensureNicknameOnce(userId) {
  let promise = ensureNicknamePromises.get(userId);
  if (!promise) {
    promise = supabase.rpc('set_my_nickname', { p_preferred_nickname: null })
      .then(({ data, error }) => {
        if (error) throw error;
        return Array.isArray(data) ? data[0] : data;
      })
      .finally(() => ensureNicknamePromises.delete(userId));
    ensureNicknamePromises.set(userId, promise);
  }
  return promise;
}

/** Ensures the given Supabase auth user has a nickname before it's handed to the rest
 *  of the app. Fast path: the cached user object already carries a display_name (true
 *  for everyone past their first session) — no round trip. Slow path (first session
 *  ever, or a legacy pre-migration account with no mg_user_profiles row yet): calls the
 *  idempotent set_my_nickname RPC (deduped via ensureNicknameOnce) and uses its result —
 *  never a session refresh or any other stale metadata snapshot — as the final nickname. */
async function resolveUser(supabaseUser) {
  if (!supabaseUser) return null;
  const cached = normalizeUser(supabaseUser);
  if (cached.name) return cached;

  try {
    const row = await ensureNicknameOnce(supabaseUser.id);
    const resolved = { ...cached, name: row?.nickname ?? null };
    if (resolved.name) {
      // Best-effort: refresh the cached session so a future page load's getSession()
      // already carries this nickname in its metadata and can skip the RPC entirely.
      // The nickname already resolved above is used regardless of what this returns.
      supabase.auth.refreshSession().catch(() => {});
    }
    return resolved;
  } catch {
    return cached; // best-effort — leaves name null; the next session event retries
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Mirrors `user` synchronously (state updates aren't readable mid-render) so the
  // onAuthStateChange listener below can tell "this account already has a resolved
  // nickname in this tab" without waiting for a re-render.
  const userRef = useRef(null);

  const applyUser = useCallback((next) => {
    userRef.current = next;
    setUser(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const resolved = await resolveUser(session?.user ?? null);
      if (!cancelled) {
        applyUser(resolved);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const sUser = session?.user ?? null;
      if (!sUser) { applyUser(null); return; }
      // Already resolved this exact account with a real nickname in this tab (e.g. we
      // just signed up or changed the nickname moments ago) — skip re-deriving from this
      // event's own (possibly stale-cached) metadata snapshot, which would otherwise
      // clobber the fresher value with a null/stale one.
      if (userRef.current?.id === sUser.id && userRef.current?.name) return;
      resolveUser(sUser).then((resolved) => {
        if (!cancelled) applyUser(resolved);
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applyUser]);

  const login = useCallback(async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // The actual context `user` state is set by the SIGNED_IN event this triggers
    // (via onAuthStateChange above) — this return value is a best-effort shape for
    // callers that want it immediately, not the source of truth.
    return normalizeUser(data.user);
  }, []);

  const signUp = useCallback(async ({ email, password, displayName }) => {
    const trimmedName = displayName?.trim() || null;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: trimmedName ? { data: { display_name: trimmedName } } : undefined,
    });
    if (error) throw error;

    const needsConfirmation = !data.session;
    if (needsConfirmation) {
      // No session yet, so auth.uid() isn't available and the nickname RPC can't run.
      // It runs on this account's first real session instead (see resolveUser above),
      // which recovers this signup's typed nickname from user_metadata.display_name.
      return { user: normalizeUser(data.user), needsConfirmation, nicknameFallback: false };
    }

    let nickname = trimmedName;
    let nicknameFallback = false;
    if (trimmedName) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('set_my_nickname', {
          p_preferred_nickname: trimmedName,
        });
        if (rpcError) throw rpcError;
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        nickname = row?.nickname ?? nickname;
      } catch (rpcError) {
        if (rpcError?.code === '23505') {
          // The chosen nickname was just taken by someone else. The account already
          // exists at this point (signUp already created it), so don't block signup —
          // fall back to an auto-generated nickname and tell the caller, so the UI can
          // explain the substitution rather than silently swapping it.
          try {
            const row = await ensureNicknameOnce(data.user.id);
            nickname = row?.nickname ?? nickname;
            nicknameFallback = true;
          } catch { /* leaves nickname unresolved; the next session event retries */ }
        }
      }
    } else {
      // No nickname typed — go through the same deduped path resolveUser uses, so this
      // call coalesces with (rather than races) the SIGNED_IN event's own resolution.
      try {
        const row = await ensureNicknameOnce(data.user.id);
        nickname = row?.nickname ?? nickname;
      } catch { /* leaves nickname unresolved; the next session event retries */ }
    }

    const base = normalizeUser(data.user);
    const finalUser = base ? { ...base, name: nickname || base.name } : base;
    applyUser(finalUser);
    return { user: finalUser, needsConfirmation, nicknameFallback };
  }, [applyUser]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const updatePassword = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }, []);

  /** Changes the caller's own nickname via set_my_nickname — one RPC call handles the
   *  mg_user_profiles upsert, the auth.users display_name update, and re-syncing
   *  author_name on the caller's community posts/comments/reviews. Throws with
   *  `code: '23505'` when the nickname is already taken by someone else. */
  const updateDisplayName = useCallback(async (displayName) => {
    const trimmed = displayName.trim();
    const { data, error } = await supabase.rpc('set_my_nickname', { p_preferred_nickname: trimmed });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    applyUser(userRef.current ? { ...userRef.current, name: row?.nickname ?? trimmed } : userRef.current);
    supabase.auth.refreshSession().catch(() => {});
  }, [applyUser]);

  const value = useMemo(
    () => ({ user, loading, login, signUp, logout, updateDisplayName, updatePassword }),
    [user, loading, login, signUp, logout, updateDisplayName, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
