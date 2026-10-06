import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminAccounts from '../../pages/admin/AdminAccounts';
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

const mockAccounts = [
  {
    id: 'acc-1',
    userId: 'user-a',
    name: 'Alpha Trading',
    broker: 'IBKR',
    platform: 'TWS',
    accountType: 'live',
    status: 'active',
    startingBalance: 10000,
    currentBalance: 12500,
    currency: 'USD',
    isDefault: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'acc-2',
    userId: 'user-b',
    name: 'Beta Sim Account',
    broker: 'Tradovate',
    platform: 'NinjaTrader',
    accountType: 'sim',
    status: 'inactive',
    startingBalance: 5000,
    currentBalance: 4200,
    currency: 'USD',
    isDefault: false,
    createdAt: '2026-08-15T00:00:00Z',
    updatedAt: '2026-09-10T00:00:00Z',
  },
  {
    id: 'acc-3',
    userId: 'user-c',
    name: 'Gamma Archived',
    broker: 'TD Ameritrade',
    platform: '',
    accountType: 'live',
    status: 'archived',
    startingBalance: 20000,
    currentBalance: 20000,
    currency: 'EUR',
    isDefault: false,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-15T00:00:00Z',
  },
];

const mockMetrics = {
  total: 3,
  active: 1,
  inactive: 1,
  archived: 1,
};

describe('Admin Accounts — Phase 4 Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminApi.fetchAdminAccountMetrics).mockResolvedValue(mockMetrics);
    vi.mocked(adminApi.fetchAdminAccounts).mockResolvedValue({
      accounts: mockAccounts,
      total: 3,
      page: 1,
      pageSize: 15,
      totalPages: 1,
    });
  });

  // ---------------------------------------------------------------------------
  // 1. Summary Metrics Cards
  // ---------------------------------------------------------------------------
  describe('Account Metrics Cards', () => {
    it('renders all four summary cards with live counts from fetchAdminAccountMetrics', async () => {
      render(
        <MemoryRouter>
          <AdminAccounts />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument(); // Total
      });

      expect(screen.getByText('Total Accounts')).toBeInTheDocument();
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Inactive').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Archived').length).toBeGreaterThanOrEqual(1);
    });

    it('shows skeleton placeholders while metrics are loading', () => {
      // Keep the promise pending indefinitely
      vi.mocked(adminApi.fetchAdminAccountMetrics).mockReturnValue(new Promise(() => {}));

      render(
        <MemoryRouter>
          <AdminAccounts />
        </MemoryRouter>
      );

      // Skeletons exist (no numbers rendered yet)
      expect(screen.queryByText('3')).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Accounts Table
  // ---------------------------------------------------------------------------
  describe('Accounts Table', () => {
    it('renders account name, broker, status, and balance for each account row', async () => {
      render(
        <MemoryRouter>
          <AdminAccounts />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Alpha Trading')).toBeInTheDocument();
      });

      expect(screen.getByText('Beta Sim Account')).toBeInTheDocument();
      expect(screen.getByText('Gamma Archived')).toBeInTheDocument();

      expect(screen.getByText('IBKR')).toBeInTheDocument();
      expect(screen.getByText('Tradovate')).toBeInTheDocument();
      expect(screen.getByText('TD Ameritrade')).toBeInTheDocument();

      // Status badges
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Inactive').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Archived').length).toBeGreaterThanOrEqual(1);
    });

    it('renders positive P&L for accounts with current_balance > starting_balance', async () => {
      render(
        <MemoryRouter>
          <AdminAccounts />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Alpha: +$2,500 P&L
        expect(screen.getByText('+$2,500.00')).toBeInTheDocument();
      });
    });

    it('renders negative P&L for accounts with current_balance < starting_balance', async () => {
      render(
        <MemoryRouter>
          <AdminAccounts />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Beta: -$800 P&L
        expect(screen.getByText('-$800.00')).toBeInTheDocument();
      });
    });

    it('shows empty state when no accounts match filters', async () => {
      vi.mocked(adminApi.fetchAdminAccounts).mockResolvedValue({
        accounts: [],
        total: 0,
        page: 1,
        pageSize: 15,
        totalPages: 1,
      });

      render(
        <MemoryRouter>
          <AdminAccounts />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/No trading accounts on platform/i)).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Search and Filter Controls
  // ---------------------------------------------------------------------------
  describe('Search and Filter Controls', () => {
    it('renders search input and status filter select', async () => {
      render(
        <MemoryRouter>
          <AdminAccounts />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search by name, broker, or platform/i)).toBeInTheDocument();
      });

      const statusSelect = screen.getByRole('combobox', { name: /Filter by status/i });
      expect(statusSelect).toBeInTheDocument();
      expect(statusSelect).toHaveValue('all');
    });

    it('has status options for All Statuses, Active, Inactive, Archived', async () => {
      render(
        <MemoryRouter>
          <AdminAccounts />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /filter by status/i })).toBeInTheDocument();
      });

      const options = screen.getAllByRole('option');
      const optionValues = options.map((o) => o.value);
      expect(optionValues).toContain('all');
      expect(optionValues).toContain('active');
      expect(optionValues).toContain('inactive');
      expect(optionValues).toContain('archived');
    });

    it('has a working Refresh button', async () => {
      render(
        <MemoryRouter>
          <AdminAccounts />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Refresh account list/i })).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Error State
  // ---------------------------------------------------------------------------
  describe('Error Handling', () => {
    it('shows error alert with retry button when fetchAdminAccounts fails', async () => {
      vi.mocked(adminApi.fetchAdminAccounts).mockRejectedValue(new Error('Database connection failed'));

      render(
        <MemoryRouter>
          <AdminAccounts />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Database connection failed/i)).toBeInTheDocument();
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
          <AdminAccounts />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Showing 1 to 3 of 3 accounts/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /Previous page/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Next page/i })).toBeDisabled();
    });
  });

  // ---------------------------------------------------------------------------
  // 6. AdminShell Integration
  // ---------------------------------------------------------------------------
  describe('AdminShell Integration — Accounts route', () => {
    it('renders AdminAccounts at /admin/accounts with correct heading and subtitle', async () => {
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
        <MemoryRouter initialEntries={['/admin/accounts']}>
          <Routes>
            <Route path="/admin/*" element={<AdminShell />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Trading Accounts/i, level: 1 })).toBeInTheDocument();
      });

      expect(screen.getByText(/Platform-wide view of all trader accounts/i)).toBeInTheDocument();
    });
  });
});
