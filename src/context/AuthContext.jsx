import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/profileApi';
import { fetchCurrentSubscription } from '../lib/subscriptionApi';
import {
  DEFAULT_FREE_PLAN,
  canUseFeature,
  getPlanLimit,
  isSubscriptionActive,
} from '../lib/entitlements';

// Real Supabase authentication. Session persistence, auto-login on
// refresh, and the auth-state listener are all handled here in one
// place so every consumer (ProtectedRoute, Header, auth pages) just
// reads `isAuthenticated` / `isLoading` and calls the methods below.
//
// It also owns the single shared source of truth for the signed-in
// user's profile row (fullName, username, email, avatarUrl, bio,
// timezone) and Phase 7 subscription and entitlement state.

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Phase 7: Subscription & Entitlement state
  const [subscription, setSubscription] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(DEFAULT_FREE_PLAN);
  const [subscriptionStatus, setSubscriptionStatus] = useState('none');
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

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
    // sign-out, token refresh, and password-recovery events.
    const { data: subscriptionListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscriptionListener.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id;

  // Function to reload user subscription state
  const loadSubscription = useCallback(async (uid) => {
    if (!uid) {
      setSubscription(null);
      setCurrentPlan(DEFAULT_FREE_PLAN);
      setSubscriptionStatus('none');
      setSubscriptionLoading(false);
      return;
    }
    setSubscriptionLoading(true);
    try {
      const res = await fetchCurrentSubscription(uid);
      setSubscription(res.subscription);
      setCurrentPlan(res.plan || DEFAULT_FREE_PLAN);
      setSubscriptionStatus(res.status || 'none');
    } catch (subErr) {
      console.warn('Subscription resolution note:', subErr);
      setSubscription(null);
      setCurrentPlan(DEFAULT_FREE_PLAN);
      setSubscriptionStatus('none');
    } finally {
      setSubscriptionLoading(false);
    }
  }, []);

  // Load the signed-in user's profile and subscription whenever the auth user changes.
  useEffect(() => {
    let isMounted = true;
    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      setSubscription(null);
      setCurrentPlan(DEFAULT_FREE_PLAN);
      setSubscriptionStatus('none');
      setSubscriptionLoading(false);
      return;
    }

    setProfileLoading(true);
    fetchProfile(userId)
      .then((p) => {
        if (isMounted) setProfile(p);
      })
      .catch(() => {
        if (isMounted) setProfile(null);
      })
      .finally(() => {
        if (isMounted) setProfileLoading(false);
      });

    loadSubscription(userId);

    return () => {
      isMounted = false;
    };
  }, [userId, loadSubscription]);

  const refreshSubscription = useCallback(() => {
    if (userId) return loadSubscription(userId);
    return Promise.resolve();
  }, [userId, loadSubscription]);

  // Derived entitlements and limits helpers
  const entitlements = useMemo(() => {
    return Array.isArray(currentPlan?.features) ? currentPlan.features : DEFAULT_FREE_PLAN.features;
  }, [currentPlan]);

  const planLimits = useMemo(() => {
    return typeof currentPlan?.limits === 'object' && currentPlan?.limits !== null
      ? currentPlan.limits
      : DEFAULT_FREE_PLAN.limits;
  }, [currentPlan]);

  const canUse = useCallback(
    (featureName) => {
      return canUseFeature(currentPlan, featureName);
    },
    [currentPlan]
  );

  const getLimit = useCallback(
    (limitKey, fallbackValue = Infinity) => {
      return getPlanLimit(currentPlan, limitKey, fallbackValue);
    },
    [currentPlan]
  );

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
    profile,
    profileLoading,
    isAdmin: profile?.role === 'admin',
    setProfile,
    // Phase 7 Subscription additions
    subscription,
    currentPlan,
    subscriptionStatus,
    subscriptionLoading,
    entitlements,
    planLimits,
    canUse,
    getLimit,
    refreshSubscription,
    isSubscriptionActive: isSubscriptionActive(subscription),
    // Auth actions
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