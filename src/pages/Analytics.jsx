import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useData } from '../context/DataContext';
import { computeAnalytics } from '../lib/analytics';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';
import { formatMoney, formatMoneyShort, pnlClass } from '../lib/utils';
import {
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  Percent,
  PercentCircle,
  Gauge,
  Scale,
  TrendingUp,
  TrendingDown,
  Trophy,
  Flame,
  Snowflake,
  Award,
  CalendarDays,
  Activity,
  BarChart3,
} from 'lucide-react';

const WIN_COLOR = '#16a34a';
const LOSS_COLOR = '#dc2626';
const SESSION_COLORS = { Asia: '#7c3aed', London: '#2563eb', 'New York': '#C1121F', 'After Hours': '#9a9aa3', Unknown: '#9a9aa3' };

function MoneyBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const netPnl = payload.find((p) => p.dataKey === 'netPnl')?.value ?? 0;
  const trades = payload.find((p) => p.dataKey === 'trades')?.value;
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12.5 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div className={pnlClass(netPnl)}>{formatMoney(netPnl)}</div>
      {trades !== undefined && <div style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>{trades} trades</div>}
    </div>
  );
}

function PerformanceBarChart({ data, xKey }) {
  if (!data.length) {
    return (
      <div className="empty-state">
        <p>Not enough trade history yet.</p>
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatMoneyShort(v)} width={64} />
          <Tooltip content={<MoneyBarTooltip />} />
          <Bar dataKey="netPnl" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.netPnl >= 0 ? WIN_COLOR : LOSS_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GroupTable({ rows, firstColumnLabel, firstColumnKey = 'label' }) {
  if (!rows.length) {
    return (
      <div className="empty-state">
        <p>No data yet.</p>
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            <th style={{ padding: '0 10px 10px 0' }}>{firstColumnLabel}</th>
            <th style={{ padding: '0 10px 10px' }}>Trades</th>
            <th style={{ padding: '0 10px 10px' }}>Win Rate</th>
            <th style={{ padding: '0 10px 10px' }}>Net P&L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '10px 10px 10px 0', fontWeight: 600 }}>{r[firstColumnKey]}</td>
              <td style={{ padding: '10px' }}>{r.trades}</td>
              <td style={{ padding: '10px' }}>{r.winRate.toFixed(1)}%</td>
              <td className={pnlClass(r.netPnl) + ' mono'} style={{ padding: '10px', fontWeight: 600 }}>
                {formatMoney(r.netPnl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Analytics({ onNavigate }) {
  const { trades } = useData();
  const a = useMemo(() => computeAnalytics(trades.items), [trades.items]);

  const sessionPie = a.bySession
    .filter((s) => s.trades > 0)
    .map((s) => ({ name: s.key, value: s.trades, color: SESSION_COLORS[s.key] || '#9a9aa3' }));

  if (trades.items.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No trades logged yet"
        message="Log trades in the Trading Journal to unlock win rate, profit factor, streaks, and every breakdown below."
        actionLabel="Add Your First Trade"
        onAction={() => onNavigate?.('journal')}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Core performance stat cards */}
      <div className="dash-stats-grid">
        <StatCard label="Win Rate" value={a.winRate} format={(v) => `${v.toFixed(1)}%`} icon={Percent} accent="#16a34a" delay={0} />
        <StatCard label="Loss Rate" value={a.lossRate} format={(v) => `${v.toFixed(1)}%`} icon={PercentCircle} accent="#dc2626" delay={0.02} />
        <StatCard
          label="Profit Factor"
          value={a.profitFactor === Infinity ? '∞' : a.profitFactor || 0}
          format={(v) => (typeof v === 'number' ? v.toFixed(2) : v)}
          icon={Gauge}
          accent="#7c3aed"
          delay={0.04}
        />
        <StatCard label="Average R:R" value={a.avgRR || 0} format={(v) => (v ? v.toFixed(2) : '—')} icon={Scale} accent="#2563eb" delay={0.06} />
        <StatCard label="Average Win" value={a.avgWin} format={formatMoney} valueClass="pnl-pos" icon={TrendingUp} accent="#16a34a" delay={0.08} />
        <StatCard label="Average Loss" value={a.avgLoss} format={formatMoney} valueClass="pnl-neg" icon={TrendingDown} accent="#dc2626" delay={0.1} />
        <StatCard label="Net P&L" value={a.netPnl} format={formatMoney} valueClass={pnlClass(a.netPnl)} icon={Activity} accent={a.netPnl >= 0 ? '#16a34a' : '#dc2626'} delay={0.12} />
        <StatCard label="Best Trade" value={a.bestTrade} format={formatMoney} valueClass="pnl-pos" icon={Trophy} accent="#16a34a" delay={0.14} />
        <StatCard label="Worst Trade" value={a.worstTrade} format={formatMoney} valueClass="pnl-neg" icon={TrendingDown} accent="#dc2626" delay={0.16} />
        <StatCard label="Current Win Streak" value={a.currentWinStreak} format={(v) => `${Math.round(v)}`} icon={Flame} accent="#16a34a" delay={0.18} />
        <StatCard label="Current Loss Streak" value={a.currentLossStreak} format={(v) => `${Math.round(v)}`} icon={Snowflake} accent="#dc2626" delay={0.2} />
        <StatCard label="Longest Win Streak" value={a.longestWinStreak} format={(v) => `${Math.round(v)}`} icon={Award} accent="#7c3aed" delay={0.22} />
        <StatCard label="Trading Days" value={a.tradingDays} format={(v) => `${Math.round(v)}`} icon={CalendarDays} accent="#2563eb" delay={0.24} />
      </div>

      {/* Monthly / Weekly performance */}
      <div className="dash-two-col-even">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
          <h3 className="section-title" style={{ marginBottom: 14 }}>
            Monthly Performance
          </h3>
          <PerformanceBarChart data={a.monthlyPerformance} xKey="label" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }} className="card card-lift" style={{ padding: 22 }}>
          <h3 className="section-title" style={{ marginBottom: 14 }}>
            Weekly Performance
          </h3>
          <PerformanceBarChart data={a.weeklyPerformance} xKey="label" />
        </motion.div>
      </div>

      {/* Trades by Pair + Trades by Session */}
      <div className="dash-two-col-even">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
          <h3 className="section-title" style={{ marginBottom: 14 }}>
            Trades by Pair
          </h3>
          <PerformanceBarChart data={a.byPair} xKey="key" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }} className="card card-lift" style={{ padding: 22 }}>
          <h3 className="section-title" style={{ marginBottom: 14 }}>
            Trades by Session
          </h3>
          {sessionPie.length ? (
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={sessionPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={3}>
                    {sessionPie.map((entry, i) => (
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
              <p>No session data yet.</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Trades by Strategy */}
      <div className="card card-lift" style={{ padding: 22 }}>
        <h3 className="section-title" style={{ marginBottom: 14 }}>
          Trades by Strategy
        </h3>
        <GroupTable rows={a.byStrategy} firstColumnLabel="Strategy" />
      </div>
    </div>
  );
}
