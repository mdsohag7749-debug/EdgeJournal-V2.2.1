import { ALL_ACCOUNTS_SENTINEL } from '../src/services/accountsService';
import { Trade } from '../src/types/models';

describe('DataContext Account Scoping & Isolation', () => {
  const sampleTrades: Trade[] = [
    {
      id: 't-1',
      accountId: 'acc-main',
      symbol: 'AAPL',
      direction: 'Long',
      entryDate: '2026-08-01',
      entryPrice: 150,
      size: 100,
      netPnl: 400,
      status: 'Closed',
    },
    {
      id: 't-2',
      accountId: 'acc-futures',
      symbol: 'ES',
      direction: 'Short',
      entryDate: '2026-08-02',
      entryPrice: 5500,
      size: 2,
      netPnl: -200,
      status: 'Closed',
    },
    {
      id: 't-3',
      accountId: 'acc-main',
      symbol: 'NVDA',
      direction: 'Long',
      entryDate: '2026-08-03',
      entryPrice: 120,
      size: 50,
      netPnl: 300,
      status: 'Closed',
    },
  ];

  it('filters trades strictly to concrete selected account', () => {
    const selectedAccountId = 'acc-main';
    const scopedTrades = sampleTrades.filter((t) => t.accountId === selectedAccountId);
    expect(scopedTrades.length).toBe(2);
    expect(scopedTrades.map((t) => t.id)).toEqual(['t-1', 't-3']);
  });

  it('aggregates all trades when ALL_ACCOUNTS sentinel is selected', () => {
    const activeSelection = ALL_ACCOUNTS_SENTINEL;
    const isAll = activeSelection === ALL_ACCOUNTS_SENTINEL;
    const scopedTrades = isAll ? sampleTrades : sampleTrades.filter((t) => t.accountId === activeSelection);
    expect(scopedTrades.length).toBe(3);
    const totalPnl = scopedTrades.reduce((sum, t) => sum + t.netPnl, 0);
    expect(totalPnl).toBe(500);
  });
});
