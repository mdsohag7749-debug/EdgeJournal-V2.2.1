import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { buildAITradeContext, assertAccountScoped } from '../ai/context';
import { createAIProvider, registerAIAdapter, resolveAIConfig } from '../ai/provider';
import { AIError, isAIError, toSafeAIError, toSafeAIResult, aiAccountScopeError } from '../ai/errors';
import {
  sanitizeResponse,
  validateResponseContract,
  assertResponseContract,
  isDeepFrozen,
  AI_SAFETY_RULES,
} from '../ai/safety';
import {
  AI_ERROR_CODES,
  AI_STATUS_OK,
  RESPONSE_CONTRACT,
  RESPONSE_KEYS,
  AI_DISCLAIMER,
} from '../ai/types';

// The AI module is loaded through its barrel export to prove the public
// surface works (same code path future Sprint 9 features use).
import * as aiPublic from '../ai/index';

const ACC_A = 'acc-0001';
const ACC_B = 'acc-0002';

// Canonical trade shape — mirrors fromTradeRow() in src/lib/tradesApi.js.
function makeTrade(overrides = {}) {
  return {
    id: 'trade-1',
    date: '2024-01-15',
    entryTime: '09:00',
    exitTime: '11:00',
    instrument: 'EURUSD',
    direction: 'Buy',
    session: 'London',
    timeframe: 'M15',
    model: 'Pullback',
    entryPrice: 1.09,
    exitPrice: 1.1,
    stopLoss: 1.085,
    takeProfit: 1.1,
    contracts: 1,
    riskPercent: 1,
    rr: 2.05,
    positionSize: 100000,
    netPnl: 80,
    commission: 0,
    result: 'Win',
    rating: 4,
    riskChecklist: { 'had stop': true },
    tradeChecklist: {},
    tradeGrade: 'A',
    emotion: 'Confident',
    mistakes: { 'Late Entry': true },
    confluences: '2:1 + trend',
    tradeManagement: 'Scaled at TP',
    notes: 'clean pullback',
    lessonsLearned: 'patience pays',
    screenshot: '',
    accountId: ACC_A,
    createdAt: '2024-01-15T09:00:00Z',
    tags: [],
    isFavorite: false,
    review: { reviewSummary: 'good', lessonLearned: 'wait' },
    psychology: { calm: 4 },
    ...overrides,
  };
}

// Pre-computed canonical metrics — what a caller hands in from the existing
// calculation engine; the AI layer must carry these verbatim, never recompute.
const canonical = {
  pnl: 80,
  pnlPercent: 0.8,
  riskDollar: 50,
  riskPercent: 1,
  lotSize: 100000,
  winLoss: 'Win',
  duration: '2h 0m',
  plannedRR: 2,
  realizedRR: 1.6,
  potentialProfit: 100,
};

function buildContext(trade, { account, accountName, calculations } = {}) {
  return buildAITradeContext({
    trade,
    accountId: account ?? ACC_A,
    accountName: accountName ?? null,
    calculations: calculations ?? null,
  });
}

// Always succeeds; used by the enabled-provider tests below.
registerAIAdapter('test-echo', {
  analyze: async (config, request) => ({ summary: `echo:${request?.prompt || 'none'}`, confidence: 0.5 }),
  healthCheck: async () => ({ ok: true, status: AI_STATUS_OK }),
});

// Throws a noisy provider-shaped error; used to prove normalization.
registerAIAdapter('test-fail', {
  analyze: async () => {
    throw new Error('provider exploded with secret-key-marker=abc123');
  },
});

