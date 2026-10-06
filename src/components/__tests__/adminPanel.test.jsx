import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminRoute from '../../routes/AdminRoute';
import AdminSidebar, { ADMIN_NAV_ITEMS } from '../admin/AdminSidebar';
import AdminHeader from '../admin/AdminHeader';
import AdminOverview from '../../pages/admin/AdminOverview';
import AdminShell from '../../layouts/AdminShell';
import * as authContext from '../../context/AuthContext';
import * as adminApi from '../../lib/adminApi';

vi.mock('../../context/AuthContext', async () => {
  const actual = await vi.importActual('../../context/AuthContext');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
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

describe('Admin Panel — Phase 2 Verification Suite', () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1 & 2: Admin Route Access Control
  // -------------------------------------------------------------------------
  describe('AdminRoute Guard', () => {
    it('shows loading screen while auth session or profile is resolving', () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        profileLoading: false,
        isAdmin: false,
      });

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <AdminRoute>
            <div>Protected Admin Content</div>
          </AdminRoute>
        </MemoryRouter>
      );

      expect(screen.getByText(/Verifying administrative access/i)).toBeInTheDocument();
      expect(screen.queryByText('Protected Admin Content')).not.toBeInTheDocument();
    });

    it('redirects unauthenticated visitor to /login', () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        profileLoading: false,
        isAdmin: false,
      });

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <div>Protected Admin Content</div>
                </AdminRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Login Page')).toBeInTheDocument();
      expect(screen.queryByText('Protected Admin Content')).not.toBeInTheDocument();
    });

    it('safely denies and redirects authenticated non-admin (role = user) away from /admin', () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        profileLoading: false,
        isAdmin: false,
        profile: { role: 'user', email: 'trader@edgejournal.com' },
      });

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <div>Protected Admin Content</div>
                </AdminRoute>
              }
            />
            <Route path="/" element={<div>Trader Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Trader Dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Protected Admin Content')).not.toBeInTheDocument();
    });

    it('renders admin content for authorized administrator (role = admin)', () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        profileLoading: false,
        isAdmin: true,
        profile: { role: 'admin', email: 'admin@edgejournal.com' },
      });

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <AdminRoute>
            <div>Protected Admin Content</div>
          </AdminRoute>
        </MemoryRouter>
      );

      expect(screen.getByText('Protected Admin Content')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 3: Admin Sidebar Navigation
  // -------------------------------------------------------------------------
  describe('AdminSidebar Navigation', () => {
    it('renders all 10 required navigation items with appropriate phase badges', () => {
      expect(ADMIN_NAV_ITEMS).toHaveLength(10);

      render(
        <MemoryRouter>
          <AdminSidebar active="overview" />
        </MemoryRouter>
      );

      // Verify all 10 items exist in the DOM
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Trading Accounts')).toBeInTheDocument();
      expect(screen.getByText('Trades')).toBeInTheDocument();
      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.getByText('Edge AI')).toBeInTheDocument();
      expect(screen.getByText('Reports')).toBeInTheDocument();
      expect(screen.getByText('Subscriptions')).toBeInTheDocument();
      expect(screen.getByText('Audit Logs')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();

      // Verify Phase badges — Phase 7 items (Subscriptions) are now functional (no badge)
      // Only 2 'Future' items remain (Edge AI, Settings)
      expect(screen.queryAllByText('Phase 4')).toHaveLength(0);
      expect(screen.getAllByText('Future')).toHaveLength(2);
    });

    it('marks Overview, Users, Accounts, Trades, Analytics, Reports, Subscriptions, and Audit Logs as functional and future items as disabled', () => {
      render(
        <MemoryRouter>
          <AdminSidebar active="overview" />
        </MemoryRouter>
      );

      const overviewBtn = screen.getByRole('button', { name: /overview/i });
      expect(overviewBtn).not.toBeDisabled();
      expect(overviewBtn).toHaveAttribute('aria-current', 'page');

      const usersBtn = screen.getByRole('button', { name: /users/i });
      expect(usersBtn).not.toBeDisabled();

      const accountsBtn = screen.getByRole('button', { name: /trading accounts/i });
      expect(accountsBtn).not.toBeDisabled();

      const tradesBtn = screen.getByRole('button', { name: /^trades$/i });
      expect(tradesBtn).not.toBeDisabled();

      const analyticsBtn = screen.getByRole('button', { name: /analytics/i });
      expect(analyticsBtn).not.toBeDisabled();

      const reportsBtn = screen.getByRole('button', { name: /^reports$/i });
      expect(reportsBtn).not.toBeDisabled();

      const subscriptionsBtn = screen.getByRole('button', { name: /subscriptions/i });
      expect(subscriptionsBtn).not.toBeDisabled();

      const auditBtn = screen.getByRole('button', { name: /audit logs/i });
      expect(auditBtn).not.toBeDisabled();
    });

    it('renders the EdgeJournal ADMIN brand badge and Trader App link', () => {
      render(
        <MemoryRouter>
          <AdminSidebar active="overview" />
        </MemoryRouter>
      );

      expect(screen.getByText('EdgeJournal')).toBeInTheDocument();
      expect(screen.getByText('ADMIN')).toBeInTheDocument();
      expect(screen.getByText('Trader App')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 4: Admin Header / Topbar
  // -------------------------------------------------------------------------
  describe('AdminHeader Topbar', () => {
    it('renders current admin identity, admin role badge, and handles logout', async () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        profile: { fullName: 'Chief Administrator', email: 'chief@edgejournal.com', role: 'admin' },
        user: { email: 'chief@edgejournal.com' },
        logout: mockLogout,
      });

      render(
        <MemoryRouter>
          <AdminHeader title="Platform Overview" subtitle="System operational health" />
        </MemoryRouter>
      );

      expect(screen.getByText('Platform Overview')).toBeInTheDocument();
      expect(screen.getByText('System operational health')).toBeInTheDocument();
      expect(screen.getByText('Chief Administrator')).toBeInTheDocument();
      expect(screen.getByText('chief@edgejournal.com')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();

      const logoutBtn = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutBtn);
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 5, 6, 7: Overview Dashboard (Telemetry, States, Activity)
  // -------------------------------------------------------------------------
  describe('AdminOverview Dashboard', () => {
    it('renders live user metrics, honest RLS states, and recent user registrations', async () => {
      vi.mocked(adminApi.fetchAdminMetrics).mockResolvedValue({
        users: { total: 42, admins: 2, standard: 40, status: 'live' },
        trades: { total: 130, status: 'live' },
        accounts: { total: 56, status: 'live' },
        system: {
          rlsStatus: 'Enforced (SECURITY DEFINER / RLS)',
          migrationVersion: '0020_admin_accounts_trades_rls',
          authProvider: 'Supabase Auth',
          status: 'operational',
        },
      });

      vi.mocked(adminApi.fetchRecentUsers).mockResolvedValue([
        {
          id: 'u-1',
          fullName: 'Alice Trader',
          email: 'alice@example.com',
          role: 'user',
          createdAt: '2026-10-06T10:00:00Z',
        },
        {
          id: 'u-2',
          fullName: 'Bob Admin',
          email: 'bob@example.com',
          role: 'admin',
          createdAt: '2026-10-06T11:00:00Z',
        },
      ]);

      render(
        <MemoryRouter>
          <AdminOverview />
        </MemoryRouter>
      );

      // Verify live user counts
      await waitFor(() => {
        expect(screen.getByText('42')).toBeInTheDocument();
      });
      expect(screen.getByText('Admins:')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Standard:')).toBeInTheDocument();
      expect(screen.getByText('40')).toBeInTheDocument();

      // Verify Phase 4 live trade and account counts
      expect(screen.getByText('130')).toBeInTheDocument();
      expect(screen.getByText('56')).toBeInTheDocument();

      // Verify operational system status
      expect(screen.getByText('Operational')).toBeInTheDocument();

      // Verify recent registrations table
      expect(screen.getByText('Alice Trader')).toBeInTheDocument();
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      expect(screen.getByText('Bob Admin')).toBeInTheDocument();
      expect(screen.getByText('bob@example.com')).toBeInTheDocument();

      // Verify Phase 1 security foundation card items
      expect(screen.getByText('profiles.role Column')).toBeInTheDocument();
      expect(screen.getByText('is_admin() Function')).toBeInTheDocument();
      expect(screen.getByText('protect_profile_role Trigger')).toBeInTheDocument();
      expect(screen.getByText('Admin RLS Policies')).toBeInTheDocument();
    });

    it('renders user-friendly error state with retry button on query failure', async () => {
      vi.mocked(adminApi.fetchAdminMetrics).mockRejectedValue(new Error('Connection timed out'));
      vi.mocked(adminApi.fetchRecentUsers).mockResolvedValue([]);

      render(
        <MemoryRouter>
          <AdminOverview />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Connection timed out/i)).toBeInTheDocument();
      });

      const retryBtn = screen.getByRole('button', { name: /retry query/i });
      expect(retryBtn).toBeInTheDocument();

      // Now mock success for retry
      vi.mocked(adminApi.fetchAdminMetrics).mockResolvedValue({
        users: { total: 10, admins: 1, standard: 9, status: 'live' },
        trades: { total: 50, status: 'live' },
        accounts: { total: 12, status: 'live' },
        system: { status: 'operational' },
      });

      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByText('10')).toBeInTheDocument();
      });
    });

    it('renders clean empty state when no recent users exist', async () => {
      vi.mocked(adminApi.fetchAdminMetrics).mockResolvedValue({
        users: { total: 0, admins: 0, standard: 0, status: 'live' },
        trades: { total: 0, status: 'live' },
        accounts: { total: 0, status: 'live' },
        system: { status: 'operational' },
      });
      vi.mocked(adminApi.fetchRecentUsers).mockResolvedValue([]);

      render(
        <MemoryRouter>
          <AdminOverview />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/No user profiles found/i)).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // 8: Full Admin Shell Integration
  // -------------------------------------------------------------------------
  describe('AdminShell Layout Integration', () => {
    it('mounts sidebar, topbar, skip-link, and overview content together', async () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        profile: { fullName: 'Lead Admin', email: 'lead@edgejournal.com', role: 'admin' },
        user: { email: 'lead@edgejournal.com' },
        logout: mockLogout,
      });

      vi.mocked(adminApi.fetchAdminMetrics).mockResolvedValue({
        users: { total: 15, admins: 1, standard: 14, status: 'live' },
        trades: { total: 42, status: 'live' },
        accounts: { total: 8, status: 'live' },
        system: { status: 'operational' },
      });
      vi.mocked(adminApi.fetchRecentUsers).mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/admin/*" element={<AdminShell />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Skip to admin content')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /overview/i, level: 1 })).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('Platform Telemetry')).toBeInTheDocument();
      });
    });
  });
});
