import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import StatCard from '../StatCard';
import { useData } from '../../context/DataContext';
import { useAccounts } from '../../context/AccountContext';
import { computeDisciplineScore20, BANDS, DISCIPLINE_COMPONENTS, EXECUTION_FIELDS, UNASSIGNED_LABEL } from '../../lib/disciplineScore';
import { Gauge, Target, ShieldCheck, ClipboardCheck, Play, ShieldAlert, NotebookPen, TrendingUp, Activity } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const WEIGHT_ICONS = {
  risk: ShieldCheck,
  plan: ClipboardCheck,
  execution: Play,
  mistake: ShieldAlert,
  review: NotebookPen,
};

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' },
  { value: '30', label: 'Last 30 Days' },
];

const SIGNAL_COLOR = { positive: '#16a34a', neutral: '#2563eb', warning: '#f59e0b' };

const chipBase = {
  padding: '6px 12px',
  borderRadius: 9,
  fontSize: 12,
  fontWeight: 700,
  border: '1.5px solid transparent',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  transition: 'background .15s ease, color .15s ease, border-color .15s ease',
  background: 'transparent',
  whiteSpace: 'nowrap',
};
const chipActive = {
  background: 'rgba(124,58,237,0.15)',
  borderColor: 'rgba(124,58,237,0.4)',
  color: 'var(--text)',
};

function FilterSelect({ label, options, value, onChange }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-faint)' }}>
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'var(--bg-elevated, rgba(255,255,255,0.02))',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: 'var(--text)',
          padding: '5px 8px',
          fontSize: 12,
          fontWeight: 600,
          maxWidth: 180,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ScoreRing({ score, color }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const val = Math.max(0, Math.min(100, score));
  const offset = circ * (1 - val / 100);
  return (
    <div style={{ position: 'relative', width: 132, height: 132, flexShrink: 0 }}>
      <svg width="132" height="132" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 42 42)"
          style={{ transition: 'stroke-dashoffset 0.8s ease', filter: `drop-shadow(0 0 5px ${color}66)` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span className="mono" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: 'var(--text)' }}>
          {val}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>/ 100</span>
      </div>
    </div>
  );
}