// A: CONTEXT CREATION --------------------------------------------------------
describe('A — AI Context Builder', () => {
  it('exposes its API through the module barrel (public import surface)', () => {
    expect(aiPublic.buildAITradeContext).toBe(buildAITradeContext);
    expect(aiPublic.createAIProvider).toBe(createAIProvider);
    expect(aiPublic.AI_ERROR_CODES).toBe(AI_ERROR_CODES);
  });
  it('builds a complete, structured, account-scoped context from one trade', () => {
    const ctx = buildContext(makeTrade(), { account: ACC_A, accountName: 'Prop Firm 1', calculations: canonical });

    expect(ctx.trade.id).toBe('trade-1');
    expect(ctx.trade.pair).toBe('EURUSD');
    expect(ctx.trade.date).toBe('2024-01-15');
    expect(ctx.trade.session).toBe('London');
    expect(ctx.trade.direction).toBe('Buy');
    expect(ctx.trade.timeframe).toBe('M15');
    expect(ctx.trade.setup).toBe('Pullback');
    expect(ctx.trade.entry).toBe(1.09);
    expect(ctx.trade.stopLoss).toBe(1.085);
    expect(ctx.trade.takeProfit).toBe(1.1);
    expect(ctx.trade.exit).toBe(1.1);
    expect(ctx.trade.result).toBe('Win');
    expect(ctx.trade.notes).toBe('clean pullback');
    expect(ctx.trade.rating).toBe(4);

    // Only pre-computed canonical metrics cross the border, unchanged.
    expect(ctx.calculations).toEqual(canonical);

    expect(ctx.metadata).toEqual({ accountId: ACC_A, accountName: 'Prop Firm 1' });

    // Output is deeply frozen so no consumer can mutate journal data.
    expect(Object.isFrozen(ctx)).toBe(true);
    expect(Object.isFrozen(ctx.trade)).toBe(true);
    expect(Object.isFrozen(ctx.calculations)).toBe(true);
  });

  it('applies the AI-safe mapping (app trade shape -> AI keys)', () => {
    const ctx = buildContext(makeTrade({ model: 'Breakout', entryPrice: 1.5, exitPrice: 1.6 }));
    expect(ctx.trade.setup).toBe('Breakout');
    expect(ctx.trade.entry).toBe(1.5);
    expect(ctx.trade.exit).toBe(1.6);
  });
});

// B: MISSING FIELDS — `null` stays `null`, nothing invented
describe('B — Missing fields remain missing', () => {
  it('turns absent recorded values into null (never invented)', () => {
    const sparse = {
      id: 'trade-2',
      date: '2024-01-15',
      instrument: 'XAUUSD',
      accountId: ACC_A,
      // everything else intentionally absent
    };
    const ctx = buildAITradeContext({ trade: sparse, accountId: ACC_A, accountName: null, calculations: null });

    expect(ctx.trade.entry).toBeNull();
    expect(ctx.trade.stopLoss).toBeNull();
    expect(ctx.trade.setup).toBeNull();
    expect(ctx.trade.rr).toBeNull();
    expect(ctx.trade.psychology).toBeNull();
    // calculations stay empty when none were provided — never fabricate.
    expect(ctx.calculations).toEqual({});
    expect(ctx.metadata.accountName).toBeNull();
  });

  it('does not invent setup / outcome / psychology / market calls', () => {
    const ctx = buildContext(makeTrade({ model: '', direction: '', psychology: undefined }));
    expect(ctx.trade.setup).toBeNull();
    expect(ctx.trade.direction).toBeNull();
    expect(ctx.trade.psychology).toBeNull();
  });
});

// C: ACCOUNT ISOLATION — A only => A
describe('C — Account isolation', () => {
  it('always stamps metadata with the scoped account id', () => {
    const a = buildContext(makeTrade({ id: 't-a' }), { account: ACC_A });
    expect(a.metadata.accountId).toBe(ACC_A);
    expect(a.trade.accountId).toBeUndefined(); // raw owner id never leaks into AI keys
  });

  it('metadata carries the account name when provided', () => {
    const ctx = buildContext(makeTrade(), { account: ACC_A, accountName: 'My Prop' });
    expect(ctx.metadata.accountName).toBe('My Prop');
  });
});

// D: ACCOUNT MISMATCH REJECTION — controlled error, never mixed data
describe('D — Account mismatch rejection', () => {
  it('throws AI_ACCOUNT_SCOPE_ERROR on cross-account data', () => {
    expect(() => buildContext(makeTrade({ accountId: ACC_B }), { account: ACC_A })).toThrow(AIError);
    try {
      buildContext(makeTrade({ accountId: ACC_B }), { account: ACC_A });
    } catch (e) {
      expect(e instanceof AIError).toBe(true);
      expect(e.code).toBe(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR);
      expect(e.detail).toContain(ACC_A);
      expect(e.detail).toContain(ACC_B);
    }
  });

  it('assertAccountScoped() exposes the same guard for pre-flighting batches', () => {
    expect(() => assertAccountScoped(makeTrade({ accountId: ACC_B }), ACC_A)).toThrow(AIError);
    expect(() => assertAccountScoped(makeTrade({ accountId: ACC_A }), ACC_A)).not.toThrow();
  });

  it('aiAccountScopeError() builds the controlled error shape', () => {
    const err = aiAccountScopeError('expected=acc-1, trade=acc-2');
    expect(err.code).toBe(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR);
    expect(isAIError(err)).toBe(true);
  });
});

