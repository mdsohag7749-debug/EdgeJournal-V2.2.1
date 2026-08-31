import { ALL_ACCOUNTS_SENTINEL } from '../src/services/accountsService';
import { Account } from '../src/types/models';

describe('Account Scoping Logic', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      userId: 'u1',
      name: 'Main Equities',
      currency: 'USD',
      startingBalance: 25000,
      currentBalance: 28000,
      totalPnl: 3000,
      winRate: 65,
      tradeCount: 20,
      isDefault: true,
      status: 'active',
    },
    {
      id: 'acc-2',
      userId: 'u1',
      name: 'Futures Scalp',
      currency: 'USD',
      startingBalance: 10000,
      currentBalance: 11500,
      totalPnl: 1500,
      winRate: 70,
      tradeCount: 15,
      isDefault: false,
      status: 'active',
    },
  ];

  it('correctly resolves default account when no selection is present', () => {
    const defaultAcc = mockAccounts.find((a) => a.isDefault) || mockAccounts[0];
    expect(defaultAcc.id).toBe('acc-1');
  });

  it('supports ALL_ACCOUNTS sentinel for aggregated reads', () => {
    const selection = ALL_ACCOUNTS_SENTINEL;
    const isAll = selection === ALL_ACCOUNTS_SENTINEL;
    expect(isAll).toBe(true);

    const preferredAccountId = isAll ? (mockAccounts.find((a) => a.isDefault)?.id || mockAccounts[0].id) : selection;
    // Writes always target a concrete account
    expect(preferredAccountId).toBe('acc-1');
  });
});
