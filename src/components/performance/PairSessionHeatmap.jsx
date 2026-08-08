import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import EmptyState from '../EmptyState';
import { useData } from '../../context/DataContext';
import { useAccounts } from '../../context/AccountContext';
import { formatMoney, formatMoneyShort, pnlClass } from '../../lib/utils';
import { computePairSessionHeatmap, cellColor, HEAT_METRICS, UNASSIGNED_LABEL } from '../../lib/heatmap';
import { Grid3x3 as GridIcon, AlertTriangle } from 'lucide-react';

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

function fmtValue(cell, metric) {
  if (!cell || cell.decided === 0) return '—';
  const v = cell[metric];
  if (metric === 'netPnl') return formatMoneyShort(v);
  if (metric === 'winRate') return `${Math.round(v)}%`;
  if (metric === 'avgRR') return `${v ? v.toFixed(1) : '—'}R`;
  return '—';
}

// Formats every canonical metric for the detail panel.
function cellDetail(cell) {
  if (!cell) return null;
  return [
    { label: 'Total Trades', value: String(cell.trades) },
    { label: 'Winning Positioning', value: String(cell.wins) },
    { label: 'Losing Positioning', value: String(cell.losses) },
    { label: 'Win Rate', value: cell.decided ? `${cell.winRate.toFixed(1)}%` : '—' },
    { label: 'Net P&L', value: formatMoney(cell.netPnl), pnl: true },
    { label: 'Average RR', value: cell.avgRR ? cell.avgRR.toFixed(2) : '—' },
    { label: 'Profit Factor', value: cell.profitFactor === Infinity ? '∞' : cell.profitFactor ? cell.profitFactor.toFixed(2) : '—' },
  ];
}

