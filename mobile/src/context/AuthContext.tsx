import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { UserProfile } from '../types/models';
import { authService } from '../services/authService';

interface AuthContextType {
  session: any | null;
  user: any | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  register: (name: string, email: string, pass: string) => Promise<any>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children?: ReactNode }) {
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProfile = async () => {
    if (session?.user?.id) {
      const p = await authService.fetchProfile(session.user.id);
      setProfile(p);
    } else {
      setProfile(null);
    }
  };

  useEffect(() => {
    let isMounted = true;
    authService.getSession().then((sess) => {
      if (!isMounted) return;
      setSession(sess);
      setIsLoading(false);
      if (sess?.user?.id) {
        authService.fetchProfile(sess.user.id).then((p) => {
          if (isMounted) setProfile(p);
        });
      }
    });

    const { data: listener } = authService.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setIsLoading(false);
      if (newSession?.user?.id) {
        authService.fetchProfile(newSession.user.id).then((p) => {
          if (isMounted) setProfile(p);
        });
      } else {
        setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    return authService.login(email, pass);
  };

  const register = async (name: string, email: string, pass: string) => {
    return authService.register(name, email, pass);
  };

  const logout = async () => {
    await authService.logout();
    setSession(null);
    setProfile(null);
  };

  const requestPasswordReset = async (email: string) => {
    await authService.resetPasswordForEmail(email);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        isAuthenticated: !!session,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
        requestPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
