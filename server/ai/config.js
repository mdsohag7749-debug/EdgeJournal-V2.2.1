// Server-side AI configuration (Sprint 9.6).
//
// Reads ONLY server-side environment variables. Private credentials
// (GEMINI_API_KEY / SUPABASE_SERVICE_ROLE_KEY) live here and nowhere else —
// they are never serialized into logs and never reach the browser.
//
// Public flags read by the browser are the VITE_* ones defined in
// src/lib/ai/provider.js; this module is the sole source of truth for the
// server half of the bridge.

export const AI_PROVIDERS = ['gemini', 'none'];

const AI_PLANS = ['free', 'pro', 'premium'];

function intFrom(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return Math.round(n);
}

function planTier(value) {
  if (typeof value !== 'string') return 'free';
  const tier = value.trim().toLowerCase();
  return AI_PLANS.includes(tier) ? tier : 'free';
}

// Builds the effective server AI configuration from an env-like source.
// `source` is injectable for deterministic tests (defaults to process.env).
export function createAIConfig(source = process.env) {
  const rawEnabled = source.AI_ENABLED;
  const enabled = rawEnabled === 'true' || rawEnabled === true;

  const providerRaw = typeof source.AI_PROVIDER === 'string' ? source.AI_PROVIDER.trim().toLowerCase() : '';
  const provider = AI_PROVIDERS.includes(providerRaw) ? providerRaw : 'none';

  const geminiKey = typeof source.GEMINI_API_KEY === 'string' ? source.GEMINI_API_KEY.trim() : '';
  const model = typeof source.GEMINI_MODEL === 'string' && source.GEMINI_MODEL.trim() ? source.GEMINI_MODEL.trim() : 'gemini-3.5-flash-lite';
  const endpoint = typeof source.GEMINI_ENDPOINT === 'string' && source.GEMINI_ENDPOINT.trim() ? source.GEMINI_ENDPOINT.trim() : 'https://generativelanguage.googleapis.com/v1beta';

  const timeoutMs = intFrom(source.AI_TIMEOUT_MS, 30000, 1000, 120000);
  const rateLimitMax = intFrom(source.AI_RATE_LIMIT_MAX, 20, 1, 1000);
  const rateLimitWindowMs = intFrom(source.AI_RATE_LIMIT_WINDOW_MS, 60000, 1000, 3600000);
  const healthRateLimitMax = intFrom(source.AI_HEALTH_RATE_LIMIT_MAX, 60, 1, 5000);

  const supabaseUrl = typeof source.SUPABASE_URL === 'string' ? source.SUPABASE_URL.trim() : '';
  const supabaseServiceRoleKey = typeof source.SUPABASE_SERVICE_ROLE_KEY === 'string' ? source.SUPABASE_SERVICE_ROLE_KEY.trim() : '';

  // "Configured" = fully enabled end-to-end. Missing key ⇒ NOT_CONFIGURED.
  const configured = enabled && provider === 'gemini' && geminiKey.length > 0;

  return {
    enabled,
    provider,
    geminiKey,
    model,
    endpoint,
    timeoutMs,
    planTier: planTier(source.AI_PLAN),
    rateLimitMax,
    rateLimitWindowMs,
    healthRateLimitMax,
    supabaseUrl,
    supabaseServiceRoleKey,
    configured,
  };
}