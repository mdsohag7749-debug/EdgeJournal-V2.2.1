import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import { useData } from '../../context/DataContext';
import { useAccounts } from '../../context/AccountContext';
import { formatMoney } from '../../lib/utils';
import { computeSetupIntelligence, MIN_EMERGING, MIN_RELIABLE } from '../../lib/setupIntelligence';
import { Trophy, Layers, AlertTriangle } from 'lucide-react';

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' },
  { value: '30', label: 'Last 30 Days' },
];

const STATUS_COLOR = {
  Strong: '#16a34a',
  Positive: '#22c55e',
  Neutral: '#2563eb',
  Weak: '#f59e0b',
  'Limited Data': '#94a3b8',
};

const CONFIDENCE_COLOR = { Reliable: '#16a34a', Emerging: '#2563eb', Limited: '#94a3b8' };

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

const fmt = {
  pct: (v) => (v || v === 0 ? v.toFixed(1) + '%' : '—'),
  money: (v) => formatMoney(v),
  rr: (v) => (v ? v.toFixed(2) : '—'),
  num: (v) => `${Math.round(v)}`,
};

function StatusChip({ status }) {
  const base = status.split(' (')[0];
  const color = STATUS_COLOR[base] || '#94a3b8';
  const risky = status.includes('High Risk');
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        padding: '3px 8px',
        borderRadius: 7,
        background: `${color}${risky ? '26' : '14'}`,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {base}
      {risky && <AlertTriangle size={11} style={{ marginLeft: 1 }} />}
    </span>
  );
}

function ConfidenceTag({ confidence }) {
  const color = CONFIDENCE_COLOR[confidence] || '#94a3b8';
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color, marginLeft: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
      {confidence}
    </span>
  );
}

export default function SetupIntelligence() {
  const { trades } = useData();
  const { allAccounts, selectedAccount } = useAccounts();
  const [period, setPeriod] = useState('all');

  const data = useMemo(() => computeSetupIntelligence(trades.items, period), [trades.items, period]);
  const scopeLabel = allAccounts ? 'All Accounts' : selectedAccount?.name || 'Selected Account';

  const renderBody = () => {
    if (!data.anyModelAssigned || !data.models.length) {
      const message =
        data.decidedCount === 0
          ? 'Log a few trades with a win/loss outcome to unlock setup analysis.'
          : 'Assign a Model / Setup to your trades (in the Log Trade form) to unlock per-setup performance here.';
      return (
        <div style={{ marginTop: 16 }}>
          <EmptyState icon={Layers} title="No setups to analyse yet" message={message} />
        </div>
      );
    }

    const limitedOnly = !data.best; // every setup is still too small a sample to crown a "best"
    const sorted = [...data.models].sort(
      (a, b) => (a.status === 'Limited Data' ? 1 : 0) - (b.status === 'Limited Data' ? 1 : 0) || a.rank - b.rank
    );

    return (
      <>
        {data.insights.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {data.insights.map((ins) => (
              <div key={ins.claim} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.45 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    background: ins.signal === 'warning' ? '#f59e0b' : ins.signal === 'positive' ? '#16a34a' : '#2563eb',
                    marginTop: 6,
                    flexShrink: 0,
                  }}
                />
                <span>{ins.claim}</span>
              </div>
            ))}
          </div>
        )}

        {limitedOnly && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, background: 'rgba(148,163,184,0.12)', fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span>
              None of your setups has reached {MIN_EMERGING} decided trades yet, so nothing is crowned "best". The table below is informational only.
            </span>
          </div>
        )}

        {data.best && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated, rgba(255,255,255,0.02))',
              marginBottom: 14,
            }}
          >
            <span style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(22,163,74,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Trophy size={16} color="#16a34a" />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                Best Current Setup
              </div>
              <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700, marginTop: 1 }}>
                {data.best.name}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 2 }}>
                {fmt.pct(data.best.winRate)} win rate · {fmt.money(data.best.expectancy)} expectancy/trade ·{' '}
                {data.best.riskWarning ? 'high relative risk — size with care' : 'balanced risk profile'}
              </div>
            </div>
          </motion.div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                <th style={{ padding: '0 10px 10px 0' }}>#</th>
                <th style={{ padding: '0 10px 10px' }}>Setup</th>
                <th style={{ padding: '0 10px 10px' }}>Trades</th>
                <th style={{ padding: '0 10px 10px' }}>Win Rate</th>
                <th style={{ padding: '0 10px 10px' }}>Expectancy</th>
                <th style={{ padding: '0 10px 10px' }}>Avg R:R</th>
                <th style={{ padding: '0 10px 10px' }}>Net P&L</th>
                <th style={{ padding: '0 0 10px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.name} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '9px 10px 9px 0', color: 'var(--text-faint)', fontWeight: 700 }}>
                    {m.status === 'Limited Data' ? '—' : m.rank}
                  </td>
                  <td style={{ padding: '9px 10px', fontWeight: 600 }}>
                    {m.name}
                    <ConfidenceTag confidence={m.confidence} />
                  </td>
                  <td style={{ padding: '9px 10px' }}>{m.decided}</td>
                  <td style={{ padding: '9px 10px' }}>{fmt.pct(m.winRate)}</td>
                  <td className="mono" style={{ padding: '9px 10px', fontWeight: 600 }}>
                    <span className={m.expectancy >= 0 ? 'pnl-pos' : 'pnl-neg'}>{fmt.money(m.expectancy)}</span>
                  </td>
                  <td style={{ padding: '9px 10px' }}>{fmt.rr(m.avgRR)}</td>
                  <td className="mono" style={{ padding: '9px 10px', fontWeight: 600 }}>
                    <span className={m.netPnl >= 0 ? 'pnl-pos' : 'pnl-neg'}>{fmt.money(m.netPnl)}</span>
                  </td>
                  <td style={{ padding: '9px 0' }}>
                    <StatusChip status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '12px 0 0' }}>
          Ranking uses a balanced composite of win rate, expectancy, average R:R and profit factor — never P&L alone. A setup is
          &quot;Reliable&quot; at {MIN_RELIABLE}+ decided trades and &quot;Emerging&quot; from {MIN_EMERGING}; anything smaller is Limited Data.
        </p>
      </>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Layers size={16} color="#c026d3" /> Setup / Model Performance
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.03em' }}>· {scopeLabel}</span>
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 600, marginBottom: 0 }}>
            Which of your trading models are actually paying off — ranked by a balanced score, heavily guarded by minimum sample size.
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