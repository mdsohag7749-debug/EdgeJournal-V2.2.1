import { useMemo } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import StatCard from '../StatCard';
import { useData } from '../../context/DataContext';
import { formatMoney, formatMoneyShort, pnlClass } from '../../lib/utils';
import { computeDeepAnalytics } from '../../lib/deepAnalytics';
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Percent, Gauge, Scale, Activity, TrendingUp, TrendingDown, Clock, ChartColumn, SunMoon, CalendarDays, Hourglass, BarChart3, CheckCircle2, Braces } from 'lucide-react';

const WIN = '#16a34a';
const LOSS = '#dc2626';

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const netPnl = payload.find((p) => p.dataKey === 'netPnl')?.value ?? payload[0]?.value ?? 0;
  const trades = payload.find((p) => p.dataKey === 'trades')?.value;
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12.5 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div className={pnlClass(netPnl)}>{formatMoney(netPnl)}</div>
      {trades !== undefined && <div style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>{trades} trades</div>}
    </div>
  );
}

function SmallEmpty({ children }) {
  return (
    <div className="empty-state" style={{ padding: '26px 14px' }}>
      <p style={{ fontSize: 13 }}>{children}</p>
    </div>
  );
}

function Table({ rows, columns, emptyLabel }) {
  if (!rows.length) {
    return <SmallEmpty>{emptyLabel}</SmallEmpty>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {columns.map((c) => (
              <th key={c.key} style={{ padding: '0 10px 10px 0' }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
              {columns.map((c) => (
                <td key={c.key} style={{ padding: '10px 10px 10px 0', fontWeight: c.key === columns[0].key ? 600 : undefined }}>
                  {r[c.key] !== undefined && r[c.key] !== null ? r[c.key] : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupBar({ data, xKey }) {
  if (!data.length) {
    return <SmallEmpty>Not enough trade history yet.</SmallEmpty>;
  }
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatMoneyShort(v)} width={64} />
          <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(128,128,128,0.08)' }} />
          <Bar dataKey="netPnl" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.netPnl >= 0 ? WIN : LOSS} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendChart({ data }) {
  if (!data.length) {
    return <SmallEmpty>Not enough monthly history yet.</SmallEmpty>;
  }
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatMoneyShort(v)} width={64} />
          <Tooltip content={<MoneyTooltip />} />
          <Line type="monotone" dataKey="netPnl" stroke={WIN} strokeWidth={2.5} dot={{ r: 3, fill: WIN }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
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

// --- column configs (self-contained) ---
const PAIR_COLS = [
  { key: 'label', label: 'Pair' },
  { key: 'trades', label: 'Trades' },
  { key: 'winRate', label: 'Win Rate' },
  { key: 'netPnl', label: 'Net P&L' },
  { key: 'avgRR', label: 'Avg R:R' },
  { key: 'profitFactor', label: 'Profit Factor' },
];
const SESSION_COLS = [
  { key: 'label', label: 'Session' },
  { key: 'trades', label: 'Trades' },
  { key: 'winRate', label: 'Win Rate' },
  { key: 'netPnl', label: 'Net P&L' },
];
const DAY_COLS = [
  { key: 'label', label: 'Day' },
  { key: 'trades', label: 'Trades' },
  { key: 'winRate', label: 'Win Rate' },
  { key: 'netPnl', label: 'Net P&L' },
  { key: 'avgRR', label: 'Avg R:R' },
];

function padRows(rows, cols) {
  return (rows || []).map((r) => {
    const out = { ...r };
    if (cols.some((c) => c.key === 'netPnl')) out.netPnl = <span className={`mono ${pnlClass(r.netPnl)}`} style={{ fontWeight: 600 }}>{formatMoney(r.netPnl)}</span>;
    if (cols.some((c) => c.key === 'winRate')) out.winRate = `${(r.winRate ?? 0).toFixed(1)}%`;
    if (cols.some((c) => c.key === 'avgRR')) out.avgRR = r.avgRR ? r.avgRR.toFixed(2) : '—';
    if (cols.some((c) => c.key === 'profitFactor')) out.profitFactor = r.profitFactor === Infinity ? '∞' : r.profitFactor ? r.profitFactor.toFixed(2) : '—';
    return out;
  });
}

export default function DeepPerformanceAnalytics() {
  const { trades } = useData();
  const deep = useMemo(() => computeDeepAnalytics(trades.items), [trades.items]);
  const s = deep.summary;
  const hasAny = (s?.total || 0) > 0;
  const decided = (s?.wins || 0) + (s?.losses || 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Section header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Braces size={16} color="#2563eb" /> Deep Performance Analytics
        </h3>
        <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 560, marginBottom: 0 }}>
          Hour-by-hour, day-by-day and month-by-month edge — derived live from real trade history.
        </p>
      </motion.div>

      {!hasAny ? (
        <EmptyState icon={BarChart3} title="No trade data yet" message="Log trades to unlock pair, session, weekday, hourly, monthly and duration performance." />
      ) : (
        <>
          {/* Summary stat cards */}
          <div className="dash-stats-grid">
            <StatCard label="Win Rate" value={s.winRate} format={(v) => `${v.toFixed(1)}%`} icon={Percent} accent={WIN} delay={0} />
            <StatCard label="Profit Factor" value={s.profitFactor === Infinity ? '∞' : s.profitFactor || 0} format={(v) => (typeof v === 'number' ? v.toFixed(2) : v)} icon={Gauge} accent="#7c3aed" delay={0.02} />
            <StatCard label="Average R:R" value={s.avgRR || 0} format={(v) => (v ? v.toFixed(2) : '—')} icon={Scale} accent="#2563eb" delay={0.04} />
            <StatCard label="Net P&L" value={s.netPnl} format={formatMoney} valueClass={pnlClass(s.netPnl)} icon={Activity} accent={s.netPnl >= 0 ? WIN : LOSS} delay={0.06} />
            <StatCard label="Average Win" value={s.avgWin} format={formatMoney} valueClass="pnl-pos" icon={TrendingUp} accent={WIN} delay={0.08} />
            <StatCard label="Average Loss" value={s.avgLoss} format={formatMoney} valueClass="pnl-neg" icon={TrendingDown} accent={LOSS} delay={0.1} />
            <StatCard label="Trades" value={s.total} format={(v) => `${Math.round(v)}`} icon={BarChart3} accent="#9a9aa3" delay={0.12} />
            <StatCard label="Closed" value={decided} format={(v) => `${Math.round(v)}`} icon={CheckCircle2} accent="#C1121F" delay={0.14} />
          </div>

          {/* Average Trade Duration spotlight */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }} className="card card-lift" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 18 }}>
              <span style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(37,99,235,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Hourglass size={20} color="#2563eb" />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Average Trade Duration</div>
                <div className="mono" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>{deep.avgDurationLabel}</div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-faint)', marginLeft: 'auto' }}>
                {deep.avgDurationMin > 0 ? 'across trades with an entry & exit time' : 'no trades with an entry & exit time yet'}
              </div>
            </div>
          </motion.div>

          {/* Monthly Performance Trend */}
          <SectionCard title="Monthly Performance Trend" icon={ChartColumn} accent="#7c3aed">
            <TrendChart data={deep.monthlyTrend} />
          </SectionCard>

          {/* Performance by Hour */}
          <SectionCard title="Performance by Hour" icon={Clock} accent="#2563eb">
            <GroupBar data={deep.byHour} xKey="label" />
          </SectionCard>

          {/* Performance by Pair */}
          <SectionCard title="Performance by Pair" icon={Braces} accent="#16a34a">
            <Table rows={padRows(deep.byPair, PAIR_COLS)} columns={PAIR_COLS} emptyLabel="No pair data yet." />
          </SectionCard>

          {/* Two-column: Day of Week + Session */}
          <div className="dash-two-col-even">
            <SectionCard title="Performance by Weekday" icon={CalendarDays} accent="#C1121F">
              <Table rows={padRows(deep.byWeekday, DAY_COLS)} columns={DAY_COLS} emptyLabel="No weekday data yet." />
            </SectionCard>
            <SectionCard title="Performance by Session" icon={Activity} accent="#2563eb">
              <Table rows={padRows(deep.bySession, SESSION_COLS)} columns={SESSION_COLS} emptyLabel="No session data yet." />
            </SectionCard>
          </div>
        </>
      )}
    </motion.div>
  );
}