function TrendLine({ data, color, height = 180 }) {
  if (!data || !data.length) {
    return (
      <div className="empty-state" style={{ padding: '22px 12px' }}>
        <p style={{ fontSize: 13 }}>Not enough historical data for a trend yet.</p>
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="card" style={{ padding: '8px 12px', fontSize: 12.5 }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontWeight: 700, color }}>{payload[0].value}/100</div>
                </div>
              ) : null
            }
          />
          <Line type="monotone" dataKey="score" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color, strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DisciplineScore20() {
  const { trades, models, riskCriteria, checklistCriteria, reflections } = useData();
  const { allAccounts, selectedAccount } = useAccounts();

  const [period, setPeriod] = useState('all');
  const [pair, setPair] = useState('All');
  const [session, setSession] = useState('All');
  const [setup, setSetup] = useState('All');

  const data = useMemo(
    () => computeDisciplineScore20(trades.items, { models, riskCriteria, checklistCriteria, reflections: reflections.items, period, pair, session, setup }),
    [trades.items, models, riskCriteria, checklistCriteria, reflections.items, period, pair, session, setup]
  );

  const safePair = data.pairOptions.includes(pair) || pair === 'All' ? pair : 'All';
  const safeSession = data.sessionOptions.includes(session) || session === 'All' ? session : 'All';
  const safeSetup = data.setupOptions.includes(setup) || setup === 'All' ? setup : 'All';

  const pairOptions = [{ value: 'All', label: 'All Pairs' }, ...data.pairOptions.map((p) => ({ value: p, label: p }))];
  const sessionOptions = [{ value: 'All', label: 'All Sessions' }, ...data.sessionOptions.map((s) => ({ value: s, label: s }))];
  const setupOptions = [{ value: 'All', label: 'All Setups' }, ...data.setupOptions.map((s) => ({ value: s, label: s }))];

  const scopeLabel = allAccounts ? 'All Accounts' : selectedAccount?.name || 'Selected Account';
  const band = data.band || BANDS[BANDS.length - 1];
  const activeCount = data.components.filter((c) => c.available).length;

  const renderEmpty = () => (
    <div style={{ marginTop: 14 }}>
      <EmptyState
        icon={Gauge}
        title="Not enough data to compute a discipline score"
        message="Log trades with Risk and Trade Checklists, execution fields, mistakes and reviews to unlock a real, transparent Discipline Score."
      />
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Gauge size={16} color={band.color} /> Discipline Score · 2.0
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.03em' }}>· {scopeLabel}</span>
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 660, marginBottom: 0 }}>
            A transparent, weighted 0–100 built entirely from your real data — Risk (30%), Plan &amp; Checklist (25%), Execution (20%), Mistake Control (15%) and Review &amp; Reflection (10%). Every missing data source is shown, never hidden.
          </p>
        </div>
        <div style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--bg-elevated, rgba(255,255,255,0.02))', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {PERIODS.map((p) => (
            <button key={p.value} type="button" onClick={() => setPeriod(p.value)} style={{ ...chipBase, ...(period === p.value ? chipActive : {}) }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <FilterSelect label="Pair" options={pairOptions} value={safePair} onChange={setPair} />
        <FilterSelect label="Session" options={sessionOptions} value={safeSession} onChange={setSession} />
        <FilterSelect label="Setup" options={setupOptions} value={safeSetup} onChange={setSetup} />
      </div>

      {data.total === 0 ? (
        renderEmpty()
      ) : (
        <>
          {/* A) Overall + coverage */}
          <div className="card" style={{ padding: '20px 22px', marginBottom: 16, border: `1px solid ${band.color}26`, background: `${band.color}0a` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
              <ScoreRing score={data.score ?? 0} color={band.color} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{band.label}</span>
                  <span
                    style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: `${band.color}1a`, color: band.color }}
                  >
                    {band.min}–{band.max}
                  </span>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6, maxWidth: 480, lineHeight: 1.5 }}>
                  {data.score === null ? 'No discipline sources have data in this view yet.' : band.message}
                </p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-faint)' }}>Data Coverage</div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{data.coveragePct}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-faint)' }}>Components Active</div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{activeCount} / {DISCIPLINE_COMPONENTS.length}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-faint)' }}>Trades in View</div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{data.total}</div>
                  </div>
                </div>
                {data.score !== null && data.coveragePct < 100 && (
                  <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>
                    Score confidence is limited because some discipline data is missing — the total is computed only from the
                    components above that have real data ({data.coveragePct}/{100} weight points).
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* B) Stat snapshots */}
          <div className="dash-stats-grid" style={{ marginBottom: 16 }}>
            {data.components.map((c, i) => {
              const Icon = WEIGHT_ICONS[c.key] || Target;
              return (
                <StatCard
                  key={c.key}
                  label={c.label}
                  value={c.available ? c.score : '—'}
                  format={(v) => (typeof v === 'number' ? `${Math.round(v)}` : '—')}
                  icon={Icon}
                  accent={c.available && c.score < 70 ? '#dc2626' : '#16a34a'}
                  delay={i * 0.02}
                  sub={c.available ? `${c.weight}% weight · ${c.engaged} trad${c.engaged === 1 ? 'e' : 'es'}` : 'NOT ENOUGH DATA'}
                />
              );
            })}
          </div>

          {/* C) Component breakdown with weights */}
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 640 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  <th scope="col" style={{ padding: '0 10px 10px 0' }}>Component</th>
                  <th scope="col" style={{ padding: '0 10px 10px' }}>Weight</th>
                  <th scope="col" style={{ padding: '0 10px 10px' }}>Points</th>
                  <th scope="col" style={{ padding: '0 10px 10px' }}>Coverage</th>
                  <th scope="col" style={{ padding: '0 0 10px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.components.map((c) => {
                  const color = !c.available ? '#94a3b8' : c.score >= 80 ? '#16a34a' : c.score >= 60 ? '#f59e0b' : '#dc2626';
                  return (
                    <tr key={c.key} style={{ borderTop: '1px solid var(--border)' }}>
                      <th scope="row" style={{ padding: '10px 10px 10px 0', fontWeight: 600, textAlign: 'left' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                          {(() => {
                            const I = WEIGHT_ICONS[c.key] || Target;
                            return <I size={14} color={color} />;
                          })()}
                          {c.label}
                        </span>
                      </th>
                      <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{c.weight}%</td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="mono" style={{ fontWeight: 700, color, width: 34 }}>{c.available ? `${c.points}/${c.weight}` : '—'}</span>
                          <span style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(128,128,128,0.15)', overflow: 'hidden', maxWidth: 160 }}>
                            <span
                              style={{
                                display: 'block',
                                height: '100%',
                                width: `${c.available ? Math.min(100, c.score) : 0}%`,
                                background: color,
                                borderRadius: 3,
                              }}
                            />
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px', color: 'var(--text-faint)' }}>{c.available ? c.note : '—'}</td>
                      <td style={{ padding: '10px 0' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            fontSize: 10.5,
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                            textTransform: 'uppercase',
                            padding: '3px 8px',
                            borderRadius: 7,
                            background: `${color}14`,
                            color,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.available ? 'Measured' : 'Not enough data'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* D) Descriptive observations */}
          <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)', marginBottom: 10 }}>
              <Activity size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> What this score is based on
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.improvements.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>No observations yet.</div>}
              {data.improvements.map((ins, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.45 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: SIGNAL_COLOR[ins.signal] || '#94a3b8', marginTop: 6, flexShrink: 0 }} />
                  <span>{ins.claim}</span>
                </div>
              ))}
            </div>
          </div>

          {/* E) Trend */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)', marginBottom: 8 }}>
                <TrendingUp size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Weekly score trend
              </div>
              <TrendLine data={data.weekly} color="#16a34a" />
            </div>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)', marginBottom: 8 }}>
                <TrendingUp size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Monthly score trend
              </div>
              <TrendLine data={data.monthly} color="#2563eb" />
            </div>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '14px 0 0' }}>
            Weights: Risk {DISCIPLINE_COMPONENTS[0].weight}% · Plan &amp; Checklist {DISCIPLINE_COMPONENTS[1].weight}% · Execution {DISCIPLINE_COMPONENTS[2].weight}% · Mistake{' '}
            {DISCIPLINE_COMPONENTS[3].weight}% · Review &amp; Reflection {DISCIPLINE_COMPONENTS[4].weight}%. Missing sources are excluded and shown as &apos;Not enough data&apos; — coverage above shows how much of the
            score your real logs deliver. Execution is measured on: {EXECUTION_FIELDS.join(', ')}. Trades without a pair/setup remain under &apos;{UNASSIGNED_LABEL}&apos;.
          </p>
        </>
      )}
    </motion.div>
  );
}