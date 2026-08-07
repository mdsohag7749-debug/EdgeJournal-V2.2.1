import SidePanel from '../SidePanel';
import { formatDate, formatMoney, pnlClass, resultTagClass, directionTagClass } from '../../lib/utils';
import { BookOpen } from 'lucide-react';

export default function DayTradesModal({ open, date, trades, onClose, onSelectTrade }) {
  if (!open || !date) return null;

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={`Trades logged on ${formatDate(date)}`}
      subtitle={`${trades.length} ${trades.length === 1 ? 'trade' : 'trades'} executed on this date`}
      width="normal"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {trades.length === 0 ? (
          <div className="empty-state">
            <BookOpen size={24} style={{ color: 'var(--text-faint)' }} />
            <p>No trades found for this day.</p>
          </div>
        ) : (
          trades.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onClose();
                onSelectTrade(t);
              }}
              className="card card-lift"
              style={{
                padding: 14,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                font: 'inherit',
                textAlign: 'left',
                color: 'inherit',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{t.instrument}</span>
                <span className={`tag ${resultTagClass(t.result)}`}>{t.result}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, width: '100%' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {t.direction && <span className={`tag ${directionTagClass(t.direction)}`}>{t.direction}</span>}
                  <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.model || 'No model'}</span>
                </span>
                <span className={`mono ${pnlClass(t.netPnl)}`} style={{ fontWeight: 700 }}>
                  {formatMoney(t.netPnl)}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </SidePanel>
  );
}
