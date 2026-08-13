// AI Canonical Journal Context — Sprint 9.3 audit follow-up (P1).
//
// Proves the single-source-of-truth refactor the audit requested:
//   A. buildCanonicalJournalContext() produces deterministic, deeply frozen,
//      canonical blocks (performance / risk / completeness / dataQuality) plus
//      the deep-immune projections — and is account-isolated.
//   B. AI Coaching receives the same canonical blocks + emotion + direction /
//      timeframe analytics (no re-implementation).
//   C. Ask Journal receives the canonical blocks when the question is about
//      measurable performance.
//   D. Ask Journal avoids that context for purely qualitative questions.
//   E. Trade Review no longer duplicates the calculations builder — the
//      captured context is exactly buildTradeReviewCalculations() output.
//   F. Canonical metrics stay authoritative after a model response — model
//      attempts to author numbers are discarded.
//   G. Directive / guarantee rejection stays intact through the shared path.
//
// Real AI providers are NEVER contacted — every provider call goes through
// local mock providers.

import { describe, it, expect } from 'vitest';
import { AI_ERROR_CODES, AI_STATUS_OK } from '../ai/types';
import { buildAIJournalContext, analyzeJournalIntelligence, sanitizeJournalResponse } from '../ai/journalIntelligence';
import { buildAICoachingContext, buildCoachingPeriods } from '../ai/coaching';
import { buildAIAskJournalContext } from '../ai/askJournal';
import {
  buildCanonicalJournalContext,
  buildJournalPerformance,
  buildJournalRiskBlock,
  buildJournalCompleteness,
  classifyJournalQuestionIntent,
  DATA_COVERAGE,
} from '../ai/canonicalContext';
import { isDeepFrozen, AI_DIRECTIVE_PATTERN } from '../ai/safety';
import { analyzeTradeReview, buildTradeReviewCalculations } from '../ai/tradeReview';
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

