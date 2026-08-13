// AI domain vocabulary — shared constants for the EdgeJournal AI foundation.
// No logic here, just the single source of truth for the codes, plans, and
// response contract the rest of the module (and future sprints) rely on.

// Controlled AI error/state codes. Every failure that can reach a consumer is
// normalized to one of these before leaving the AI module — raw provider
// messages (or secrets) never pass through.
export const AI_ERROR_CODES = {
  AI_NOT_CONFIGURED: 'AI_NOT_CONFIGURED',
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
  AI_INVALID_RESPONSE: 'AI_INVALID_RESPONSE',
  AI_ACCOUNT_SCOPE_ERROR: 'AI_ACCOUNT_SCOPE_ERROR',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
};

export const AI_ERROR_CODES_LIST = Object.values(AI_ERROR_CODES);

export const AI_STATUS_OK = 'ok';

// "Ready for future paid AI": plan tiers describe usage envelopes only.
// Nothing here is enforced yet — the structure just lets a later billing
// sprint gate AI calls by plan without redesigning the provider layer.
export const AI_PLANS = {
  free: { key: 'free', label: 'Free', maxAnalyses: 10 },
  pro: { key: 'pro', label: 'Pro', maxAnalyses: 100 },
  premium: { key: 'premium', label: 'Premium', maxAnalyses: Number.POSITIVE_INFINITY },
};

export const AI_PLAN_KEYS = Object.keys(AI_PLANS);

export function planForKey(key) {
  return AI_PLANS[key] || AI_PLANS.free;
}

// The structured response contract future AI features consume. Deliberately
// analytical only — there are no buy/sell signals, no entry triggers, and no
// guaranteed-outcome fields. AI output must stay descriptive and advisory.
export const RESPONSE_CONTRACT = {
  summary: { type: 'string', required: false },
  observations: { type: 'array', required: false },
  strengths: { type: 'array', required: false },
  weaknesses: { type: 'array', required: false },
  risks: { type: 'array', required: false },
  improvements: { type: 'array', required: false },
  confidence: { type: 'number|null', required: false, min: 0, max: 1 },
  disclaimer: { type: 'string', required: false },
};

export const RESPONSE_KEYS = Object.keys(RESPONSE_CONTRACT);

// Which response fields are free-text lists (arrays of strings).
export const RESPONSE_LIST_KEYS = ['observations', 'strengths', 'weaknesses', 'risks', 'improvements'];

export const AI_DISCLAIMER =
  'Edge AI is an analyst/coach. It is advisory only — it never executes trades, cashes out, or guarantees outcomes, and it never claims to. Review any output against your plan and rules.';