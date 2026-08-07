import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import { useData } from '../../context/DataContext';
import { useAccounts } from '../../context/AccountContext';
import { computePatternDetection } from '../../lib/patternDetection';
import { Network, ShieldAlert } from 'lucide-react';

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' },
];

const STRENGTH_COLOR = {
  'Strong Pattern': '#16a34a',
  'Emerging Pattern': '#f59e0b',
  'Limited Data': '#94a3b8',
};
const CONF_COLOR = { High: '#16a34a', Medium: '#f59e0b', Low: '#94a3b8' };

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
  background: 'rgba(13,148,136,0.15)',
  borderColor: 'rgba(13,148,136,0.4)',
  color: 'var(--text)',
};

function StrengthChip({ strength, confidence }) {
  const color = STRENGTH_COLOR[strength] || '#94a3b8';
  const conf = CONF_COLOR[confidence] || '#94a3b8';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flexShrink: 0 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 7, background: `${color}14`, color }}>
        {strength}
      </span>
      <span style={{ fontSize: 10, fontWeight: 600, color: conf, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{confidence}</span>
    </span>
  );
}

export default function PatternDetection() {
  const { trades } = useData();
  const { allAccounts, selectedAccount } = useAccounts();
  const [period, setPeriod] = useState('all');

  const data = useMemo(() => computePatternDetection(trades.items, period), [trades.items, period]);
  const scopeLabel = allAccounts ? 'All Accounts' : selectedAccount?.name || 'Selected Account';

  const renderBody = () => {
    if (data.decidedCount < 3) {
      return (
        <div style={{ marginTop: 16 }}>
          <EmptyState icon={ShieldAlert} title="Not enough trade history yet" message="Pattern detection needs a few winning or losing trades in sequence to find repeated behaviour." />
        </div>
      );
    }

    if (!data.patterns.length) {
      return (
        <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--text-muted)' }}>
          No repeated patterns stood out in the current view yet — your behaviour is varied enough that nothing recurring is detectable here right now.
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 2 }}>
        {data.patterns.slice(0, 10).map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-elevated, rgba(255,255,255,0.02))' }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: (STRENGTH_COLOR[p.strength] || '#94a3b8'), marginTop: 6, flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p.category}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{p.title}</span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--text-faint)', lineHeight: 1.45 }}>{p.detail}</p>
            </div>
            <StrengthChip strength={p.strength} confidence={p.confidence} />
          </div>
        ))}

        <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '6px 0 0' }}>
          These are descriptive patterns observed in your saved history — they describe what has repeatedly happened, never what will happen next.
        </p>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Network size={16} color="#0d9488" /> Trading Pattern Detection
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.03em' }}>· {scopeLabel}</span>
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 600, marginBottom: 0 }}>
            Repeated behavioural and performance patterns in your trade sequence — after losses, after wins, streaks, mistake clusters, psychology, and by session / pair / setup.
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