function makeSuite(n, { accountId = ACC_A, start = '2024-01-01' } = {}) {
  const day0 = Date.parse(`${start}T00:00:00`);
  return Array.from({ length: n }, (_, i) => {
    const win = i % 3 !== 2;
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

// The canonical sections exactly as the production orchestration builds them —
// the ONLY place these tests call the Sprint 8 engines.
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

function errorCodeOf(fn) {
  try {
    fn();
  } catch (e) {
    return e?.code;
  }
  return null;
}

function analyticsTotalPnl(trades) {
  return trades.reduce((sum, t) => sum + (Number(t.netPnl) || 0), 0);
}

// A: canonical context generation --------------------------------------------
describe('A — buildCanonicalJournalContext', () => {
  const suite = makeSuite(12);

  it('produces a deterministic, deeply frozen canonical block', () => {
    const ctx = buildCanonicalJournalContext({
      trades: suite,
      accountId: ACC_A,
      ...canonicalSections(suite),
    });
    expect(isDeepFrozen(ctx)).toBe(true);
    expect(ctx.dataQuality.tradeCount).toBe(12);
    expect(ctx.dataQuality.coverage).toBe(DATA_COVERAGE.NORMAL_PATTERN_ANALYSIS);
    expect(ctx.performance.total).toBe(12);
    expect(ctx.completeness.total).toBe(12);
    expect(Array.isArray(ctx.risk.flags)).toBe(true);
    expect(typeof ctx.risk.sizing).toBe('object');
    expect(Array.isArray(ctx.analytics.byDirection)).toBe(true);
    expect(Array.isArray(ctx.analytics.byTimeframe)).toBe(true);
    expect(ctx.recentTrades.length).toBeLessThanOrEqual(20);
    ctx.recentTrades.forEach((t) => {
      expect(t.accountId).toBeUndefined();
      expect(t.notes).toBeUndefined();
      expect(t.psychology).toBeUndefined();
    });
  });

  it('isolates accounts — mixed or cross-account trades throw AI_ACCOUNT_SCOPE_ERROR', () => {
    const mixed = [...suite, makeTrade({ id: 'leak', accountId: ACC_B })];
    expect(errorCodeOf(() => buildCanonicalJournalContext({ trades: mixed, accountId: ACC_A }))).toBe(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR);
    expect(errorCodeOf(() => buildCanonicalJournalContext({ trades: [makeTrade({ accountId: ACC_B })], accountId: ACC_A }))).toBe(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR);
  });

  it('guards missing inputs with empty projections and NOT_ENOUGH_DATA', () => {
    const ctx = buildCanonicalJournalContext({ trades: [], accountId: ACC_A });
    expect(ctx.dataQuality.coverage).toBe(DATA_COVERAGE.NOT_ENOUGH_DATA);
    expect(ctx.summary).toEqual({});
    expect(ctx.analytics).toEqual({});
    expect(ctx.emotion).toEqual({});
    expect(ctx.recentTrades).toEqual([]);
  });

  it('respects explicitly supplied deterministic blocks (overrides)', () => {
    const perf = buildJournalPerformance(computeAnalytics(suite), computeRiskAnalytics(suite));
    const riskBlock = buildJournalRiskBlock(computeRiskAnalytics(suite), computePatternDetection(suite, 'all'), suite);
    const completeness = buildJournalCompleteness(suite);
    const ctx = buildCanonicalJournalContext({
      trades: suite,
      accountId: ACC_A,
      performance: perf,
      riskBlock,
      completeness,
    });
    expect(ctx.performance).toBe(perf);
    expect(ctx.risk).toBe(riskBlock);
    expect(ctx.completeness).toBe(completeness);
  });

  it('never mutates the input trades', () => {
    const before = JSON.stringify(suite);
    buildCanonicalJournalContext({ trades: suite, accountId: ACC_A, ...canonicalSections(suite) });
    expect(JSON.stringify(suite)).toBe(before);
  });
});

// B: Coaching consumes the canonical blocks -----------------------------------
describe('B — AI Coaching receives the canonical context', () => {
  const suite = makeSuite(12);
  const now = new Date('2024-02-08T12:00:00Z');
  const periods = buildCoachingPeriods('weekly', now);

  it('carries performance / riskBlock / completeness / emotion + richer analytics', () => {
    const sections = canonicalSections(suite);
    const ctx = buildAICoachingContext({
      trades: suite,
      accountId: ACC_A,
      accountName: 'Main',
      currentScope: periods.current,
      previousScope: periods.previous,
      currentAnalytics: sections.analytics,
      previousAnalytics: sections.analytics,
      disciplineScore: sections.disciplineScore,
      setupPerformance: sections.setupPerformance,
      mistakeIntelligence: sections.mistakeIntelligence,
      heatmap: sections.heatmap,
      risk: sections.risk,
      patterns: sections.patterns,
      emotion: sections.emotion,
    });

    expect(isDeepFrozen(ctx)).toBe(true);
    expect(ctx.performance.total).toBe(12);
    expect(Array.isArray(ctx.riskBlock.flags)).toBe(true);
    expect(typeof ctx.riskBlock.sizing).toBe('object');
    expect(ctx.completeness.total).toBe(12);
    expect(typeof ctx.emotion).toBe('object');
    expect(Array.isArray(ctx.current.analytics.byDirection)).toBe(true);
    expect(Array.isArray(ctx.current.analytics.byTimeframe)).toBe(true);
    // Richer canonical discipline trend trail reaches the model.
    expect(Array.isArray(ctx.current.discipline.weekly)).toBe(true);
    expect(Array.isArray(ctx.current.discipline.monthly)).toBe(true);
    expect(typeof ctx.current.discipline.hasTrend).toBe('boolean');
  });
});

// C / D: Ask Journal conditional canonical context ----------------------------
describe('C — Ask Journal receives canonical context for measurable questions', () => {
  const suite = makeSuite(12);

  it('includes performance / riskBlock / completeness for a performance question', () => {
    const ctx = buildAIAskJournalContext({
      question: 'How is my win rate this month?',
      trades: suite,
      accountId: ACC_A,
      accountName: 'Main',
      ...canonicalSections(suite),
    });
    expect(classifyJournalQuestionIntent('How is my win rate this month?')).toBe('performance');
    expect(ctx.performance.total).toBe(12);
    expect(ctx.completeness.total).toBe(12);
    expect(Array.isArray(ctx.risk.flags)).toBe(true);
    expect(typeof ctx.risk.sizing).toBe('object');
    expect(Array.isArray(ctx.analytics.byDirection)).toBe(true);
    expect(Array.isArray(ctx.analytics.byTimeframe)).toBe(true);
    expect(isDeepFrozen(ctx)).toBe(true);
  });

  it('classifies measurable-style questions as performance', () => {
    for (const q of [
      'Which pair is best?',
      'Am I over-risking?',
      'What patterns do you see in my losses?',
      'How does my average RR compare last week?',
    ]) {
      expect(classifyJournalQuestionIntent(q)).toBe('performance');
    }
  });
});

describe('D — Ask Journal avoids context for qualitative questions', () => {
  const suite = makeSuite(12);

  it('omits the deterministic blocks for a qualitative question', () => {
    const ctx = buildAIAskJournalContext({
      question: 'How do I feel after my losses?',
      trades: suite,
      accountId: ACC_A,
      accountName: 'Main',
      ...canonicalSections(suite),
    });
    expect(classifyJournalQuestionIntent('How do I feel after my losses?')).toBe('qualitative');
    expect(ctx.performance).toBeUndefined();
    expect(ctx.completeness).toBeUndefined();
    expect(ctx.riskBlock).toBeUndefined();
    // The lightweight risk projection stays (no deterministic risk block).
    expect(ctx.risk).toEqual(expect.not.objectContaining({ flags: expect.anything() }));
    // Basic grounding projections still travel.
    expect(typeof ctx.summary.total).toBe('number');
    expect(Array.isArray(ctx.recentTrades)).toBe(true);
  });

  it('classifies qualitative / empty questions as qualitative', () => {
    expect(classifyJournalQuestionIntent('')).toBe('qualitative');
    expect(classifyJournalQuestionIntent('   ')).toBe('qualitative');
    expect(classifyJournalQuestionIntent('Help me understand my trading psychology')).toBe('qualitative');
    expect(classifyJournalQuestionIntent('Why do I get anxious before entering?')).toBe('qualitative');
  });
});

// E: Trade Review no longer duplicates the calculations builder ---------------
describe('E — Trade Review uses the single calculations builder', () => {
  it('captures exactly buildTradeReviewCalculations output in the AI context', async () => {
    let captured;
    const provider = {
      analyze: async (request) => {
        captured = request;
        return { ok: true, status: AI_STATUS_OK, analysis: { summary: 'ok', confidence: null, disclaimer: 'Not financial advice.' } };
      },
    };
    const trade = makeTrade();
    const calculations = buildTradeReviewCalculations(trade, { duration: '3h 15m' });
    const out = await analyzeTradeReview({
      trade,
      accountId: ACC_A,
      accountName: 'Main',
      calculations,
      provider,
    });
    expect(out.ok).toBe(true);
    expect(captured.context.calculations).toEqual({
      pnl: 80,
      realizedRR: 2.05,
      riskPercent: 1,
      lotSize: 100000,
      winLoss: 'Win',
      duration: '3h 15m',
    });
  });

  it('is a single builder — the canonical function owns the mapping (positionSize over contracts)', () => {
    const trade = makeTrade({ positionSize: 100000, contracts: 1 });
    expect(buildTradeReviewCalculations(trade, { duration: '3h 15m' })).toEqual({
      pnl: 80,
      realizedRR: 2.05,
      riskPercent: 1,
      lotSize: 100000,
      winLoss: 'Win',
      duration: '3h 15m',
    });
  });
});

// F: canonical metrics authoritative after a model response -------------------
describe('F — canonical metrics stay authoritative after the model responds', () => {
  const suite = makeSuite(12);

  it('journal: model-authored performance / risk numbers are discarded', async () => {
    const provider = {
      analyze: async () => ({
        ok: true,
        status: AI_STATUS_OK,
        analysis: sanitizeJournalResponse({
          summary: 'ok',
          performance: { total: 999, netPnl: 99999, winRate: 99 },
          risk: { observations: ['Model observation.'], flags: ['Made-up flag'] },
        }),
      }),
    };
    const out = await analyzeJournalIntelligence({ trades: suite, accountId: ACC_A, provider });
    expect(out.ok).toBe(true);
    expect(out.analysis.performance.total).toBe(12);
    expect(out.analysis.performance.netPnl).toBe(analyticsTotalPnl(suite));
    expect(out.analysis.performance.total).not.toBe(999);
    expect(out.analysis.risk.flags).not.toContain('Made-up flag');
    expect(out.analysis.risk.observations).toEqual(['Model observation.']);
  });

  it('journal: buildAIJournalContext risk is the canonical riskBlock', () => {
    const sections = canonicalSections(suite);
    const ctx = buildAIJournalContext({ trades: suite, accountId: ACC_A, accountName: 'Main', ...sections });
    const canonical = buildJournalRiskBlock(sections.risk, sections.patterns, suite);
    expect(ctx.risk).toEqual(canonical);
    expect(ctx.risk.flags).toEqual(canonical.flags);
  });
});

// G: directive rejection stays intact through the shared path -----------------
describe('G — directive / guarantee rejection intact', () => {
  it('the unified directive pattern still matches directive language', () => {
    expect(AI_DIRECTIVE_PATTERN.test('You should buy now.')).toBe(true);
    expect(AI_DIRECTIVE_PATTERN.test('guaranteed profit on this setup')).toBe(true);
    expect(AI_DIRECTIVE_PATTERN.test('recorded journal shows consistent execution')).toBe(false);
  });

  it('journal sanitization rejects directive language inside canonical-fed output', () => {
    expect(() => sanitizeJournalResponse({ summary: 'You should buy now to capture gains.' })).toThrow();
    expect(() => sanitizeJournalResponse({ actionPlan: { keepDoing: ['Sell to guarantee profit'] } })).toThrow();
  });

  it('a provider that returns directive language fails closed', async () => {
    const provider = {
      analyze: async (request) => {
        // Mirror the real provider adapter: it applies the feature sanitizer,
        // which rejects directive language before a response can be shaped.
        const sanitized = request.sanitize({ summary: 'You should buy now to capture gains.' });
        return { ok: true, status: AI_STATUS_OK, analysis: sanitized };
      },
    };
    const out = await analyzeJournalIntelligence({ trades: makeSuite(12), accountId: ACC_A, provider });
    expect(out.ok).toBe(false);
    expect(out.analysis).toBeNull();
  });
});
