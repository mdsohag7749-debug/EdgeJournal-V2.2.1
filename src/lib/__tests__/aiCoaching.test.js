// AI Coaching & Action Plan — Sprint 9.4 production feature tests.
//
// Proves the read-only, account-isolated coaching orchestration:
//   - buildCoachingPeriods() horizon windows are deterministic (Daily / Weekly /
//     Monthly) and the selected horizon drives the current + previous scope.
//   - scopeCoachingTrades() reuses the canonical journal filters inside the
//     window — nothing is mixed, nothing is invented.
//   - buildAICoachingContext() is account-isolated (mixed / cross-account data
//     throws AI_ACCOUNT_SCOPE_ERROR), deeply frozen and never mutates trades.
//   - Canonical analytics pass through pre-computed; coaching never recomputes
//     a metric that the Sprint 8 engines already own.
//   - Small-data guardrails reuse Sprint 9.3 coverage (NOT_ENOUGH_DATA /
//     LIMITED_DATA / EARLY_PATTERN / NORMAL_PATTERN_ANALYSIS) — no provider
//     call at NOT_ENOUGH_DATA.
//   - The response sanitizer allow-lists the coaching contract and rejects
//     directive / guarantee language at the module boundary.
//   - Providers are mocked only — no real AI calls.

import { describe, it, expect, vi } from 'vitest';
import {
  buildCoachingPeriods,
  scopeCoachingTrades,
  buildAICoachingContext,
  sanitizeCoachingResponse,
  validateCoachingResponse,
  generateAICoaching,
  safeCoachingErrorMessage,
  coachingHorizonLabel,
  COACHING_HORIZONS,
} from '../ai/coaching';
import { isDeepFrozen } from '../ai/safety';
import { AI_ERROR_CODES, AI_DISCLAIMER } from '../ai/types';
import { AI_NOT_ENOUGH_DATA } from '../ai/journalIntelligence';

const ACC = 'acc-0001';
const OTHER = 'acc-0002';

// Error-shaped rejection for the timeout path (tests only).
const ERR_TIMEOUT = new Error('Request timed out');

function t(id, overrides = {}) {
  return {
    id,
    accountId: ACC,
    date: '2024-02-06',
    entryTime: '09:00',
    instrument: 'EURUSD',
    direction: 'Buy',
    session: 'London',
    timeframe: 'M15',
    model: 'Pullback',
    result: 'Win',
    netPnl: 80,
    rr: 2,
    riskPercent: 1,
    ...overrides,
  };
}

function inWeek(dates) {
  return dates.map((date, i) => t(`t-${i}`, { date, result: i % 2 === 0 ? 'Win' : 'Loss', netPnl: i % 2 === 0 ? 80 : -50 }));
}

function contractAnalysis() {
  return {
    summary: 'Your journal points to checklist adherence as the next improvement cycle.',
    focusAreas: [
      { title: 'Checklist discipline', reason: 'Weakest discipline component.', evidence: 'Plan & Checklist scored lowest.', priority: 'HIGH', confidence: 0.7, action: 'Review checklist habits', source: 'disciplineScore' },
    ],
    strengths: ['Records risk on every trade'],
    recurringPatterns: [{ title: 'Late entries', observation: 'Recorded several times.', evidence: 'Mistake intelligence lists late entry.' }],
    periodComparison: [
      { metric: 'Win rate', current: 60, previous: 50, direction: 'IMPROVING', observation: 'Small sample.', confidence: 0.5 },
    ],
    actionPlan: [
      { title: 'Complete checklist on every trade', why: 'Weakest area.', evidence: 'Recorded in journal.', timeframe: 'THIS_WEEK', measurable: true, completionHint: 'Tick each item before entry.' },
    ],
    watchItems: ['Watch the win-streak sample size'],
    limitations: [],
    confidence: 0.6,
    disclaimer: 'Not financial advice.',
  };
}

function capturingProvider(analysis) {
  const calls = [];
  const provider = {
    async analyze(request) {
      calls.push(request);
      return { ok: true, status: 'ok', analysis };
    },
    _calls: calls,
  };
  return provider;
}

const NOW = '2024-02-08'; // a Thursday

// Captures the @AIError code thrown by a callback (or null if none is thrown).
function errorCodeOf(fn) {
  try {
    fn();
    return null;
  } catch (err) {
    return err && err.code ? err.code : null;
  }
}

