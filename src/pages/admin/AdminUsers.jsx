import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  Search,
  RefreshCw,
  Filter,
  Eye,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  X,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchUsers, fetchAdminMetrics, updateUserRole } from '../../lib/adminApi';
import RoleConfirmModal from '../../components/admin/RoleConfirmModal';
import UserDetailsDrawer from '../../components/admin/UserDetailsDrawer';

export default function AdminUsers() {
  const { user: authUser } = useAuth();
  const currentAdminId = authUser?.id;

  // Telemetry counts
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Users query state
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortField, setSortField] = useState('created_at');
  const [ascending, setAscending] = useState(false);

  // UI status
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Modal / Drawer state
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null); // { user, targetRole }
  const [updatingRole, setUpdatingRole] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Toast auto-clear
  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((cur) => (cur && cur.message === message ? null : cur));
    }, 4000);
  }, []);

  // Fetch metrics counts
  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const data = await fetchAdminMetrics();
      setMetrics(data?.users || null);
    } catch {
      // Non-fatal, metrics will fall back to table count
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  // Fetch paginated user list
  const loadUsers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const result = await fetchUsers({
        page,
        pageSize,
        search: debouncedSearch,
        role: roleFilter,
        sort: sortField,
        ascending,
      });

      setUsers(result.users);
      setTotalUsers(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(err?.message || 'Failed to load user records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, pageSize, debouncedSearch, roleFilter, sortField, ascending]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Handle role change execution
  async function handleConfirmRoleChange(userId, targetRole) {
    setUpdatingRole(true);
    try {
      const updated = await updateUserRole(userId, targetRole, currentAdminId);

      // Refresh data
      await Promise.all([loadUsers(true), loadMetrics()]);

      // If drawer is open on this user, update drawer's user state
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser(updated);
      }

      const roleName = targetRole === 'admin' ? 'Administrator' : 'Standard User';
      showToast('success', `Successfully updated ${updated.fullName || updated.email} to ${roleName}.`);
      setConfirmTarget(null);
    } catch (err) {
      showToast('error', err?.message || 'Failed to update user role.');
    } finally {
      setUpdatingRole(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              padding: '12px 18px',
              borderRadius: 'var(--radius-sm)',
              background: toast.type === 'success' ? 'rgba(47, 214, 110, 0.15)' : 'rgba(220, 38, 38, 0.15)',
              border: `1px solid ${toast.type === 'success' ? 'rgba(47, 214, 110, 0.3)' : 'rgba(220, 38, 38, 0.3)'}`,
              color: toast.type === 'success' ? 'var(--win)' : 'var(--loss)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 13.5,
              fontWeight: 500,
            }}
            role="status"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="btn btn-ghost btn-sm"
              style={{ padding: 4, color: 'inherit' }}
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Cards */}
      <section aria-label="User summary metrics">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {/* Total Users */}
          <div className="card" style={{ padding: 18 }}>
            <span className="drawer-label" style={{ fontSize: 11 }}>Total Registered Users</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              {metricsLoading ? (
                <div style={{ width: 50, height: 28, background: 'rgba(255,255,255,0.06)', borderRadius: 6 }} />
              ) : (
                <span style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {metrics?.total ?? totalUsers}
                </span>
              )}
              <span className="tag tag-neutral" style={{ fontSize: 10 }}>Total</span>
            </div>
          </div>

          {/* Total Administrators */}
          <div className="card" style={{ padding: 18 }}>
            <span className="drawer-label" style={{ fontSize: 11 }}>Administrators</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              {metricsLoading ? (
                <div style={{ width: 40, height: 28, background: 'rgba(255,255,255,0.06)', borderRadius: 6 }} />
              ) : (
                <span style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--red)' }}>
                  {metrics?.admins ?? '—'}
                </span>
              )}
              <span className="tag tag-red" style={{ fontSize: 10 }}>Admin</span>
            </div>
          </div>

          {/* Standard Users */}
          <div className="card" style={{ padding: 18 }}>
            <span className="drawer-label" style={{ fontSize: 11 }}>Standard Traders</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              {metricsLoading ? (
                <div style={{ width: 50, height: 28, background: 'rgba(255,255,255,0.06)', borderRadius: 6 }} />
              ) : (
                <span style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {metrics?.standard ?? '—'}
                </span>
              )}
              <span className="tag tag-win" style={{ fontSize: 10 }}>Trader</span>
            </div>
          </div>
        </div>
      </section>

      {/* Toolbar: Search, Filters, Refresh */}
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
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 380 }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }}
          />
          <input
            type="search"
            placeholder="Search by name, email, or username…"
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
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', padding: 4 }}
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filters & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Role Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
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
              aria-label="Filter by role"
            >
              <option value="all">All Roles</option>
              <option value="admin">Administrators</option>
              <option value="user">Standard Users</option>
            </select>
          </div>

          {/* Page Size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: 12.5,
              }}
              aria-label="Rows per page"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadUsers(true)}
            disabled={loading || refreshing}
            className="btn btn-ghost btn-sm"
            style={{ border: '1px solid var(--border)', padding: '7px 12px', gap: 6 }}
            aria-label="Refresh user list"
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
          <button onClick={() => loadUsers()} className="btn btn-sm btn-ghost" style={{ border: '1px solid var(--border)' }}>
            Retry
          </button>
        </div>
      )}

      {/* Users Table / List */}
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
        ) : users.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
              {debouncedSearch || roleFilter !== 'all' ? 'No matching users found' : 'No users available'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 4 }}>
              {debouncedSearch || roleFilter !== 'all'
                ? 'Try adjusting your search terms or clearing role filters.'
                : 'Registered user profiles will be listed here.'}
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
                  <th style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11.5 }}>
                    USER
                  </th>
                  <th style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11.5 }}>
                    EMAIL
                  </th>
                  <th style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11.5 }}>
                    ROLE
                  </th>
                  <th style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11.5 }}>
                    REGISTERED
                  </th>
                  <th style={{ padding: '12px 18px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11.5, textAlign: 'right' }}>
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === currentAdminId;
                  const isAdmin = u.role === 'admin';

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        transition: 'background 0.12s ease',
                      }}
                    >
                      {/* Name & Avatar */}
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt={u.fullName || 'User'}
                              style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                background: isAdmin
                                  ? 'linear-gradient(135deg, var(--red), var(--red-strong))'
                                  : 'rgba(255,255,255,0.06)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#fff',
                              }}
                            >
                              {(u.fullName || u.email || 'U')[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--text)', display: 'block' }}>
                              {u.fullName || 'Anonymous User'}
                            </span>
                            {u.username && (
                              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                                @{u.username}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td style={{ padding: '12px 18px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {u.email}
                      </td>

                      {/* Role Badge */}
                      <td style={{ padding: '12px 18px' }}>
                        <span className={isAdmin ? 'tag tag-red' : 'tag tag-neutral'} style={{ fontSize: 10.5 }}>
                          {isAdmin ? 'Administrator' : 'Standard'}
                        </span>
                      </td>

                      {/* Created At */}
                      <td style={{ padding: '12px 18px', color: 'var(--text-faint)', fontSize: 12 }}>
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }) : '—'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {/* View Details */}
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '6px 10px', fontSize: 12 }}
                            title="View full profile"
                            aria-label={`View details for ${u.fullName || u.email}`}
                          >
                            <Eye size={14} />
                            <span>Details</span>
                          </button>

                          {/* Role Toggle Button */}
                          {isSelf ? (
                            <span
                              style={{
                                fontSize: 11,
                                color: 'var(--text-faint)',
                                padding: '5px 8px',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: 'var(--radius-sm)',
                              }}
                              title="Current Administrator (Self-demotion restricted)"
                            >
                              Current Admin
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmTarget({ user: u, targetRole: isAdmin ? 'user' : 'admin' })}
                              className="btn btn-ghost btn-sm"
                              style={{
                                padding: '6px 10px',
                                fontSize: 12,
                                color: isAdmin ? '#eab308' : 'var(--red)',
                                border: '1px solid var(--border)',
                              }}
                              title={isAdmin ? 'Demote to Standard User' : 'Promote to Administrator'}
                              aria-label={isAdmin ? `Demote ${u.fullName || u.email}` : `Promote ${u.fullName || u.email}`}
                            >
                              <ShieldCheck size={14} />
                              <span>{isAdmin ? 'Demote' : 'Promote'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
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
            Showing {totalUsers === 0 ? 0 : (page - 1) * pageSize + 1} to{' '}
            {Math.min(page * pageSize, totalUsers)} of {totalUsers} user{totalUsers === 1 ? '' : 's'}
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

      {/* Role Change Confirmation Modal */}
      <RoleConfirmModal
        open={!!confirmTarget}
        user={confirmTarget?.user}
        targetRole={confirmTarget?.targetRole}
        loading={updatingRole}
        onConfirm={handleConfirmRoleChange}
        onClose={() => setConfirmTarget(null)}
      />

      {/* User Details Drawer */}
      <UserDetailsDrawer
        open={!!selectedUser}
        user={selectedUser}
        currentAdminId={currentAdminId}
        onClose={() => setSelectedUser(null)}
        onRequestRoleChange={(user, targetRole) => {
          setConfirmTarget({ user, targetRole });
        }}
      />
    </div>
  );
}
