import { describe, it, expect } from 'vitest';
import { computeSmartInsights } from '../smartInsights';
import { computeSetupIntelligence } from '../setupIntelligence';
import { computeSessionPairIntelligence } from '../sessionIntelligence';
import { computeRiskExecutionIntelligence } from '../riskExecutionIntelligence';
import { computePatternDetection } from '../patternDetection';
import { computeRecommendations } from '../recommendations';
import { computePerformanceInsights, applyFocusFilter } from '../performanceInsights';

const T = (o = {}) => ({
  date: '2024-01-02',
  entryTime: '09:00',
  instrument: 'EURUSD',
  session: 'London',
  model: 'Breakout',
  timeframe: 'H1',
  direction: 'Buy',
  result: 'Win',
  netPnl: 100,
  rr: 2,
  riskPercent: 1,
  ...o,
});

// Deterministic generator: n trades in the same session/model, mostly
// winners, so sample-size rules (MIN_GROUP, MIN_SUPPORT) clear reliably.
function londonSeries(n, { riskPercent = 1 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const win = i % 2 === 0;
    out.push(
      T({
        date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
        entryTime: '09:00',
        result: win ? 'Win' : 'Loss',
        netPnl: win ? 120 : -20,
        riskPercent,
        instrument: i % 2 === 0 ? 'EURUSD' : 'GBPUSD',
      })
    );
  }
  return out;
}

describe('Sprint 5 Intelligence — Smart Trade Insights', () => {
  it('returns a limited empty state below MIN_SUPPORT decided trades', () => {
    const r = computeSmartInsights(londonSeries(4));
    expect(r.insights).toEqual([]);
    expect(r.decidedCount).toBe(4);
    expect(r.minSupport).toBeGreaterThan(0);
  });

  it('emits insights once there is enough evidence', () => {
    const r = computeSmartInsights(londonSeries(8));
    expect(r.decidedCount).toBe(8);
    expect(r.insights.length).toBeGreaterThan(0);
    expect(r.insights[0].category).toBeDefined();
    expect(r.insights[0].claim).toBeTruthy();
  });

  it('does not crash on empty or missing data', () => {
    expect(computeSmartInsights([]).insights).toEqual([]);
    expect(computeSmartInsights([T({ result: 'BE', netPnl: 0 })]).insights).toEqual([]);
  });
});

describe('Sprint 5 Intelligence — Setup / Model Intelligence', () => {
  it('is limited below MIN_EMERGING sample', () => {
    const r = computeSetupIntelligence([T({ model: 'Breakout', result: 'Win', netPnl: 50 })]);
    const breakout = r.models.find((m) => m.name === 'Breakout');
    expect(breakout.confidence).toBe('Limited');
    expect(breakout.status).toBe('Limited Data');
    expect(r.best).toBeNull();
  });

  it('crowns a reliable best setup from a healthy sample', () => {
    const trades = Array.from({ length: 10 }, (_, i) =>
      T({ model: 'Breakout', result: i % 3 === 0 ? 'Loss' : 'Win', netPnl: i % 3 === 0 ? -40 : 100 })
    );
    const r = computeSetupIntelligence(trades);
    expect(r.anyModelAssigned).toBe(true);
    const m = r.models[0];
    expect(m.name).toBe('Breakout');
    expect(m.decided).toBe(10);
    expect(m.winRate).toBeGreaterThan(50);
    expect(m.confidence).toBe('Reliable');
    expect(r.best).not.toBeNull();
    expect(r.best.name).toBe('Breakout');
  });
});