describe('buildCoachingPeriods — deterministic horizon windows', () => {
  it('daily window = today vs yesterday', () => {
    const p = buildCoachingPeriods('daily', NOW);
    expect(p.horizon).toBe('daily');
    expect(p.current).toMatchObject({ start: '2024-02-08', end: '2024-02-08', label: 'Today' });
    expect(p.previous).toMatchObject({ start: '2024-02-07', end: '2024-02-07', label: 'Yesterday' });
  });

  it('weekly window = Mon–Sun vs previous Mon–Sun', () => {
    const p = buildCoachingPeriods('weekly', NOW);
    expect(p.horizon).toBe('weekly');
    expect(p.current).toMatchObject({ start: '2024-02-05', end: '2024-02-11' });
    expect(p.previous).toMatchObject({ start: '2024-01-29', end: '2024-02-04' });
  });

  it('monthly window = this month vs previous month', () => {
    const p = buildCoachingPeriods('monthly', NOW);
    expect(p.horizon).toBe('monthly');
    expect(p.current).toMatchObject({ start: '2024-02-01', end: '2024-02-29' });
    expect(p.previous).toMatchObject({ start: '2024-01-01', end: '2024-01-31' });
  });

  it('unknown horizon falls back to weekly', () => {
    expect(buildCoachingPeriods('quarterly', NOW).horizon).toBe('weekly');
    expect(buildCoachingPeriods(undefined, NOW).horizon).toBe('weekly');
  });

  it('exposes human labels for the UI horizon switcher', () => {
    expect(coachingHorizonLabel('daily')).toBe('Daily');
    expect(coachingHorizonLabel('weekly')).toBe('Weekly');
    expect(coachingHorizonLabel('monthly')).toBe('Monthly');
    expect(COACHING_HORIZONS).toEqual(['daily', 'weekly', 'monthly']);
  });
});

describe('scopeCoachingTrades — canonical scoping inside the window', () => {
  const trades = [
    ...inWeek(['2024-02-05', '2024-02-06', '2024-02-07']),
    t('prev', { date: '2024-01-30' }),
    t('other-pair', { date: '2024-02-06', instrument: 'GBPUSD' }),
  ];

  it('filters by the supplied date window only', () => {
    const p = buildCoachingPeriods('weekly', NOW);
    const current = scopeCoachingTrades(trades, { ...p.current });
    expect(current.map((x) => x.id).sort()).toEqual(['other-pair', 't-0', 't-1', 't-2']);
  });

  it('applies the canonical pair filter inside the window', () => {
    const p = buildCoachingPeriods('weekly', NOW);
    const current = scopeCoachingTrades(trades, { ...p.current, pair: 'EURUSD' });
    expect(current.map((x) => x.id).sort()).toEqual(['t-0', 't-1', 't-2']);
  });
});

describe('buildAICoachingContext — isolation, immutability, canonical passthrough', () => {
  it('projects only allow-listed canonical data and deep-freezes everything', () => {
    const trades = inWeek(['2024-02-05', '2024-02-06']);
    const ctx = buildAICoachingContext({
      trades,
      accountId: ACC,
      accountName: 'Main',
      currentScope: buildCoachingPeriods('weekly', NOW).current,
      previousScope: buildCoachingPeriods('weekly', NOW).previous,
      currentAnalytics: { total: 2, wins: 1, losses: 1, winRate: 50, netPnl: 30 },
    });

    expect(isDeepFrozen(ctx)).toBe(true);
    expect(ctx.account).toEqual({ id: ACC, name: 'Main' });
    expect(ctx.current.summary.total).toBe(2);
    expect(ctx.mode).toBe('coaching');
    expect(ctx.currentPeriod.label).toMatch(/This week/);
  });

  it('rejects a mixed-account trade set with AI_ACCOUNT_SCOPE_ERROR', () => {
    const trades = [t('a'), t('b', { accountId: OTHER })];
    expect(errorCodeOf(() => buildAICoachingContext({ trades, accountId: ACC, currentAnalytics: {} }))).toBe(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR);
  });

  it('rejects a trade owned by another account', () => {
    const trades = [t('a', { accountId: OTHER })];
    expect(errorCodeOf(() => buildAICoachingContext({ trades, accountId: ACC, currentAnalytics: {} }))).toBe(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR);
  });

  it('never mutates the input trades', () => {
    const trades = inWeek(['2024-02-05', '2024-02-06']);
    const snapshot = JSON.stringify(trades);
    buildAICoachingContext({ trades, accountId: ACC, currentAnalytics: {} });
    expect(JSON.stringify(trades)).toBe(snapshot);
  });
});

