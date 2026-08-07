import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import StatCard from '../StatCard';
import { useData } from '../../context/DataContext';
import { useAccounts } from '../../context/AccountContext';
import { formatMoney } from '../../lib/utils';
import { FOCUS_PERIODS, computePerformanceInsights } from '../../lib/performanceInsights';
import {
  Trophy,
  TrendingDown,
  TrendingUp,
  CalendarDays,
  Scale,
  Flame,
  Snowflake,
  Activity,
  BrainCircuit,
} from 'lucide-react';

const WIN = '#16a34a';
const LOSS = '#dc2626';

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

// Summarises a group row (pair / session / day) into a subtitle line.
function groupSub(g) {
  if (!g) return '';
  const winRate = g.winRate !== undefined ? ` · ${g.winRate.toFixed(1)}% win` : '';
  const trades = g.trades ? ` · ${g.trades} trades` : '';
  return `${formatMoney(g.netPnl ?? 0)} net${winRate}${trades}`;
}

export default function PerformanceIntelligence() {
  const { trades } = useData();
  const { allAccounts, selectedAccount } = useAccounts();
  const [period, setPeriod] = useState('all');

  const insight = useMemo(() => computePerformanceInsights(trades.items, period), [trades.items, period]);
  const scopeLabel = allAccounts ? 'All Accounts' : selectedAccount?.name || 'Selected Account';

  const cards = useMemo(
    () => [
      {
        key: 'best-pair',
        label: 'Best Performing Pair',
        icon: Trophy,
        accent: WIN,
        value: insight.bestPair?.label || '—',
        sub: insight.bestPair ? groupSub(insight.bestPair) : 'No decided trades yet',
      },
      {
        key: 'worst-pair',
        label: 'Worst Performing Pair',
        icon: TrendingDown,
        accent: LOSS,
        value: insight.worstPair?.label || '—',
        sub: insight.worstPair ? groupSub(insight.worstPair) : 'No decided trades yet',
      },
      {
        key: 'best-session',
        label: 'Best Trading Session',
        icon: TrendingUp,
        accent: '#2563eb',
        value: insight.bestSession?.label || '—',
        sub: insight.bestSession ? groupSub(insight.bestSession) : 'No decided trades yet',
      },
      {
        key: 'best-day',
        label: 'Best Trading Day',
        icon: CalendarDays,
        accent: '#C1121F',
        value: insight.bestDay?.label || '—',
        sub: insight.bestDay ? groupSub(insight.bestDay) : 'No decided trades yet',
      },
      {
        key: 'avg-rr',
        label: 'Average RR',
        icon: Scale,
        accent: '#7c3aed',
        value: insight.avgRR,
        format: (v) => (insight.total ? (v ? v.toFixed(2) : '0.00') : '—'),
        sub: `${insight.total} trade${insight.total === 1 ? '' : 's'} reviewed`,
      },
      {
        key: 'win-streak',
        label: 'Current Win Streak',
        icon: Flame,
        accent: WIN,
        value: insight.winStreak,
        format: (v) => (insight.total ? `${Math.round(v)}` : '—'),
        sub: insight.winStreak > 0 ? 'Keep it going' : insight.total ? 'No active win streak' : 'Log trades to begin',
      },
      {
        key: 'loss-streak',
        label: 'Current Loss Streak',
        icon: Snowflake,
        accent: LOSS,
        value: insight.lossStreak,
        format: (v) => (insight.total ? `${Math.round(v)}` : '—'),
        sub: insight.lossStreak > 0 ? 'Reset it next trade' : insight.total ? 'No active loss streak' : 'Log trades to begin',
      },
      {
        key: 'biggest-win',
        label: 'Biggest Win',
        icon: Trophy,
        accent: WIN,
        value: insight.biggestWin,
        format: (v) => (insight.total ? formatMoney(v) : '—'),
        valueClass: insight.total ? 'pnl-pos' : undefined,
        sub: 'Largest single profit',
      },
      {
        key: 'biggest-loss',
        label: 'Biggest Loss',
        icon: Activity,
        accent: LOSS,
        value: insight.biggestLoss,
        format: (v) => (insight.total ? formatMoney(v) : '—'),
        valueClass: insight.total ? 'pnl-neg' : undefined,
        sub: 'Largest single drawdown',
      },
    ],
    [insight]
  );

  const hasData = insight.total > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <BrainCircuit size={16} color="#7c3aed" /> Performance Intelligence
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.03em' }}>· {scopeLabel}</span>
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 560 }}>
            A live leaderboard of where your edge is — automatically recomputed from real trade history on every update.
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

      {hasData ? (
        <div className="dash-stats-grid">
          {cards.map((c, i) => (
            <StatCard key={c.key} label={c.label} value={c.value} format={c.format} sub={c.sub} icon={c.icon} accent={c.accent} valueClass={c.valueClass} delay={Math.min(i * 0.04, 0.4)} />
          ))}
        </div>
      ) : (
        <EmptyState icon={Activity} title="Not enough data in this view" message={insight.total > 0 ? 'There are no decided trades in this period yet. Switch period or account to see intelligence.' : 'Log a few trades (with a win/loss outcome) to unlock Performance Intelligence.'} />
      )}
    </motion.div>
  );
}