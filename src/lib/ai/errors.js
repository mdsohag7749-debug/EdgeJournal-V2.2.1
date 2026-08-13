// Controlled AI error model. The ONLY way failures leave the AI layer is as an
// AIError carrying one of the AI_ERROR_CODES — never a raw provider/HTTP error
// that could leak an internal hostname, status text, or key material.

import { AI_ERROR_CODES } from './types.js';

export class AIError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    if (options.detail !== undefined) this.detail = options.detail;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

export function isAIError(error) {
  return error instanceof AIError;
}

export function aiError(code, message, options) {
  return new AIError(code, message, options);
}

export function aiAccountScopeError(detail) {
  return new AIError(
    AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR,
    'Account isolation: the requested trades do not belong to the selected account.',
    { detail }
  );
}

export function aiNotConfiguredError() {
  return new AIError(
    AI_ERROR_CODES.AI_NOT_CONFIGURED,
    'Edge AI is not configured yet. No account data was sent to any provider.'
  );
}

// Maps an arbitrary thrown value (provider HTTP error, timeout, rate limit,
// JSON parse failure, etc.) onto a safe, application-level AIError. Heuristic
// classification for the common cases; everything else becomes a generic
// AI_PROVIDER_ERROR. The original message is never placed in the user-facing
// message — it is kept only as an opaque diagnostic `detail`.
export function toSafeAIError(error) {
  if (isAIError(error)) return error;

  const raw = error instanceof Error ? error.message : String(error);
  const text = String(raw || '');

  let code = AI_ERROR_CODES.AI_PROVIDER_ERROR;
  if (/tim(e|ed)? ?out|exceeded|aborted/i.test(text)) {
    code = AI_ERROR_CODES.AI_TIMEOUT;
  } else if (/rate\s?limit|too many|429/i.test(text)) {
    code = AI_ERROR_CODES.AI_RATE_LIMITED;
  }

  return new AIError(
    code,
    'AI provider could not complete the request. Please try again later.',
    { detail: text }
  );
}

// Holds the outcome of an AI attempt in the shape consumers can render
// without catching — no raw provider data, ever.
export function toSafeAIResult(error) {
  const normalized = toSafeAIError(error);
  return {
    ok: false,
    status: normalized.code,
    message: normalized.message,
    analysis: null,
  };
}