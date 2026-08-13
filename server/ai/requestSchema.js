// Server-side request schema + validation (Sprint 9.6).
//
// The bridge accepts ONLY `{ kind, context }`. Anything else — raw trade rows,
// extra account arrays, hidden instructions, provider selection, billing
// markers, system prompts — is rejected before it reaches any provider.

import { randomUUID } from 'node:crypto';
import { AIError } from '../../src/lib/ai/errors.js';
import { AI_ERROR_CODES } from '../../src/lib/ai/types.js';

// The only kinds the server will ever dispatch. Mirrors the existing
// AI_REQUEST_KIND_* constants in src/lib/ai.
export const AI_REQUEST_KINDS = ['tradeReview', 'journalIntelligence', 'coaching', 'askJournal'];

// Cap the serialized context so an enormous payload cannot storm the provider.
export const MAX_CONTEXT_BYTES = 512 * 1024;

export function createRequestId() {
  try {
    return randomUUID();
  } catch {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function invalidRequest(detail) {
  return new AIError(AI_ERROR_CODES.AI_PROVIDER_ERROR, 'AI request could not be processed.', { detail });
}

function scopeViolation(detail) {
  return new AIError(
    AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR,
    'Account isolation: AI requests may only carry a single account-scoped context.',
    { detail }
  );
}

function approxBytes(value) {
  try {
    return JSON.stringify(value).length;
  } catch {
    return MAX_CONTEXT_BYTES + 1;
  }
}

// Parses + whitelists an incoming analyze payload. `raw` may be a raw JSON
// string (real HTTP) or an already-parsed object (injectable tests).
// Returns `{ kind, context }` or throws a controlled AIError.
export function sanitizeAnalyzeRequest(raw) {
  let parsed;
  if (typeof raw === 'string') {
    const trimmed = (raw || '').trim();
    if (!trimmed) throw invalidRequest('empty-body');
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw invalidRequest('unparseable-json');
    }
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    parsed = raw;
  } else {
    throw invalidRequest('invalid-body');
  }

  const kind = typeof parsed.kind === 'string' ? parsed.kind : '';
  if (!AI_REQUEST_KINDS.includes(kind)) throw invalidRequest('unsupported-kind');

  const context = parsed.context && typeof parsed.context === 'object' && !Array.isArray(parsed.context) ? parsed.context : null;
  if (!context) throw invalidRequest('missing-context');

  // Reject any field beyond kind/context (defense-in-depth: no raw trades, no
  // alternate accounts, no client-supplied instructions/provider/billing).
  const allowed = new Set(['kind', 'context']);
  const extra = Object.keys(parsed).filter((k) => !allowed.has(k));
  if (extra.length) throw scopeViolation(`unexpected-fields:${extra.join(',')}`);

  if (approxBytes(parsed) > MAX_CONTEXT_BYTES) throw invalidRequest('context-too-large');

  return { kind, context };
}