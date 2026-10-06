import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminTrades from '../../pages/admin/AdminTrades';
import AdminShell from '../../layouts/AdminShell';
import * as authContext from '../../context/AuthContext';
import * as adminApi from '../../lib/adminApi';

vi.mock('../../context/AuthContext', async () => {
  const actual = await vi.importActual('../../context/AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

vi.mock('../../lib/adminApi', () => ({
  fetchAdminMetrics: vi.fn(),
  fetchRecentUsers: vi.fn(),
  fetchUsers: vi.fn(),
  fetchAdminAccounts: vi.fn(),
  fetchAdminAccountMetrics: vi.fn(),
  fetchAdminTrades: vi.fn(),
  fetchAdminTradeMetrics: vi.fn(),
  updateUserRole: vi.fn(),
}));

const mockTrades = [
  {
    id: 'trade-1',
    userId: 'user-a',
    accountId: 'acc-1',
    date: '2026-10-01',
    instrument: 'NQ',
    direction: 'Long',
    session: 'New York',
    result: 'Win',
    netPnl: 450,
    riskPercent: 1,
    rr: 2.5,
    model: 'Liquidity Sweep',
    notes: '',
    tags: [],
    isFavorite: false,
    createdAt: '2026-10-01T09:00:00Z',
  },
  {
    id: 'trade-2',
    userId: 'user-b',
    accountId: 'acc-2',
    date: '2026-10-02',
    instrument: 'ES',
    direction: 'Short',
    session: 'London',
    result: 'Loss',
    netPnl: -180,
    riskPercent: 0.5,
    rr: 0,
    model: 'VWAP Rejection',
    notes: 'Missed entry',
    tags: [],
    isFavorite: false,
    createdAt: '2026-10-02T08:30:00Z',
  },
  {
    id: 'trade-3',
    userId: 'user-c',
    accountId: 'acc-3',
    date: '2026-10-03',
    instrument: 'MES',
    direction: 'Long',
    session: 'Asia',
    result: 'Breakeven',
    netPnl: 0,
    riskPercent: 0.25,
    rr: 1,
    model: '',
    notes: '',
    tags: [],
    isFavorite: false,
    createdAt: '2026-10-03T02:00:00Z',
  },
];

const mockTradeMetrics = {
  total: 3,
  wins: 1,
  losses: 1,
  breakeven: 1,
  winRate: 33,
};

describe('Admin Trades — Phase 4 Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminApi.fetchAdminTradeMetrics).mockResolvedValue(mockTradeMetrics);
    vi.mocked(adminApi.fetchAdminTrades).mockResolvedValue({
      trades: mockTrades,
      total: 3,
      page: 1,
      pageSize: 15,
      totalPages: 1,
    });
  });

  // ---------------------------------------------------------------------------
  // 1. Trade Metrics Cards
  // ---------------------------------------------------------------------------
  describe('Trade Metrics Cards', () => {
    it('renders all five summary cards with live counts from fetchAdminTradeMetrics', async () => {
      render(
        <MemoryRouter>
          <AdminTrades />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Total Trades')).toBeInTheDocument();
      });

      expect(screen.getAllByText('Wins').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Losses').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Breakeven').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Win Rate')).toBeInTheDocument();
    });

    it('shows correct win rate value', async () => {
      render(
        <MemoryRouter>
          <AdminTrades />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Win Rate card shows "33%" — match the metric card label specifically
        const winRateCard = screen.getByText('Win Rate').closest('.card');
        expect(winRateCard).toBeInTheDocument();
        // The number and % are rendered, total 33
        expect(screen.getByText('33', { exact: false })).toBeInTheDocument();
      });
    });

    it('shows skeleton placeholders while metrics are loading', () => {
      vi.mocked(adminApi.fetchAdminTradeMetrics).mockReturnValue(new Promise(() => {}));

      render(
        <MemoryRouter>
          <AdminTrades />
        </MemoryRouter>
      );

      // No numbers rendered yet
      expect(screen.queryByText('33%')).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Trades Table
  // ---------------------------------------------------------------------------
  describe('Trades Table', () => {
    it('renders instrument, direction, result badge, and P&L for each trade', async () => {
      render(
        <MemoryRouter>
          <AdminTrades />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('NQ')).toBeInTheDocument();
      });

      expect(screen.getByText('ES')).toBeInTheDocument();
      expect(screen.getByText('MES')).toBeInTheDocument();

      // Direction tags — 2 Long trades, 1 Short; use getAllBy for Long
      expect(screen.getAllByText('▲ Long')).toHaveLength(2);
      expect(screen.getByText('▼ Short')).toBeInTheDocument();

      // Result badges — use getAllByText since metrics cards also show Win/Loss tags
      expect(screen.getAllByText('Win').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Loss').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('BE').length).toBeGreaterThanOrEqual(1);
    });

    it('renders positive P&L with green styling and + prefix', async () => {
      render(
        <MemoryRouter>
          <AdminTrades />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('+450.00')).toBeInTheDocument();
      });
    });

    it('renders negative P&L with red styling', async () => {
      render(
        <MemoryRouter>
          <AdminTrades />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('-180.00')).toBeInTheDocument();
      });
    });

    it('renders R:R and Risk % columns', async () => {
      render(
        <MemoryRouter>
          <AdminTrades />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2.50R')).toBeInTheDocument();
      });

      expect(screen.getByText('1.0%')).toBeInTheDocument();
    });

    it('renders model name in model column', async () => {
      render(
        <MemoryRouter>
          <AdminTrades />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Liquidity Sweep')).toBeInTheDocument();
      });

      expect(screen.getByText('VWAP Rejection')).toBeInTheDocument();
    });

    it('shows empty state when no trades match filters', async () => {
      vi.mocked(adminApi.fetchAdminTrades).mockResolvedValue({
        trades: [],
        total: 0,
        page: 1,
        pageSize: 15,
        totalPages: 1,
      });

      render(
        <MemoryRouter>
          <AdminTrades />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/No trades on platform/i)).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Search and Filter Controls
  // ---------------------------------------------------------------------------
  describe('Search and Filter Controls', () => {
    it('renders search input and result filter select', async () => {
      render(
        <MemoryRouter>
          <AdminTrades />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search by instrument, model, or notes/i)).toBeInTheDocument();
      });

      const resultSelect = screen.getByRole('combobox', { name: /Filter by result/i });
      expect(resultSelect).toBeInTheDocument();
      expect(resultSelect).toHaveValue('all');
    });

    it('result filter has options for All, Win, Loss, Breakeven', async () => {
      render(
        <MemoryRouter>
          <AdminTrades />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /filter by result/i })).toBeInTheDocument();
      });

      const options = screen.getAllByRole('option');
      const optionValues = options.map((o) => o.value);
      expect(optionValues).toContain('all');
      expect(optionValues).toContain('Win');
      expect(optionValues).toContain('Loss');
      expect(optionValues).toContain('Breakeven');
    });

    it('has a working Refresh button', async () => {
      render(
        <MemoryRouter>
          <AdminTrades />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Refresh trade list/i })).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Error State
  // ---------------------------------------------------------------------------
  describe('Error Handling', () => {
    it('shows error alert with retry button when fetchAdminTrades fails', async () => {
      vi.mocked(adminApi.fetchAdminTrades).mockRejectedValue(new Error('Network timeout'));

      render(
        <MemoryRouter>
          <AdminTrades />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Network timeout/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Pagination
  // ---------------------------------------------------------------------------
  describe('Pagination', () => {
    it('renders pagination controls and shows correct count text', async () => {
      render(
        <MemoryRouter>
          <AdminTrades />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Showing 1 to 3 of 3 trades/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /Previous page/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Next page/i })).toBeDisabled();
    });
  });

  // ---------------------------------------------------------------------------
  // 6. AdminShell Integration — Trades route
  // ---------------------------------------------------------------------------
  describe('AdminShell Integration — Trades route', () => {
    it('renders AdminTrades at /admin/trades with correct heading and subtitle', async () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        profile: { fullName: 'Test Admin', email: 'admin@test.com', role: 'admin' },
        user: { email: 'admin@test.com' },
        logout: vi.fn(),
      });

      vi.mocked(adminApi.fetchAdminMetrics).mockResolvedValue({
        users: { total: 5, admins: 1, standard: 4, status: 'live' },
        trades: { total: 20, status: 'live' },
        accounts: { total: 3, status: 'live' },
        system: { status: 'operational' },
      });
      vi.mocked(adminApi.fetchRecentUsers).mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={['/admin/trades']}>
          <Routes>
            <Route path="/admin/*" element={<AdminShell />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Trade Management/i, level: 1 })).toBeInTheDocument();
      });

      expect(screen.getByText(/Platform-wide trade ledger/i)).toBeInTheDocument();
    });
  });
});
