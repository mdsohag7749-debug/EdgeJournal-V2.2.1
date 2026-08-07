import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import { useData } from '../../context/DataContext';
import { useAccounts } from '../../context/AccountContext';
import { Sparkles } from 'lucide-react';
import { FOCUS_PERIODS } from '../../lib/performanceInsights';
import { computeSmartInsights, INSIGHT_CATEGORIES, MIN_SUPPORT } from '../../lib/smartInsights';

const CATEGORY_COLOR = {
  Performance: '#7c3aed',
  Risk: '#dc2626',
  Execution: '#2563eb',
  Psychology: '#c026d3',
  Mistakes: '#f97316',
  Consistency: '#0ea5e9',
};

const SIGNAL_COLOR = {
  positive: '#16a34a',
  warning: '#f59e0b',
  neutral: '#94a3b8',
};

const SIGNAL_LABEL = { positive: 'Positive', warning: 'Warning', neutral: 'Neutral' };

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

function InsightRow({ insight, delay }) {
  const accent = SIGNAL_COLOR[insight.signal] || '#94a3b8';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay }}
      whileHover={{ y: -2 }}
      className="card"
      style={{
        position: 'relative',
        padding: '16px 18px 15px 20px',
        borderLeft: `3px solid ${accent}`,
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', color: 'var(--text)', textTransform: 'uppercase' }}>{insight.title}</span>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            padding: '2px 8px',
            borderRadius: 7,
            background: `${accent}1a`,
            color: accent,
            flexShrink: 0,
          }}
        >
          {SIGNAL_LABEL[insight.signal]}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
        {insight.claim}
      </p>
      {insight.detail && (
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--text-faint)', lineHeight: 1.45 }}>{insight.detail}</p>
      )}

      {insight.metrics?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {insight.metrics.map((m) => (
            <span
              key={m.label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 9px',
                borderRadius: 8,
                background: `${accent}12`,
                fontSize: 11.5,
                color: 'var(--text-muted)',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--text-faint)' }}>{m.label}</span>
              <span className="mono" style={{ fontWeight: 700, color: 'var(--text)' }}>{m.value}</span>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: insight.metrics?.length > 0 ? 8 : 12 }}>
        <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
          {insight.sample} trade{insight.sample === 1 ? '' : 's'}
        </span>
      </div>
    </motion.div>
  );
}

export default function SmartTradeInsights() {
  const { trades } = useData();
  const { allAccounts, selectedAccount } = useAccounts();
  const [period, setPeriod] = useState('all');

  const result = useMemo(() => computeSmartInsights(trades.items, period), [trades.items, period]);
  const scopeLabel = allAccounts ? 'All Accounts' : selectedAccount?.name || 'Selected Account';

  const byCategory = useMemo(() => {
    const map = {};
    INSIGHT_CATEGORIES.forEach((cat) => (map[cat] = []));
    result.insights.forEach((ins) => {
      if (map[ins.category]) map[ins.category].push(ins);
    });
    return map;
  }, [result]);

  const renderBody = () => {
    if (result.decidedCount < MIN_SUPPORT) {
      return (
        <div style={{ marginTop: 16 }}>
          <EmptyState
            icon={Sparkles}
            title="Not enough decided trades yet"
            message={`Insights unlock once you have at least ${MIN_SUPPORT} winning or losing trades in this view. We never guess from a tiny sample.`}
          />
        </div>
      );
    }

    const cats = INSIGHT_CATEGORIES.filter((cat) => byCategory[cat].length > 0);
    if (!cats.length) {
      return (
        <div style={{ marginTop: 16 }}>
          <EmptyState
            icon={Sparkles}
            title="No strong patterns detected"
            message="You have enough trades, but no reliable edges or risks stand out in this view yet. Keep logging and check back."
          />
        </div>
      );
    }

    let delay = 0;
    return cats.map((cat, ci) => (
      <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: ci ? 6 : 0 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 3,
              background: CATEGORY_COLOR[cat],
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text)' }}>
            {cat}
          </span>
        </div>
        {byCategory[cat].map((insight, i) => {
          const d = delay;
          delay += 0.04;
          return <InsightRow key={`${cat}-${i}`} insight={insight} delay={Math.min(d, 0.4)} />;
        })}
      </div>
    ));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Sparkles size={16} color="#7c3aed" /> Smart Trade Insights
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.03em' }}>· {scopeLabel}</span>
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 600, marginBottom: 0 }}>
            Interpreted observations that point at your edges and leaks — always guarded by a minimum sample so it never talks over a tiny
            trace.
          </p>
        </div>
        <div style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--bg-elevated, rgba(255,255,255,0.02))' }}>
          {FOCUS_PERIODS.map((p) => (
            <button key={p.value} type="button" onClick={() => setPeriod(p.value)} style={{ ...chipBase, ...(period === p.value ? chipActive : {}) }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>{renderBody()}</div>
    </motion.div>
  );
}