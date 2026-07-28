import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Real Supabase authentication. Session persistence, auto-login on
// refresh, and the auth-state listener are all handled here in one
// place so every consumer (ProtectedRoute, Header, auth pages) just
// reads `isAuthenticated` / `isLoading` and calls the methods below.

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  // Starts true: we don't know yet whether a session exists until
  // Supabase has checked its persisted storage. ProtectedRoute waits on
  // this instead of redirecting to /login prematurely, which is what
  // makes "auto login" on page refresh actually work.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Session persistence + auto login: reads whatever Supabase already
    // has stored (localStorage, via persistSession in lib/supabase.js).
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setIsLoading(false);
    });

    // Auth state listener: keeps `session` in sync with sign-in,
    // sign-out, token refresh, and password-recovery events, from this
    // tab or any other.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function register(name, email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) throw error;
    return data;
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) throw error;
  }

  const value = {
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session,
    isLoading,
    login,
    register,
    logout,
    requestPasswordReset,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
