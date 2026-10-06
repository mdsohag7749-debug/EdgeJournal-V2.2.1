import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  Calendar,
  Wallet,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Users,
  CheckCircle2,
  PieChart as PieIcon,
  BarChart3,
  Layers,
  Clock,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  UserCheck,
  UserX,
} from 'lucide-react';
import {
  fetchAdminReports,
  exportAdminTradesCsv,
  fetchAdminAccountOptions,
} from '../../lib/adminApi';
import { formatMoney, pnlClass, formatDate } from '../../lib/utils';

const DATE_RANGE_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: '90d', label: 'Last 90 Days' },
  { id: 'ytd', label: 'This Year' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
];

const REPORT_TABS = [
  { id: 'all', label: 'All Reports' },
  { id: 'summary', label: 'Platform Summary' },
  { id: 'trading', label: 'Trading Performance' },
  { id: 'activity', label: 'User Activity' },
  { id: 'symbols', label: 'Symbol Performance' },
  { id: 'accounts', label: 'Account Performance' },
];

export default function AdminReports() {
  // Filter state
  const [dateRange, setDateRange] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [accountOptions, setAccountOptions] = useState([]);
  const [activeTab, setActiveTab] = useState('all');

  // Query state
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState(null);

  // Load account options
  useEffect(() => {
    fetchAdminAccountOptions()
      .then((accs) => setAccountOptions(accs))
      .catch(() => {});
  }, []);

  // Fetch reports data
  const loadReports = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const result = await fetchAdminReports({
          dateRange,
          startDate: dateRange === 'custom' ? customStart : null,
          endDate: dateRange === 'custom' ? customEnd : null,
          accountId: selectedAccount,
        });
        setReportData(result);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err?.message || 'Failed to load platform reports.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dateRange, customStart, customEnd, selectedAccount]
  );

  useEffect(() => {
    if (dateRange === 'custom' && (!customStart || !customEnd)) {
      return;
    }
    loadReports();
  }, [loadReports, dateRange, selectedAccount]);

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (customStart && customEnd) {
      loadReports();
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    setExportFeedback(null);
    try {
      const result = await exportAdminTradesCsv({
        dateRange,
        startDate: dateRange === 'custom' ? customStart : null,
        endDate: dateRange === 'custom' ? customEnd : null,
        accountId: selectedAccount,
      });

      if (!result.success && result.reason === 'no_rows') {
        setExportFeedback({
          type: 'warning',
          message: 'No trade records found matching the active filters to export.',
        });
      } else {
        setExportFeedback({
          type: 'success',
          message: `Successfully exported ${result.rowCount} trade records to CSV.`,
        });
      }
    } catch (err) {
      setExportFeedback({
        type: 'error',
        message: err?.message || 'Failed to export trades CSV.',
      });
    } finally {
      setExporting(false);
      setTimeout(() => {
        setExportFeedback((fb) => (fb?.type === 'success' ? null : fb));
      }, 5000);
    }
  };

  const summary = reportData?.summary;
  const trading = reportData?.trading;
  const userActivity = reportData?.userActivity;
  const symbolPerformance = reportData?.symbolPerformance || [];
  const accountPerformance = reportData?.accountPerformance || [];
  const meta = reportData?.meta;

  const activePeriodLabel = useMemo(() => {
    const opt = DATE_RANGE_OPTIONS.find((o) => o.id === dateRange);
    if (dateRange === 'custom' && customStart && customEnd) {
      return `Custom (${customStart} to ${customEnd})`;
    }
    return opt ? opt.label : 'Active Period';
  }, [dateRange, customStart, customEnd]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }} data-testid="admin-reports-page">
      {/* 1. Header Toolbar & Filters */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          background: 'var(--bg-elevated)',
          padding: '18px 20px',
          borderRadius: 12,
          border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Active Period & Sync Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--win)',
                  boxShadow: '0 0 10px rgba(47, 214, 110, 0.4)',
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                Reporting Engine
              </span>
            </div>
            <span
              className="tag tag-neutral"
              style={{ fontSize: 11, padding: '2px 8px' }}
              data-testid="active-period-badge"
            >
              Active Period: {activePeriodLabel}
            </span>
            {lastUpdated && (
              <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                • Synced {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Action buttons: Account filter, Refresh, Export CSV */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Account filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Wallet size={14} color="var(--text-muted)" />
              <select
                aria-label="Filter report by account"
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Accounts (Platform)</option>
                {accountOptions.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} {acc.broker ? `(${acc.broker})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh */}
            <button
              onClick={() => loadReports(true)}
              disabled={loading || refreshing}
              className="btn btn-ghost btn-sm"
              style={{
                fontSize: 12.5,
                border: '1px solid var(--border)',
                padding: '6px 12px',
                gap: 6,
              }}
              aria-label="Refresh reports data"
            >
              <RefreshCw
                size={13}
                style={{
                  animation: refreshing ? 'spin 1s linear infinite' : 'none',
                }}
              />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>

            {/* Export CSV button */}
            <button
              onClick={handleExportCsv}
              disabled={exporting || loading}
              className="btn btn-primary btn-sm"
              style={{
                fontSize: 12.5,
                padding: '6px 14px',
                gap: 6,
                fontWeight: 600,
              }}
              aria-label="Export CSV"
              data-testid="export-csv-button"
            >
              <Download size={14} />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>

        {/* Date Range Selector Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            borderTop: '1px solid var(--border)',
            paddingTop: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                marginRight: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Calendar size={13} />
              Period:
            </span>
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setDateRange(opt.id)}
                className={`btn btn-sm ${dateRange === opt.id ? 'btn-primary' : 'btn-ghost'}`}
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: dateRange === opt.id ? 'none' : '1px solid var(--border)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker */}
          {dateRange === 'custom' && (
            <form
              onSubmit={handleCustomSubmit}
              style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
            >
              <input
                type="date"
                aria-label="Start Date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: 12,
                }}
                required
              />
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>to</span>
              <input
                type="date"
                aria-label="End Date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: 12,
                }}
                required
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                style={{ fontSize: 12, padding: '4px 10px' }}
              >
                Apply Range
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Export Feedback Banner */}
      {exportFeedback && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background:
              exportFeedback.type === 'success'
                ? 'rgba(47, 214, 110, 0.1)'
                : exportFeedback.type === 'warning'
                ? 'rgba(234, 179, 8, 0.1)'
                : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${
              exportFeedback.type === 'success'
                ? 'rgba(47, 214, 110, 0.3)'
                : exportFeedback.type === 'warning'
                ? 'rgba(234, 179, 8, 0.3)'
                : 'rgba(239, 68, 68, 0.3)'
            }`,
            color:
              exportFeedback.type === 'success'
                ? 'var(--win)'
                : exportFeedback.type === 'warning'
                ? '#eab308'
                : 'var(--loss)',
          }}
        >
          {exportFeedback.type === 'success' ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{exportFeedback.message}</span>
        </div>
      )}

      {/* Query Error Banner */}
      {error && (
        <div
          role="alert"
          style={{
            padding: '14px 18px',
            borderRadius: 10,
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={18} color="var(--loss)" />
            <span style={{ fontSize: 13, color: 'var(--loss)' }}>{error}</span>
          </div>
          <button
            onClick={() => loadReports()}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 12, color: 'var(--loss)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Report Type Selector / Section Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          overflowX: 'auto',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 8,
        }}
        role="tablist"
        aria-label="Report Sections"
      >
        {REPORT_TABS.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveTab(tab.id)}
              className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                fontSize: 12.5,
                fontWeight: isSelected ? 700 : 500,
                padding: '6px 14px',
                borderRadius: 8,
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 14,
            }}
          >
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 18,
                  height: 94,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div className="skeleton-bar" style={{ height: 12, width: '45%' }} />
                <div className="skeleton-bar" style={{ height: 26, width: '70%' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Rendering when Loaded */}
      {!loading && reportData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* SECTION 1: PLATFORM OVERVIEW / SUMMARY */}
          {(activeTab === 'all' || activeTab === 'summary') && (
            <section aria-labelledby="platform-summary-heading" data-testid="platform-summary-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2
                  id="platform-summary-heading"
                  style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <BarChart3 size={17} color="var(--red)" />
                  Platform Summary
                </h2>
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  Platform population and aggregate metrics
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 14,
                }}
              >
                {/* Total Users */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                    Total Users
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700 }}>
                    {summary?.totalUsers?.toLocaleString() ?? 0}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                    Registered platform traders
                  </div>
                </div>

                {/* Total Accounts */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                    Total Accounts
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700 }}>
                    {summary?.totalAccounts?.toLocaleString() ?? 0}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                    Connected trading accounts
                  </div>
                </div>

                {/* Total Trades in Period */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                    Total Trades
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700 }}>
                    {summary?.totalTrades?.toLocaleString() ?? 0}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                    {summary?.totalWins || 0}W • {summary?.totalLosses || 0}L • {summary?.totalBreakeven || 0}BE
                  </div>
                </div>

                {/* Overall Win Rate */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                    Overall Win Rate
                  </span>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 24,
                      fontWeight: 700,
                      color: (summary?.winRate || 0) >= 50 ? 'var(--win)' : 'var(--text)',
                    }}
                  >
                    {summary?.winRate ?? 0}%
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                    Resolved trades in period
                  </div>
                </div>

                {/* Total Net P&L */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                    Total Net P&L
                  </span>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 24,
                      fontWeight: 700,
                      color: (summary?.totalNetPnl || 0) >= 0 ? 'var(--win)' : 'var(--loss)',
                    }}
                  >
                    {formatMoney(summary?.totalNetPnl || 0)}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                    Realized net across all trades
                  </div>
                </div>

                {/* Average Trade P&L */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                    Average Trade P&L
                  </span>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 24,
                      fontWeight: 700,
                      color: (summary?.avgTradePnl || 0) >= 0 ? 'var(--win)' : 'var(--loss)',
                    }}
                  >
                    {formatMoney(summary?.avgTradePnl || 0)}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                    Average return per execution
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SECTION 2: TRADING PERFORMANCE */}
          {(activeTab === 'all' || activeTab === 'trading') && (
            <section aria-labelledby="trading-report-heading" data-testid="trading-report-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2
                  id="trading-report-heading"
                  style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <TrendingUp size={17} color="var(--win)" />
                  Trading Report
                </h2>
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  Execution volume, outcome distribution, and behavior
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: 16,
                }}
              >
                {/* Distribution & Key KPIs */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Outcome Distribution</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(trading?.distribution || []).map((d) => (
                      <div key={d.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                          <span style={{ color: 'var(--text-muted)' }}>{d.name}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {d.value} trades ({d.percentage}%)
                          </span>
                        </div>
                        <div
                          style={{
                            height: 6,
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: 4,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, d.percentage)}%`,
                              height: '100%',
                              background: d.color,
                              borderRadius: 4,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      borderTop: '1px solid var(--border)',
                      paddingTop: 14,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Average R Multiple</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                        {trading?.avgRR != null ? `${trading.avgRR > 0 ? '+' : ''}${trading.avgRR} R` : 'Not Available'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Total Net P&L</div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 16,
                          fontWeight: 700,
                          marginTop: 4,
                          color: (trading?.netPnl || 0) >= 0 ? 'var(--win)' : 'var(--loss)',
                        }}
                      >
                        {formatMoney(trading?.netPnl || 0)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Behavioral & Direction Breakdown */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Direction & Session Breakdown</div>

                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}>Direction</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                      {(trading?.behavior?.direction || []).map((dir) => (
                        <div
                          key={dir.direction}
                          style={{
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            padding: '10px 12px',
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{dir.direction}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, marginTop: 4 }}>
                            {dir.tradeCount} trades • {dir.winRate}% win
                          </div>
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 12.5,
                              fontWeight: 700,
                              marginTop: 2,
                              color: dir.netPnl >= 0 ? 'var(--win)' : 'var(--loss)',
                            }}
                          >
                            {formatMoney(dir.netPnl)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}>Sessions</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                      {(trading?.behavior?.session || []).slice(0, 4).map((sess) => (
                        <div
                          key={sess.session}
                          style={{
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            padding: '10px 12px',
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{sess.session}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                            {sess.tradeCount} trades ({sess.winRate}% win)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SECTION 3: USER ACTIVITY REPORT */}
          {(activeTab === 'all' || activeTab === 'activity') && (
            <section aria-labelledby="user-activity-heading" data-testid="user-activity-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2
                  id="user-activity-heading"
                  style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Users size={17} color="var(--accent)" />
                  User Activity Report
                </h2>
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  Platform engagement and trading participation
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 14,
                }}
              >
                {/* New Users in Period */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                    New Users in Period
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700 }}>
                    {userActivity?.newUsersInPeriod?.toLocaleString() ?? 0}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                    Profiles registered within selected period
                  </div>
                </div>

                {/* Users with Trading Activity */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                    Active Traders
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--win)' }}>
                    {userActivity?.usersWithTradingActivity?.toLocaleString() ?? 0}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                    Traders with executions logged in period
                  </div>
                </div>

                {/* Users with No Trades */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                    Users with No Trades
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--text-muted)' }}>
                    {userActivity?.usersWithNoTrades?.toLocaleString() ?? 0}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                    Registered users with zero trades in period
                  </div>
                </div>

                {/* Accounts per User */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                    Accounts per User
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700 }}>
                    {userActivity?.accountsPerUser ?? 0}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                    Average trading accounts per registered user
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SECTION 4: DYNAMIC SYMBOL PERFORMANCE */}
          {(activeTab === 'all' || activeTab === 'symbols') && (
            <section aria-labelledby="symbol-performance-heading" data-testid="symbol-performance-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2
                  id="symbol-performance-heading"
                  style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Layers size={17} color="var(--accent)" />
                  Symbol Performance Report
                </h2>
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  Dynamic instruments aggregated from database trades
                </span>
              </div>

              {symbolPerformance.length === 0 ? (
                <div
                  style={{
                    padding: '32px 20px',
                    textAlign: 'center',
                    background: 'var(--bg-elevated)',
                    borderRadius: 10,
                    border: '1px dashed var(--border)',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                  }}
                >
                  No symbol execution data found for this period.
                </div>
              ) : (
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Instrument
                          </th>
                          <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Trades
                          </th>
                          <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Win Rate
                          </th>
                          <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Avg Trade P&L
                          </th>
                          <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Total Net P&L
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {symbolPerformance.map((sym) => (
                          <tr
                            key={sym.symbol}
                            style={{
                              borderBottom: '1px solid var(--border)',
                              transition: 'background 0.15s ease',
                            }}
                          >
                            <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                              {sym.symbol}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                              {sym.tradeCount} ({sym.wins}W / {sym.losses}L)
                            </td>
                            <td
                              style={{
                                padding: '12px 16px',
                                textAlign: 'right',
                                fontFamily: 'var(--font-mono)',
                                color: sym.winRate >= 50 ? 'var(--win)' : 'var(--text)',
                              }}
                            >
                              {sym.winRate}%
                            </td>
                            <td
                              style={{
                                padding: '12px 16px',
                                textAlign: 'right',
                                fontFamily: 'var(--font-mono)',
                                color: sym.avgPnl >= 0 ? 'var(--win)' : 'var(--loss)',
                              }}
                            >
                              {formatMoney(sym.avgPnl)}
                            </td>
                            <td
                              style={{
                                padding: '12px 16px',
                                textAlign: 'right',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 700,
                                color: sym.netPnl >= 0 ? 'var(--win)' : 'var(--loss)',
                              }}
                            >
                              {formatMoney(sym.netPnl)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* SECTION 5: ACCOUNT PERFORMANCE */}
          {(activeTab === 'all' || activeTab === 'accounts') && (
            <section aria-labelledby="account-performance-heading" data-testid="account-performance-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2
                  id="account-performance-heading"
                  style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Wallet size={17} color="var(--win)" />
                  Account Performance Report
                </h2>
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  Platform accounts mapped to trade performance
                </span>
              </div>

              {accountPerformance.length === 0 ? (
                <div
                  style={{
                    padding: '32px 20px',
                    textAlign: 'center',
                    background: 'var(--bg-elevated)',
                    borderRadius: 10,
                    border: '1px dashed var(--border)',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                  }}
                >
                  No account execution data found for this period.
                </div>
              ) : (
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Account
                          </th>
                          <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Broker / Platform
                          </th>
                          <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Trades
                          </th>
                          <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Win Rate
                          </th>
                          <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Total Net P&L
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {accountPerformance.map((acc) => (
                          <tr
                            key={acc.accountId}
                            style={{
                              borderBottom: '1px solid var(--border)',
                              transition: 'background 0.15s ease',
                            }}
                          >
                            <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                              {acc.name}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                              {acc.broker} ({acc.currency})
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                              {acc.tradeCount}
                            </td>
                            <td
                              style={{
                                padding: '12px 16px',
                                textAlign: 'right',
                                fontFamily: 'var(--font-mono)',
                                color: acc.winRate >= 50 ? 'var(--win)' : 'var(--text)',
                              }}
                            >
                              {acc.winRate}%
                            </td>
                            <td
                              style={{
                                padding: '12px 16px',
                                textAlign: 'right',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 700,
                                color: acc.netPnl >= 0 ? 'var(--win)' : 'var(--loss)',
                              }}
                            >
                              {formatMoney(acc.netPnl)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
