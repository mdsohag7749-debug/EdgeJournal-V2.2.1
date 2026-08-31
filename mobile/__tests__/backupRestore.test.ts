import { backupService } from '../src/services/backupService';
import { Account, Trade, Goal } from '../src/types/models';

describe('Backup & Restore Service', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      userId: 'u1',
      name: 'Main',
      currency: 'USD',
      startingBalance: 10000,
      isDefault: true,
      status: 'active',
    },
  ];

  const mockTrades: Trade[] = [
    {
      id: 'tr-1',
      accountId: 'acc-1',
      symbol: 'AAPL',
      direction: 'Long',
      entryDate: '2026-08-01',
      entryPrice: 150,
      size: 100,
      netPnl: 250,
      status: 'Closed',
    },
  ];

  const mockGoals: Goal[] = [
    {
      id: 'g-1',
      title: 'Maintain 2.0 RR',
      completed: true,
    },
  ];

  it('builds a clean sanitized EdgeJournal backup payload', () => {
    const payload = backupService.buildBackupPayload({
      accounts: mockAccounts,
      trades: mockTrades,
      goals: mockGoals,
    });

    expect(payload.app).toBe('EdgeJournal');
    expect(payload.version).toBe(1);
    expect(payload.accounts?.length).toBe(1);
    expect(payload.trades?.length).toBe(1);
    expect(payload.goals?.length).toBe(1);
  });

  it('validates authentic backup files', () => {
    const payload = backupService.buildBackupPayload({
      accounts: mockAccounts,
      trades: mockTrades,
    });

    const result = backupService.validateBackupData(payload);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid or corrupted backup payloads', () => {
    expect(backupService.validateBackupData(null).valid).toBe(false);
    expect(backupService.validateBackupData({ app: 'OtherApp' }).valid).toBe(false);
    expect(backupService.validateBackupData({ app: 'EdgeJournal', trades: 'corrupted' }).valid).toBe(false);
  });
});
