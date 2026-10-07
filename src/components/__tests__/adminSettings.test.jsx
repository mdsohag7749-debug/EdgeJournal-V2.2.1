import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminSettings from '../admin/AdminSettings';
import AdminRoute from '../../routes/AdminRoute';
import AdminShell from '../../layouts/AdminShell';
import Register from '../../pages/auth/Register';
import * as authContext from '../../context/AuthContext';
import * as adminApi from '../../lib/adminApi';
import * as systemSettingsApi from '../../lib/systemSettingsApi';

vi.mock('../../context/AuthContext', async () => {
  const actual = await vi.importActual('../../context/AuthContext');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

vi.mock('../../lib/adminApi', async () => {
  const actual = await vi.importActual('../../lib/adminApi');
  return {
    ...actual,
    fetchSystemSettings: vi.fn(),
    updateSystemSetting: vi.fn(),
    updateSystemSettings: vi.fn(),
    logAdminAction: vi.fn(),
  };
});

describe('Phase 8 — System Settings & Platform Hardening Suite', () => {
  const mockSettingsData = [
    {
      id: 's-1',
      key: 'public_app_name',
      value: 'EdgeJournal',
      description: 'Official application brand name',
      isPublic: true,
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-07T10:00:00Z',
    },
    {
      id: 's-2',
      key: 'public_support_email',
      value: 'support@edgejournal.com',
      description: 'Official support email contact',
      isPublic: true,
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-07T10:00:00Z',
    },
    {
      id: 's-3',
      key: 'default_timezone',
      value: 'America/New_York',
      description: 'Default platform timezone',
      isPublic: true,
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-07T10:00:00Z',
    },
    {
      id: 's-4',
      key: 'default_currency',
      value: 'USD',
      description: 'Default base currency',
      isPublic: true,
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-07T10:00:00Z',
    },
    {
      id: 's-5',
      key: 'registration_enabled',
      value: true,
      description: 'Global registration toggle',
      isPublic: true,
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-07T10:00:00Z',
    },
    {
      id: 's-6',
      key: 'maintenance_mode',
      value: false,
      description: 'Platform maintenance mode',
      isPublic: true,
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-07T10:00:00Z',
    },
    {
      id: 's-7',
      key: 'session_idle_timeout_minutes',
      value: 60,
      description: 'Admin session timeout',
      isPublic: false,
      createdAt: '2026-10-07T10:00:00Z',
      updatedAt: '2026-10-07T10:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminApi.fetchSystemSettings).mockResolvedValue(mockSettingsData);
  });

  // ---------------------------------------------------------------------------
  // 1. Loading & Rendering Settings
  // ---------------------------------------------------------------------------
  describe('AdminSettings UI Rendering', () => {
    it('loads and displays current database settings with RLS badge', async () => {
      render(
        <MemoryRouter>
          <AdminSettings />
        </MemoryRouter>
      );

      // Verify header and RLS indicator
      expect(screen.getByText(/System Settings & Platform Hardening/i)).toBeInTheDocument();
      expect(screen.getByText('RLS ENFORCED')).toBeInTheDocument();

      // Wait for settings to load
      await waitFor(() => {
        expect(screen.getByDisplayValue('EdgeJournal')).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue('support@edgejournal.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('America/New_York')).toBeInTheDocument();
      expect(screen.getByDisplayValue('USD')).toBeInTheDocument();
      expect(screen.getByDisplayValue('60')).toBeInTheDocument();

      // Check registration and maintenance toggles
      expect(screen.getByText('User Registration')).toBeInTheDocument();
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
      expect(screen.getByText('Maintenance Mode')).toBeInTheDocument();
      expect(screen.getByText('NORMAL OPERATION')).toBeInTheDocument();

      // Admin-only privacy indicator
      expect(screen.getByText('NOT EXPOSED TO TRADERS')).toBeInTheDocument();
    });

    it('renders error state with retry functionality when fetch fails', async () => {
      vi.mocked(adminApi.fetchSystemSettings).mockRejectedValueOnce(new Error('Network error: connection refused'));

      render(
        <MemoryRouter>
          <AdminSettings />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Network error: connection refused/i)).toBeInTheDocument();
      });

      const retryBtn = screen.getByRole('button', { name: /retry/i });
      expect(retryBtn).toBeInTheDocument();

      vi.mocked(adminApi.fetchSystemSettings).mockResolvedValue(mockSettingsData);
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByDisplayValue('EdgeJournal')).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Modifying and Saving Settings
  // ---------------------------------------------------------------------------
  describe('Settings Mutation & Dirty Tracking', () => {
    it('tracks unsaved changes and updates settings on save', async () => {
      vi.mocked(adminApi.updateSystemSetting).mockResolvedValue({
        id: 's-1',
        key: 'public_app_name',
        value: 'EdgeJournal Pro',
        isPublic: true,
      });

      render(
        <MemoryRouter>
          <AdminSettings />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('EdgeJournal')).toBeInTheDocument();
      });

      const saveBtn = screen.getByRole('button', { name: /save settings/i });
      expect(saveBtn).toBeDisabled();

      // Modify app name
      const appNameInput = screen.getByLabelText(/application display name/i);
      fireEvent.change(appNameInput, { target: { value: 'EdgeJournal Pro' } });

      // Dirty state is detected
      expect(screen.getByText(/1 unsaved setting change/i)).toBeInTheDocument();
      expect(saveBtn).not.toBeDisabled();

      // Save changes
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(adminApi.updateSystemSetting).toHaveBeenCalledWith('public_app_name', 'EdgeJournal Pro');
      });

      await waitFor(() => {
        expect(screen.getByText(/Successfully saved 1 system setting/i)).toBeInTheDocument();
      });
    });

    it('resets dirty form values back to initial database state on Reset click', async () => {
      render(
        <MemoryRouter>
          <AdminSettings />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('EdgeJournal')).toBeInTheDocument();
      });

      const appNameInput = screen.getByLabelText(/application display name/i);
      fireEvent.change(appNameInput, { target: { value: 'Changed Brand' } });
      expect(screen.getByDisplayValue('Changed Brand')).toBeInTheDocument();

      const resetBtn = screen.getByRole('button', { name: /reset/i });
      fireEvent.click(resetBtn);

      expect(screen.getByDisplayValue('EdgeJournal')).toBeInTheDocument();
      expect(screen.getByText(/All system settings synchronized with database/i)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Form Validation
  // ---------------------------------------------------------------------------
  describe('Input Validation', () => {
    it('disables save button and displays warning if application name is blank', async () => {
      render(
        <MemoryRouter>
          <AdminSettings />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('EdgeJournal')).toBeInTheDocument();
      });

      const appNameInput = screen.getByLabelText(/application display name/i);
      fireEvent.change(appNameInput, { target: { value: '   ' } });

      expect(screen.getByText(/Application display name cannot be blank/i)).toBeInTheDocument();
      const saveBtn = screen.getByRole('button', { name: /save settings/i });
      expect(saveBtn).toBeDisabled();
    });

    it('disables save button and displays warning if support email is invalid', async () => {
      render(
        <MemoryRouter>
          <AdminSettings />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('support@edgejournal.com')).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/public support email/i);
      fireEvent.change(emailInput, { target: { value: 'not-an-email' } });

      expect(screen.getByText(/Support email must be a valid email address/i)).toBeInTheDocument();
      const saveBtn = screen.getByRole('button', { name: /save settings/i });
      expect(saveBtn).toBeDisabled();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Maintenance Mode Safety Confirmation
  // ---------------------------------------------------------------------------
  describe('Maintenance Mode Confirmation Workflow', () => {
    it('triggers confirmation modal before enabling maintenance mode', async () => {
      render(
        <MemoryRouter>
          <AdminSettings />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('NORMAL OPERATION')).toBeInTheDocument();
      });

      const maintenanceToggle = screen.getByLabelText(/toggle maintenance mode/i);
      expect(maintenanceToggle).not.toBeChecked();

      // Click toggle to enable
      fireEvent.click(maintenanceToggle);

      // Modal appears
      expect(screen.getByText('Enable Platform Maintenance Mode?')).toBeInTheDocument();
      expect(screen.getByText(/Operational Impact Confirmation Required/i)).toBeInTheDocument();
      expect(screen.getByText(/Administrator access is preserved/i)).toBeInTheDocument();

      // Cancel maintains initial state
      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(screen.queryByText('Enable Platform Maintenance Mode?')).not.toBeInTheDocument();
      });
      expect(maintenanceToggle).not.toBeChecked();
    });

    it('confirms and sets maintenance mode to active when user approves modal', async () => {
      render(
        <MemoryRouter>
          <AdminSettings />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('NORMAL OPERATION')).toBeInTheDocument();
      });

      const maintenanceToggle = screen.getByLabelText(/toggle maintenance mode/i);
      fireEvent.click(maintenanceToggle);

      const confirmBtn = screen.getByRole('button', { name: /confirm & enable maintenance/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.queryByText('Enable Platform Maintenance Mode?')).not.toBeInTheDocument();
      });
      expect(screen.getByText('MAINTENANCE ACTIVE')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Route Security & Access Control
  // ---------------------------------------------------------------------------
  describe('Route & Shell Access Control', () => {
    it('denies access to /admin/settings for unauthenticated visitor', () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        profileLoading: false,
        isAdmin: false,
      });

      render(
        <MemoryRouter initialEntries={['/admin/settings']}>
          <Routes>
            <Route
              path="/admin/*"
              element={
                <AdminRoute>
                  <AdminShell />
                </AdminRoute>
              }
            />
            <Route path="/login" element={<div>Redirected to Login</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Redirected to Login')).toBeInTheDocument();
      expect(screen.queryByText(/System Settings & Platform Hardening/i)).not.toBeInTheDocument();
    });

    it('denies access to /admin/settings for authenticated regular trader (role = user)', () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        profileLoading: false,
        isAdmin: false,
        profile: { role: 'user', email: 'trader@edgejournal.com' },
      });

      render(
        <MemoryRouter initialEntries={['/admin/settings']}>
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
      expect(screen.queryByText(/System Settings & Platform Hardening/i)).not.toBeInTheDocument();
    });

    it('allows authenticated administrator (role = admin) to render AdminShell with Settings', async () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        profileLoading: false,
        isAdmin: true,
        profile: { role: 'admin', fullName: 'Super Admin', email: 'admin@edgejournal.com' },
        user: { email: 'admin@edgejournal.com' },
        logout: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/admin/settings']}>
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

      expect(screen.getByRole('heading', { name: /system settings/i, level: 1 })).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText(/General Platform Settings/i)).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Registration Pause Enforcement on Register Page
  // ---------------------------------------------------------------------------
  describe('Registration Toggle Integration', () => {
    it('disables registration submit button and displays banner when registration is paused', async () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        register: vi.fn(),
      });

      // Mock fetchPublicSetting returning false for registration_enabled
      const fetchSpy = vi.spyOn(systemSettingsApi, 'fetchPublicSetting').mockResolvedValue(false);

      render(
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/New account registration is currently paused by administrators/i)).toBeInTheDocument();
      });

      const submitBtn = screen.getByRole('button', { name: /create account/i });
      expect(submitBtn).toBeDisabled();

      fetchSpy.mockRestore();
    });
  });
});
