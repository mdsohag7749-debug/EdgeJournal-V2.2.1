import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TradingJournal from '../../pages/TradingJournal';

// Shared test state so the mocked hooks can be re-pointed per test.
const state = vi.hoisted(() => ({
  data: {
    trades: { items: [], add: vi.fn(), update: vi.fn(), remove: vi.fn() },
    plans: { items: [] },
    tagLibrary: [],
    models: ['Breakout'],
    riskCriteria: [],
    checklistCriteria: [],
    createTag: () => {},
    reloadAllFromStorage: () => {},
  },
  useAccounts: {
    accounts: [],
    preferredAccountId: '',
    getAccountName: (id) => id,
  },
  auth: { user: { id: 'user-1', email: 'trader@edge.test' } },
}));

vi.mock('../../context/DataContext', () => ({ useData: () => state.data }));
vi.mock('../../context/AccountContext', () => ({ useAccounts: () => state.useAccounts }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => state.auth }));
vi.mock('../../lib/supabase', () => {
  const ok = () => Promise.resolve({ data: [], error: null, count: 0 });
  const chain = () =>
    new Proxy(() => {}, {
      get(_t, prop) {
        if (prop === 'then') return undefined;
        return chain();
      },
      apply() {
        return ok();
      },
    });
  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null, user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } }, error: null }),
      },
      from: () => chain(),
      storage: { from: () => chain() },
    },
  };
});

const ACC = { id: 'acc-main', name: 'Main', currentBalance: 5000, startingBalance: 1000, isDefault: true };

beforeEach(() => {
  state.data.trades.items = [];
  state.data.trades.add.mockReset();
  state.data.trades.update.mockReset();
  state.data.trades.remove.mockReset();
  state.data.trades.add.mockImplementation((trade) => {
    state.data.trades.items = [...state.data.trades.items, trade];
  });
  state.useAccounts = {
    accounts: [ACC],
    preferredAccountId: 'acc-main',
    getAccountName: (id) => (id === ACC.id ? ACC.name : id),
  };
});

// HIGH-PRIORITY: the Log Trade flow. Fills the real TradeFormPanel inside
// TradingJournal, checks the calculator preview updates live, saves, and
// verifies the trade lands in the Journal with exactly the derived numbers.
describe('Log Trade UI flow — (Sprint 6.8)', () => {
  it('computes live, saves the trade, and shows it in the journal', () => {
    render(<TradingJournal />);

    // Open the Log Trade drawer.
    fireEvent.click(screen.getByRole('button', { name: /log trade/i }));
    expect(screen.getByLabelText('Entry Price')).toBeInTheDocument();

    // Raw inputs for a EURUSD Buy. Balance auto-comes from the account.
    fireEvent.change(screen.getByLabelText('Pair'), { target: { value: 'EURUSD' } });
    fireEvent.change(screen.getByLabelText('Entry Price'), { target: { value: '1.10000' } });
    fireEvent.change(screen.getByLabelText('Stop Loss'), { target: { value: '1.09900' } });
    fireEvent.change(screen.getByLabelText('Take Profit'), { target: { value: '1.10200' } });
    fireEvent.change(screen.getByLabelText('Risk %'), { target: { value: '1' } });

    // Live calculator: 1% of 5,000 → Risk +$50.00 appears the moment the
    // price/risk fields are filled (the Sprint 3 stale-numbers regression).
    expect(screen.getAllByText('+$50.00').length).toBeGreaterThan(0);
    // Auto lot from the account balance: $50 risk / ($10/pip × 10 pips).
    expect(screen.getAllByText('0.50').length).toBeGreaterThan(0);

    // Exit +10 pips → +$50 on a 0.50 lot, result Win.
    fireEvent.change(screen.getByLabelText('Exit Price'), { target: { value: '1.10100' } });

    fireEvent.click(screen.getByRole('button', { name: /^save trade$/i }));

    // What actually gets saved must be the shared engine's derived numbers.
    expect(state.data.trades.add).toHaveBeenCalledTimes(1);
    const saved = state.data.trades.add.mock.calls[0][0];
    expect(saved.accountId).toBe('acc-main');
    expect(Number(saved.netPnl)).toBeCloseTo(50, 2);
    expect(saved.result).toBe('Win');
    expect(Number(saved.rr)).toBeCloseTo(2, 2); // 20 pips reward / 10 pips risk
    expect(Number(saved.contracts)).toBeCloseTo(0.5, 2);

    // The Journal row for the saved trade renders.
    expect(screen.getByLabelText(/EURUSD trade /)).toBeInTheDocument();
    expect(screen.getByLabelText(/EURUSD trade /)).toHaveTextContent('+$50.00');
  });

  it('delete removes exactly the trade through the confirm dialog', () => {
    state.data.trades.items = [
      {
        id: 'saved-1',
        accountId: 'acc-main',
        date: '2024-01-02',
        entryTime: '09:00',
        instrument: 'EURUSD',
        direction: 'Buy',
        result: 'Win',
        netPnl: 50,
        rr: 2,
        contracts: 0.5,
        riskPercent: 1,
        model: 'Breakout',
        tags: [],
      },
    ];
    render(<TradingJournal />);
    expect(state.data.trades.items.length).toBe(1);

    fireEvent.click(screen.getByLabelText('Delete trade'));
    // ConfirmDialog portal appears; Cancel keeps, Delete removes.
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(state.data.trades.remove).toHaveBeenCalledTimes(1);
    expect(state.data.trades.remove.mock.calls[0][0]).toBe('saved-1');
  });
});