describe('sanitizeCoachingResponse — allow-list contract', () => {
  it('drops forbidden fields and clamps to the contract shape', () => {
    const out = sanitizeCoachingResponse({
      summary: 'ok summary',
      focusAreas: [{ title: 'Late entries', reason: 'recorded repeatedly', evidence: 'evidence text', priority: 'HIGH', action: 'review entries' }],
      strengths: ['solid journaling'],
      recurringPatterns: [{ title: 'Pattern', observation: 'obs', evidence: 'ev' }],
      periodComparison: [{ metric: 'Win rate', current: 55, previous: 45, direction: 'IMPROVING', observation: 'small sample' }],
      actionPlan: [{ title: 'Action', why: 'why', evidence: 'ev', timeframe: 'THIS_WEEK', measurable: true, completionHint: 'hint' }],
      watchItems: ['watch'],
      limitations: ['lim'],
      confidence: 2,
      buy: 'BUY NOW',
      sellSignal: 'sell',
      guaranteeFieldsBypass: true,
    });

    expect(out.summary).toBe('ok summary');
    expect(out.focusAreas[0].priority).toBe('HIGH');
    expect(out.confidence).toBe(1); // clamped
    expect(out.buy).toBeUndefined();
    expect(out.sellSignal).toBeUndefined();
    expect(out.guaranteeFieldsBypass).toBeUndefined();
    expect(isDeepFrozen(out)).toBe(true);
    expect(out.disclaimer).toBe(AI_DISCLAIMER);
  });

  it('normalizes invalid filter values and caps list sizes', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ title: `F${i}`, reason: 'r', evidence: 'e', action: 'a' }));
    const out = sanitizeCoachingResponse({
      summary: 's',
      focusAreas: many,
      periodComparison: [
        { metric: 'm', current: 1, previous: null, direction: 'NONSENSE' },
      ],
      actionPlan: Array.from({ length: 9 }, (_, i) => ({ title: `A${i}`, why: 'w', evidence: 'e', timeframe: 'FAIL', measurable: false })),
    });
    expect(out.focusAreas).toHaveLength(3); // capped top 3
    expect(out.periodComparison[0].direction).toBe('INCONCLUSIVE'); // invalid → safe fallback
    expect(out.actionPlan).toHaveLength(5); // capped max 5
    expect(out.actionPlan[0].timeframe).toBe('THIS_WEEK'); // invalid → safe fallback
  });

  it('rejects directive / guarantee language in the text', () => {
    expect(errorCodeOf(() => sanitizeCoachingResponse({ summary: 'Buy now and lock in guaranteed profit.' }))).toBe(AI_ERROR_CODES.AI_INVALID_RESPONSE);
    expect(errorCodeOf(() => sanitizeCoachingResponse({ focusAreas: [{ title: 'Go short', reason: 'r', evidence: 'e', action: 'a' }] }))).toBe(AI_ERROR_CODES.AI_INVALID_RESPONSE);
    expect(errorCodeOf(() => sanitizeCoachingResponse({ actionPlan: [{ title: 'Increase your risk', why: 'w', evidence: 'e' }] }))).toBe(AI_ERROR_CODES.AI_INVALID_RESPONSE);
  });

  it('rejects a non-object response', () => {
    expect(errorCodeOf(() => sanitizeCoachingResponse(['nope']))).toBe(AI_ERROR_CODES.AI_INVALID_RESPONSE);
    expect(errorCodeOf(() => sanitizeCoachingResponse(null))).toBe(AI_ERROR_CODES.AI_INVALID_RESPONSE);
  });

  it('validateCoachingResponse accepts the sanitized shape and rejects malformed ones', () => {
    const ok = sanitizeCoachingResponse(contractAnalysis());
    expect(validateCoachingResponse(ok).ok).toBe(true);
    expect(validateCoachingResponse({ summary: 42 }).ok).toBe(false);
    expect(validateCoachingResponse({ strengths: 'nope' }).ok).toBe(false);
  });
});

