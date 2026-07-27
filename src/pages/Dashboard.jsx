import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useData } from '../context/DataContext';
import { computeDashboardStats } from '../lib/calculations';
import Hero from '../components/Hero';
import StatCard from '../components/StatCard';
import TodaysObjectives from '../components/TodaysObjectives';
import QuickActions from '../components/QuickActions';
import RecentActivity from '../components/RecentActivity';
import EmptyState from '../components/EmptyState';
import CalendarHeatmap from '../components/CalendarHeatmap';
import { formatMoney, formatMoneyShort, pnlClass } from '../lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  Wallet,
  Percent,
  Scale,
  Gauge,
  ListOrdered,
  TrendingUp,
  TrendingDown,
  Trophy,
  Gem,
  BarChart3,
} from 'lucide-react';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12.5 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Trade #{label}</div>
      <div className={pnlClass(val)}>{formatMoney(val)}</div>
    </div>
  );
}

function DisciplineScore() {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="card card-lift"
      style={{ padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}
    >
      <h3 className="section-title" style={{ alignSelf: 'flex-start' }}>
        <Gem size={16} color="var(--red)" /> Discipline Score
      </h3>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--border)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="56" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text-faint)">
          —
        </text>
        <text x="60" y="72" textAnchor="middle" fontSize="9.5" fill="var(--text-faint)">
          Coming Soon
        </text>
      </svg>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center' }}>
        Discipline scoring is still being calibrated.
      </p>
    </motion.div>
  );
}

