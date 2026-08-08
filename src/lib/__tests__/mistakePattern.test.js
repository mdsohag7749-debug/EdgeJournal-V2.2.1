import { describe, it, expect } from 'vitest';
import {
  computeMistakePattern,
  classifyMistake,
  mistakesOf,
  RECURRING_MIN,
  FREQUENT_MIN,
  UNASSIGNED_LABEL,
} from '../mistakePattern';

let _id = 0;
const T = (o = {}) => ({
  id: `t${++_id}`,
  date: '2024-01-02',
  entryTime: '09:00',
  instrument: 'EURUSD',
  session: 'London',
  model: 'Breakout',
  result: 'Win',
  netPnl: 100,
  rr: 2,
  riskPercent: 1,
  mistakes: {},
  ...o,
});

describe('computeMistakePattern — basics & empty', () => {
  it('empty dataset -> hasData false, no mistake rows, no fabricated numbers', () => {
    const r = computeMistakePattern([]);
    expect(r.hasData).toBe(false);
    expect(r.hasMistakes).toBe(false);
    expect(r.rows).toEqual([]);
    expect(r.totalTrades).toBe(0);
    expect(r.totalOccurrences).toBe(0);
    expect(r.affectedTradeCount).toBe(0);
  });

  it('trades with no mistakes -> hasData true but no mistake rows', () => {
    const r = computeMistakePattern([T({}), T({})]);
    expect(r.hasData).toBe(true);
    expect(r.hasMistakes).toBe(false);
    expect(r.totalTrades).toBe(2);
    expect(r.rows).toEqual([]);
  });
});

describe('computeMistakePattern — occurrence & affected-trade counting', () => {
  it('counts occurrences and affected trades for a single mistake', () => {
    const trades = [
      T({ mistakes: { 'Early Entry': true } }),
      T({ mistakes: { 'Early Entry': true } }),
    ];
    const r = computeMistakePattern(trades);
    expect(r.hasMistakes).toBe(true);
    expect(r.rows).toHaveLength(1);
    const row = r.rows[0];
    expect(row.name).toBe('Early Entry');
    expect(row.occurrences).toBe(2);
    expect(row.affectedTrades).toBe(2);
  });

  it('distinguishes occurrences from affected trades when a mistake holds a numeric value', () => {
    const trades = [T({ mistakes: { 'Over Trading': 3 } })];
    const r = computeMistakePattern(trades);
    const row = r.rows[0];
    expect(row.occurrences).toBe(3);
    expect(row.affectedTrades).toBe(1); // one trade, one affected trade
  });

  it('one trade with multiple mistakes contributes to each, without duplicating the trade', () => {
    const trades = [
      T({ mistakes: { 'Early Entry': true, 'FOMO Entry': true } }),
      T({ mistakes: { 'Early Entry': true } }),
    ];
    const r = computeMistakePattern(trades);
    expect(r.rows).toHaveLength(2);
    const early = r.rows.find((x) => x.name === 'Early Entry');
    const fomo = r.rows.find((x) => x.name === 'FOMO Entry');
    expect(early.occurrences).toBe(2);
    expect(fomo.occurrences).toBe(1);
    expect(r.totalOccurrences).toBe(3);
    expect(r.affectedTradeCount).toBe(2); // 2 trades total, not 3
  });

  it('reports total occurrences and affected-trade count across the dataset', () => {
    const trades = [
      T({ mistakes: { 'Early Entry': true } }),
      T({ mistakes: { 'Early Entry': true, 'FOMO Entry': true } }),
      T({ mistakes: {} }),
    ];
    const r = computeMistakePattern(trades);
    expect(r.totalTrades).toBe(3);
    expect(r.affectedTradeCount).toBe(2);
    expect(r.totalOccurrences).toBe(3);
  });
});

