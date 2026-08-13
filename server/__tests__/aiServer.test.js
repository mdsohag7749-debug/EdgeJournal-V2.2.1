// Server AI bridge tests (Sprint 9.6).
//
// Covers the secure server-side provider path: config state, the Gemini
// adapter (timeout / rate limit / provider error normalization), the provider
// dispatcher, the analyze + health handlers, request schema whitelisting,
// account isolation (structural + binding), response sanitization/contract
// enforcement, and the "system prompt stays server-side" guarantee.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { createAIConfig } from '../ai/config';
import { createGeminiAdapter } from '../ai/adapters/gemini';
import { createServerAIProvider, runServerAnalysis, runServerHealth } from '../ai/provider';
import { sanitizeForKind } from '../ai/safety';
import { handleAnalyze } from '../ai/analyzeHandler';
import { handleHealth } from '../ai/healthHandler';
import { sanitizeAnalyzeRequest, AI_REQUEST_KINDS } from '../ai/requestSchema';
import { systemPromptFor, AI_MASTER_SYSTEM_INSTRUCTION } from '../ai/prompts';
import { createRateLimiter } from '../ai/rateLimit';
import { resolveAccountScope } from '../ai/accountScope';
import { AIError, AI_ERROR_CODES, AI_STATUS_OK } from '../ai/errors';

const JOURNAL_KIND = 'journalIntelligence';
const TRADE_KIND = 'tradeReview';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

// Records every call + lets a test provide a per-request handler.
function fakeFetcher(handler) {
  const calls = [];
  const fetcher = async (url, opts) => {
    calls.push({ url, opts });
    return handler({ url, opts });
  };
  fetcher.calls = calls;
  return fetcher;
}

