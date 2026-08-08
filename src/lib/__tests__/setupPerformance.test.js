import { describe, it, expect } from 'vitest';
import { computeSetupPerformance, applyPeriodFilter, MIN_NORMAL, MAX_LIMITED, UNASSIGNED_LABEL } from '../setupPerformance';

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

describe('computeSetupPerformance — empty & single-setup basics', () => {
  it('empty dataset → hasData false, no setups, no fabricated percentages', () => {
    const r = computeSetupPerformance([]);
    expect(r.hasData).toBe(false);
    expect(r.setups).toEqual([]);
    expect(r.totalTrades).toBe(0);
    expect(r.decidedCount).toBe(0);
  });

  it('one setup with enough decided trades yields a single Normal row', () => {
    const trades = Array.from({ length: 6 }, (_, i) =>
      T({ model: 'Breakout', result: i % 2 === 0 ? 'Win' : 'Loss', netPnl: i % 2 === 0 ? 100 : -40, rr: 2 })
    );
    const r = computeSetupPerformance(trades);
    const b = r.setups.find((s) => s.label === 'Breakout');
    expect(r.setups.length).toBe(1);
    expect(r.hasData).toBe(true);
    expect(b.trades).toBe(6);
    expect(b.decided).toBe(6);
    expect(b.status).toBe('Normal');
    expect(b.winRate).toBeCloseTo(50, 1);
  });
});

describe('computeSetupPerformance — multiple & custom setups', () => {
  it('groups multiple setups independently', () => {
    const trades = [
      T({ model: 'Breakout', result: 'Win', netPnl: 100 }),
      T({ model: 'Breakout', result: 'Loss', netPnl: -50 }),
      T({ model: 'Pullback', result: 'Win', netPnl: 200 }),
      T({ model: 'Pullback', result: 'Win', netPnl: 60 }),
    ];
    const r = computeSetupPerformance(trades);
    const labels = r.setups.map((s) => s.label).sort();
    expect(labels).toEqual(['Breakout', 'Pullback']);
    const breakout = r.setups.find((s) => s.label === 'Breakout');
    expect(breakout.netPnl).toBe(50);
    expect(breakout.trades).toBe(2);
    const pullback = r.setups.find((s) => s.label === 'Pullback');
    expect(pullback.netPnl).toBe(260);
    expect(pullback.wins).toBe(2);
  });

  it('automatically discovers custom setup values (never hardcoded)', () => {
    const trades = [T({ model: 'London Open Momentum +1H' }), T({ model: 'London Open Momentum +1H' })];
    const r = computeSetupPerformance(trades);
    expect(r.setups).toHaveLength(1);
    expect(r.setups[0].label).toBe('London Open Momentum +1H');
  });

  it('tracks trades with NO setup under Unassigned — never dropped', () => {
    const trades = [
      T({ model: 'Breakout', result: 'Win', netPnl: 40 }),
      T({ model: '', result: 'Win', netPnl: 60 }),
      T({ model: '', result: 'Loss', netPnl: -10 }),
    ];
    const r = computeSetupPerformance(trades);
    const unassigned = r.setups.find((s) => s.label === UNASSIGNED_LABEL);
    expect(unassigned).toBeDefined();
    expect(unassigned.trades).toBe(2);
    expect(unassigned.netPnl).toBe(50);
  });
});

