// =============================================================================
// EdgeJournal — User Subscription API Client
// Phase 7: Subscriptions, Plans & Entitlements
//
// Strictly respects client security model:
// - Users can only SELECT active plans (RLS: "Authenticated users can view active plans")
// - Users can only SELECT their own subscription (RLS: "Users can view own subscription")
// - Users CANNOT modify subscriptions or plans from the client.
// =============================================================================

import { supabase } from './supabase';
import {
  DEFAULT_FREE_PLAN,
  getEffectivePlan,
  isSubscriptionActive,
  canUseFeature,
  getPlanLimit,
} from './entitlements';
import { fromSubscriptionPlanRow, fromSubscriptionRow } from './adminApi';

/**
 * Fetches the current user's subscription and associated plan.
 * If no subscription record exists or if the subscription has expired,
 * returns the default Free plan entitlements.
 */
export async function fetchCurrentSubscription(userId) {
  if (!userId) {
    return {
      subscription: null,
      plan: DEFAULT_FREE_PLAN,
      status: 'none',
      isActive: false,
    };
  }

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id, user_id, plan_id, status, started_at, expires_at, created_at, updated_at, plans(*)')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return {
        subscription: null,
        plan: DEFAULT_FREE_PLAN,
        status: 'none',
        isActive: false,
      };
    }

    const sub = fromSubscriptionRow(data);
    const plan = sub.plan ? sub.plan : DEFAULT_FREE_PLAN;
    const active = isSubscriptionActive(sub);
    const effectivePlan = getEffectivePlan(plan, sub);

    return {
      subscription: sub,
      plan: effectivePlan,
      status: sub.status,
      isActive: active,
    };
  } catch (err) {
    console.warn('Subscription fetch notice (defaulting to Free):', err?.message);
    return {
      subscription: null,
      plan: DEFAULT_FREE_PLAN,
      status: 'none',
      isActive: false,
    };
  }
}

/**
 * Fetches all publicly active plans for user review/comparison.
 * Authenticated users are allowed by RLS to view active plans.
 */
export async function fetchActivePlans() {
  try {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    const list = (data || []).map(fromSubscriptionPlanRow);
    if (list.length === 0) {
      return [DEFAULT_FREE_PLAN];
    }
    return list;
  } catch (err) {
    console.warn('Failed to fetch active plans:', err?.message);
    return [DEFAULT_FREE_PLAN];
  }
}

export {
  DEFAULT_FREE_PLAN,
  getEffectivePlan,
  isSubscriptionActive,
  canUseFeature,
  getPlanLimit,
};