// E. CALCULATION VALUES PRESERVED — AI never becomes the source of truth
describe('E — Calculation values preserved', () => {
  it('passes canonical values through verbatim and never recomputes them', () => {
    const ctx = buildContext(makeTrade(), { calculations: canonical });
    expect(ctx.calculations.realizedRR).toBe(1.6);
    expect(ctx.calculations.plannedRR).toBe(2);
    expect(ctx.calculations.pnl).toBe(80);
    expect(ctx.calculations.duration).toBe('2h 0m');
    // No transformation, no clamping, no rounding — canonical numbers untouched.
    expect(ctx.calculations).toEqual(canonical);
  });

  it('omits calculation keys that were never provided', () => {
    const ctx = buildContext(makeTrade(), { calculations: { pnl: 80 } });
    expect(ctx.calculations).toEqual({ pnl: 80 });
    expect(ctx.calculations.realizedRR).toBeUndefined();
  });
});

// F. NO TRADE MUTATION — the input trade object must be untouched
describe('F — No trade mutation', () => {
  it('never mutates the input trade record', () => {
    const trade = makeTrade();
    const before = JSON.stringify(trade);
    const ctx = buildContext(trade, { calculations: canonical });
    expect(JSON.stringify(trade)).toBe(before);
    // The context is frozen, so downstream code cannot write back to journal data.
    expect(() => {
      'use strict';
      ctx.trade.notes = 'tampered';
    }).toThrow();
  });

  it('keeps the trade id unchanged in context', () => {
    const ctx = buildContext(makeTrade({ id: 'keep-me' }));
    expect(ctx.trade.id).toBe('keep-me');
  });
});

// G — AI DISABLED STATE (AI_ENABLED=false by default)
describe('G — AI disabled state (default: AI_ENABLED=false)', () => {
  it('a default provider is disabled and never talks to any provider', async () => {
    const provider = createAIProvider();
    expect(provider.isEnabled()).toBe(false);
    expect(provider.getStatus()).toMatchObject({ enabled: false, state: 'disabled' });
    const result = await provider.analyze({ trade: { id: 'x' } });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(AI_ERROR_CODES.AI_NOT_CONFIGURED);
    expect(result.analysis).toBeNull();

    const health = await provider.healthCheck();
    expect(health.ok).toBe(false);
    expect(health.status).toBe(AI_ERROR_CODES.AI_NOT_CONFIGURED);
  });

  it('resolveAIConfig() defaults to a closed, secret-free state', () => {
    const cfg = resolveAIConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.provider).toBe('none');
    expect(cfg.planTier).toBe('free');
    // never any key material in the resolved config surface
    expect(JSON.stringify(cfg)).not.toMatch(/key|secret|token/i);
  });

  it('an enabled provider routes through a registered adapter and reports ok', async () => {
    const provider = createAIProvider({ enabled: true, provider: 'test-echo' });
    expect(provider.isEnabled()).toBe(true);
    const result = await provider.analyze({ prompt: 'review this trade' });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(AI_STATUS_OK);
    expect(result.analysis.summary).toBe('echo:review this trade');
    expect(result.analysis.confidence).toBe(0.5);
    // every contract key is always present
    for (const key of RESPONSE_KEYS) expect(result.analysis).toHaveProperty(key);
  });
});

// H. ERROR NORMALIZATION — raw provider failure -> controlled app error
describe('H — Error normalization', () => {
  it('classifies timeout / rate-limit / generic provider errors', () => {
    expect(toSafeAIError(new Error('the request timed out')).code).toBe(AI_ERROR_CODES.AI_TIMEOUT);
    expect(toSafeAIError(new Error('rate limit (429)')).code).toBe(AI_ERROR_CODES.AI_RATE_LIMITED);
    expect(toSafeAIError(new Error('boom')).code).toBe(AI_ERROR_CODES.AI_PROVIDER_ERROR);
  });

  it('never leaks the raw provider message to consumers', () => {
    const result = toSafeAIResult(new Error('secret-key-marker=abc123 exploded'));
    expect(result.ok).toBe(false);
    expect(result.status).toBe(AI_ERROR_CODES.AI_PROVIDER_ERROR);
    expect(result.message).not.toMatch(/secret-key-marker|abc123/);
    expect(result.analysis).toBeNull();
  });

  it('a failing provider surfaces as a safe application error through analyze()', async () => {
    const provider = createAIProvider({ enabled: true, provider: 'test-fail' });
    const result = await provider.analyze({});
    expect(result.ok).toBe(false);
    expect(result.status).toBe(AI_ERROR_CODES.AI_PROVIDER_ERROR);
    expect(result.message).not.toMatch(/secret-key-marker|abc123/);
  });

  it('an enabled-but-unimplemented provider degrades to AI_UNAVAILABLE', async () => {
    const provider = createAIProvider({ enabled: true, provider: 'none' });
    const result = await provider.analyze({});
    expect(result.ok).toBe(false);
    expect(result.status).toBe(AI_ERROR_CODES.AI_UNAVAILABLE);
  });
});