describe('computeSetupPerformance — math reuse', () => {
  it('computes win rate, avg RR, net/average PNL and averages from canonical values', () => {
    const trades = [
      T({ model: 'Breakout', result: 'Win', netPnl: 100, rr: 2 }),
      T({ model: 'Breakout', result: 'Win', netPnl: 50, rr: 3 }),
      T({ model: 'Breakout', result: 'Loss', netPnl: -50, rr: 1 }),
      T({ model: 'Breakout', result: 'Loss', netPnl: -150, rr: 1 }),
    ];
    const r = computeSetupPerformance(trades, { rank: 'netPnl' });
    const b = r.setups.find((s) => s.label === 'Breakout');
    expect(b.trades).toBe(4);
    expect(b.wins).toBe(2);
    expect(b.losses).toBe(2);
    expect(b.decided).toBe(4);
    expect(b.winRate).toBe(50);
    expect(b.netPnl).toBe(-50);
    expect(b.avgPnl).toBe(-12.5);
    expect(b.avgWin).toBe(75);
    expect(b.avgLoss).toBe(-100);
    expect(b.bestTrade).toBe(100);
    expect(b.worstTrade).toBe(-150);
    expect(b.status).toBe('Limited data');
  });

  it('average RR comes straight from the existing rr field', () => {
    const trades = [
      T({ model: 'Breakout', result: 'Win', netPnl: 100, rr: 2 }),
      T({ model: 'Breakout', result: 'Loss', netPnl: -50, rr: 1 }),
      T({ model: 'Breakout', result: 'Win', netPnl: 60, rr: 0 }),
    ];
    const r = computeSetupPerformance(trades);
    const b = r.setups.find((s) => s.label === 'Breakout');
    // Engine averages only valid r>0 values: (2+1)/2 = 1.5
    expect(b.avgRR).toBe(1.5);
  });

  it('profit factor from gross profit / gross loss as the engine defines it', () => {
    const trades = [
      T({ model: 'Breakout', result: 'Win', netPnl: 100 }),
      T({ model: 'Breakout', result: 'Win', netPnl: 50 }),
      T({ model: 'Breakout', result: 'Loss', netPnl: -50 }),
    ];
    const r = computeSetupPerformance(trades);
    const b = r.setups.find((s) => s.label === 'Breakout');
    expect(b.profitFactor).toBeCloseTo(150 / 50, 5);
  });

  it('treats an all-win setup as an infinite profit factor, never as 0%', () => {
    const trades = [
      T({ model: 'Breakout', result: 'Win', netPnl: 100, rr: 2 }),
      T({ model: 'Breakout', result: 'Win', netPnl: 50, rr: 2 }),
    ];
    const r = computeSetupPerformance(trades);
    const b = r.setups.find((s) => s.label === 'Breakout');
    expect(b.profitFactor).toBe(Infinity);
  });
});

describe('computeSetupPerformance — insufficient data handling', () => {
  it('0 decided trades → No data (BE-only trades never masquerade as wins)', () => {
    const r = computeSetupPerformance([T({ model: 'Breakout', result: 'BE', netPnl: 0 })]);
    const b = r.setups.find((s) => s.label === 'Breakout');
    expect(b.status).toBe('No data');
    expect(b.winRate).toBe(0);
  });

  it('1–4 decided trades → Limited data label', () => {
    const r = computeSetupPerformance([T({ model: 'Breakout', result: 'Win', netPnl: 100 })]);
    const b = r.setups.find((s) => s.label === 'Breakout');
    expect(b.status).toBe('Limited data');
  });

  it('5+ decided trades → Normal analysis label', () => {
    const trades = Array.from({ length: 5 }, () => T({ model: 'Breakout', result: 'Win', netPnl: 10 }));
    const r = computeSetupPerformance(trades);
    const b = r.setups.find((s) => s.label === 'Breakout');
    expect(b.status).toBe('Normal');
  });

  it('exports the guardrail constants', () => {
    expect(MIN_NORMAL).toBe(5);
    expect(MAX_LIMITED).toBe(4);
    expect(UNASSIGNED_LABEL).toBe('Unassigned');
  });
});

