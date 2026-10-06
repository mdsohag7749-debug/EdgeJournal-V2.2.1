import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  Calendar,
  Filter,
  BarChart3,
  PieChart as PieIcon,
  Minus,
  CheckCircle2,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Clock,
  Compass,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Cell,
  PieChart,
  Pie,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { fetchAdminAnalyticsData, fetchAdminAccountOptions } from '../../lib/adminApi';
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

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const pnl = item?.value ?? 0;
  const rawPayload = item?.payload || {};

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        padding: '10px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        fontSize: 12.5,
        minWidth: 160,
      }}
    >
      <div style={{ color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>
        {label ? formatDate(label) : 'Date'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: 'var(--text-muted)' }}>Cumulative P&L:</span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: pnl >= 0 ? 'var(--win)' : 'var(--loss)',
          }}
        >
          {formatMoney(pnl)}
        </span>
      </div>
      {rawPayload.trades !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
          <span style={{ color: 'var(--text-faint)' }}>Trades:</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text)' }}>
            {rawPayload.trades}
          </span>
        </div>
      )}
      {rawPayload.pnl !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
          <span style={{ color: 'var(--text-faint)' }}>Daily P&L:</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: rawPayload.pnl >= 0 ? 'var(--win)' : 'var(--loss)',
            }}
          >
            {formatMoney(rawPayload.pnl)}
          </span>
        </div>
      )}
    </div>
  );
}

function DailyBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.payload || {};
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        padding: '10px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        fontSize: 12.5,
        minWidth: 160,
      }}
    >
      <div style={{ color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>
        {label ? formatDate(label) : 'Date'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: 'var(--text-muted)' }}>Daily Net P&L:</span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: (raw.netPnl || 0) >= 0 ? 'var(--win)' : 'var(--loss)',
          }}
        >
          {formatMoney(raw.netPnl || 0)}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
        <span style={{ color: 'var(--text-faint)' }}>Trades / Win Rate:</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text)' }}>
          {raw.trades || 0} ({raw.winRate || 0}%)
        </span>
      </div>
    </div>
  );
}

