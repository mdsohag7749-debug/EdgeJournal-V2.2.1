import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Users,
  Layers,
  Calendar,
  Check,
  X,
  Shield,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  fetchAdminPlans,
  createAdminPlan,
  updateAdminPlan,
  fetchAdminSubscriptions,
  assignAdminSubscription,
  fetchAdminSubscriptionMetrics,
  fetchUsers,
} from '../../lib/adminApi';
import {
  KNOWN_FEATURES,
  DEFAULT_FREE_PLAN,
  formatPlanPrice,
} from '../../lib/entitlements';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
];

function formatDate(isoString) {
  if (!isoString) return 'Never / None';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AdminSubscriptions() {
  const [activeTab, setActiveTab] = useState('plans'); // 'plans' | 'subscriptions'
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(null);

  const [subscriptions, setSubscriptions] = useState([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [subsError, setSubsError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalSubs, setTotalSubs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  // Modal states
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null); // null = create new
  const [planForm, setPlanForm] = useState({
    name: '',
    slug: '',
    description: '',
    price: 0,
    currency: 'USD',
    billingInterval: 'monthly',
    isActive: true,
    features: ['journal', 'analytics'],
    limits: { accounts: 1, trades: 500, screenshots_per_trade: 5 },
  });
  const [savingPlan, setSavingPlan] = useState(false);

  // Assign Subscription Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [targetSub, setTargetSub] = useState(null);
  const [assignForm, setAssignForm] = useState({
    userId: '',        // used when creating a new subscription (no existing sub)
    planId: '',
    status: 'active',
    expiresAt: '',
  });
  const [assigning, setAssigning] = useState(false);

  // User list for the "Assign to new user" dropdown
  const [allUsers, setAllUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);
  const [userSearch, setUserSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((cur) => (cur && cur.message === message ? null : cur));
    }, 4000);
  }, []);

  // Fetch Metrics
  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const data = await fetchAdminSubscriptionMetrics();
      setMetrics(data);
    } catch (err) {
      console.warn('Metrics load note:', err);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  // Fetch Plans
  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const data = await fetchAdminPlans();
      setPlans(data);
    } catch (err) {
      setPlansError(err?.message || 'Failed to load platform plans.');
    } finally {
      setPlansLoading(false);
    }
  }, []);

  // Fetch Subscriptions
  const loadSubscriptions = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setSubsLoading(true);
      setSubsError(null);

      try {
        const result = await fetchAdminSubscriptions({
          page,
          pageSize,
          status: statusFilter,
          planId: planFilter,
          search: debouncedSearch,
        });
        setSubscriptions(result.subscriptions);
        setTotalSubs(result.total);
        setTotalPages(result.totalPages);
      } catch (err) {
        setSubsError(err?.message || 'Failed to load subscriptions.');
      } finally {
        setSubsLoading(false);
        setRefreshing(false);
      }
    },
    [page, pageSize, statusFilter, planFilter, debouncedSearch]
  );

  // Fetch user list for new-subscription assignment
  const loadAllUsers = useCallback(async (search = '') => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const result = await fetchUsers({ page: 1, pageSize: 50, search, role: 'all' });
      setAllUsers(result.users || []);
    } catch (err) {
      setAllUsers([]);
      setUsersError(err?.message || 'Failed to load users for subscription assignment.');
      console.warn('Could not load users for assignment selector:', err?.message);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
    loadPlans();
  }, [loadMetrics, loadPlans]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    await Promise.all([loadMetrics(), loadPlans(), loadSubscriptions(true)]);
    setRefreshing(false);
    showToast('success', 'Subscription telemetry updated.');
  };

  // Open Create Plan Modal
  const handleOpenCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm({
      name: '',
      slug: '',
      description: '',
      price: 0,
      currency: 'USD',
      billingInterval: 'monthly',
      isActive: true,
      features: ['journal', 'analytics'],
      limits: { accounts: 1, trades: 500, screenshots_per_trade: 5 },
    });
    setIsPlanModalOpen(true);
  };

  // Open Edit Plan Modal
  const handleOpenEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      price: plan.price,
      currency: plan.currency || 'USD',
      billingInterval: plan.billingInterval || 'monthly',
      isActive: plan.isActive,
      features: Array.isArray(plan.features) ? [...plan.features] : [],
      limits: {
        accounts: plan.limits?.accounts ?? 1,
        trades: plan.limits?.trades ?? 500,
        screenshots_per_trade: plan.limits?.screenshots_per_trade ?? 5,
      },
    });
    setIsPlanModalOpen(true);
  };

  // Submit Plan Form (Create or Update)
  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!planForm.name.trim()) {
      showToast('error', 'Plan name cannot be blank.');
      return;
    }
    if (!editingPlan && !planForm.slug.trim()) {
      showToast('error', 'Plan slug cannot be blank.');
      return;
    }

    setSavingPlan(true);
    try {
      if (editingPlan) {
        await updateAdminPlan(editingPlan.id, planForm);
        showToast('success', `Plan "${planForm.name}" updated successfully.`);
      } else {
        await createAdminPlan(planForm);
        showToast('success', `Plan "${planForm.name}" created successfully.`);
      }
      setIsPlanModalOpen(false);
      loadPlans();
      loadMetrics();
    } catch (err) {
      showToast('error', err?.message || 'Failed to save plan.');
    } finally {
      setSavingPlan(false);
    }
  };

  // Toggle Plan Active State
  const handleTogglePlanActive = async (plan) => {
    try {
      const nextActive = !plan.isActive;
      await updateAdminPlan(plan.id, { isActive: nextActive });
      showToast(
        'success',
        `Plan "${plan.name}" ${nextActive ? 'activated' : 'deactivated'} successfully.`
      );
      loadPlans();
      loadMetrics();
    } catch (err) {
      showToast('error', err?.message || 'Failed to update plan status.');
    }
  };

  // Open Assign Subscription Modal for an EXISTING subscription (Change Plan)
  const handleOpenAssignModal = (sub) => {
    setTargetSub(sub);
    setUserSearch('');
    setAssignForm({
      userId: sub.userId || '',
      planId: sub.planId || (plans[0]?.id || ''),
      status: sub.status || 'active',
      expiresAt: sub.expiresAt ? sub.expiresAt.slice(0, 10) : '',
    });
    setIsAssignModalOpen(true);
  };

  // Open Assign Subscription Modal for a NEW assignment (no existing sub)
  const handleOpenNewAssignModal = () => {
    setTargetSub(null);
    setUserSearch('');
    setUsersError(null);
    setAssignForm({
      userId: '',
      planId: plans[0]?.id || '',
      status: 'active',
      expiresAt: '',
    });
    setIsAssignModalOpen(true);
    loadAllUsers();
  };

  // Save Subscription Assignment (covers both new-assign and change-plan flows)
  const handleSaveSubscription = async (e) => {
    e.preventDefault();

    // New assignment: require a user to be selected
    if (!targetSub && !assignForm.userId) {
      showToast('error', 'Please select a user to assign the subscription to.');
      return;
    }
    if (!assignForm.planId) {
      showToast('error', 'Please select a plan.');
      return;
    }

    setAssigning(true);
    try {
      const expiresAtPayload = assignForm.expiresAt
        ? new Date(assignForm.expiresAt).toISOString()
        : null;

      const userId = targetSub?.userId || assignForm.userId;
      await assignAdminSubscription({
        userId,
        planId: assignForm.planId,
        status: assignForm.status,
        expiresAt: expiresAtPayload,
      });
      const selectedUser = targetSub?.user || allUsers.find((u) => u.id === userId);
      showToast(
        'success',
        `Subscription ${targetSub ? 'updated for' : 'assigned to'} ${selectedUser?.email || userId}.`
      );

      setIsAssignModalOpen(false);
      loadSubscriptions();
      loadMetrics();
    } catch (err) {
      showToast('error', err?.message || 'Failed to update user subscription.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Informational Scope Notice */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-elevated)',
          borderLeft: '4px solid var(--accent)',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Sparkles size={20} color="var(--accent)" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              Phase 7 Entitlement Architecture
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              EdgeJournal manages internal tier entitlements and operational plan limits.
              External payment gateways (Stripe/PayPal) are not enabled in this phase.
            </div>
          </div>
        </div>
        <button
          onClick={handleRefreshAll}
          disabled={refreshing}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          id="refresh-subscriptions-btn"
        >
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            role="status"
            aria-live="polite"
            style={{
              padding: '12px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: toast.type === 'success' ? 'var(--green-muted)' : 'var(--red-muted)',
              color: toast.type === 'success' ? 'var(--green)' : 'var(--red)',
              border: `1px solid ${toast.type === 'success' ? 'var(--green)' : 'var(--red)'}`,
            }}
          >
            {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metrics Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
            Total Plans Defined
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: 'var(--text)' }}>
            {metricsLoading ? '—' : metrics?.plans?.total ?? plans.length}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
            {metricsLoading ? 'Loading…' : `${metrics?.plans?.active ?? 0} active • ${metrics?.plans?.inactive ?? 0} inactive`}
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
            Total Subscriptions
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: 'var(--text)' }}>
            {metricsLoading ? '—' : metrics?.subscriptions?.total ?? totalSubs}
          </div>
          <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 4 }}>
            {metricsLoading ? 'Loading…' : `${metrics?.subscriptions?.active ?? 0} currently active`}
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
            Trialing / Expired
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: 'var(--text)' }}>
            {metricsLoading
              ? '—'
              : `${metrics?.subscriptions?.trialing ?? 0} / ${metrics?.subscriptions?.expired ?? 0}`}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
            {metricsLoading ? 'Loading…' : `${metrics?.subscriptions?.cancelled ?? 0} cancelled`}
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
            Active Tiers
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8, color: 'var(--text)' }}>
            {plans.filter((p) => p.isActive).map((p) => p.name).join(', ') || 'None'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
            Configurable entitlements
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 12,
        }}
      >
        <button
          onClick={() => setActiveTab('plans')}
          className={`btn ${activeTab === 'plans' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          id="tab-plans-btn"
        >
          <Layers size={16} />
          <span>Platform Plans ({plans.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`btn ${activeTab === 'subscriptions' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          id="tab-subscriptions-btn"
        >
          <Users size={16} />
          <span>User Subscriptions ({totalSubs})</span>
        </button>
      </div>

      {/* TAB 1: PLANS MANAGEMENT */}
      {activeTab === 'plans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Plan Definitions</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Define feature access rights and volume limits across subscription tiers.
              </p>
            </div>
            <button
              onClick={handleOpenCreatePlan}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              id="create-plan-btn"
            >
              <Plus size={16} />
              <span>Create New Plan</span>
            </button>
          </div>

          {plansError && (
            <div
              className="card"
              style={{
                padding: '14px 18px',
                color: 'var(--red)',
                border: '1px solid var(--red)',
                background: 'var(--red-muted)',
                fontSize: 13,
              }}
            >
              {plansError}
            </div>
          )}

          {plansLoading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading platform plans…
            </div>
          ) : plans.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No platform plans found. Click &quot;Create New Plan&quot; to define your first tier.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 16px' }}>Plan Name</th>
                      <th style={{ padding: '12px 16px' }}>Slug</th>
                      <th style={{ padding: '12px 16px' }}>Price</th>
                      <th style={{ padding: '12px 16px' }}>Billing</th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px' }}>Entitlements</th>
                      <th style={{ padding: '12px 16px' }}>Limits</th>
                      <th style={{ padding: '12px 16px' }}>Users</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((p) => (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: p.isActive ? 'transparent' : 'rgba(255,255,255,0.01)',
                        }}
                      >
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{p.name}</span>
                            {p.slug === 'free' && (
                              <span className="tag" style={{ fontSize: 10, padding: '2px 6px' }}>Default</span>
                            )}
                          </div>
                          {p.description && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>
                              {p.description}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                          {p.slug}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {formatPlanPrice(p.price, p.currency, p.billingInterval)}
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {p.billingInterval}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            className={`tag ${p.isActive ? 'tag-green' : 'tag-gray'}`}
                            style={{ fontSize: 11, padding: '2px 8px' }}
                          >
                            {p.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 260 }}>
                            {(p.features || []).slice(0, 3).map((feat) => (
                              <span
                                key={feat}
                                className="tag"
                                style={{ fontSize: 10, padding: '2px 6px', background: 'var(--bg-elevated)' }}
                              >
                                {feat}
                              </span>
                            ))}
                            {(p.features || []).length > 3 && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
                                +{(p.features || []).length - 3} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                          <div>Accounts: {p.limits?.accounts ?? '—'}</div>
                          <div>Trades: {p.limits?.trades ?? '—'}</div>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {p.userCount ?? 0}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                            <button
                              onClick={() => handleOpenEditPlan(p)}
                              className="btn btn-secondary btn-sm"
                              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                              aria-label={`Edit ${p.name} plan`}
                            >
                              <Edit2 size={13} />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleTogglePlanActive(p)}
                              className="btn btn-ghost btn-sm"
                              style={{
                                color: p.isActive ? 'var(--amber)' : 'var(--green)',
                                fontSize: 12,
                              }}
                              aria-label={p.isActive ? `Deactivate ${p.name}` : `Activate ${p.name}`}
                            >
                              {p.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USER SUBSCRIPTIONS */}
      {activeTab === 'subscriptions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Subscriber Directory</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                View and manage user tier assignments, validity dates, and subscription statuses.
              </p>
            </div>
            <button
              onClick={handleOpenNewAssignModal}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              id="assign-subscription-btn"
              data-testid="assign-subscription-btn"
              disabled={plansLoading || plans.length === 0}
            >
              <CreditCard size={16} />
              <span>Assign Subscription</span>
            </button>
          </div>

          {/* Filters Bar */}
          <div
            className="card"
            style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              background: 'var(--bg-elevated)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search by email, name, or plan…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input"
                style={{ flex: 1, fontSize: 13 }}
                id="search-subscriptions-input"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={15} color="var(--text-muted)" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="select"
                style={{ fontSize: 13 }}
                id="status-filter-select"
                aria-label="Filter subscriptions by status"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                value={planFilter}
                onChange={(e) => {
                  setPlanFilter(e.target.value);
                  setPage(1);
                }}
                className="select"
                style={{ fontSize: 13 }}
                id="plan-filter-select"
                aria-label="Filter subscriptions by plan"
              >
                <option value="all">All Plans</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Plan load failure warning in subscriptions tab */}
          {plansError && (
            <div
              className="card"
              style={{
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                color: 'var(--amber)',
                border: '1px solid var(--amber)',
                background: 'rgba(245,158,11,0.07)',
                fontSize: 13,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Plans could not be loaded:</strong> {plansError} — The Assign Subscription modal
                  requires platform plans. Please retry or check your admin permissions.
                </span>
              </div>
              <button
                onClick={loadPlans}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--amber)', whiteSpace: 'nowrap' }}
                id="retry-load-plans-btn"
              >
                <RefreshCw size={13} />
                <span style={{ marginLeft: 4 }}>Retry</span>
              </button>
            </div>
          )}

          {subsError && (
            <div
              className="card"
              style={{
                padding: '14px 18px',
                color: 'var(--red)',
                border: '1px solid var(--red)',
                background: 'var(--red-muted)',
                fontSize: 13,
              }}
            >
              {subsError}
            </div>
          )}

          {subsLoading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading user subscriptions…
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No subscriptions match your query.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 16px' }}>User</th>
                      <th style={{ padding: '12px 16px' }}>Current Plan</th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px' }}>Started</th>
                      <th style={{ padding: '12px 16px' }}>Expires</th>
                      <th style={{ padding: '12px 16px' }}>Last Updated</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                            {s.user?.fullName || 'Anonymous Trader'}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {s.user?.email || s.userId}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className="tag tag-accent" style={{ fontSize: 11, padding: '3px 8px', fontWeight: 600 }}>
                            {s.plan?.name || 'Free (Default)'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            className={`tag ${
                              s.status === 'active'
                                ? 'tag-green'
                                : s.status === 'trialing'
                                ? 'tag-accent'
                                : s.status === 'expired'
                                ? 'tag-amber'
                                : 'tag-gray'
                            }`}
                            style={{ fontSize: 11, padding: '2px 8px', textTransform: 'capitalize' }}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                          {formatDate(s.startedAt)}
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                          {s.expiresAt ? formatDate(s.expiresAt) : 'Permanent / Unset'}
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-faint)', fontSize: 12 }}>
                          {formatDate(s.updatedAt)}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleOpenAssignModal(s)}
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            id={`change-plan-${s.id}`}
                            data-testid={`change-plan-${s.id}`}
                          >
                            <CreditCard size={13} />
                            <span>Change Plan</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  background: 'var(--bg-elevated)',
                  borderTop: '1px solid var(--border)',
                  fontSize: 13,
                }}
              >
                <div style={{ color: 'var(--text-muted)' }}>
                  Showing {subscriptions.length} of {totalSubs} subscriptions
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="btn btn-secondary btn-sm"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                    <span>Previous</span>
                  </button>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="btn btn-secondary btn-sm"
                    aria-label="Next page"
                  >
                    <span>Next</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: PLAN EDITOR (CREATE / EDIT) */}
      <AnimatePresence>
        {isPlanModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 20,
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="card"
              style={{
                width: '100%',
                maxWidth: 620,
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '24px 28px',
                background: 'var(--bg-elevated)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  {editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create Platform Plan'}
                </h3>
                <button
                  onClick={() => setIsPlanModalOpen(false)}
                  className="btn btn-ghost btn-sm"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSavePlan} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label htmlFor="plan-name-input" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      Plan Name *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={planForm.name}
                      onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                      placeholder="e.g. Pro Trader"
                      required
                      id="plan-name-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="plan-slug-input" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      Slug *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={planForm.slug}
                      onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                      placeholder="e.g. pro"
                      disabled={!!editingPlan}
                      required
                      id="plan-slug-input"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="plan-description-input" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    Description
                  </label>
                  <textarea
                    className="input"
                    rows={2}
                    value={planForm.description}
                    onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                    placeholder="Short description of this tier's intended audience and purpose"
                    id="plan-description-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div>
                    <label htmlFor="plan-price-input" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      Price (USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      value={planForm.price}
                      onChange={(e) => setPlanForm({ ...planForm, price: parseFloat(e.target.value) || 0 })}
                      id="plan-price-input"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      Currency
                    </label>
                    <select
                      className="select"
                      value={planForm.currency}
                      onChange={(e) => setPlanForm({ ...planForm, currency: e.target.value })}
                      id="plan-currency-select"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      Billing Interval
                    </label>
                    <select
                      className="select"
                      value={planForm.billingInterval}
                      onChange={(e) => setPlanForm({ ...planForm, billingInterval: e.target.value })}
                      id="plan-billing-interval-select"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="lifetime">Lifetime</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={planForm.isActive}
                      onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })}
                      id="plan-active-checkbox"
                    />
                    <span>Active Plan (Available to users)</span>
                  </label>
                </div>

                {/* Feature Entitlements Selection */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                    Feature Entitlements
                  </label>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                      background: 'var(--bg)',
                      padding: 12,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                    }}
                  >
                    {KNOWN_FEATURES.map((feat) => {
                      const isChecked = planForm.features.includes(feat.id);
                      return (
                        <label
                          key={feat.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            fontSize: 12,
                            cursor: 'pointer',
                            color: isChecked ? 'var(--text)' : 'var(--text-muted)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...planForm.features, feat.id]
                                : planForm.features.filter((f) => f !== feat.id);
                              setPlanForm({ ...planForm, features: next });
                            }}
                            id={`feature-checkbox-${feat.id}`}
                          />
                          <div>
                            <div style={{ fontWeight: 600 }}>{feat.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{feat.description}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Usage Limits Configuration */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                    Volume Limits
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                        Max Trading Accounts
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="input"
                        value={planForm.limits.accounts}
                        onChange={(e) =>
                          setPlanForm({
                            ...planForm,
                            limits: { ...planForm.limits, accounts: parseInt(e.target.value) || 1 },
                          })
                        }
                        id="plan-limit-accounts-input"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                        Max Trades
                      </label>
                      <input
                        type="number"
                        min="50"
                        step="50"
                        className="input"
                        value={planForm.limits.trades}
                        onChange={(e) =>
                          setPlanForm({
                            ...planForm,
                            limits: { ...planForm.limits, trades: parseInt(e.target.value) || 500 },
                          })
                        }
                        id="plan-limit-trades-input"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                        Screenshots / Trade
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="input"
                        value={planForm.limits.screenshots_per_trade}
                        onChange={(e) =>
                          setPlanForm({
                            ...planForm,
                            limits: { ...planForm.limits, screenshots_per_trade: parseInt(e.target.value) || 5 },
                          })
                        }
                        id="plan-limit-screenshots-input"
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => setIsPlanModalOpen(false)}
                    className="btn btn-ghost"
                    disabled={savingPlan}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingPlan}
                    id="save-plan-submit-btn"
                  >
                    {savingPlan ? 'Saving…' : editingPlan ? 'Save Changes' : 'Create Plan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: ASSIGN / CHANGE USER SUBSCRIPTION */}
      <AnimatePresence>
        {isAssignModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 20,
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="card"
              style={{
                width: '100%',
                maxWidth: 500,
                padding: '24px 28px',
                background: 'var(--bg-elevated)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  {targetSub ? 'Change User Subscription' : 'Assign Subscription'}
                </h3>
                <button
                  onClick={() => setIsAssignModalOpen(false)}
                  className="btn btn-ghost btn-sm"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Existing subscription: show user info card */}
              {targetSub && (
                <div
                  style={{
                    padding: 12,
                    background: 'var(--bg)',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    marginBottom: 16,
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{targetSub.user?.fullName || 'Trader'}</div>
                  <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {targetSub.user?.email || targetSub.userId}
                  </div>
                </div>
              )}

              {/* New assignment: user search + select */}
              {!targetSub && (
                <div style={{ marginBottom: 16 }}>
                  <label
                    htmlFor="assign-user-search"
                    style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}
                  >
                    Select User *
                  </label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search
                        size={14}
                        style={{
                          position: 'absolute',
                          left: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--text-muted)',
                          pointerEvents: 'none',
                        }}
                      />
                      <input
                        type="text"
                        id="assign-user-search"
                        className="input"
                        placeholder="Search by email or name…"
                        value={userSearch}
                        onChange={(e) => {
                          setUserSearch(e.target.value);
                          loadAllUsers(e.target.value);
                        }}
                        style={{ paddingLeft: 32, fontSize: 13 }}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <select
                    id="assign-user-select"
                    className="select"
                    value={assignForm.userId}
                    onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })}
                    required
                    size={Math.min(5, allUsers.length + 1)}
                    style={{ width: '100%', fontSize: 13, minHeight: 80 }}
                    aria-label="Select user for subscription assignment"
                  >
                    <option value="">— choose a user —</option>
                    {usersLoading ? (
                      <option disabled>Loading users…</option>
                    ) : (
                      allUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.email}{u.fullName && u.fullName !== 'Anonymous User' ? ` (${u.fullName})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                  {allUsers.length === 0 && !usersLoading && (
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4, display: 'block' }}>
                      No users found. Try a different search term.
                    </span>
                  )}
                  {usersError && (
                    <span role="alert" style={{ fontSize: 11, color: 'var(--red)', marginTop: 4, display: 'block' }}>
                      {usersError}
                    </span>
                  )}
                </div>
              )}

              <form onSubmit={handleSaveSubscription} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* No-plans notice inside modal: shown if plans failed to load */}
                {plans.length === 0 && !plansLoading && (
                  <div
                    style={{
                      padding: '12px 14px',
                      background: 'rgba(245,158,11,0.07)',
                      border: '1px solid var(--amber)',
                      borderRadius: 6,
                      fontSize: 12,
                      color: 'var(--amber)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>
                      No platform plans could be loaded. Go to the <strong>Platform Plans</strong> tab to
                      verify plans exist, or retry loading.
                    </span>
                  </div>
                )}
                <div>
                  <label htmlFor="assign-plan-select" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    Assigned Plan Tier *
                  </label>
                  <select
                    className="select"
                    value={assignForm.planId}
                    onChange={(e) => setAssignForm({ ...assignForm, planId: e.target.value })}
                    required
                    id="assign-plan-select"
                    disabled={plans.length === 0}
                  >
                    {plans.length === 0 ? (
                      <option value="">— no plans available —</option>
                    ) : (
                      plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({formatPlanPrice(p.price, p.currency, p.billingInterval)})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="assign-status-select" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    Subscription Status *
                  </label>
                  <select
                    className="select"
                    value={assignForm.status}
                    onChange={(e) => setAssignForm({ ...assignForm, status: e.target.value })}
                    required
                    id="assign-status-select"
                  >
                    <option value="active">Active (Full access)</option>
                    <option value="trialing">Trialing</option>
                    <option value="expired">Expired (Reverts to Free entitlements)</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="assign-expiry-input" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    Expiration Date (Optional)
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={assignForm.expiresAt}
                    onChange={(e) => setAssignForm({ ...assignForm, expiresAt: e.target.value })}
                    id="assign-expiry-input"
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4, display: 'block' }}>
                    Leave blank for permanent or ongoing admin-managed entitlement.
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => setIsAssignModalOpen(false)}
                    className="btn btn-ghost"
                    disabled={assigning}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={assigning}
                    id="confirm-assign-btn"
                  >
                    {assigning ? 'Applying…' : 'Apply Plan Change'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
