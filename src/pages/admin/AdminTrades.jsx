import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CandlestickChart,
  Search,
  RefreshCw,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { fetchAdminTrades, fetchAdminTradeMetrics } from '../../lib/adminApi';

const RESULT_CONFIG = {
  Win: { tagClass: 'tag-win', label: 'Win' },
  Loss: { tagClass: 'tag-red', label: 'Loss' },
  Breakeven: { tagClass: 'tag-neutral', label: 'BE' },
};

function PnLCell({ value }) {
  if (value === '' || value === null || value === undefined) {
    return <span style={{ color: 'var(--text-faint)' }}>—</span>;
  }
  const num = Number(value);
  if (isNaN(num)) return <span style={{ color: 'var(--text-faint)' }}>—</span>;

  const isPos = num > 0;
  const isNeg = num < 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {isPos && <TrendingUp size={12} color="var(--win)" />}
      {isNeg && <TrendingDown size={12} color="var(--loss)" />}
      {!isPos && !isNeg && <Minus size={12} color="var(--text-faint)" />}
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12.5,
          fontWeight: 600,
          color: isPos ? 'var(--win)' : isNeg ? 'var(--loss)' : 'var(--text-faint)',
        }}
      >
        {isPos ? '+' : ''}
        {num.toFixed(2)}
      </span>
    </div>
  );
}

