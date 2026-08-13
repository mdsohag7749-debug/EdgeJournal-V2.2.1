// AI Journal Intelligence — Sprint 9.3 production feature tests.
//
// The journal-level AI layer must:
//   - analyze a JOURNAL SCOPE (many trades), not a single trade
//   - reuse the canonical Sprint 8 analytics engines and NEVER recompute a
//     PnL / RR / risk / win-loss / profit-factor formula itself
//   - respect account isolation and stay strictly read-only
//   - produce a pure, account-scoped, deep-frozen AI context
//   - respect the passed filter/date scope; expose a scope fingerprint the
//     UI uses to mark stale results the moment the scope changes
//   - never fire automatically — analyzeJournalIntelligence() only runs when
//     called, and still self-guards small sample sizes
//   - shape every outcome as a controlled { ok, status, message, analysis }
//     with safe, human-readable errors; raw provider data never leaks and
//     directive / guarantee language is rejected
//   - not change trades, balances, PnL, RR, risk, or journal data anywhere
//
// Real AI providers are NEVER contacted — every provider call in this suite
// goes through local mock providers.

import { describe, it, expect } from 'vitest';
import {
  AI_ERROR_CODES,
  registerAIAdapter,
  createAIProvider,
} from '../ai';
import * as aiPublic from '../ai/index';
import { AI_STATUS_OK } from '../ai/types';
import {
  classifyDataCoverage,
  dataCoverageLabel,
  buildJournalDataQuality,
  scopeLabel,
  analyzedScopeLabel,
  applyJournalScope,
  createScopeFingerprint,
  assertJournalAccountScope,
  buildAIJournalContext,
  sanitizeJournalResponse,
  validateJournalResponse,
  assertJournalResponse,
  analyzeJournalIntelligence,
  safeJournalErrorMessage,
  AI_NOT_ENOUGH_DATA,
  DATA_COVERAGE,
  AI_JOURNAL_MAX_RECENT_TRADES,
  JOURNAL_FORBIDDEN_FIELDS,
  JOURNAL_INSIGHT_SCHEMA,
  JOURNAL_INTELLIGENCE_INSTRUCTION,
  JOURNAL_RESPONSE_KEYS,
} from '../ai/journalIntelligence';
import { isDeepFrozen } from '../ai/safety';
import { computeAnalytics } from '../analytics';
import { computeSetupPerformance } from '../setupPerformance';
import { computePairSessionHeatmap } from '../heatmap';
import { computeMistakePattern } from '../mistakePattern';
import { computeDisciplineScore20 } from '../disciplineScore';
import { computeRiskAnalytics } from '../riskAnalytics';
import { computeEmotionAnalytics } from '../emotionAnalytics';
import { computePatternDetection } from '../patternDetection';

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
    tradeGrade: 'A',
    emotion: 'Confident',
    mistakes: { 'Late Entry': true },
    psychology: { confidence: 4, focus: 4, panic: 1 },
    notes: 'clean pullback',
    lessonsLearned: 'patience pays',
    accountId: ACC_A,
    createdAt: '2024-01-15T09:00:00Z',
    tags: [],
    isFavorite: false,
    ...overrides,
  };
}

// A deterministic helper suite of canonical trades.
function makeSuite(n, { accountId = ACC_A, start = '2024-01-01' } = {}) {
  const day0 = Date.parse(`${start}T00:00:00`);
  return Array.from({ length: n }, (_, i) => {
    const win = i % 3 !== 2; // ~66% wins
    return makeTrade({
      id: `trade-${accountId}-${i}`,
      date: new Date(day0 + i * 86400000).toISOString().slice(0, 10),
      entryTime: '09:00',
      model: i % 2 === 0 ? 'Pullback' : 'Breakout',
      instrument: i % 2 === 0 ? 'EURUSD' : 'GBPUSD',
      result: win ? 'Win' : 'Loss',
      netPnl: win ? 80 : -40,
      rr: win ? 2 : 1,
      accountId,
    });
  });
}

