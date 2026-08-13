// Provider-agnostic AI interface.
//
// createAIProvider() returns the object future AI features call:
//   - analyze(context)   → always resolves to a controlled result; never
//                          throws, never leaks provider internals
//   - healthCheck()      → readiness probe
//
// The browser holds only a public feature flag (VITE_AI_ENABLED) and a provider
// NAME — never a private API key. Any real model call must go through a future
// server-side route. Until one exists, an enabled-but-unimplemented provider
// fails safely with AI_UNAVAILABLE instead of crashing or fabricating output.
//
// Providers are swap-in adapters registered by name (registerAIAdapter), so
// Gemini / self-hosted / future models are drop-in replacements.

import { AIError, toSafeAIResult } from './errors.js';
import { planForKey } from './types.js';
import { AI_ERROR_CODES, AI_STATUS_OK } from './types.js';
import { sanitizeResponse } from './safety.js';
import { createRemoteAdapter } from './remote.js';

export const AI_DEFAULT_CONFIG = {
  enabled: false,
  provider: 'none',
  planTier: 'free',
  timeoutMs: 30000,
};

function envOf() {
  return (typeof import.meta !== 'undefined' && import.meta.env) || {};
}

// Resolves effective AI config. `overrides` (unit tests / future callers) win
// over the public VITE_ feature flags; both are never treated as secret.
export function resolveAIConfig(overrides = {}) {
  const env = envOf();
  const envFlag = env.VITE_AI_ENABLED;
  const enabled = overrides.enabled !== undefined ? !!overrides.enabled : envFlag === 'true' || envFlag === true;
  const provider = overrides.provider || env.VITE_AI_PROVIDER || AI_DEFAULT_CONFIG.provider;
  const planTier = overrides.planTier || AI_DEFAULT_CONFIG.planTier;
  const timeoutMs = Number.isFinite(overrides.timeoutMs) ? overrides.timeoutMs : AI_DEFAULT_CONFIG.timeoutMs;
  return { enabled, provider, planTier, timeoutMs };
}

const ADAPTERS = {
  none: {
    // Placeholder adapter: an enabled provider with no backend route yet must
    // degrade gracefully instead of trying to reach a server that does not
    // exist. Later sprints register a real entry point here.
    analyze: () => Promise.reject(new AIError(AI_ERROR_CODES.AI_UNAVAILABLE, 'AI backend is not implemented yet.')),
    healthCheck: async () => ({ ok: false, status: AI_ERROR_CODES.AI_UNAVAILABLE }),
  },
};

// Registers a provider adapter keyed by name. An adapter is a plain object
// with `analyze(config, request)` and optionally `healthCheck(config)`.
// Invalid registrations are ignored so a bad plugin can never break the
// enabled-provider path at runtime.
export function registerAIAdapter(name, adapter) {
  if (typeof name !== 'string' || !name) return;
  if (!adapter || typeof adapter.analyze !== 'function') return;
  ADAPTERS[name] = adapter;
}

// The secure bridge adapter: when the public VITE_AI_PROVIDER=remote flag is
// set, analyze()/healthCheck() go through OUR OWN server endpoints — the
// browser never holds a private key.
registerAIAdapter('remote', createRemoteAdapter());

export function createAIProvider(overrides = {}) {
  const config = resolveAIConfig(overrides);

  function getStatus() {
    return {
      enabled: config.enabled,
      provider: config.provider,
      planTier: config.planTier,
      state: config.enabled ? 'ready' : 'disabled',
    };
  }

  // Always resolves. Output shape stays stable across providers and errors so
  // consumers render one path and learn state purely from the status field.
  async function analyze(request) {
    const status = getStatus();
    if (!status.enabled) {
      const err = new AIError(AI_ERROR_CODES.AI_NOT_CONFIGURED, 'Edge AI is not configured yet. No analysis was requested from any provider.');
      return toSafeAIResult(err);
    }

    const adapter = ADAPTERS[config.provider] || ADAPTERS.none;
    try {
      const raw = await adapter.analyze(config, request);
      // A caller may supply a kind-specific response sanitizer for its own
      // contract (e.g. Sprint 9.3's journal contract). Defaults to the shared
      // base contract sanitizer so every provider output stays safe.
      const sanitize = request && typeof request.sanitize === 'function' ? request.sanitize : sanitizeResponse;
      const analysis = sanitize(raw);
      return { ok: true, status: AI_STATUS_OK, plan: config.planTier, analysis };
    } catch (err) {
      return toSafeAIResult(err);
    }
  }

  async function healthCheck() {
    const status = getStatus();
    if (!status.enabled) {
      return { ok: false, status: AI_ERROR_CODES.AI_NOT_CONFIGURED };
    }
    const adapter = ADAPTERS[config.provider] || ADAPTERS.none;
    try {
      return await adapter.healthCheck(config);
    } catch (err) {
      return toSafeAIResult(err);
    }
  }

  return {
    provider: config.provider,
    plan: planForKey(config.planTier),
    getStatus,
    isEnabled() {
      return getStatus().enabled;
    },
    analyze,
    healthCheck,
  };
}