describe('computeMistakePattern — impact metrics', () => {
  it('computes wins, losses, win rate and loss rate from affected trades', () => {
    const trades = [
      T({ result: 'Win', netPnl: 100, mistakes: { 'Early Exit': true } }),
      T({ result: 'Loss', netPnl: -40, mistakes: { 'Early Exit': true } }),
      T({ result: 'Loss', netPnl: -60, mistakes: { 'Early Exit': true } }),
      T({ result: 'BE', netPnl: 0, mistakes: { 'Early Exit': true } }),
    ];
    const r = computeMistakePattern(trades);
    const row = r.rows[0];
    expect(row.wins).toBe(1);
    expect(row.losses).toBe(2);
    expect(row.winRate).toBeCloseTo(33.33, 1);
    expect(row.lossRate).toBeCloseTo(66.67, 1);
  });

  it('computes net PnL, average PnL and average RR', () => {
    const trades = [
      T({ result: 'Win', netPnl: 100, rr: 2, mistakes: { 'Moved SL': true } }),
      T({ result: 'Loss', netPnl: -40, rr: 1, mistakes: { 'Moved SL': true } }),
      T({ result: 'Loss', netPnl: -160, rr: 0.5, mistakes: { 'Moved SL': true } }),
    ];
    const r = computeMistakePattern(trades);
    const row = r.rows[0];
    expect(row.netPnl).toBeCloseTo(-100, 1);
    expect(row.avgPnl).toBeCloseTo(-33.33, 1);
    expect(row.avgRR).toBeCloseTo((2 + 1 + 0.5) / 3, 1);
  });

  it('average RR only averages rr > 0 values (matches engine)', () => {
    const trades = [
      T({ result: 'Win', netPnl: 100, rr: 2, mistakes: { 'Over Trading': true } }),
      T({ result: 'Loss', netPnl: -40, rr: 0, mistakes: { 'Over Trading': true } }),
    ];
    const r = computeMistakePattern(trades);
    expect(r.rows[0].avgRR).toBe(2);
  });

  it('does not pretend a single positive trade is a pattern and keeps metrics honest', () => {
    const trades = [T({ result: 'Win', netPnl: 100, rr: 5, mistakes: { 'No Stop Loss': true } })];
    const r = computeMistakePattern(trades);
    const row = r.rows[0];
    expect(row.affectedTrades).toBe(1);
    expect(row.winRate).toBe(100);
    expect(row.status).toBe('Occasional');
  });
});

describe('classifyMistake — transparent thresholds', () => {
  it('0 -> No Data', () => expect(classifyMistake(0)).toBe('No Data'));
  it('1-2 -> Occasional', () => {
    expect(classifyMistake(1)).toBe('Occasional');
    expect(classifyMistake(2)).toBe('Occasional');
  });
  it('3-4 -> Recurring', () => {
    expect(classifyMistake(3)).toBe('Recurring');
    expect(classifyMistake(4)).toBe('Recurring');
  });
  it('5+ -> Frequent', () => {
    expect(classifyMistake(5)).toBe('Frequent');
    expect(classifyMistake(9)).toBe('Frequent');
  });
  it('exports the threshold constants', () => {
    expect(RECURRING_MIN).toBe(3);
    expect(FREQUENT_MIN).toBe(5);
  });
});

describe('computeMistakePattern — custom & dynamic mistake tags', () => {
  it('supports custom mistake tags outside the built-in vocabulary', () => {
    const trades = [T({ mistakes: { 'Custom Tag #42': true } })];
    const r = computeMistakePattern(trades);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].name).toBe('Custom Tag #42');
  });

  it('mistakesOf returns all truthy keys', () => {
    expect(mistakesOf({ mistakes: { A: true, B: false, C: 1 } })).toEqual(['A', 'C']);
    expect(mistakesOf({})).toEqual([]);
    expect(mistakesOf(null)).toEqual([]);
  });
});

describe('computeMistakePattern — relationships', () => {
  const rel = () => [
    T({ instrument: 'EURUSD', session: 'London', model: 'Breakout', mistakes: { FOMO: true } }),
    T({ instrument: 'EURUSD', session: 'London', model: 'Breakout', mistakes: { FOMO: true } }),
    T({ instrument: 'GBPJPY', session: 'New York', model: 'Pullback', mistakes: { FOMO: true } }),
    T({ instrument: 'GBPJPY', session: 'New York', model: 'Pullback', mistakes: { FOMO: true } }),
    T({ instrument: 'XAUUSD', session: 'Asia', model: 'Reversal', mistakes: { FOMO: true } }),
  ];

  it('builds mistake × setup relationship counts', () => {
    const r = computeMistakePattern(rel());
    const row = r.rows[0];
    expect(row.setups.some((s) => s.label === 'Breakout' && s.count === 2)).toBe(true);
    expect(row.setups.some((s) => s.label === 'Pullback' && s.count === 2)).toBe(true);
  });

  it('builds mistake × pair relationship counts', () => {
    const r = computeMistakePattern(rel());
    const row = r.rows[0];
    expect(row.pairs.some((p) => p.label === 'GBPJPY' && p.count === 2)).toBe(true);
    expect(row.pairs.some((p) => p.label === 'XAUUSD' && p.count === 1)).toBe(true);
  });

  it('builds mistake × session relationship counts', () => {
    const r = computeMistakePattern(rel());
    const row = r.rows[0];
    expect(row.sessions.some((s) => s.label === 'London' && s.count === 2)).toBe(true);
    expect(row.sessions.some((s) => s.label === 'New York' && s.count === 2)).toBe(true);
    expect(row.sessions.some((s) => s.label === 'Asia' && s.count === 1)).toBe(true);
  });
});

