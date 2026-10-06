import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminAnalytics from '../../pages/admin/AdminAnalytics';
import AdminOverview from '../../pages/admin/AdminOverview';
import AdminUsers from '../../pages/admin/AdminUsers';
import AdminAccounts from '../../pages/admin/AdminAccounts';
import AdminTrades from '../../pages/admin/AdminTrades';
import AdminShell from '../../layouts/AdminShell';
import AdminRoute from '../../routes/AdminRoute';
import * as authContext from '../../context/AuthContext';
import * as adminApi from '../../lib/adminApi';

vi.mock('../../context/AuthContext', async () => {
  const actual = await vi.importActual('../../context/AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

vi.mock('../../lib/adminApi', async () => {
  const actual = await vi.importActual('../../lib/adminApi');
  return {
    ...actual,
    fetchAdminMetrics: vi.fn(),
    fetchRecentUsers: vi.fn(),
    fetchUsers: vi.fn(),
    fetchAdminAccounts: vi.fn(),
    fetchAdminAccountMetrics: vi.fn(),
    fetchAdminTrades: vi.fn(),
    fetchAdminTradeMetrics: vi.fn(),
    fetchAdminAnalyticsData: vi.fn(),
    fetchAdminAccountOptions: vi.fn(),
  };
});

const mockAnalyticsData = {
  kpis: {
    totalTrades: 4,
    winningTrades: 2,
    losingTrades: 1,
    breakevenTrades: 1,
    winRate: 50.0,
    netPnl: 650.0,
    avgPnl: 162.5,
    avgRR: 2.1,
    bestTrade: 500.0,
    worstTrade: -150.0,
  },
  distribution: [
    { name: 'Wins', value: 2, percentage: 50.0, color: 'var(--win)' },
    { name: 'Losses', value: 1, percentage: 25.0, color: 'var(--loss)' },
    { name: 'Breakeven', value: 1, percentage: 25.0, color: 'var(--text-faint)' },
  ],
  dailyPerformance: [
    { date: '2026-10-01', trades: 2, wins: 1, losses: 0, breakeven: 1, winRate: 50.0, netPnl: 300.0, cumulativePnl: 300.0 },
    { date: '2026-10-02', trades: 2, wins: 1, losses: 1, breakeven: 0, winRate: 50.0, netPnl: 350.0, cumulativePnl: 650.0 },
  ],
  equityCurve: [
    { date: '2026-10-01', pnl: 300.0, cumulativePnl: 300.0, trades: 2 },
    { date: '2026-10-02', pnl: 350.0, cumulativePnl: 650.0, trades: 2 },
  ],
  symbolPerformance: [
    { symbol: 'NQ', tradeCount: 2, wins: 1, losses: 0, breakeven: 1, winRate: 50.0, avgPnl: 225.0, netPnl: 450.0 },
    { symbol: 'ES', tradeCount: 2, wins: 1, losses: 1, breakeven: 0, winRate: 50.0, avgPnl: 100.0, netPnl: 200.0 },
  ],
  topSymbol: { symbol: 'NQ', tradeCount: 2, netPnl: 450.0 },
  bottomSymbol: { symbol: 'ES', tradeCount: 2, netPnl: 200.0 },
  accountPerformance: [
    { accountId: 'acc-1', name: 'Apex 50k #1', broker: 'Apex', platform: 'Tradovate', currency: 'USD', tradeCount: 4, winRate: 50.0, avgPnl: 162.5, netPnl: 650.0 },
  ],
  topAccount: { name: 'Apex 50k #1', netPnl: 650.0 },
  bottomAccount: { name: 'Apex 50k #1', netPnl: 650.0 },
  behavior: {
    direction: [
      { direction: 'Long', tradeCount: 3, wins: 2, losses: 0, breakeven: 1, winRate: 66.7, netPnl: 750.0 },
      { direction: 'Short', tradeCount: 1, wins: 0, losses: 1, breakeven: 0, winRate: 0.0, netPnl: -100.0 },
    ],
    session: [
      { session: 'New York', tradeCount: 4, wins: 2, losses: 1, breakeven: 1, winRate: 50.0, netPnl: 650.0 },
    ],
    holdingDuration: null,
  },
  meta: { dateRange: '30d', totalRecords: 4 },
};

const mockAccountOptions = [
  { id: 'acc-1', name: 'Apex 50k #1', broker: 'Apex' },
];

describe('Phase 5 — Trade Analytics & Performance Intelligence Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authContext.useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: true,
      isLoading: false,
      profileLoading: false,
      profile: { id: 'admin-1', role: 'admin', email: 'admin@edgejournal.com' },
    });
    vi.mocked(adminApi.fetchAdminAnalyticsData).mockResolvedValue(mockAnalyticsData);
    vi.mocked(adminApi.fetchAdminAccountOptions).mockResolvedValue(mockAccountOptions);
    vi.mocked(adminApi.fetchAdminMetrics).mockResolvedValue({
      users: { total: 10, admins: 1, standard: 9, status: 'live' },
      trades: { total: 25, status: 'live' },
      accounts: { total: 5, status: 'live' },
      system: { rlsStatus: 'Enforced', migrationVersion: '0020_admin_accounts_trades_rls', status: 'operational' },
    });
    vi.mocked(adminApi.fetchRecentUsers).mockResolvedValue([]);
    vi.mocked(adminApi.fetchUsers).mockResolvedValue({ users: [], total: 0, page: 1, pageSize: 10, totalPages: 1 });
    vi.mocked(adminApi.fetchAdminAccounts).mockResolvedValue({ accounts: [], total: 0, page: 1, pageSize: 15, totalPages: 1 });
    vi.mocked(adminApi.fetchAdminAccountMetrics).mockResolvedValue({ total: 0, active: 0, inactive: 0, archived: 0 });
    vi.mocked(adminApi.fetchAdminTrades).mockResolvedValue({ trades: [], total: 0, page: 1, pageSize: 15, totalPages: 1 });
    vi.mocked(adminApi.fetchAdminTradeMetrics).mockResolvedValue({ total: 0, wins: 0, losses: 0, breakeven: 0, winRate: 0 });
  });

  // 1. Admin access to /admin/analytics
  it('1. allows authenticated admin to access /admin/analytics', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/analytics']}>
        <AdminShell />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('admin-analytics-page')).toBeInTheDocument();
    });
    expect(screen.getByText('Trade Intelligence Engine')).toBeInTheDocument();
  });

  // 2. Normal user is safely denied and redirected
  it('2. safely denies access to authenticated normal user (role = user)', () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      isLoading: false,
      profileLoading: false,
      profile: { id: 'trader-1', role: 'user', email: 'trader@edgejournal.com' },
    });

    render(
      <MemoryRouter initialEntries={['/admin/analytics']}>
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

    expect(screen.queryByTestId('admin-analytics-page')).not.toBeInTheDocument();
    expect(screen.getByText('Trader Dashboard Home')).toBeInTheDocument();
  });

  // 3. Unauthenticated user is redirected to /login
  it('3. redirects unauthenticated user away to /login', () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      isAuthenticated: false,
      isAdmin: false,
      isLoading: false,
      profileLoading: false,
      profile: null,
    });

    render(
      <MemoryRouter initialEntries={['/admin/analytics']}>
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

    expect(screen.queryByTestId('admin-analytics-page')).not.toBeInTheDocument();
    expect(screen.getByText('Auth Login Page')).toBeInTheDocument();
  });

  // 4. Analytics page renders correctly
  it('4. renders the Analytics Dashboard with headings and controls', async () => {
    render(
      <MemoryRouter>
        <AdminAnalytics />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Platform Performance Metrics')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /refresh analytics data/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/filter by account/i)).toBeInTheDocument();
  });

  // 5. KPI cards render with real metrics
  it('5. renders core KPI cards with calculated metrics', async () => {
    render(
      <MemoryRouter>
        <AdminAnalytics />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Total Trades').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('Win Rate').length).toBeGreaterThan(0);
    expect(screen.getByText('Total Net P&L')).toBeInTheDocument();
    expect(screen.getByText('Average Trade P&L')).toBeInTheDocument();
    expect(screen.getByText('Average R')).toBeInTheDocument();
    expect(screen.getByText('Best / Worst Trade')).toBeInTheDocument();

    // Values from mockAnalyticsData
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+$650.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+$162.50').length).toBeGreaterThan(0);
    expect(screen.getByText('+2.1 R')).toBeInTheDocument();
  });

  // 6. Date range filter works
  it('6. updates query when date range filter buttons are clicked', async () => {
    render(
      <MemoryRouter>
        <AdminAnalytics />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Last 7 Days'));

    await waitFor(() => {
      expect(adminApi.fetchAdminAnalyticsData).toHaveBeenCalledWith(
        expect.objectContaining({ dateRange: '7d' })
      );
    });

    fireEvent.click(screen.getByText('All Time'));

    await waitFor(() => {
      expect(adminApi.fetchAdminAnalyticsData).toHaveBeenCalledWith(
        expect.objectContaining({ dateRange: 'all' })
      );
    });
  });

  // 7. Search/filter state updates correctly (account dropdown)
  it('7. updates query when account filter is changed', async () => {
    render(
      <MemoryRouter>
        <AdminAnalytics />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/filter by account/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/filter by account/i), {
      target: { value: 'acc-1' },
    });

    await waitFor(() => {
      expect(adminApi.fetchAdminAnalyticsData).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: 'acc-1' })
      );
    });
  });

  // 8. Empty state works when 0 trades exist
  it('8. renders empty state placeholder when no trades exist for selected period', async () => {
    vi.mocked(adminApi.fetchAdminAnalyticsData).mockResolvedValueOnce({
      kpis: {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        breakevenTrades: 0,
        winRate: 0,
        netPnl: 0,
        avgPnl: 0,
        avgRR: null,
        bestTrade: 0,
        worstTrade: 0,
      },
      distribution: [],
      dailyPerformance: [],
      equityCurve: [],
      symbolPerformance: [],
      accountPerformance: [],
      behavior: { direction: [], session: [], holdingDuration: null },
      meta: { totalRecords: 0 },
    });

    render(
      <MemoryRouter>
        <AdminAnalytics />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No trading activity found for this period.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /show all time/i })).toBeInTheDocument();
  });

  // 9. Loading state works
  it('9. renders skeleton placeholders while data is loading', () => {
    // Return an unresolved promise for this test only
    vi.mocked(adminApi.fetchAdminAnalyticsData).mockReturnValueOnce(new Promise(() => {}));

    const { container } = render(
      <MemoryRouter>
        <AdminAnalytics />
      </MemoryRouter>
    );

    expect(container.querySelectorAll('.skeleton-bar').length).toBeGreaterThan(0);
  });

  // 10. Error state works
  it('10. handles query failure and presents an error banner with a retry button', async () => {
    vi.mocked(adminApi.fetchAdminAnalyticsData).mockRejectedValueOnce(
      new Error('Database network timeout')
    );

    render(
      <MemoryRouter>
        <AdminAnalytics />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('Database network timeout')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  // 11. Win rate calculation is correct and ignores unresolved trades
  it('11. correctly calculates Win Rate purely from resolved trades (excluding open)', () => {
    const rawTrades = [
      { id: '1', result: 'Win', net_pnl: 100, rr: 2, instrument: 'NQ' },
      { id: '2', result: 'Loss', net_pnl: -50, rr: 1, instrument: 'NQ' },
      { id: '3', result: 'Breakeven', net_pnl: 0, rr: 1, instrument: 'ES' },
      { id: '4', result: 'Open', net_pnl: 0, rr: 1, instrument: 'ES' }, // Open / unresolved trade
    ];

    const result = adminApi.processAdminAnalytics(rawTrades, new Map());
    // Resolved = Win(1) + Loss(1) + Breakeven(1) = 3 trades. Open is NOT counted as loss.
    // Win Rate = 1 / 3 * 100 = 33.3%
    expect(result.kpis.winRate).toBe(33.3);
    expect(result.kpis.winningTrades).toBe(1);
    expect(result.kpis.losingTrades).toBe(1);
    expect(result.kpis.breakevenTrades).toBe(1);
  });

  // 12. P&L calculation is correct
  it('12. correctly calculates Total Net P&L and Average Trade P&L', () => {
    const rawTrades = [
      { id: '1', result: 'Win', net_pnl: 500, rr: 2.5, instrument: 'NQ' },
      { id: '2', result: 'Loss', net_pnl: -200, rr: 1.0, instrument: 'NQ' },
      { id: '3', result: 'Win', net_pnl: 300, rr: 1.5, instrument: 'ES' },
    ];

    const result = adminApi.processAdminAnalytics(rawTrades, new Map());
    // Total Net P&L = 500 - 200 + 300 = 600
    expect(result.kpis.netPnl).toBe(600);
    // Avg Trade P&L = 600 / 3 = 200
    expect(result.kpis.avgPnl).toBe(200);
    expect(result.kpis.bestTrade).toBe(500);
    expect(result.kpis.worstTrade).toBe(-200);
  });

  // 13. Win/loss/breakeven distribution is correct
  it('13. correctly calculates Win/Loss/Breakeven distribution percentages', () => {
    const rawTrades = [
      { id: '1', result: 'Win', net_pnl: 100 },
      { id: '2', result: 'Win', net_pnl: 100 },
      { id: '3', result: 'Loss', net_pnl: -50 },
      { id: '4', result: 'Breakeven', net_pnl: 0 },
    ];

    const result = adminApi.processAdminAnalytics(rawTrades, new Map());
    expect(result.distribution).toEqual([
      { name: 'Wins', value: 2, percentage: 50.0, color: 'var(--win)' },
      { name: 'Losses', value: 1, percentage: 25.0, color: 'var(--loss)' },
      { name: 'Breakeven', value: 1, percentage: 25.0, color: 'var(--text-faint)' },
    ]);
  });

  // 14. Dynamic symbol performance renders without hardcoding
  it('14. dynamically renders symbol performance breakdown from trade data', async () => {
    render(
      <MemoryRouter>
        <AdminAnalytics />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dynamic Symbol & Market Performance')).toBeInTheDocument();
    });

    expect(screen.getByText('NQ')).toBeInTheDocument();
    expect(screen.getByText('ES')).toBeInTheDocument();
    expect(screen.getByText('+$450.00')).toBeInTheDocument();
  });

  // 15. Account performance renders
  it('15. renders account performance table with real account relationships', async () => {
    render(
      <MemoryRouter>
        <AdminAnalytics />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Trading Account Performance')).toBeInTheDocument();
    });

    expect(screen.getByText('Apex 50k #1')).toBeInTheDocument();
    expect(screen.getByText('Apex (USD)')).toBeInTheDocument();
  });

  // 16. Analytics does not expose write actions
  it('16. strictly provides read-only inspection with zero mutation buttons', async () => {
    render(
      <MemoryRouter>
        <AdminAnalytics />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Platform Performance Metrics')).toBeInTheDocument();
    });

    // Verify absence of any destructive or edit triggers
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /update/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create/i })).not.toBeInTheDocument();
  });

  // 17. Existing /admin Overview remains functional
  it('17. keeps existing /admin Overview route functional', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/overview']}>
        <AdminShell />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Platform operational telemetry, security health, and user metrics')).toBeInTheDocument();
    });
  });

  // 18. Existing /admin/users remains functional
  it('18. keeps existing /admin/users route functional', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <AdminShell />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Directory of registered traders, account credentials, and administrative roles')).toBeInTheDocument();
    });
  });

  // 19. Existing /admin/accounts remains functional
  it('19. keeps existing /admin/accounts route functional', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/accounts']}>
        <AdminShell />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Platform-wide view of all trader accounts, balances, and account statuses')).toBeInTheDocument();
    });
  });

  // 20. Existing /admin/trades remains functional
  it('20. keeps existing /admin/trades route functional', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/trades']}>
        <AdminShell />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Platform-wide trade ledger — instruments, results, P&L, and risk across all users')).toBeInTheDocument();
    });
  });
});
