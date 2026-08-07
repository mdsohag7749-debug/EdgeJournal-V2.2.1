import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import { useData } from '../../context/DataContext';
import { useAccounts } from '../../context/AccountContext';
import { computeRecommendations, MAX_RECOMMENDATIONS } from '../../lib/recommendations';
import { Lightbulb, MessageSquareWarning } from 'lucide-react';

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' },
];

const PRIORITY_COLOR = { High: '#dc2626', Medium: '#f59e0b', Low: '#94a3b8' };
const CATEGORY_COLOR = {
  Performance: '#2563eb', Risk: '#dc2626', Execution: '#c026d3', Psychology: '#7c3aed',
  Discipline: '#16a34a', Setup: '#ca8a04', Session: '#e07b00', Pair: '#0ea5e9',
};

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
  background: 'rgba(245,158,11,0.15)',
  borderColor: 'rgba(245,158,11,0.4)',
  color: 'var(--text)',
};

export default function Recommendations() {
  const { trades } = useData();
  const { allAccounts, selectedAccount } = useAccounts();
  const [period, setPeriod] = useState('all');

  const data = useMemo(() => computeRecommendations(trades.items, period), [trades.items, period]);
  const scopeLabel = allAccounts ? 'All Accounts' : selectedAccount?.name || 'Selected Account';

  const renderBody = () => {
    if (data.limited) {
      return (
        <div style={{ marginTop: 16 }}>
          <EmptyState icon={Lightbulb} title="Not enough data for recommendations" message="Recommendations unlock once you have enough decided trades (log wins and losses) to ground them in real patterns." />
        </div>
      );
    }

    if (!data.recommendations.length) {
      return (
        <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--text-muted)' }}>
          No new actions stand out in the current view — the patterns here are already small or balanced enough that nothing urgent needs adjusting.
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 2 }}>
        {data.recommendations.map((r, i) => {
          const cat = CATEGORY_COLOR[r.category] || '#94a3b8';
          const pr = PRIORITY_COLOR[r.priority] || '#94a3b8';
          return (
            <motion.div key={`${r.category}-${r.title}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
              style={{ padding: '13px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-elevated, rgba(255,255,255,0.02))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: cat, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{r.category}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{r.title}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: pr, textTransform: 'uppercase', letterSpacing: '0.03em', border: `1px solid ${pr}44`, padding: '2px 7px', borderRadius: 6, background: `${pr}1a` }}>{r.priority}</span>
              </div>

              <p style={{ margin: '0 0 4px', fontSize: 12.5, color: 'var(--text)', lineHeight: 1.45 }}>{r.explanation}</p>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.45, padding: '9px 11px', borderRadius: 9, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)' }}>
                <MessageSquareWarning size={15} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                <span><span style={{ fontWeight: 800 }}>Suggested action: </span>{r.action}</span>
              </div>

              <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.4 }}>
                Evidence: {r.evidence}
              </p>
            </motion.div>
          );
        })}

        <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '4px 0 0' }}>
          Decision-support only — based on your actual history, never a signal or a forecast. Showing the top {MAX_RECOMMENDATIONS} highest-value items.
        </p>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Lightbulb size={16} color="#f59e0b" /> Action Recommendations
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.03em' }}>· {scopeLabel}</span>
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 600, marginBottom: 0 }}>
            Turning your detected patterns into practical next steps — decision support, never a signal generator.
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