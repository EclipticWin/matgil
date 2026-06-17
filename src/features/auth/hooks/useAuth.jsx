import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import * as authService from '../services/mockAuthService.js';

const AuthContext = createContext(null);

/** Holds the (mock) current user and exposes login/logout helpers. */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getUser());

  const login = useCallback(async (credentials) => {
    const u = await authService.login(credentials);
    setUser(u);
    return u;
  }, []);

  const signUp = useCallback(async (credentials) => {
    const u = await authService.signUp(credentials);
    setUser(u);
    return u;
  }, []);

  const loginWithProvider = useCallback(async (provider) => {
    const u = await authService.loginWithProvider(provider);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, login, signUp, loginWithProvider, logout }),
    [user, login, signUp, loginWithProvider, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