// I. RESPONSE CONTRACT — analytical only
describe('I — Response contract validation', () => {
  const valid = { summary: 'ok', strengths: ['a'], confidence: 0.8 };

  it('validateResponseContract() accepts a conforming object', () => {
    const check = validateResponseContract(valid);
    expect(check.ok).toBe(true);
    expect(check.errors).toEqual([]);
  });

  it('rejects out-of-range confidence and wrong-typed fields', () => {
    expect(validateResponseContract({ confidence: 1.5 }).ok).toBe(false);
    expect(validateResponseContract({ confidence: 'high' }).ok).toBe(false);
    expect(validateResponseContract({ strengths: 'nope' }).ok).toBe(false);
  });

  it('assertResponseContract throws a controlled invalid-response error', () => {
    expect(() => assertResponseContract({ summary: 42 })).toThrowError(AIError);
    try {
      assertResponseContract({ confidence: 2 });
    } catch (e) {
      expect(isAIError(e)).toBe(true);
      expect(e.code).toBe(AI_ERROR_CODES.AI_INVALID_RESPONSE);
    }
  });

  it('sanitizeResponse() enforces the contract and always carries the disclaimer', () => {
    const out = sanitizeResponse({ summary: 42, confidence: -0.5, observations: ['x ', 8], unknown: 'dropped' });
    for (const key of Object.keys(RESPONSE_CONTRACT)) {
      expect(out).toHaveProperty(key);
    }
    expect(out.summary).toBe(''); // non-string normalized away
    expect(out.confidence).toBe(0);
    expect(out.observations).toEqual(['x']);
    expect(out.disclaimer).toBe(AI_DISCLAIMER);
    expect(out.unknown).toBeUndefined();
  });

  it('the contract itself contains no execution- or guarantee-shaped fields', () => {
    const keys = RESPONSE_KEYS.join(' ');
    const banned = /\b(signal|buy|sell|entry_price|guarantee|guaranteed|profit_claim)\b/i;
    expect(keys).not.toMatch(banned);
  });
});

// J. NO SECRET IN CLIENT-SIDE CODE — source-scan the AI module
describe('J — No secret exposed to client-side code', () => {
  const DIR = join(__dirname, '../ai');

  it('module source contains no API-key / provider-secret patterns', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.js'));
    expect(files.length).toBeGreaterThan(0);
    const re = /sk-[A-Za-z0-9_-]{16,}|api\s*[_-]?key\s*[:=]|apikey\s*[:=]|Authorization\s*:\s*Bearer\s+[A-Za-z0-9._-]{16,}|AI_API_KEY|AI_SECRET/i;
    for (const file of files) {
      const source = readFileSync(join(DIR, file), 'utf8');
      expect(source, `${file} leaked a secret pattern`).not.toMatch(re);
    }
  });

  it('no VITE_ secret is referenced by the provider/config modules', () => {
    const source = readFileSync(join(DIR, 'provider.js'), 'utf8');
    // Public feature flag + public provider-name flag are the only env reads.
    expect(source).toContain('VITE_AI_ENABLED');
    expect(source).not.toMatch(/VITE_AI_(KEY|SECRET|TOKEN)/i);
    expect(source).not.toMatch(/import\.meta\.env\.(.*(?:key|secret|token))/i);
  });

  it('safety rules require advisory-only, no-mutation, no-guarantee posture', () => {
    const ids = new Set(AI_SAFETY_RULES.map((r) => r.id));
    expect(ids).toContain('advisory-only');
    expect(ids).toContain('no-execution');
    expect(ids).toContain('no-mutation');
    expect(ids).toContain('no-guarantees');
    expect(ids).toContain('no-cross-account');
    expect(ids).toContain('canonical-authoritative');
  });
});