describe('Sprint 5 Intelligence — Session & Pair Intelligence', () => {
  it('rows per pair/session/combo with a modest sample', () => {
    const r = computeSessionPairIntelligence(londonSeries(8));
    expect(r.decidedCount).toBe(8);
    expect(r.pairs.length).toBeGreaterThanOrEqual(2);
    expect(r.sessions.length).toBeGreaterThanOrEqual(1);
    expect(r.combos.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty rows safely for zero trades', () => {
    const r = computeSessionPairIntelligence([]);
    expect(r.decidedCount).toBe(0);
    expect(r.pairs).toEqual([]);
    expect(r.insights).toEqual([]);
  });
});

describe('Sprint 5 Intelligence — Risk & Execution Intelligence', () => {
  it('surfaces risk-by-model/session structure and insight list', () => {
    const r = computeRiskExecutionIntelligence(londonSeries(9, { riskPercent: 1 }));
    expect(r.insights).toBeDefined();
    expect(Array.isArray(r.riskByModel)).toBe(true);
    expect(Array.isArray(r.riskBySession)).toBe(true);
    expect(r.decidedCount).toBe(9);
  });

  it('never crashes on empty data', () => {
    const r = computeRiskExecutionIntelligence([]);
    expect(r.insights).toEqual([]);
  });
});

describe('Sprint 5 Intelligence — Pattern Detection & Recommendations', () => {
  it('pattern detection builds a scored list without crashing', () => {
    const r = computePatternDetection(londonSeries(10));
    expect(r.decidedCount).toBe(10);
    expect(r.total).toBe(10);
    expect(Array.isArray(r.patterns)).toBe(true);
    expect(r.baseline).toBeDefined();
  });

  it('recommendations stay limited when the sample is too small', () => {
    const r = computeRecommendations(londonSeries(4));
    expect(r.limited).toBe(true);
    expect(r.recommendations).toEqual([]);
    expect(r.decidedCount).toBe(4);
  });

  it('produces capped, evidence-backed recommendations from a real dataset', () => {
    // Force the oversized-risk pattern (all trades > 2% risk) so the
    // "oversized-trade sizing" recommendation has to fire.
    const trades = londonSeries(8, { riskPercent: 3.5 });
    const r = computeRecommendations(trades);
    expect(r.limited).toBe(false);
    expect(Array.isArray(r.recommendations)).toBe(true);
    expect(r.recommendations.length).toBeLessThanOrEqual(r.max);
    expect(r.recommendations.length).toBeGreaterThan(0);
    expect(r.recommendations.every((rec) => rec.title && rec.action && rec.category)).toBe(true);
  });
});

describe('Sprint 5 Intelligence — account filtering / no cross-account leakage', () => {
  // DataContext scopes trades.items per account BEFORE any intelligence
  // runs; these tests lock the observable contract: intelligence only
  // ever reflects the exact array it is handed.
  it('two accounts with different data produce independent results', () => {
    const accountA = londonSeries(8).map((t, i) => ({ ...t, instrument: i % 2 === 0 ? 'EURUSD' : 'XAUUSD' }));
    const accountB = [
      T({ result: 'Loss', netPnl: -10, instrument: 'GBPUSD' }),
      T({ result: 'Loss', netPnl: -20, instrument: 'ZGBP' }),
    ];

    const a = computeSetupIntelligence(accountA);
    const b = computeSetupIntelligence(accountB);

    expect(a.decidedCount).toBe(8);
    expect(b.decidedCount).toBe(2);
    // B declined to create a ranked best setup (single tiny sample)
    expect(b.best).toBeNull();

    // A's models reference only A's instruments
    const pairKeys = computeSessionPairIntelligence(accountA).pairs.map((p) => p.key).sort();
    expect(pairKeys).toEqual(['EURUSD', 'XAUUSD']);

    const pairB = computeSessionPairIntelligence(accountB).pairs.map((p) => p.key);
    expect(pairB).not.toContain('EURUSD');
  });

  it('missing data never leaks cross-account or crashes', () => {
    expect(computeAnalyticsArg(computeSmartInsights, []).decidedCount).toBe(0);
  });
});

function computeAnalyticsArg(fn, arr) {
  return fn(arr);
}

describe('Performance Insights & focus filter', () => {
  it('filters by month/week bounds using the shared date window', () => {
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const inside = [{ date: `${y}-${m}-05`, result: 'Win', netPnl: 10 }];
    const outside = [{ date: '1999-01-01', result: 'Win', netPnl: 99 }];

    expect(applyFocusFilter([...inside, ...outside], 'month')).toHaveLength(1);
    expect(applyFocusFilter([...inside, ...outside], 'all')).toHaveLength(2);
  });

  it('computes headline snapshot from the all-time slice', () => {
    const p = computePerformanceInsights(londonSeries(6));
    expect(p.total).toBe(6);
    expect(p.hasDecided).toBe(true);
    expect(p.biggestWin).toBe(120);
  });
});