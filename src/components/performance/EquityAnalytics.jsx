import { useMemo } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import StatCard from '../StatCard';
import { useData } from '../../context/DataContext';
import { useAccounts } from '../../context/AccountContext';
import { formatMoney, pnlClass } from '../../lib/utils';
import { computeEquityAnalytics } from '../../lib/equityAnalytics';
import { Area, Line, Bar, Cell, ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Layers, Banknote, LineChart, Gauge, Activity, CalendarDays } from 'lucide-react';

const WIN = '#16a34a';
const LOSS = '#dc2626';
const VIOLET = '#7c3aed';
const BLUE = '#2563eb';

function moneyTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12.5, minWidth: 150 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 2 }}>
          <span style={{ color: 'var(--text-faint)' }}>{p.name}</span>
          <span className={`mono ${pnlClass(p.value)}`} style={{ fontWeight: 700 }}>{formatMoney(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Generic multi-series curve (area/line) over trade dates.
function SeriesChart({ data, series, height = 230 }) {
  if (!data?.length) {
    return (
      <div className="empty-state" style={{ padding: '26px 14px' }}>
        <p style={{ fontSize: 13 }}>Not enough equity history yet.</p>
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 5, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} minTickGap={36} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
          <Tooltip content={moneyTip} cursor={{ stroke: 'rgba(128,128,128,0.25)' }} />
          {series.map((s, i) =>
            s.type === 'area' ? (
              <Area key={i} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} fill={s.color} fillOpacity={0.16} dot={false} animationDuration={700} />
            ) : (
              <Line key={i} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.5} dot={false} animationDuration={700} />
            )
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function GrowthTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12.5 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, color: d.growthPct >= 0 ? WIN : LOSS }}>
        {d.growthPct !== null ? `${d.growthPct >= 0 ? '+' : ''}${d.growthPct.toFixed(2)}%` : 'n/a'}
      </div>
      <div style={{ color: 'var(--text-faint)', marginTop: 2 }}>{formatMoney(d.net)} month net</div>
    </div>
  );
}

function MonthlyGrowthBar({ data }) {
  if (!data?.length) {
    return (
      <div className="empty-state" style={{ padding: '26px 14px' }}>
        <p style={{ fontSize: 13 }}>Not enough monthly history yet.</p>
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: 230 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 5, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} minTickGap={24} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => `${v}%`} />
          <Tooltip content={<GrowthTip />} cursor={{ fill: 'rgba(128,128,128,0.08)' }} />
          <Bar dataKey="growthPct" radius={[4, 4, 0, 0]} animationDuration={700}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.growthPct >= 0 ? WIN : LOSS} />
            ))}
          </Bar>
        </ComposedChart>
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

export default function EquityAnalytics() {
  const { trades } = useData();
  const { accounts, selectedAccountId, selectedAccount, allAccounts } = useAccounts();

  // Baseline = real account starting balance (selected account, or the sum
  // across all accounts when viewing "All Accounts").
  const startingEquity = useMemo(() => {
    if (selectedAccountId) return Number(selectedAccount?.startingBalance) || 0;
    return (allAccounts ? accounts : []).reduce((s, a) => s + (Number(a.startingBalance) || 0), 0);
  }, [selectedAccountId, selectedAccount, accounts, allAccounts]);

  const e = useMemo(() => computeEquityAnalytics(trades.items, startingEquity), [trades.items, startingEquity]);

  const curve = e.points;
  const enhancedSeries = [
    { key: 'equity', name: 'Equity', type: 'area', color: BLUE },
    { key: 'netPnl', name: 'Profit', type: 'line', color: WIN },
  ];
  const balanceSeries = [{ key: 'equity', name: 'Balance', type: 'area', color: VIOLET }];
  const profitSeries = [{ key: 'netPnl', name: 'Profit', type: 'line', color: WIN }];
  const drawdownSeries = [{ key: 'drawdown', name: 'Drawdown', type: 'area', color: LOSS }];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LineChart size={16} color="#2563eb" /> Equity Analytics
        </h3>
        <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 560, marginBottom: 0 }}>
          Your account's run from its real starting balance — growth, equity extremes, balance/profit/drawdown curves and monthly growth.
        </p>
      </motion.div>

      {!e.hasData ? (
        <EmptyState icon={LineChart} title="No equity history yet" message="Log trades to start building your equity, balance, profit and drawdown curves." />
      ) : (
        <>
          <div className="dash-stats-grid">
            <StatCard label="Growth %" value={e.growthPct} format={(v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`)} icon={TrendingUp} accent={e.growthPct >= 0 ? WIN : LOSS} delay={0} />
            <StatCard label="Highest Equity" value={e.highestEquity} format={formatMoney} valueClass="pnl-pos" icon={Gauge} accent={WIN} delay={0.02} />
            <StatCard label="Lowest Equity" value={e.lowestEquity} format={formatMoney} valueClass="pnl-neg" icon={TrendingDown} accent={LOSS} delay={0.04} />
            <StatCard label="Final Equity" value={e.finalEquity} format={formatMoney} valueClass={pnlClass(e.finalEquity - e.base)} icon={Banknote} accent={e.finalEquity - e.base >= 0 ? WIN : LOSS} delay={0.06} />
            <StatCard label="Max Drawdown" value={e.maxDrawdown} format={formatMoney} valueClass="pnl-neg" icon={Activity} accent={LOSS} delay={0.08} />
          </div>

          <div className="dash-two-col-even">
            <SectionCard title="Enhanced Equity Curve" icon={LineChart} accent={BLUE}>
              <SeriesChart data={curve} series={enhancedSeries} />
            </SectionCard>
            <SectionCard title="Balance Curve" icon={Banknote} accent={VIOLET}>
              <SeriesChart data={curve} series={balanceSeries} />
            </SectionCard>
          </div>

          <div className="dash-two-col-even">
            <SectionCard title="Profit Curve" icon={TrendingUp} accent={WIN}>
              <SeriesChart data={curve} series={profitSeries} />
            </SectionCard>
            <SectionCard title="Drawdown Curve" icon={Layers} accent={LOSS}>
              <SeriesChart data={curve} series={drawdownSeries} />
            </SectionCard>
          </div>

          <SectionCard title="Monthly Growth Comparison" icon={CalendarDays} accent={VIOLET}>
            <MonthlyGrowthBar data={e.monthlyGrowth} />
          </SectionCard>

          <SectionCard title="Equity Timeline" icon={Activity} accent={BLUE}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <th scope="col" style={{ padding: '0 10px 10px 0' }}>Date</th>
                    <th scope="col" style={{ padding: '0 10px 10px' }}>Equity</th>
                    <th scope="col" style={{ padding: '0 10px 10px' }}>Cumulative P&L</th>
                    <th scope="col" style={{ padding: '0 10px 10px' }}>Drawdown</th>
                  </tr>
                </thead>
                <tbody>
                  {e.timeline.slice(-60).map((p, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 10px 10px 0', fontWeight: 600 }}>{p.date}</td>
                      <td style={{ padding: '10px' }} className="mono">{formatMoney(p.equity)}</td>
                      <td style={{ padding: '10px' }} className={`mono ${pnlClass(p.netPnl)}`}>{formatMoney(p.netPnl)}</td>
                      <td style={{ padding: '10px' }} className={"mono"}>-{formatMoney(p.drawdown)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </motion.div>
  );
}