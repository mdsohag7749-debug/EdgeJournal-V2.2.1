import { useMemo } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import StatCard from '../StatCard';
import { useData } from '../../context/DataContext';
import { computeRuleCompliance } from '../../lib/ruleCompliance';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { ShieldCheck, Target, XCircle, Award, Gavel, CalendarDays, TrendingUp, ListChecks } from 'lucide-react';

const POS = '#16a34a';
const NEG = '#dc2626';
const BLUE = '#2563eb';
const PURPLE = '#7c3aed';
const AMBER = '#f59e0b';

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

function ComplianceBars({ data, xKey, color, height = 240, prefix = '%' }) {
  if (!data || !data.length) {
    return (
      <div className="empty-state" style={{ padding: '26px 14px' }}>
        <p style={{ fontSize: 13 }}>No compliance data yet.</p>
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<ChartTip prefix={prefix} />} cursor={{ fill: 'rgba(128,128,128,0.08)' }} />
          <Bar dataKey={xKey} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ComplianceLine({ data, color = POS, height = 240 }) {
  if (!data || !data.length) {
    return (
      <div className="empty-state" style={{ padding: '26px 14px' }}>
        <p style={{ fontSize: 13 }}>No compliance trend yet.</p>
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<ChartTip prefix="%" />} />
          <Line type="monotone" dataKey="compliancePct" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color, strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function RuleTable({ rows }) {
  if (!rows || !rows.length) {
    return (
      <div className="empty-state">
        <p>No rule checks logged yet.</p>
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            <th style={{ padding: '0 10px 10px 0' }}>Rule</th>
            <th style={{ padding: '0 10px 10px' }}>Followed</th>
            <th style={{ padding: '0 10px 10px' }}>Broken</th>
            <th style={{ padding: '0 10px 10px' }}>Compliance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name || i} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '10px 10px 10px 0', fontWeight: 600 }}>{r.name}</td>
              <td style={{ padding: '10px', color: 'var(--win)' }}>{r.followed}</td>
              <td style={{ padding: '10px', color: 'var(--loss)' }}>{r.broken}</td>
              <td style={{ padding: '10px', fontWeight: 600 }}>{r.compliancePct}%</td>
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

export default function RuleComplianceAnalytics() {
  const { trades, riskCriteria, checklistCriteria } = useData();
  const r = useMemo(
    () => computeRuleCompliance(trades.items, { riskCriteria, checklistCriteria }),
    [trades.items, riskCriteria, checklistCriteria]
  );
  const empty = r.total === 0 || !r.hasChecklistData;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={16} color="#16a34a" /> Rule Compliance
        </h3>
        <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 560, marginBottom: 0 }}>
          How faithfully you follow your own rules — Risk &amp; Trade Checklists, with every logged mistake counted as a break.
        </p>
      </motion.div>

      {empty ? (
        <EmptyState
          icon={ShieldCheck}
          title="No rule compliance data yet"
          message="Use the Risk Management and Trade Checklists when logging trades to unlock compliance, break and trend analytics."
        />
      ) : (
        <>
          <div className="dash-stats-grid">
            <StatCard label="Rule Compliance" value={r.compliancePct} format={(v) => `${v}%`} icon={Target} accent={POS} delay={0} sub="Average across engaged trades" />
            <StatCard label="Rule Break Rate" value={r.breakPct} format={(v) => `${v}%`} icon={XCircle} accent={NEG} delay={0.02} sub="Trades with a logged mistake" />
            <StatCard
              label="Perfect Trades"
              value={r.perfectCount}
              format={(v) => `${Math.round(v)}`}
              icon={Award}
              accent={PURPLE}
              delay={0.04}
              sub={r.perfectPct ? `${r.perfectPct}% of engaged trades` : ''}
            />
            <StatCard
              label="Most Broken Rule"
              value={r.mostBrokenRule?.name || '—'}
              format={(v) => v}
              icon={Gavel}
              accent={NEG}
              delay={0.06}
              sub={r.mostBrokenRule ? `Broken ${r.mostBrokenRule.broken} time${r.mostBrokenRule.broken === 1 ? '' : 's'}` : ''}
            />
          </div>

          <div className="dash-two-col-even">
            <SectionCard title="Weekly Compliance" icon={CalendarDays} accent={BLUE}>
              <ComplianceBars data={r.weekly} xKey="compliancePct" color={BLUE} />
            </SectionCard>
            <SectionCard title="Monthly Compliance" icon={TrendingUp} accent={PURPLE}>
              <ComplianceBars data={r.monthly} xKey="compliancePct" color={PURPLE} />
            </SectionCard>
          </div>

          <div className="dash-two-col-even">
            <SectionCard title="Compliance Trend" icon={TrendingUp} accent={POS}>
              <ComplianceLine data={r.trend} />
            </SectionCard>
            <SectionCard title="Rules Breakdown" icon={ListChecks} accent={AMBER}>
              <RuleTable rows={r.byRule} />
            </SectionCard>
          </div>
        </>
      )}
    </motion.div>
  );
}