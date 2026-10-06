import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminAuditLogs from '../admin/AdminAuditLogs';
import AdminShell from '../../layouts/AdminShell';
import AdminRoute from '../../routes/AdminRoute';
import * as authContext from '../../context/AuthContext';
import * as adminApi from '../../lib/adminApi';
import { supabase } from '../../lib/supabase';

vi.mock('../../context/AuthContext', async () => {
  const actual = await vi.importActual('../../context/AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

vi.mock('../../lib/adminApi', async () => {
  const actual = await vi.importActual('../../lib/adminApi');
  return {
    ...actual,
    fetchAdminAuditLogs: vi.fn(),
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

const mockAuditLogs = [
  {
    id: 'log-1',
    actorUserId: 'admin-1',
    actor: {
      id: 'admin-1',
      fullName: 'Chief Admin',
      email: 'chief@edgejournal.com',
      role: 'admin',
    },
    action: 'export_trades_csv',
    resourceType: 'trades',
    resourceId: 'platform_filtered',
    metadata: { rowCount: 42, dateRange: '30d' },
    createdAt: '2026-10-07T01:00:00Z',
  },
  {
    id: 'log-2',
    actorUserId: 'admin-1',
    actor: {
      id: 'admin-1',
      fullName: 'Chief Admin',
      email: 'chief@edgejournal.com',
      role: 'admin',
    },
    action: 'update_user_role',
    resourceType: 'profiles',
    resourceId: 'trader-9',
    metadata: { oldRole: 'user', newRole: 'admin' },
    createdAt: '2026-10-07T00:30:00Z',
  },
];

describe('Phase 6 — Audit Log Architecture Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authContext.useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: true,
      isLoading: false,
      profileLoading: false,
      profile: { id: 'admin-1', role: 'admin', email: 'chief@edgejournal.com' },
    });
    vi.mocked(adminApi.fetchAdminAuditLogs).mockResolvedValue({
      logs: mockAuditLogs,
      total: 2,
      page: 1,
      pageSize: 15,
      totalPages: 1,
    });
  });

  // 1. Access Control: Admin allowed
  it('1. allows authenticated admin to access /admin/audit-logs', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/audit-logs']}>
        <AdminShell />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('admin-audit-logs-page')).toBeInTheDocument();
    });
    expect(screen.getByText('Administrative Audit Ledger')).toBeInTheDocument();
  });

  // 2. Access Control: Normal user denied
  it('2. safely denies access to authenticated normal user (role = user)', () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      isLoading: false,
      profileLoading: false,
      profile: { id: 'trader-1', role: 'user', email: 'trader@edgejournal.com' },
    });

    render(
      <MemoryRouter initialEntries={['/admin/audit-logs']}>
        <Routes>
          <Route
            path="/admin/*"
            element={
              <AdminRoute>
                <AdminShell />
              </AdminRoute>
            }
          />
          <Route path="/" element={<div>Trader Dashboard Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('admin-audit-logs-page')).not.toBeInTheDocument();
    expect(screen.getByText('Trader Dashboard Home')).toBeInTheDocument();
  });

  // 3. Access Control: Unauthenticated visitor redirected to /login
  it('3. redirects unauthenticated user away from /admin/audit-logs to /login', () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      isAuthenticated: false,
      isAdmin: false,
      isLoading: false,
      profileLoading: false,
      profile: null,
    });

    render(
      <MemoryRouter initialEntries={['/admin/audit-logs']}>
        <Routes>
          <Route
            path="/admin/*"
            element={
              <AdminRoute>
                <AdminShell />
              </AdminRoute>
            }
          />
          <Route path="/login" element={<div>Auth Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('admin-audit-logs-page')).not.toBeInTheDocument();
    expect(screen.getByText('Auth Login Page')).toBeInTheDocument();
  });

  // 4. Audit list rendering
  it('4. renders audit events table with actors, actions, and timestamps', async () => {
    render(
      <MemoryRouter>
        <AdminAuditLogs />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('export_trades_csv')).toBeInTheDocument();
    });

    expect(screen.getAllByText('update_user_role').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Chief Admin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('chief@edgejournal.com').length).toBeGreaterThan(0);
    expect(screen.getByText('platform_filtered')).toBeInTheDocument();
    expect(screen.getByText('trader-9')).toBeInTheDocument();
  });

  // 5. Metadata expansion
  it('5. toggles metadata details when expand button is clicked', async () => {
    render(
      <MemoryRouter>
        <AdminAuditLogs />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('export_trades_csv')).toBeInTheDocument();
    });

    const expandButtons = screen.getAllByLabelText('Expand metadata');
    expect(expandButtons.length).toBeGreaterThan(0);

    fireEvent.click(expandButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/"rowCount": 42/i)).toBeInTheDocument();
    });
  });

  // 6. Honest empty audit state (no fake history)
  it('6. displays honest empty state when zero audit events exist', async () => {
    vi.mocked(adminApi.fetchAdminAuditLogs).mockResolvedValueOnce({
      logs: [],
      total: 0,
      page: 1,
      pageSize: 15,
      totalPages: 1,
    });

    render(
      <MemoryRouter>
        <AdminAuditLogs />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('audit-empty-state')).toBeInTheDocument();
    });

    expect(screen.getByText('No audit events recorded yet.')).toBeInTheDocument();
    expect(
      screen.getByText(/historical actions that took place prior to the audit infrastructure are not fabricated/i)
    ).toBeInTheDocument();
  });

  // 7. Filtering by Action
  it('7. updates audit query when action filter changes', async () => {
    render(
      <MemoryRouter>
        <AdminAuditLogs />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Filter by action')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Filter by action'), {
      target: { value: 'export_trades_csv' },
    });

    await waitFor(() => {
      expect(adminApi.fetchAdminAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'export_trades_csv' })
      );
    });
  });

  // 8. Filtering by Resource Type
  it('8. updates audit query when resource type filter changes', async () => {
    render(
      <MemoryRouter>
        <AdminAuditLogs />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Filter by resource type')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Filter by resource type'), {
      target: { value: 'trades' },
    });

    await waitFor(() => {
      expect(adminApi.fetchAdminAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ resourceType: 'trades' })
      );
    });
  });

  // 9. Filtering by Search input
  it('9. updates audit query when search input text changes', async () => {
    render(
      <MemoryRouter>
        <AdminAuditLogs />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Search audit logs')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Search audit logs'), {
      target: { value: 'export' },
    });

    await waitFor(() => {
      expect(adminApi.fetchAdminAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'export' })
      );
    });
  });

  // 10. Pagination navigation
  it('10. navigates between pages using pagination controls', async () => {
    vi.mocked(adminApi.fetchAdminAuditLogs).mockResolvedValueOnce({
      logs: mockAuditLogs,
      total: 30,
      page: 1,
      pageSize: 15,
      totalPages: 2,
    });

    render(
      <MemoryRouter>
        <AdminAuditLogs />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });

    const nextBtn = screen.getByLabelText('Next Page');
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(adminApi.fetchAdminAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });
  });

  // 11. logAdminAction helper validates parameters
  it('11. logAdminAction throws error when required parameters are omitted', async () => {
    await expect(adminApi.logAdminAction()).rejects.toThrow(
      'Action and resourceType are required for audit logging.'
    );
    await expect(adminApi.logAdminAction({ action: 'view' })).rejects.toThrow(
      'Action and resourceType are required for audit logging.'
    );
  });

  // 12. logAdminAction logs via RPC or insert
  it('12. logAdminAction records audit log with actor binding', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: 'uuid-log-123', error: null });

    const result = await adminApi.logAdminAction({
      action: 'export_trades_csv',
      resourceType: 'trades',
      resourceId: 'platform_filtered',
      metadata: { rowCount: 100 },
    });

    expect(result).toEqual({ id: 'uuid-log-123', success: true });
    expect(supabase.rpc).toHaveBeenCalledWith(
      'log_admin_action',
      expect.objectContaining({
        p_action: 'export_trades_csv',
        p_resource_type: 'trades',
      })
    );
  });

  // 13. logAdminAction falls back to direct insert if RPC fails
  it('13. falls back to direct table insert if RPC fails or is unavailable', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('RPC unavailable') });
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'admin-caller-uuid' } },
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'uuid-insert-456' }, error: null }),
    });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    supabase.from.mockReturnValueOnce({ insert: mockInsert });

    const result = await adminApi.logAdminAction({
      action: 'export_trades_csv',
      resourceType: 'trades',
      metadata: { count: 5 },
    });

    expect(result).toEqual({ id: 'uuid-insert-456', success: true });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_user_id: 'admin-caller-uuid',
        action: 'export_trades_csv',
        resource_type: 'trades',
      })
    );
  });

  // 14. logAdminAction rejects when user session is missing
  it('14. rejects logging when user identity is missing or unauthenticated', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('RPC error') });
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    await expect(
      adminApi.logAdminAction({
        action: 'export_trades_csv',
        resourceType: 'trades',
      })
    ).rejects.toThrow('Unauthenticated user cannot record audit events.');
  });
});

