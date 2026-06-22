import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase.js';

const AuthContext = createContext(null);

function normalizeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.user_metadata?.display_name || u.email?.split('@')[0] || 'Traveller',
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(normalizeUser(session?.user ?? null));
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(normalizeUser(session?.user ?? null));
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return normalizeUser(data.user);
  }, []);

  const signUp = useCallback(async ({ email, password, displayName }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: displayName ? { data: { display_name: displayName } } : undefined,
    });
    if (error) throw error;
    return { user: normalizeUser(data.user), needsConfirmation: !data.session };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const updateDisplayName = useCallback(async (displayName) => {
    const trimmed = displayName.trim();
    const { data, error } = await supabase.auth.updateUser({
      data: { display_name: trimmed },
    });
    if (error) throw error;
    setUser(normalizeUser(data.user));
    // Best-effort author_name backfill — ignore RLS / network errors
    try {
      await supabase.from('mg_community_posts')
        .update({ author_name: trimmed })
        .eq('user_id', data.user.id);
    } catch { /* ignore */ }
    try {
      await supabase.from('mg_community_comments')
        .update({ author_name: trimmed })
        .eq('user_id', data.user.id);
    } catch { /* ignore */ }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, signUp, logout, updateDisplayName }),
    [user, loading, login, signUp, logout, updateDisplayName],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