describe('computeMistakePattern — filters & account isolation', () => {
  const dataset = () => [
    T({ date: '2024-01-02', instrument: 'EURUSD', session: 'London', model: 'Breakout', mistakes: { 'Early Entry': true } }),
    T({ date: '2024-01-03', instrument: 'EURUSD', session: 'London', model: 'Breakout', mistakes: { 'Early Entry': true } }),
    T({ date: '2024-01-04', instrument: 'GBPUSD', session: 'New York', model: 'Pullback', mistakes: { FOMO: true } }),
    T({ date: '2024-02-05', instrument: 'GBPUSD', session: 'New York', model: 'Pullback', mistakes: { FOMO: true } }),
  ];

  it('honours an explicit date range', () => {
    const r = computeMistakePattern(dataset(), { dateFrom: '2024-01-01', dateTo: '2024-01-31' });
    expect(r.totalTrades).toBe(3);
    expect(r.totalOccurrences).toBe(3);
  });

  it('honours the pair filter', () => {
    const r = computeMistakePattern(dataset(), { pair: 'GBPUSD' });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].name).toBe('FOMO');
  });

  it('honours the session filter', () => {
    const r = computeMistakePattern(dataset(), { session: 'London' });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].name).toBe('Early Entry');
  });

  it('honours the setup/model filter', () => {
    const r = computeMistakePattern(dataset(), { setup: 'Pullback' });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].name).toBe('FOMO');
  });

  it('never bleeds across accounts computed from different arrays', () => {
    const accountATrades = dataset();
    const accountBTrades = [T({ instrument: 'XAUUSD', mistakes: { 'Revenge Trade': true } })];
    const a = computeMistakePattern(accountATrades);
    const b = computeMistakePattern(accountBTrades);
    expect(a.rows.map((x) => x.name).sort()).toEqual(['Early Entry', 'FOMO']);
    expect(b.rows.map((x) => x.name)).toEqual(['Revenge Trade']);
    expect(a.totalTrades).toBe(4);
    expect(b.totalTrades).toBe(1);
  });
});

describe('computeMistakePattern — ranking & option list', () => {
  const data = () => [
    T({ instrument: 'EURUSD', mistakes: { A: true } }),
    T({ mistakes: { B: true } }),
    T({ mistakes: { B: true } }),
    T({ mistakes: { C: true } }),
    T({ mistakes: { C: true } }),
    T({ mistakes: { C: true } }),
  ];

  it('defaults to ranking by affected-trade frequency', () => {
    const r = computeMistakePattern(data());
    expect(r.rows[0].name).toBe('C');
    expect(r.rows[1].name).toBe('B');
    expect(r.rows[2].name).toBe('A');
  });

  it('ranks by occurrences when requested', () => {
    const r = computeMistakePattern(data(), { rank: 'occurrences' });
    expect(r.rows[0].name).toBe('C');
  });

  it('keeps "No Data"/absent mistakes out of the table (never shows fabricated rows)', () => {
    const r = computeMistakePattern(data());
    expect(r.rows.some((x) => x.status === 'No Data')).toBe(false);
  });

  it('derives pair/session/setup option lists from data', () => {
    const r = computeMistakePattern([
      T({ instrument: 'EURUSD', session: 'London', model: 'Breakout', mistakes: { A: true } }),
      T({ instrument: 'GBPUSD', session: 'New York', model: 'Pullback', mistakes: { B: true } }),
    ]);
    expect(r.pairOptions).toContain('EURUSD');
    expect(r.pairOptions).toContain('GBPUSD');
    expect(r.setupOptions).toContain('Breakout');
    expect(r.sessionOptions).toContain('London');
  });

  it('generates descriptive insights, never causal claims', () => {
    const trades = Array.from({ length: 5 }, () => T({ mistakes: { FOMO: true }, result: 'Loss', netPnl: -50 }));
    const r = computeMistakePattern(trades);
    expect(r.insights.length).toBeGreaterThan(0);
    const combined = r.insights.map((i) => i.claim).join(' ');
    expect(combined).toMatch(/associated with/i);
    expect(combined).not.toMatch(/caused/i);
    expect(combined).not.toMatch(/guaranteed/i);
  });

  it('marks 5+ occurrences as Frequent in a rule-based insight', () => {
    const trades = Array.from({ length: 5 }, (_, i) => T({ id: `id${i}`, mistakes: { FOMO: true } }));
    const r = computeMistakePattern(trades);
    expect(r.rows[0].status).toBe('Frequent');
    expect(r.insights.some((i) => /Frequent/i.test(i.claim))).toBe(true);
  });
});

describe('computeMistakePattern — misc safety', () => {
  it('resets module-level concerns: trades without id still counted distinctly', () => {
    const t1 = T({ id: undefined, mistakes: { A: true } });
    const t2 = T({ id: undefined, mistakes: { A: true } });
    const r = computeMistakePattern([t1, t2]);
    // two distinct trades even without ids (keyed by array element)
    expect(r.rows[0].affectedTrades).toBe(2);
  });

  it('passing bad rank falls back to frequency', () => {
    const r = computeMistakePattern([T({ mistakes: { A: true } })], { rank: 'bogus' });
    expect(r.rank).toBe('affectedTrades');
  });
});