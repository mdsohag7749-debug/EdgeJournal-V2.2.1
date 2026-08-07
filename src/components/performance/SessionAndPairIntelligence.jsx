import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import { useData } from '../../context/DataContext';
import { useAccounts } from '../../context/AccountContext';
import { computeSessionPairIntelligence, fmtMoney, MIN_EMERGING, MIN_RELIABLE, MIN_LIMITED } from '../../lib/sessionIntelligence';
import { CalendarClock, CalendarRange, Layers as LayersIcon, AlertTriangle } from 'lucide-react';

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' },
];

const VIEWS = [
  { value: 'pair', label: 'By Pair' },
  { value: 'session', label: 'By Session' },
  { value: 'combo', label: 'Pair + Session' },
];

const STATUS_COLOR = {
  'Consistent Pattern': '#16a34a',
  'Emerging Pattern': '#f59e0b',
  'Limited Data': '#94a3b8',
};
const CONF_COLOR = { High: '#16a34a', Medium: '#f59e0b', Low: '#94a3b8' };
const SIGNAL_COLOR = { positive: '#16a34a', warning: '#f59e0b', neutral: '#2563eb' };

const chipBase = {
  padding: '6px 12px',
  borderRadius: 9,
  fontSize: 12,
  fontWeight: 700,
  border: '1.5px solid transparent',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  transition: 'background .15s ease, color .15s ease, border-color .15s ease',
  background: 'transparent',
};
const chipActive = {
  background: 'rgba(124,58,237,0.15)',
  borderColor: 'rgba(124,58,237,0.4)',
  color: 'var(--text)',
};

function StatusChip({ status }) {
  const color = STATUS_COLOR[status] || '#94a3b8';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 7, background: `${color}14`, color, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

function ConfChip({ confidence }) {
  const color = CONF_COLOR[confidence] || '#94a3b8';
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color, marginLeft: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{confidence}</span>
  );
}

export default function SessionAndPairIntelligence() {
  const { trades } = useData();
  const { allAccounts, selectedAccount } = useAccounts();
  const [period, setPeriod] = useState('all');
  const [view, setView] = useState('combo');

  const data = useMemo(() => computeSessionPairIntelligence(trades.items, period), [trades.items, period]);
  const scopeLabel = allAccounts ? 'All Accounts' : selectedAccount?.name || 'Selected Account';

  const rows = view === 'pair' ? data.pairs : view === 'session' ? data.sessions : data.combos;

  const renderBody = () => {
    if (data.decidedCount < MIN_LIMITED) {
      return (
        <div style={{ marginTop: 16 }}>
          <EmptyState icon={CalendarClock} title="Not enough pair / session data yet" message={`Log at least ${MIN_LIMITED} winning or losing trades to unlock pair & session intelligence.`} />
        </div>
      );
    }
    if (!rows.length) {
      return (
        <div style={{ marginTop: 16 }}>
          <EmptyState icon={LayersIcon} title="No data in this view" message="There are no usable row in this selection yet. Try another view or date range." />
        </div>
      );
    }

    const limitedOnly = !rows.some((r) => r.status !== 'Limited Data');

    return (
      <>
        {data.insights.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {data.insights.map((ins, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.45 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: SIGNAL_COLOR[ins.signal] || '#94a3b8', marginTop: 6, flexShrink: 0 }} />
                <span>
                  {ins.claim} <ConfChip confidence={ins.confidence} />
                </span>
              </div>
            ))}
          </div>
        )}

        {limitedOnly && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, background: 'rgba(148,163,184,0.12)', fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span>Every group here is Limited Data — no strong conclusions are drawn until a group reaches {MIN_EMERGING}+ decided trades.</span>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {view === 'combo' && <th style={{ padding: '0 10px 10px 0' }}>Pair + Session</th>}
                {view !== 'combo' && <th style={{ padding: '0 10px 10px 0' }}>{view === 'pair' ? 'Pair' : 'Session'}</th>}
                <th style={{ padding: '0 10px 10px' }}>Trades</th>
                <th style={{ padding: '0 10px 10px' }}>Win Rate</th>
                <th style={{ padding: '0 10px 10px' }}>Expectancy</th>
                <th style={{ padding: '0 10px 10px' }}>Avg R:R</th>
                <th style={{ padding: '0 10px 10px' }}>Consistency</th>
                <th style={{ padding: '0 10px 10px' }}>Net P&L</th>
                <th style={{ padding: '0' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 12).map((r) => (
                <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '9px 10px 9px 0', fontWeight: 600 }}>
                    {view === 'combo' ? `${r.pair} · ${r.session}` : r.label}
                    {r.highVar && <span style={{ marginLeft: 6, color: '#f59e0b' }} title="Higher execution variance">⚠</span>}
                    <ConfChip confidence={r.confidence} />
                  </td>
                  <td style={{ padding: '9px 10px' }}>{r.sample}</td>
                  <td style={{ padding: '9px 10px' }}>{r.winRate ? r.winRate.toFixed(1) + '%' : '—'}</td>
                  <td className="mono" style={{ padding: '9px 10px' }}>
                    <span className={r.expectancy >= 0 ? 'pnl-pos' : 'pnl-neg'}>{fmtMoney(r.expectancy)}</span>
                  </td>
                  <td style={{ padding: '9px 10px' }}>{r.meanRR ? r.meanRR.toFixed(2) : '—'}</td>
                  <td style={{ padding: '9px 10px' }}>{r.consistency ? Math.round(r.consistency) + '%' : '—'}</td>
                  <td className="mono" style={{ padding: '9px 10px' }}>
                    <span className={r.netPnl >= 0 ? 'pnl-pos' : 'pnl-neg'}>{fmtMoney(r.netPnl)}</span>
                  </td>
                  <td style={{ padding: '9px 0' }}>
                    <StatusChip status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <CalendarRange size={16} color="#e07b00" /> Session & Pair Intelligence
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.03em' }}>· {scopeLabel}</span>
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 600, marginBottom: 0 }}>
            Contextual edges across pairs, sessions and their combination — always guarded by minimum sample size.
          </p>
        </div>
        <div style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--bg-elevated, rgba(255,255,255,0.02))' }}>
          {PERIODS.map((p) => (
            <button key={p.value} type="button" onClick={() => setPeriod(p.value)} style={{ ...chipBase, ...(period === p.value ? chipActive : {}) }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--bg-elevated, rgba(255,255,255,0.02))', marginBottom: 16 }}>
        {VIEWS.map((v) => (
          <button key={v.value} type="button" onClick={() => setView(v.value)} style={{ ...chipBase, ...(view === v.value ? chipActive : {}) }}>
            {v.label}
          </button>
        ))}
      </div>

      {renderBody()}
    </motion.div>
  );
}