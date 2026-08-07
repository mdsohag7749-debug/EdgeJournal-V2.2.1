import { useMemo } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import StatCard from '../StatCard';
import { useData } from '../../context/DataContext';
import { computeMistakeAnalytics } from '../../lib/mistakeAnalytics';
import { formatMoney, pnlClass } from '../../lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { AlertTriangle, Target, Layers, CalendarDays, Crosshair, Clock, TrendingDown } from 'lucide-react';

const RED = '#dc2626';
const AMBER = '#b45309';
const BLUE = '#2563eb';
const PURPLE = '#7c3aed';

function ChartTip({ active, payload, label, prefix }) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12.5 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{v != null ? `${typeof v === 'number' ? Math.round(v) : v}${prefix || ''}` : '—'}</div>
    </div>
  );
}

function MistakeBars({ data, xKey, color, height = 240, prefix }) {
  if (!data || !data.length) {
    return (
      <div className="empty-state" style={{ padding: '26px 14px' }}>
        <p style={{ fontSize: 13 }}>No mistake data yet.</p>
      </div>
    );
  }
  const barHeight = xKey === 'count' && data.length > 6 ? Math.max(220, data.length * 40 + 50) : height;
  return (
    <div style={{ width: '100%', height: barHeight }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} minTickGap={24} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<ChartTip prefix={prefix} />} cursor={{ fill: 'rgba(128,128,128,0.08)' }} />
          <Bar dataKey={xKey} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MistakeTable({ rows }) {
  if (!rows || !rows.length) {
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
            <th scope="col" style={{ padding: '0 10px 10px 0' }}>Breakdown</th>
            <th scope="col" style={{ padding: '0 10px 10px' }}>Mistakes</th>
            <th scope="col" style={{ padding: '0 10px 10px' }}>Net P&L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name || i} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '10px 10px 10px 0', fontWeight: 600 }}>{r.name}</td>
              <td style={{ padding: '10px' }}>{r.count}</td>
              <td className={pnlClass(r.totalNetPnl) + ' mono'} style={{ padding: '10px', fontWeight: 600 }}>
                {formatMoney(r.totalNetPnl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionCard({ icon: Icon, title, accent = '#7c3aed', children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
      <h3 className="section-title" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={16} color={accent} /> {title}
      </h3>
      {children}
    </motion.div>
  );
}

export default function MistakeAnalytics() {
  const { trades } = useData();
  const m = useMemo(() => computeMistakeAnalytics(trades.items), [trades.items]);
  const empty = m.totalMistakes === 0;

  const byPairRows = m.byPair.map((p) => ({ name: p.name, count: p.count, totalNetPnl: p.totalNetPnl }));
  const bySessionRows = m.bySession.map((s) => ({ name: s.name, count: s.count, totalNetPnl: s.totalNetPnl }));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} color="#dc2626" /> Mistake Analytics
        </h3>
        <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 560, marginBottom: 0 }}>
          Every logged mistake, weighted by how often it happens — and what it costs you.
        </p>
      </motion.div>

      {empty ? (
        <EmptyState
          icon={AlertTriangle}
          title="No mistakes logged yet"
          message="Tick what you did wrong in the Mistakes section of a trade to unlock mistake frequency, cost and breakdown analytics."
        />
      ) : (
        <>
          <div className="dash-stats-grid">
            <StatCard
              label="Most Common Mistake"
              value={m.mostCommon?.name || '—'}
              format={(v) => v}
              icon={Target}
              accent={RED}
              delay={0}
              sub={m.mostCommon ? `${m.mostCommon.count} time${m.mostCommon.count === 1 ? '' : 's'}` : ''}
            />
            <StatCard label="Total Mistakes" value={m.totalMistakes} format={(v) => `${Math.round(v)}`} icon={Layers} accent={BLUE} delay={0.04} />
            <StatCard
              label="Most Expensive Mistake"
              value={m.mostExpensive ? formatMoney(m.mostExpensive.totalNetPnl) : '—'}
              format={(v) => v}
              icon={TrendingDown}
              accent={RED}
              delay={0.06}
              valueClass={m.mostExpensive ? 'pnl-neg' : undefined}
              sub={m.mostExpensive?.name}
            />
          </div>

          <div className="dash-two-col-even">
            <SectionCard title="Mistake Frequency" icon={AlertTriangle} accent={RED}>
              <MistakeBars data={m.perMistake} xKey="count" color={RED} prefix=" mistakes" />
            </SectionCard>
            <SectionCard title="Monthly Mistake Trend" icon={CalendarDays} accent={PURPLE}>
              <MistakeBars data={m.monthly} xKey="count" color={PURPLE} height={250} prefix=" mistakes" />
            </SectionCard>
          </div>

          <div className="dash-two-col-even">
            <SectionCard title="Mistakes by Pair" icon={Crosshair} accent={BLUE}>
              <MistakeTable rows={byPairRows} />
            </SectionCard>
            <SectionCard title="Mistakes by Session" icon={Clock} accent={AMBER}>
              <MistakeTable rows={bySessionRows} />
            </SectionCard>
          </div>
        </>
      )}
    </motion.div>
  );
}