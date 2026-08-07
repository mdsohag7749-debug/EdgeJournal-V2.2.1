import { describe, it, expect } from 'vitest';
import {
  computeDashboardStats,
  computeDisciplineScore,
  reviewScoreForTrade,
  reviewStatusForTrade,
  isClosedTrade,
} from '../calculations';
import { computeRuleCompliance } from '../ruleCompliance';

const T = (overrides) => ({
  date: '2024-01-02',
  entryTime: '',
  result: 'Win',
  netPnl: 100,
  instrument: 'EURUSD',
  session: 'London',
  timeframe: 'H1',
  direction: 'Buy',
  model: 'Breakout',
  ...overrides,
});

describe('computeDashboardStats — winning trade', () => {
  it('reports a single winning trade', () => {
    const s = computeDashboardStats([T()]);
    expect(s.total).toBe(1);
    expect(s.wins).toBe(1);
    expect(s.losses).toBe(0);
    expect(s.netPnl).toBe(100);
    expect(s.tradeWinPct).toBe(100);
    expect(s.dailyWinPct).toBe(100);
    expect(s.avgWin).toBe(100);
    expect(s.avgLoss).toBe(0);
    expect(s.avgRR).toBe(0);
    expect(s.profitFactor).toBe(99.99);
    expect(s.bestTrade).toBe(100);
    expect(s.worstTrade).toBe(100);
    expect(s.streak).toBe(1);
    expect(s.streakType).toBe('Win');
  });
});

describe('computeDashboardStats — losing trade', () => {
  it('reports a losing trade with a negative expectancy base', () => {
    const s = computeDashboardStats([T({ result: 'Loss', netPnl: -50 })]);
    expect(s.total).toBe(1);
    expect(s.wins).toBe(0);
    expect(s.losses).toBe(1);
    expect(s.netPnl).toBe(-50);
    expect(s.tradeWinPct).toBe(0);
    expect(s.profitFactor).toBe(0);
    expect(s.avgLoss).toBe(-50);
    expect(s.streakType).toBe('Loss');
  });
});

describe('computeDashboardStats — mixed, decided scenarios', () => {
  const trades = [
    T({ date: '2024-01-02', entryTime: '09:00', result: 'Win', netPnl: 100 }),
    T({ date: '2024-01-02', entryTime: '14:00', result: 'Loss', netPnl: -50 }),
    T({ date: '2024-01-03', entryTime: '09:00', result: 'Win', netPnl: 50 }),
    T({ date: '2024-01-04', entryTime: '09:00', result: 'Loss', netPnl: -25 }),
    T({ date: '2024-01-04', entryTime: '10:00', result: 'BE', netPnl: 0 }),
  ];

  it('aggregates totals, win rate, P&L and averages', () => {
    const s = computeDashboardStats(trades);
    expect(s.total).toBe(5);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(2);
    expect(s.netPnl).toBe(75);
    expect(s.tradeWinPct).toBe(50);
    expect(s.dailyWinPct).toBeCloseTo(66.6666, 1);
    expect(s.avgWin).toBe(75);
    expect(s.avgLoss).toBe(-37.5);
    expect(s.avgRR).toBe(2);
    expect(s.profitFactor).toBe(2);
    expect(s.bestTrade).toBe(100);
    expect(s.worstTrade).toBe(-50);
  });

  it('computes expectancy and profit factor', () => {
    const s = computeDashboardStats(trades);
    // (win rate × avgWin) − (loss rate × |avgLoss|)
    expect(s.expectancy).toBeCloseTo(18.75, 2);
  });

  it('walks an equity curve with max drawdown', () => {
    const s = computeDashboardStats(trades);
    expect(s.equityCurve.map((p) => p.equity)).toEqual([100, 50, 100, 75, 75]);
    expect(s.maxDrawdown).toBe(50);
  });

  it('computes streaks: breakeven ends the current streak', () => {
    const s = computeDashboardStats(trades);
    expect(s.streak).toBe(0);
    expect(s.streakType).toBe(null);
    expect(s.bestWinStreak).toBe(1);
  });

  it('detects a positive current win streak and daily breakdown', () => {
    const s = computeDashboardStats([
      T({ date: '2024-01-02', result: 'Loss', netPnl: -10 }),
      T({ date: '2024-01-03', result: 'Win', netPnl: 20 }),
      T({ date: '2024-01-04', result: 'Win', netPnl: 30 }),
    ]);
    expect(s.streak).toBe(2);
    expect(s.streakType).toBe('Win');
    expect(s.bestWinStreak).toBe(2);
    expect(s.dailyPnLData.map((d) => d.pnl)).toEqual([-10, 20, 30]);
  });
});

describe('computeDashboardStats — edge cases', () => {
  it('returns a zeroed summary for no trades', () => {
    const s = computeDashboardStats([]);
    expect(s.total).toBe(0);
    expect(s.netPnl).toBe(0);
    expect(s.tradeWinPct).toBe(0);
    expect(s.profitFactor).toBe(0);
    expect(s.equityCurve).toEqual([]);
    expect(s.breakdown).toEqual([]);
    expect(s.radarScores.length).toBe(6);
  });

  it('handles breakeven-only trades', () => {
    const s = computeDashboardStats([T({ result: 'BE', netPnl: 0 }), T({ result: 'BE', netPnl: 0 })]);
    expect(s.wins).toBe(0);
    expect(s.losses).toBe(0);
    expect(s.tradeWinPct).toBe(0);
    expect(s.profitFactor).toBe(0);
  });

  it('handles all-wins (99.99 profit factor sentinel)', () => {
    const s = computeDashboardStats([T({ netPnl: 100 }), T({ netPnl: 50 })]);
    expect(s.profitFactor).toBe(99.99);
    expect(s.avgRR).toBe(0); // no losses → 0 rather than divide-by-zero
  });
});

