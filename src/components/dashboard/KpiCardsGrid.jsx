import { motion } from 'framer-motion';
import {
  Wallet,
  Percent,
  Scale,
  Gauge,
  ListOrdered,
  TrendingUp,
  TrendingDown,
  Trophy,
  Flame,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Award,
} from 'lucide-react';
import { formatMoney, pnlClass } from '../../lib/utils';

export default function KpiCardsGrid({ stats }) {
  const cards = [
    {
      title: 'Net P&L',
      value: formatMoney(stats.netPnl),
      valueClass: pnlClass(stats.netPnl),
      icon: Wallet,
      color: stats.netPnl >= 0 ? 'var(--win)' : 'var(--loss)',
      bg: stats.netPnl >= 0 ? 'rgba(47, 214, 110, 0.08)' : 'rgba(255, 77, 94, 0.08)',
      trend: stats.trend ? `${stats.trend.netPnl >= 0 ? '+' : ''}${formatMoney(stats.trend.netPnl)} vs prev` : null,
      isPositiveTrend: stats.trend ? stats.trend.netPnl >= 0 : true,
    },
    {
      title: 'Win Rate',
      value: `${stats.tradeWinPct.toFixed(1)}%`,
      icon: Percent,
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.08)',
      trend: stats.trend ? `${stats.trend.winPct >= 0 ? '+' : ''}${stats.trend.winPct.toFixed(1)}pp vs prev` : null,
      isPositiveTrend: stats.trend ? stats.trend.winPct >= 0 : true,
    },
    {
      title: 'Profit Factor',
      value: stats.profitFactor === 99.99 ? '∞' : stats.profitFactor.toFixed(2),
      icon: Gauge,
      color: '#8b5cf6',
      bg: 'rgba(139, 92, 246, 0.08)',
      trend: stats.profitFactor >= 1.5 ? 'Strong Edge' : stats.profitFactor >= 1.0 ? 'Breakeven' : 'Needs Work',
      isPositiveTrend: stats.profitFactor >= 1.2,
    },
    {
      title: 'Average R:R',
      value: `${stats.avgRR.toFixed(2)}R`,
      icon: Scale,
      color: '#ec4899',
      bg: 'rgba(236, 72, 153, 0.08)',
      trend: stats.avgRR >= 1.5 ? 'Optimal' : 'Low RR',
      isPositiveTrend: stats.avgRR >= 1.5,
    },
    {
      title: 'Expectancy',
      value: formatMoney(stats.expectancy),
      valueClass: pnlClass(stats.expectancy),
      icon: Activity,
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.08)',
      trend: stats.expectancy > 0 ? 'Positive Edge' : 'Negative Edge',
      isPositiveTrend: stats.expectancy > 0,
    },
    {
      title: 'Total Trades',
      value: stats.total,
      icon: ListOrdered,
      color: '#6366f1',
      bg: 'rgba(99, 102, 241, 0.08)',
      trend: `${stats.wins}W - ${stats.losses}L`,
      isPositiveTrend: true,
    },
    {
      title: 'Current Streak',
      value: stats.streak ? `${stats.streak} ${stats.streakType}` : '0',
      icon: Flame,
      color: stats.streakType === 'Win' ? 'var(--win)' : 'var(--loss)',
      bg: stats.streakType === 'Win' ? 'rgba(47, 214, 110, 0.08)' : 'rgba(255, 77, 94, 0.08)',
      trend: stats.bestWinStreak ? `Best: ${stats.bestWinStreak} W` : null,
      isPositiveTrend: stats.streakType === 'Win',
    },
    {
      title: 'Best Day',
      value: formatMoney(stats.bestDay),
      valueClass: 'pnl-pos',
      icon: TrendingUp,
      color: 'var(--win)',
      bg: 'rgba(47, 214, 110, 0.08)',
      trend: 'Peak Session',
      isPositiveTrend: true,
    },
    {
      title: 'Worst Day',
      value: formatMoney(stats.worstDay),
      valueClass: 'pnl-neg',
      icon: TrendingDown,
      color: 'var(--loss)',
      bg: 'rgba(255, 77, 94, 0.08)',
      trend: 'Max Loss Session',
      isPositiveTrend: false,
    },
    {
      title: 'Max Drawdown',
      value: formatMoney(-Math.abs(stats.maxDrawdown)),
      valueClass: 'pnl-neg',
      icon: ShieldAlert,
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.08)',
      trend: 'Peak-to-Trough',
      isPositiveTrend: false,
    },
    {
      title: 'Average Win',
      value: formatMoney(stats.avgWin),
      valueClass: 'pnl-pos',
      icon: Trophy,
      color: 'var(--win)',
      bg: 'rgba(47, 214, 110, 0.08)',
      trend: 'Avg Profit',
      isPositiveTrend: true,
    },
    {
      title: 'Average Loss',
      value: formatMoney(-Math.abs(stats.avgLoss)),
      valueClass: 'pnl-neg',
      icon: Award,
      color: 'var(--loss)',
      bg: 'rgba(255, 77, 94, 0.08)',
      trend: 'Avg Risk',
      isPositiveTrend: false,
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))',
        gap: 16,
      }}
    >
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.03 }}
            className="card card-lift"
            style={{
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              background: 'var(--card)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>{c.title}</span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: c.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: c.color,
                }}
              >
                <Icon size={16} />
              </div>
            </div>

            <div className={`mono ${c.valueClass || ''}`} style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {c.value}
            </div>

            {c.trend && (
              <div
                style={{
                  marginTop: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: c.isPositiveTrend ? 'var(--win)' : 'var(--text-muted)',
                }}
              >
                {c.isPositiveTrend ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                <span>{c.trend}</span>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
