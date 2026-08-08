import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import { useData } from '../../context/DataContext';
import { useAccounts } from '../../context/AccountContext';
import { formatMoney, pnlClass } from '../../lib/utils';
import { computeSetupPerformance, RANK_MODES, UNASSIGNED_LABEL } from '../../lib/setupPerformance';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Layers, TrendingUp, AlertTriangle } from 'lucide-react';

const WIN_COLOR = '#16a34a';
const LOSS_COLOR = '#dc2626';

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'month', label: 'This Month' },
  { value: 'week', label: 'This Week' },
  { value: '30', label: 'Last 30 Days' },
];

const STATUS_COLOR = {
  Normal: '#16a34a',
  'Limited data': '#f59e0b',
  'No data': '#94a3b8',
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
        fontSize: 11,
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

function formatPF(v) {
  if (v === Infinity) return '∞';
  return v ? v.toFixed(2) : '—';
}

function rankLabel(value) {
  const mode = RANK_MODES.find((r) => r.value === value);
  return mode ? mode.label : 'Net P&L';
}

function SetupTooltip({ active, payload, rank }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const display = row[rank];
  const value =
    rank === 'netPnl' ? formatMoney(display) : rank === 'winRate' ? `${(display ?? 0).toFixed(1)}%` : rank === 'avgRR' ? `${(display ?? 0).toFixed(2)} R` : formatPF(display);
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12.5 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{row.label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
      <div style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>
        {row.decided} decided · {row.trades} total
      </div>
    </div>
  );
}

export default function SetupPerformanceDashboard() {
  const { trades } = useData();
  const { allAccounts, selectedAccount } = useAccounts();

  const [period, setPeriod] = useState('all');
  const [pair, setPair] = useState('All');
  const [session, setSession] = useState('All');
  const [rank, setRank] = useState('netPnl');

  const data = useMemo(
    () => computeSetupPerformance(trades.items, { period, pair, session, rank }),
    [trades.items, period, pair, session, rank]
  );

  // Guard the selects so a filter value that drops out of the options (e.g.
  // account switch) falls back to "All" instead of rendering a stale value.
  const safePair = data.pairOptions.includes(pair) || pair === 'All' ? pair : 'All';
  const safeSession = data.sessionOptions.includes(session) || session === 'All' ? session : 'All';

  const pairOptions = [{ value: 'All', label: 'All Pairs' }, ...data.pairOptions.map((p) => ({ value: p, label: p }))];
  const sessionOptions = [{ value: 'All', label: 'All Sessions' }, ...data.sessionOptions.map((s) => ({ value: s, label: s }))];

  const scopeLabel = allAccounts ? 'All Accounts' : selectedAccount?.name || 'Selected Account';

  const chartData = useMemo(() => {
    const pick = (r) => (r.status === 'No data' ? 0 : r[rank]);
    const plotValue = (s) => {
      const v = pick(s);
      // Cap an infinite profit factor for chart plotting only (tooltip still
      // shows the true "∞"); raw metrics in the table remain untouched.
      return rank === 'profitFactor' && v === Infinity ? 99.99 : v;
    };
    return data.setups
      .filter((s) => s.decided > 0)
      .map((s) => ({ ...s, value: plotValue(s) }))
      .sort((a, b) => b.value - a.value);
  }, [data.setups, rank]);

  const noSetups = data.setups.length === 0 || !data.hasAnySetup;
  const limitedOnly = data.setups.length > 0 && data.setups.every((s) => s.status === 'Limited data' || s.status === 'No data');

  const renderEmpty = () => {
    if (trades.items.length === 0) {
      return (
        <div style={{ marginTop: 14 }}>
          <EmptyState
            icon={Layers}
            title="No setup performance data yet"
            message="Setup performance appears once trades are logged with a Setup / Model. Percentages here are never fabricated."
          />
        </div>
      );
    }
    if (!data.hasData) {
      return (
        <div style={{ marginTop: 14 }}>
          <EmptyState
            icon={Layers}
            title="Nothing in this view"
            message="No trades match the current period, pair and session filters. Adjust the filters or switch account."
          />
        </div>
      );
    }
    if (noSetups) {
      return (
        <div style={{ marginTop: 14 }}>
          <EmptyState
            icon={Layers}
            title="No setups to analyse yet"
            message="Assign a Setup / Model to your trades (in the Log Trade form) to unlock per-setup performance here."
          />
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    if (!chartData.length) {
      return (
        <div className="empty-state" style={{ padding: '24px 14px' }}>
          <p style={{ fontSize: 13 }}>Not enough decided trades to chart yet.</p>
        </div>
      );
    }
    const isMoney = rank === 'netPnl';
    const axisWidth = isMoney ? 56 : 44;
    const fmtTick = (v) => {
      if (rank === 'winRate') return `${Math.round(v)}%`;
      if (rank === 'avgRR') return `${v.toFixed(1)}R`;
      if (rank === 'profitFactor') return v === Infinity ? '∞' : `${v.toFixed(0)}`;
      return Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`;
    };
    const barColor = (d) => (rank === 'netPnl' ? (d.netPnl >= 0 ? WIN_COLOR : LOSS_COLOR) : '#7c3aed');
    return (
      <div style={{ width: '100%', height: 250 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: isMoney ? -6 : -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} interval={0} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtTick} width={axisWidth} />
            <Tooltip content={<SetupTooltip rank={rank} />} cursor={{ fill: 'rgba(128,128,128,0.08)' }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={barColor(d)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderTable = () => {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 780 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              <th scope="col" style={{ padding: '0 10px 10px 0' }}>#</th>
              <th scope="col" style={{ padding: '0 10px 10px' }}>Setup</th>
              <th scope="col" style={{ padding: '0 10px 10px' }}>Trades</th>
              <th scope="col" style={{ padding: '0 10px 10px' }}>Wins</th>
              <th scope="col" style={{ padding: '0 10px 10px' }}>Losses</th>
              <th scope="col" style={{ padding: '0 10px 10px' }}>Win Rate</th>
              <th scope="col" style={{ padding: '0 10px 10px' }}>Avg RR</th>
              <th scope="col" style={{ padding: '0 10px 10px' }}>Net P&L</th>
              <th scope="col" style={{ padding: '0 10px 10px' }}>Avg P&L</th>
              <th scope="col" style={{ padding: '0 10px 10px' }}>Avg Win</th>
              <th scope="col" style={{ padding: '0 10px 10px' }}>Avg Loss</th>
              <th scope="col" style={{ padding: '0 10px 10px' }}>Profit Factor</th>
              <th scope="col" style={{ padding: '0 10px 10px' }}>Best</th>
              <th scope="col" style={{ padding: '0 10px 10px' }}>Worst</th>
              <th scope="col" style={{ padding: '0 0 10px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.setups.map((s) => (
              <tr key={s.label} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '9px 10px 9px 0', color: 'var(--text-faint)', fontWeight: 700 }}>{s.decided === 0 ? '—' : s.rank}</td>
                <th scope="row" style={{ padding: '9px 10px', fontWeight: 600, textAlign: 'left' }}>
                  {s.label}
                </th>
                <td style={{ padding: '9px 10px' }}>{s.trades}</td>
                <td style={{ padding: '9px 10px', color: 'var(--text-muted)' }}>{s.wins}</td>
                <td style={{ padding: '9px 10px', color: 'var(--text-muted)' }}>{s.losses}</td>
                <td style={{ padding: '9px 10px' }}>{s.decided ? `${s.winRate.toFixed(1)}%` : '—'}</td>
                <td style={{ padding: '9px 10px' }}>{s.avgRR ? s.avgRR.toFixed(2) : '—'}</td>
                <td className="mono" style={{ padding: '9px 10px', fontWeight: 600 }}>
                  <span className={pnlClass(s.netPnl)}>{formatMoney(s.netPnl)}</span>
                </td>
                <td className="mono" style={{ padding: '9px 10px' }}>
                  <span className={pnlClass(s.avgPnl)}>{formatMoney(s.avgPnl)}</span>
                </td>
                <td className="mono" style={{ padding: '9px 10px', color: 'var(--text-muted)' }}>
                  {formatMoney(s.avgWin)}
                </td>
                <td className="mono" style={{ padding: '9px 10px', color: 'var(--text-muted)' }}>
                  {formatMoney(s.avgLoss)}
                </td>
                <td style={{ padding: '9px 10px' }}>{formatPF(s.profitFactor)}</td>
                <td className="mono pnl-pos" style={{ padding: '9px 10px' }}>{formatMoney(s.bestTrade)}</td>
                <td className="mono pnl-neg" style={{ padding: '9px 10px' }}>{formatMoney(s.worstTrade)}</td>
                <td style={{ padding: '9px 0' }}>
                  <StatusChip status={s.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <TrendingUp size={16} color="#7c3aed" /> Setup Performance Dashboard
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.03em' }}>· {scopeLabel}</span>
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 600, marginBottom: 0 }}>
            How each setup actually performs — derived live from the same filtered dataset as Analytics, using the canonical P&L, RR and result values.
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <FilterSelect label="Pair" options={pairOptions} value={safePair} onChange={setPair} />
        <FilterSelect label="Session" options={sessionOptions} value={safeSession} onChange={setSession} />
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

      {!noSetups && data.hasData && (
        <>
          {limitedOnly && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, color: '#f59e0b' }} />
              <span>
                Every setup here still has fewer than {data.minNormal} decided trades — numbers are indicative only, never a proven edge.
              </span>
            </div>
          )}

          <div style={{ width: '100%', marginBottom: 20 }}>{renderChart()}</div>

          {renderTable()}

          <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '12px 0 0' }}>
            Ranked by {rankLabel(rank)}. A setup is &quot;Normal&quot; at {data.minNormal}+ decided trades, &quot;Limited data&quot; at 1–{data.maxLimited}, and
            &quot;No data&quot; with none. Trades without a setup/model are grouped under &apos;{UNASSIGNED_LABEL}&apos; — never silently dropped.
          </p>
        </>
      )}
    </motion.div>
  );
}