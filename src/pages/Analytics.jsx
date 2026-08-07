import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useData } from '../context/DataContext';
import { computeAnalytics } from '../lib/analytics';
import EmptyState from '../components/EmptyState';
import PerformanceIntelligence from '../components/performance/PerformanceIntelligence';
import DeepPerformanceAnalytics from '../components/performance/DeepPerformanceAnalytics';
import RiskAnalytics from '../components/performance/RiskAnalytics';
import EquityAnalytics from '../components/performance/EquityAnalytics';
import InstitutionalInsights from '../components/performance/InstitutionalInsights';
import EmotionAnalytics from '../components/performance/EmotionAnalytics';
import MistakeAnalytics from '../components/performance/MistakeAnalytics';
import RuleComplianceAnalytics from '../components/performance/RuleComplianceAnalytics';
import SmartTradeInsights from '../components/performance/SmartTradeInsights';
import SetupIntelligence from '../components/performance/SetupIntelligence';
import SessionAndPairIntelligence from '../components/performance/SessionAndPairIntelligence';
import RiskExecutionIntelligence from '../components/performance/RiskExecutionIntelligence';
import PatternDetection from '../components/performance/PatternDetection';
import Recommendations from '../components/performance/Recommendations';
import PsychologyInsights from '../components/dashboard/PsychInsights';
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
  BarChart3,
  Clock,
  Compass,
} from 'lucide-react';

const WIN_COLOR = '#16a34a';
const LOSS_COLOR = '#dc2626';

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
            <th scope="col" style={{ padding: '0 10px 10px 0' }}>{firstColumnLabel}</th>
            <th scope="col" style={{ padding: '0 10px 10px' }}>Trades</th>
            <th scope="col" style={{ padding: '0 10px 10px' }}>Win Rate</th>
            <th scope="col" style={{ padding: '0 10px 10px' }}>Net P&L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
              <th scope="row" style={{ padding: '10px 10px 10px 0', fontWeight: 600 }}>{r[firstColumnKey]}</th>
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

const CELL_RENDERERS = {
  text: (v) => v,
  num: (v) => `${Math.round(v)}`,
  pct: (v) => `${v.toFixed(1)}%`,
  money: (v) => (
    <span className={`${pnlClass(v)} mono`} style={{ fontWeight: 600 }}>
      {formatMoney(v)}
    </span>
  ),
  rr: (v) => (v ? v.toFixed(2) : '—'),
  pf: (v) => (v === Infinity ? '∞' : v ? v.toFixed(2) : '—'),
};

