import { describe, it, expect } from 'vitest';
import {
  computeChallengeMetrics,
  countTradingDays,
  daysRemaining,
} from '../src/utils/challengeStats';
import { Challenge, Trade } from '../src/types/models';

const baseChallenge: Challenge = {
  id: 'ch-test-1',
  name: '100K FTMO Evaluation',
  propFirm: 'FTMO',
  challengeType: 'Phase 1',
  startingBalance: 100000,
  profitTarget: 10000,
  dailyDrawdown: 5000,
  maximumDrawdown: 10000,
  minTradingDays: 5,
  startDate: '2026-03-01',
  endDate: '2026-12-31',
  status: 'active',
};

const sampleChallengeTrades: Trade[] = [
  {
    id: 't1',
    accountId: 'acc1',
    symbol: 'NQ',
    direction: 'Long',
    entryDate: '2026-03-02',
    entryTime: '09:30',
    entryPrice: 18000,
    size: 2,
    netPnl: 3500,
    status: 'Closed',
  },
  {
    id: 't2',
    accountId: 'acc1',
    symbol: 'ES',
    direction: 'Long',
    entryDate: '2026-03-02',
    entryTime: '14:00',
    entryPrice: 5000,
    size: 1,
    netPnl: -1200,
    status: 'Closed',
  },
  {
    id: 't3',
    accountId: 'acc1',
    symbol: 'EURUSD',
    direction: 'Short',
    entryDate: '2026-03-03',
    entryTime: '08:00',
    entryPrice: 1.09,
    size: 1,
    netPnl: -2000,
    status: 'Closed',
  },
  {
    id: 't4',
    accountId: 'acc1',
    symbol: 'NQ',
    direction: 'Long',
    entryDate: '2026-03-04',
    entryTime: '10:00',
    entryPrice: 18100,
    size: 2,
    netPnl: 4000,
    status: 'Closed',
  },
  // Out of window trade (should be ignored)
  {
    id: 't5_out',
    accountId: 'acc1',
    symbol: 'NQ',
    direction: 'Long',
    entryDate: '2026-02-28',
    entryTime: '10:00',
    entryPrice: 17900,
    size: 1,
    netPnl: 99999,
    status: 'Closed',
  },
];

