import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import { useData } from '../../context/DataContext';
import { useAccounts } from '../../context/AccountContext';
import { computeRiskExecutionIntelligence, MIN_LIMITED, MIN_EMERGING, MIN_RELIABLE } from '../../lib/riskExecutionIntelligence';
import { ShieldAlert, Gauge, AlertTriangle } from 'lucide-react';

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' },
];

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
  background: 'rgba(156,39,103,0.15)',
  borderColor: 'rgba(156,39,103,0.4)',
  color: 'var(--text)',
};

function ConfChip({ confidence }) {
  const color = CONF_COLOR[confidence] || '#94a3b8';
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color, marginLeft: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{confidence}</span>
  );
}

const fmt = {
  pct: (v) => (v || v === 0 ? v.toFixed(1) + '%' : '—'),
  rr: (v) => (v ? v.toFixed(2) : '—'),
  rp: (v) => (v || v === 0 ? v.toFixed(2) + '%' : '—'),
};

function riskStability(score) {
  if (score >= 60) return { label: 'Stable sizing', color: '#16a34a' };
  if (score >= 40) return { label: 'Moderate variance', color: '#f59e0b' };
  return { label: 'High variance', color: '#dc2626' };
}

function MiniTable({ title, rows, columns }) {
  if (!rows.length) return null;
  return (
    <div style={{ flex: '1 1 260px', minWidth: 0 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <td style={{ padding: '7px 10px 7px 0', fontWeight: 600 }}>{columns[0].render(r)}</td>
              {columns.slice(1).map((c) => (
                <td key={c.key} style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RiskExecutionIntelligence() {
  const { trades } = useData();
  const { allAccounts, selectedAccount } = useAccounts();
  const [period, setPeriod] = useState('all');

  const data = useMemo(() => computeRiskExecutionIntelligence(trades.items, period), [trades.items, period]);
  const scopeLabel = allAccounts ? 'All Accounts' : selectedAccount?.name || 'Selected Account';
  const rs = riskStability(data.riskScore);

  const renderBody = () => {
    if (data.decidedCount < MIN_LIMITED) {
      return (
        <div style={{ marginTop: 16 }}>
          <EmptyState icon={ShieldAlert} title="Not enough risk data yet" message={`Log at least ${MIN_LIMITED} winning or losing trades to unlock risk & execution intelligence.`} />
        </div>
      );
    }

    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text)', flexWrap: 'wrap', marginBottom: 12 }}>
          <Gauge size={15} color={rs.color} />
          <span style={{ fontWeight: 700, color: rs.color }}>{rs.label}</span>
          <span style={{ color: 'var(--text-faint)' }}>
            · avg risk {fmt.rp(data.avgRisk)} across {data.riskCount} sized trades (threshold: {MIN_EMERGING}+ for confidence).
          </span>
        </div>

        {data.insights.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
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

        {data.riskCount === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, background: 'rgba(148,163,184,0.12)', fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span>No risk % is recorded on your trades yet — many insights here size their claims on risk-percent data.</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          <MiniTable
            title="Risk by Session"
            rows={data.riskBySession}
            columns={[
              { key: 'name', render: (r) => r.name },
              { key: 'count', render: (r) => `${r.count}` },
              { key: 'risk', render: (r) => <span className="mono">{fmt.rp(r.avgRisk)}</span> },
            ]}
          />
          <MiniTable
            title="Risk by Model / Setup"
            rows={data.riskByModel}
            columns={[
              { key: 'name', render: (r) => r.name },
              { key: 'count', render: (r) => `${r.count}` },
              { key: 'risk', render: (r) => <span className="mono">{fmt.rp(r.avgRisk)}</span> },
            ]}
          />
          {data.perMistake.length > 0 && (
            <MiniTable
              title="Execution: mistake outcomes"
              rows={data.perMistake.slice(0, 6)}
              columns={[
                { key: 'name', render: (r) => r.name },
                { key: 'count', render: (r) => `${r.count}` },
                { key: 'winRate', render: (r) => fmt.pct(r.winRate) },
                { key: 'rr', render: (r) => fmt.rr(r.avgRR) },
              ]}
            />
          )}
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '14px 0 0' }}>
          Insight confidence is {MIN_RELIABLE}+ trades ({MIN_EMERGING}+ for Emerging). All statements are descriptive relationships from your data —
          never claims that risk or mistakes caused an outcome, and never a proposed risk percentage.
        </p>
      </>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <ShieldAlert size={16} color="#e11d48" /> Risk & Execution Intelligence
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.03em' }}>· {scopeLabel}</span>
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 600, marginBottom: 0 }}>
            How your sizing and execution behaviour relate to actual outcomes — interpreted, guarded by sample size, and never a replica of the Risk Analytics KPI cards.
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

      {renderBody()}
    </motion.div>
  );
}