describe('computeSetupPerformance — filters & account isolation', () => {
  const dataset = () => [
    T({ date: '2024-01-02', instrument: 'EURUSD', session: 'London', model: 'Breakout', result: 'Win', netPnl: 100 }),
    T({ date: '2024-01-03', instrument: 'EURUSD', session: 'London', model: 'Breakout', result: 'Loss', netPnl: -50 }),
    T({ date: '2024-01-04', instrument: 'GBPUSD', session: 'New York', model: 'Pullback', result: 'Win', netPnl: 200 }),
    T({ date: '2024-02-05', instrument: 'GBPUSD', session: 'New York', model: 'Pullback', result: 'Loss', netPnl: -30 }),
  ];

  it('honours the pair filter (same filtered dataset as Analytics)', () => {
    const r = computeSetupPerformance(dataset(), { pair: 'EURUSD' });
    expect(r.setups).toHaveLength(1);
    expect(r.setups[0].label).toBe('Breakout');
    expect(r.totalTrades).toBe(2);
  });

  it('honours the session filter', () => {
    const r = computeSetupPerformance(dataset(), { session: 'New York' });
    expect(r.setups).toHaveLength(1);
    expect(r.setups[0].label).toBe('Pullback');
    expect(r.totalTrades).toBe(2);
  });

  it('honours an explicit date range', () => {
    const r = computeSetupPerformance(dataset(), { dateFrom: '2024-01-01', dateTo: '2024-01-31' });
    expect(r.totalTrades).toBe(3);
    expect(r.setups.map((s) => s.label).sort()).toEqual(['Breakout', 'Pullback']);
  });

  it('never bleeds across accounts computed from different arrays', () => {
    const accountATrades = dataset().map((t) => ({ ...t }));
    const accountBTrades = [
      T({ instrument: 'XAUUSD', model: 'Reversal', result: 'Win', netPnl: 999 }),
      T({ instrument: 'XAUUSD', model: 'Reversal', result: 'Loss', netPnl: -111 }),
    ];
    const a = computeSetupPerformance(accountATrades);
    const b = computeSetupPerformance(accountBTrades);
    expect(a.setups.map((s) => s.label).sort()).toEqual(['Breakout', 'Pullback']);
    const labelsB = b.setups.map((s) => s.label);
    expect(labelsB).toContain('Reversal');
    expect(labelsB).not.toContain('Breakout');
    expect(a.totalTrades).toBe(4);
    expect(b.totalTrades).toBe(2);
  });
});

describe('computeSetupPerformance — ranking', () => {
  it('sorts descending by net P&L by default', () => {
    const trades = [
      // Setup A: 5 wins × 40 = +200
      ...Array.from({ length: 5 }, () => T({ model: 'A', result: 'Win', netPnl: 40, rr: 1 })),
      // Setup B: mixed 100 -200 +10 -80 +40 -100 = -230
      T({ model: 'B', result: 'Win', netPnl: 100, rr: 2 }),
      T({ model: 'B', result: 'Win', netPnl: 10, rr: 2 }),
      T({ model: 'B', result: 'Win', netPnl: 40, rr: 1 }),
      T({ model: 'B', result: 'Loss', netPnl: -200, rr: 2 }),
      T({ model: 'B', result: 'Loss', netPnl: -80, rr: 1 }),
      T({ model: 'B', result: 'Loss', netPnl: -100, rr: 1 }),
    ];
    const r = computeSetupPerformance(trades, { rank: 'netPnl' });
    expect(r.setups[0].label).toBe('A');
    expect(r.setups[1].label).toBe('B');
  });

  it('ranks by win rate when requested', () => {
    const trades = [
      ...Array.from({ length: 5 }, () => T({ model: 'A', result: 'Win', netPnl: 40, rr: 1 })),
      T({ model: 'B', result: 'Win', netPnl: 10, rr: 1 }),
      T({ model: 'B', result: 'Loss', netPnl: -80, rr: 1 }),
    ];
    const r = computeSetupPerformance(trades, { rank: 'winRate' });
    expect(r.setups[0].label).toBe('A'); // 100% vs 50%
  });

  it('keeps No-data setups at the bottom of any ranking', () => {
    const trades = [T({ model: 'A', result: 'BE', netPnl: 0 }), ...Array.from({ length: 5 }, () => T({ model: 'B', result: 'Win', netPnl: 40 }))];
    const r = computeSetupPerformance(trades, { rank: 'netPnl' });
    expect(r.setups[r.setups.length - 1].status).toBe('No data');
  });
});

describe('applyPeriodFilter', () => {
  it('returns the same list for all', () => {
    const list = [T({ date: '2024-01-02' }), T({ date: '2024-01-04' }), T({ date: '2024-01-05' })];
    expect(applyPeriodFilter(list, 'all')).toHaveLength(3);
  });

  it('filters by explicit date range deterministically', () => {
    const list = [T({ date: '2024-01-01' }), T({ date: '2024-01-15' }), T({ date: '2024-02-01' })];
    expect(applyPeriodFilter(list, 'all', '2024-01-01', '2024-01-31')).toHaveLength(2);
  });
});