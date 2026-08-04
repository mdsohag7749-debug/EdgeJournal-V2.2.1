import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMoney, formatMoneyShort, pnlClass } from '../../lib/utils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarHeatmapWidget({ dayMap, onSelectDay }) {
  // Month navigation cursor (defaults to current month)
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [tooltip, setTooltip] = useState(null); // { x, y, date, data }

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  // Generate 7-column calendar grid for the selected month
  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const arr = [];
    // Empty padding slots before 1st of month
    for (let i = 0; i < firstDayIndex; i++) {
      arr.push(null);
    }
    // Month days
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayData = dayMap[iso] || { pnl: 0, count: 0, trades: [] };
      arr.push({
        day: d,
        iso,
        data: dayData,
      });
    }
    return arr;
  }, [cursor, dayMap]);

  // Monthly sum calculation
  const monthlyTotal = useMemo(() => {
    return cells.reduce((sum, cell) => sum + (cell?.data?.pnl || 0), 0);
  }, [cells]);

  const monthlyTradesCount = useMemo(() => {
    return cells.reduce((sum, cell) => sum + (cell?.data?.count || 0), 0);
  }, [cells]);

  // GitHub-style Heatmap Shading
  function getHeatmapStyle(data) {
    if (!data || data.count === 0) {
      return {
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border)',
        color: 'var(--text-faint)',
      };
    }

    const pnl = data.pnl;
    if (pnl > 0) {
      let intensity = '0.15';
      let borderIntensity = '0.3';
      if (pnl > 500) {
        intensity = '0.45';
        borderIntensity = '0.7';
      } else if (pnl > 200) {
        intensity = '0.3';
        borderIntensity = '0.5';
      }
      return {
        background: `rgba(47, 214, 110, ${intensity})`,
        border: `1px solid rgba(47, 214, 110, ${borderIntensity})`,
        color: 'var(--win)',
      };
    }

    if (pnl < 0) {
      let intensity = '0.15';
      let borderIntensity = '0.3';
      if (Math.abs(pnl) > 500) {
        intensity = '0.45';
        borderIntensity = '0.7';
      } else if (Math.abs(pnl) > 200) {
        intensity = '0.3';
        borderIntensity = '0.5';
      }
      return {
        background: `rgba(255, 77, 94, ${intensity})`,
        border: `1px solid rgba(255, 77, 94, ${borderIntensity})`,
        color: 'var(--loss)',
      };
    }

    // Breakeven trade day
    return {
      background: 'rgba(255, 255, 255, 0.08)',
      border: '1px solid var(--border-strong)',
      color: 'var(--text)',
    };
  }

  // Calculate day stats for hover tooltip
  function calculateDayTooltipStats(trades) {
    if (!trades || trades.length === 0) return { winRate: 0, avgRR: 0 };
    const wins = trades.filter((t) => t.result === 'Win').length;
    const losses = trades.filter((t) => t.result === 'Loss').length;
    const decided = wins + losses;
    const winRate = decided ? Math.round((wins / decided) * 100) : 0;

    const rrValues = trades.map((t) => Number(t.rr) || 0).filter((v) => v > 0);
    const avgRR = rrValues.length ? (rrValues.reduce((s, r) => s + r, 0) / rrValues.length).toFixed(1) : 0;

    return { winRate, avgRR };
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="card card-lift"
      style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}
    >
      {/* Calendar Header with Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarIcon size={18} color="#ec4899" /> Trading Calendar Heatmap
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
            {monthLabel} · Monthly Net P&L:{' '}
            <span className={`mono ${pnlClass(monthlyTotal)}`} style={{ fontWeight: 700 }}>
              {formatMoney(monthlyTotal)}
            </span>{' '}
            ({monthlyTradesCount} trades)
          </p>
        </div>

        {/* Month Navigation Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            aria-label="Previous Month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const now = new Date();
              setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
            style={{ fontSize: 12 }}
          >
            Today
          </button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            aria-label="Next Month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 7-Column Weekday Headers (Sun - Sat) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            style={{
              textAlign: 'center',
              fontSize: 11.5,
              fontWeight: 700,
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              paddingBottom: 4,
            }}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 7-Column Monthly Calendar Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {cells.map((cell, idx) => {
          if (!cell) {
            return (
              <div
                key={`empty-${idx}`}
                style={{
                  aspectRatio: '1 / 1',
                  background: 'rgba(255, 255, 255, 0.01)',
                  borderRadius: 8,
                  border: '1px solid rgba(255, 255, 255, 0.03)',
                }}
              />
            );
          }

          const hasTrades = cell.data && cell.data.count > 0;
          const style = getHeatmapStyle(cell.data);

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => hasTrades && onSelectDay(cell.iso, cell.data.trades)}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip({
                  x: rect.left + rect.width / 2,
                  y: rect.top - 8,
                  date: cell.iso,
                  data: cell.data,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
              style={{
                ...style,
                aspectRatio: '1 / 1',
                borderRadius: 8,
                padding: '8px 6px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: hasTrades ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
                position: 'relative',
                width: '100%',
              }}
              className={hasTrades ? 'card-lift' : ''}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 11, fontWeight: 700 }}>
                <span style={{ color: hasTrades ? style.color : 'var(--text-faint)' }}>{cell.day}</span>
                {hasTrades && (
                  <span style={{ fontSize: 9.5, opacity: 0.8 }} className="tag tag-neutral">
                    {cell.data.count}t
                  </span>
                )}
              </div>

              {hasTrades ? (
                <div style={{ textAlign: 'center', width: '100%' }}>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
                    {formatMoneyShort(cell.data.pnl)}
                  </span>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center' }}>—</div>
              )}
            </button>
          );
        })}
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
            minWidth: 160,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>{tooltip.date}</div>
          {tooltip.data && tooltip.data.count > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Net P&L:</span>
                <span className={`mono ${pnlClass(tooltip.data.pnl)}`} style={{ fontWeight: 700 }}>
                  {formatMoney(tooltip.data.pnl)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Trades:</span>
                <span style={{ fontWeight: 600 }}>{tooltip.data.count}</span>
              </div>
              {(() => {
                const stats = calculateDayTooltipStats(tooltip.data.trades);
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Win Rate:</span>
                      <span style={{ fontWeight: 600 }}>{stats.winRate}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Avg R:R:</span>
                      <span style={{ fontWeight: 600 }}>{stats.avgRR}R</span>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div style={{ color: 'var(--text-faint)' }}>No trades executed</div>
          )}
        </div>
      )}

      {/* Heatmap Color Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-muted)', paddingTop: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(47, 214, 110, 0.45)', border: '1px solid rgba(47, 214, 110, 0.7)' }} /> High Profit
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(47, 214, 110, 0.15)', border: '1px solid rgba(47, 214, 110, 0.3)' }} /> Profit
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(255, 77, 94, 0.15)', border: '1px solid rgba(255, 77, 94, 0.3)' }} /> Loss
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(255, 77, 94, 0.45)', border: '1px solid rgba(255, 77, 94, 0.7)' }} /> High Loss
        </span>
      </div>
    </motion.div>
  );
}
