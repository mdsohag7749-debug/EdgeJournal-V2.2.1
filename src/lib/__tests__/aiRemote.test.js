// Client remote bridge tests (Sprint 9.6).
//
// Covers src/lib/ai/remote.js — the browser half of the secure bridge. The
// client talks ONLY to OUR OWN /api/ai/* endpoints and crosses the wire with
// `{ kind, context }` exclusively: no system prompts, no sanitizer functions,
// no raw trades beyond the account-scoped context the features already build,
// and never any provider credential. Server failures are re-mapped onto the
// existing controlled AI error codes, and the provider layer re-sanitizes the
// server response as a second gate.

import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  createRemoteAdapter,
  fetchRemoteHealth,
  interpretHealthProbe,
} from '../ai/remote';
import { createAIProvider } from '../ai/provider';
import { AIError } from '../ai/errors';
import { AI_ERROR_CODES, AI_STATUS_OK } from '../ai/types';

const ANALYZE_URL = '/api/ai/analyze';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

// Stubs the global fetch, records every outgoing request, and drives the
// per-request response through the provided handler (same pattern as the
// server test file, but at the window/fetch boundary the client hits).
function mockFetch(handler) {
  const calls = [];
  const fetchMock = vi.fn(async (url, opts) => {
    calls.push({ url, opts });
    return handler({ url, opts });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

function journalRequest(overrides = {}) {
  return {
    kind: 'journalIntelligence',
    context: { account: { id: 'acc-1' }, summary: { total: 3, netPnl: 120 } },
    ...overrides,
  };
}

// A server-normalized analysis response (what OUR analyze endpoint returns).
function serverOkAnalysis() {
  return {
    summary: 'Canonical metrics reviewed.',
    strengths: ['Followed the plan'],
    weaknesses: ['Over-traded'],
    confidence: 0.55,
    disclaimer: 'Advisory only.',
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('A — Wire contract: only { kind, context } leaves the browser', () => {
  it('analyze() POSTs to /api/ai/analyze with JSON headers and no credentials', async () => {
    const { calls } = mockFetch(() => jsonResponse(200, { ok: true, status: AI_STATUS_OK, analysis: serverOkAnalysis() }));
    const adapter = createRemoteAdapter({ analyzeTimeoutMs: 5000, healthTimeoutMs: 5000 });

    await adapter.analyze({}, journalRequest({ sanitize: () => ({}), prompt: 'SHOULD-NOT-SEND' }));
    const { url, opts } = calls[0];
    expect(url).toBe(ANALYZE_URL);
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toContain('application/json');
    expect(opts.headers.Accept).toContain('application/json');
    expect(opts.credentials).toBe('same-origin');
    expect(opts.headers.Authorization).toBeUndefined();
  });

  it('serializes ONLY kind + context — no prompt, sanitizer, or extra fields', async () => {
    const { calls } = mockFetch(() => jsonResponse(200, { ok: true, status: AI_STATUS_OK, analysis: serverOkAnalysis() }));
    const adapter = createRemoteAdapter({ analyzeTimeoutMs: 5000, healthTimeoutMs: 5000 });

    await adapter.analyze(
      {},
      journalRequest({ sanitize: () => ({}), prompt: 'secret-prompt', systemPrompt: 'hidden', tracer: 'x' })
    );

    const body = JSON.parse(calls[0].opts.body);
    expect(body).toEqual({ kind: 'journalIntelligence', context: journalRequest().context });
    expect(JSON.stringify(body)).not.toMatch(/prompt|sanitize|systemPrompt|tracer|sk-|Bearer|api[_-]?key/);
  });

  it('empty/malformed requests still serialize to the two allowed fields', async () => {
    const { calls } = mockFetch(() => jsonResponse(200, { ok: true, status: AI_STATUS_OK, analysis: serverOkAnalysis() }));
    const adapter = createRemoteAdapter({ analyzeTimeoutMs: 5000, healthTimeoutMs: 5000 });

    await adapter.analyze({}, null);
    const body = JSON.parse(calls[0].opts.body);
    expect(Object.keys(body).sort()).toEqual(['context', 'kind']);
    expect(body.context).toBeNull();
  });
});

describe('B — Successful analysis round-trip', () => {
  it('adapter returns the server-sanitized analysis directly', async () => {
    const analysis = serverOkAnalysis();
    mockFetch(() => jsonResponse(200, { ok: true, status: AI_STATUS_OK, analysis }));
    const adapter = createRemoteAdapter({ analyzeTimeoutMs: 5000, healthTimeoutMs: 5000 });

    const raw = await adapter.analyze({}, journalRequest());
    expect(raw).toEqual(analysis);
  });

  it('the provider layer re-sanitizes the server analysis through the client contract', async () => {
    mockFetch(() => jsonResponse(200, { ok: true, status: AI_STATUS_OK, analysis: serverOkAnalysis() }));
    const provider = createAIProvider({ enabled: true, provider: 'remote', timeoutMs: 5000 });

    const result = await provider.analyze(journalRequest());
    expect(result.ok).toBe(true);
    expect(result.status).toBe(AI_STATUS_OK);
    expect(result.analysis.summary).toBe('Canonical metrics reviewed.');
    expect(result.analysis.confidence).toBe(0.55);
  });
});

describe('C — Server failure normalization (controlled codes, no leaks)', () => {
  it('maps a NOT_CONFIGURED body to the same status through analyze()', async () => {
    mockFetch(() =>
      jsonResponse(200, { ok: false, status: AI_ERROR_CODES.AI_NOT_CONFIGURED, message: 'EdgeJournal AI is not configured yet.' })
    );
    const provider = createAIProvider({ enabled: true, provider: 'remote', timeoutMs: 5000 });

    const result = await provider.analyze(journalRequest());
    expect(result.ok).toBe(false);
    expect(result.status).toBe(AI_ERROR_CODES.AI_NOT_CONFIGURED);
    expect(result.analysis).toBeNull();
  });

  it('maps an ACCOUNT_SCOPE_ERROR body to the controlled scope error', async () => {
    mockFetch(() =>
      jsonResponse(200, { ok: false, status: AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR, message: 'Account isolation: outside scope.' })
    );
    const provider = createAIProvider({ enabled: true, provider: 'remote', timeoutMs: 5000 });

    const result = await provider.analyze(journalRequest());
    expect(result.status).toBe(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR);
  });

  it('never leaks the raw server/detail text to consumers', async () => {
    mockFetch(() =>
      jsonResponse(200, { ok: false, status: AI_ERROR_CODES.AI_PROVIDER_ERROR, message: 'sk-realsecret123456 exploded (bucket b-7)' })
    );
    const provider = createAIProvider({ enabled: true, provider: 'remote', timeoutMs: 5000 });

    const result = await provider.analyze(journalRequest());
    expect(result.ok).toBe(false);
    expect(result.message).not.toMatch(/sk-realsecret|exploded|bucket|b-7/);
  });

  it('throws a controlled AIError from the adapter when the body is malformed', async () => {
    mockFetch(() => jsonResponse(200, { ok: false }));
    const adapter = createRemoteAdapter({ analyzeTimeoutMs: 5000, healthTimeoutMs: 5000 });

    await expect(adapter.analyze({}, journalRequest())).rejects.toBeInstanceOf(AIError);
    await expect(adapter.analyze({}, journalRequest())).rejects.toMatchObject({
      code: AI_ERROR_CODES.AI_PROVIDER_ERROR,
    });
  });
});

describe('D — Network failure and timeout classification', () => {
  it('a rejected fetch becomes AI_UNAVAILABLE (never a raw TypeError)', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    const provider = createAIProvider({ enabled: true, provider: 'remote', timeoutMs: 5000 });

    const result = await provider.analyze(journalRequest());
    expect(result.ok).toBe(false);
    expect(result.status).toBe(AI_ERROR_CODES.AI_UNAVAILABLE);
  });

  it('an abort/AbortError is classified as AI_TIMEOUT', async () => {
    const err = new Error('The operation was aborted due to timeout');
    err.name = 'AbortError';
    mockFetch(() => Promise.reject(err));
    const provider = createAIProvider({ enabled: true, provider: 'remote', timeoutMs: 5000 });

    const result = await provider.analyze(journalRequest());
    expect(result.status).toBe(AI_ERROR_CODES.AI_TIMEOUT);
  });
});

describe('E — Health probe + status vocabulary', () => {
  it('fetchRemoteHealth() returns { ok, enabled, ready } on a ready server', async () => {
    mockFetch(() => jsonResponse(200, { enabled: true, ready: true }));
    const probe = await fetchRemoteHealth({ timeoutMs: 5000 });
    expect(probe).toEqual({ ok: true, enabled: true, ready: true });
  });

  it('a configured-but-unready server reports enabled true, ready false', async () => {
    mockFetch(() => jsonResponse(200, { enabled: true, ready: false }));
    const probe = await fetchRemoteHealth({ timeoutMs: 5000 });
    expect(probe).toEqual({ ok: true, enabled: true, ready: false });
  });

  it('a disabled server reports enabled false without an error', async () => {
    mockFetch(() => jsonResponse(200, { enabled: false, ready: false }));
    const probe = await fetchRemoteHealth({ timeoutMs: 5000 });
    expect(probe).toEqual({ ok: true, enabled: false, ready: false });
  });

  it('an unreachable bridge reports ok:false (UNAVAILABLE) — no crash', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    const probe = await fetchRemoteHealth({ timeoutMs: 5000 });
    expect(probe).toEqual({ ok: false, enabled: false, ready: false });
  });

  it('interpretHealthProbe() maps probes to the safe UI vocabulary', () => {
    expect(interpretHealthProbe({ ok: true, enabled: true, ready: true })).toBe('READY');
    expect(interpretHealthProbe({ ok: true, enabled: true, ready: false })).toBe('UNAVAILABLE');
    expect(interpretHealthProbe({ ok: true, enabled: false, ready: false })).toBe('NOT_CONFIGURED');
    expect(interpretHealthProbe({ ok: false, enabled: false, ready: false })).toBe('UNAVAILABLE');
    expect(interpretHealthProbe({})).toBe('UNAVAILABLE');
  });
});