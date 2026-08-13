// POST /api/ai/analyze — the secure analyze endpoint (Sprint 9.6).
//
// Flow: 1 validate request shape → 2 validate kind → 3 account scope →
// 4 sanitize incoming fields → 5 reject unsupported/directive payloads →
// 6 call provider adapter → 7 sanitize provider response → 8 enforce the
// existing analytical-only contract → 9 return normalized safe JSON.
//
// The browser is NEVER trusted for account ownership, provider selection,
// billing entitlement, or system prompts.

import { AI_ERROR_CODES } from './errors';
import { toSafeAIError } from './errors';
import { createAIConfig } from './config';
import { sanitizeAnalyzeRequest, createRequestId } from './requestSchema';
import { resolveAccountScope } from './accountScope';
import { createRateLimiter } from './rateLimit';
import { runServerAnalysis } from './provider';
import { systemPromptFor } from './prompts';
import { safeLog } from './log';

// Module-scoped bounded guard: per instance only (serverless best effort —
// enough to stop accidental storms without persistence). One limiter per
// config (max:window), so a deployment shares state across requests while each
// configured limit is honored.
const LIMITERS = new Map();
function limiterFor(cfg) {
  const key = `${cfg.rateLimitMax}:${cfg.rateLimitWindowMs}`;
  let limiter = LIMITERS.get(key);
  if (!limiter) {
    limiter = createRateLimiter({ max: cfg.rateLimitMax, windowMs: cfg.rateLimitWindowMs });
    LIMITERS.set(key, limiter);
  }
  return limiter;
}

export async function handleAnalyze({ method, data, authorization, ip, source, supabaseFactory, fetcher } = {}) {
  const started = Date.now();
  const requestId = createRequestId();
  const cfg = createAIConfig(source);
  const startedMs = started;

  if (method && method !== 'POST') {
    return {
      status: 405,
      json: {
        ok: false,
        status: AI_ERROR_CODES.AI_PROVIDER_ERROR,
        message: 'AI endpoint only accepts POST requests.',
        analysis: null,
      },
    };
  }

  // 1 + 2 + 4: parse + whitelist the request (kind + single context only).
  let parsed;
  try {
    parsed = sanitizeAnalyzeRequest(data);
  } catch (err) {
    const safe = toSafeAIError(err);
    return {
      status: 400,
      json: { ok: false, status: safe.code, message: 'AI request could not be processed.', analysis: null },
    };
  }

  // 5: abuse guard — reject request storms up front.
  const limiterKey = `${ip || 'unknown'}:${parsed.kind}`;
  if (!limiterFor(cfg).tryConsume(limiterKey, startedMs)) {
    return {
      status: 429,
      json: {
        ok: false,
        status: AI_ERROR_CODES.AI_RATE_LIMITED,
        message: 'AI is temporarily busy. Please try again in a moment.',
        analysis: null,
      },
    };
  }

  // Not configured (disabled / missing key) clears the request BEFORE any
  // provider contact — safe NOT_CONFIGURED for the client.
  if (!cfg.enabled || !cfg.configured) {
    return {
      status: 200,
      json: {
        ok: false,
        status: AI_ERROR_CODES.AI_NOT_CONFIGURED,
        message: 'EdgeJournal AI is not configured yet. No journal data was sent to any provider.',
        analysis: null,
      },
    };
  }

  // 3: account scope — structural + optional user binding.
  try {
    await resolveAccountScope({
      kind: parsed.kind,
      context: parsed.context,
      authorization,
      cfg,
      supabaseFactory,
    });
  } catch {
    return {
      status: 403,
      json: {
        ok: false,
        status: AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR,
        message: 'Account isolation: the requested analysis is outside the selected account.',
        analysis: null,
      },
    };
  }

  // Server composes the system prompt itself (kind-based, never client input).
  const prompt = systemPromptFor(parsed.kind);

  // 6 + 7 + 8: provider → sanitize → enforce contract → normalize.
  const outcome = await runServerAnalysis({ kind: parsed.kind, context: parsed.context, prompt, cfg, fetcher });

  safeLog({
    requestId,
    kind: parsed.kind,
    durationMs: outcome.durationMs,
    ok: outcome.ok,
    status: outcome.status,
  });

  // 9: normalized safe JSON.
  return {
    status: 200,
    json: {
      ok: outcome.ok,
      status: outcome.status,
      message: outcome.message,
      analysis: outcome.analysis,
      plan: outcome.plan,
    },
  };
}