// A fetcher that only ever rejects on abort (deterministic timeout test).
function hangUntilAbort() {
  return (_url, opts) =>
    new Promise((_resolve, reject) => {
      const signal = opts && opts.signal;
      if (!signal) {
        reject(new Error('no abort signal'));
        return;
      }
      const onAbort = () => {
        const e = new Error('aborted');
        e.name = 'AbortError';
        reject(e);
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    });
}

function baseEnv(overrides = {}) {
  return {
    AI_ENABLED: 'true',
    AI_PROVIDER: 'gemini',
    GEMINI_API_KEY: 'test-gemini-key',
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
    ...overrides,
  };
}

function journalContext(overrides = {}) {
  return {
    account: { id: 'acc-1', name: 'Main' },
    scope: { label: 'All Time' },
    dataQuality: { tradeCount: 3, coverage: 'LIMITED_DATA', limitations: [] },
    summary: { total: 3, netPnl: 120 },
    ...overrides,
  };
}

function tradeContext(overrides = {}) {
  return {
    trade: { id: 't-1', instrument: 'EURUSD', result: 'Win' },
    calculations: { pnl: 80, realizedRR: 2 },
    metadata: { accountId: 'acc-1', accountName: 'Main' },
    ...overrides,
  };
}

function okAnalysisContent(payload) {
  return JSON.stringify({
    summary: 'Canonical metrics reviewed.',
    strengths: ['Followed the plan'],
    confidence: 0.55,
    disclaimer: 'Advisory only.',
    dataQuality: { limitations: [] },
    ...payload,
  });
}

// Gemini generateContent success body: candidates[].content.parts[].text.
function geminiResponse(text) {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

describe('A — Server config (Sprint 9.6)', () => {
  it('defaults to disabled when AI_ENABLED is unset/false', () => {
    const cfg = createAIConfig({});
    expect(cfg.enabled).toBe(false);
    expect(cfg.provider).toBe('none');
    expect(cfg.configured).toBe(false);
  });

  it('missing API key ⇒ enabled but NOT configured', () => {
    const cfg = createAIConfig({ AI_ENABLED: 'true', AI_PROVIDER: 'gemini' });
    expect(cfg.enabled).toBe(true);
    expect(cfg.provider).toBe('gemini');
    expect(cfg.configured).toBe(false);
  });

  it('valid key ⇒ configured state (ready to run)', () => {
    const cfg = createAIConfig(baseEnv());
    expect(cfg.enabled).toBe(true);
    expect(cfg.configured).toBe(true);
    expect(cfg.geminiKey).toBe('test-gemini-key');
  });

  it('resolves plan tier for future billing (free/pro/premium, no enforcement)', () => {
    expect(createAIConfig(baseEnv({ AI_PLAN: 'premium' })).planTier).toBe('premium');
    expect(createAIConfig(baseEnv({ AI_PLAN: '' })).planTier).toBe('free');
  });
});

describe('B — Server provider / adapter registry', () => {
  it('server provider loads a concrete adapter for gemini when key is present', () => {
    const provider = createServerAIProvider(createAIConfig(baseEnv()));
    expect(typeof provider.analyze).toBe('function');
    expect(typeof provider.healthCheck).toBe('function');
  });

  it('unknown/missing provider degrades to AI_UNAVAILABLE, never fabricates', async () => {
    const provider = createServerAIProvider({ provider: 'none' });
    await expect(provider.analyze({})).rejects.toMatchObject({ code: AI_ERROR_CODES.AI_UNAVAILABLE });
    const health = await provider.healthCheck();
    expect(health.ok).toBe(false);
  });

  it('runServerAnalysis returns a controlled envelope on provider error (no raw leak)', async () => {
    const fetcher = fakeFetcher(() => jsonResponse(500, { error: { message: 'sku-mark exploded: sk-realsecret1234567' } }));
    const cfg = createAIConfig(baseEnv({ GEMINI_ENDPOINT: 'https://fake' }));
    const out = await runServerAnalysis({ kind: JOURNAL_KIND, context: journalContext(), prompt: 'p', cfg, fetcher });
    expect(out.ok).toBe(false);
    expect(out.status).toBe(AI_ERROR_CODES.AI_PROVIDER_ERROR);
    expect(out.message).not.toMatch(/sku-mark|sk-realsecret|exploded/);
    expect(out.analysis).toBeNull();
  });

  it('runServerAnalysis normalizes a bad provider key to NOT_CONFIGURED', async () => {
    const fetcher = fakeFetcher(() => jsonResponse(401, { error: { message: 'invalid api key' } }));
    const cfg = createAIConfig(baseEnv({ GEMINI_ENDPOINT: 'https://fake' }));
    const out = await runServerAnalysis({ kind: JOURNAL_KIND, context: journalContext(), prompt: 'p', cfg, fetcher });
    expect(out.ok).toBe(false);
    expect(out.status).toBe(AI_ERROR_CODES.AI_NOT_CONFIGURED);
  });
});

describe('C — Health endpoint', () => {
  it('disabled ⇒ { enabled:false, ready:false }', async () => {
    const out = await handleHealth({ source: {}, ip: 'h1' });
    expect(out.status).toBe(200);
    expect(out.json).toEqual({ enabled: false, ready: false });
  });

  it('enabled with missing key ⇒ { enabled:true, ready:false }', async () => {
    const out = await handleHealth({ source: { AI_ENABLED: 'true', AI_PROVIDER: 'gemini' }, ip: 'h2' });
    expect(out.json).toEqual({ enabled: true, ready: false });
  });

  it('enabled + configured + provider health ok ⇒ ready:true', async () => {
    const fetcher = fakeFetcher(() => jsonResponse(200, { models: [{ name: 'models/gemini-3.5-flash-lite' }] }));
    const out = await handleHealth({ source: baseEnv(), ip: 'h3', fetcher });
    expect(out.json).toEqual({ enabled: true, ready: true });
  });

  it('provider unavailable ⇒ ready:false, no provider diagnostics', async () => {
    const fetcher = fakeFetcher(() => jsonResponse(503, { error: { message: 'sk-internal exploded' } }));
    const out = await handleHealth({ source: baseEnv(), ip: 'h4', fetcher });
    expect(out.json).toEqual({ enabled: true, ready: false });
    expect(JSON.stringify(out.json)).not.toMatch(/sk-|exploded|internal/);
  });

  it('health response never exposes the API key or env values', async () => {
    const fetcher = fakeFetcher(() => jsonResponse(200, { models: [{ name: 'models/gemini-3.5-flash-lite' }] }));
    const out = await handleHealth({ source: baseEnv(), ip: 'h5', fetcher });
    const text = JSON.stringify(out.json);
    expect(text).not.toMatch(/sk-|GEMINI_API_KEY|AI_PROVIDER|GEMINI_MODEL/);
  });
});

describe('D — Analyze endpoint: request schema + whitelist', () => {
  it('accepts exactly { kind, context } for every supported kind', () => {
    for (const kind of AI_REQUEST_KINDS) {
      const parsed = sanitizeAnalyzeRequest({ kind, context: { anything: true } });
      expect(parsed.kind).toBe(kind);
      expect(parsed.context.anything).toBe(true);
    }
  });

  it('rejects unknown kinds before any provider contact', () => {
    expect(() => sanitizeAnalyzeRequest({ kind: 'trade' })).toThrow(AIError);
    expect(() => sanitizeAnalyzeRequest({ kind: 'stockTip' })).toThrow(AIError);
  });

  it('rejects raw trade rows / extra fields as an account-scope violation', () => {
    try {
      sanitizeAnalyzeRequest({
        kind: JOURNAL_KIND,
        context: journalContext(),
        trades: [{ id: 't-x', accountId: 'acc-1' }, { id: 't-y', accountId: 'acc-2' }],
      });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e.code).toBe(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR);
    }
  });

  it('rejects non-POST methods', async () => {
    const out = await handleAnalyze({ method: 'GET', data: '{}', source: baseEnv(), ip: 'd1' });
    expect(out.status).toBe(405);
  });

  it('invalid JSON body → 400 with a safe generic message', async () => {
    const out = await handleAnalyze({ method: 'POST', data: '{not json', source: baseEnv(), ip: 'd2' });
    expect(out.status).toBe(400);
    expect(out.json.message).toBe('AI request could not be processed.');
    expect(out.json.analysis).toBeNull();
  });

  it('rejects an oversized context payload', async () => {
    const big = journalContext({ summary: { total: 1, netPnl: 'x'.repeat(600000) } });
    expect(() => sanitizeAnalyzeRequest({ kind: JOURNAL_KIND, context: big })).toThrow(AIError);
  });
});

describe('E — Account isolation at the server', () => {
  it('not-configured requests never touch the provider (NOT_CONFIGURED first)', async () => {
    const out = await handleAnalyze({
      method: 'POST',
      data: JSON.stringify({ kind: JOURNAL_KIND, context: journalContext({ account: { id: 'acc-1' } }) }),
      source: { AI_ENABLED: 'true', AI_PROVIDER: 'gemini' },
      ip: 'e0',
    });
    expect(out.status).toBe(200);
    expect(out.json.status).toBe(AI_ERROR_CODES.AI_NOT_CONFIGURED);
  });

  it('journal/coaching/ask context without an account id → SCOPE_ERROR', async () => {
    for (const kind of ['journalIntelligence', 'coaching', 'askJournal']) {
      const ctx = kind === 'journalIntelligence' ? journalContext({ account: {} }) : { account: {}, scope: {} };
      const out = await handleAnalyze({
        method: 'POST',
        data: JSON.stringify({ kind, context: ctx }),
        source: baseEnv(),
        ip: `e1-${kind}`,
      });
      expect(out.status).toBe(403);
      expect(out.json.status).toBe(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR);
      expect(out.json.message).not.toMatch(/acc-1|account id|expected/);
    }
  });

  it('trade review without scoped metadata → SCOPE_ERROR', async () => {
    const out = await handleAnalyze({
      method: 'POST',
      data: JSON.stringify({ kind: TRADE_KIND, context: tradeContext({ metadata: {} }) }),
      source: baseEnv(),
      ip: 'e2',
    });
    expect(out.status).toBe(403);
    expect(out.json.status).toBe(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR);
  });

  it('binding: account not owned by the authenticated user → SCOPE_ERROR', async () => {
    const supabaseFactory = () => ({
      createClient: () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'u-owner' } }, error: null }) },
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            }),
          }),
        }),
      }),
    });
    const out = await handleAnalyze({
      method: 'POST',
      data: JSON.stringify({ kind: JOURNAL_KIND, context: journalContext({ account: { id: 'acc-999' } }) }),
      source: baseEnv({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc-secret' }),
      authorization: 'Bearer user-token',
      ip: 'e3',
      supabaseFactory,
      fetcher: fakeFetcher(() => jsonResponse(200, geminiResponse(okAnalysisContent()))),
    });
    expect(out.status).toBe(403);
    expect(out.json.status).toBe(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR);
    expect(out.json.message).not.toMatch(/acc-999|u-owner|svc-secret|user-token/);
  });

  it('binding: owned account passes and analysis succeeds', async () => {
    const supabaseFactory = () => ({
      createClient: () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'u-owner' } }, error: null }) },
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: { id: 'acc-1' }, error: null }) }),
            }),
          }),
        }),
      }),
    });
    const fetcher = fakeFetcher(() => jsonResponse(200, geminiResponse(okAnalysisContent())));
    const out = await handleAnalyze({
      method: 'POST',
      data: JSON.stringify({ kind: JOURNAL_KIND, context: journalContext() }),
      source: baseEnv({ GEMINI_ENDPOINT: 'https://fake', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc-secret' }),
      authorization: 'Bearer user-token',
      ip: 'e4',
      supabaseFactory,
      fetcher,
    });
    expect(out.status).toBe(200);
    expect(out.json.ok).toBe(true);
    expect(out.json.analysis.summary).toContain('Canonical metrics reviewed');
  });

  it('resolveAccountScope: structural fallback returns the single account id', async () => {
    const scope = await resolveAccountScope({ kind: JOURNAL_KIND, context: journalContext(), cfg: { supabaseUrl: '', supabaseServiceRoleKey: '' } });
    expect(scope.accountId).toBe('acc-1');
  });
});

