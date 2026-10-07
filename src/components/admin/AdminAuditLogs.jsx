import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScrollText,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Calendar,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  User,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { fetchAdminAuditLogs } from '../../lib/adminApi';

const ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'export_trades_csv', label: 'export_trades_csv' },
  { value: 'update_user_role', label: 'update_user_role' },
  { value: 'view_report', label: 'view_report' },
  { value: 'system_setting.update', label: 'system_setting.update' },
];

const RESOURCE_OPTIONS = [
  { value: 'all', label: 'All Resources' },
  { value: 'trades', label: 'trades' },
  { value: 'users', label: 'users' },
  { value: 'reports', label: 'reports' },
  { value: 'profiles', label: 'profiles' },
  { value: 'system_setting', label: 'system_setting' },
];

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
];

function formatAuditTimestamp(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function MetadataCell({ metadata }) {
  const [expanded, setExpanded] = useState(false);

  if (!metadata || Object.keys(metadata).length === 0) {
    return <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>None</span>;
  }

  const keys = Object.keys(metadata);
  const summaryText = keys
    .slice(0, 2)
    .map((k) => `${k}: ${String(metadata[k])}`)
    .join(', ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {summaryText}
          {keys.length > 2 ? '...' : ''}
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="btn btn-ghost btn-sm"
          style={{ padding: '2px 6px', fontSize: 11, height: 'auto' }}
          aria-label={expanded ? 'Collapse metadata' : 'Expand metadata'}
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {expanded && (
        <pre
          style={{
            margin: '4px 0 0 0',
            padding: '8px 10px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontSize: 11,
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            maxHeight: 120,
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AdminAuditLogs() {
  // Query parameters state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');

  // Query response state
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Fetch audit logs
  const loadLogs = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const result = await fetchAdminAuditLogs({
          page,
          pageSize,
          search,
          action: actionFilter,
          resourceType: resourceFilter,
          dateRange,
        });

        setLogs(result.logs || []);
        setTotal(result.total || 0);
        setTotalPages(result.totalPages || 1);
      } catch (err) {
        setError(err?.message || 'Failed to load audit logs.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, pageSize, search, actionFilter, resourceFilter, dateRange]
  );

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Reset to page 1 on filter changes
  const handleActionChange = (val) => {
    setActionFilter(val);
    setPage(1);
  };

  const handleResourceChange = (val) => {
    setResourceFilter(val);
    setPage(1);
  };

  const handleDateRangeChange = (val) => {
    setDateRange(val);
    setPage(1);
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} data-testid="admin-audit-logs-page">
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
          {/* Section Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={18} color="var(--red)" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                Administrative Audit Ledger
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Append-only log of sensitive platform administrative operations
              </div>
            </div>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => loadLogs(true)}
            disabled={loading || refreshing}
            className="btn btn-ghost btn-sm"
            style={{
              fontSize: 12.5,
              border: '1px solid var(--border)',
              padding: '6px 12px',
              gap: 6,
            }}
            aria-label="Refresh audit logs"
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

        {/* Filter controls row */}
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
          {/* Search Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '6px 12px',
              minWidth: 240,
              flex: 1,
              maxWidth: 360,
            }}
          >
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search action or resource..."
              aria-label="Search audit logs"
              value={search}
              onChange={handleSearchChange}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text)',
                fontSize: 12.5,
                width: '100%',
                outline: 'none',
              }}
            />
          </div>

          {/* Dropdown Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Action Filter */}
            <select
              aria-label="Filter by action"
              value={actionFilter}
              onChange={(e) => handleActionChange(e.target.value)}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Resource Filter */}
            <select
              aria-label="Filter by resource type"
              value={resourceFilter}
              onChange={(e) => handleResourceChange(e.target.value)}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {RESOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Date Range Filter */}
            <select
              aria-label="Filter by date range"
              value={dateRange}
              onChange={(e) => handleDateRangeChange(e.target.value)}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {DATE_RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Total Count Badge */}
            <span
              className="tag tag-neutral"
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              {total} Total Events
            </span>
          </div>
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
            onClick={() => loadLogs()}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 12, color: 'var(--loss)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Audit Log Table / Empty State / Loading */}
      {loading ? (
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-bar" style={{ height: 32, width: '100%' }} />
          ))}
        </div>
      ) : logs.length === 0 ? (
        /* Honest empty audit history state */
        <div
          style={{
            padding: '56px 24px',
            textAlign: 'center',
            background: 'var(--bg-elevated)',
            borderRadius: 12,
            border: '1px dashed var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
          data-testid="audit-empty-state"
        >
          <ScrollText size={36} color="var(--text-muted)" />
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>No audit events recorded yet.</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 480 }}>
            The administrative audit architecture records genuine administrative events as they occur in real time. Historical actions that took place prior to the audit infrastructure are not fabricated.
          </p>
          {(actionFilter !== 'all' || resourceFilter !== 'all' || search || dateRange !== 'all') && (
            <button
              onClick={() => {
                setActionFilter('all');
                setResourceFilter('all');
                setSearch('');
                setDateRange('all');
              }}
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 6, border: '1px solid var(--border)' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        /* Audit Events Table */
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
                    Timestamp
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Actor
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Action
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Resource Type
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Resource ID
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Metadata
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {/* Timestamp */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {formatAuditTimestamp(log.createdAt)}
                    </td>

                    {/* Actor */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{log.actor?.fullName || 'Admin'}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                          {log.actor?.email || log.actorUserId || '—'}
                        </span>
                      </div>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        className="tag tag-red"
                        style={{ fontSize: 11, padding: '3px 8px', letterSpacing: '0.02em' }}
                      >
                        {log.action}
                      </span>
                    </td>

                    {/* Resource Type */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        className="tag tag-neutral"
                        style={{ fontSize: 11, padding: '2px 6px' }}
                      >
                        {log.resourceType}
                      </span>
                    </td>

                    {/* Resource ID */}
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                      {log.resourceId || '—'}
                    </td>

                    {/* Metadata */}
                    <td style={{ padding: '12px 16px', maxWidth: 300 }}>
                      <MetadataCell metadata={log.metadata} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 4. Pagination Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg)',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Showing {logs.length > 0 ? (page - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(page * pageSize, total)} of {total} events
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn btn-ghost btn-sm"
                aria-label="Previous Page"
                style={{ padding: '4px 8px', fontSize: 12 }}
              >
                <ChevronLeft size={14} />
                Prev
              </button>

              <span style={{ fontSize: 12, color: 'var(--text)', padding: '0 4px' }}>
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn btn-ghost btn-sm"
                aria-label="Next Page"
                style={{ padding: '4px 8px', fontSize: 12 }}
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
