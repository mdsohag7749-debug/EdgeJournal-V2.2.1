import { useMemo } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import { useData } from '../../context/DataContext';
import { formatMoney } from '../../lib/utils';
import { computeInstitutionalInsights } from '../../lib/insightAnalytics';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, Activity, Briefcase, Repeat, Sparkles } from 'lucide-react';

const WIN = '#16a34a';
const LOSS = '#dc2626';
const BLUE = '#2563eb';
const VIOLET = '#7c3aed';

const TONES = {
  pos: 'linear-gradient(180deg, rgba(22,163,74,0.5), rgba(22,163,74,0.0))',
  neg: 'linear-gradient(180deg, rgba(220,38,38,0.5), rgba(220,38,38,0.0))',
  neu: 'linear-gradient(180deg, rgba(37,99,235,0.5), rgba(37,99,235,0.0))',
  violet: 'linear-gradient(180deg, rgba(124,58,237,0.5), rgba(124,58,237,0.0))',
};

const chipped = { fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', padding: '2px 8px', borderRadius: 8, textTransform: 'uppercase' };

function InsightCard({ icon: Icon, title, value, detail, coverage, tone = 'neu', color, delay = 0 }) {
  return (
    <motion.div
      className="card card-lift"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay }}
      whileHover={{ y: -3 }}
      style={{ position: 'relative', padding: '18px 18px 16px 20px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden', minWidth: 0 }}
    >
      <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: color }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</span>
        <span style={{ width: 28, height: 28, borderRadius: 9, background: `${color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={14} color={color} />
        </span>
      </div>
      <span className="mono" style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 16 }}>
        {detail ? <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{detail}</span> : <span />}
        {coverage && <span style={{ ...chipped, background: `${color}14`, color }}>{coverage}</span>}
      </div>
    </motion.div>
  );
}

function TrendTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12.5 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{d?.winRate.toFixed(1)}% win</div>
      {d && <div style={{ color: 'var(--text-faint)' }}>{d.decided} decided</div>}
    </div>
  );
}

function MonthlyTrendChart({ trend }) {
  if (!trend?.monthly?.length) {
    return <div className="empty-state" style={{ padding: '26px 14px' }}><p style={{ fontSize: 13 }}>Not enough months for a trend yet.</p></div>;
  }
  return (
    <div style={{ width: '100%', height: 230 }}>
      <ResponsiveContainer>
        <BarChart data={trend.monthly} margin={{ top: 5, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} minTickGap={16} />
          <YAxis domain={[0, 100]} unit="%" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
          <Tooltip content={<TrendTip />} cursor={{ fill: 'rgba(128,128,128,0.08)' }} />
          <Bar dataKey="winRate" radius={[4, 4, 0, 0]} animationDuration={700} name="Win Rate">
            {trend.monthly.map((m, i) => (
              <Cell key={i} fill={m.winRate >= trend.monthly.reduce((s, x) => s + x.winRate, 0) / trend.monthly.length ? WIN : BLUE} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function fmtMoney(v) {
  return formatMoney(v);
}

export default function InstitutionalInsights() {
  const { trades } = useData();
  const ins = useMemo(() => computeInstitutionalInsights(trades.items), [trades.items]);

  if (!ins.hasData) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} color="#7c3aed" /> Institutional Insights
        </h3>
        <div style={{ marginTop: 16 }}>
          <EmptyState icon={Sparkles} title="Not enough decided trades yet" message="Statistics-based insights unlock once you have at least one winning or losing trade." />
        </div>
      </motion.div>
    );
  }

  const i = ins.insights;

  const cards = [
    {
      title: 'Highest RR Environment', icon: Activity, tone: 'violet', color: VIOLET,
      value: i.rrEnvironment?.label || '—',
      detail: i.rrEnvironment ? `${i.rrEnvironment.avgRR.toFixed(2)} avg R:R` : 'Insufficient data',
      coverage: null,
    },
    {
      title: 'Most Profitable Model', icon: Briefcase, tone: 'win', color: WIN,
      value: i.bestModel?.label || '—',
      detail: i.bestModel ? `${fmtMoney(i.bestModel.netPnl)} net` : 'Insufficient data',
      coverage: i.bestModel ? `${i.bestModel.trades} trades` : null,
    },
    {
      title: 'Most Consistent Session', icon: Repeat, tone: 'neu', color: BLUE,
      value: i.consistent?.label || '—',
      detail: i.consistent ? `${i.consistent.winRate.toFixed(1)}% win rate` : 'Insufficient data',
      coverage: i.consistent ? `${i.consistent.wins + i.consistent.losses} trades` : null,
    },
    {
      title: 'Monthly Improvement', icon: TrendingUp, tone: ins.trend.direction === 'down' ? 'neg' : 'win', color: ins.trend.direction === 'down' ? LOSS : WIN,
      value: { up: 'Improving', down: 'Declining', flat: 'Stable', null: 'Insufficient data' }[ins.trend.direction],
      detail: ins.trend.slope !== null ? `${ins.trend.slope >= 0 ? '+' : ''}${ins.trend.slope} pts/month` : 'Need 2+ months of data',
      coverage: null,
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} color="#7c3aed" /> Institutional Insights
        </h3>
        <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 560, marginBottom: 0 }}>
          Statistically-derived edge and risk observations — computed from real trade history, no AI.
        </p>
      </motion.div>

      <div className="dash-stats-grid">
        {cards.map((c, idx) => (
          <InsightCard key={c.title} icon={c.icon} title={c.title} value={c.value} detail={c.detail} coverage={c.coverage} tone={c.tone} color={c.color} delay={Math.min(idx * 0.03, 0.4)} />
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }} className="card card-lift" style={{ padding: 22 }}>
        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <TrendingUp size={16} color={ins.trend.direction === 'down' ? LOSS : WIN} /> Monthly Improvement Trend
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16 }}>
          Monthly win-rate across <span className="mono">{ins.decided}</span> decided trades
        </p>
        <MonthlyTrendChart trend={ins.trend} />
      </motion.div>
    </motion.div>
  );
}