describe('F — Provider behavior: timeout', () => {
  it('a non-responding provider is normalized to AI_TIMEOUT', async () => {
    const adapter = createGeminiAdapter({ apiKey: 'test-gemini-key', timeoutMs: 25, fetcher: hangUntilAbort() });
    await expect(adapter.analyze({ prompt: 'p', context: {} })).rejects.toMatchObject({ code: AI_ERROR_CODES.AI_TIMEOUT });
  });
});

describe('G — Response safety (reuses existing sanitizers)', () => {
  it('drops structural signal/guarantee fields on the base contract', () => {
    const out = sanitizeForKind(TRADE_KIND, {
      summary: 'ok',
      signal: 'BUY EURUSD',
      guaranteedProfit: 'yes',
      prediction: 'price will rise',
      unknown: 'dropped',
    });
    expect(out).not.toHaveProperty('signal');
    expect(out).not.toHaveProperty('guaranteedProfit');
    expect(out).not.toHaveProperty('prediction');
    expect(out).not.toHaveProperty('unknown');
    expect(out.summary).toBe('ok');
  });

  it('rejects directive language in journal output (buy now)', () => {
    expect(() => sanitizeForKind(JOURNAL_KIND, { summary: 'buy now for a sure win', confidence: 1 })).toThrow(AIError);
  });

  it('rejects directive / guarantee language in trade review output (base contract)', () => {
    expect(() => sanitizeForKind(TRADE_KIND, { summary: 'Buy now and lock in guaranteed profit.' })).toThrow(AIError);
    expect(() => sanitizeForKind(TRADE_KIND, { observations: ['go long for the session'] })).toThrow(AIError);
    expect(() => sanitizeForKind(TRADE_KIND, { risks: ['increase your risk on the next setup'] })).toThrow(AIError);
    expect(() => sanitizeForKind(TRADE_KIND, { improvements: ['100% profit guaranteed'] })).toThrow(AIError);
  });

  it('rejects guarantee language in coaching output (guaranteed profit)', () => {
    expect(() => sanitizeForKind('coaching', { summary: 'guaranteed profit strategy' })).toThrow(AIError);
  });

  it('rejects directive language in ask-journal output (sell now)', () => {
    expect(() => sanitizeForKind('askJournal', { answer: 'sell now to lock gains' })).toThrow(AIError);
  });

  it('rejects non-object provider payloads as AI_INVALID_RESPONSE', async () => {
    const out = await runServerAnalysis({
      kind: JOURNAL_KIND,
      context: journalContext(),
      prompt: 'p',
      cfg: createAIConfig(baseEnv({ GEMINI_ENDPOINT: 'https://fake' })),
      fetcher: fakeFetcher(() => jsonResponse(200, geminiResponse('not json'))),
    });
    expect(out.ok).toBe(false);
    expect(out.status).toBe(AI_ERROR_CODES.AI_INVALID_RESPONSE);
  });
});