// The canonical sections exactly as the production orchestration builds them.
// This is the ONLY place the test calls the Sprint 8 engines, and it mirrors
// analyzeJournalIntelligence() so the context builder is always fed the same
// verified values a real run would produce.
function canonicalSections(trades, system = {}) {
  return {
    analytics: computeAnalytics(trades),
    setupPerformance: computeSetupPerformance(trades, {}),
    heatmap: computePairSessionHeatmap(trades, {}),
    mistakeIntelligence: computeMistakePattern(trades, {}),
    disciplineScore: computeDisciplineScore20(trades, {
      models: system.models || [],
      riskCriteria: system.riskCriteria || [],
      checklistCriteria: system.checklistCriteria || [],
      reflections: system.reflections || [],
    }),
    risk: computeRiskAnalytics(trades),
    emotion: computeEmotionAnalytics(trades),
    patterns: computePatternDetection(trades, 'all'),
  };
}

// A full contract-conforming provider analysis (already-sanitized shape).
function validAnalysis(overrides = {}) {
  return {
    ok: true,
    status: AI_STATUS_OK,
    analysis: {
      summary: 'Recorded journal shows consistent execution quality on high-confidence setups.',
      keyInsights: [
        { title: 'Pullback strength', observation: 'Pullback trades show positive recorded results.', evidence: 'Setup performance lists positive net PnL.', confidence: 0.7 },
      ],
      strengths: ['Sticks to the plan', 'Tight risk on losses'],
      recurringIssues: [{ title: 'Late entries', observation: 'Late entry recurs across the journal.', evidence: 'Mistake pattern flagged in several trades.' }],
      setupInsights: ['Pullback performs well'],
      pairSessionInsights: ['EURUSD London sessions strong'],
      disciplineInsights: ['High focus'],
      improvementAreas: ['Reduce late entries'],
      watchlist: ['Monitor win streak'],
      dataQuality: { limitations: ['Model-observed limitation note.'] },
      confidence: 0.6,
      disclaimer: 'Not financial advice.',
    },
    ...overrides,
  };
}

// A provider adapter that always returns the valid journal analysis.
const mockJournalProvider = {
  analyze: async (request) => {
    // Route through the real (journal) sanitizer so both layers are proven.
    const sanitized = sanitizeJournalResponse(validAnalysis().analysis);
    assertJournalResponse(sanitized);
    return { ok: true, status: AI_STATUS_OK, analysis: sanitized };
  },
};

// A provider that counts how many times it was actually called.
function countingProvider() {
  const counter = { calls: 0 };
  return {
    analyze: async () => {
      counter.calls += 1;
      return validAnalysis();
    },
    get calls() {
      return counter.calls;
    },
  };
}

registerAIAdapter('test-journal-echo', {
  analyze: async () => validAnalysis().analysis,
  healthCheck: async () => ({ ok: true, status: AI_STATUS_OK }),
});

registerAIAdapter('test-journal-fail', {
  analyze: async () => {
    throw new Error('provider exploded with secret-marker=abc123');
  },
});

