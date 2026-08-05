import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useData } from '../context/DataContext';
import { useAccounts } from '../context/AccountContext';
import { formatMoney, formatDate } from '../lib/utils';
import { computeChallengeMetrics } from '../lib/challengeStats';
import ChallengeFormPanel from './panels/ChallengeFormPanel';
import ConfirmDialog from '../components/ConfirmDialog';
import AccountSwitcher from '../components/accounts/AccountSwitcher';
import { Target, Plus, Trash2, TrendingUp, Calendar, Clock, Wallet, Gauge } from 'lucide-react';

function ChallengeProgress({ label, value, max, color, hint }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontWeight: 600, color }}>{pct.toFixed(1)}%</span>
      </div>
      <div
        style={{
          height: 8,
          background: 'var(--card-hover)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{
            height: '100%',
            background: color,
            borderRadius: 999,
          }}
        />
      </div>
      {hint && <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{hint}</span>}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    active: { label: 'Active', color: 'var(--red)', bg: 'var(--red-dim)' },
    pass: { label: 'PASS', color: 'var(--win)', bg: 'rgba(47,214,110,0.12)' },
    warning: { label: 'WARNING', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    failed: { label: 'FAILED', color: 'var(--loss)', bg: 'rgba(255,77,94,0.12)' },
    completed: { label: 'Completed', color: 'var(--win)', bg: 'rgba(47,214,110,0.12)' },
    archived: { label: 'Archived', color: 'var(--text-faint)', bg: 'rgba(107,114,128,0.12)' },
  };
  const s = map[status] || map.active;
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: 999,
        background: s.bg,
        color: s.color,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {s.label}
    </span>
  );
}

