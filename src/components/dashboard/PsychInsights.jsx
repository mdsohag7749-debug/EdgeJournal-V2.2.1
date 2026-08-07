import { useMemo } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import { useData } from '../../context/DataContext';
import { computePsychologyInsights } from '../../lib/psychInsights';
import { TrendingUp, Info, AlertTriangle, Lightbulb, Activity } from 'lucide-react';

const SIGNAL = {
  positive: { icon: TrendingUp, color: '#16a34a', label: 'Strength' },
  info: { icon: Info, color: '#2563eb', label: 'Insight' },
  watch: { icon: AlertTriangle, color: '#f59e0b', label: 'Watch' },
};
const BLUE = '#2563eb';

export default function PsychologyInsights() {
  const { trades } = useData();
  const { insights, sourceCount } = useMemo(() => computePsychologyInsights(trades.items), [trades.items]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Lightbulb size={16} color="#f59e0b" />
        <h3 className="section-title" style={{ margin: 0 }}>
          Psychology Insights
        </h3>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-faint)', margin: '6px 0 0', maxWidth: 620 }}>
        Auto-generated from your real trade history — pure statistics, no AI. {sourceCount} trades analysed.
      </p>

      {insights.length === 0 ? (
        <div style={{ marginTop: 16 }}>
          <EmptyState icon={Activity} title="Not enough psychology data" message="Rate your emotions and log mistakes on more trades to surface psychological patterns." />
        </div>
      ) : (
        <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 14, marginTop: 16 }}>
          {insights.map((ins, i) => {
            const S = SIGNAL[ins.type] || SIGNAL.info;
            const Icon = S.icon;
            return (
              <motion.div
                key={ins.key}
                variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.3 }}
                className="card"
                style={{
                  padding: 16,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${S.color}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{ins.title}</span>
                  <span className="tag" style={{ background: `${S.color}1a`, color: S.color, borderColor: 'transparent' }}>
                    <Icon size={12} /> {S.label}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>{ins.claim}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{ins.detail}</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ins.metrics.map((m, mi) => (
                    <span key={mi} className="tag" style={{ background: `${BLUE}12`, color: 'var(--text)', borderColor: 'transparent', fontSize: 11.5 }}>
                      {m.label}: <b>{m.value}</b>
                    </span>
                  ))}
                  <span className="tag" style={{ background: 'transparent', color: 'var(--text-faint)', borderColor: 'transparent', fontSize: 11 }}>
                    n={ins.sample}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}