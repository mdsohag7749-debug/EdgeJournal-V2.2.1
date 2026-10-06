import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminReports from '../admin/AdminReports';
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
    fetchAdminReports: vi.fn(),
    exportAdminTradesCsv: vi.fn(),
    fetchAdminAccountOptions: vi.fn(),
  };
});

const mockReportData = {
  summary: {
    totalUsers: 25,
    totalAccounts: 8,
    totalTrades: 6,
    totalWins: 3,
    totalLosses: 2,
    totalBreakeven: 1,
    winRate: 50.0,
    totalNetPnl: 850.0,
    avgTradePnl: 141.67,
    avgRR: 2.4,
  },
  trading: {
    volume: 6,
    distribution: [
      { name: 'Wins', value: 3, percentage: 50.0, color: 'var(--win)' },
      { name: 'Losses', value: 2, percentage: 33.3, color: 'var(--loss)' },
      { name: 'Breakeven', value: 1, percentage: 16.7, color: 'var(--text-faint)' },
    ],
    netPnl: 850.0,
    avgPnl: 141.67,
    avgRR: 2.4,
    winRate: 50.0,
    topSymbols: [{ symbol: 'MNQ', tradeCount: 3, netPnl: 600.0 }],
    topAccounts: [{ name: 'Funded 100k', netPnl: 850.0 }],
    behavior: {
      direction: [
        { direction: 'Long', tradeCount: 4, wins: 3, losses: 1, breakeven: 0, winRate: 75.0, netPnl: 950.0 },
        { direction: 'Short', tradeCount: 2, wins: 0, losses: 1, breakeven: 1, winRate: 0.0, netPnl: -100.0 },
      ],
      session: [
        { session: 'New York', tradeCount: 4, wins: 2, losses: 1, breakeven: 1, winRate: 50.0, netPnl: 500.0 },
        { session: 'London', tradeCount: 2, wins: 1, losses: 1, breakeven: 0, winRate: 50.0, netPnl: 350.0 },
      ],
    },
  },
  userActivity: {
    totalUsers: 25,
    newUsersInPeriod: 4,
    usersWithTradingActivity: 5,
    usersWithNoTrades: 20,
    totalAccounts: 8,
    accountsPerUser: 0.32,
  },
  symbolPerformance: [
    { symbol: 'MNQ', tradeCount: 3, wins: 2, losses: 1, breakeven: 0, winRate: 66.7, avgPnl: 200.0, netPnl: 600.0 },
    { symbol: 'MES', tradeCount: 3, wins: 1, losses: 1, breakeven: 1, winRate: 33.3, avgPnl: 83.33, netPnl: 250.0 },
  ],
  accountPerformance: [
    { accountId: 'acc-1', name: 'Funded 100k', broker: 'Apex', currency: 'USD', tradeCount: 6, winRate: 50.0, netPnl: 850.0 },
  ],
  meta: {
    dateRange: '30d',
    startDate: '2026-09-07',
    endDate: '2026-10-07',
    accountId: 'all',
    totalTrades: 6,
  },
};

const mockAccounts = [
  { id: 'acc-1', name: 'Funded 100k', broker: 'Apex' },
];