function MetricCell({ icon: Icon, label, value, tone }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <span style={{ color: tone || 'var(--text-muted)', flexShrink: 0, display: 'flex' }}>
        <Icon size={14} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{label}</div>
        <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default function Challenges({ onNavigate }) {
  const { challenges, trades } = useData();
  const { accounts, selectedAccountId } = useAccounts();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [activeTab, setActiveTab] = useState('active');

  const selectedAccount = selectedAccountId
    ? accounts.find((a) => a.id === selectedAccountId)
    : accounts.find((a) => a.isDefault) || accounts[0] || null;

  // Live metrics for every challenge, derived from real trade history via
  // the shared Challenge Balance Engine (same math as the Dashboard widget).
  const enrichedChallenges = useMemo(() => {
    return challenges.items.map((c) => {
      const acc = c.accountId ? accounts.find((a) => a.id === c.accountId) : selectedAccount;
      const cTrades = c.accountId ? trades.items.filter((t) => t.accountId === c.accountId) : trades.items;
      const metrics = computeChallengeMetrics(c, cTrades, acc);
      return { ...c, ...metrics };
    });
  }, [challenges.items, trades.items, accounts, selectedAccount]);

  const activeChallenges = enrichedChallenges.filter((c) => c.status !== 'archived' && c.status !== 'completed' && c.status !== 'failed');
  const completedChallenges = enrichedChallenges.filter((c) => c.status === 'completed' || c.status === 'archived' || c.status === 'failed');

  const list = activeTab === 'active' ? activeChallenges : completedChallenges;

  function handleSave(challenge) {
    if (editing) {
      challenges.update(editing.id, challenge);
    } else {
      challenges.add(challenge);
    }
    setFormOpen(false);
    setEditing(null);
  }

  function handleEdit(challenge) {
    setEditing(challenge);
    setFormOpen(true);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    challenges.remove(deleteTarget.id);
    setDeleteTarget(null);
  }

  function handleArchive(challenge) {
    challenges.update(challenge.id, { status: challenge.status === 'archived' ? 'active' : 'archived' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="card"
        style={{
          padding: '16px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              background: 'rgba(193, 18, 31, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--red)',
              fontWeight: 700,
            }}
          >
            <Target size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              Challenge Tracker <Target size={16} color="var(--red)" />
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-muted)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>Account:</span>
              <AccountSwitcher />
            </div>
          </div>
        </div>

        <button
          className="btn btn-accent btn-sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={15} /> New Challenge
        </button>
      </motion.div>

      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { id: 'active', label: 'Active', count: activeChallenges.length },
          { id: 'history', label: 'History', count: completedChallenges.length },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-accent' : 'btn-ghost'}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ fontSize: 12.5 }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <Target size={40} color="var(--text-faint)" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {activeTab === 'active' ? 'No active challenges yet. Create one to get started.' : 'No challenge history yet.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {list.map((c) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="card"
              style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, border: '1px solid var(--border)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</h3>
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {c.propFirm} {c.challengeType !== 'Custom' && `· ${c.challengeType}`}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <MetricCell icon={Wallet} label="Balance" value={formatMoney(c.currentBalance)} tone="var(--text-muted)" />
                <MetricCell icon={Gauge} label="Equity" value={formatMoney(c.equity)} tone="var(--text-muted)" />
                <MetricCell
                  icon={TrendingUp}
                  label="Profit Target"
                  value={`${formatMoney(c.netPnl)} / ${formatMoney(c.profitTarget)}`}
                  tone={c.netPnl >= 0 ? 'var(--win)' : 'var(--loss)'}
                />
                <MetricCell
                  icon={Calendar}
                  label="Trading Days"
                  value={`${c.tradingDaysCompleted} / ${c.minTradingDays || '∞'}`}
                  tone={c.minTradingDays > 0 && c.tradingDaysCompleted >= c.minTradingDays ? 'var(--win)' : 'var(--text-muted)'}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.profitTarget > 0 && (
                  <ChallengeProgress
                    label="Profit Target"
                    value={Math.max(0, c.netPnl)}
                    max={c.profitTarget}
                    color="var(--win)"
                    hint={`${formatMoney(Math.max(0, c.profitRemaining))} remaining`}
                  />
                )}
                {c.dailyDrawdown > 0 && (
                  <ChallengeProgress
                    label="Daily Drawdown"
                    value={c.dailyDDUsed}
                    max={c.dailyDrawdown}
                    color={c.dailyDDProgress >= 0.8 ? 'var(--loss)' : '#f59e0b'}
                    hint={`${formatMoney(Math.max(0, c.dailyDDRemaining))} left today`}
                  />
                )}
                {c.maximumDrawdown > 0 && (
                  <ChallengeProgress
                    label="Max Drawdown"
                    value={c.maxDDUsed}
                    max={c.maximumDrawdown}
                    color={c.maxDDProgress >= 0.8 ? 'var(--loss)' : 'var(--red)'}
                    hint={`${formatMoney(Math.max(0, c.maxDDRemaining))} left`}
                  />
                )}
                <ChallengeProgress
                  label="Trading Days"
                  value={c.tradingDaysProgress * 100}
                  max={100}
                  color={c.tradingDaysProgress >= 1 ? 'var(--win)' : 'var(--red)'}
                  hint={`${c.tradingDaysCompleted} done${c.tradingDaysRemaining > 0 ? ` · ${c.tradingDaysRemaining} to go` : ''}`}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--text-faint)', flexWrap: 'wrap' }}>
                {c.startDate && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {formatDate(c.startDate)}</span>}
                {c.endDate && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {formatDate(c.endDate)}</span>}
                {c.daysRemaining !== null && c.daysRemaining >= 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} /> {c.daysRemaining} day{c.daysRemaining === 1 ? '' : 's'} left
                  </span>
                )}
                {c.daysRemaining !== null && c.daysRemaining < 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--loss)' }}>
                    <Clock size={12} /> {Math.abs(c.daysRemaining)} day{Math.abs(c.daysRemaining) === 1 ? '' : 's'} overdue
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(c)} style={{ flex: 1, fontSize: 12 }}>
                  Edit
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleArchive(c)} style={{ flex: 1, fontSize: 12 }}>
                  {c.status === 'archived' ? 'Unarchive' : 'Archive'}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDeleteTarget(c)}
                  style={{ flex: 1, fontSize: 12, color: 'var(--loss)' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <ChallengeFormPanel open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} onSave={handleSave} initial={editing} />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Challenge"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}