function SummaryRow({ label, value, valueClass }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
      <span className={valueClass ? `mono ${valueClass}` : ''} style={{ fontWeight: 600, fontSize: 13.5 }}>
        {value}
      </span>
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  const { trades, plans, reflections, study, goals, accountName, setAccountName } = useData();
  const stats = useMemo(() => computeDashboardStats(trades.items), [trades.items]);

  const firstTradeDate = trades.items.length
    ? [...trades.items].sort((a, b) => a.date.localeCompare(b.date))[0]?.date
    : null;

  const trendFor = (key) => {
    if (!stats.trend) return null;
    const delta = stats.trend[key];
    if (delta === undefined || Math.abs(delta) < 0.005) return { direction: 'flat', label: '' };
    return {
      direction: delta > 0 ? 'up' : 'down',
      label: key === 'winPct' ? `${Math.abs(delta).toFixed(1)}pp` : formatMoneyShort(Math.abs(delta)),
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <Hero accountName={accountName} setAccountName={setAccountName} streak={stats.streak} streakType={stats.streakType} />

      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>EdgeJournal Dashboard</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>Trade with discipline. Improve with data.</p>
      </div>

      {/* objectives + discipline */}
      <div className="dash-two-col">
        <TodaysObjectives goals={goals.items} onNavigate={onNavigate} />
        <DisciplineScore />
      </div>

      {/* quick actions + recent activity */}
      <div className="dash-two-col-reverse">
        <RecentActivity
          trades={trades.items}
          plans={plans.items}
          reflections={reflections.items}
          study={study.items}
          goals={goals.items}
          onNavigate={onNavigate}
        />
        <QuickActions onNavigate={onNavigate} />
      </div>

      {trades.items.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No trades logged yet"
          message="Log your first trade in the Trading Journal to unlock your performance analytics, equity curve, and streaks."
          actionLabel="Add Your First Trade"
          onAction={() => onNavigate?.('journal')}
        />
      ) : (
        <>
          {/* 8 analytics cards */}
          <div className="dash-stats-grid">
            <StatCard
              label="Current Equity"
              value={stats.netPnl}
              format={formatMoney}
              valueClass={pnlClass(stats.netPnl)}
              icon={Wallet}
              accent="#2563eb"
              delay={0}
            />
            <StatCard
              label="Net P&L"
              value={stats.netPnl}
              format={formatMoney}
              valueClass={pnlClass(stats.netPnl)}
              icon={stats.netPnl >= 0 ? TrendingUp : TrendingDown}
              accent={stats.netPnl >= 0 ? '#16a34a' : '#dc2626'}
              trend={trendFor('netPnl')}
              delay={0.03}
            />
            <StatCard
              label="Win Rate"
              value={stats.tradeWinPct}
              format={(v) => `${v.toFixed(1)}%`}
              icon={Percent}
              accent="#16a34a"
              trend={trendFor('winPct')}
              delay={0.06}
            />
            <StatCard
              label="Profit Factor"
              value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor || 0}
              format={(v) => (typeof v === 'number' ? v.toFixed(2) : v)}
              icon={Gauge}
              accent="#7c3aed"
              delay={0.09}
            />
            <StatCard
              label="Average R:R"
              value={stats.avgRR || 0}
              format={(v) => (v ? v.toFixed(2) : '—')}
              icon={Scale}
              accent="#2563eb"
              delay={0.12}
            />
            <StatCard label="Total Trades" value={stats.total} format={(v) => Math.round(v)} icon={ListOrdered} accent="#7c3aed" delay={0.15} />
            <StatCard
              label="Largest Win"
              value={stats.bestTrade}
              format={formatMoney}
              valueClass="pnl-pos"
              icon={Trophy}
              accent="#16a34a"
              delay={0.18}
            />
            <StatCard
              label="Largest Loss"
              value={stats.worstTrade}
              format={formatMoney}
              valueClass="pnl-neg"
              icon={TrendingDown}
              accent="#dc2626"
              delay={0.21}
            />
          </div>

          {/* Equity curve */}
          <div className="card card-lift" style={{ padding: 22 }}>
            <h3 className="section-title" style={{ marginBottom: 14 }}>
              Equity Curve
            </h3>
            {stats.equityCurve.length ? (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart data={stats.equityCurve} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C1121F" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#C1121F" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
                    <XAxis dataKey="index" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} tickLine={false} />
                    <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatMoneyShort(v)} width={64} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="equity" stroke="#C1121F" strokeWidth={2.5} fill="url(#equityFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state">
                <h3>No trades yet</h3>
                <p>Log your first trade to see your equity curve build over time.</p>
              </div>
            )}
          </div>

          {/* Calendar heatmap - full width */}
          <CalendarHeatmap dayMap={stats.dayMap} />

          {/* Breakdown pie + account summary */}
          <div className="dash-two-col-even">
            <div className="card card-lift" style={{ padding: 22 }}>
              <h3 className="section-title" style={{ marginBottom: 14 }}>
                Trade Breakdown
              </h3>
              {stats.breakdown.length ? (
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={stats.breakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={3}>
                        {stats.breakdown.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="var(--card)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: 12.5, color: 'var(--text-muted)' }} />
                      <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12.5 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No trades logged yet.</p>
                </div>
              )}
            </div>

            <div className="card card-lift" style={{ padding: 22 }}>
              <h3 className="section-title" style={{ marginBottom: 14 }}>
                Account Summary
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <SummaryRow label="Account Name" value={accountName} />
                <SummaryRow label="Total Trades" value={stats.total} />
                <SummaryRow label="Total Wins" value={stats.wins} valueClass="pnl-pos" />
                <SummaryRow label="Total Losses" value={stats.losses} valueClass="pnl-neg" />
                <SummaryRow label="Current Win Rate" value={`${stats.tradeWinPct.toFixed(1)}%`} />
                <SummaryRow label="Average R:R" value={stats.avgRR ? stats.avgRR.toFixed(2) : '—'} />
                <SummaryRow
                  label="Current Streak"
                  value={stats.streak ? `${stats.streak}${stats.streakType === 'Win' ? 'W' : 'L'}` : '—'}
                  valueClass={stats.streakType === 'Win' ? 'pnl-pos' : stats.streakType === 'Loss' ? 'pnl-neg' : undefined}
                />
                <SummaryRow label="Best Streak" value={stats.bestWinStreak ? `${stats.bestWinStreak}W` : '—'} valueClass="pnl-pos" />
                <SummaryRow label="Active Since" value={firstTradeDate || '—'} />
              </div>
            </div>
          </div>

          {/* Model performance */}
          <div className="card card-lift" style={{ padding: 22 }}>
            <h3 className="section-title" style={{ marginBottom: 14 }}>
              Model Performance
            </h3>
            {stats.modelPerformance.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      <th style={{ padding: '0 10px 10px 0' }}>Model</th>
                      <th style={{ padding: '0 10px 10px' }}>Trades</th>
                      <th style={{ padding: '0 10px 10px' }}>Win Rate</th>
                      <th style={{ padding: '0 10px 10px' }}>Net P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.modelPerformance.map((m) => (
                      <tr key={m.model} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 10px 10px 0', fontWeight: 600 }}>{m.model}</td>
                        <td style={{ padding: '10px' }}>{m.trades}</td>
                        <td style={{ padding: '10px' }}>{m.winPct.toFixed(1)}%</td>
                        <td className={pnlClass(m.netPnl) + ' mono'} style={{ padding: '10px', fontWeight: 600 }}>
                          {formatMoney(m.netPnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>No model data yet. Assign models to trades in the Trading Journal.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
