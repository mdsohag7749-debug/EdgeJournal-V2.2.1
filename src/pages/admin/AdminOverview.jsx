import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  CandlestickChart,
  Wallet,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  Database,
  Server,
  Layers,
} from 'lucide-react';
import { fetchAdminMetrics, fetchRecentUsers } from '../../lib/adminApi';

export default function AdminOverview() {
  const [metrics, setMetrics] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [metricsData, usersData] = await Promise.all([
        fetchAdminMetrics(),
        fetchRecentUsers(5),
      ]);
      setMetrics(metricsData);
      setRecentUsers(usersData);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err?.message || 'Failed to load admin dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Control / Refresh Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
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
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Phase 1 Security Engine Active
          </span>
          {lastUpdated && (
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
              • Last synced {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

        <button
          onClick={() => loadData(true)}
          disabled={loading || refreshing}
          className="btn btn-ghost btn-sm"
          style={{
            fontSize: 12.5,
            border: '1px solid var(--border)',
            padding: '6px 12px',
            gap: 6,
          }}
          aria-label="Refresh overview metrics"
        >
          <RefreshCw
            size={13}
            style={{
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
            }}
          />
          <span>{refreshing ? 'Syncing…' : 'Refresh Telemetry'}</span>
        </button>
      </div>

      {/* Global Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
          role="alert"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={20} color="var(--loss)" />
            <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 500 }}>
              {error}
            </span>
          </div>
          <button
            onClick={() => loadData()}
            className="btn btn-sm"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border-strong)',
              fontSize: 12,
              padding: '6px 12px',
            }}
          >
            Retry Query
          </button>
        </motion.div>
      )}

      {/* Core Telemetry Cards Grid */}
      <section aria-labelledby="telemetry-heading">
        <h2 id="telemetry-heading" style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--text)' }}>
          Platform Telemetry
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {/* Card 1: Users (Live Real Data) */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <span className="drawer-label" style={{ fontSize: 11 }}>User Population</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  {loading ? (
                    <div style={{ width: 64, height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 6 }} />
                  ) : (
                    <span style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {metrics?.users?.total ?? 0}
                    </span>
                  )}
                  <span className="tag tag-win" style={{ fontSize: 10.5 }}>Live</span>
                </div>
              </div>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text)',
                }}
              >
                <Users size={18} />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 12,
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid var(--border)',
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              <div>
                <span>Admins: </span>
                <strong style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                  {loading ? '—' : metrics?.users?.admins ?? 0}
                </strong>
              </div>
              <div>
                <span>Standard: </span>
                <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                  {loading ? '—' : metrics?.users?.standard ?? 0}
                </strong>
              </div>
            </div>
          </div>

          {/* Card 2: Trading Activity (Phase 4 Live Data) */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <span className="drawer-label" style={{ fontSize: 11 }}>Trading Activity</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  {loading ? (
                    <div style={{ width: 64, height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 6 }} />
                  ) : (
                    <span style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {metrics?.trades?.total ?? 0}
                    </span>
                  )}
                  <span className="tag tag-win" style={{ fontSize: 10.5 }}>Live</span>
                </div>
              </div>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text)',
                }}
              >
                <CandlestickChart size={18} />
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid var(--border)',
                fontSize: 12,
                color: 'var(--text-faint)',
                lineHeight: 1.4,
              }}
            >
              <span>Platform-wide via admin RLS (Phase 4)</span>
            </div>
          </div>

          {/* Card 3: Trading Accounts (Phase 4 Live Data) */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <span className="drawer-label" style={{ fontSize: 11 }}>Trading Accounts</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  {loading ? (
                    <div style={{ width: 64, height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 6 }} />
                  ) : (
                    <span style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {metrics?.accounts?.total ?? 0}
                    </span>
                  )}
                  <span className="tag tag-win" style={{ fontSize: 10.5 }}>Live</span>
                </div>
              </div>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text)',
                }}
              >
                <Wallet size={18} />
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid var(--border)',
                fontSize: 12,
                color: 'var(--text-faint)',
                lineHeight: 1.4,
              }}
            >
              <span>Platform-wide via admin RLS (Phase 4)</span>
            </div>
          </div>

          {/* Card 4: System Operational Status */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <span className="drawer-label" style={{ fontSize: 11 }}>System Status</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--win)', fontFamily: 'var(--font-display)' }}>
                    Operational
                  </span>
                  <span className="tag tag-win" style={{ fontSize: 10.5 }}>Healthy</span>
                </div>
              </div>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(47, 214, 110, 0.1)',
                  border: '1px solid rgba(47, 214, 110, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--win)',
                }}
              >
                <ShieldCheck size={18} />
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid var(--border)',
                fontSize: 12,
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Security Definer:</span>
              <strong style={{ color: 'var(--win)' }}>Enforced</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Activity Section: Recent Registered Profiles */}
      <section aria-labelledby="recent-activity-heading">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h2 id="recent-activity-heading" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              Recent User Registrations
            </h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
              Live registration feed queried from public.profiles under Admin RLS policy
            </p>
          </div>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 44,
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                  }}
                />
              ))}
            </div>
          ) : recentUsers.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontSize: 14, fontWeight: 600 }}>No user profiles found</p>
              <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4 }}>
                User registration events will appear here once new profiles are created.
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
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((u) => (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text)' }}>
                        {u.fullName}
                      </td>
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {u.email}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          className={u.role === 'admin' ? 'tag tag-red' : 'tag tag-neutral'}
                          style={{ fontSize: 10.5 }}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', color: 'var(--text-faint)', fontSize: 12 }}>
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Security Foundation Status Card */}
      <section aria-labelledby="security-heading">
        <h2 id="security-heading" style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--text)' }}>
          Phase 1 Security Foundation
        </h2>
        <div className="card" style={{ padding: 22 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <CheckCircle2 size={18} color="var(--win)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: 13, color: 'var(--text)', display: 'block' }}>
                  profiles.role Column
                </strong>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Enforced public.user_role enum ('user', 'admin') with default 'user'
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <CheckCircle2 size={18} color="var(--win)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: 13, color: 'var(--text)', display: 'block' }}>
                  is_admin() Function
                </strong>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  SECURITY DEFINER function with hardened search_path protection
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <CheckCircle2 size={18} color="var(--win)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: 13, color: 'var(--text)', display: 'block' }}>
                  protect_profile_role Trigger
                </strong>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Database trigger blocking client-side privilege escalation
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <CheckCircle2 size={18} color="var(--win)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: 13, color: 'var(--text)', display: 'block' }}>
                  Admin RLS Policies
                </strong>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  0019_admin_role.sql policies with zero alteration of 0001 rules
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