describe('H — System prompt stays server-side', () => {
  it('prompts module composes the master + kind instruction', () => {
    const prompt = systemPromptFor(JOURNAL_KIND);
    expect(prompt).toContain(AI_MASTER_SYSTEM_INSTRUCTION);
    expect(prompt).toContain('You are EdgeJournal AI, a trading journal analyst');
    expect(prompt).not.toMatch(/sk-|api[_-]?key|Bearer/);
  });

  it('the master instruction exists ONLY under server/, never in client source', () => {
    const clientDir = join(__dirname, '../../src/lib/ai');
    const files = readdirSync(clientDir).filter((f) => f.endsWith('.js'));
    const marker = 'Never claim certainty about future market outcomes';
    for (const file of files) {
      const source = readFileSync(join(clientDir, file), 'utf8');
      expect(source, `${file} leaked the master system prompt`).not.toContain(marker);
    }
    const serverSource = readFileSync(join(__dirname, '../ai/prompts.js'), 'utf8');
    expect(serverSource).toContain(marker);
  });
});

describe('I — Rate limit / abuse guard', () => {
  it('bounded limiter rejects after the cap and recovers after the window', () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 60000 });
    const t = 1_000_000;
    expect(limiter.tryConsume('k', t)).toBe(true);
    expect(limiter.tryConsume('k', t)).toBe(true);
    expect(limiter.tryConsume('k', t)).toBe(false);
    expect(limiter.tryConsume('k', t + 60000)).toBe(true);
  });

  it('analyze handler normalizes a request storm to AI_RATE_LIMITED (429)', async () => {
    const source = { AI_ENABLED: 'true', AI_PROVIDER: 'gemini', AI_RATE_LIMIT_MAX: '3' };
    const payload = JSON.stringify({ kind: JOURNAL_KIND, context: journalContext({ account: { id: 'acc-1' } }) });
    for (let i = 0; i < 3; i += 1) {
      await handleAnalyze({ method: 'POST', data: payload, source, ip: 'rate-ip-a' });
    }
    const fourth = await handleAnalyze({ method: 'POST', data: payload, source, ip: 'rate-ip-a' });
    expect(fourth.status).toBe(429);
    expect(fourth.json.status).toBe(AI_ERROR_CODES.AI_RATE_LIMITED);
    expect(fourth.json.message).not.toMatch(/429|rate|bucket/i);
  });

  it('handler never leaks the raw provider error message', async () => {
    const fetcher = fakeFetcher(() => jsonResponse(502, { error: { message: 'upstream sk-zzz-abcdefghijklmnop failed' } }));
    const out = await handleAnalyze({
      method: 'POST',
      data: JSON.stringify({ kind: JOURNAL_KIND, context: journalContext() }),
      source: baseEnv({ GEMINI_ENDPOINT: 'https://fake' }),
      ip: 'rate-ip-b',
      fetcher,
    });
    expect(out.status).toBe(200);
    expect(out.json.ok).toBe(false);
    expect(out.json.status).toBe(AI_ERROR_CODES.AI_PROVIDER_ERROR);
    expect(out.json.message).not.toMatch(/upstream|sk-zzz|abcdefghijklmnop|failed/);
  });
});

