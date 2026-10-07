import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Activity,
  ShieldCheck,
  Server,
  Zap,
  Sliders,
  Clock,
  Layers,
} from 'lucide-react';
import { fetchAdminAIMetrics, fetchAdminAIUsageLogs, updateSystemSetting } from '../../lib/adminApi';
import { fetchPublicSystemSettings } from '../../lib/systemSettingsApi';

export default function AdminEdgeAI() {
  const [metrics, setMetrics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Editable settings local state
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiMaintenance, setAiMaintenance] = useState(false);
  const [dailyLimitPro, setDailyLimitPro] = useState(50);
  const [dailyLimitFree, setDailyLimitFree] = useState(0);
  const [aiModel, setAiModel] = useState('gemini-3.5-flash-lite');

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [m, l, s] = await Promise.all([
        fetchAdminAIMetrics(),
        fetchAdminAIUsageLogs({ limit: 25 }),
        fetchPublicSystemSettings(),
      ]);

      setMetrics(m);
      setLogs(l.logs || []);
      setSettings(s);

      setAiEnabled(Boolean(s.ai_enabled ?? true));
      setAiMaintenance(Boolean(s.ai_maintenance_mode ?? false));
      setDailyLimitPro(Number(s.ai_daily_limit_pro ?? 50));
      setDailyLimitFree(Number(s.ai_daily_limit_free ?? 0));
      setAiModel(String(s.ai_model ?? 'gemini-3.5-flash-lite'));

      setLastUpdated(new Date());
    } catch (err) {
      setError(err?.message || 'Failed to load AI operational metrics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSavingSettings(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await Promise.all([
        updateSystemSetting('ai_enabled', aiEnabled, 'Global Edge AI master toggle'),
        updateSystemSetting('ai_maintenance_mode', aiMaintenance, 'AI-specific maintenance mode'),
        updateSystemSetting('ai_daily_limit_pro', Number(dailyLimitPro), 'Maximum daily AI requests for Pro subscribers'),
        updateSystemSetting('ai_daily_limit_free', Number(dailyLimitFree), 'Maximum daily AI requests for Free tier users'),
        updateSystemSetting('ai_model', aiModel, 'Configured generative AI model name'),
      ]);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
      await loadData(true);
    } catch (err) {
      setError(err?.message || 'Failed to update system settings.');
    } finally {
      setSavingSettings(false);
    }
  }

  if (loading && !metrics) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: 'var(--text-muted)' }}>
        <RefreshCw size={20} className="animate-spin" />
        <span>Loading Edge AI telemetry & configuration…</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top action / refresh bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={22} color="var(--red)" />
            Edge AI Command Center & Telemetry
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Operational monitoring, serverless throughput, model routing, and aggregate usage ledger
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdated && (
            <span style={{ fontSize: 12, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={13} />
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 600,
              cursor: refreshing ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: 'var(--loss)',
            fontSize: 13.5,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {saveSuccess && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.25)',
            color: 'var(--win)',
            fontSize: 13.5,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <CheckCircle2 size={18} />
          <span>Platform AI settings updated and recorded to audit logs.</span>
        </div>
      )}

      {/* Operational KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div style={{ padding: '18px 20px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Invocations</span>
            <Activity size={18} color="var(--blue, #3b82f6)" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{metrics?.totalRequests ?? 0}</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>Recorded API calls in window</div>
        </div>

        <div style={{ padding: '18px 20px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Success Rate</span>
            <CheckCircle2 size={18} color="var(--win)" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--win)' }}>{metrics?.successRate ?? 100}%</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
            {metrics?.successCount ?? 0} ok · {metrics?.failCount ?? 0} failed
          </div>
        </div>

        <div style={{ padding: '18px 20px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Configured Model</span>
            <Server size={18} color="var(--yellow, #f59e0b)" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', marginTop: 4 }}>{aiModel}</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>Provider: {settings?.ai_provider ?? 'gemini'}</div>
        </div>

        <div style={{ padding: '18px 20px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Operational State</span>
            <ShieldCheck size={18} color={aiMaintenance ? '#f59e0b' : aiEnabled ? 'var(--win)' : 'var(--loss)'} />
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: aiMaintenance ? '#f59e0b' : aiEnabled ? 'var(--win)' : 'var(--loss)',
              marginTop: 4,
            }}
          >
            {aiMaintenance ? 'MAINTENANCE MODE' : aiEnabled ? 'ACTIVE & ONLINE' : 'GLOBALLY DISABLED'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>
            {aiMaintenance ? 'Paused for user accounts' : 'Serving entitled users'}
          </div>
        </div>
      </div>

      {/* Configuration & Controls Section */}
      <div style={{ padding: '22px 24px', borderRadius: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sliders size={18} color="var(--red)" />
          Operational Controls & System Settings
        </h3>

        <form onSubmit={handleSaveSettings} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Global Edge AI Master Switch
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <input
                type="checkbox"
                id="aiEnabledCheck"
                checked={aiEnabled}
                onChange={(e) => setAiEnabled(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--red)', cursor: 'pointer' }}
              />
              <label htmlFor="aiEnabledCheck" style={{ fontSize: 13.5, cursor: 'pointer' }}>
                {aiEnabled ? 'AI Enabled for Entitled Users' : 'AI Globally Disabled'}
              </label>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '4px 0 0' }}>
              Master platform setting (ai_enabled). Controls whether any AI requests are processed.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              AI Maintenance Mode
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <input
                type="checkbox"
                id="aiMaintCheck"
                checked={aiMaintenance}
                onChange={(e) => setAiMaintenance(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--red)', cursor: 'pointer' }}
              />
              <label htmlFor="aiMaintCheck" style={{ fontSize: 13.5, cursor: 'pointer' }}>
                {aiMaintenance ? 'Maintenance Active (Temporarily Paused)' : 'Normal Operations'}
              </label>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '4px 0 0' }}>
              When active, users receive a friendly platform maintenance notice without errors.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Daily Limit per User (Pro Plan)
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              value={dailyLimitPro}
              onChange={(e) => setDailyLimitPro(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: 13.5,
              }}
            />
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '4px 0 0' }}>
              Maximum daily AI analyses per user on Pro or eligible tiers.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Daily Limit per User (Free Plan)
            </label>
            <input
              type="number"
              min="0"
              max="10"
              value={dailyLimitFree}
              onChange={(e) => setDailyLimitFree(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: 13.5,
              }}
            />
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '4px 0 0' }}>
              Default is 0 (Free users must upgrade to Pro for Edge AI).
            </p>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              type="submit"
              disabled={savingSettings}
              style={{
                padding: '9px 20px',
                borderRadius: 8,
                background: 'var(--red)',
                color: '#fff',
                fontSize: 13.5,
                fontWeight: 600,
                border: 'none',
                cursor: savingSettings ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {savingSettings ? <RefreshCw size={15} className="animate-spin" /> : <ShieldCheck size={16} />}
              {savingSettings ? 'Saving Settings…' : 'Save AI Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* Aggregate AI Usage Ledger */}
      <div style={{ padding: '22px 24px', borderRadius: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={18} color="var(--red)" />
            Aggregate AI Request Ledger
          </h3>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            Showing latest {logs.length} telemetry records · Private user notes & prompts are never stored
          </span>
        </div>

        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13.5 }}>
            No AI requests recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Timestamp</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>User ID</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Request Type</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Model</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>
                      {row.user_id ? `${row.user_id.slice(0, 8)}…` : 'Anonymous'}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: 'rgba(255, 255, 255, 0.06)',
                          fontSize: 12,
                          fontFamily: 'monospace',
                        }}
                      >
                        {row.request_type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 600,
                          background: row.status === 'success' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: row.status === 'success' ? 'var(--win)' : 'var(--loss)',
                        }}
                      >
                        {row.status === 'success' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                        {row.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-faint)', fontSize: 12, fontFamily: 'monospace' }}>
                      {row.model || 'gemini-3.5-flash-lite'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
