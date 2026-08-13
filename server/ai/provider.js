// Server-side provider dispatcher (Sprint 9.6).
//
// The server half of the provider abstraction. `createServerAIProvider` maps a
// validated config to a concrete provider adapter (the same swap-in pattern the
// client uses), and `runServerAnalysis` / `runServerHealth` own the
// analyze→sanitize→normalize and health pipelines. Raw provider errors never
// escape here — everything becomes an existing controlled AI error/status.

import { AIError } from './errors';
import { AI_ERROR_CODES, AI_STATUS_OK } from './errors';
import { toSafeAIError } from './errors';
import { createGeminiAdapter } from './adapters/gemini';
import { sanitizeForKind } from './safety';
import { frameContextForProvider } from './prompts';

// Resolves a config to a concrete adapter. Unknown/missing provider deploys
// degrade safely to AI_UNAVAILABLE instead of fabricating output.
// `fetcher` (passed via cfg) is an injectable HTTP client for deterministic
// tests; production uses the Node 18+ global fetch.
export function createServerAIProvider(cfg = {}) {
  if (cfg.provider === 'gemini' && cfg.geminiKey) {
    return createGeminiAdapter({
      apiKey: cfg.geminiKey,
      model: cfg.model,
      timeoutMs: cfg.timeoutMs,
      endpoint: cfg.endpoint,
      fetcher: cfg.fetcher || undefined,
    });
  }
  return {
    analyze: () => Promise.reject(new AIError(AI_ERROR_CODES.AI_UNAVAILABLE, 'AI provider is not available.')),
    healthCheck: async () => ({ ok: false, status: AI_ERROR_CODES.AI_UNAVAILABLE }),
  };
}

export async function runServerAnalysis({ kind, context, prompt, cfg, fetcher } = {}) {
  const provider = createServerAIProvider({ ...cfg, fetcher });
  const started = Date.now();
  try {
    const framedContext = frameContextForProvider(context);
    const raw = await provider.analyze({ kind, prompt, context: framedContext });
    const analysis = sanitizeForKind(kind, raw);
    return {
      ok: true,
      status: AI_STATUS_OK,
      message: '',
      analysis,
      plan: cfg.planTier || 'free',
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const safe = toSafeAIError(err);
    return {
      ok: false,
      status: safe.code,
      message: safe.message,
      analysis: null,
      plan: cfg.planTier || 'free',
      durationMs: Date.now() - started,
    };
  }
}

export async function runServerHealth(cfg = {}, { fetcher } = {}) {
  const provider = createServerAIProvider({ ...cfg, fetcher });
  const started = Date.now();
  try {
    const out = await provider.healthCheck();
    return {
      ok: !!out?.ok,
      status: out?.status || AI_ERROR_CODES.AI_UNAVAILABLE,
      enabled: cfg.enabled === true,
      ready: out?.ok === true,
      durationMs: Date.now() - started,
    };
  } catch {
    return {
      ok: false,
      status: AI_ERROR_CODES.AI_UNAVAILABLE,
      enabled: cfg.enabled === true,
      ready: false,
      durationMs: Date.now() - started,
    };
  }
}