describe('computeDashboardStats — grouping and filters', () => {
  it('groups by pair / session / timeframe / direction / model', () => {
    const s = computeDashboardStats([
      T({ instrument: 'EURUSD', session: 'London', timeframe: 'H1', direction: 'Buy', model: 'Breakout', result: 'Win', netPnl: 100 }),
      T({ instrument: 'EURUSD', session: 'London', timeframe: 'H1', direction: 'Buy', model: 'Breakout', result: 'Loss', netPnl: -50 }),
      T({ instrument: 'GBPUSD', session: 'New York', timeframe: 'M15', direction: 'Sell', model: 'Reversal', result: 'Win', netPnl: 30 }),
    ]);
    expect(s.pairPerformance.find((p) => p.label === 'EURUSD')).toMatchObject({ trades: 2, wins: 1, losses: 1, netPnl: 50 });
    expect(s.sessionPerformance.find((p) => p.label === 'London')).toMatchObject({ trades: 2 });
    expect(s.timeframePerformance.find((p) => p.label === 'H1')).toMatchObject({ trades: 2 });
    expect(s.directionPerformance.find((p) => p.label === 'Buy')).toMatchObject({ trades: 2 });
    expect(s.modelPerformance.find((p) => p.label === 'Breakout')).toMatchObject({ trades: 2, netPnl: 50 });
  });

  it('sorts performance groups by net P&L and exposes top pairs', () => {
    const s = computeDashboardStats([
      T({ instrument: 'EURUSD', result: 'Win', netPnl: 100 }),
      T({ instrument: 'GBPUSD', result: 'Loss', netPnl: -50 }),
      T({ instrument: 'NZDUSD', result: 'Win', netPnl: 20 }),
    ]);
    expect(s.pairPerformance[0].label).toBe('EURUSD');
    expect(s.topWinningPairs.map((p) => p.label)).toEqual(['EURUSD', 'NZDUSD']);
    expect(s.topLosingPairs.map((p) => p.label)).toEqual(['GBPUSD']);
  });
});

describe('computeDisciplineScore — institutional discipline engine', () => {
  it('returns zeroed metrics for no trades', () => {
    const r = computeDisciplineScore([], {});
    expect(r.total).toBe(0);
    expect(r.score).toBe(0);
    expect(r.metrics.every((m) => m.value === 0)).toBe(true);
  });

  it('ranks plan-following from the configured models', () => {
    const trade = T({ model: 'Breakout' });
    const r = computeDisciplineScore([trade], { models: ['Breakout'] });
    expect(r.total).toBe(1);
    expect(r.metrics.find((m) => m.label === 'Plan Following').value).toBe(100);
  });

  it('rewards emotional control for calm emotions', () => {
    const trade = T({ emotion: 'Confident' });
    const r = computeDisciplineScore([trade], {});
    expect(r.metrics.find((m) => m.label === 'Emotional Control').value).toBe(100);
  });

  it('reflects review completeness on closed trades', () => {
    const trade = T({ exitPrice: '1.1', review: { beforeScreenshot: true, afterScreenshot: true, reviewSummary: 'x', lessonLearned: 'y', emotionReflection: 'z' } });
    const r = computeDisciplineScore([trade], {});
    expect(r.metrics.find((m) => m.label === 'Review & Reflection').value).toBe(100);
  });
});

describe('review utilities and rule compliance', () => {
  it('computes review score from completed items', () => {
    const partial = T({ review: { beforeScreenshot: true, afterScreenshot: true } });
    expect(reviewScoreForTrade(partial)).toBe(40);
    const full = T({ review: { beforeScreenshot: true, afterScreenshot: true, reviewSummary: 'x', lessonLearned: 'y', emotionReflection: 'z' } });
    expect(reviewScoreForTrade(full)).toBe(100);
    expect(reviewStatusForTrade(full)).toBe('Reviewed');
    expect(reviewStatusForTrade(partial)).toBe('Pending Review');
  });

  it('recognizes closed trades', () => {
    expect(isClosedTrade({ exitPrice: 1.1 })).toBe(true);
    expect(isClosedTrade({ result: 'Win' })).toBe(true);
    expect(isClosedTrade({ result: 'loss' })).toBe(true);
    expect(isClosedTrade({})).toBe(false);
  });

  it('computes checklist compliance honestly', () => {
    const criteria = ['Rule A', 'Rule B'];
    const r = computeRuleCompliance(
      [T({ riskChecklist: { 'Rule A': true, 'Rule B': false } })],
      { riskCriteria: criteria, checklistCriteria: [] }
    );
    expect(r.engagedTrades).toBe(1);
    expect(r.ruleScore).toBe(50);
    expect(r.mostBrokenRule.name).toBe('Rule B');
  });
});