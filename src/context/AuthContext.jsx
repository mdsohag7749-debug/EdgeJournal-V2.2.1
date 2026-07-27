import { createContext, useCallback, useContext, useState } from 'react';

// Fake authentication only. No Supabase, no backend call, no persisted
// session — isAuthenticated lives in memory and always starts `false`.
// login()/logout() are placeholders to be swapped for real calls later.

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const login = useCallback(() => {
    // Placeholder only — simulates a successful login. Replace with a
    // real Supabase/session call once auth is connected.
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  return <AuthContext.Provider value={{ isAuthenticated, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
