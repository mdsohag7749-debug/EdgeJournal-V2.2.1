import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useData } from '../context/DataContext';
import { computeEmotionAnalytics } from '../lib/emotionAnalytics';
import { computeMistakeAnalytics } from '../lib/mistakeAnalytics';
import { computeRuleCompliance } from '../lib/ruleCompliance';
import { computeDisciplineScore } from '../lib/calculations';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';
import PsychologyInsights from '../components/dashboard/PsychInsights';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ZAxis,
  ReferenceLine,
} from 'recharts';
import {
  Brain,
  ShieldCheck,
  Target,
  Award,
  Grid3x3,
  History,
  TrendingUp,
  TrendingDown,
  Gauge,
  XCircle,
  ListChecks,
} from 'lucide-react';

const POS = '#16a34a';
const NEG = '#dc2626';
const BLUE = '#2563eb';
const PURPLE = '#7c3aed';
const AMBER = '#f59e0b';
const CYAN = '#06b6d4';

const PSYCH_POSITIVE = ['Confidence', 'Focus', 'Patience'];
const PSYCH_NEGATIVE = ['Fear', 'Greed', 'FOMO', 'Revenge', 'Stress'];

const TooltipCard = ({ active, payload, label, suffix, multi }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card" style={{ padding: '9px 12px', fontSize: 12.5 }}>
      {label && <div style={{ color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 18 }}>
          <span style={{ color: 'var(--text-muted)' }}>{multi !== false ? p.name : 'Value'}</span>
          <span className="mono" style={{ fontWeight: 700 }}>
            {p.value != null ? `${typeof p.value === 'number' ? p.value.toFixed(1) : p.value}${suffix || ''}` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
};

const ScatterTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12.5 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{p.label}</div>
      <div>
        Fear <b>{p.x}</b> · Confidence <b>{p.y}</b>
      </div>
    </div>
  );
};