describe('generateAICoaching — orchestration', () => {
  it('NOT_ENOUGH_DATA: zero in-scope trades return the controlled state and never call the provider', async () => {
    const provider = capturingProvider(contractAnalysis());
    const outcome = await generateAICoaching({
      trades: [t('old', { date: '2023-01-01' })],
      accountId: ACC,
      horizon: 'weekly',
      now: NOW,
      provider,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe(AI_NOT_ENOUGH_DATA);
    expect(outcome.analysis).toBeNull();
    expect(provider._calls).toHaveLength(0);
  });

  it('requires a single concrete account (isolation)', async () => {
    const provider = capturingProvider(contractAnalysis());
    const outcome = await generateAICoaching({ trades: inWeek(['2024-02-06']), accountId: '', provider });
    expect(outcome.status).toBe(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR);
    expect(provider._calls).toHaveLength(0);
  });

  it('rejects a mixed-account dataset before contacting the provider', async () => {
    const provider = capturingProvider(contractAnalysis());
    const trades = [...inWeek(['2024-02-06', '2024-02-07']), t('x', { accountId: OTHER, date: '2024-02-08' })];
    const outcome = await generateAICoaching({ trades, accountId: ACC, horizon: 'weekly', now: NOW, provider });
    expect(outcome.status).toBe(AI_ERROR_CODES.AI_ACCOUNT_SCOPE_ERROR);
    expect(provider._calls).toHaveLength(0);
  });

  it('uses the default disabled provider -> safe AI_NOT_CONFIGURED message', async () => {
    const outcome = await generateAICoaching({ trades: inWeek(['2024-02-06', '2024-02-07']), accountId: ACC, horizon: 'weekly', now: NOW });
    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe(AI_ERROR_CODES.AI_NOT_CONFIGURED);
    expect(outcome.message).toMatch(/not configured/i);
    expect(outcome.message).not.toMatch(/api[_-]?key|stack|undefined|http/i);
  });

  it('provider success returns the sanitized analysis merged with canonical data quality', async () => {
    const trades = inWeek(['2024-02-05', '2024-02-06', '2024-02-07', '2024-02-08', '2024-02-09', '2024-02-10', '2024-02-11']);
    const provider = capturingProvider(contractAnalysis());
    const outcome = await generateAICoaching({ trades, accountId: ACC, horizon: 'weekly', now: NOW, provider });

    expect(outcome.ok).toBe(true);
    expect(outcome.analysis.summary).toBeDefined();
    expect(outcome.analysis.focusAreas[0].title).toBe('Checklist discipline');
    expect(outcome.analysis.dataQuality.tradeCount).toBe(7);
    expect(outcome.analysis.dataQuality.coverage).toBe('EARLY_PATTERN');
    expect(outcome.analysis.dataQuality.limitations.length).toBeGreaterThan(0);
    expect(provider._calls).toHaveLength(1); // one AI call per Generate
  });

  it('classifies coverage into LIMITED_DATA / EARLY_PATTERN / NORMAL_PATTERN_ANALYSIS', async () => {
    const limited = await generateAICoaching({ trades: inWeek(['2024-02-05', '2024-02-06', '2024-02-07']), accountId: ACC, horizon: 'weekly', now: NOW, provider: capturingProvider(contractAnalysis()) });
    expect(limited.analysis.dataQuality.coverage).toBe('LIMITED_DATA');

    const normal = await generateAICoaching({ trades: inWeek(Array.from({ length: 12 }, (_, i) => `2024-02-${String((i % 7) + 5).padStart(2, '0')}`)), accountId: ACC, horizon: 'weekly', now: NOW, provider: capturingProvider(contractAnalysis()) });
    expect(normal.analysis.dataQuality.coverage).toBe('NORMAL_PATTERN_ANALYSIS');

    const early = await generateAICoaching({ trades: inWeek(['2024-02-05', '2024-02-06', '2024-02-07', '2024-02-08', '2024-02-09']), accountId: ACC, horizon: 'weekly', now: NOW, provider: capturingProvider(contractAnalysis()) });
    expect(early.analysis.dataQuality.coverage).toBe('EARLY_PATTERN');
  });

  it('passes canonical period-comparison rows (facts only) down to the provider context', async () => {
    const trades = [
      ...inWeek(['2024-02-05', '2024-02-06', '2024-02-07', '2024-02-09', '2024-02-11']), // current
      t('prev-trade', { date: '2024-02-01' }), // previous week
    ];
    const provider = capturingProvider(contractAnalysis());
    await generateAICoaching({ trades, accountId: ACC, horizon: 'weekly', now: NOW, provider });

    const request = provider._calls[0];
    expect(request.kind).toBe('coaching');
    expect(request.context.mode).toBe('coaching');
    expect(request.context.currentPeriod.label).toMatch(/This week/);
    expect(request.context.previousPeriod.label).toMatch(/Previous week/);
    const winRate = request.context.periodComparison.find((r) => r.metric === 'Win rate');
    expect(winRate).toBeDefined();
    expect(winRate.current).toBeGreaterThan(0);
    expect(winRate.currentTrades).toBe(5);
    // Previous scope has one decided Win trade => canonical win rate 100.
    expect(winRate.previous).toBe(100);
    expect(winRate.previousTrades).toBe(1);
  });

  it('horizontal scoping changes the supplied window: monthly includes more trades than weekly', async () => {
    const trades = [
      t('w1', { date: '2024-02-06' }),
      t('w2', { date: '2024-02-07' }),
      t('m', { date: '2024-02-15' }), // in Feb, outside current week
      t('prev-month', { date: '2024-01-10' }),
    ];
    const weeklyProvider = capturingProvider(contractAnalysis());
    await generateAICoaching({ trades, accountId: ACC, horizon: 'weekly', now: NOW, provider: weeklyProvider });
    expect(weeklyProvider._calls[0].context.dataQuality.tradeCount).toBe(2);
    expect(weeklyProvider._calls[0].context.previousPeriod.key).toBe('w:2024-01-29');

    const monthlyProvider = capturingProvider(contractAnalysis());
    await generateAICoaching({ trades, accountId: ACC, horizon: 'monthly', now: NOW, provider: monthlyProvider });
    expect(monthlyProvider._calls[0].context.dataQuality.tradeCount).toBe(3);
    expect(monthlyProvider._calls[0].context.previousPeriod.key).toBe('2024-01');
  });

  it('maps a provider timeout rejection to the safe AI_TIMEOUT state', async () => {
    const provider = { analyze: async () => Promise.reject(ERR_TIMEOUT) };
    const outcome = await generateAICoaching({ trades: inWeek(['2024-02-06', '2024-02-07']), accountId: ACC, horizon: 'weekly', now: NOW, provider });
    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe(AI_ERROR_CODES.AI_TIMEOUT);
    expect(outcome.message).toMatch(/temporarily unavailable/i);
  });

  it('maps controlled provider results for rate limit / generic error / invalid response', async () => {
    const mk = (status) => ({ analyze: async () => ({ ok: false, status, message: 'raw', analysis: null }) });
    const rate = await generateAICoaching({ trades: inWeek(['2024-02-06', '2024-02-07']), accountId: ACC, now: NOW, provider: mk(AI_ERROR_CODES.AI_RATE_LIMITED) });
    expect(rate.status).toBe(AI_ERROR_CODES.AI_RATE_LIMITED);

    const generic = await generateAICoaching({ trades: inWeek(['2024-02-06', '2024-02-07']), accountId: ACC, now: NOW, provider: mk(AI_ERROR_CODES.AI_PROVIDER_ERROR) });
    expect(generic.status).toBe(AI_ERROR_CODES.AI_PROVIDER_ERROR);

    const invalid = await generateAICoaching({ trades: inWeek(['2024-02-06', '2024-02-07']), accountId: ACC, now: NOW, provider: { analyze: async () => Promise.reject(new Error('bad')) } });
    expect(invalid.status).toBe(AI_ERROR_CODES.AI_PROVIDER_ERROR);
  });
});

describe('safeCoachingErrorMessage — user-facing copy only', () => {
  it('returns a safe message for every controlled code and never leaks internals', () => {
    const codes = ['AI_NOT_CONFIGURED', 'AI_ACCOUNT_SCOPE_ERROR', 'AI_RATE_LIMITED', 'AI_TIMEOUT', 'AI_UNAVAILABLE', 'AI_PROVIDER_ERROR', 'AI_INVALID_RESPONSE', AI_NOT_ENOUGH_DATA, 'SOMETHING_ELSE'];
    for (const code of codes) {
      const message = safeCoachingErrorMessage(code);
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
      expect(message).toMatch(/journal data was not changed|log more trades|no journal data was sent/i);
      expect(message).not.toMatch(/api[_-]?key|stack|secret|undefined|http/i);
    }
  });
});