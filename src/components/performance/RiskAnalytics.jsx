import { useMemo } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import StatCard from '../StatCard';
import { useData } from '../../context/DataContext';
import { formatMoney, pnlClass } from '../../lib/utils';
import { computeRiskAnalytics } from '../../lib/riskAnalytics';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ShieldAlert, TrendingUp, Timer, Trophy, Snowflake, Layers, AlertTriangle, Activity } from 'lucide-react';

const WIN = '#16a34a';
const LOSS = '#dc2626';

const fmtMoney = (v, classSuffix) => <span className={`mono ${classSuffix || pnlClass(v)}`} style={{ fontWeight: 600 }}>{formatMoney(v)}</span>;

function ChartTip({ active, payload, label, suffix }) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value ?? 0;
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12.5 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{typeof v === 'number' ? `${v.toFixed(v % 1 === 0 ? 0 : 1)}${suffix || ''}` : v}</div>
    </div>
  );
}

function BucketBar({ data, xKey, color, height = 240, suffix }) {
  if (!data || !data.length) {
    return (
      <div className="empty-state" style={{ padding: '26px 14px' }}>
        <p style={{ fontSize: 13 }}>No risk-percentage data yet.</p>
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
          <Tooltip content={<ChartTip suffix={suffix} />} cursor={{ fill: 'rgba(128,128,128,0.08)' }} />
          <Bar dataKey={xKey} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SectionCard({ icon: Icon, title, accent = '#2563eb', children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
      <h3 className="section-title" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={16} color={accent} /> {title}
      </h3>
      {children}
    </motion.div>
  );
}

export default function RiskAnalytics() {
  const { trades } = useData();
  const r = useMemo(() => computeRiskAnalytics(trades.items), [trades.items]);
  const empty = r.total === 0 || r.decided === 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldAlert size={16} color="#dc2626" /> Risk Analytics
        </h3>
        <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 560, marginBottom: 0 }}>
          Exposure, drawdown and risk-per-streak discipline — computed live from real trade history.
        </p>
      </motion.div>

      {empty ? (
        <EmptyState icon={ShieldAlert} title="Not enough decided trades yet" message="Log trade outcomes to unlock risk %, drawdown and streak analytics." />
      ) : (
        <>
          <div className="dash-stats-grid">
            <StatCard label="Average Risk %" value={r.avgRiskPct} format={(v) => (v != null ? `${v.toFixed(2)}%` : '—')} icon={ShieldAlert} accent={LOSS} delay={0} />
            <StatCard label="Average Reward %" value={r.avgRewardPct} format={(v) => (v != null ? `${v.toFixed(2)}%` : '—')} icon={TrendingUp} accent={WIN} delay={0.02} />
            <StatCard label="Max Drawdown" value={r.maxDrawdown} format={(v) => fmtMoney(v, 'pnl-neg')} icon={Layers} accent={LOSS} delay={0.04} />
            <StatCard label="Max Drawdown %" value={r.maxDrawdownPct} format={(v) => `${v.toFixed(2)}%`} icon={AlertTriangle} accent={LOSS} delay={0.06} />
            <StatCard label="Current Drawdown" value={r.currentDrawdown} format={(v) => fmtMoney(v)} icon={Activity} accent={r.currentDrawdown > 0 ? LOSS : WIN} delay={0.08} />
            <StatCard label="Current Drawdown %" value={r.currentPct} format={(v) => `${v.toFixed(2)}%`} icon={Activity} accent={r.currentPct > 0 ? LOSS : WIN} delay={0.1} />
            <StatCard label="Average Drawdown" value={r.averageDrawdown} format={(v) => fmtMoney(v)} icon={Layers} accent="#b45309" delay={0.12} />
            <StatCard label="Recovery Time" value={r.recoveryDays} format={(v) => `${Math.round(v)} days`} icon={Timer} accent="#7c3aed" delay={0.14} />
            <StatCard label="Largest Win Streak" value={r.longestWinStreak} format={(v) => `${Math.round(v)}`} icon={Trophy} accent={WIN} delay={0.16} />
            <StatCard label="Largest Loss Streak" value={r.longestLossStreak} format={(v) => `${Math.round(v)}`} icon={Snowflake} accent={LOSS} delay={0.18} />
          </div>

          <div className="dash-two-col-even">
            <SectionCard title="Risk Distribution" icon={Layers} accent="#7c3aed">
              <BucketBar data={r.distribution} xKey="trades" color="#7c3aed" suffix=" trades" />
            </SectionCard>
            <SectionCard title="Win Rate by Risk %" icon={Trophy} accent="#16a34a">
              <BucketBar data={r.winRateByRisk} xKey="winRate" color="#16a34a" suffix="%" />
            </SectionCard>
          </div>
        </>
      )}
    </motion.div>
  );
}