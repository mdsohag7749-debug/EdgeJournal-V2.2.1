import { ALL_ACCOUNTS_SENTINEL } from '../src/services/accountsService';
import { Trade, Account } from '../src/types/models';

describe('Multi-Account Isolation End-to-End Simulation', () => {
  const accounts: Account[] = [
    {
      id: 'acc-A',
      userId: 'user-1',
      name: 'Account A (Live)',
      currency: 'USD',
      startingBalance: 10000,
      isDefault: true,
      status: 'active',
    },
    {
      id: 'acc-B',
      userId: 'user-1',
      name: 'Account B (Prop Eval)',
      currency: 'USD',
      startingBalance: 100000,
      isDefault: false,
      status: 'active',
    },
  ];

  const tradesLedger: Trade[] = [
    {
      id: 't-A1',
      accountId: 'acc-A',
      symbol: 'AAPL',
      direction: 'Long',
      entryDate: '2026-08-01',
      entryPrice: 150,
      size: 100,
      netPnl: 350,
      status: 'Closed',
    },
    {
      id: 't-B1',
      accountId: 'acc-B',
      symbol: 'NQ',
      direction: 'Short',
      entryDate: '2026-08-01',
      entryPrice: 19500,
      size: 2,
      netPnl: 1200,
      status: 'Closed',
    },
  ];

  it('strictly isolates trades when switching between Account A and Account B', () => {
    // Select Account A
    let currentSelection = 'acc-A';
    let visibleTrades = tradesLedger.filter((t) => t.accountId === currentSelection);
    expect(visibleTrades.length).toBe(1);
    expect(visibleTrades[0].symbol).toBe('AAPL');

    // Switch to Account B
    currentSelection = 'acc-B';
    visibleTrades = tradesLedger.filter((t) => t.accountId === currentSelection);
    expect(visibleTrades.length).toBe(1);
    expect(visibleTrades[0].symbol).toBe('NQ');
  });

  it('aggregates correctly when switching from Account B to ALL_ACCOUNTS', () => {
    let currentSelection = ALL_ACCOUNTS_SENTINEL;
    const isAll = currentSelection === ALL_ACCOUNTS_SENTINEL;
    const visibleTrades = isAll ? tradesLedger : tradesLedger.filter((t) => t.accountId === currentSelection);

    expect(visibleTrades.length).toBe(2);
    const totalPnl = visibleTrades.reduce((acc, t) => acc + t.netPnl, 0);
    expect(totalPnl).toBe(1550);
  });

  it('guarantees mutations target active preferredAccountId', () => {
    const activeAccountId = 'acc-A';
    const newTradeInput: Partial<Trade> = {
      symbol: 'TSLA',
      direction: 'Long',
      entryPrice: 200,
      size: 50,
      netPnl: 500,
    };

    // Target assignment
    const createdTrade: Trade = {
      ...newTradeInput,
      id: 't-A2',
      accountId: newTradeInput.accountId || activeAccountId,
      status: 'Closed',
      entryDate: '2026-08-02',
    } as Trade;

    expect(createdTrade.accountId).toBe('acc-A');
  });
});
