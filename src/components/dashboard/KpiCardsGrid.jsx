import { useState } from 'react';
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
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatMoney, pnlClass } from '../../lib/utils';

// Subtle micro-sparkline SVG matching the fintech aesthetic from the reference image
function Sparkline({ isPositive, color }) {
  const strokeColor = color || (isPositive ? '#36e0c0' : '#ff4d5e');
  const pathData = isPositive
    ? 'M2 18 C 12 16, 18 10, 26 12 C 34 14, 40 4, 50 2'
    : 'M2 4 C 12 6, 18 14, 26 10 C 34 8, 40 18, 50 18';

  return (
    <svg width="52" height="20" viewBox="0 0 52 20" fill="none" style={{ overflow: 'visible', flexShrink: 0 }}>
      <path
        d={pathData}
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function KpiCardsGrid({ stats }) {
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const cards = [
    {
      title: 'Total P&L',
      value: formatMoney(stats.netPnl),
      valueClass: pnlClass(stats.netPnl),
      icon: Wallet,
      color: stats.netPnl >= 0 ? '#36e0c0' : '#ff4d5e',
      bg: stats.netPnl >= 0 ? 'rgba(54, 224, 192, 0.12)' : 'rgba(255, 77, 94, 0.12)',
      trend: stats.trend ? `${stats.trend.netPnl >= 0 ? '+' : ''}${formatMoney(stats.trend.netPnl)} vs prev` : '+12.5% vs 30d',
      isPositiveTrend: stats.trend ? stats.trend.netPnl >= 0 : stats.netPnl >= 0,
      glow: stats.netPnl >= 0 ? 'rgba(54, 224, 192, 0.15)' : 'rgba(255, 77, 94, 0.15)',
    },
    {
      title: 'Win Rate',
      value: `${stats.tradeWinPct.toFixed(1)}%`,
      icon: Percent,
      color: '#42d9ff',
      bg: 'rgba(66, 217, 255, 0.12)',
      trend: stats.trend ? `${stats.trend.winPct >= 0 ? '+' : ''}${stats.trend.winPct.toFixed(1)}pp vs prev` : `${stats.wins}W / ${stats.losses}L`,
      isPositiveTrend: stats.tradeWinPct >= 50,
      glow: 'rgba(66, 217, 255, 0.15)',
    },
    {
      title: 'Total Trades',
      value: stats.total,
      icon: ListOrdered,
      color: '#38bdf8',
      bg: 'rgba(56, 189, 248, 0.12)',
      trend: `${stats.wins} Won • ${stats.losses} Lost`,
      isPositiveTrend: true,
      glow: 'rgba(56, 189, 248, 0.15)',
    },
    {
      title: 'Avg. R:R',
      value: `${stats.avgRR.toFixed(2)}R`,
      icon: Scale,
      color: '#36e0c0',
      bg: 'rgba(54, 224, 192, 0.12)',
      trend: stats.avgRR >= 1.5 ? 'Optimal Ratio' : 'Target >1.5R',
      isPositiveTrend: stats.avgRR >= 1.5,
      glow: 'rgba(54, 224, 192, 0.15)',
    },
    {
      title: 'Profit Factor',
      value: stats.profitFactor === 99.99 ? '∞' : stats.profitFactor.toFixed(2),
      icon: Gauge,
      color: '#a78bfa',
      bg: 'rgba(167, 139, 250, 0.12)',
      trend: stats.profitFactor >= 1.5 ? 'Strong Edge' : stats.profitFactor >= 1.0 ? 'Breakeven' : 'Needs Work',
      isPositiveTrend: stats.profitFactor >= 1.2,
      glow: 'rgba(167, 139, 250, 0.15)',
    },
    {
      title: 'Expectancy',
      value: formatMoney(stats.expectancy),
      valueClass: pnlClass(stats.expectancy),
      icon: Activity,
      color: stats.expectancy >= 0 ? '#36e0c0' : '#ff4d5e',
      bg: stats.expectancy >= 0 ? 'rgba(54, 224, 192, 0.12)' : 'rgba(255, 77, 94, 0.12)',
      trend: stats.expectancy > 0 ? 'Positive Edge' : 'Negative Edge',
      isPositiveTrend: stats.expectancy > 0,
      glow: stats.expectancy >= 0 ? 'rgba(54, 224, 192, 0.15)' : 'rgba(255, 77, 94, 0.15)',
    },
    {
      title: 'Current Streak',
      value: stats.streak ? `${stats.streak} ${stats.streakType}` : '0',
      icon: Flame,
      color: stats.streakType === 'Win' ? '#36e0c0' : '#ff4d5e',
      bg: stats.streakType === 'Win' ? 'rgba(54, 224, 192, 0.12)' : 'rgba(255, 77, 94, 0.12)',
      trend: stats.bestWinStreak ? `Best: ${stats.bestWinStreak} W` : null,
      isPositiveTrend: stats.streakType === 'Win',
      glow: stats.streakType === 'Win' ? 'rgba(54, 224, 192, 0.15)' : 'rgba(255, 77, 94, 0.15)',
    },
    {
      title: 'Max Drawdown',
      value: formatMoney(-Math.abs(stats.maxDrawdown)),
      valueClass: 'pnl-neg',
      icon: ShieldAlert,
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.12)',
      trend: 'Peak-to-Trough',
      isPositiveTrend: false,
      glow: 'rgba(245, 158, 11, 0.15)',
    },
    {
      title: 'Average Win',
      value: formatMoney(stats.avgWin),
      valueClass: 'pnl-pos',
      icon: Trophy,
      color: '#36e0c0',
      bg: 'rgba(54, 224, 192, 0.12)',
      trend: 'Avg Profit',
      isPositiveTrend: true,
      glow: 'rgba(54, 224, 192, 0.15)',
    },
    {
      title: 'Average Loss',
      value: formatMoney(-Math.abs(stats.avgLoss)),
      valueClass: 'pnl-neg',
      icon: Award,
      color: '#ff4d5e',
      bg: 'rgba(255, 77, 94, 0.12)',
      trend: 'Avg Risk',
      isPositiveTrend: false,
      glow: 'rgba(255, 77, 94, 0.15)',
    },
    {
      title: 'Best Day',
      value: formatMoney(stats.bestDay),
      valueClass: 'pnl-pos',
      icon: TrendingUp,
      color: '#36e0c0',
      bg: 'rgba(54, 224, 192, 0.12)',
      trend: 'Peak Session',
      isPositiveTrend: true,
      glow: 'rgba(54, 224, 192, 0.15)',
    },
    {
      title: 'Worst Day',
      value: formatMoney(stats.worstDay),
      valueClass: 'pnl-neg',
      icon: TrendingDown,
      color: '#ff4d5e',
      bg: 'rgba(255, 77, 94, 0.12)',
      trend: 'Max Loss Session',
      isPositiveTrend: false,
      glow: 'rgba(255, 77, 94, 0.15)',
    },
  ];

  const visibleCards = showAllMetrics ? cards : cards.slice(0, 4);

  return (
    <section className="dash-kpi-section" aria-label="Trading performance overview">
      <motion.div
        layout="size"
        transition={{ layout: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }}
        className="dash-kpi-grid"
      >
      {visibleCards.map((c, i) => {
        const Icon = c.icon;
        return (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="card dash-kpi-card"
            style={{
              padding: i < 4 ? '20px 20px 18px' : '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              background: `linear-gradient(145deg, ${c.glow} 0%, rgba(17, 29, 48, 0.68) 58%, rgba(9, 16, 29, 0.62) 100%)`,
              backdropFilter: 'blur(22px) saturate(145%)',
              WebkitBackdropFilter: 'blur(22px) saturate(145%)',
              border: '1px solid rgba(205, 231, 255, 0.14)',
              borderRadius: 20,
              boxShadow: '0 16px 38px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.07)',
            }}
          >
            {/* Header row: title & icon badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>{c.title}</span>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: c.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: c.color,
                  boxShadow: `0 0 12px ${c.glow || 'transparent'}`,
                }}
              >
                <Icon size={16} strokeWidth={2.2} />
              </div>
            </div>

            {/* Financial metric value */}
            <div
              className={`mono ${c.valueClass || ''}`}
              style={{
                fontSize: i < 4 ? 25 : 21,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: c.valueClass ? undefined : '#f8fafc',
                lineHeight: 1.2,
              }}
            >
              {c.value}
            </div>

            {/* Trend & micro-sparkline row */}
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              {c.trend ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: c.isPositiveTrend ? '#36e0c0' : 'var(--text-muted)',
                  }}
                >
                  {c.isPositiveTrend ? <ArrowUpRight size={13} color="#36e0c0" /> : <ArrowDownRight size={13} color="#ff4d5e" />}
                  <span>{c.trend}</span>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Steady</div>
              )}

              <Sparkline isPositive={c.isPositiveTrend} color={c.color} />
            </div>
          </motion.div>
        );
      })}
      </motion.div>
      {cards.length > 4 && (
        <motion.button
          type="button"
          className="btn btn-ghost btn-sm dash-more-metrics"
          aria-expanded={showAllMetrics}
          onClick={() => setShowAllMetrics((value) => !value)}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
        >
          {showAllMetrics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showAllMetrics ? 'Show fewer metrics' : `Show ${cards.length - 4} more metrics`}
        </motion.button>
      )}
    </section>
  );
}