describe('AI Journal Intelligence — Sprint 9.3', () => {
  // A: PUBLIC SURFACE ---------------------------------------------------------
  describe('A — public surface', () => {
    it('is part of the shared AI barrel export', () => {
      expect(aiPublic.analyzeJournalIntelligence).toBe(analyzeJournalIntelligence);
      expect(typeof aiPublic.buildAIJournalContext).toBe('function');
      expect(typeof aiPublic.applyJournalScope).toBe('function');
      expect(typeof aiPublic.createScopeFingerprint).toBe('function');
      expect(typeof aiPublic.sanitizeJournalResponse).toBe('function');
      expect(typeof aiPublic.buildJournalDataQuality).toBe('function');
      expect(typeof aiPublic.assertJournalAccountScope).toBe('function');
      expect(typeof aiPublic.safeJournalErrorMessage).toBe('function');
    });

    it('exported constants are sane and leave no execution/guarantee shape', () => {
      expect(AI_JOURNAL_MAX_RECENT_TRADES).toBe(20);
      expect(Array.isArray(JOURNAL_RESPONSE_KEYS)).toBe(true);
      expect(Array.isArray(JOURNAL_INSIGHT_SCHEMA)).toBe(false);
      expect(JOURNAL_FORBIDDEN_FIELDS).toContain('buy');
      expect(JOURNAL_FORBIDDEN_FIELDS).toContain('sell');
      expect(JOURNAL_FORBIDDEN_FIELDS).toContain('signal');
      expect(JOURNAL_FORBIDDEN_FIELDS).toContain('guaranteedProfit');
      expect(JOURNAL_FORBIDDEN_FIELDS).toContain('marketPrediction');
    });
  });

  // B: SMALL-SAMPLE GUARDRAILS (journal-level data coverage)
  describe('B — small-sample guardrails (data coverage)', () => {
    it('classifies 0 trades as NOT_ENOUGH_DATA', () => {
      expect(classifyDataCoverage(0)).toBe(DATA_COVERAGE.NOT_ENOUGH_DATA);
      expect(classifyDataCoverage(-3)).toBe(DATA_COVERAGE.NOT_ENOUGH_DATA);
      expect(classifyDataCoverage(undefined)).toBe(DATA_COVERAGE.NOT_ENOUGH_DATA);
    });
    it('classifies 1–4 trades as LIMITED_DATA', () => {
      expect(classifyDataCoverage(1)).toBe(DATA_COVERAGE.LIMITED_DATA);
      expect(classifyDataCoverage(4)).toBe(DATA_COVERAGE.LIMITED_DATA);
    });
    it('classifies 5–9 trades as EARLY_PATTERN', () => {
      expect(classifyDataCoverage(5)).toBe(DATA_COVERAGE.EARLY_PATTERN);
      expect(classifyDataCoverage(9)).toBe(DATA_COVERAGE.EARLY_PATTERN);
    });
    it('classifies 10+ trades as NORMAL_PATTERN_ANALYSIS', () => {
      expect(classifyDataCoverage(10)).toBe(DATA_COVERAGE.NORMAL_PATTERN_ANALYSIS);
      expect(classifyDataCoverage(100)).toBe(DATA_COVERAGE.NORMAL_PATTERN_ANALYSIS);
    });
    it('dataCoverageLabel maps every coverage to a stable label', () => {
      expect(dataCoverageLabel(DATA_COVERAGE.NOT_ENOUGH_DATA)).toBe('No data');
      expect(dataCoverageLabel(DATA_COVERAGE.LIMITED_DATA)).toBe('Limited data');
      expect(dataCoverageLabel(DATA_COVERAGE.EARLY_PATTERN)).toBe('Early pattern');
      expect(dataCoverageLabel(DATA_COVERAGE.NORMAL_PATTERN_ANALYSIS)).toBe('Normal');
      expect(dataCoverageLabel('bogus')).toBe('No data');
    });
    it('buildJournalDataQuality states sample limitations explicitly', () => {
      const limited = buildJournalDataQuality(3);
      expect(limited.tradeCount).toBe(3);
      expect(limited.coverage).toBe(DATA_COVERAGE.LIMITED_DATA);
      expect(limited.limitations.some((l) => /confidence/i.test(l))).toBe(true);
      expect(limited.limitations.some((l) => /already happened/i.test(l))).toBe(true);

      const empty = buildJournalDataQuality(0);
      expect(empty.coverage).toBe(DATA_COVERAGE.NOT_ENOUGH_DATA);
      expect(empty.limitations.some((l) => /no trades/i.test(l))).toBe(true);

      const normal = buildJournalDataQuality(20);
      expect(normal.coverage).toBe(DATA_COVERAGE.NORMAL_PATTERN_ANALYSIS);
      expect(normal.limitations.some((l) => /not the future/i.test(l))).toBe(true);
    });
    it('buildJournalDataQuality always returns a non-empty limitations array', () => {
      const dq = buildJournalDataQuality(25, ['Extra']);
      expect(Array.isArray(dq.limitations)).toBe(true);
      expect(dq.limitations).toContain('Extra');
      expect(dq.limitations.length).toBeGreaterThan(0);
    });
  });

  // C: SCOPE AWARENESS (period / pair / session / setup)
  describe('C — scope awareness', () => {
    const suite = makeSuite(12);
    // Local calendar date key — matches how the canonical period filter buckets
    // trades by local date (a UTC-derived key would break near midnight in
    // non-UTC timezones).
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    it('All-scoped journal passes every trade through unchanged', () => {
      expect(applyJournalScope(suite, { period: 'all' })).toHaveLength(12);
    });
    it('applies the pair filter using the canonical instrument key', () => {
      const out = applyJournalScope(suite, { period: 'all', pair: 'EURUSD' });
      expect(out.length).toBeGreaterThan(0);
      expect(out.every((t) => t.instrument === 'EURUSD')).toBe(true);
    });
    it('applies the setup filter using the canonical model label', () => {
      const out = applyJournalScope(suite, { period: 'all', setup: 'Pullback' });
      expect(out.length).toBeGreaterThan(0);
      expect(out.every((t) => t.model === 'Pullback')).toBe(true);
    });
    it('applies the canonical period filters (month / week / 30-day)', () => {
      const mixed = [
        makeTrade({ id: 'old', date: '2020-01-01' }),
        makeTrade({ id: 'new', date: today }),
      ];
      expect(applyJournalScope(mixed, { period: 'week' }).map((t) => t.id)).toEqual(['new']);
      expect(applyJournalScope(mixed, { period: 'month' }).map((t) => t.id)).toEqual(['new']);
      expect(applyJournalScope(mixed, { period: '30' }).map((t) => t.id)).toEqual(['new']);
      expect(applyJournalScope(mixed, { period: 'all' }).map((t) => t.id)).toEqual(['old', 'new']);
    });
    it('scopeLabel builds a readable scope label', () => {
      expect(scopeLabel({ period: 'all' })).toBe('All Time');
      expect(scopeLabel({ period: 'month' })).toBe('This Month');
      expect(scopeLabel({ period: '30' })).toBe('Last 30 Days');
      expect(scopeLabel({ period: 'week', pair: 'EURUSD', session: 'London' })).toMatch(/EURUSD/);
      expect(scopeLabel({ period: 'all', pair: 'All' })).not.toMatch(/Pair/);
    });
    it('analyzedScopeLabel includes the analyzed trade count', () => {
      expect(analyzedScopeLabel({ period: 'month' }, 1)).toBe('This Month · 1 trade');
      expect(analyzedScopeLabel({ period: 'month' }, 10)).toBe('This Month · 10 trades');
    });
    it('scope fingerprint changes when the trade set, account, or scope changes', () => {
      const base = { accountId: ACC_A, period: 'all' };
      const f1 = createScopeFingerprint(suite, base);
      expect(createScopeFingerprint(suite.slice(1), base)).not.toBe(f1);
      expect(createScopeFingerprint(suite, { accountId: ACC_B, period: 'all' })).not.toBe(f1);
      expect(createScopeFingerprint(suite, { accountId: ACC_A, period: 'month' })).not.toBe(f1);
      expect(createScopeFingerprint(suite, { accountId: ACC_A, period: 'all', pair: 'EURUSD' })).not.toBe(f1);
    });
  });

  // D: ACCOUNT ISOLATION
  describe('D — account isolation for the journal scope', () => {
    it('assertJournalAccountScope rejects mixed-account scopes', () => {
      const mixed = [makeTrade({ accountId: ACC_A }), makeTrade({ id: 'leak', accountId: ACC_B })];
      expect(() => assertJournalAccountScope(mixed, ACC_A)).toThrowError(/account|scope/i);
    });
    it('assertJournalAccountScope requires an explicit single account', () => {
      const mixed = [makeTrade({ accountId: ACC_A }), makeTrade({ id: 'b', accountId: ACC_B })];
      expect(() => assertJournalAccountScope(mixed, null)).toThrow();
      expect(() => assertJournalAccountScope([makeTrade()], ACC_A)).not.toThrow();
    });
    it('buildAIJournalContext throws a controlled AI_ACCOUNT_SCOPE_ERROR on mixed accounts', () => {
      const mixed = [makeTrade({ accountId: ACC_A }), makeTrade({ id: 'leak', accountId: ACC_B })];
      let err;
      try {
        buildAIJournalContext({ trades: mixed, accountId: ACC_A });
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.code).toBe(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR);
    });
  });

  // E: CONTEXT BUILDER — pure, canonical, deep-frozen, no mutation
  describe('E — journal context builder', () => {
    const suite = makeSuite(12);

    function built() {
      return buildAIJournalContext({
        trades: suite,
        accountId: ACC_A,
        accountName: 'Prop Firm 1',
        ...canonicalSections(suite),
        scope: { period: 'all', pair: 'All', session: 'All', setup: 'All' },
        dataQuality: buildJournalDataQuality(suite.length),
      });
    }

    it('stamps the account scope and deep-freezes the whole context', () => {
      const ctx = built();
      expect(ctx.account).toEqual({ id: ACC_A, name: 'Prop Firm 1' });
      expect(ctx.scope.period).toBe('all');
      expect(isDeepFrozen(ctx)).toBe(true);
    });
    it('carries only the projected recent-trade subset (no raw trade rows)', () => {
      const ctx = built();
      expect(Array.isArray(ctx.recentTrades)).toBe(true);
      expect(ctx.recentTrades.length).toBeLessThanOrEqual(AI_JOURNAL_MAX_RECENT_TRADES);
      ctx.recentTrades.forEach((t) => {
        // Analysis-only projection — never secrets, profile data, or owner ids.
        expect(t.accountId).toBeUndefined();
        expect(t.notes).toBeUndefined();
        expect(t.createdAt).toBeUndefined();
        expect(typeof t.id).toBe('string');
        expect(typeof t.date).toBe('string');
      });
    });
    it('derives aggregate sections from the canonical engines', () => {
      const ctx = built();
      expect(typeof ctx.analytics).toBe('object');
      expect(Array.isArray(ctx.analytics.byPair)).toBe(true);
      expect(Array.isArray(ctx.setupPerformance.setups)).toBe(true);
      expect(typeof ctx.disciplineScore).toBe('object');
      expect(typeof ctx.emotion).toBe('object');
      expect(typeof ctx.risk).toBe('object');
    });
    it('passes canonical aggregate values through verbatim (never recomputed)', () => {
      const ctx = built();
      // summary + analytics arrive from analytics.js; contents are its output.
      expect(ctx.summary.total).toBe(12);
      expect(typeof ctx.summary.winRate).toBe('number');
      expect(typeof ctx.summary.netPnl).toBe('number');
      expect(ctx.dataQuality.tradeCount).toBe(12);
      expect(ctx.dataQuality.coverage).toBe(DATA_COVERAGE.NORMAL_PATTERN_ANALYSIS);
    });
    it('never mutates the input trades array', () => {
      const before = JSON.stringify(suite);
      built();
      expect(JSON.stringify(suite)).toBe(before);
    });
    it('keeps the data-quality block canonical for small samples', () => {
      const ctx = buildAIJournalContext({
        trades: suite.slice(0, 3),
        accountId: ACC_A,
        ...canonicalSections(suite.slice(0, 3)),
        scope: { period: 'all' },
        dataQuality: buildJournalDataQuality(3),
      });
      expect(ctx.dataQuality.tradeCount).toBe(3);
      expect(ctx.dataQuality.coverage).toBe(DATA_COVERAGE.LIMITED_DATA);
    });
  });

  // F: SANITIZATION / RESPONSE CONTRACT (directives never reach the UI)
  describe('F — response sanitization & journal contract', () => {
    it('sanitizes a contract-conforming payload into the canonical shape', () => {
      const out = sanitizeJournalResponse(validAnalysis().analysis);
      for (const key of JOURNAL_RESPONSE_KEYS) expect(out).toHaveProperty(key);
      expect(out.summary.length).toBeGreaterThan(0);
      expect(out.keyInsights[0]).toMatchObject({ title: 'Pullback strength', confidence: 0.7 });
      expect(out.disclaimer.length).toBeGreaterThan(0);
      expect(isDeepFrozen(out)).toBe(true);
    });
    it('drops non-allowlisted fields and coerces bad types', () => {
      const out = sanitizeJournalResponse({
        summary: 'ok',
        tradeSignal: 'Buy now', // forbidden structural field
        strengths: 'not-an-array',
        keyInsights: [{ title: 'x', observation: 'y' }],
        confidence: 'high',
        unknown: 'dropped',
      });
      expect(out.tradeSignal).toBeUndefined();
      expect(out.unknown).toBeUndefined();
      expect(out.strengths).toEqual([]);
      expect(out.confidence).toBeNull();
      expect(out.keyInsights).toHaveLength(1);
    });
    it('rejects directive / guarantee language outright', () => {
      expect(() => sanitizeJournalResponse({ summary: 'You should buy now to capture gains.' })).toThrow();
      expect(() => sanitizeJournalResponse({ summary: 'guaranteed profit on this setup' })).toThrow();
      expect(() => sanitizeJournalResponse({ improvementAreas: ['place a buy stop'] })).toThrow();
      expect(() => sanitizeJournalResponse({ strengths: ['100% profit guaranteed'] })).toThrow();
    });
    it('validateJournalResponse accepts a conforming object and rejects bad ones', () => {
      expect(validateJournalResponse(validAnalysis().analysis).ok).toBe(true);
      expect(validateJournalResponse({ summary: 42 }).ok).toBe(false);
      expect(validateJournalResponse({ strengths: 'nope' }).ok).toBe(false);
      expect(validateJournalResponse({ summary: 'x', confidence: 1.5 }).ok).toBe(false);
    });
    it('assertJournalResponse throws a controlled invalid-response error', () => {
      expect(() => assertJournalResponse({ summary: 42 })).toThrow();
      try {
        assertJournalResponse({ summary: 42 });
      } catch (e) {
        expect(e.code).toBe(AI_ERROR_CODES.AI_INVALID_RESPONSE);
      }
    });
  });

  // G: ORCHESTRATION — explicit call only, mocked providers
  describe('G — analyzeJournalIntelligence orchestration', () => {
    const suite = makeSuite(12);
    const run = (overrides = {}) =>
      analyzeJournalIntelligence({
        trades: suite,
        accountId: ACC_A,
        accountName: 'Prop Firm 1',
        provider: mockJournalProvider,
        ...overrides,
      });

    it('returns AI_NOT_ENOUGH_DATA for an empty scope WITHOUT calling the provider', async () => {
      const counter = countingProvider();
      const out = await analyzeJournalIntelligence({ trades: [], accountId: ACC_A, provider: counter });
      expect(out.ok).toBe(false);
      expect(out.status).toBe(AI_NOT_ENOUGH_DATA);
      expect(out.analysis).toBeNull();
      expect(out.message).toMatch(/not enough trades/i);
      expect(counter.calls).toBe(0);
    });
    it('returns AI_NOT_ENOUGH_DATA when the filter scope leaves no trades', async () => {
      const counter = countingProvider();
      const out = await analyzeJournalIntelligence({ trades: suite, accountId: ACC_A, pair: 'XAUUSD', provider: counter });
      expect(out.ok).toBe(false);
      expect(out.status).toBe(AI_NOT_ENOUGH_DATA);
      expect(counter.calls).toBe(0);
    });
    it('refuses to run without a single explicit account (account isolation)', async () => {
      const counter = countingProvider();
      const out = await analyzeJournalIntelligence({ trades: suite, accountId: '', provider: counter });
      expect(out.ok).toBe(false);
      expect(out.status).toBe(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR);
      expect(counter.calls).toBe(0);
    });
    it('returns a successful, sanitized analysis via a mock provider', async () => {
      const out = await run();
      expect(out.ok).toBe(true);
      expect(out.status).toBe(AI_STATUS_OK);
      expect(out.message).toBe('');
      expect(out.analysis.summary).toBe(validAnalysis().analysis.summary);
      // Canonical data quality is authoritative — model limitations merged only.
      expect(out.analysis.dataQuality.tradeCount).toBe(12);
      expect(out.analysis.dataQuality.coverage).toBe(DATA_COVERAGE.NORMAL_PATTERN_ANALYSIS);
      expect(out.analysis.dataQuality.limitations).toContain('Model-observed limitation note.');
    });
    it('never leaks provider internals on failure and keeps data intact', async () => {
      const out = await run({
        provider: {
          analyze: async () => {
            throw new Error('exploded with secret-marker=abc123');
          },
        },
      });
      expect(out.ok).toBe(false);
      expect(out.status).toBe(AI_ERROR_CODES.AI_PROVIDER_ERROR);
      expect(out.message).not.toMatch(/secret-marker|abc123/);
      expect(out.message).toMatch(/journal data was not changed/i);
    });
    it('surfaces a safe message for every controlled journal state', () => {
      const codes = [
        AI_NOT_ENOUGH_DATA,
        AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR,
        AI_ERROR_CODES.AI_NOT_CONFIGURED,
        AI_ERROR_CODES.AI_RATE_LIMITED,
        AI_ERROR_CODES.AI_TIMEOUT,
        AI_ERROR_CODES.AI_UNAVAILABLE,
        AI_ERROR_CODES.AI_PROVIDER_ERROR,
        AI_ERROR_CODES.AI_INVALID_RESPONSE,
      ];
      for (const code of codes) {
        expect(typeof safeJournalErrorMessage(code)).toBe('string');
        expect(safeJournalErrorMessage(code).length).toBeGreaterThan(0);
      }
    });
    it('respects the analyzed scope by filtering trades before any provider call', async () => {
      const out = await run({ pair: 'EURUSD' });
      expect(out.ok).toBe(true);
      // Canonical data quality reflects the filtered scope, not the full journal.
      expect(out.analysis.dataQuality.tradeCount).toBeGreaterThan(0);
      expect(out.analysis.dataQuality.tradeCount).toBeLessThan(12);
    });
  });

  // H: PIPELINE-ONLY — the journal contract holds no execution/guarantee shape
  describe('H — no execution or guarantee shape anywhere', () => {
    it('the rendered payload never contains buy/sell/guarantee text', () => {
      const out = sanitizeJournalResponse(validAnalysis().analysis);
      const text = [out.summary, ...out.strengths, ...out.improvementAreas, ...out.watchlist].join(' ');
      expect(text).not.toMatch(/buy now|sell now|100% profit|guaranteed/i);
    });
    it('the system instruction forbids causation, execution, and guarantees', () => {
      const instruction = JOURNAL_INTELLIGENCE_INSTRUCTION;
      expect(instruction).toMatch(/do not make causal claims/i);
      expect(instruction).toMatch(/do not provide buy\/sell signals/i);
      expect(instruction).toMatch(/do not predict future prices/i);
      expect(instruction).toMatch(/sample size is small/i);
    });
  });

  // I: PROVIDER ADAPTER PATH (via createAIProvider + registerAIAdapter)
  describe('I — provider adapter path', () => {
    it('an enabled journal adapter produces the sanitized analysis', async () => {
      const provider = createAIProvider({ enabled: true, provider: 'test-journal-echo' });
      const out = await analyzeJournalIntelligence({ trades: makeSuite(5), accountId: ACC_A, provider });
      expect(out.ok).toBe(true);
      expect(out.status).toBe(AI_STATUS_OK);
      expect(out.analysis.summary.length).toBeGreaterThan(0);
    });
    it('a failing adapter surfaces only safe application error copy', async () => {
      const provider = createAIProvider({ enabled: true, provider: 'test-journal-fail' });
      const out = await analyzeJournalIntelligence({ trades: makeSuite(12), accountId: ACC_A, provider });
      expect(out.ok).toBe(false);
      expect(out.message).not.toMatch(/secret-marker|abc123/);
    });
  });

  // J: DEFAULT (DISABLED) PATH — production defaults fail closed, no provider
  describe('J — disabled default never autofires', () => {
    it('the default provider resolves to a safe not-configured state', async () => {
      const out = await analyzeJournalIntelligence({ trades: makeSuite(12), accountId: ACC_A });
      expect(out.ok).toBe(false);
      expect(out.status).toBe(AI_ERROR_CODES.AI_NOT_CONFIGURED);
      expect(out.message).toMatch(/not configured/i);
      expect(out.analysis).toBeNull();
    });
  });
});