describe('Challenge Stats — Live Metrics & Calculation Parity', () => {
  it('derives live balance, equity, net P&L and profit progress strictly inside challenge window', () => {
    const m = computeChallengeMetrics(baseChallenge, sampleChallengeTrades);
    // In-window trades: t1 (+3500), t2 (-1200), t3 (-2000), t4 (+4000)
    // Sum = 3500 - 1200 - 2000 + 4000 = 4300
    expect(m.totalTrades).toBe(4);
    expect(m.netPnl).toBe(4300);
    expect(m.startingBalance).toBe(100000);
    expect(m.currentBalance).toBe(104300);
    expect(m.equity).toBe(104300);
    expect(m.profitTarget).toBe(10000);
    expect(m.profitRemaining).toBe(5700); // 10000 - 4300
    expect(m.profitProgress).toBeCloseTo(0.43, 4); // 4300 / 10000
  });

  it('calculates worst single-day daily drawdown', () => {
    const m = computeChallengeMetrics(baseChallenge, sampleChallengeTrades);
    // 2026-03-02: +3500 - 1200 = +2300 (profitable day)
    // 2026-03-03: -2000 (loss day, dailyDDUsed = 2000)
    // 2026-03-04: +4000 (profitable day)
    expect(m.dailyDDUsed).toBe(2000);
    expect(m.dailyDrawdown).toBe(5000);
    expect(m.dailyDDRemaining).toBe(3000); // 5000 - 2000
    expect(m.dailyDDProgress).toBe(2000 / 5000); // 0.4
  });

  it('calculates maximum drawdown (deepest peak-to-trough across equity curve)', () => {
    const m = computeChallengeMetrics(baseChallenge, sampleChallengeTrades);
    // Chronological balances:
    // start: 100000, peak = 100000
    // t1 (+3500): 103500, peak = 103500
    // t2 (-1200): 102300, peak = 103500, dd = 1200
    // t3 (-2000): 100300, peak = 103500, dd = 3200
    // t4 (+4000): 104300, peak = 104300, dd = 0
    // maxDDUsed = 3200
    expect(m.maxDDUsed).toBe(3200);
    expect(m.maximumDrawdown).toBe(10000);
    expect(m.maxDDRemaining).toBe(6800); // 10000 - 3200
    expect(m.maxDDProgress).toBe(3200 / 10000); // 0.32
  });

  it('counts distinct calendar trading days within the window', () => {
    const m = computeChallengeMetrics(baseChallenge, sampleChallengeTrades);
    // Distinct days: 2026-03-02, 2026-03-03, 2026-03-04 = 3 days
    expect(m.tradingDaysCompleted).toBe(3);
    expect(m.minTradingDays).toBe(5);
    expect(m.tradingDaysRemaining).toBe(2); // 5 - 3
    expect(m.tradingDaysProgress).toBe(3 / 5);
  });

  it('counts trading days using standalone helper countTradingDays', () => {
    const count = countTradingDays(sampleChallengeTrades, '2026-03-01', '2026-12-31');
    expect(count).toBe(3);
  });

  it('handles empty trades list safely', () => {
    const m = computeChallengeMetrics(baseChallenge, []);
    expect(m.totalTrades).toBe(0);
    expect(m.netPnl).toBe(0);
    expect(m.currentBalance).toBe(100000);
    expect(m.profitProgress).toBe(0);
    expect(m.profitRemaining).toBe(10000);
    expect(m.dailyDDUsed).toBe(0);
    expect(m.maxDDUsed).toBe(0);
    expect(m.tradingDaysCompleted).toBe(0);
    expect(m.status).toBe('active');
  });

  it('derives status "completed" when profit target reached AND min trading days met', () => {
    const winningTrades: Trade[] = [
      { id: '1', entryDate: '2026-03-01', netPnl: 2500, status: 'Closed' } as any,
      { id: '2', entryDate: '2026-03-02', netPnl: 2500, status: 'Closed' } as any,
      { id: '3', entryDate: '2026-03-03', netPnl: 2500, status: 'Closed' } as any,
      { id: '4', entryDate: '2026-03-04', netPnl: 2500, status: 'Closed' } as any,
      { id: '5', entryDate: '2026-03-05', netPnl: 500, status: 'Closed' } as any,
    ];
    // Total profit = 10500 >= 10000, 5 trading days >= 5 minTradingDays
    const m = computeChallengeMetrics(baseChallenge, winningTrades);
    expect(m.profitProgress).toBeGreaterThanOrEqual(1);
    expect(m.tradingDaysCompleted).toBe(5);
    expect(m.status).toBe('completed');
  });

  it('derives status "failed" when daily drawdown is breached', () => {
    const breachedTrades: Trade[] = [
      { id: '1', entryDate: '2026-03-02', netPnl: -5500, status: 'Closed' } as any,
    ];
    const m = computeChallengeMetrics(baseChallenge, breachedTrades);
    expect(m.dailyDDUsed).toBe(5500);
    expect(m.dailyDDProgress).toBe(1);
    expect(m.status).toBe('failed');
  });

  it('derives status "failed" when max drawdown is breached', () => {
    const breachedTrades: Trade[] = [
      { id: '1', entryDate: '2026-03-02', netPnl: -11000, status: 'Closed' } as any,
    ];
    const m = computeChallengeMetrics(baseChallenge, breachedTrades);
    expect(m.maxDDUsed).toBe(11000);
    expect(m.maxDDProgress).toBe(1);
    expect(m.status).toBe('failed');
  });

  it('derives status "pass" when progress >= 70% and max drawdown is low (<50%)', () => {
    const highTrades: Trade[] = [
      { id: '1', entryDate: '2026-03-02', netPnl: 7500, status: 'Closed' } as any,
    ];
    const m = computeChallengeMetrics(baseChallenge, highTrades);
    expect(m.profitProgress).toBe(0.75);
    expect(m.maxDDProgress).toBe(0);
    expect(m.status).toBe('pass');
  });

  it('derives status "failed" when challenge deadline has passed', () => {
    const expiredChallenge: Challenge = {
      ...baseChallenge,
      endDate: '2026-01-01', // in the past
    };
    const m = computeChallengeMetrics(expiredChallenge, sampleChallengeTrades);
    expect(m.daysRemaining).toBeLessThan(0);
    expect(m.status).toBe('failed');
  });
});
