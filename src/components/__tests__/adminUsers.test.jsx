import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminRoute from '../../routes/AdminRoute';
import AdminShell from '../../layouts/AdminShell';
import AdminUsers from '../../pages/admin/AdminUsers';
import AdminOverview from '../../pages/admin/AdminOverview';
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
  fetchUsers: vi.fn(),
  fetchAdminMetrics: vi.fn(),
  fetchRecentUsers: vi.fn(),
  updateUserRole: vi.fn(),
  fetchAdminAccounts: vi.fn(),
  fetchAdminAccountMetrics: vi.fn(),
  fetchAdminTrades: vi.fn(),
  fetchAdminTradeMetrics: vi.fn(),
}));

describe('Admin User Management — Phase 3 Verification Suite', () => {
  const mockLogout = vi.fn();
  const currentAdmin = {
    id: 'admin-uuid-1',
    fullName: 'Master Administrator',
    email: 'admin@edgejournal.com',
    role: 'admin',
  };

  const sampleUsers = [
    {
      id: 'user-uuid-1',
      fullName: 'Sarah Trader',
      email: 'sarah@trading.com',
      username: 'strader',
      bio: 'Forex swing trader',
      timezone: 'America/New_York',
      role: 'user',
      createdAt: '2026-09-01T12:00:00Z',
      updatedAt: '2026-09-10T12:00:00Z',
    },
    {
      id: 'admin-uuid-1',
      fullName: 'Master Administrator',
      email: 'admin@edgejournal.com',
      username: 'master',
      bio: 'Platform operator',
      timezone: 'UTC',
      role: 'admin',
      createdAt: '2026-08-01T10:00:00Z',
      updatedAt: '2026-08-01T10:00:00Z',
    },
    {
      id: 'user-uuid-2',
      fullName: 'Bob Scalper',
      email: 'bob@scalp.com',
      username: 'bobscalps',
      bio: '',
      timezone: 'Europe/London',
      role: 'user',
      createdAt: '2026-09-15T08:00:00Z',
      updatedAt: '2026-09-15T08:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authContext.useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      profileLoading: false,
      isAdmin: true,
      user: { id: currentAdmin.id, email: currentAdmin.email },
      profile: currentAdmin,
      logout: mockLogout,
    });

    vi.mocked(adminApi.fetchAdminMetrics).mockResolvedValue({
      users: { total: 3, admins: 1, standard: 2, status: 'live' },
      trades: { total: null, status: 'deferred_rls' },
      accounts: { total: null, status: 'deferred_rls' },
      system: { status: 'operational' },
    });

    vi.mocked(adminApi.fetchUsers).mockResolvedValue({
      users: sampleUsers,
      total: 3,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });
  });

  // 1. Admin can access /admin/users
  it('allows authorized administrator to access /admin/users', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route
            path="/admin/*"
            element={
              <AdminRoute>
                <AdminShell />
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /User Management/i })).toBeInTheDocument();
    });
  });

  // 2. Unauthenticated user is redirected
  it('redirects unauthenticated user to /login when visiting /admin/users', () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      profileLoading: false,
      isAdmin: false,
    });

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route
            path="/admin/*"
            element={
              <AdminRoute>
                <AdminShell />
              </AdminRoute>
            }
          />
          <Route path="/login" element={<div>Sign In Screen</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Sign In Screen')).toBeInTheDocument();
    expect(screen.queryByText(/User Management/i)).not.toBeInTheDocument();
  });

  // 3. Normal user cannot access User Management
  it('safely denies and redirects normal user (role = user) away from /admin/users', () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      profileLoading: false,
      isAdmin: false,
      profile: { role: 'user', email: 'regular@edgejournal.com' },
    });

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route
            path="/admin/*"
            element={
              <AdminRoute>
                <AdminShell />
              </AdminRoute>
            }
          />
          <Route path="/" element={<div>Trader Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Trader Dashboard')).toBeInTheDocument();
    expect(screen.queryByText(/User Management/i)).not.toBeInTheDocument();
  });

  // 4. User list renders
  it('renders user list with names, emails, roles, and action buttons', async () => {
    render(
      <MemoryRouter>
        <AdminUsers />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Sarah Trader')).toBeInTheDocument();
    });
    expect(screen.getByText('sarah@trading.com')).toBeInTheDocument();
    expect(screen.getByText('Master Administrator')).toBeInTheDocument();
    expect(screen.getByText('Bob Scalper')).toBeInTheDocument();

    // Verify summary counts
    expect(screen.getByText('Total Registered Users')).toBeInTheDocument();
  });

  // 5. Loading state renders
  it('renders loading skeleton while query is in-flight', () => {
    vi.mocked(adminApi.fetchUsers).mockReturnValue(new Promise(() => {})); // Never resolves

    render(
      <MemoryRouter>
        <AdminUsers />
      </MemoryRouter>
    );

    expect(screen.queryByText('Sarah Trader')).not.toBeInTheDocument();
  });

  // 6. Empty state renders
  it('renders empty state when no users exist', async () => {
    vi.mocked(adminApi.fetchUsers).mockResolvedValue({
      users: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });

    render(
      <MemoryRouter>
        <AdminUsers />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No users available')).toBeInTheDocument();
    });
  });

  // 7. Search works
  it('triggers debounced server search on user query input', async () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter>
        <AdminUsers />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(/Search by name/i);
    fireEvent.change(searchInput, { target: { value: 'scalper' } });

    // Advance debounce timer by 350ms
    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(adminApi.fetchUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'scalper',
      })
    );

    vi.useRealTimers();
  });

  // 8. Role filter works
  it('filters by role when dropdown selection changes', async () => {
    render(
      <MemoryRouter>
        <AdminUsers />
      </MemoryRouter>
    );

    const roleSelect = screen.getByLabelText(/Filter by role/i);
    fireEvent.change(roleSelect, { target: { value: 'admin' } });

    await waitFor(() => {
      expect(adminApi.fetchUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'admin',
          page: 1,
        })
      );
    });
  });

  // 9. Pagination works
  it('navigates to next page when pagination next button is clicked', async () => {
    vi.mocked(adminApi.fetchUsers).mockResolvedValue({
      users: sampleUsers,
      total: 25,
      page: 1,
      pageSize: 10,
      totalPages: 3,
    });

    render(
      <MemoryRouter>
        <AdminUsers />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole('button', { name: /Next page/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(adminApi.fetchUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
        })
      );
    });
  });

  // 10. User details view works
  it('opens details drawer displaying complete profile metadata when Details is clicked', async () => {
    render(
      <MemoryRouter>
        <AdminUsers />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Sarah Trader')).toBeInTheDocument();
    });

    const detailsBtn = screen.getByRole('button', { name: /View details for Sarah Trader/i });
    fireEvent.click(detailsBtn);

    expect(screen.getByText('User Profile Details')).toBeInTheDocument();
    expect(screen.getAllByText('@strader')[0]).toBeInTheDocument();
    expect(screen.getByText('Forex swing trader')).toBeInTheDocument();
    expect(screen.getByText('America/New_York')).toBeInTheDocument();
    expect(screen.getByText('user-uuid-1')).toBeInTheDocument();
  });

  // 11. Promote user → admin flow works
  it('promotes user to administrator via confirmation modal', async () => {
    vi.mocked(adminApi.updateUserRole).mockResolvedValue({
      ...sampleUsers[0],
      role: 'admin',
    });

    render(
      <MemoryRouter>
        <AdminUsers />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Sarah Trader')).toBeInTheDocument();
    });

    const promoteBtn = screen.getByRole('button', { name: /Promote Sarah Trader/i });
    fireEvent.click(promoteBtn);

    // Confirmation dialog appears
    expect(screen.getByText(/Promote to Administrator\?/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirm Promotion/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(adminApi.updateUserRole).toHaveBeenCalledWith('user-uuid-1', 'admin', currentAdmin.id);
    });
  });

  // 12. Demote admin → user flow works
  it('demotes admin to standard user via confirmation modal', async () => {
    const anotherAdmin = {
      id: 'admin-uuid-2',
      fullName: 'Other Admin',
      email: 'other@admin.com',
      role: 'admin',
      createdAt: '2026-09-01T12:00:00Z',
    };

    vi.mocked(adminApi.fetchUsers).mockResolvedValue({
      users: [anotherAdmin],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });

    vi.mocked(adminApi.updateUserRole).mockResolvedValue({
      ...anotherAdmin,
      role: 'user',
    });

    render(
      <MemoryRouter>
        <AdminUsers />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Other Admin')).toBeInTheDocument();
    });

    const demoteBtn = screen.getByRole('button', { name: /Demote Other Admin/i });
    fireEvent.click(demoteBtn);

    expect(screen.getByText(/Demote to Standard User\?/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirm Demotion/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(adminApi.updateUserRole).toHaveBeenCalledWith('admin-uuid-2', 'user', currentAdmin.id);
    });
  });

  // 13. Confirmation dialog appears before role change
  it('shows old and new role comparison inside confirmation modal before applying change', async () => {
    render(
      <MemoryRouter>
        <AdminUsers />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Sarah Trader')).toBeInTheDocument();
    });

    const promoteBtn = screen.getByRole('button', { name: /Promote Sarah Trader/i });
    fireEvent.click(promoteBtn);

    expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument();
    expect(screen.getByText(/Role transition:/i)).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  // 14. Self-demotion is prevented/handled safely
  it('prevents currently logged-in administrator from demoting themselves', async () => {
    render(
      <MemoryRouter>
        <AdminUsers />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Master Administrator')).toBeInTheDocument();
    });

    // Current admin row should show "Current Admin" label instead of demote action
    expect(screen.getByText('Current Admin')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Demote Master Administrator/i })).not.toBeInTheDocument();
  });

  // 15. Database role-update failure is handled
  it('handles database role-update failure cleanly with error toast', async () => {
    vi.mocked(adminApi.updateUserRole).mockRejectedValue(
      new Error('Permission denied by database trigger')
    );

    render(
      <MemoryRouter>
        <AdminUsers />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Sarah Trader')).toBeInTheDocument();
    });

    const promoteBtn = screen.getByRole('button', { name: /Promote Sarah Trader/i });
    fireEvent.click(promoteBtn);

    const confirmBtn = screen.getByRole('button', { name: /Confirm Promotion/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Permission denied by database trigger/i)).toBeInTheDocument();
    });
  });

  // 16. Existing Admin Overview remains functional
  it('preserves Admin Overview functionality and telemetry rendering', async () => {
    vi.mocked(adminApi.fetchRecentUsers).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminOverview />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Platform Telemetry')).toBeInTheDocument();
    });
    expect(screen.getByText('Phase 1 Security Foundation')).toBeInTheDocument();
  });
});
