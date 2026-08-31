import { computeTradeMetrics, computeEquityCurve } from '../src/utils/calculations';
import { Trade } from '../src/types/models';

describe('Deterministic Calculations Engine', () => {
  const sampleTrades: Trade[] = [
    {
      id: '1',
      userId: 'u1',
      accountId: 'a1',
      symbol: 'AAPL',
      direction: 'Long',
      entryDate: '2026-08-01',
      entryPrice: 150,
      exitPrice: 155,
      size: 100,
      netPnl: 500,
      status: 'Closed',
    },
    {
      id: '2',
      userId: 'u1',
      accountId: 'a1',
      symbol: 'TSLA',
      direction: 'Short',
      entryDate: '2026-08-02',
      entryPrice: 200,
      exitPrice: 205,
      size: 50,
      netPnl: -250,
      status: 'Closed',
    },
    {
      id: '3',
      userId: 'u1',
      accountId: 'a1',
      symbol: 'NVDA',
      direction: 'Long',
      entryDate: '2026-08-03',
      entryPrice: 100,
      exitPrice: 105,
      size: 100,
      netPnl: 500,
      status: 'Closed',
    },
  ];

  it('computes correct win rate and total net PnL', () => {
    const metrics = computeTradeMetrics(sampleTrades, 10000);
    expect(metrics.totalTrades).toBe(3);
    expect(metrics.winningTrades).toBe(2);
    expect(metrics.losingTrades).toBe(1);
    expect(metrics.winRate).toBe(66.7);
    expect(metrics.totalNetPnl).toBe(750);
    expect(metrics.grossProfit).toBe(1000);
    expect(metrics.grossLoss).toBe(250);
    expect(metrics.profitFactor).toBe(4);
  });

  it('handles empty trade list safely', () => {
    const metrics = computeTradeMetrics([], 10000);
    expect(metrics.totalTrades).toBe(0);
    expect(metrics.winRate).toBe(0);
    expect(metrics.profitFactor).toBe(0);
    expect(metrics.totalNetPnl).toBe(0);
  });

  it('computes equity curve series', () => {
    const curve = computeEquityCurve(sampleTrades, 10000);
    expect(curve.length).toBe(3);
    expect(curve[0].balance).toBe(10500);
    expect(curve[1].balance).toBe(10250);
    expect(curve[2].balance).toBe(10750);
  });
});