function Chart({ icon, title, accent = '#7c3aed', children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 28, height: 28, borderRadius: 9, background: `${accent}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
        <h3 className="section-title" style={{ margin: 0 }}>
          {title}
        </h3>
      </div>
      {children}
    </motion.div>
  );
}

function Bars({ data, dataKey, xKey, color, height = 220, colored }) {
  if (!data || !data.length) {
    return <div className="empty-state" style={{ padding: '24px 12px' }}><p style={{ fontSize: 13 }}>No data yet.</p></div>;
  }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} interval={0} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
          <Tooltip content={<TooltipCard />} cursor={{ fill: 'rgba(128,128,128,0.08)' }} />
          <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} barSize={data.length > 8 ? 12 : 22}>
            {colored && data.map((d, i) => <Cell key={i} fill={d.color || color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Lines({ data, series, height = 230, domain = [0, 100] }) {
  if (!data || !data.length) {
    return <div className="empty-state" style={{ padding: '24px 12px' }}><p style={{ fontSize: 13 }}>No data yet.</p></div>;
  }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -14, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} />
          <YAxis domain={domain} ticks={domain[0] === 1 ? [1, 2, 3, 4, 5] : undefined} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={46} />
          <Tooltip content={<TooltipCard multi />} />
          <Legend verticalAlign="top" iconType="plainline" wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 6 }} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name || s.key} stroke={s.color} strokeWidth={s.width || 2.5} dot={false} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmotionTimeline({ data }) {
  if (!data || !data.length) {
    return <div className="empty-state" style={{ padding: '24px 12px' }}><p style={{ fontSize: 13 }}>Add rated months to see your emotional arc.</p></div>;
  }
  const EMOS = ['Focus', 'Patience', 'Confidence', 'Stress', 'Fear', 'Greed', 'FOMO', 'Revenge'];
  const palette = { Fear: NEG, Greed: AMBER, FOMO: '#f97316', Revenge: '#b91c1c', Stress: '#f59e0b', Confidence: BLUE, Focus: PURPLE, Patience: POS };
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -14, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} />
          <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={46} />
          <Tooltip content={<TooltipCard multi />} />
          <Legend verticalAlign="top" iconType="plainline" wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 6 }} />
          {EMOS.map((k) => (
            <Area key={k} type="monotone" dataKey={k} name={k} stroke={palette[k]} fill={palette[k]} fillOpacity={0.12} stackId="1" connectNulls />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function FearConfidenceChart({ data }) {
  const pts = (data || []).filter((m) => m.Fear != null && m.Confidence != null).map((m) => ({ x: +m.Fear.toFixed(1), y: +m.Confidence.toFixed(1), label: m.label }));
  if (!pts.length) {
    return <div className="empty-state" style={{ padding: '24px 12px' }}><p style={{ fontSize: 13 }}>Need Fear &amp; Confidence ratings to compare.</p></div>;
  }
  return (
    <div style={{ width: '100%', height: 230 }}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 16, right: 10, left: -6, bottom: 6 }}>
          <CartesianGrid stroke="var(--border)" />
          <XAxis type="number" dataKey="x" name="Fear" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} />
          <YAxis type="number" dataKey="y" name="Confidence" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={46} />
          <ZAxis range={[42, 42]} />
          <Tooltip content={<ScatterTip />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={pts} fill={CYAN} />
          <ReferenceLine segment={[{ x: 1, y: 1 }, { x: 5, y: 5 }]} stroke="var(--border-strong)" strokeDasharray="4 4" />
          <ReferenceLine x={3} stroke="var(--border)" strokeDasharray="4 4" />
          <ReferenceLine y={3} stroke="var(--border)" strokeDasharray="4 4" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Psychology({ onNavigate }) {
  const { trades, models, riskCriteria, checklistCriteria } = useData();
  const list = trades.items;

  const emotion = useMemo(() => computeEmotionAnalytics(list), [list]);
  const mistakes = useMemo(() => computeMistakeAnalytics(list), [list]);
  const rules = useMemo(() => computeRuleCompliance(list, { riskCriteria, checklistCriteria }), [list, riskCriteria, checklistCriteria]);
  const discipline = useMemo(() => computeDisciplineScore(list, { models, riskCriteria, checklistCriteria }), [list, models, riskCriteria, checklistCriteria]);

  // Discipline Trend — recompute the discipline score per calendar month over
  // only that month's real trades. All live, no dummy series.
  const disciplineTrend = useMemo(() => {
    const byMonth = {};
    list.forEach((t) => {
      if (!t.date) return;
      const m = t.date.slice(0, 7);
      (byMonth[m] = byMonth[m] || []).push(t);
    });
    return Object.keys(byMonth)
      .sort()
      .map((m) => {
        const ds = computeDisciplineScore(byMonth[m], { models, riskCriteria, checklistCriteria });
        const d = new Date(m + '-01T00:00:00');
        return { label: isNaN(d) ? m : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }), score: ds.score };
      });
  }, [list, models, riskCriteria, checklistCriteria]);

  // Composite Psychology Score — the average of every measured psychological
  // pillar that actually has data (no fake floors for empty ones).
  const psych = useMemo(() => {
    const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
    const toPct = (v) => (v == null ? null : Math.max(0, Math.min(100, ((v - 1) / 4) * 100)));

    const posHealth = emotion.perEmotion.filter((e) => PSYCH_POSITIVE.includes(e.key) && e.avg != null).map((e) => toPct(e.avg));
    const negHealth = emotion.perEmotion.filter((e) => PSYCH_NEGATIVE.includes(e.key) && e.avg != null).map((e) => toPct(6 - (e.avg || 0)));
    const emotionalHealth = mean([...posHealth, ...negHealth]);

    const parts = [];
    if (emotionalHealth != null) parts.push(emotionalHealth);
    if (rules.hasChecklistData) {
      if (rules.compliancePct != null) parts.push(rules.compliancePct);
      if (rules.perfectPct != null) parts.push(rules.perfectPct);
    }
    if (discipline.score != null) parts.push(discipline.score);

    return {
      score: parts.length ? Math.round(Math.max(0, Math.min(100, mean(parts)))) : null,
      emotionalHealth: emotionalHealth != null ? Math.round(emotionalHealth) : null,
    };
  }, [emotion, rules, discipline]);

  const emotionDist = emotion.distribution.map((e) => ({ ...e, color: PSYCH_NEGATIVE.includes(e.key) ? NEG : POS }));
  const mistakeDist = mistakes.perMistake.map((m) => ({ ...m, color: NEG }));

  const confidenceTrend = (emotion.monthlyTrend || []).map((m) => ({ label: m.label, Confidence: m.Confidence }));
  const stressTrend = (emotion.monthlyTrend || []).map((m) => ({ label: m.label, Stress: m.Stress }));

  if (list.length === 0) {
    return (
      <EmptyState
        icon={Brain}
        title="No psychology data yet"
        message="Log trades with emotions, mistakes and checklists to unlock your Psychology Dashboard."
        actionLabel="Get Started"
        onAction={() => onNavigate?.('journal')}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Hero — Psychology Score */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="card card-lift"
        style={{
          padding: '26px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 26,
          flexWrap: 'wrap',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(37,99,235,0.06)), var(--card)',
          borderTop: '2px solid var(--red)',
        }}
      >
        <div style={{ position: 'relative', width: 108, height: 108, flexShrink: 0 }}>
          <svg width="108" height="108" viewBox="0 0 80 80">
            <defs>
              <linearGradient id="psychGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={PURPLE} />
                <stop offset="100%" stopColor={BLUE} />
              </linearGradient>
            </defs>
            <circle cx="40" cy="40" r="32" fill="none" stroke="var(--border)" strokeWidth="7" />
            <circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              stroke="url(#psychGrad)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 32}
              strokeDashoffset={2 * Math.PI * 32 * (1 - (psych.score ?? 0) / 100)}
              transform="rotate(-90 40 40)"
              style={{ transition: 'stroke-dashoffset 0.9s ease', filter: `drop-shadow(0 0 6px ${PURPLE}66)` }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span className="mono" style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, color: 'var(--text)' }}>
              {psych.score ?? '—'}
            </span>
            <span style={{ fontSize: 9, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>/ 100</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={18} color={PURPLE} />
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Psychology Score</h2>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 540 }}>
            A single view of your trading mind — emotions, rule compliance, discipline and perfect execution rolled into one live score.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span className="tag" style={{ background: `${BLUE}18`, color: BLUE, borderColor: 'transparent' }}>
              Emotional {psych.emotionalHealth != null ? `${psych.emotionalHealth}/100` : '—'}
            </span>
            <span className="tag" style={{ background: `${POS}18`, color: POS, borderColor: 'transparent' }}>
              Compliance {rules.compliancePct}%
            </span>
            <span className="tag" style={{ background: `${AMBER}18`, color: AMBER, borderColor: 'transparent' }}>
              Discipline {discipline.score}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Distributions row */}
      <div className="dash-two-col-even">
        <Chart icon={<ListChecks size={15} color={PURPLE} />} title="Emotion Distribution" accent={PURPLE}>
          <Bars data={emotionDist} dataKey="avg" xKey="key" color={PURPLE} height={230} colored />
        </Chart>
        <Chart icon={<XCircle size={15} color={NEG} />} title="Mistake Distribution" accent={NEG}>
          <Bars data={mistakeDist} dataKey="count" xKey="name" color={NEG} height={230} colored />
        </Chart>
      </div>

      {/* Rule Compliance */}
      <Chart icon={<ShieldCheck size={15} color={POS} />} title="Rule Compliance" accent={POS}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          <StatCard label="Rule Compliance" value={rules.compliancePct} format={(v) => `${v}%`} icon={Target} accent={POS} delay={0} />
          <StatCard label="Rule Break Rate" value={rules.breakPct} format={(v) => `${v}%`} icon={XCircle} accent={NEG} delay={0.02} />
          <StatCard label="Perfect Trades" value={rules.perfectCount} format={(v) => `${Math.round(v)}`} icon={Award} accent={PURPLE} delay={0.04} />
          <StatCard label="Perfect Trade %" value={rules.perfectPct} format={(v) => `${v}%`} icon={Gauge} accent={BLUE} delay={0.06} />
        </div>
      </Chart>

      {/* Emotion Timeline */}
      <Chart icon={<History size={15} color={CYAN} />} title="Emotion Timeline" accent={CYAN}>
        <EmotionTimeline data={emotion.monthlyTrend || []} />
      </Chart>

      {/* Three trend widgets */}
      <div className="dash-two-col-even">
        <Chart icon={<TrendingUp size={15} color={BLUE} />} title="Confidence Trend" accent={BLUE}>
          <Lines data={confidenceTrend} domain={[1, 5]} series={[{ key: 'Confidence', color: BLUE, name: 'Confidence' }]} />
        </Chart>
        <Chart icon={<TrendingDown size={15} color={AMBER} />} title="Stress Trend" accent={AMBER}>
          <Lines data={stressTrend} domain={[1, 5]} series={[{ key: 'Stress', color: AMBER, name: 'Stress' }]} />
        </Chart>
      </div>

      <div className="dash-two-col-even">
        <Chart icon={<Grid3x3 size={15} color={CYAN} />} title="Fear vs Confidence" accent={CYAN}>
          <FearConfidenceChart data={emotion.monthlyTrend || []} />
        </Chart>
        <Chart icon={<Gauge size={15} color={POS} />} title="Discipline Trend" accent={POS}>
          <Lines data={disciplineTrend} series={[{ key: 'score', name: 'Discipline', color: POS, width: 3 }]} />
        </Chart>
      </div>

      {/* Institutional Psychology Insights */}
      <PsychologyInsights />
    </div>
  );
}