describe('Phase 6 — Platform Reports & Data Export Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authContext.useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: true,
      isLoading: false,
      profileLoading: false,
      profile: { id: 'admin-1', role: 'admin', email: 'admin@edgejournal.com' },
    });
    vi.mocked(adminApi.fetchAdminReports).mockResolvedValue(mockReportData);
    vi.mocked(adminApi.fetchAdminAccountOptions).mockResolvedValue(mockAccounts);
    vi.mocked(adminApi.exportAdminTradesCsv).mockResolvedValue({
      success: true,
      rowCount: 6,
      filename: 'edgejournal-trades-30d-2026-10-07.csv',
    });
  });

  // 1. Access Control: Admin allowed
  it('1. allows authenticated admin to access /admin/reports', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/reports']}>
        <AdminShell />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('admin-reports-page')).toBeInTheDocument();
    });
    expect(screen.getByText('Reporting Engine')).toBeInTheDocument();
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
      <MemoryRouter initialEntries={['/admin/reports']}>
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

    expect(screen.queryByTestId('admin-reports-page')).not.toBeInTheDocument();
    expect(screen.getByText('Trader Dashboard Home')).toBeInTheDocument();
  });

  // 3. Access Control: Unauthenticated visitor redirected to /login
  it('3. redirects unauthenticated user away from /admin/reports to /login', () => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      isAuthenticated: false,
      isAdmin: false,
      isLoading: false,
      profileLoading: false,
      profile: null,
    });

    render(
      <MemoryRouter initialEntries={['/admin/reports']}>
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

    expect(screen.queryByTestId('admin-reports-page')).not.toBeInTheDocument();
    expect(screen.getByText('Auth Login Page')).toBeInTheDocument();
  });

  // 4. Reports dashboard renders sections and active period
  it('4. renders report sections, tab navigation, and active period indicator', async () => {
    render(
      <MemoryRouter>
        <AdminReports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-period-badge')).toHaveTextContent(/Active Period: Last 30 Days/i);
    });

    expect(screen.getByTestId('platform-summary-section')).toBeInTheDocument();
    expect(screen.getByTestId('trading-report-section')).toBeInTheDocument();
    expect(screen.getByTestId('user-activity-section')).toBeInTheDocument();
    expect(screen.getByTestId('symbol-performance-section')).toBeInTheDocument();
    expect(screen.getByTestId('account-performance-section')).toBeInTheDocument();
  });

  // 5. Date filters update query
  it('5. updates query when date range filter buttons are clicked', async () => {
    render(
      <MemoryRouter>
        <AdminReports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Last 7 Days'));

    await waitFor(() => {
      expect(adminApi.fetchAdminReports).toHaveBeenCalledWith(
        expect.objectContaining({ dateRange: '7d' })
      );
    });

    fireEvent.click(screen.getByText('All Time'));

    await waitFor(() => {
      expect(adminApi.fetchAdminReports).toHaveBeenCalledWith(
        expect.objectContaining({ dateRange: 'all' })
      );
    });
  });

  // 6. Custom range filter works
  it('6. applies custom date range filter upon form submission', async () => {
    render(
      <MemoryRouter>
        <AdminReports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Custom')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Custom'));

    await waitFor(() => {
      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-08-31' } });

    fireEvent.click(screen.getByRole('button', { name: /apply range/i }));

    await waitFor(() => {
      expect(adminApi.fetchAdminReports).toHaveBeenCalledWith(
        expect.objectContaining({
          dateRange: 'custom',
          startDate: '2026-08-01',
          endDate: '2026-08-31',
        })
      );
    });
  });

  // 7. Account filter dropdown
  it('7. updates reports query when account filter is selected', async () => {
    render(
      <MemoryRouter>
        <AdminReports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/filter report by account/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/filter report by account/i), {
      target: { value: 'acc-1' },
    });

    await waitFor(() => {
      expect(adminApi.fetchAdminReports).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: 'acc-1' })
      );
    });
  });

  // 8. Tab navigation filters visible sections
  it('8. filters visible sections when tabs are clicked', async () => {
    render(
      <MemoryRouter>
        <AdminReports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'User Activity' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: 'User Activity' }));

    // User activity section is visible, while platform summary is hidden
    expect(screen.getByTestId('user-activity-section')).toBeInTheDocument();
    expect(screen.queryByTestId('platform-summary-section')).not.toBeInTheDocument();
  });

  // 9. Dynamic symbols rendered without hardcoding
  it('9. dynamically renders symbol performance from database without hardcoded values', async () => {
    render(
      <MemoryRouter>
        <AdminReports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('MNQ')).toBeInTheDocument();
      expect(screen.getByText('MES')).toBeInTheDocument();
    });

    expect(screen.getByText('+$600.00')).toBeInTheDocument();
    expect(screen.getByText('+$250.00')).toBeInTheDocument();
  });

  // 10. User activity calculations
  it('10. renders accurate user activity metrics derived from schema', async () => {
    render(
      <MemoryRouter>
        <AdminReports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Active Traders')).toBeInTheDocument();
    });

    expect(screen.getByText('5')).toBeInTheDocument(); // active traders
    expect(screen.getByText('20')).toBeInTheDocument(); // users with no trades
    expect(screen.getByText('0.32')).toBeInTheDocument(); // accounts per user
  });

  // 11. Export CSV button triggers export with active filters
  it('11. triggers CSV export with active filters and displays success feedback', async () => {
    render(
      <MemoryRouter>
        <AdminReports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('export-csv-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('export-csv-button'));

    await waitFor(() => {
      expect(adminApi.exportAdminTradesCsv).toHaveBeenCalledWith(
        expect.objectContaining({
          dateRange: '30d',
          accountId: 'all',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Successfully exported 6 trade records to CSV/i)).toBeInTheDocument();
    });
  });

  // 12. Export warning when zero rows match
  it('12. displays an honest warning notification when zero rows match export filter', async () => {
    vi.mocked(adminApi.exportAdminTradesCsv).mockResolvedValueOnce({
      success: false,
      rowCount: 0,
      reason: 'no_rows',
      message: 'No trade records found matching the active filters to export.',
    });

    render(
      <MemoryRouter>
        <AdminReports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('export-csv-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('export-csv-button'));

    await waitFor(() => {
      expect(screen.getByText(/No trade records found matching the active filters to export/i)).toBeInTheDocument();
    });
  });

  // 13. CSV Generator escapes quotes, commas, newlines and nulls
  it('13. correctly generates and escapes CSV records (RFC-4180)', () => {
    const rawTrades = [
      {
        id: 't-1',
        account_id: 'acc-1',
        instrument: 'NQ',
        direction: 'Long',
        date: '2026-10-01',
        result: 'Win',
        net_pnl: 500.5,
        rr: 2.5,
        risk_percent: 1.0,
        session: 'New York',
        model: 'Breakout, "A+" Setup',
        entry_time: '09:30',
        created_at: '2026-10-01T13:30:00Z',
      },
      {
        id: 't-2',
        account_id: null,
        instrument: 'ES',
        direction: 'Short',
        date: '2026-10-02',
        result: 'Loss',
        net_pnl: -200.0,
        rr: null,
        risk_percent: null,
        session: null,
        model: null,
        entry_time: null,
        created_at: '2026-10-02T14:00:00Z',
      },
    ];

    const csv = adminApi.generateTradesCsv(rawTrades);
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe(
      'Trade ID,Account ID,Instrument,Direction,Date,Result,Net P&L,R,Risk %,Session,Model,Entry Time,Created At'
    );

    // Row 1: Escaped quotes in model: Breakout, ""A+"" Setup
    expect(lines[1]).toContain('"Breakout, ""A+"" Setup"');
    expect(lines[1]).toContain('"500.50"');

    // Row 2: Negative number preserved, nulls become empty quotes
    expect(lines[2]).toContain('"-200.00"');
    expect(lines[2]).toContain('""');
  });

  // 14. CSV Generator protects against formula injection
  it('14. guards against spreadsheet formula injection while preserving negative numbers', () => {
    const trades = [
      {
        id: 't-safe',
        instrument: 'NQ',
        net_pnl: -150.0, // Valid negative number — should NOT be prepended with quote
        model: '=SUM(1,2)', // Malicious formula string — MUST be prepended with single quote
      },
    ];

    const csv = adminApi.generateTradesCsv(trades);
    // Negative number should be formatted cleanly without leading '
    expect(csv).toContain('"-150.00"');
    // Formula text should be escaped with leading '
    expect(csv).toContain('"\'=SUM(1,2)"');
  });

  // 15. Empty report dataset handling
  it('15. gracefully handles reports when 0 trades exist in the selected period', async () => {
    vi.mocked(adminApi.fetchAdminReports).mockResolvedValueOnce({
      summary: {
        totalUsers: 10,
        totalAccounts: 2,
        totalTrades: 0,
        totalWins: 0,
        totalLosses: 0,
        totalBreakeven: 0,
        winRate: 0,
        totalNetPnl: 0,
        avgTradePnl: 0,
        avgRR: null,
      },
      trading: {
        volume: 0,
        distribution: [],
        netPnl: 0,
        avgPnl: 0,
        avgRR: null,
        winRate: 0,
        topSymbols: [],
        topAccounts: [],
        behavior: { direction: [], session: [] },
      },
      userActivity: {
        totalUsers: 10,
        newUsersInPeriod: 0,
        usersWithTradingActivity: 0,
        usersWithNoTrades: 10,
        totalAccounts: 2,
        accountsPerUser: 0.2,
      },
      symbolPerformance: [],
      accountPerformance: [],
      meta: { dateRange: 'today', totalTrades: 0 },
    });

    render(
      <MemoryRouter>
        <AdminReports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Total Users').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('10').length).toBeGreaterThan(0);
    expect(screen.getByText('No symbol execution data found for this period.')).toBeInTheDocument();
    expect(screen.getByText('No account execution data found for this period.')).toBeInTheDocument();
  });

  // 16. Reports query error state with retry
  it('16. renders error banner with retry button upon query failure', async () => {
    vi.mocked(adminApi.fetchAdminReports).mockRejectedValueOnce(
      new Error('Failed to load database connection')
    );

    render(
      <MemoryRouter>
        <AdminReports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('Failed to load database connection')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

