import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FREE_PLAN,
  KNOWN_FEATURES,
  canUseFeature,
  getPlanLimit,
  isSubscriptionActive,
  getEffectivePlan,
  checkAccountLimit,
  checkTradeLimit,
  formatPlanPrice,
} from '../../lib/entitlements';

describe('Phase 7: Entitlements & Plan Capabilities Engine', () => {
  const mockProPlan = {
    id: 'pro-tier-1',
    name: 'Pro Trader',
    slug: 'pro',
    price: 29.0,
    currency: 'USD',
    billing_interval: 'monthly',
    is_active: true,
    features: ['journal', 'analytics', 'advanced_analytics', 'csv_export', 'reports', 'multiple_accounts'],
    limits: {
      accounts: 10,
      trades: 10000,
      screenshots_per_trade: 10,
    },
  };

  const mockActiveSub = {
    id: 'sub-active-1',
    user_id: 'user-1',
    status: 'active',
    expires_at: null,
    plan: mockProPlan,
  };

  const mockExpiredSub = {
    id: 'sub-expired-1',
    user_id: 'user-2',
    status: 'expired',
    expires_at: '2020-01-01T00:00:00Z',
    plan: mockProPlan,
  };

  const mockCancelledSub = {
    id: 'sub-cancelled-1',
    user_id: 'user-3',
    status: 'cancelled',
    expires_at: null,
    plan: mockProPlan,
  };

  // 1. isSubscriptionActive validation
  describe('isSubscriptionActive()', () => {
    it('returns true for active subscription without expiry', () => {
      expect(isSubscriptionActive(mockActiveSub)).toBe(true);
    });

    it('returns true for trialing subscription with future expiry', () => {
      const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
      expect(isSubscriptionActive({ status: 'trialing', expires_at: futureDate })).toBe(true);
    });

    it('returns false for expired status', () => {
      expect(isSubscriptionActive(mockExpiredSub)).toBe(false);
    });

    it('returns false for cancelled status', () => {
      expect(isSubscriptionActive(mockCancelledSub)).toBe(false);
    });

    it('returns false for active status when past expires_at date', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      expect(isSubscriptionActive({ status: 'active', expires_at: pastDate })).toBe(false);
    });

    it('returns false for null or undefined subscription', () => {
      expect(isSubscriptionActive(null)).toBe(false);
      expect(isSubscriptionActive(undefined)).toBe(false);
    });
  });

  // 2. getEffectivePlan resolution
  describe('getEffectivePlan()', () => {
    it('returns Free plan when plan is null', () => {
      expect(getEffectivePlan(null)).toEqual(DEFAULT_FREE_PLAN);
    });

    it('falls back to Free plan when subscription is expired', () => {
      const effective = getEffectivePlan(mockProPlan, mockExpiredSub);
      expect(effective.name).toBe('Free');
      expect(effective.features).toContain('journal');
      expect(effective.features).not.toContain('advanced_analytics');
    });

    it('returns full pro plan when subscription is active', () => {
      const effective = getEffectivePlan(mockProPlan, mockActiveSub);
      expect(effective.name).toBe('Pro Trader');
      expect(effective.features).toContain('advanced_analytics');
      expect(effective.limits.accounts).toBe(10);
    });
  });

  // 3. canUseFeature checks
  describe('canUseFeature()', () => {
    it('allows basic journal feature on default Free plan', () => {
      expect(canUseFeature(DEFAULT_FREE_PLAN, 'journal')).toBe(true);
      expect(canUseFeature(null, 'journal')).toBe(true);
    });

    it('denies advanced_analytics and csv_export on default Free plan', () => {
      expect(canUseFeature(DEFAULT_FREE_PLAN, 'advanced_analytics')).toBe(false);
      expect(canUseFeature(DEFAULT_FREE_PLAN, 'csv_export')).toBe(false);
      expect(canUseFeature(null, 'csv_export')).toBe(false);
    });

    it('allows elevated features on Pro plan', () => {
      expect(canUseFeature(mockProPlan, 'advanced_analytics')).toBe(true);
      expect(canUseFeature(mockProPlan, 'csv_export')).toBe(true);
      expect(canUseFeature(mockProPlan, 'multiple_accounts')).toBe(true);
    });

    it('resolves features directly from active subscription object', () => {
      expect(canUseFeature(mockActiveSub, 'advanced_analytics')).toBe(true);
    });

    it('falls back to Free features when checked against expired subscription', () => {
      expect(canUseFeature(mockExpiredSub, 'advanced_analytics')).toBe(false);
      expect(canUseFeature(mockExpiredSub, 'journal')).toBe(true);
    });

    it('returns false when checking empty or undefined feature name', () => {
      expect(canUseFeature(mockProPlan, '')).toBe(false);
      expect(canUseFeature(mockProPlan, null)).toBe(false);
    });
  });

  // 4. getPlanLimit checks
  describe('getPlanLimit()', () => {
    it('returns Free limit for accounts and trades when plan is null', () => {
      expect(getPlanLimit(null, 'accounts')).toBe(1);
      expect(getPlanLimit(null, 'trades')).toBe(500);
      expect(getPlanLimit(null, 'screenshots_per_trade')).toBe(5);
    });

    it('returns Pro plan limits for active tier', () => {
      expect(getPlanLimit(mockProPlan, 'accounts')).toBe(10);
      expect(getPlanLimit(mockProPlan, 'trades')).toBe(10000);
      expect(getPlanLimit(mockProPlan, 'screenshots_per_trade')).toBe(10);
    });

    it('returns Free limit when querying expired subscription', () => {
      expect(getPlanLimit(mockExpiredSub, 'accounts')).toBe(1);
      expect(getPlanLimit(mockExpiredSub, 'trades')).toBe(500);
    });

    it('returns fallback value for unconfigured limit key', () => {
      expect(getPlanLimit(mockProPlan, 'unknown_limit', 99)).toBe(99);
    });
  });

  // 5. checkAccountLimit checks
  describe('checkAccountLimit()', () => {
    it('allows adding first account on Free plan', () => {
      const check = checkAccountLimit(0, DEFAULT_FREE_PLAN);
      expect(check.allowed).toBe(true);
      expect(check.current).toBe(0);
      expect(check.max).toBe(1);
      expect(check.message).toBeNull();
    });

    it('disallows adding second account on Free plan with user-friendly message', () => {
      const check = checkAccountLimit(1, DEFAULT_FREE_PLAN);
      expect(check.allowed).toBe(false);
      expect(check.current).toBe(1);
      expect(check.max).toBe(1);
      expect(check.message).toContain('allows up to 1 trading account');
    });

    it('allows multiple accounts on Pro plan up to limit', () => {
      expect(checkAccountLimit(5, mockProPlan).allowed).toBe(true);
      expect(checkAccountLimit(9, mockProPlan).allowed).toBe(true);
      expect(checkAccountLimit(10, mockProPlan).allowed).toBe(false);
    });
  });

  // 6. checkTradeLimit checks
  describe('checkTradeLimit()', () => {
    it('allows logging trades under limit', () => {
      const check = checkTradeLimit(250, DEFAULT_FREE_PLAN);
      expect(check.allowed).toBe(true);
      expect(check.message).toBeNull();
    });

    it('blocks additional trades when at or over plan limit without deleting data', () => {
      const check = checkTradeLimit(500, DEFAULT_FREE_PLAN);
      expect(check.allowed).toBe(false);
      expect(check.max).toBe(500);
      expect(check.message).toContain('allows up to 500 trades');
    });
  });

  // 7. formatPlanPrice formatting
  describe('formatPlanPrice()', () => {
    it('formats 0 or negative price as Free', () => {
      expect(formatPlanPrice(0)).toBe('Free');
      expect(formatPlanPrice('0.00')).toBe('Free');
      expect(formatPlanPrice(null)).toBe('Free');
    });

    it('formats USD monthly price correctly', () => {
      expect(formatPlanPrice(29.0, 'USD', 'monthly')).toBe('$29.00/mo');
    });

    it('formats EUR and GBP correctly', () => {
      expect(formatPlanPrice(19.99, 'EUR', 'monthly')).toBe('€19.99/mo');
      expect(formatPlanPrice(99.0, 'GBP', 'yearly')).toBe('£99.00/yr');
    });
  });
});