export default function PairSessionHeatmap() {
  const { trades } = useData();
  const { allAccounts, selectedAccount } = useAccounts();

  const [period, setPeriod] = useState('all');
  const [metric, setMetric] = useState('netPnl');
  const [pair, setPair] = useState('All');
  const [session, setSession] = useState('All');
  const [focused, setFocused] = useState(null);

  const data = useMemo(
    () => computePairSessionHeatmap(trades.items, { period, pair, session, metric }),
    [trades.items, period, pair, session, metric]
  );

  // Guard the selects so a filter value that drops out of the options (e.g.
  // account switch) falls back to "All" instead of rendering a stale value.
  const safePair = data.pairOptions.includes(pair) || pair === 'All' ? pair : 'All';
  const safeSession = data.sessionOptions.includes(session) || session === 'All' ? session : 'All';

  const pairOptions = [{ value: 'All', label: 'All Pairs' }, ...data.pairOptions.map((p) => ({ value: p, label: p }))];
  const sessionOptions = [{ value: 'All', label: 'All Sessions' }, ...data.sessionOptions.map((s) => ({ value: s, label: s }))];

  const scopeLabel = allAccounts ? 'All Accounts' : selectedAccount?.name || 'Selected Account';

  const metricLabel = HEAT_METRICS.find((m) => m.value === metric)?.label || 'Net P&L';
  const legendNote =
    metric === 'winRate'
      ? 'Fill intensity scales to 100% win rate.'
      : metric === 'avgRR'
        ? 'Fill intensity scales to the highest average RR in view.'
        : 'Fill intensity scales to the largest |Net P&L| in view.';

  const limitedOnly = data.rows.length > 0 && data.rows.every((row) => row.cells.every((c) => c.status === 'No data' || c.status === 'Limited data'));

  const focusedDetail = useMemo(() => {
    if (!focused) return null;
    for (const row of data.rows) {
      const c = row.cells.find((cell) => cell.key === focused);
      if (c) return c;
    }
    return null;
  }, [focused, data.rows]);

  const renderEmpty = () => {
    if (trades.items.length === 0) {
      return (
        <div style={{ marginTop: 14 }}>
          <EmptyState
            icon={GridIcon}
            title="No pair / session heatmap yet"
            message="The heatmap appears once trades are logged with a Trading Pair. Cell colours are always derived from real stored results."
          />
        </div>
      );
    }
    if (!data.hasData) {
      return (
        <div style={{ marginTop: 14 }}>
          <EmptyState
            icon={GridIcon}
            title="Nothing in this matrix"
            message={`No trades match the current ${period !== 'all' ? 'period, ' : ''}pair and session filters. Adjust the filters or switch account.`}
          />
        </div>
      );
    }
    return null;
  };

  const renderLegend = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--text-faint)' }}>
      <span style={{ fontWeight: 600 }}>Colour:</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 14, height: 14, borderRadius: 4, background: 'rgba(22,163,74,0.85)' }} />
        {metric === 'netPnl' ? 'positive' : 'higher'}
      </span>
      {metric === 'netPnl' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: 'rgba(220,38,38,0.85)' }} />
          negative
        </span>
      )}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 14, height: 14, borderRadius: 4, background: 'rgba(148,163,184,0.35)' }} />
        no data / limited
      </span>
      <span style={{ marginLeft: 'auto' }}>{legendNote.replace('Fill intensity', 'Intensity')}</span>
    </div>
  );

  const renderMatrix = () => {
    const cellStyle = (c) => {
      const bg = cellColor(c, metric, data.scale);
      const faded = c.status === 'No data';
      return {
        background: faded ? 'rgba(148,163,184,0.12)' : bg,
        borderRadius: 7,
        padding: '8px 6px',
        minWidth: 96,
        textAlign: 'center',
        cursor: focused === c.key ? 'default' : 'pointer',
        outline: focused === c.key ? '2px solid rgba(124,58,237,0.6)' : '1px solid transparent',
        outlineOffset: -1,
        transition: 'outline .12s ease',
      };
    };

    return (
      <div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 4, width: '100%', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.03em', padding: '0 8px 8px 2px', minWidth: 120 }}>
                  Pair / Session
                </th>
                {data.sessions.map((s) => (
                  <th key={s.key} scope="col" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.03em', padding: '0 0 8px' }}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.pair}>
                  <th
                    scope="row"
                    style={{ textAlign: 'left', fontWeight: 600, padding: '0 8px 0 2px', whiteSpace: 'nowrap', color: row.pair === UNASSIGNED_LABEL ? 'var(--text-faint)' : 'var(--text)' }}
                  >
                    {row.pair}
                    <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: 'var(--text-faint)', marginTop: 1 }}>{row.totalTrades} trades</span>
                  </th>
                  {row.cells.map((c) => (
                    <td
                      key={c.key}
                      title={focused === c.key ? undefined : `${c.pair} · ${c.session}`}
                      onClick={() => setFocused(focused === c.key ? null : c.key)}
                      onMouseEnter={() => setFocused(c.key)}
                      style={cellStyle(c)}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{fmtValue(c, metric)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
                        {c.decided === 0 ? 'No data' : `${c.decided} decided`}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
          <div className="card" style={{ padding: '10px 14px', flex: '1 1 260px', minWidth: 240 }}>
            {focusedDetail ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>
                    {focusedDetail.pair} · {focusedDetail.session}
                  </span>
                  <StatusChip status={focusedDetail.status} />
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <tbody>
                    {cellDetail(focusedDetail)
                      .filter(Boolean)
                      .map((d) => (
                        <tr key={d.label} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '4px 6px 4px 0', color: 'var(--text-muted)' }}>{d.label}</td>
                          <td className={d.pnl ? pnlClass(focusedDetail.netPnl) : undefined} style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {d.value}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
                Hover or tap a cell to see its full breakdown — trades, wins, losses, win rate, net P&L, average RR and profit factor.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="card card-lift" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <GridIcon size={16} color="#0d9488" /> Pair & Session Heatmap
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.03em' }}>· {scopeLabel}</span>
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4, maxWidth: 640, marginBottom: 0 }}>
            The interaction between pair and session, cell by cell — every number derived from the same canonical P&L, RR and result values as Analytics.
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
          {HEAT_METRICS.map((m) => (
            <button key={m.value} type="button" onClick={() => setMetric(m.value)} style={{ ...chipBase, ...(metric === m.value ? chipActive : {}) }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {renderEmpty()}

      {data.hasData && (
        <>
          {limitedOnly && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, color: '#f59e0b' }} />
              <span>
                No cell has reached {data.minNormal}+ decided trades yet — colours are indicative only, never a proven edge.
              </span>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>{renderLegend()}</div>

          {renderMatrix()}

          <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '12px 0 0' }}>
            Rows and columns are derived from the trades you have actually logged — empty intersections show &quot;No data&quot;, never a fabricated 0%. A cell is classified &quot;Normal&quot; at {data.minNormal}+ decided trades, &quot;Limited data&quot; at 1–{data.maxLimited}, and
            &quot;No data&quot; with none. Metric: {metricLabel}.
          </p>
        </>
      )}
    </motion.div>
  );
}