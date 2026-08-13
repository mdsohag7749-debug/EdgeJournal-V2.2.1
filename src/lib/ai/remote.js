// Client-side remote provider bridge (Sprint 9.6).
//
// Turns the existing provider abstraction's "remote" adapter into a call to
// OUR OWN server endpoint (/api/ai/analyze, /api/ai/health). The browser never
// contains (or receives) the provider secret:
//   - the private key stays in server env vars only
//   - only `{ kind, context }` crosses the wire (no system prompts, no
//     sanitizer functions, no raw trades beyond the context the existing
//     features already build
//   - failures are normalized into the EXISTING controlled AI error codes
//   - the server response is re-validated by the client's normal sanitizer
//     pipeline (defense in depth), because createAIProvider() always sanitizes

import { AIError } from './errors';
import { AI_ERROR_CODES, AI_STATUS_OK } from './types';

const HEALTH_URL = '/api/ai/health';
const ANALYZE_URL = '/api/ai/analyze';

const DEFAULT_ANALYZE_TIMEOUT_MS = 45000;
const DEFAULT_HEALTH_TIMEOUT_MS = 5000;

// Builds the serializable payload the server will accept. Only kind + context
// leave the browser — never the system prompt, never the sanitizer, never any
// provider credential.
function serializeRequest(request = {}) {
  if (!request || typeof request !== 'object') return { kind: null, context: null };
  return { kind: request.kind ?? null, context: request.context ?? null };
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function mapServerFailure(body, response) {
  const status = body && typeof body.status === 'string' ? body.status : AI_ERROR_CODES.AI_PROVIDER_ERROR;
  // The server owns user-facing copy; the client never echoes body.message
  // verbatim (defense in depth against any future leak), but preserves the
  // controlled status code so the UI can render the right state.
  return new AIError(status, 'AI provider did not complete the request. Please try again later.', {
    detail: `http=${response?.status ?? 0}`,
  });
}

export function createRemoteAdapter({
  analyzeTimeoutMs = DEFAULT_ANALYZE_TIMEOUT_MS,
  healthTimeoutMs = DEFAULT_HEALTH_TIMEOUT_MS,
} = {}) {
  return {
    async analyze(config, request) {
      const payload = serializeRequest(request);
      let response;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), analyzeTimeoutMs);
      try {
        try {
          response = await fetch(ANALYZE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
            credentials: 'same-origin',
          });
        } catch (err) {
          const aborted = err && (err.name === 'AbortError' || /abort/i.test(String(err?.message || err)));
          throw new AIError(
            aborted ? AI_ERROR_CODES.AI_TIMEOUT : AI_ERROR_CODES.AI_UNAVAILABLE,
            aborted ? 'AI provider timed out. Please try again later.' : 'EdgeJournal AI is temporarily unreachable. Please try again later.',
            { detail: aborted ? 'timeout' : 'network' }
          );
        }
      } finally {
        clearTimeout(timer);
      }

      const body = await readJson(response);
      if (!body || body.ok !== true || !body.analysis) {
        throw mapServerFailure(body, response);
      }
      // Return the raw (already server-sanitized) analysis; createAIProvider()
      // re-sanitizes it through the feature contract as a second gate.
      return body.analysis;
    },

    async healthCheck(config) {
      const probe = await fetchRemoteHealth({ timeoutMs: healthTimeoutMs });
      const enabled = probe.ok && probe.enabled === true;
      const ready = probe.ok && probe.enabled === true && probe.ready === true;
      return {
        ok: ready,
        enabled,
        ready,
        status: ready ? AI_STATUS_OK : enabled ? AI_ERROR_CODES.AI_UNAVAILABLE : AI_ERROR_CODES.AI_NOT_CONFIGURED,
      };
    },
  };
}

// Public health probe used by the Edge AI command center status indicator.
// Returns { ok, enabled, ready } — `ok:false` means the bridge itself is
// unreachable (UNAVAILABLE), never a leak of provider internals.
export async function fetchRemoteHealth({ timeoutMs = DEFAULT_HEALTH_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetch(HEALTH_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        credentials: 'same-origin',
        cache: 'no-store',
      });
    } catch {
      return { ok: false, enabled: false, ready: false };
    }
    const body = await readJson(response);
    if (!body) return { ok: true, enabled: false, ready: false };
    return { ok: true, enabled: body.enabled === true, ready: body.ready === true };
  } finally {
    clearTimeout(timer);
  }
}

// Maps a raw probe to the safe user-facing status vocabulary used by the UI:
// 'READY' | 'NOT_CONFIGURED' | 'UNAVAILABLE'. Pure + unit-testable.
export function interpretHealthProbe(probe = {}) {
  if (probe.ok !== true) return 'UNAVAILABLE';
  if (probe.enabled !== true) return 'NOT_CONFIGURED';
  if (probe.ready !== true) return 'UNAVAILABLE';
  return 'READY';
}