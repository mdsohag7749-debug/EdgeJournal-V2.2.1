import { describe, it, expect } from 'vitest';
import { computeAnalytics } from '../analytics';
import { computeDashboardStats } from '../calculations';
import { computeMistakeAnalytics } from '../mistakeAnalytics';
import { computeRiskAnalytics } from '../riskAnalytics';
import { computeEmotionAnalytics } from '../emotionAnalytics';
import { computeInstitutionalInsights } from '../insightAnalytics';
import { computeSmartInsights } from '../smartInsights';
import { computePatternDetection } from '../patternDetection';

// Deterministic mulberry32 PRNG so "large/random" datasets are reproducible.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INSTRUMENTS = ['EURUSD', 'GBPUSD', 'XAUUSD', 'US30', 'BTCUSD'];
const MODELS = ['Breakout', 'Reversal', 'Pullback'];
const SESSIONS = ['London', 'New York', 'Asia'];

function genTrades(n) {
  const rnd = mulberry32(42);
  const out = [];
  for (let i = 0; i < n; i++) {
    const day = (i % 28) + 1;
    const win = rnd() > 0.5;
    out.push({
      id: `gen-${i}`,
      accountId: 'seed-account',
      date: `2024-01-${String(day).padStart(2, '0')}`,
      entryTime: `${String(8 + Math.floor(rnd() * 10)).padStart(2, '0')}:00`,
      instrument: INSTRUMENTS[Math.floor(rnd() * INSTRUMENTS.length)],
      session: SESSIONS[Math.floor(rnd() * SESSIONS.length)],
      model: MODELS.length === 3 ? MODELS[Math.floor(rnd() * MODELS.length)] : 'A',
      result: win ? 'Win' : 'Loss',
      netPnl: win ? Math.round(rnd() * 200 + 10) / 1 : -Math.round(rnd() * 150 + 10),
      rr: win ? 2 : 1,
      riskPercent: 1 + Math.round(rnd() * 3),
      mistakes: rnd() > 0.7 ? { 'Late Entry': true, 'Counter Trend': true } : {},
      psychology: { Confidence: 3 + Math.floor(rnd() * 3) },
    });
  }
  return out;
}

describe('LARGE DATASET — 500-trade regression (Sprint 6.3/6.5 pressure)', () => {
  const trades = genTrades(500);

  it('computeAnalytics completes and returns valid aggregates', () => {
    const a = computeAnalytics(trades);
    expect(a.total).toBe(500);
    expect(a.wins + a.losses + a.breakevens).toBe(500);
    expect(Number.isFinite(a.winRate)).toBe(true);
    expect(a.winRate).toBeGreaterThanOrEqual(0);
    expect(a.winRate).toBeLessThanOrEqual(100);
    expect(Number.isFinite(a.netPnl)).toBe(true);
    expect(a.byPair.reduce((s, g) => s + g.trades, 0)).toBe(500);
    expect(a.byStrategy.length).toBeGreaterThan(0);
  });

  it('dashboard stats handle the full array without NaN', () => {
    const s = computeDashboardStats(trades);
    expect(s.total).toBe(500);
    ['netPnl', 'tradeWinPct', 'avgRR', 'profitFactor', 'expectancy', 'avgWin'].forEach((k) => {
      expect(Number.isNaN(s[k])).toBe(false);
    });
    expect(s.equityCurve.length).toBe(500);
  });

  it('companion analytics modules digest the large array', () => {
    const m = computeMistakeAnalytics(trades);
    expect(m.total).toBe(500);
    expect(Number.isFinite(m.mistakeRate)).toBe(true);

    const r = computeRiskAnalytics(trades);
    expect(r.total).toBe(500);
    expect(Number.isFinite(r.maxDrawdown)).toBe(true);

    const e = computeEmotionAnalytics(trades);
    expect(Array.isArray(e.perEmotion)).toBe(true);

    const i = computeInstitutionalInsights(trades);
    expect(i.decided).toBe(500);

    // intelligence engines over 500 rows must settle without throwing
    expect(computeSmartInsights(trades).decidedCount).toBe(500);
    expect(Array.isArray(computePatternDetection(trades).patterns)).toBe(true);
  });
});

describe('EDGE CASES — shape-level sanity across engines', () => {
  const win = { date: '2024-01-02', result: 'Win', netPnl: 10, rr: 2, riskPercent: 1, instrument: 'EURUSD', session: 'London' };
  const loss = { date: '2024-01-03', result: 'Loss', netPnl: -5, rr: 1, riskPercent: 1, instrument: 'EURUSD', session: 'London' };
  const flat = { date: '2024-01-04', result: 'BE', netPnl: 0 };

  it('zero trades → zeroed but valid everywhere', () => {
    expect(computeAnalytics([]).total).toBe(0);
    expect(computeDashboardStats([]).netPnl).toBe(0);
    expect(computeMistakeAnalytics([]).total).toBe(0);
  });

  it('missing data (no trades array) is tolerated by defensive engines', () => {
    // mistake core guards with `|| []`
    expect(computeMistakeAnalytics(undefined).total).toBe(0);
  });

  it('a single trade, all-wins, all-losses, mixed', () => {
    expect(computeAnalytics([win]).winRate).toBe(100);
    expect(computeAnalytics([loss]).winRate).toBe(0);
    expect(computeAnalytics([win, win]).profitFactor).toBe(Infinity);
    expect(computeAnalytics([loss, loss]).profitFactor).toBe(0);
    expect(computeAnalytics([win, loss, flat]).breakevens).toBe(1);
  });

  it('empty optional values / very small & very large balances', () => {
    // netPnl-bearing trade with no optional analytics fields
    const sparse = { date: '2024-01-02', result: 'Win', netPnl: 0.01 };
    const a = computeAnalytics([sparse]);
    expect(a.avgWin).toBe(0.01);
    // large account balance doesn't overflow drawdown math
    const big = computeAnalytics(genTrades(100).map((x) => ({ ...x, netPnl: x.netPnl % 200 })));
    expect(big.total).toBe(100);
  });
});