export default function AdminAnalytics() {
  // Filter state
  const [dateRange, setDateRange] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [accountOptions, setAccountOptions] = useState([]);

  // Query & Data state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Load account options on mount
  useEffect(() => {
    fetchAdminAccountOptions()
      .then((accs) => setAccountOptions(accs))
      .catch(() => {});
  }, []);

  // Fetch analytics data
  const loadAnalytics = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const result = await fetchAdminAnalyticsData({
          dateRange,
          startDate: dateRange === 'custom' ? customStart : null,
          endDate: dateRange === 'custom' ? customEnd : null,
          accountId: selectedAccount,
        });
        setData(result);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err?.message || 'Failed to load trade analytics.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dateRange, customStart, customEnd, selectedAccount]
  );

  useEffect(() => {
    // If custom range selected, only trigger if both dates are chosen or when user submits
    if (dateRange === 'custom' && (!customStart || !customEnd)) {
      return;
    }
    loadAnalytics();
  }, [loadAnalytics, dateRange, selectedAccount]);

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (customStart && customEnd) {
      loadAnalytics();
    }
  };

  const kpis = data?.kpis;
  const equityCurve = data?.equityCurve || [];
  const distribution = data?.distribution || [];
  const dailyPerformance = data?.dailyPerformance || [];
  const symbolPerformance = data?.symbolPerformance || [];
  const accountPerformance = data?.accountPerformance || [];
  const behavior = data?.behavior;
  const totalTrades = kpis?.totalTrades ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }} data-testid="admin-analytics-page">
      {/* 1. Header Toolbar & Filters */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          background: 'var(--bg-elevated)',
          padding: '16px 20px',
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
          {/* Status & Last updated */}
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
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              Trade Intelligence Engine
            </span>
            {lastUpdated && (
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                • Synced {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Action buttons & Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Account filter dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Wallet size={14} color="var(--text-muted)" />
              <select
                aria-label="Filter by account"
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

            <button
              onClick={() => loadAnalytics(true)}
              disabled={loading || refreshing}
              className="btn btn-ghost btn-sm"
              style={{
                fontSize: 12.5,
                border: '1px solid var(--border)',
                padding: '6px 12px',
                gap: 6,
              }}
              aria-label="Refresh analytics data"
            >
              <RefreshCw
                size={13}
                style={{
                  animation: refreshing ? 'spin 1s linear infinite' : 'none',
                }}
              />
              {refreshing ? 'Refreshing...' : 'Refresh'}
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
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={13} />
              Range:
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

          {/* Custom Date Picker Inputs */}
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

      {/* 2. Error Banner */}
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
            onClick={() => loadAnalytics()}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 12, color: 'var(--loss)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Core KPI Cards */}
      {(!error || data) && (
        <section aria-labelledby="kpi-heading">
          <h2 id="kpi-heading" style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
            Platform Performance Metrics
          </h2>

        {loading ? (
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
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 14,
            }}
          >
            {/* Total Trades */}
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                Total Trades
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700 }}>
                  {totalTrades.toLocaleString()}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                {kpis?.winningTrades || 0}W • {kpis?.losingTrades || 0}L • {kpis?.breakevenTrades || 0}BE
              </div>
            </div>

            {/* Win Rate */}
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                Win Rate
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 24,
                    fontWeight: 700,
                    color: (kpis?.winRate || 0) >= 50 ? 'var(--win)' : 'var(--text)',
                  }}
                >
                  {kpis?.winRate ?? 0}%
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                Resolved trades only (excl. open)
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
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                Total Net P&L
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 24,
                    fontWeight: 700,
                    color: (kpis?.netPnl || 0) >= 0 ? 'var(--win)' : 'var(--loss)',
                  }}
                >
                  {formatMoney(kpis?.netPnl || 0)}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                Realized cumulative net
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
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                Average Trade P&L
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 24,
                    fontWeight: 700,
                    color: (kpis?.avgPnl || 0) >= 0 ? 'var(--win)' : 'var(--loss)',
                  }}
                >
                  {formatMoney(kpis?.avgPnl || 0)}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                Per closed trade
              </div>
            </div>

            {/* Average R */}
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                Average R
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 24,
                    fontWeight: 700,
                    color: kpis && kpis.avgRR != null ? 'var(--text)' : 'var(--text-muted)',
                  }}
                >
                  {kpis && kpis.avgRR != null ? `${kpis.avgRR > 0 ? '+' : ''}${kpis.avgRR} R` : 'Not Available'}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                {kpis && kpis.avgRR != null ? 'Risk-reward multiple' : 'No R:R data logged in period'}
              </div>
            </div>

            {/* Best & Worst Trade */}
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                Best / Worst Trade
              </span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--win)' }}>Best</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--win)' }}>
                    {formatMoney(kpis?.bestTrade || 0)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--loss)' }}>Worst</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--loss)' }}>
                    {formatMoney(kpis?.worstTrade || 0)}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                Single trade extremes
              </div>
            </div>
          </div>
        )}
      </section>
      )}

      {/* 4. Empty State if 0 trades in selected range */}
      {!loading && totalTrades === 0 && (
        <div
          style={{
            padding: '54px 24px',
            textAlign: 'center',
            background: 'var(--bg-elevated)',
            borderRadius: 12,
            border: '1px dashed var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Activity size={32} color="var(--text-muted)" />
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>No trading activity found for this period.</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 440 }}>
            There are no recorded trades matching the selected date range or account filter. Try expanding your date range to "All Time".
          </p>
          <button
            onClick={() => setDateRange('all')}
            className="btn btn-primary btn-sm"
            style={{ marginTop: 6 }}
          >
            Show All Time
          </button>
        </div>
      )}

      {/* 5. Performance Charts: Cumulative Equity Curve & Win/Loss Breakdown */}
      {(!loading && totalTrades > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
          {/* Equity / Cumulative Performance Chart */}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={16} color="var(--win)" />
                  Cumulative Equity Curve
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Net P&L accumulation across all trades in selected period
                </p>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: (kpis?.netPnl || 0) >= 0 ? 'var(--win)' : 'var(--loss)',
                }}
              >
                Ending: {formatMoney(kpis?.netPnl || 0)}
              </div>
            </div>

            <div style={{ width: '100%', height: 260 }} data-testid="equity-curve-container">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <ComposedChart data={equityCurve} margin={{ top: 10, right: 12, left: -6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminEquityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--win)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--win)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={{ stroke: 'var(--border)' }}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                    width={60}
                  />
                  <Tooltip content={<MoneyTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="cumulativePnl"
                    name="Cumulative P&L"
                    stroke="var(--win)"
                    strokeWidth={2.5}
                    fill="url(#adminEquityGrad)"
                    dot={equityCurve.length <= 1}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Win/Loss/Breakeven Outcome Distribution */}
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
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <PieIcon size={16} color="var(--accent)" />
                Outcome Distribution
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Categorical trade breakdown (Wins, Losses, Breakeven)
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
              <div style={{ width: 160, height: 160, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={distribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {distribution.map((entry, index) => {
                        const color =
                          entry.name === 'Wins'
                            ? '#16a34a'
                            : entry.name === 'Losses'
                            ? '#dc2626'
                            : '#71717a';
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Pie>
                    <Tooltip
                      formatter={(val, name) => [
                        `${val} trades (${totalTrades ? ((val / totalTrades) * 100).toFixed(1) : 0}%)`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Accessible Legend / Text summary */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {distribution.map((item) => {
                  const isWin = item.name === 'Wins';
                  const isLoss = item.name === 'Losses';
                  return (
                    <div
                      key={item.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--bg)',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: isWin ? 'var(--win)' : isLoss ? 'var(--loss)' : 'var(--text-muted)',
                          }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>
                          {item.value}
                        </span>
                        <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                          ({item.percentage}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Win/Loss summary statement */}
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                background: 'var(--bg)',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >
              Profit Factor: {kpis?.losingTrades > 0 ? (kpis.winningTrades / kpis.losingTrades).toFixed(2) : 'N/A'} win/loss count ratio across {totalTrades} trades.
            </div>
          </div>
        </div>
      )}

      {/* 6. Daily Performance Timeline */}
      {(!loading && dailyPerformance.length > 0) && (
        <section
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
          aria-labelledby="daily-perf-heading"
        >
          <div>
            <h3 id="daily-perf-heading" style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} color="var(--accent)" />
              Daily Performance Timeline
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Daily net P&L and trading volume across the active date range
            </p>
          </div>

          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ComposedChart data={dailyPerformance} margin={{ top: 10, right: 12, left: -6, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                  width={60}
                />
                <Tooltip content={<DailyBarTooltip />} />
                <Bar dataKey="netPnl" name="Daily Net P&L" radius={[4, 4, 0, 0]}>
                  {dailyPerformance.map((entry, index) => (
                    <Cell
                      key={`bar-${index}`}
                      fill={(entry.netPnl || 0) >= 0 ? '#16a34a' : '#dc2626'}
                    />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* 7. Dynamic Symbol / Market Analytics */}
      {(!loading && totalTrades > 0) && (
        <section
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
          aria-labelledby="symbol-perf-heading"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 id="symbol-perf-heading" style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Compass size={16} color="var(--accent)" />
                Dynamic Symbol & Market Performance
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Real instruments dynamically aggregated from actual platform trades
              </p>
            </div>

            {/* Top / Bottom Spotlight */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {data?.topSymbol && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: 'rgba(22, 163, 74, 0.1)',
                    border: '1px solid rgba(22, 163, 74, 0.25)',
                    fontSize: 12,
                  }}
                >
                  <ArrowUpRight size={14} color="var(--win)" />
                  <span style={{ color: 'var(--win)', fontWeight: 600 }}>
                    Top: {data.topSymbol.symbol} ({formatMoney(data.topSymbol.netPnl)})
                  </span>
                </div>
              )}
              {data?.bottomSymbol && data?.bottomSymbol !== data?.topSymbol && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid rgba(220, 38, 38, 0.25)',
                    fontSize: 12,
                  }}
                >
                  <ArrowDownRight size={14} color="var(--loss)" />
                  <span style={{ color: 'var(--loss)', fontWeight: 600 }}>
                    Low: {data.bottomSymbol.symbol} ({formatMoney(data.bottomSymbol.netPnl)})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Symbol Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 12px' }}>Symbol / Pair</th>
                  <th style={{ padding: '8px 12px' }}>Trades</th>
                  <th style={{ padding: '8px 12px' }}>W / L / BE</th>
                  <th style={{ padding: '8px 12px' }}>Win Rate</th>
                  <th style={{ padding: '8px 12px' }}>Avg Trade</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Net P&L</th>
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
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>
                      <span className="tag tag-neutral" style={{ fontSize: 11, padding: '2px 8px' }}>
                        {sym.symbol}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)' }}>
                      {sym.tradeCount}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--win)' }}>{sym.wins}W</span> •{' '}
                      <span style={{ color: 'var(--loss)' }}>{sym.losses}L</span> •{' '}
                      <span>{sym.breakeven}BE</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      <span style={{ color: sym.winRate >= 50 ? 'var(--win)' : 'var(--text)' }}>
                        {sym.winRate}%
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: sym.avgPnl >= 0 ? 'var(--win)' : 'var(--loss)' }}>
                        {formatMoney(sym.avgPnl)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      <span style={{ color: sym.netPnl >= 0 ? 'var(--win)' : 'var(--loss)' }}>
                        {formatMoney(sym.netPnl)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 8. Account Performance Breakdown */}
      {(!loading && totalTrades > 0) && (
        <section
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
          aria-labelledby="account-perf-heading"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 id="account-perf-heading" style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wallet size={16} color="var(--accent)" />
                Trading Account Performance
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                P&L distribution and win rates across connected trader accounts
              </p>
            </div>

            {/* Top Account Spotlight */}
            {data?.topAccount && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'rgba(22, 163, 74, 0.1)',
                  border: '1px solid rgba(22, 163, 74, 0.25)',
                  fontSize: 12,
                }}
              >
                <ArrowUpRight size={14} color="var(--win)" />
                <span style={{ color: 'var(--win)', fontWeight: 600 }}>
                  Top Account: {data.topAccount.name} ({formatMoney(data.topAccount.netPnl)})
                </span>
              </div>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 12px' }}>Account Name</th>
                  <th style={{ padding: '8px 12px' }}>Broker / Currency</th>
                  <th style={{ padding: '8px 12px' }}>Trades</th>
                  <th style={{ padding: '8px 12px' }}>Win Rate</th>
                  <th style={{ padding: '8px 12px' }}>Avg Trade</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Net P&L</th>
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
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>
                      {acc.name}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                      {acc.broker} ({acc.currency})
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)' }}>
                      {acc.tradeCount}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      <span style={{ color: acc.winRate >= 50 ? 'var(--win)' : 'var(--text)' }}>
                        {acc.winRate}%
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: acc.avgPnl >= 0 ? 'var(--win)' : 'var(--loss)' }}>
                        {formatMoney(acc.avgPnl)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      <span style={{ color: acc.netPnl >= 0 ? 'var(--win)' : 'var(--loss)' }}>
                        {formatMoney(acc.netPnl)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 9. Trading Behavior & Limitations */}
      {(!loading && totalTrades > 0) && (
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20,
          }}
          aria-labelledby="behavior-heading"
        >
          {/* Directional Analysis (Long vs Short) */}
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <h3 id="behavior-heading" style={{ fontSize: 15, fontWeight: 700 }}>
              Directional Bias (Long vs Short)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {behavior?.direction?.map((dir) => (
                <div
                  key={dir.direction}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <span className={dir.direction === 'Long' ? 'tag tag-win' : 'tag tag-red'} style={{ width: 'fit-content', fontSize: 11 }}>
                    {dir.direction}
                  </span>
                  <div style={{ fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: 4 }}>
                    {dir.tradeCount} <span style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 400 }}>trades</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Win Rate: <strong style={{ color: dir.winRate >= 50 ? 'var(--win)' : 'var(--text)' }}>{dir.winRate}%</strong>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Net P&L: <strong style={{ color: dir.netPnl >= 0 ? 'var(--win)' : 'var(--loss)' }}>{formatMoney(dir.netPnl)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Session Intelligence & Schema Limitations */}
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>
              Session Intelligence & Telemetry Limitations
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--bg)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: 12.5,
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  Active Trading Sessions
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {behavior?.session?.length
                    ? behavior.session.map((s) => `${s.session}: ${s.tradeCount} trades (${formatMoney(s.netPnl)})`).join(' • ')
                    : 'No session data in period'}
                </div>
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(113, 113, 122, 0.08)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}>
                  Holding Duration Telemetry
                </div>
                <div style={{ color: 'var(--text-faint)' }}>
                  Average holding duration: <strong>Not Available</strong>. Exit timestamps are optional in trade entry workflows and not consistently populated. Documented for future telemetry schema updates.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
