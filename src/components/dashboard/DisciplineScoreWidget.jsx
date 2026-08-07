import { motion, AnimatePresence } from 'framer-motion';
import { Target } from 'lucide-react';

// Mood bands — derived purely from the selected account's real score.
// Never any demo/placeholder values.
const MOODS = [
  {
    min: 0,
    max: 29,
    emoji: '😞',
    label: 'Poor',
    color: '#ff4d5e',
    bg: 'rgba(255,77,94,0.08)',
    message: 'Discipline needs work. Return to your rules and review every deviation from plan.',
  },
  {
    min: 30,
    max: 49,
    emoji: '😕',
    label: 'Needs Work',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    message: "You're building discipline. Keep your pre-trade plan and risk checks consistent.",
  },
  {
    min: 50,
    max: 69,
    emoji: '🙂',
    label: 'Fair',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    gradient: ['#60a5fa', '#3b82f6'],
    message: 'Consolidating. Tighten your checklist adherence to turn fair into consistent.',
  },
  {
    min: 70,
    max: 84,
    emoji: '😊',
    label: 'Good',
    color: '#2fd66e',
    bg: 'rgba(47,214,110,0.08)',
    gradient: ['#34d399', '#2fd66e'],
    message: "Good discipline. Keep following your plan and protecting your edge.",
  },
  {
    min: 85,
    max: 94,
    emoji: '🔥',
    label: 'Excellent',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.08)',
    gradient: ['#fb923c', '#f97316'],
    message: "Excellent discipline. You're executing like a professional.",
  },
  {
    min: 95,
    max: 100,
    emoji: '👑',
    label: 'Elite Discipline',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    gradient: ['#34d399', '#fbbf24'],
    message: "Elite discipline. You're operating with institutional consistency.",
  },
];

export default function DisciplineScoreWidget({ score = 0, metrics = [] }) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));

  const mood = MOODS.find((m) => s >= m.min && s <= m.max) || MOODS[0];

  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - s / 100);

  const scoreMetrics = metrics.length
    ? metrics
    : [
        { label: 'Plan Following', value: 0 },
        { label: 'Rule Compliance', value: 0 },
        { label: 'Consistency', value: 0 },
        { label: 'Emotional Control', value: 0 },
        { label: 'Review & Reflection', value: 0 },
      ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="card card-lift"
      style={{
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        border: '1px solid var(--border)',
        borderTop: `2px solid ${mood.color}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={18} color="#f59e0b" /> Discipline Score
        </h3>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={mood.label}
            initial={{ scale: 0.6, opacity: 0, y: -6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.6, opacity: 0, y: 6 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 999,
              background: mood.bg,
              color: mood.color,
              border: `1px solid ${mood.color}22`,
            }}
          >
            {mood.emoji} {mood.label}
          </motion.span>
        </AnimatePresence>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 22 }}>
        <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
          <svg width="110" height="110" viewBox="0 0 80 80">
            <defs>
              <linearGradient id="moodRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={mood.gradient?.[0] || mood.color} />
                <stop offset="100%" stopColor={mood.gradient?.[1] || mood.color} />
              </linearGradient>
            </defs>
            <circle cx="40" cy="40" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
            <circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              stroke={mood.gradient ? 'url(#moodRingGrad)' : mood.color}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              transform="rotate(-90 40 40)"
              style={{
                transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s ease',
                filter: `drop-shadow(0 0 4px ${mood.color}66)`,
              }}
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
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={s}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                className="mono"
                style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: mood.color }}
              >
                {s}
              </motion.span>
            </AnimatePresence>
            <span style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              / 100
            </span>
          </div>
        </div>

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={mood.label}
            initial={{ scale: 0.4, rotate: -25, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.4, rotate: 25, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              background: mood.bg,
              border: `1px solid ${mood.color}33`,
              boxShadow: `0 0 18px ${mood.color}40`,
              flexShrink: 0,
            }}
          >
            {mood.emoji}
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={mood.message}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            style={{
              fontSize: 12.5,
              color: 'var(--text-muted)',
              textAlign: 'center',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {mood.message}
          </motion.p>
        </AnimatePresence>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {scoreMetrics.map((m) => (
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
    </motion.div>
  );
}
