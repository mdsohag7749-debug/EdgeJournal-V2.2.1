import { motion } from 'framer-motion';
import { Target } from 'lucide-react';

export default function DisciplineScoreWidget({ radarScores }) {
  const entry = (radarScores || []).find((r) => r.subject === 'Discipline');
  const score = entry ? entry.score : 0;

  const label =
    score >= 85 ? 'Elite Discipline'
    : score >= 70 ? 'Strong'
    : score >= 50 ? 'Developing'
    : 'Needs Focus';

  const color = score >= 85 ? 'var(--win)' : score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : 'var(--loss)';
  const bg = score >= 85 ? 'rgba(47,214,110,0.08)' : score >= 70 ? 'rgba(16,185,129,0.08)' : score >= 50 ? 'rgba(245,158,11,0.08)' : 'rgba(255,77,94,0.08)';

  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  // Checklist metrics — derived from the existing radar scores (no new logic).
  const radarMap = {};
  (radarScores || []).forEach((r) => {
    radarMap[r.subject] = r.score;
  });
  const metrics = [
    { label: 'Plan Following', value: radarMap.Discipline ?? 0 },
    { label: 'Risk Management', value: radarMap['Risk Management'] ?? 0 },
    { label: 'Consistency', value: radarMap.Consistency ?? 0 },
    { label: 'Execution', value: radarMap.Execution ?? 0 },
    { label: 'Emotional Control', value: radarMap.Psychology ?? 0 },
    { label: 'Review', value: radarMap.Profitability ?? 0 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="card card-lift"
      style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={18} color="#f59e0b" /> Discipline Score
        </h3>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: bg, color }}>
          {label}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <div style={{ position: 'relative', width: 110, height: 110 }}>
          <svg width="110" height="110" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
            <circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              transform="rotate(-90 40 40)"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span className="mono" style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>
              {score}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              / 100
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
              <span style={{ color: 'var(--text-muted)' }}>{m.label}</span>
              <span className="mono" style={{ fontWeight: 700 }}>{Math.round(m.value)}%</span>
            </div>
            <div style={{ height: 5, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, m.value)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{ height: '100%', background: m.value >= 70 ? 'var(--win)' : m.value >= 50 ? '#f59e0b' : 'var(--loss)', borderRadius: 999 }}
              />
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 2 }}>
        Derived from plan adherence &amp; risk-checklist execution.
      </p>
    </motion.div>
  );
}
