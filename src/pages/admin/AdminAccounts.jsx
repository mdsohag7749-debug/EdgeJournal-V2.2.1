import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  Search,
  RefreshCw,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Archive,
  Circle,
} from 'lucide-react';
import { fetchAdminAccounts, fetchAdminAccountMetrics } from '../../lib/adminApi';

const STATUS_CONFIG = {
  active: { label: 'Active', tagClass: 'tag-win', icon: Circle },
  inactive: { label: 'Inactive', tagClass: 'tag-neutral', icon: Circle },
  archived: { label: 'Archived', tagClass: 'tag-red', icon: Archive },
};

function formatCurrency(amount, currency = 'USD') {
  if (amount == null || amount === '') return '—';
  const num = Number(amount);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function PnLIndicator({ starting, current, currency }) {
  if (starting == null || current == null) return <span style={{ color: 'var(--text-faint)' }}>—</span>;
  const diff = Number(current) - Number(starting);
  const isPositive = diff >= 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {isPositive ? (
        <TrendingUp size={13} color="var(--win)" />
      ) : (
        <TrendingDown size={13} color="var(--loss)" />
      )}
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12.5,
          color: isPositive ? 'var(--win)' : 'var(--loss)',
          fontWeight: 600,
        }}
      >
        {isPositive ? '+' : ''}
        {formatCurrency(diff, currency)}
      </span>
    </div>
  );
}

export default function AdminAccounts() {
  // Metrics state
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Accounts query state
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('created_at');
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
      const data = await fetchAdminAccountMetrics();
      setMetrics(data);
    } catch {
      // Non-fatal
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  // Fetch accounts
  const loadAccounts = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const result = await fetchAdminAccounts({
          page,
          pageSize,
          search: debouncedSearch,
          status: statusFilter,
          sort: sortField,
          ascending,
        });
        setAccounts(result.accounts);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } catch (err) {
        setError(err?.message || 'Failed to load trading accounts.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, pageSize, debouncedSearch, statusFilter, sortField, ascending]
  );

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

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
      <section aria-label="Account summary metrics">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          {[
            { label: 'Total Accounts', key: 'total', tagClass: 'tag-neutral', tagText: 'All' },
            { label: 'Active', key: 'active', tagClass: 'tag-win', tagText: 'Active' },
            { label: 'Inactive', key: 'inactive', tagClass: 'tag-neutral', tagText: 'Inactive' },
            { label: 'Archived', key: 'archived', tagClass: 'tag-red', tagText: 'Archived' },
          ].map(({ label, key, tagClass, tagText }) => (
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
            placeholder="Search by name, broker, or platform…"
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
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
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
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <button
            onClick={() => loadAccounts(true)}
            disabled={loading || refreshing}
            className="btn btn-ghost btn-sm"
            style={{ border: '1px solid var(--border)', padding: '7px 12px', gap: 6 }}
            aria-label="Refresh account list"
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
            onClick={() => loadAccounts()}
            className="btn btn-sm btn-ghost"
            style={{ border: '1px solid var(--border)' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Accounts Table */}
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
        ) : accounts.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Wallet size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
              {debouncedSearch || statusFilter !== 'all'
                ? 'No matching accounts found'
                : 'No trading accounts on platform'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 4 }}>
              {debouncedSearch || statusFilter !== 'all'
                ? 'Try adjusting your search or clearing filters.'
                : 'Platform trading accounts will appear here once users create them.'}
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
                    { label: 'ACCOUNT', field: 'name' },
                    { label: 'BROKER / PLATFORM', field: 'broker' },
                    { label: 'STATUS', field: 'status' },
                    { label: 'BALANCE', field: 'current_balance' },
                    { label: 'P&L', field: null },
                    { label: 'CURRENCY', field: 'currency' },
                    { label: 'CREATED', field: 'created_at' },
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
                  {accounts.map((acc) => {
                    const statusCfg = STATUS_CONFIG[acc.status] || STATUS_CONFIG.active;
                    return (
                      <motion.tr
                        key={acc.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.12s ease',
                        }}
                      >
                        {/* Account Name */}
                        <td style={{ padding: '12px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                background:
                                  acc.status === 'active'
                                    ? 'linear-gradient(135deg, rgba(47,214,110,0.2), rgba(47,214,110,0.05))'
                                    : 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Wallet size={13} color={acc.status === 'active' ? 'var(--win)' : 'var(--text-faint)'} />
                            </div>
                            <div>
                              <span
                                style={{ fontWeight: 600, color: 'var(--text)', display: 'block', fontSize: 13 }}
                              >
                                {acc.name || 'Unnamed Account'}
                              </span>
                              {acc.isDefault && (
                                <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Default</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Broker / Platform */}
                        <td style={{ padding: '12px 18px', color: 'var(--text-muted)', fontSize: 12 }}>
                          <div>
                            {acc.broker && (
                              <span style={{ display: 'block', fontWeight: 500, color: 'var(--text)' }}>
                                {acc.broker}
                              </span>
                            )}
                            {acc.platform && (
                              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{acc.platform}</span>
                            )}
                            {!acc.broker && !acc.platform && (
                              <span style={{ color: 'var(--text-faint)' }}>—</span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '12px 18px' }}>
                          <span className={`tag ${statusCfg.tagClass}`} style={{ fontSize: 10.5 }}>
                            {statusCfg.label}
                          </span>
                        </td>

                        {/* Balance */}
                        <td
                          style={{
                            padding: '12px 18px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: 'var(--text)',
                          }}
                        >
                          {formatCurrency(acc.currentBalance, acc.currency)}
                        </td>

                        {/* P&L */}
                        <td style={{ padding: '12px 18px' }}>
                          <PnLIndicator
                            starting={acc.startingBalance}
                            current={acc.currentBalance}
                            currency={acc.currency}
                          />
                        </td>

                        {/* Currency */}
                        <td
                          style={{
                            padding: '12px 18px',
                            color: 'var(--text-faint)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 12,
                          }}
                        >
                          {acc.currency || 'USD'}
                        </td>

                        {/* Created At */}
                        <td style={{ padding: '12px 18px', color: 'var(--text-faint)', fontSize: 12 }}>
                          {acc.createdAt
                            ? new Date(acc.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
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
            {total} account{total === 1 ? '' : 's'}
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
