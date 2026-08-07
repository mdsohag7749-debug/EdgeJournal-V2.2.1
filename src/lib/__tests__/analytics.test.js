import { describe, it, expect } from 'vitest';
import { computeAnalytics } from '../analytics';
import { computeDeepAnalytics } from '../deepAnalytics';
import { computeRiskAnalytics } from '../riskAnalytics';
import { computeEquityAnalytics } from '../equityAnalytics';
import { computeEmotionAnalytics } from '../emotionAnalytics';
import { computePsychologyInsights } from '../psychInsights';
import { computeInstitutionalInsights } from '../insightAnalytics';
import { computePerformanceInsights, applyFocusFilter } from '../performanceInsights';

const T = (o) => ({
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

describe('computeAnalytics — decided trade math', () => {
  it('aggregates wins, losses, win rate, net P&L, avg win/loss, PF, RR', () => {
    const a = computeAnalytics([
      T({ date: '2024-01-02', netPnl: 100, rr: 2, result: 'Win' }),
      T({ date: '2024-01-03', netPnl: -50, rr: 2, result: 'Loss' }),
      T({ date: '2024-01-04', netPnl: 50, rr: 1, result: 'Win' }),
    ]);

    expect(a.total).toBe(3);
    expect(a.wins).toBe(2);
    expect(a.losses).toBe(1);
    expect(a.breakevens).toBe(0);
    expect(a.winRate).toBeCloseTo(66.666, 1);
    expect(a.lossRate).toBeCloseTo(33.333, 1);
    expect(a.netPnl).toBe(100);
    expect(a.avgWin).toBe(75);
    expect(a.avgLoss).toBe(-50);
    expect(a.avgRR).toBe(1.5); // avgWin / |avgLoss|
    expect(a.profitFactor).toBe(3); // 150 / 50
    expect(a.bestTrade).toBe(100);
    expect(a.worstTrade).toBe(-50);
  });

  it('computes streaks and trading days', () => {
    const a = computeAnalytics([
      T({ date: '2024-01-02', netPnl: -10, result: 'Loss' }),
      T({ date: '2024-01-03', netPnl: 10, result: 'Win' }),
      T({ date: '2024-01-04', netPnl: 20, result: 'Win' }),
    ]);
    expect(a.currentWinStreak).toBe(2);
    expect(a.currentLossStreak).toBe(0);
    expect(a.longestWinStreak).toBe(2);
    expect(a.tradingDays).toBe(3);
  });

  it('handles empty trades with zeros', () => {
    const a = computeAnalytics([]);
    expect(a.total).toBe(0);
    expect(a.winRate).toBe(0);
    expect(a.profitFactor).toBe(0);
    expect(a.byPair).toEqual([]);
    expect(a.currentWinStreak).toBe(0);
  });
});

describe('computeAnalytics — filtering dimensions', () => {
  const trades = [
    T({ instrument: 'EURUSD', session: 'London', model: 'Breakout', date: '2024-01-02', result: 'Win', netPnl: 100 }),
    T({ instrument: 'EURUSD', session: 'London', model: 'Breakout', date: '2024-01-03', result: 'Loss', netPnl: -50 }),
    T({ instrument: 'GBPUSD', session: 'New York', model: 'Reversal', date: '2024-01-04', result: 'Win', netPnl: 30 }),
  ];

  it('groups by pair / session / model and sorts with highlights', () => {
    const a = computeAnalytics(trades);

    const eurusd = a.byPair.find((g) => g.key === 'EURUSD');
    expect(eurusd).toMatchObject({ trades: 2, wins: 1, losses: 1, netPnl: 50 });

    const london = a.bySession.find((g) => g.key === 'London');
    expect(london).toMatchObject({ trades: 2, netPnl: 50 });

    const breakout = a.byStrategy.find((g) => g.key === 'Breakout');
    expect(breakout).toMatchObject({ trades: 2, netPnl: 50 });

    expect(a.bestPair.key).toBe('EURUSD');
    expect(a.worstPair.key).toBe('GBPUSD');
    expect(a.mostTradedPair.key).toBe('EURUSD');
  });

  it('filters by date slice (month / pair / session stand-ins for live filters)', () => {
    const jan = trades.filter((t) => t.date.slice(0, 7) === '2024-01');
    expect(computeAnalytics(jan).total).toBe(3);
    const eur = trades.filter((t) => t.instrument === 'EURUSD');
    expect(computeAnalytics(eur).total).toBe(2);
    const london = trades.filter((t) => t.session === 'London');
    expect(computeAnalytics(london).netPnl).toBe(50);
    const reversal = trades.filter((t) => t.model === 'Reversal');
    expect(computeAnalytics(reversal)).toMatchObject({ wins: 1 });
  });
});

describe('computeAnalytics — cache regression (Sprint 6.3)', () => {
  it('returns the SAME memoized result for the same array reference', () => {
    const trades = [T({ result: 'Win', netPnl: 100 }), T({ result: 'Loss', netPnl: -40 })];
    const first = computeAnalytics(trades);
    const second = computeAnalytics(trades);
    expect(first).toBe(second); // single computation per array
  });

  it('recomputes when DataContext hands out a fresh array (trade added)', () => {
    const base = [T({ result: 'Win', netPnl: 100 })];
    const before = computeAnalytics(base);
    expect(before.total).toBe(1);

    const updated = [...base, T({ result: 'Win', netPnl: 50 })];
    const after = computeAnalytics(updated);
    expect(after).not.toBe(before);
    expect(after.total).toBe(2);
    expect(after.netPnl).toBe(150);
  });

  it('recomputes when a trade is edited (rack reference changes)', () => {
    const trades = [T({ result: 'Win', netPnl: 50 })];
    const edited = trades.map((t) => (t.netPnl === 50 ? { ...t, netPnl: 900 } : t));
    expect(computeAnalytics(edited).netPnl).toBe(900);
  });

  it('does not return stale results across different accounts (different arrays)', () => {
    const accountA = [T({ instrument: 'EURUSD', netPnl: 100, result: 'Win' })];
    const accountB = [T({ instrument: 'GBPUSD', netPnl: -80, result: 'Loss' })];
    const a = computeAnalytics(accountA);
    const b = computeAnalytics(accountB);

    expect(a.netPnl).toBe(100);
    expect(b.netPnl).toBe(-80);
    // No cross-account bleed even though the shapes are identical.
    expect(a.byPair[0].key).toBe('EURUSD');
    expect(b.byPair[0].key).toBe('GBPUSD');
  });
});

describe('computeDeepAnalytics', () => {
  it('reuses analytics summary and adds hourly + duration views', () => {
    const d = computeDeepAnalytics([
      T({ entryTime: '09:30', exitTime: '10:15' }),
      T({ entryTime: '14:00', exitTime: '14:45' }),
    ]);
    expect(d.summary.total).toBe(2);
    expect(d.byHour.map((h) => h.key)).toEqual([9, 14]);
    expect(d.avgDurationMin).toBe(45);
    expect(d.avgDurationLabel).toBe('45m');
  });
});

describe('computeRiskAnalytics', () => {
  const trades = [
    T({ result: 'Win', netPnl: 100, riskPercent: 1, entryPrice: 10, stopLoss: 9.8, takeProfit: 10.4, date: '2024-01-02' }),
    T({ result: 'Loss', netPnl: -50, riskPercent: 3, entryPrice: 10, stopLoss: 9.9, takeProfit: 10.4, date: '2024-01-03' }),
    T({ result: 'Loss', netPnl: -70, riskPercent: 3, entryPrice: 10, stopLoss: 9.9, takeProfit: 10.4, date: '2024-01-04' }),
  ];

  it('reports avg risk %, reward %, streaks and drawdowns', () => {
    const r = computeRiskAnalytics(trades);
    expect(r.total).toBe(3);
    expect(r.avgRiskPct).toBeCloseTo((1 + 3 + 3) / 3, 5);
    expect(r.longestWinStreak).toBe(1);
    expect(r.longestLossStreak).toBe(2);
    expect(r.hasCurve).toBe(true);
  });

  it('computes avg reward % from risk × (TP distance / SL distance)', () => {
    const r = computeRiskAnalytics(trades);
    // Trade 1: risk 1%, SL 10→9.8 (0.2), TP 10→10.4 (0.4) → ratio 2 → 2% reward
    // Trades 2 & 3: risk 3%, SL 10→9.9 (0.1), TP 10→10.4 (0.4) → ratio 4 → 12%
    expect(r.avgRewardPct).toBeCloseTo((2 + 12 + 12) / 3, 5);
  });

  it('gracefully reports no-data state', () => {
    const r = computeRiskAnalytics([]);
    expect(r.total).toBe(0);
    expect(r.avgRiskPct).toBeNull();
    expect(r.hasCurve).toBe(false);
  });
});

describe('computeEquityAnalytics', () => {
  it('builds the equity curve from a starting baseline', () => {
    const e = computeEquityAnalytics(
      [T({ date: '2024-01-02', netPnl: 100 }), T({ date: '2024-01-03', netPnl: -40 })],
      1000
    );
    expect(e.base).toBe(1000);
    expect(e.points[0]).toMatchObject({ equity: 1100 });
    expect(e.points[1]).toMatchObject({ equity: 1060 });
    expect(e.finalEquity).toBe(1060);
    expect(e.highestEquity).toBe(1100);
    expect(e.lowestEquity).toBe(1000); // base is included as a curve point
    expect(e.growthPct).toBe(6);
    expect(e.total).toBe(2);
  });

  it('handles an empty series with base-only curve', () => {
    const e = computeEquityAnalytics([], 5000);
    expect(e.hasData).toBe(false);
    expect(e.finalEquity).toBe(5000);
    expect(e.points).toEqual([]);
  });
});

describe('computeEmotionAnalytics', () => {
  it('averages only rated psychology entries', () => {
    const e = computeEmotionAnalytics([
      T({ psychology: { Confidence: 5, Fear: 1 } }),
      T({ psychology: { Confidence: 3, Fear: 4 } }),
    ]);
    expect(e.total).toBe(2);
    expect(e.avgConfidence).toBe(4);
    expect(e.avgFocus).toBeNull(); // never rated
    // two trades rated for fear (1 and 4) → present at ≥4 → 50%
    expect(e.fearFreq).toBe(50);
  });

  it('mostCommonEmotion is null when nothing is rated', () => {
    const e = computeEmotionAnalytics([T({}), T({})]);
    expect(e.total).toBe(0);
    expect(e.mostCommonEmotion).toBeNull();
  });
});

describe('computePsychologyInsights', () => {
  it('never crashes on empty / unemotional data', () => {
    const r = computePsychologyInsights([]);
    expect(r.insights).toEqual([]);
    expect(r.sourceCount).toBe(0);

    const r2 = computePsychologyInsights([T({ psychology: {} })]);
    expect(Array.isArray(r2.insights)).toBe(true);
  });
});

describe('computeInstitutionalInsights — account-level aggregation', () => {
  it('produces stats and a monthly trend from real trades', () => {
    const t = [
      T({ date: '2024-01-02', result: 'Win', netPnl: 100 }),
      T({ date: '2024-01-03', result: 'Loss', netPnl: -40 }),
      T({ date: '2024-02-02', result: 'Win', netPnl: 120 }),
    ];
    const r = computeInstitutionalInsights(t);
    expect(r.hasData).toBe(true);
    expect(r.decided).toBe(3);
    expect(r.trend.monthly.length).toBe(2);
    expect(r.insights).toHaveProperty('bestPair');
  });
});

describe('computePerformanceInsights + focus filter', () => {
  it('recomputes headlines on the focused slice', () => {
    const t = [
      T({ date: '2024-06-03', instrument: 'EURUSD', result: 'Win', netPnl: 100 }),
      T({ date: '2024-06-04', instrument: 'GBPUSD', result: 'Loss', netPnl: -50 }),
    ];
    const p = computePerformanceInsights(t, 'all');
    expect(p.total).toBe(2);
    expect(p.hasDecided).toBe(true);
    expect(p.bestPair.key).toBe('EURUSD');
    expect(p.biggestWin).toBe(100);
  });
});