import { Trade } from '../src/types/models';

describe('Advanced Chart Plotting & Metric Interpolation', () => {
  const sampleTrades: Trade[] = [
    {
      id: 't1',
      accountId: 'acc-1',
      symbol: 'NVDA',
      direction: 'Long',
      entryDate: '2026-08-01',
      entryPrice: 100,
      size: 10,
      netPnl: 200,
      status: 'Closed',
    },
    {
      id: 't2',
      accountId: 'acc-1',
      symbol: 'TSLA',
      direction: 'Short',
      entryDate: '2026-08-02',
      entryPrice: 200,
      size: 5,
      netPnl: -100,
      status: 'Closed',
    },
    {
      id: 't3',
      accountId: 'acc-1',
      symbol: 'AAPL',
      direction: 'Long',
      entryDate: '2026-08-03',
      entryPrice: 150,
      size: 20,
      netPnl: 400,
      status: 'Closed',
    },
  ];

  it('calculates cumulative equity points accurately from starting balance', () => {
    const startingBalance = 10000;
    const points: number[] = [startingBalance];
    let current = startingBalance;

    for (const t of sampleTrades) {
      current += t.netPnl;
      points.push(current);
    }

    expect(points).toEqual([10000, 10200, 10100, 10500]);
    expect(points[points.length - 1]).toBe(10500);
  });

  it('computes underwater drawdown series correctly', () => {
    const startingBalance = 10000;
    let peak = startingBalance;
    let current = startingBalance;
    const drawdowns: number[] = [0];

    for (const t of sampleTrades) {
      current += t.netPnl;
      if (current > peak) peak = current;
      const dd = ((peak - current) / peak) * 100;
      drawdowns.push(dd);
    }

    // Step 1: 10200 (peak=10200, dd=0%)
    // Step 2: 10100 (peak=10200, dd= (100/10200)*100 ≈ 0.98%)
    // Step 3: 10500 (peak=10500, dd=0%)
    expect(drawdowns[0]).toBe(0);
    expect(drawdowns[1]).toBe(0);
    expect(drawdowns[2]).toBeCloseTo(0.98, 1);
    expect(drawdowns[3]).toBe(0);
  });
});
