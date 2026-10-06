// =============================================================================
// EdgeJournal — Entitlements & Plan Capabilities Engine
// Phase 7: Subscriptions, Plans & Entitlements
//
// Centralized engine for evaluating feature access and plan limits.
// Ensures consistent entitlement evaluation across the user UI, admin UI,
// and background checks.
// =============================================================================

export const DEFAULT_FREE_PLAN = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Free',
  slug: 'free',
  description: 'Essential trade logging and personal performance tracking for everyday traders.',
  price: 0.0,
  currency: 'USD',
  billing_interval: 'monthly',
  is_active: true,
  features: [
    'journal',
    'analytics',
    'basic_reports',
    'goals',
    'reflections',
    'challenges',
  ],
  limits: {
    accounts: 1,
    trades: 500,
    screenshots_per_trade: 5,
  },
};

export const KNOWN_FEATURES = [
  { id: 'journal', label: 'Trading Journal', description: 'Core trade logging and execution notes' },
  { id: 'analytics', label: 'Basic Analytics', description: 'Win rate, P&L curve, and essential trade metrics' },
  { id: 'advanced_analytics', label: 'Advanced Analytics', description: 'Detailed breakdowns, session intelligence, and dynamic rankings' },
  { id: 'multiple_accounts', label: 'Multiple Trading Accounts', description: 'Connect and manage multiple broker/prop accounts' },
  { id: 'reports', label: 'Platform Reports', description: 'Generate comprehensive performance reports' },
  { id: 'csv_export', label: 'CSV Data Export', description: 'Export filtered trade histories and analytics to CSV' },
  { id: 'custom_goals', label: 'Custom Trading Goals', description: 'Create and track bespoke milestone targets' },
  { id: 'unlimited_trades', label: 'High-Volume Trades', description: 'Log up to 10,000 trades per account' },
  { id: 'edge_ai', label: 'Edge AI Command Center', description: 'Future AI pattern recognition (Phase 8+ entitlement identifier)' },
];

/**
 * Validates whether a subscription status represents an active, usable entitlement.
 * Active statuses: 'active', 'trialing'.
 * Expired or cancelled subscriptions do not grant elevated privileges.
 * Also checks expires_at timestamp if present.
 */
export function isSubscriptionActive(subscription) {
  if (!subscription) return false;
  const status = subscription.status?.toLowerCase();
  if (status !== 'active' && status !== 'trialing') {
    return false;
  }
  if (subscription.expires_at) {
    const expiry = new Date(subscription.expires_at);
    if (!isNaN(expiry.getTime()) && expiry <= new Date()) {
      return false;
    }
  }
  return true;
}

/**
 * Resolves the effective plan considering subscription active status.
 * If subscription is missing, inactive, or expired, falls back to the default Free plan.
 */
export function getEffectivePlan(plan, subscription) {
  if (!plan) return DEFAULT_FREE_PLAN;
  if (subscription && !isSubscriptionActive(subscription)) {
    return DEFAULT_FREE_PLAN;
  }
  return {
    ...DEFAULT_FREE_PLAN,
    ...plan,
    features: Array.isArray(plan.features) ? plan.features : (DEFAULT_FREE_PLAN.features),
    limits: typeof plan.limits === 'object' && plan.limits !== null
      ? { ...DEFAULT_FREE_PLAN.limits, ...plan.limits }
      : DEFAULT_FREE_PLAN.limits,
  };
}

/**
 * Checks if a specific feature entitlement is permitted for the given plan or subscription.
 *
 * @param {object} planOrSubscription - Either a plan object or a subscription object with attached plan
 * @param {string} featureName - Feature identifier (e.g., 'advanced_analytics', 'csv_export')
 * @returns {boolean} True if the feature is permitted
 */
export function canUseFeature(planOrSubscription, featureName) {
  if (!featureName) return false;

  let plan = planOrSubscription;
  if (planOrSubscription && 'status' in planOrSubscription) {
    // It's a subscription object
    if (!isSubscriptionActive(planOrSubscription)) {
      plan = DEFAULT_FREE_PLAN;
    } else {
      plan = planOrSubscription.plan || planOrSubscription.plans || DEFAULT_FREE_PLAN;
    }
  }

  const effectivePlan = plan || DEFAULT_FREE_PLAN;
  const featuresList = Array.isArray(effectivePlan.features) ? effectivePlan.features : [];

  return featuresList.includes(featureName);
}

/**
 * Retrieves a numeric or configured plan limit.
 *
 * @param {object} planOrSubscription - Either a plan object or a subscription object
 * @param {string} limitKey - Limit identifier (e.g., 'accounts', 'trades', 'screenshots_per_trade')
 * @param {number|null} fallbackValue - Fallback if not configured in plan or default
 * @returns {number} The resolved limit number
 */
export function getPlanLimit(planOrSubscription, limitKey, fallbackValue = Infinity) {
  if (!limitKey) return fallbackValue;

  let plan = planOrSubscription;
  if (planOrSubscription && 'status' in planOrSubscription) {
    if (!isSubscriptionActive(planOrSubscription)) {
      plan = DEFAULT_FREE_PLAN;
    } else {
      plan = planOrSubscription.plan || planOrSubscription.plans || DEFAULT_FREE_PLAN;
    }
  }

  const effectivePlan = plan || DEFAULT_FREE_PLAN;
  const limits = effectivePlan.limits || {};

  if (limitKey in limits && limits[limitKey] !== null && !isNaN(Number(limits[limitKey]))) {
    return Number(limits[limitKey]);
  }

  if (limitKey in DEFAULT_FREE_PLAN.limits) {
    return Number(DEFAULT_FREE_PLAN.limits[limitKey]);
  }

  return fallbackValue;
}

/**
 * Checks if creating a new account would exceed the allowed account limit.
 * Does NOT delete or block existing accounts; only guards new additions.
 */
export function checkAccountLimit(currentCount, planOrSubscription) {
  const maxAccounts = getPlanLimit(planOrSubscription, 'accounts', 1);
  const isAllowed = currentCount < maxAccounts;
  return {
    allowed: isAllowed,
    current: currentCount,
    max: maxAccounts,
    message: isAllowed
      ? null
      : `Your current plan allows up to ${maxAccounts} trading ${maxAccounts === 1 ? 'account' : 'accounts'}. Upgrade your plan or contact your administrator to add more.`,
  };
}

/**
 * Checks if creating a new trade would exceed the allowed trade limit.
 * Does NOT delete or block existing trades; only guards new additions.
 */
export function checkTradeLimit(currentCount, planOrSubscription) {
  const maxTrades = getPlanLimit(planOrSubscription, 'trades', 500);
  const isAllowed = currentCount < maxTrades;
  return {
    allowed: isAllowed,
    current: currentCount,
    max: maxTrades,
    message: isAllowed
      ? null
      : `Your current plan allows up to ${maxTrades} trades. Upgrade your plan or contact your administrator to continue logging trades.`,
  };
}

/**
 * Formats a plan's price for display.
 */
export function formatPlanPrice(price, currency = 'USD', interval = 'monthly') {
  const numPrice = Number(price);
  if (isNaN(numPrice) || numPrice <= 0) {
    return 'Free';
  }
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : `${currency} `;
  const intervalLabel = interval === 'monthly' ? '/mo' : interval === 'yearly' ? '/yr' : `/${interval}`;
  return `${symbol}${numPrice.toFixed(2)}${intervalLabel}`;
}
