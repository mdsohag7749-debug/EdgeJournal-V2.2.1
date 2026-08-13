import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import { useAccounts } from '../context/AccountContext';
import { computeAnalytics } from '../lib/analytics';
import EmptyState from '../components/EmptyState';
import EdgeAICommandCenter from '../components/ai/EdgeAICommandCenter';
import PerformanceIntelligence from '../components/performance/PerformanceIntelligence';
import DeepPerformanceAnalytics from '../components/performance/DeepPerformanceAnalytics';
import RiskAnalytics from '../components/performance/RiskAnalytics';
import EquityAnalytics from '../components/performance/EquityAnalytics';
import InstitutionalInsights from '../components/performance/InstitutionalInsights';
import EmotionAnalytics from '../components/performance/EmotionAnalytics';
import MistakeAnalytics from '../components/performance/MistakeAnalytics';
import MistakePatternIntelligence from '../components/performance/MistakePatternIntelligence';
import RuleComplianceAnalytics from '../components/performance/RuleComplianceAnalytics';
import SmartTradeInsights from '../components/performance/SmartTradeInsights';
import SetupIntelligence from '../components/performance/SetupIntelligence';
import SetupPerformanceDashboard from '../components/performance/SetupPerformanceDashboard';
import SessionAndPairIntelligence from '../components/performance/SessionAndPairIntelligence';
import PairSessionHeatmap from '../components/performance/PairSessionHeatmap';
import RiskExecutionIntelligence from '../components/performance/RiskExecutionIntelligence';
import PatternDetection from '../components/performance/PatternDetection';
import Recommendations from '../components/performance/Recommendations';
import DisciplineScore20 from '../components/performance/DisciplineScore20';
import PsychologyInsights from '../components/dashboard/PsychInsights';
import AnalyticsHeader from '../components/analytics/AnalyticsHeader';
import AnalyticsSection from '../components/analytics/AnalyticsSection';
import { AnalyticsTree, AnalyticsSectionSelector } from '../components/analytics/AnalyticsTree';
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
import { BarChart3, Clock, Compass } from 'lucide-react';

const WIN_COLOR = '#16a34a';
const LOSS_COLOR = '#dc2626';

// ---- Sprint 9.6 information architecture ----
// The whole Analytics page is organised into seven conceptual folders so it
// reads as ONE trading-intelligence command center rather than a long stack
// of unrelated cards. Every feature/metric from before is preserved — only
// the visual hierarchy changed. No analytics calculation was touched.
const GROUPS = [
  {
    key: 'performance',
    index: '01',
    id: 'analytics-group-performance',
    title: 'Performance Intelligence',
    short: 'Performance',
    eyebrow: 'CORE PERFORMANCE · P&L & WIN RATE · PROFIT FACTOR · AVG R:R',
  },
  {
    key: 'risk',
    index: '02',
    id: 'analytics-group-risk',
    title: 'Risk & Equity',
    short: 'Risk & Equity',
    eyebrow: 'DRAWDOWN · RISK EXPOSURE · EQUITY BEHAVIOR',
  },
  {
    key: 'institutional',
    index: '03',
    id: 'analytics-group-institutional',
    title: 'Institutional Insights',
    short: 'Institutional',
    eyebrow: 'MARKET CONTEXT · SESSION INTELLIGENCE · EXECUTION QUALITY',
  },
  {
    key: 'trading',
    index: '04',
    id: 'analytics-group-trading',
    title: 'Trading Performance',
    short: 'Trading',
    eyebrow: 'SETUP & MODEL · PAIR × SESSION · TIMEFRAME · DIRECTION',
  },
  {
    key: 'pattern',
    index: '05',
    id: 'analytics-group-pattern',
    title: 'Pattern & Psychology',
    short: 'Patterns & Mind',
    eyebrow: 'MISTAKE PATTERNS · PSYCHOLOGY · RULE COMPLIANCE · DISCIPLINE SCORE 2.0',
  },
  {
    key: 'action',
    index: '06',
    id: 'analytics-group-action',
    title: 'Action & Improvement',
    short: 'Action',
    eyebrow: 'ACTION RECOMMENDATIONS · SMART INSIGHTS · WEEKLY PERFORMANCE',
  },
  {
    key: 'edgeai',
    index: '07',
    id: 'analytics-group-edgeai',
    title: 'EDGE AI',
    short: 'Edge AI',
    eyebrow: 'JOURNAL INTELLIGENCE · TRADE REVIEW · AI COACH · ASK JOURNAL',
  },
];

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Tracks the folder the reader is currently in. Uses a single
// IntersectionObserver with a narrow viewport band so at most one section is
// "active" at a time; this updates from threshold crossings (not a scroll
// handler), so React state is never set on every scroll tick.
function useSectionSpy(groups, enabled) {
  const [activeKey, setActiveKey] = useState(groups[0]?.key || 'performance');
  const sections = useRef({});

  const register = useCallback(
    (key) => (node) => {
      sections.current[key] = node;
    },
    []
  );

  const scrollTo = useCallback(
    (key) => {
      setActiveKey(key);
      const el = sections.current[key];
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      }
    },
    []
  );

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return undefined;
    const els = groups.map((g) => sections.current[g.key]).filter(Boolean);
    if (!els.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        let best = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const key = entry.target?.dataset?.sectionKey;
          if (!key) continue;
          const top = typeof entry.boundingClientRect?.top === 'number' ? entry.boundingClientRect.top : Number.POSITIVE_INFINITY;
          if (!best || top < best.top) best = { key, top };
        }
        if (best) setActiveKey(best.key);
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: 0 }
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [groups, enabled]);

  return { activeKey, register, scrollTo };
}

