import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMoneyShort, pnlClass } from '../../lib/utils';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Cell colors
const NEUTRAL = {
  background: 'var(--card-hover)',
  border: '1px solid var(--border)',
  color: 'var(--text-faint)',
};
const PROFIT = {
  background: 'rgba(47, 214, 110, 0.12)',
  border: '1px solid rgba(47, 214, 110, 0.38)',
  color: 'var(--win)',
};
const LOSS = {
  background: 'rgba(255, 77, 94, 0.12)',
  border: '1px solid rgba(255, 77, 94, 0.38)',
  color: 'var(--loss)',
};

function cellStyle(data) {
  if (!data || data.count === 0) return NEUTRAL;
  if (data.pnl > 0) return PROFIT;
  if (data.pnl < 0) return LOSS;
  return { ...NEUTRAL, color: 'var(--text)' };
}

export default function CalendarHeatmapWidget({ dayMap, onSelectDay }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [tooltip, setTooltip] = useState(null);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const monthValue = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;

  // Build the flat month grid (leading nulls = adjacent-month padding).
  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const arr = [];
    for (let i = 0; i < firstDayIndex; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      arr.push({ day: d, iso, data: dayMap[iso] || { pnl: 0, count: 0, trades: [] } });
    }
    return arr;
  }, [cursor, dayMap]);

  // Chunk into weeks (rows). Each row gets its own computed Week Total.
  const weeks = useMemo(() => {
    const out = [];
    for (let i = 0; i < cells.length; i += 7) {
      const week = cells.slice(i, i + 7);
      const pnl = week.reduce((s, c) => s + (c?.data?.pnl || 0), 0);
      const count = week.reduce((s, c) => s + (c?.data?.count || 0), 0);
      out.push({ cells: week, weekNumber: out.length + 1, pnl, count });
    }
    return out;
  }, [cells]);

  const monthlyTradesCount = useMemo(() => cells.reduce((s, c) => s + (c?.data?.count || 0), 0), [cells]);

  const tooltipStats = (trades) => {
    if (!trades || trades.length === 0) return { winRate: 0 };
    const wins = trades.filter((t) => t.result === 'Win').length;
    const losses = trades.filter((t) => t.result === 'Loss').length;
    const decided = wins + losses;
    return { winRate: decided ? Math.round((wins / decided) * 100) : 0 };
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="card card-lift calendar-widget"
      style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}
    >
      {/* Header: title + month selector + nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <CalendarIcon size={16} color="#ec4899" />
          <h3 style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>Trading Calendar</h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            aria-label="Previous Month"
            style={{ padding: '4px 6px' }}
          >
            <ChevronLeft size={15} />
          </button>
          <input
            type="month"
            value={monthValue}
            onChange={(e) => {
              const [y, m] = (e.target.value || '').split('-').map(Number);
              if (y && m) setCursor(new Date(y, m - 1, 1));
            }}
            style={{ colorScheme: 'dark', color: 'var(--text)', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', fontSize: 11, fontWeight: 700, width: 108 }}
          />
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            aria-label="Next Month"
            style={{ padding: '4px 6px' }}
          >
            <ChevronRight size={15} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const now = new Date();
              setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
            style={{ fontSize: 10.5, padding: '4px 8px' }}
          >
            Today
          </button>
        </div>
      </div>

      {/* Weekday header + Week Total column header */}
      <div className="cal-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowX: 'auto' }}>
        <div className="cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr)) 1.15fr', gap: 4 }}>
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1, paddingBottom: 2 }}
            >
              {w}
            </div>
          ))}
          <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1, paddingBottom: 2, whiteSpace: 'nowrap' }}>
            Week Total
          </div>
        </div>

        {/* Compact weeks grid with per-week total column */}
        {weeks.map((week) => {
          const weekStyle = cellStyle({ count: week.count, pnl: week.pnl });
          return (
            <div key={week.weekNumber} className="cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr)) 1.15fr', gap: 4, alignItems: 'stretch' }}>
            {week.cells.map((cell, idx) => {
              if (!cell) {
                return (
                  <div
                    key={`empty-${idx}`}
                    style={{ ...NEUTRAL, borderRadius: 10, aspectRatio: '1 / 1', opacity: 0.45 }}
                  />
                );
              }
              const hasTrades = cell.data.count > 0;
              const style = cellStyle(cell.data);
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => hasTrades && onSelectDay(cell.iso, cell.data.trades)}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, date: cell.iso, data: cell.data });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    ...style,
                    borderRadius: 10,
                    aspectRatio: '1 / 1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    padding: 2,
                    cursor: hasTrades ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                    backgroundImage: hasTrades ? 'none' : undefined,
                  }}
                  className={hasTrades ? 'card-lift' : ''}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1, color: hasTrades ? style.color : 'var(--text-faint)' }}>
                    {cell.day}
                  </span>
                  {hasTrades ? (
                    <>
                      <span className="mono" style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.1, color: style.color }}>
                        {formatMoneyShort(cell.data.pnl)}
                      </span>
                      <span style={{ fontSize: 9, lineHeight: 1, color: hasTrades ? style.color : 'var(--text-faint)', opacity: 0.85 }}>
                        {cell.data.count} {cell.data.count === 1 ? 'trade' : 'trades'}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: 10, lineHeight: 1, color: 'var(--text-faint)', opacity: 0.5 }}>—</span>
                  )}
                </button>
              );
            })}

            {/* Week Total cell */}
            <div
              style={{
                ...weekStyle,
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                background: weekStyle.background,
                border: weekStyle.border,
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-faint)' }}>
                Week {week.weekNumber}
              </span>
              <span className="mono" style={{ fontSize: 11, fontWeight: 800, lineHeight: 1.1, color: weekStyle.color }}>
                {formatMoneyShort(week.pnl)}
              </span>
              <span style={{ fontSize: 9, lineHeight: 1, color: 'var(--text-faint)', opacity: 0.85, whiteSpace: 'nowrap' }}>
                {week.count} {week.count === 1 ? 'trade' : 'trades'}
              </span>
            </div>
          </div>
        );
      })}
      </div>

      {/* Legend + total trades */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10.5, color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: 'rgba(47, 214, 110, 0.85)' }} /> Profit
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: 'rgba(255, 77, 94, 0.85)' }} /> Loss
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Total Trades: <span className="mono" style={{ fontWeight: 700, color: 'var(--text)' }}>{monthlyTradesCount}</span>
        </span>
      </div>

      {/* Floating Hover Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            background: 'var(--card-hover)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            padding: '8px 12px',
            pointerEvents: 'none',
            zIndex: 9999,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            fontSize: 12,
            minWidth: 150,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>{tooltip.date}</div>
          {tooltip.data && tooltip.data.count > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Net P&L:</span>
                <span className={`mono ${pnlClass(tooltip.data.pnl)}`} style={{ fontWeight: 700 }}>{formatMoneyShort(tooltip.data.pnl)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Trades:</span>
                <span style={{ fontWeight: 600 }}>{tooltip.data.count}</span>
              </div>
              {(() => {
                const st = tooltipStats(tooltip.data.trades);
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Win Rate:</span>
                    <span style={{ fontWeight: 600 }}>{st.winRate}%</span>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div style={{ color: 'var(--text-faint)' }}>No trades executed</div>
          )}
        </div>
        )}
    </motion.div>
  );
}