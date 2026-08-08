import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TradingJournal from '../../pages/TradingJournal';
import { SAVED_VIEWS_KEY } from '../../lib/savedViews';

// Shared mocked hooks so the Saved Views flow can be exercised against the
// REAL production TradingJournal (which consumes the shared filter engine).
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
    accounts: [{ id: 'acc-main', name: 'Main' }],
    preferredAccountId: 'acc-main',
    selectedAccountId: 'acc-main',
    getAccountName: (id) => (id === 'acc-main' ? 'Main' : id),
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

const TRADES = [
  { id: 't1', accountId: 'acc-main', date: '2024-01-02', entryTime: '09:00', instrument: 'GBPJPY', direction: 'Buy', session: 'London', timeframe: 'H1', result: 'Loss', netPnl: -80, rr: 1, riskPercent: 2, model: 'Breakout', tags: [] },
  { id: 't2', accountId: 'acc-main', date: '2024-01-03', entryTime: '10:00', instrument: 'GBPUSD', direction: 'Sell', session: 'London', timeframe: 'M15', result: 'Loss', netPnl: -60, rr: 0.5, riskPercent: 1, model: 'Pullback', tags: [] },
  { id: 't3', accountId: 'acc-main', date: '2024-01-04', entryTime: '08:30', instrument: 'EURUSD', direction: 'Buy', session: 'New York', timeframe: 'H1', result: 'Win', netPnl: 120, rr: 2, riskPercent: 1, model: 'Breakout', tags: [] },
];

beforeEach(() => {
  localStorage.clear();
  state.data.trades.items = [...TRADES];
  state.data.trades.add.mockReset();
  state.data.trades.update.mockReset();
  state.data.trades.remove.mockReset();
});

describe('Saved Views — production Journal flow — (Sprint 8.6)', () => {
  it('creates a view, loads it, renames, and deletes with persistence', () => {
    const { unmount } = render(<TradingJournal />);
    fireEvent.click(screen.getByRole('button', { name: /views/i }));

    // Create "London losses" from the currently empty selection.
    fireEvent.change(screen.getByLabelText('Name this view'), { target: { value: 'London losses' } });
    fireEvent.click(screen.getByRole('button', { name: /save view/i }));
    expect(screen.getByText('London losses')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY))).toHaveLength(1);

    // Close and reopen — on reload the view must persist.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    unmount();
    render(<TradingJournal />);
    fireEvent.click(screen.getByRole('button', { name: /views/i }));
    expect(screen.getByText('London losses')).toBeInTheDocument();

    // Rename.
    fireEvent.click(screen.getByRole('button', { name: /rename London losses/i }));
    const input = screen.getByLabelText('Rename view');
    fireEvent.change(input, { target: { value: 'London losses v2' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
    expect(screen.getByText('London losses v2')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY))[0].name).toBe('London losses v2');

    // Delete.
    fireEvent.click(screen.getByRole('button', { name: 'Delete London losses v2' }));
    expect(screen.queryByText('London losses v2')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY))).toHaveLength(0);
  });

  it('duplicate names are deduplicated safely', () => {
    render(<TradingJournal />);
    fireEvent.click(screen.getByRole('button', { name: /views/i }));
    fireEvent.change(screen.getByLabelText('Name this view'), { target: { value: 'Same Name' } });
    fireEvent.click(screen.getByRole('button', { name: /save view/i }));
    fireEvent.change(screen.getByLabelText('Name this view'), { target: { value: 'Same Name' } });
    fireEvent.click(screen.getByRole('button', { name: /save view/i }));
    expect(screen.getByText('Same Name')).toBeInTheDocument();
    expect(screen.getByText('Same Name (2)')).toBeInTheDocument();
  });

  it('rejects an empty view name without persisting', () => {
    render(<TradingJournal />);
    fireEvent.click(screen.getByRole('button', { name: /views/i }));
    fireEvent.click(screen.getByRole('button', { name: /save view/i }));
    expect(screen.getByText('Give this view a name.')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY)) || []).toHaveLength(0);
  });

  it('loads a view with a filter and applies it to the scoped trades', () => {
    // Seed a view through the module directly, BEFORE mounting (views are
    // initialized from storage in a useState initializer).
    const v = { ...{ id: 'v1', name: 'GBPJPY only', accountId: 'acc-main', filters: { pair: 'GBPJPY' }, sortKey: 'date', sortDir: 'desc', favoritesOnly: false, createdAt: 'x' } };
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify([v]));
    render(<TradingJournal />);

    fireEvent.click(screen.getByRole('button', { name: /views/i }));
    fireEvent.click(screen.getByRole('button', { name: /load GBPJPY only/i }));
    expect(screen.getAllByLabelText(/ trade /)).toHaveLength(1);
    expect(screen.getByLabelText(/GBPJPY trade /)).toBeInTheDocument();
  });

  it('account isolation — a view for another account is never listed or applied', () => {
    localStorage.setItem(
      SAVED_VIEWS_KEY,
      JSON.stringify([{ id: 'v-other', name: 'Other acc view', accountId: 'acc-other', filters: { result: 'Loss' }, sortKey: 'date', sortDir: 'desc', favoritesOnly: false }])
    );
    render(<TradingJournal />);
    fireEvent.click(screen.getByRole('button', { name: /views/i }));
    // The other account's view must not appear in the list for acc-main.
    expect(screen.queryByText('Other acc view')).not.toBeInTheDocument();
  });
});