function MetricsTable({ rows, columns }) {
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
            {columns.map((c) => (
              <th key={c.key} scope={c.key === columns[0].key ? 'col' : undefined} style={{ padding: '0 10px 10px 0' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
              {columns.map((c) => {
                const render = CELL_RENDERERS[c.type] || CELL_RENDERERS.text;
                return (
                  <th key={c.key} scope={c.key === columns[0].key ? 'row' : undefined} style={{ padding: '10px 10px 10px 0', fontWeight: c.key === columns[0].key ? 600 : undefined, textAlign: 'left' }}>
                    {render(r[c.key])}
                  </th>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionHeading({ number, title, subtitle, accent = '#7c3aed' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', alignItems: 'center', gap: 12 }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.05em',
          color: accent,
          background: `${accent}1a`,
          padding: '4px 9px',
          borderRadius: 8,
        }}
      >
        {number}
      </span>
      <div>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</h3>
        {subtitle && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-faint)' }}>{subtitle}</p>}
      </div>
    </motion.div>
  );
}

const TIMEFRAME_COLUMNS = [
  { key: 'label', label: 'Timeframe' },
  { key: 'trades', label: 'Trades', type: 'num' },
  { key: 'winRate', label: 'Win Rate', type: 'pct' },
  { key: 'netPnl', label: 'Net Profit', type: 'money' },
  { key: 'avgRR', label: 'Avg R:R', type: 'rr' },
];

const DIRECTION_COLUMNS = [
  { key: 'label', label: 'Direction' },
  { key: 'trades', label: 'Trades', type: 'num' },
  { key: 'winRate', label: 'Win Rate', type: 'pct' },
  { key: 'netPnl', label: 'Net Profit', type: 'money' },
  { key: 'avgRR', label: 'Avg R:R', type: 'rr' },
];

export default function Analytics({ onNavigate }) {
  const { trades } = useData();
  const a = useMemo(() => computeAnalytics(trades.items), [trades.items]);

  const directionDonut = useMemo(
    () =>
      a.byDirection
        .filter((d) => d.trades > 0)
        .map((d) => ({ name: d.label, value: d.trades, color: d.key === 'Buy' ? WIN_COLOR : d.key === 'Sell' ? LOSS_COLOR : '#9a9aa3' })),
    [a.byDirection]
  );

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>

      {/* SECTION 01 — Performance Intelligence (executive summary) */}
      <SectionHeading number="01" title="Performance Intelligence" subtitle="Your executive summary — live edge, streaks and standout trades, recomputed from real history." accent="#7c3aed" />
      <PerformanceIntelligence />
      <DeepPerformanceAnalytics />

      {/* Trades by Strategy + Weekly */}
      <div className="dash-two-col-even">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
          <h3 className="section-title" style={{ marginBottom: 14 }}>
            Trades by Strategy
          </h3>
          <GroupTable rows={a.byStrategy} firstColumnLabel="Strategy" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }} className="card card-lift" style={{ padding: 22 }}>
          <h3 className="section-title" style={{ marginBottom: 14 }}>
            Weekly Performance
          </h3>
          <PerformanceBarChart data={a.weeklyPerformance} xKey="label" />
        </motion.div>
      </div>

      {/* Timeframe + Direction */}
      <div className="dash-two-col-even">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
          <h3 className="section-title" style={{ marginBottom: 14 }}>
            <Clock size={16} color="#7c3aed" /> Timeframe Performance
          </h3>
          <MetricsTable rows={a.byTimeframe} columns={TIMEFRAME_COLUMNS} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }} className="card card-lift" style={{ padding: 22 }}>
          <h3 className="section-title" style={{ marginBottom: 14 }}>
            <Compass size={16} color="#2563eb" /> Direction Performance
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <MetricsTable rows={a.byDirection} columns={DIRECTION_COLUMNS} />
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={directionDonut} dataKey="value" nameKey="name" innerRadius={44} outerRadius={72} paddingAngle={3}>
                    {directionDonut.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="var(--card)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" layout="horizontal" iconType="circle" wrapperStyle={{ fontSize: 12.5, color: 'var(--text-muted)' }} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12.5 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      </div>

      {/* SECTION 02 — Risk & Equity */}
      <SectionHeading number="02" title="Risk & Equity" subtitle="Exposure, drawdown, growth and your account's equity run from its starting balance." accent="#dc2626" />
      <RiskAnalytics />
      <EquityAnalytics />

      {/* SECTION 03 — Institutional Insights */}
      <SectionHeading number="03" title="Institutional Insights" subtitle="Statistically derived edge and risk observations, computed from real history." accent="#16a34a" />
      <InstitutionalInsights />

      {/* SECTION 04 — Smart Trade Insights */}
      <SectionHeading number="04" title="Smart Trade Insights" subtitle="Interpreted observations of your edges and leaks across performance, risk, execution, psychology, mistakes and consistency." accent="#c026d3" />
      <SmartTradeInsights />

      {/* SECTION 05 — Setup / Model Performance */}
      <SectionHeading number="05" title="Setup / Model Performance" subtitle="Which trading models are actually paying off — ranked by a balanced score, guarded by minimum sample size." accent="#c026d3" />
      <SetupIntelligence />

      {/* SECTION 06 — Session & Pair Intelligence */}
      <SectionHeading number="06" title="Session & Pair Intelligence" subtitle="Contextual edges across trading pairs, sessions and their combination — guarded by minimum sample size." accent="#e07b00" />
      <SessionAndPairIntelligence />

      {/* SECTION 07 — Risk & Execution Intelligence */}
      <SectionHeading number="07" title="Risk & Execution Intelligence" subtitle="How your sizing and execution behaviour relate to outcomes — interpreted relationships, guarded by sample size." accent="#e11d48" />
      <RiskExecutionIntelligence />

      {/* SECTION 08 — Trading Pattern Detection */}
      <SectionHeading number="08" title="Trading Pattern Detection" subtitle="Repeated behavioural patterns in your trade sequence — descriptive only, never predictive." accent="#0d9488" />
      <PatternDetection />

      {/* SECTION 09 — Psychology (Emotion Analytics + Psychology Insights) */}
      <SectionHeading number="09" title="Psychology" subtitle="Emotion distribution, trends and statistically derived psychology insights — every emotion metric shown once." accent="#7c3aed" />
      <EmotionAnalytics />
      <PsychologyInsights />

      {/* SECTION 10 — Mistake Analytics */}
      <SectionHeading number="07" title="Mistake Analytics" subtitle="What you did wrong, how often, and the real cost — tracked from every logged trade." accent="#dc2626" />
      <MistakeAnalytics />

{/* SECTION 11 — Rule Compliance */}
      <SectionHeading number="11" title="Rule Compliance" subtitle="How faithfully you follow your own rules, and the discipline it builds — live from your checklists." accent="#16a34a" />
      <RuleComplianceAnalytics />

      {/* SECTION 12 — Action Recommendations */}
      <SectionHeading number="12" title="Action Recommendations" subtitle="Practical next steps drawn from your detected patterns — decision support, not a signal generator." accent="#f59e0b" />
      <Recommendations />
    </div>
  );
}
