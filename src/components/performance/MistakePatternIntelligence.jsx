import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import StatCard from '../StatCard';
import { useData } from '../../context/DataContext';
import { useAccounts } from '../../context/AccountContext';
import { formatMoney, pnlClass } from '../../lib/utils';
import { computeMistakePattern, RANK_MODES, RECURRING_MIN, FREQUENT_MIN, UNASSIGNED_LABEL } from '../../lib/mistakePattern';
import { AlertTriangle, Layers, Repeat, TrendingDown } from 'lucide-react';

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' },
  { value: '30', label: 'Last 30 Days' },
];

const STATUS_COLOR = {
  Frequent: '#dc2626',
  Recurring: '#f59e0b',
  Occasional: '#94a3b8',
  'No Data': '#94a3b8',
};

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

function StatusChip({ status }) {
  const color = STATUS_COLOR[status] || '#94a3b8';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
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
      {status}
    </span>
  );
}

function ContextList({ title, items }) {
  if (!items || !items.length) {
    return (
      <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Not enough data yet.</div>
    );
  }
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)', marginBottom: 8 }}>
        {title}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it) => (
          <li key={it.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{it.label}</span>
            <span style={{ fontWeight: 700, flexShrink: 0, color: 'var(--text-muted)' }}>× {it.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// One mistake's complete detail card (used in the top-mistakes spotlight).
function MistakeDetail({ row }) {
  if (!row) return null;
  const decided = row.wins + row.losses;
  return (
    <div className="card" style={{ padding: '12px 16px', fontSize: 12.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>{row.name}</span>
        <StatusChip status={row.status} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 6 }}>
        <div style={{ color: 'var(--text-faint)' }}>Affected trades <strong style={{ color: 'var(--text)' }}>{row.affectedTrades}</strong></div>
        <div style={{ color: 'var(--text-faint)' }}>Occurrences <strong style={{ color: 'var(--text)' }}>{row.occurrences}</strong></div>
        <div style={{ color: 'var(--text-faint)' }}>Win rate <strong style={{ color: 'var(--text)' }}>{decided ? `${row.winRate.toFixed(1)}%` : '—'}</strong></div>
        <div style={{ color: 'var(--text-faint)' }}>
          Net P&L <strong className={pnlClass(row.netPnl)}>{formatMoney(row.netPnl)}</strong>
        </div>
        <div style={{ color: 'var(--text-faint)' }}>Avg P&L <strong className={pnlClass(row.avgPnl)}>{formatMoney(row.avgPnl)}</strong></div>
        <div style={{ color: 'var(--text-faint)' }}>Avg RR <strong style={{ color: 'var(--text)' }}>{row.avgRR ? row.avgRR.toFixed(2) : '—'}</strong></div>
      </div>
    </div>
  );
}

function InsightList({ insights }) {
  if (!insights?.length) return null;
  const SIGNAL_COLOR = { positive: '#16a34a', warning: '#f59e0b', neutral: '#2563eb' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {insights.map((ins, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.45 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: SIGNAL_COLOR[ins.signal] || '#94a3b8', marginTop: 6, flexShrink: 0 }} />
          <span>{ins.claim}</span>
        </div>
      ))}
    </div>
  );
}

export default function MistakePatternIntelligence() {
  const { trades } = useData();
  const { allAccounts, selectedAccount } = useAccounts();

  const [period, setPeriod] = useState('all');
  const [rank, setRank] = useState('affectedTrades');
  const [pair, setPair] = useState('All');
  const [session, setSession] = useState('All');
  const [setup, setSetup] = useState('All');
  const [focused, setFocused] = useState(null);

  const data = useMemo(
    () => computeMistakePattern(trades.items, { period, pair, session, setup, rank }),
    [trades.items, period, pair, session, setup, rank]
  );

  const safePair = data.pairOptions.includes(pair) || pair === 'All' ? pair : 'All';
  const safeSession = data.sessionOptions.includes(session) || session === 'All' ? session : 'All';
  const safeSetup = data.setupOptions.includes(setup) || setup === 'All' ? setup : 'All';

  const pairOptions = [{ value: 'All', label: 'All Pairs' }, ...data.pairOptions.map((p) => ({ value: p, label: p }))];
  const sessionOptions = [{ value: 'All', label: 'All Sessions' }, ...data.sessionOptions.map((s) => ({ value: s, label: s }))];
  const setupOptions = [{ value: 'All', label: 'All Setups' }, ...data.setupOptions.map((s) => ({ value: s, label: s }))];

  const scopeLabel = allAccounts ? 'All Accounts' : selectedAccount?.name || 'Selected Account';
  const rankLabel = RANK_MODES.find((r) => r.value === data.rank)?.label || 'Frequency';

  const focusedRow = data.rows.find((r) => r.name === focused) || null;
  const noMistakes = data.totalTrades > 0 && !data.hasMistakes;
  const limitedOnly = data.hasMistakes && data.rows.every((r) => r.status === 'Occasional');

  const renderEmpty = () => {
    if (trades.items.length === 0) {
      return (
        <div style={{ marginTop: 14 }}>
          <EmptyState
            icon={AlertTriangle}
            title="No mistake patterns recorded yet"
            message="Tick what you did wrong in the Mistakes section of a trade, and patterns will appear here once you have reviewed trades."
          />
        </div>
      );
    }
    if (noMistakes) {
      return (
        <div style={{ marginTop: 14 }}>
          <EmptyState
            icon={AlertTriangle}
            title="No mistake patterns recorded yet"
            message="No mistake tags exist on the trades in this view. Log mistake tags during trade reviews to populate this section."
          />
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <AlertTriangle size={16} color="#dc2626" /> Mistake Pattern Intelligence
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.03em' }}>· {scopeLabel}</span>
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 640, marginBottom: 0 }}>
            Recurring mistakes, their frequency and the real performance around them — descriptive associations, never claims of causation.
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
        <div style={{ flex: 1 }} />
        <div style={{ display: 'inline-flex', gap: 4, padding: 3, borderRadius: 11, border: '1px solid var(--border)', background: 'var(--bg-elevated, rgba(255,255,255,0.02))', flexWrap: 'wrap' }}>
          {RANK_MODES.map((r) => (
            <button key={r.value} type="button" onClick={() => setRank(r.value)} style={{ ...chipBase, ...(rank === r.value ? chipActive : {}) }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {renderEmpty()}

      {noMistakes && <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 10 }}>Mistake tags and trade reflections populate this section — no fabricated patterns are ever shown.</p>}

      {!noMistakes && data.hasMistakes && (
        <>
          {/* A) Mistake Overview */}
          <div className="dash-stats-grid" style={{ marginBottom: 8 }}>
            <StatCard label="Mistake Occurrences" value={data.totalOccurrences} format={(v) => `${Math.round(v)}`} icon={Layers} accent="#dc2626" delay={0} />
            <StatCard label="Affected trades" value={data.affectedTradeCount} format={(v) => `${Math.round(v)}`} icon={Repeat} accent="#b45309" delay={0.04} />
            <StatCard
              label="Most frequent"
              value={data.rows[0]?.name || '—'}
              format={(v) => v}
              icon={AlertTriangle}
              accent="#7c3aed"
              delay={0.08}
              sub={data.rows[0] ? `${data.rows[0].affectedTrades} affected · ${data.rows[0].occurrences} occurrences` : ''}
            />
            <StatCard
              label="Worst P&L association"
              value={(() => {
                const worst = [...data.rows].sort((a, b) => a.netPnl - b.netPnl)[0];
                return worst && worst.netPnl < 0 ? formatMoney(worst.netPnl) : '—';
              })()}
              format={(v) => v}
              icon={TrendingDown}
              accent="#dc2626"
              delay={0.12}
              valueClass={(() => {
                const worst = [...data.rows].sort((a, b) => a.netPnl - b.netPnl)[0];
                return worst && worst.netPnl < 0 ? 'pnl-neg' : undefined;
              })()}
            />
          </div>

          {/* Insight cards (rule-based, descriptive only) */}
          {data.insights.length > 0 && (
            <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)', marginBottom: 10 }}>
                Descriptive observations
              </div>
              <InsightList insights={data.insights} />
            </div>
          )}

          {/* B) Top Recurring Mistakes + focused detail */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Top mistakes · ranked by {rankLabel}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.rows.slice(0, 10).map((r) => {
                const barPct = data.rows[0]?.affectedTrades ? Math.round((r.affectedTrades / Math.max(data.rows[0].affectedTrades, 1)) * 100) : 0;
                const active = focused === r.name;
                return (
                  <button
                    key={r.name}
                    type="button"
                    onClick={() => setFocused(active ? null : r.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      border: active ? '1.5px solid rgba(124,58,237,0.55)' : '1.5px solid var(--border)',
                      background: active ? 'rgba(124,58,237,0.08)' : 'var(--bg-elevated, rgba(255,255,255,0.02))',
                      borderRadius: 10,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: 'var(--text)',
                      transition: 'border-color .12s ease, background .12s ease',
                    }}
                  >
                    <span style={{ width: 150, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, flexShrink: 0 }}>
                      {r.name}
                    </span>
                    <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(128,128,128,0.15)', overflow: 'hidden' }}>
                        <span
                          style={{
                            display: 'block',
                            height: '100%',
                            width: `${barPct}%`,
                            background: 'linear-gradient(90deg, #dc2626, #f59e0b)',
                            borderRadius: 3,
                          }}
                        />
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-faint)', flexShrink: 0 }}>{r.affectedTrades} trade{r.affectedTrades === 1 ? '' : 's'}</span>
                    </span>
                    <StatusChip status={r.status} />
                  </button>
                );
              })}
            </div>
            {focusedRow && (
              <div style={{ marginTop: 10 }}>
                <MistakeDetail row={focusedRow} />
              </div>
            )}
          </div>

          {/* C) Mistake Impact Table */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Mistake impact
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 820 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <th scope="col" style={{ padding: '0 10px 10px 0' }}>Mistake</th>
                    <th scope="col" style={{ padding: '0 10px 10px' }}>Occurrences</th>
                    <th scope="col" style={{ padding: '0 10px 10px' }}>Affected</th>
                    <th scope="col" style={{ padding: '0 10px 10px' }}>Wins</th>
                    <th scope="col" style={{ padding: '0 10px 10px' }}>Losses</th>
                    <th scope="col" style={{ padding: '0 10px 10px' }}>Win Rate</th>
                    <th scope="col" style={{ padding: '0 10px 10px' }}>Loss Rate</th>
                    <th scope="col" style={{ padding: '0 10px 10px' }}>Net P&L</th>
                    <th scope="col" style={{ padding: '0 10px 10px' }}>Avg P&L</th>
                    <th scope="col" style={{ padding: '0 10px 10px' }}>Avg R:R</th>
                    <th scope="col" style={{ padding: '0 0 10px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => {
                    const decided = r.wins + r.losses;
                    return (
                      <tr
                        key={r.name}
                        onClick={() => setFocused(focused === r.name ? null : r.name)}
                        style={{ borderTop: '1px solid var(--border)', cursor: 'pointer', background: focused === r.name ? 'rgba(124,58,237,0.06)' : undefined }}
                      >
                        <th scope="row" style={{ padding: '9px 10px 9px 0', fontWeight: 600, textAlign: 'left' }}>{r.name}</th>
                        <td style={{ padding: '9px 10px' }}>{r.occurrences}</td>
                        <td style={{ padding: '9px 10px', fontWeight: 600 }}>{r.affectedTrades}</td>
                        <td style={{ padding: '9px 10px', color: 'var(--text-muted)' }}>{r.wins}</td>
                        <td style={{ padding: '9px 10px', color: 'var(--text-muted)' }}>{r.losses}</td>
                        <td style={{ padding: '9px 10px' }}>{decided ? `${r.winRate.toFixed(1)}%` : '—'}</td>
                        <td style={{ padding: '9px 10px' }}>{decided ? `${r.lossRate.toFixed(1)}%` : '—'}</td>
                        <td className="mono" style={{ padding: '9px 10px', fontWeight: 600 }}>
                          <span className={pnlClass(r.netPnl)}>{formatMoney(r.netPnl)}</span>
                        </td>
                        <td className="mono" style={{ padding: '9px 10px' }}>
                          <span className={pnlClass(r.avgPnl)}>{formatMoney(r.avgPnl)}</span>
                        </td>
                        <td style={{ padding: '9px 10px' }}>{r.avgRR ? r.avgRR.toFixed(2) : '—'}</td>
                        <td style={{ padding: '9px 0' }}>
                          <StatusChip status={r.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* D) Mistake × Setup / Pair / Session relationships */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <div className="card" style={{ padding: '14px 16px' }}>
              <ContextList title="Associated setups" items={focusedRow ? focusedRow.setups : data.rows[0]?.setups} />
            </div>
            <div className="card" style={{ padding: '14px 16px' }}>
              <ContextList title="Associated pairs" items={focusedRow ? focusedRow.pairs : data.rows[0]?.pairs} />
            </div>
            <div className="card" style={{ padding: '14px 16px' }}>
              <ContextList title="Associated sessions" items={focusedRow ? focusedRow.sessions : data.rows[0]?.sessions} />
            </div>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '12px 0 0' }}>
            Frequency guards: Occasional = 1–2, Recurring = 3–4, Frequent = 5+ occurrences (thresholds {RECURRING_MIN}+, {FREQUENT_MIN}+). Relationships are counts of trades
            carrying a mistake per setup / pair / session — associations only, never causation. Trades without a pair/setup remain under &apos;{UNASSIGNED_LABEL}&apos;.
          </p>
        </>
      )}
    </motion.div>
  );
}