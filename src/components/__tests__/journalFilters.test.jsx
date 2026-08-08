import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TradingJournal from '../../pages/TradingJournal';

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
    getAccountName: () => 'Main',
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

// A small mixed dataset exercising every Journal filter dimension.
const TRADES = [
  { id: 't1', accountId: 'acc-main', date: '2024-01-02', entryTime: '09:00', instrument: 'EURUSD', direction: 'Buy', session: 'London', timeframe: 'H1', result: 'Win', netPnl: 500, rr: 2, riskPercent: 1, model: 'Breakout', tags: ['news'], notes: 'London session' },
  { id: 't2', date: '2024-01-03', entryTime: '10:00', instrument: 'GBPUSD', direction: 'Sell', session: 'New York', timeframe: 'M15', result: 'Loss', netPnl: -60, rr: 1, riskPercent: 2, model: 'Pullback', tags: [] },
  { id: 't3', date: '2024-01-04', entryTime: '08:30', instrument: 'GBPUSD', direction: 'Buy', session: 'London', timeframe: 'H1', result: 'Win', netPnl: 120, rr: 1.5, riskPercent: 1, model: 'Breakout', tags: [] },
];

const row = (instrument) => new RegExp(`^${instrument} trade `);

beforeEach(() => {
  state.data.trades.items = [...TRADES];
  state.data.trades.add.mockReset();
  state.data.trades.update.mockReset();
  state.data.trades.remove.mockReset();
});

describe('Trading Journal search + filters — (Sprint 6.8)', () => {
  it('search narrows rows by text', () => {
    render(<TradingJournal />);
    expect(screen.getByLabelText(row('EURUSD'))).toBeInTheDocument();
    expect(screen.getAllByLabelText(/ trade /)).toHaveLength(3);

    fireEvent.change(screen.getByLabelText('Search trades'), { target: { value: 'EURUSD' } });
    expect(screen.getAllByLabelText(/ trade /)).toHaveLength(1);
    expect(screen.getByLabelText(row('EURUSD'))).toBeInTheDocument();
    expect(screen.queryByLabelText(row('GBPUSD'))).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(screen.getAllByLabelText(/ trade /)).toHaveLength(3);
  });

  it('Pair filter (via the Filters drawer) keeps only matching trades', () => {
    render(<TradingJournal />);
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));

    fireEvent.change(screen.getByLabelText('Pair'), { target: { value: 'GBPUSD' } });
    fireEvent.click(screen.getByRole('button', { name: /show 2 trades/i }));

    expect(screen.getAllByLabelText(/ trade /)).toHaveLength(2);
    expect(screen.queryByLabelText(row('EURUSD'))).not.toBeInTheDocument();
  });

  it('combining Pair + Direction filters is accurate and exact', () => {
    render(<TradingJournal />);
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));

    fireEvent.change(screen.getByLabelText('Pair'), { target: { value: 'GBPUSD' } });
    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'Sell' } });
    fireEvent.click(screen.getByRole('button', { name: /show 1 trade/i }));

    const rows = screen.getAllByLabelText(/ trade /);
    expect(rows).toHaveLength(1);
    expect(screen.getByLabelText(row('GBPUSD'))).toBeInTheDocument();
    // The surviving row is the GBPUSD Sell (Loss) — confirmed by its PnL.
    expect(screen.getByText('-$60.00')).toBeInTheDocument();
    expect(screen.queryByText('+$120.00')).not.toBeInTheDocument();
  });

  it('result (Win/Loss) filter applies correctly', () => {
    render(<TradingJournal />);
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));

    fireEvent.change(screen.getByLabelText('Win / Loss'), { target: { value: 'Loss' } });
    fireEvent.click(screen.getByRole('button', { name: /show 1 trade/i }));

    expect(screen.getAllByLabelText(/ trade /)).toHaveLength(1);
    expect(screen.getByText('-$60.00')).toBeInTheDocument();
  });

  it('date range filter excludes trades outside the window', () => {
    render(<TradingJournal />);
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2024-01-03' } });
    fireEvent.click(screen.getByRole('button', { name: /show 2 trades/i }));

    expect(screen.getAllByLabelText(/ trade /)).toHaveLength(2);
    expect(screen.queryByLabelText(row('EURUSD'))).not.toBeInTheDocument();
  });
});

describe('Multi-select OR + active filter summary — (Sprint 8.6)', () => {
  it('OR across a multi-select dimension filters like the shared engine', () => {
    render(<TradingJournal />);
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));

    // Add two pairs: GBPUSD OR EURUSD within the same dimension.
    fireEvent.change(screen.getByLabelText('Add Pairs'), { target: { value: 'GBPUSD' } });
    fireEvent.change(screen.getByLabelText('Add Pairs'), { target: { value: 'EURUSD' } });
    fireEvent.click(screen.getByRole('button', { name: /show 3 trades/i }));

    expect(screen.getAllByLabelText(/ trade /)).toHaveLength(3);
  });

  it('AND across a multi-select group and a single dimension', () => {
    render(<TradingJournal />);
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));

    fireEvent.change(screen.getByLabelText('Add Sessions'), { target: { value: 'London' } });
    fireEvent.change(screen.getByLabelText('Win / Loss'), { target: { value: 'Win' } });
    fireEvent.click(screen.getByRole('button', { name: /show 2 trades/i }));

    expect(screen.getAllByLabelText(/ trade /)).toHaveLength(2);
  });

  it('active-filter chips render, remove one, and Clear All resets', () => {
    render(<TradingJournal />);
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));
    fireEvent.change(screen.getByLabelText('Win / Loss'), { target: { value: 'Loss' } });
    fireEvent.click(screen.getByRole('button', { name: /show 1 trade/i }));

    // Summary chip appears with the result label.
    expect(screen.getByText('Result: Loss')).toBeInTheDocument();

    // Remove just that chip → everything returns.
    fireEvent.click(screen.getByRole('button', { name: /Remove filter Result: Loss/ }));
    expect(screen.getAllByLabelText(/ trade /)).toHaveLength(3);
  });

  it('Clear all filters restores every trade', () => {
    render(<TradingJournal />);
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));
    fireEvent.change(screen.getByLabelText('Session'), { target: { value: 'London' } });
    fireEvent.click(screen.getByRole('button', { name: /show 2 trades/i }));
    expect(screen.getAllByLabelText(/ trade /)).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /clear all filters/i }));
    expect(screen.getAllByLabelText(/ trade /)).toHaveLength(3);
  });
});