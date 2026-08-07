import { useMemo } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import StatCard from '../StatCard';
import { useData } from '../../context/DataContext';
import { computeEmotionAnalytics } from '../../lib/emotionAnalytics';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { Brain, Waves, Flame, ShieldAlert, Gauge, Activity, TrendingUp, Zap } from 'lucide-react';

const POS = '#16a34a';
const NEG = '#dc2626';

function ChartTip({ active, payload, label, prefix }) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12.5 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{v != null ? `${typeof v === 'number' ? v.toFixed(1) : v}${prefix || ''}` : '—'}</div>
    </div>
  );
}

function DistributionBars({ data }) {
  if (!data || !data.length) {
    return (
      <div className="empty-state" style={{ padding: '26px 14px' }}>
        <p style={{ fontSize: 13 }}>No emotion ratings yet.</p>
      </div>
    );
  }
  const height = Math.max(220, data.length * 34 + 60);
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 5, right: 16, left: -12, bottom: 0 }} layout="vertical">
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis type="number" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} />
          <YAxis type="category" dataKey="key" width={88} tick={{ fill: 'var(--text-muted)', fontSize: 11.5 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTip prefix=" / 5" />} cursor={{ fill: 'rgba(128,128,128,0.08)' }} />
          <Bar dataKey="avg" radius={[0, 5, 5, 0]} barSize={16}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.tone === 'pos' ? POS : NEG} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmotionTrend({ data }) {
  if (!data || !data.length) {
    return (
      <div className="empty-state" style={{ padding: '26px 14px' }}>
        <p style={{ fontSize: 13 }}>Add a few rated months to see your trend.</p>
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: 250 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} />
          <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<ChartTip prefix=" / 5" />} />
          <Legend verticalAlign="top" iconType="plainline" wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 4 }} />
          <Line type="monotone" dataKey="Confidence" stroke={POS} strokeWidth={2.5} dot={false} connectNulls name="Confidence" />
          <Line type="monotone" dataKey="Focus" stroke="#7c3aed" strokeWidth={2} dot={false} connectNulls name="Focus" />
          <Line type="monotone" dataKey="Fear" stroke={NEG} strokeWidth={2} dot={false} connectNulls name="Fear" />
          <Line type="monotone" dataKey="Stress" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls name="Stress" />
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

const pct = (v) => (v != null ? `${v.toFixed(1)}%` : '—');
const score = (v) => (v != null ? `${v.toFixed(1)}/5` : '—');

export default function EmotionAnalytics() {
  const { trades } = useData();
  const e = useMemo(() => computeEmotionAnalytics(trades.items), [trades.items]);
  const empty = e.total === 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={16} color="#7c3aed" /> Emotion Analytics
        </h3>
        <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 560, marginBottom: 0 }}>
          Your trading psychology across every recorded trade — most common emotion, confidence and the disruptive states that leak into your P&L.
        </p>
      </motion.div>

      {empty ? (
        <EmptyState
          icon={Brain}
          title="No emotion ratings yet"
          message="Rate your emotions in the Trading Psychology section of a trade to unlock emotional distribution, confidence and discipline analytics."
        />
      ) : (
        <>
          <div className="dash-stats-grid">
            <StatCard
              label="Most Common Emotion"
              value={e.mostCommonEmotion?.key || '—'}
              format={(v) => v}
              icon={Gauge}
              accent="#7c3aed"
              delay={0}
              sub={e.mostCommonEmotion?.avg != null ? `Avg ${e.mostCommonEmotion.avg.toFixed(1)}/5` : ''}
            />
            <StatCard label="Average Confidence" value={e.avgConfidence} format={score} icon={TrendingUp} accent={POS} delay={0.02} />
            <StatCard label="Average Focus" value={e.avgFocus} format={score} icon={Activity} accent="#2563eb" delay={0.04} />
            <StatCard label="Fear Frequency" value={e.fearFreq} format={pct} icon={ShieldAlert} accent={NEG} delay={0.06} />
            <StatCard label="Greed Frequency" value={e.greedFreq} format={pct} icon={Waves} accent={NEG} delay={0.08} />
            <StatCard label="FOMO Frequency" value={e.fomoFreq} format={pct} icon={Zap} accent="#b45309" delay={0.1} />
            <StatCard label="Stress Frequency" value={e.stressFreq} format={pct} icon={Flame} accent="#dc2626" delay={0.12} />
            <StatCard label="Rated Trades" value={e.total} format={(v) => `${Math.round(v)}`} icon={Brain} accent="#16a34a" delay={0.14} />
          </div>

          <div className="dash-two-col-even">
            <SectionCard title="Emotion Distribution" icon={Brain} accent="#7c3aed">
              <DistributionBars data={e.distribution} />
            </SectionCard>
            <SectionCard title="Monthly Emotion Trend" icon={TrendingUp} accent="#2563eb">
              <EmotionTrend data={e.monthlyTrend} />
            </SectionCard>
          </div>
        </>
      )}
    </motion.div>
  );
}