export default function AdminTrades() {
  // Metrics state
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Trades query state
  const [trades, setTrades] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const [sortField, setSortField] = useState('date');
  const [ascending, setAscending] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch metrics
  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const data = await fetchAdminTradeMetrics();
      setMetrics(data);
    } catch {
      // Non-fatal
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  // Fetch trades
  const loadTrades = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const result = await fetchAdminTrades({
          page,
          pageSize,
          search: debouncedSearch,
          result: resultFilter,
          sort: sortField,
          ascending,
        });
        setTrades(result.trades);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } catch (err) {
        setError(err?.message || 'Failed to load trades.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, pageSize, debouncedSearch, resultFilter, sortField, ascending]
  );

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  function handleSort(field) {
    if (sortField === field) {
      setAscending((a) => !a);
    } else {
      setSortField(field);
      setAscending(false);
    }
    setPage(1);
  }

  const SortIcon = ({ field }) => (
    <span style={{ marginLeft: 3, opacity: sortField === field ? 1 : 0.3, fontSize: 10 }}>
      {sortField === field ? (ascending ? '↑' : '↓') : '↕'}
    </span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Summary Cards */}
      <section aria-label="Trade summary metrics">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
          }}
        >
          {[
            { label: 'Total Trades', key: 'total', tagClass: 'tag-neutral', tagText: 'All' },
            { label: 'Wins', key: 'wins', tagClass: 'tag-win', tagText: 'Win' },
            { label: 'Losses', key: 'losses', tagClass: 'tag-red', tagText: 'Loss' },
            { label: 'Breakeven', key: 'breakeven', tagClass: 'tag-neutral', tagText: 'BE' },
            { label: 'Win Rate', key: 'winRate', tagClass: 'tag-win', tagText: '%', isPercent: true },
          ].map(({ label, key, tagClass, tagText, isPercent }) => (
            <div key={key} className="card" style={{ padding: 18 }}>
              <span className="drawer-label" style={{ fontSize: 11 }}>
                {label}
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                {metricsLoading ? (
                  <div style={{ width: 44, height: 28, background: 'rgba(255,255,255,0.06)', borderRadius: 6 }} />
                ) : (
                  <span style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {metrics?.[key] ?? '—'}
                    {isPercent && metrics?.[key] != null ? '%' : ''}
                  </span>
                )}
                <span className={`tag ${tagClass}`} style={{ fontSize: 10 }}>
                  {tagText}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Toolbar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 380 }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-faint)',
            }}
          />
          <input
            type="search"
            placeholder="Search by instrument, model, or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 34px 9px 36px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'var(--font-body)',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="btn btn-ghost btn-sm"
              style={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                padding: 4,
              }}
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filters & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Result:</span>
            <select
              value={resultFilter}
              onChange={(e) => {
                setResultFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: 12.5,
              }}
              aria-label="Filter by result"
            >
              <option value="all">All Results</option>
              <option value="Win">Wins</option>
              <option value="Loss">Losses</option>
              <option value="Breakeven">Breakeven</option>
            </select>
          </div>

          <button
            onClick={() => loadTrades(true)}
            disabled={loading || refreshing}
            className="btn btn-ghost btn-sm"
            style={{ border: '1px solid var(--border)', padding: '7px 12px', gap: 6 }}
            aria-label="Refresh trade list"
          >
            <RefreshCw
              size={13}
              style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
          role="alert"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={20} color="var(--loss)" />
            <span style={{ fontSize: 13.5, color: 'var(--text)' }}>{error}</span>
          </div>
          <button
            onClick={() => loadTrades()}
            className="btn btn-sm btn-ghost"
            style={{ border: '1px solid var(--border)' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Trades Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{ height: 48, borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}
              />
            ))}
          </div>
        ) : trades.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <CandlestickChart size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
              {debouncedSearch || resultFilter !== 'all'
                ? 'No matching trades found'
                : 'No trades on platform'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 4 }}>
              {debouncedSearch || resultFilter !== 'all'
                ? 'Try adjusting your search or clearing filters.'
                : 'Platform trade records will appear here once traders log their trades.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: 13,
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: 'rgba(255, 255, 255, 0.02)',
                  }}
                >
                  {[
                    { label: 'DATE', field: 'date' },
                    { label: 'INSTRUMENT', field: 'instrument' },
                    { label: 'DIRECTION', field: 'direction' },
                    { label: 'SESSION', field: 'session' },
                    { label: 'RESULT', field: 'result' },
                    { label: 'NET P&L', field: 'net_pnl' },
                    { label: 'R:R', field: 'rr' },
                    { label: 'RISK %', field: 'risk_percent' },
                    { label: 'MODEL', field: 'model' },
                  ].map(({ label, field }) => (
                    <th
                      key={label}
                      onClick={field ? () => handleSort(field) : undefined}
                      style={{
                        padding: '12px 18px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        fontSize: 11.5,
                        cursor: field ? 'pointer' : 'default',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                      {field && <SortIcon field={field} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {trades.map((trade) => {
                    const resultCfg = RESULT_CONFIG[trade.result] || RESULT_CONFIG.Win;
                    const isLong = trade.direction?.toLowerCase() === 'long';
                    return (
                      <motion.tr
                        key={trade.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.12s ease',
                        }}
                      >
                        {/* Date */}
                        <td style={{ padding: '12px 18px', color: 'var(--text-faint)', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {trade.date
                            ? new Date(trade.date).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>

                        {/* Instrument */}
                        <td style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                          {trade.instrument || '—'}
                        </td>

                        {/* Direction */}
                        <td style={{ padding: '12px 18px' }}>
                          {trade.direction ? (
                            <span
                              className={isLong ? 'tag tag-win' : 'tag tag-red'}
                              style={{ fontSize: 10.5 }}
                            >
                              {isLong ? '▲ Long' : '▼ Short'}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-faint)' }}>—</span>
                          )}
                        </td>

                        {/* Session */}
                        <td style={{ padding: '12px 18px', color: 'var(--text-muted)', fontSize: 12 }}>
                          {trade.session || '—'}
                        </td>

                        {/* Result */}
                        <td style={{ padding: '12px 18px' }}>
                          <span className={`tag ${resultCfg.tagClass}`} style={{ fontSize: 10.5 }}>
                            {resultCfg.label}
                          </span>
                        </td>

                        {/* Net P&L */}
                        <td style={{ padding: '12px 18px' }}>
                          <PnLCell value={trade.netPnl} />
                        </td>

                        {/* R:R */}
                        <td
                          style={{
                            padding: '12px 18px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 12,
                            color: 'var(--text-muted)',
                          }}
                        >
                          {trade.rr !== '' && trade.rr != null ? `${Number(trade.rr).toFixed(2)}R` : '—'}
                        </td>

                        {/* Risk % */}
                        <td
                          style={{
                            padding: '12px 18px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 12,
                            color: 'var(--text-muted)',
                          }}
                        >
                          {trade.riskPercent !== '' && trade.riskPercent != null
                            ? `${Number(trade.riskPercent).toFixed(1)}%`
                            : '—'}
                        </td>

                        {/* Model */}
                        <td style={{ padding: '12px 18px', color: 'var(--text-muted)', fontSize: 12, maxWidth: 180 }}>
                          <span
                            style={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {trade.model || '—'}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            Showing {total === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of{' '}
            {total} trade{total === 1 ? '' : 's'}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="btn btn-ghost btn-sm"
              style={{ padding: '6px 10px', border: '1px solid var(--border)' }}
              aria-label="Previous page"
            >
              <ChevronLeft size={15} />
              <span>Previous</span>
            </button>

            <span style={{ fontSize: 12.5, color: 'var(--text-faint)', padding: '0 4px' }}>
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="btn btn-ghost btn-sm"
              style={{ padding: '6px 10px', border: '1px solid var(--border)' }}
              aria-label="Next page"
            >
              <span>Next</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