// ---- Shared analytics render helpers (unchanged from the original page) ----

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

// ---- Group content mapping: every original feature rendered once, under
// the folder it belongs to. No metric was recalculated here. ----

function GroupContent({ groupKey, a, onNavigate }) {
  switch (groupKey) {
    case 'performance':
      return (
        <>
          <PerformanceIntelligence />
          <DeepPerformanceAnalytics />
        </>
      );
    case 'risk':
      return (
        <>
          <RiskAnalytics />
          <EquityAnalytics />
        </>
      );
    case 'institutional':
      return (
        <>
          <InstitutionalInsights />
          <RiskExecutionIntelligence />
        </>
      );
    case 'trading':
      return (
        <>
          <SetupIntelligence />
          <SetupPerformanceDashboard />
          <SessionAndPairIntelligence />
          <PairSessionHeatmap />
          <div className="dash-two-col-even">
            <div className="card card-lift" style={{ padding: 22 }}>
              <h3 className="section-title" style={{ marginBottom: 14 }}>
                Trades by Strategy
              </h3>
              <GroupTable rows={a.byStrategy} firstColumnLabel="Strategy" />
            </div>
            <div className="card card-lift" style={{ padding: 22 }}>
              <h3 className="section-title" style={{ marginBottom: 14 }}>
                <Clock size={16} color="#7c3aed" /> Timeframe Performance
              </h3>
              <MetricsTable rows={a.byTimeframe} columns={TIMEFRAME_COLUMNS} />
            </div>
          </div>
          <div className="card card-lift" style={{ padding: 22 }}>
            <h3 className="section-title" style={{ marginBottom: 14 }}>
              <Compass size={16} color="#2563eb" /> Direction Performance
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <MetricsTable rows={a.byDirection} columns={DIRECTION_COLUMNS} />
              <DirectionDonut data={a.byDirection} />
            </div>
          </div>
        </>
      );
    case 'pattern':
      return (
        <>
          <PatternDetection />
          <MistakeAnalytics />
          <MistakePatternIntelligence />
          <EmotionAnalytics />
          <PsychologyInsights />
          <RuleComplianceAnalytics />
          <DisciplineScore20 />
        </>
      );
    case 'action':
      return (
        <>
          <Recommendations />
          <SmartTradeInsights />
          <div className="card card-lift" style={{ padding: 22 }}>
            <h3 className="section-title" style={{ marginBottom: 14 }}>
              Weekly Performance
            </h3>
            <PerformanceBarChart data={a.weeklyPerformance} xKey="label" />
          </div>
        </>
      );
    case 'edgeai':
      // EXACTLY ONE AI Command Center remains on this page. All four AI
      // features (Journal Intelligence, Trade Review, AI Coach, Ask Journal)
      // live inside it and keep their explicit-trigger contracts untouched.
      return <EdgeAICommandCenter onNavigate={onNavigate} />;
    default:
      return null;
  }
}

function DirectionDonut({ data }) {
  const donut = useMemo(
    () =>
      data
        .filter((d) => d.trades > 0)
        .map((d) => ({ name: d.label, value: d.trades, color: d.key === 'Buy' ? WIN_COLOR : d.key === 'Sell' ? LOSS_COLOR : '#9a9aa3' })),
    [data]
  );
  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={donut} dataKey="value" nameKey="name" innerRadius={44} outerRadius={72} paddingAngle={3}>
            {donut.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="var(--card)" strokeWidth={2} />
            ))}
          </Pie>
          <Legend verticalAlign="bottom" layout="horizontal" iconType="circle" wrapperStyle={{ fontSize: 12.5, color: 'var(--text-muted)' }} />
          <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12.5 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Analytics({ onNavigate }) {
  const { trades } = useData();
  const { allAccounts, selectedAccount, accounts } = useAccounts();
  const a = useMemo(() => computeAnalytics(trades.items), [trades.items]);

  const { activeKey, register, scrollTo } = useSectionSpy(GROUPS, trades.items.length > 0);

  const [expanded, setExpanded] = useState(() => Object.fromEntries(GROUPS.map((g) => [g.key, true])));

  const handleToggle = useCallback((key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Tree / selector click: expand the folder (if collapsed) and smooth-scroll
  // to it. Never reloads the page and never triggers AI.
  const handleSelect = useCallback(
    (key) => {
      setExpanded((prev) => ({ ...prev, [key]: true }));
      scrollTo(key);
    },
    [scrollTo]
  );

  const scopeLabel = allAccounts ? 'All Accounts' : selectedAccount?.name || (accounts.length ? accounts[0].name : 'This account');

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
    <div className="analytics-page">
      <div className="analytics-layout">
        <AnalyticsTree groups={GROUPS} activeKey={activeKey} expanded={expanded} onSelect={handleSelect} />

        <div className="analytics-content">
          <AnalyticsSectionSelector groups={GROUPS} activeKey={activeKey} onSelect={handleSelect} />

          <AnalyticsHeader scopeLabel={scopeLabel} />

          {GROUPS.map((g, order) => (
            <AnalyticsSection
              key={g.key}
              group={g}
              expanded={expanded[g.key]}
              onToggle={() => handleToggle(g.key)}
              registerSection={register}
              order={order + 1}
            >
              <GroupContent groupKey={g.key} a={a} onNavigate={onNavigate} />
            </AnalyticsSection>
          ))}
        </div>
      </div>
    </div>
  );
}