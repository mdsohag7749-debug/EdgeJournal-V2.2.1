import { motion } from 'framer-motion';
import { Calendar as CalendarIcon } from 'lucide-react';
import { formatMoney } from '../../lib/utils';

export default function CalendarHeatmapWidget({ dayMap, onSelectDay }) {
  // Generate last 35 days calendar grid
  const daysGrid = [];
  const today = new Date();
  for (let i = 34; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().split('T')[0];
    const dayData = dayMap[iso] || { pnl: 0, count: 0, trades: [] };
    daysGrid.push({
      date: iso,
      dayNum: d.getDate(),
      month: d.toLocaleString('default', { month: 'short' }),
      ...dayData,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="card card-lift"
      style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarIcon size={18} color="#ec4899" /> Trading Calendar Heatmap
        </h3>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click any day to view logged trades</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))',
          gap: 10,
        }}
      >
        {daysGrid.map((d) => {
          const hasTrades = d.count > 0;
          const isWin = d.pnl > 0;
          const isLoss = d.pnl < 0;

          let bg = 'rgba(255,255,255,0.03)';
          let border = '1px solid var(--border)';
          let color = 'var(--text-muted)';

          if (hasTrades) {
            if (isWin) {
              bg = 'rgba(47, 214, 110, 0.15)';
              border = '1px solid rgba(47, 214, 110, 0.4)';
              color = 'var(--win)';
            } else if (isLoss) {
              bg = 'rgba(255, 77, 94, 0.15)';
              border = '1px solid rgba(255, 77, 94, 0.4)';
              color = 'var(--loss)';
            } else {
              bg = 'rgba(255, 255, 255, 0.08)';
              color = 'var(--text)';
            }
          }

          return (
            <button
              key={d.date}
              type="button"
              onClick={() => hasTrades && onSelectDay(d.date, d.trades)}
              style={{
                background: bg,
                border: border,
                borderRadius: 8,
                padding: '10px 8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                cursor: hasTrades ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
              }}
              className={hasTrades ? 'card-lift' : ''}
            >
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{d.month} {d.dayNum}</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, color }}>
                {hasTrades ? (isWin ? `+$${Math.round(d.pnl)}` : `-$${Math.round(Math.abs(d.pnl))}`) : '—'}
              </span>
              {hasTrades && (
                <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                  {d.count} {d.count === 1 ? 'trade' : 'trades'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
