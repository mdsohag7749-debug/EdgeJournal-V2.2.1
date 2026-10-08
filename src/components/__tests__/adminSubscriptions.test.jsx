import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminSubscriptions from '../admin/AdminSubscriptions';
import Subscription from '../../pages/Subscription';
import AdminShell from '../../layouts/AdminShell';
import AdminRoute from '../../routes/AdminRoute';
import * as authContext from '../../context/AuthContext';
import * as adminApi from '../../lib/adminApi';
import * as subscriptionApi from '../../lib/subscriptionApi';
import { supabase } from '../../lib/supabase';

vi.mock('../../context/AuthContext', async () => {
  const actual = await vi.importActual('../../context/AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

vi.mock('../../lib/adminApi', async () => {
  const actual = await vi.importActual('../../lib/adminApi');
  return {
    ...actual,
    fetchAdminPlans: vi.fn(),
    createAdminPlan: vi.fn(),
    updateAdminPlan: vi.fn(),
    fetchAdminSubscriptions: vi.fn(),
    assignAdminSubscription: vi.fn(),
    updateAdminSubscription: vi.fn(),
    fetchAdminSubscriptionMetrics: vi.fn(),
    fetchUsers: vi.fn(),
    logAdminAction: vi.fn(),
  };
});

vi.mock('../../lib/subscriptionApi', async () => {
  const actual = await vi.importActual('../../lib/subscriptionApi');
  return {
    ...actual,
    fetchCurrentSubscription: vi.fn(),
    fetchActivePlans: vi.fn(),
  };
});

const mockPlans = [
  {
    id: 'plan-1',
    name: 'Free',
    slug: 'free',
    description: 'Essential trade logging and personal performance tracking.',
    price: 0.0,
    currency: 'USD',
    billingInterval: 'monthly',
    isActive: true,
    features: ['journal', 'analytics'],
    limits: { accounts: 1, trades: 500, screenshots_per_trade: 5 },
    userCount: 42,
  },
  {
    id: 'plan-2',
    name: 'Pro',
    slug: 'pro',
    description: 'Advanced intelligence, multiple trading accounts, and CSV export.',
    price: 29.0,
    currency: 'USD',
    billingInterval: 'monthly',
    isActive: true,
    features: ['journal', 'analytics', 'advanced_analytics', 'csv_export', 'reports', 'multiple_accounts'],
    limits: { accounts: 10, trades: 10000, screenshots_per_trade: 10 },
    userCount: 15,
  },
];

const mockSubscriptions = [
  {
    id: 'sub-1',
    userId: 'user-101',
    planId: 'plan-2',
    status: 'active',
    startedAt: '2026-01-01T00:00:00Z',
    expiresAt: null,
    updatedAt: '2026-01-01T00:00:00Z',
    plan: mockPlans[1],
    user: {
      id: 'user-101',
      email: 'protrader@example.com',
      fullName: 'Jane Trader',
      role: 'user',
    },
  },
  {
    id: 'sub-2',
    userId: 'user-102',
    planId: 'plan-1',
    status: 'active',
    startedAt: '2026-02-15T00:00:00Z',
    expiresAt: null,
    updatedAt: '2026-02-15T00:00:00Z',
    plan: mockPlans[0],
    user: {
      id: 'user-102',
      email: 'freetrader@example.com',
      fullName: 'John Free',
      role: 'user',
    },
  },
];

const mockMetrics = {
  plans: { total: 2, active: 2, inactive: 0 },
  subscriptions: { total: 57, active: 55, trialing: 2, expired: 0, cancelled: 0 },
  usersByPlan: { Free: 42, Pro: 15 },
};

const mockUsers = [
  { id: 'user-201', email: 'alpha@example.com', fullName: 'Alpha Trader', role: 'user' },
  { id: 'user-202', email: 'beta@example.com', fullName: 'Beta Trader', role: 'user' },
];

describe('Phase 7: Subscriptions, Plans & Entitlements Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(adminApi.fetchAdminPlans).mockResolvedValue(mockPlans);
    vi.mocked(adminApi.fetchAdminSubscriptions).mockResolvedValue({
      subscriptions: mockSubscriptions,
      total: 2,
      page: 1,
      pageSize: 15,
      totalPages: 1,
    });
    vi.mocked(adminApi.fetchAdminSubscriptionMetrics).mockResolvedValue(mockMetrics);
    vi.mocked(adminApi.fetchUsers).mockResolvedValue({
      users: mockUsers,
      total: 2,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });
    vi.mocked(subscriptionApi.fetchActivePlans).mockResolvedValue(mockPlans);
  });

  // ---------------------------------------------------------------------------
  // Category 1: Access Control & Route Protection
  // ---------------------------------------------------------------------------
  describe('Access Control & Route Protection', () => {
    it('1. redirects unauthenticated visitor away from /admin/subscriptions', async () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        profileLoading: false,
        isAdmin: false,
        user: null,
        profile: null,
      });

      render(
        <MemoryRouter initialEntries={['/admin/subscriptions']}>
          <Routes>
            <Route path="/login" element={<div>Login Page Mock</div>} />
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
        expect(screen.getByText('Login Page Mock')).toBeInTheDocument();
      });
    });

    it('2. redirects regular user away from /admin/subscriptions to dashboard', async () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        profileLoading: false,
        isAdmin: false,
        user: { id: 'reg-user-1', email: 'regular@example.com' },
        profile: { role: 'user', fullName: 'Regular Trader' },
      });

      render(
        <MemoryRouter initialEntries={['/admin/subscriptions']}>
          <Routes>
            <Route path="/" element={<div>Dashboard Mock</div>} />
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
        expect(screen.getByText('Dashboard Mock')).toBeInTheDocument();
      });
    });

    it('3. allows admin user to access /admin/subscriptions', async () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        profileLoading: false,
        isAdmin: true,
        user: { id: 'admin-1', email: 'admin@edgejournal.com' },
        profile: { role: 'admin', fullName: 'Admin User' },
      });

      render(
        <MemoryRouter initialEntries={['/admin/subscriptions']}>
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
        expect(screen.getByText('Subscriptions & Plan Management')).toBeInTheDocument();
        expect(screen.getByText(/Phase 7 Entitlement Architecture/i)).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Category 2: Admin Plans Management & Editor
  // ---------------------------------------------------------------------------
  describe('Admin Plans Management', () => {
    beforeEach(() => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        profileLoading: false,
        isAdmin: true,
        user: { id: 'admin-1' },
        profile: { role: 'admin' },
      });
    });

    it('4. loads and displays defined platform plans in table', async () => {
      render(
        <MemoryRouter>
          <AdminSubscriptions />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText('Free').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Pro').length).toBeGreaterThan(0);
        expect(screen.getByText('$29.00/mo')).toBeInTheDocument();
      });

      expect(adminApi.fetchAdminPlans).toHaveBeenCalledTimes(1);
    });

    it('5. opens create plan modal and allows entering plan parameters', async () => {
      render(
        <MemoryRouter>
          <AdminSubscriptions />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Create New Plan')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create New Plan'));

      expect(screen.getByText('Create Platform Plan')).toBeInTheDocument();
      expect(screen.getByLabelText(/Plan Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Slug/i)).toBeInTheDocument();
      expect(screen.getByText('Feature Entitlements')).toBeInTheDocument();
    });

    it('6. creates new plan via createAdminPlan on form submission', async () => {
      vi.mocked(adminApi.createAdminPlan).mockResolvedValue({
        id: 'plan-3',
        name: 'Enterprise',
        slug: 'enterprise',
        price: 99.0,
        currency: 'USD',
        billingInterval: 'monthly',
        isActive: true,
        features: ['journal', 'analytics', 'advanced_analytics'],
        limits: { accounts: 50, trades: 50000 },
      });

      render(
        <MemoryRouter>
          <AdminSubscriptions />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Create New Plan')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create New Plan'));

      fireEvent.change(screen.getByLabelText(/Plan Name/i), { target: { value: 'Enterprise' } });
      fireEvent.change(screen.getByLabelText(/Slug/i), { target: { value: 'enterprise' } });
      fireEvent.change(screen.getByLabelText(/Price/i), { target: { value: '99' } });

      fireEvent.click(screen.getByText('Create Plan'));

      await waitFor(() => {
        expect(adminApi.createAdminPlan).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Enterprise',
            slug: 'enterprise',
            price: 99,
          })
        );
      });
    });

    it('7. deactivates an active plan via updateAdminPlan', async () => {
      vi.mocked(adminApi.updateAdminPlan).mockResolvedValue({
        ...mockPlans[1],
        isActive: false,
      });

      render(
        <MemoryRouter>
          <AdminSubscriptions />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Deactivate Pro')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Deactivate Pro'));

      await waitFor(() => {
        expect(adminApi.updateAdminPlan).toHaveBeenCalledWith('plan-2', { isActive: false });
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Category 3: Admin Subscriptions Management
  // ---------------------------------------------------------------------------
  describe('Admin Subscriptions Management', () => {
    beforeEach(() => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        profileLoading: false,
        isAdmin: true,
        user: { id: 'admin-1' },
        profile: { role: 'admin' },
      });
    });

    it('8. switches to user subscriptions tab and displays subscriber records', async () => {
      render(
        <MemoryRouter>
          <AdminSubscriptions />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/User Subscriptions/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/User Subscriptions/i));

      await waitFor(() => {
        expect(screen.getByText('Jane Trader')).toBeInTheDocument();
        expect(screen.getByText('protrader@example.com')).toBeInTheDocument();
        expect(screen.getByText('John Free')).toBeInTheDocument();
      });

      expect(adminApi.fetchAdminSubscriptions).toHaveBeenCalled();
    });

    it('9. opens assign / change plan modal and updates subscription', async () => {
      vi.mocked(adminApi.assignAdminSubscription).mockResolvedValue({ id: 'sub-1', success: true });

      render(
        <MemoryRouter>
          <AdminSubscriptions />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByText(/User Subscriptions/i));

      await waitFor(() => {
        expect(screen.getByTestId('change-plan-sub-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('change-plan-sub-1'));

      // When editing an existing subscription, modal title is 'Change User Subscription'
      expect(screen.getByText('Change User Subscription')).toBeInTheDocument();
      expect(screen.getAllByText('Jane Trader').length).toBeGreaterThanOrEqual(1);

      fireEvent.change(screen.getByLabelText(/Assigned Plan Tier/i), { target: { value: 'plan-1' } });
      fireEvent.click(screen.getByText('Apply Plan Change'));

      await waitFor(() => {
        expect(adminApi.assignAdminSubscription).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user-101',
            planId: 'plan-1',
            status: 'active',
          })
        );
      });
      expect(adminApi.updateAdminSubscription).not.toHaveBeenCalled();
    });

    it('10. filters subscriptions by status', async () => {
      render(
        <MemoryRouter>
          <AdminSubscriptions />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByText(/User Subscriptions/i));

      await waitFor(() => {
        expect(screen.getByLabelText(/Filter subscriptions by status/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/Filter subscriptions by status/i), { target: { value: 'active' } });

      await waitFor(() => {
        expect(adminApi.fetchAdminSubscriptions).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'active',
          })
        );
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Category 4: User-Facing Subscription Page & Entitlements
  // ---------------------------------------------------------------------------
  describe('User-Facing Subscription Page', () => {
    it('11. renders current plan overview, status badge, and tier limits', async () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: { id: 'user-101', email: 'protrader@example.com' },
        currentPlan: mockPlans[1],
        subscription: mockSubscriptions[0],
        subscriptionStatus: 'active',
        isSubscriptionActive: true,
        entitlements: mockPlans[1].features,
        planLimits: mockPlans[1].limits,
      });

      render(
        <MemoryRouter>
          <Subscription />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('current-plan-title')).toHaveTextContent('Pro Plan');
        expect(screen.getByTestId('current-plan-status-badge')).toHaveTextContent('active');
        expect(screen.getAllByText('$29.00/mo').length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Up to 10 accounts/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Up to 10,000 trades/i).length).toBeGreaterThan(0);
      });
    });

    it('12. displays included features checklist with active state indicators', async () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: { id: 'user-101' },
        currentPlan: mockPlans[1],
        subscription: mockSubscriptions[0],
        subscriptionStatus: 'active',
        isSubscriptionActive: true,
        entitlements: mockPlans[1].features,
        planLimits: mockPlans[1].limits,
      });

      render(
        <MemoryRouter>
          <Subscription />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Included Feature Entitlements')).toBeInTheDocument();
        expect(screen.getByText('Advanced Analytics')).toBeInTheDocument();
        expect(screen.getByText('CSV Data Export')).toBeInTheDocument();
      });
    });

    it('13. renders honest notice that upgrades are managed by platform administrator', async () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        isAuthenticated: true,
        user: { id: 'user-102' },
        currentPlan: mockPlans[0], // Free plan
        subscription: null,
        subscriptionStatus: 'none',
        isSubscriptionActive: false,
        entitlements: mockPlans[0].features,
        planLimits: mockPlans[0].limits,
      });

      render(
        <MemoryRouter>
          <Subscription />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Upgrade options are currently managed by the platform administrator/i)).toBeInTheDocument();
        expect(screen.getByText('Managed by Administrator')).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Category 5: Validation & Error Handling
  // ---------------------------------------------------------------------------
  describe('Validation & Error Handling', () => {
    it('14. createAdminPlan rejects when name is missing', async () => {
      // Direct call using the unmocked actual implementation logic
      const actualAdminApi = await vi.importActual('../../lib/adminApi');
      await expect(actualAdminApi.createAdminPlan({ slug: 'pro' })).rejects.toThrow(
        /Plan name and slug are required/i
      );
    });

    it('15. assignAdminSubscription rejects when user or plan is missing', async () => {
      const actualAdminApi = await vi.importActual('../../lib/adminApi');
      await expect(actualAdminApi.assignAdminSubscription({})).rejects.toThrow(
        /User ID and Plan ID are required/i
      );
    });

    it('16. updateAdminSubscription rejects when subscription ID is missing', async () => {
      const actualAdminApi = await vi.importActual('../../lib/adminApi');
      await expect(actualAdminApi.updateAdminSubscription(null, {})).rejects.toThrow(
        /Subscription ID is required/i
      );
    });

    it('17. updateAdminPlan rejects when plan ID is missing', async () => {
      const actualAdminApi = await vi.importActual('../../lib/adminApi');
      await expect(actualAdminApi.updateAdminPlan(null, {})).rejects.toThrow(
        /Plan ID is required/i
      );
    });

    it('uses the secure assignment RPC without a direct table fallback', async () => {
      const actualAdminApi = await vi.importActual('../../lib/adminApi');
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: 'sub-new-1',
        error: null,
      });
      const fromSpy = vi.spyOn(supabase, 'from');

      try {
        await expect(
          actualAdminApi.assignAdminSubscription({
            userId: 'user-201',
            planId: 'plan-2',
            status: 'active',
            expiresAt: null,
          })
        ).resolves.toEqual({ id: 'sub-new-1', success: true });

        expect(rpcSpy).toHaveBeenCalledWith('admin_assign_subscription', {
          p_user_id: 'user-201',
          p_plan_id: 'plan-2',
          p_status: 'active',
          p_expires_at: null,
        });
        expect(fromSpy).not.toHaveBeenCalled();
      } finally {
        rpcSpy.mockRestore();
        fromSpy.mockRestore();
      }
    });

    it('does not fall back to direct writes when the assignment RPC fails', async () => {
      const actualAdminApi = await vi.importActual('../../lib/adminApi');
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
        data: null,
        error: new Error('RPC unavailable'),
      });
      const fromSpy = vi.spyOn(supabase, 'from');

      try {
        await expect(
          actualAdminApi.assignAdminSubscription({
            userId: 'user-201',
            planId: 'plan-2',
          })
        ).rejects.toThrow(/RPC unavailable/);
        expect(fromSpy).not.toHaveBeenCalled();
      } finally {
        rpcSpy.mockRestore();
        fromSpy.mockRestore();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Category 6: Assign Subscription — New User Flow
  // ---------------------------------------------------------------------------
  describe('Assign Subscription — New User Flow', () => {
    beforeEach(() => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        profileLoading: false,
        isAdmin: true,
        user: { id: 'admin-1' },
        profile: { role: 'admin' },
      });
    });

    it('18. shows Assign Subscription button in User Subscriptions tab', async () => {
      render(
        <MemoryRouter>
          <AdminSubscriptions />
        </MemoryRouter>
      );

      // Switch to subscriptions tab
      await waitFor(() => {
        expect(screen.getByText(/User Subscriptions/i)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/User Subscriptions/i));

      await waitFor(() => {
        expect(screen.getByTestId('assign-subscription-btn')).toBeInTheDocument();
        expect(screen.getByTestId('assign-subscription-btn')).not.toBeDisabled();
      });
    });

    it('19. Assign Subscription button opens modal with user selector and calls assignAdminSubscription', async () => {
      vi.mocked(adminApi.assignAdminSubscription).mockResolvedValue({ id: 'sub-new-1', success: true });

      render(
        <MemoryRouter>
          <AdminSubscriptions />
        </MemoryRouter>
      );

      // Switch to subscriptions tab
      await waitFor(() => {
        expect(screen.getByText(/User Subscriptions/i)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/User Subscriptions/i));

      // Click Assign Subscription
      await waitFor(() => {
        expect(screen.getByTestId('assign-subscription-btn')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('assign-subscription-btn'));

      // Modal opens with title
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Assign Subscription' })).toBeInTheDocument();
        expect(screen.getByLabelText(/Select user for subscription assignment/i)).toBeInTheDocument();
      });

      // Select a user
      fireEvent.change(screen.getByLabelText(/Select user for subscription assignment/i), {
        target: { value: 'user-201' },
      });

      // Select a plan
      fireEvent.change(screen.getByLabelText(/Assigned Plan Tier/i), {
        target: { value: 'plan-2' },
      });

      // Submit
      fireEvent.click(screen.getByText('Apply Plan Change'));

      await waitFor(() => {
        expect(adminApi.assignAdminSubscription).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user-201',
            planId: 'plan-2',
            status: 'active',
          })
        );
      });
    });
  });
});