describe('J — End-to-end analyze response safety', () => {
  it('success returns a normalized analytical-only JSON response', async () => {
    const fetcher = fakeFetcher(() => jsonResponse(200, geminiResponse(okAnalysisContent())));
    const out = await handleAnalyze({
      method: 'POST',
      data: JSON.stringify({ kind: JOURNAL_KIND, context: journalContext() }),
      source: baseEnv({ GEMINI_ENDPOINT: 'https://fake' }),
      ip: 'j1',
      fetcher,
    });
    expect(out.status).toBe(200);
    expect(out.json.ok).toBe(true);
    expect(out.json.status).toBe(AI_STATUS_OK);
    expect(out.json.plan).toBe('free');
    expect(out.json.analysis.summary).toBe('Canonical metrics reviewed.');
    const text = JSON.stringify(out.json);
    expect(text).not.toMatch(/sk-|GEMINI_API_KEY|Bearer|api[_-]?key/);
  });

  it('the server prompt composes the full analytical contract on every call', async () => {
    const fetcher = fakeFetcher(({ opts }) => {
      const body = JSON.parse(opts.body);
      expect(body.systemInstruction.parts[0].text).toContain('Do not provide trading signals, predictions, guarantees');
      expect(body.contents[0].role).toBe('user');
      expect(body.contents[0].parts[0].text).toContain('canonical');
      return jsonResponse(200, geminiResponse(okAnalysisContent()));
    });
    const out = await handleAnalyze({
      method: 'POST',
      data: JSON.stringify({ kind: JOURNAL_KIND, context: journalContext() }),
      source: baseEnv({ GEMINI_ENDPOINT: 'https://fake' }),
      ip: 'j2',
      fetcher,
    });
    expect(out.json.ok).toBe(true);
  });

  it('the provider receives the canonical context verbatim — no re-calculation server-side', async () => {
    const canonicalContext = journalContext({
      account: { id: 'acc-1', name: 'Main' },
      summary: { total: 3, netPnl: 120 },
      dataQuality: { tradeCount: 3, coverage: 'LIMITED_DATA', limitations: [] },
    });
    let sentBody;
    const fetcher = fakeFetcher(({ opts }) => {
      sentBody = JSON.parse(opts.body);
      return jsonResponse(200, geminiResponse(okAnalysisContent()));
    });
    const out = await handleAnalyze({
      method: 'POST',
      data: JSON.stringify({ kind: JOURNAL_KIND, context: canonicalContext }),
      source: baseEnv({ GEMINI_ENDPOINT: 'https://fake' }),
      ip: 'j3',
      fetcher,
    });
    expect(out.json.ok).toBe(true);
    // The framed user part carries the exact canonical payload: the server
    // serializes the context as-is and never recomputes total/netPnl/etc.
    const userContent = sentBody.contents[0].parts[0].text;
    expect(userContent).toContain('"total":3');
    expect(userContent).toContain('"netPnl":120');
    expect(userContent).toContain('"id":"acc-1"');
  });
});