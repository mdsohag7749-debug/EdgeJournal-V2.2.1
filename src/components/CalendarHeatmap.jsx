import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMoneyShort } from '../lib/utils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarHeatmap({ dayMap }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < firstDay; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      arr.push({ day: d, iso, data: dayMap[iso] });
    }
    return arr;
  }, [cursor, dayMap]);

  const monthTotal = useMemo(() => {
    return cells.reduce((s, c) => s + (c?.data?.pnl || 0), 0);
  }, [cells]);

  function cellStyle(data) {
    if (!data) {
      return { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-faint)' };
    }
    if (data.pnl > 0) {
      return {
        background: 'rgba(47, 214, 110, 0.14)',
        border: '1px solid rgba(47, 214, 110, 0.35)',
        color: 'var(--win)',
      };
    }
    if (data.pnl < 0) {
      return {
        background: 'rgba(255, 77, 94, 0.14)',
        border: '1px solid rgba(255, 77, 94, 0.35)',
        color: 'var(--loss)',
      };
    }
    return { background: 'rgba(154,154,163,0.1)', border: '1px solid rgba(154,154,163,0.25)', color: 'var(--be)' };
  }

  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 className="section-title">Monthly Performance</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {monthLabel} ·{' '}
            <span className={monthTotal > 0 ? 'pnl-pos' : monthTotal < 0 ? 'pnl-neg' : 'pnl-flat'}>
              {formatMoneyShort(monthTotal)}
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft size={15} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const d = new Date();
              setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
          >
            Today
          </button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8 }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {w}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {cells.map((c, i) => {
          if (!c) return <div key={`empty-${i}`} />;
          const style = cellStyle(c.data);
          return (
            <div
              key={c.iso}
              title={c.data ? `${c.iso} · ${formatMoneyShort(c.data.pnl)} · ${c.data.count} trade${c.data.count > 1 ? 's' : ''}` : c.iso}
              style={{
                ...style,
                borderRadius: 10,
                aspectRatio: '1 / 0.85',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '8px 9px',
                transition: 'transform 0.12s ease',
                cursor: c.data ? 'default' : 'default',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: c.data ? style.color : 'var(--text-faint)' }}>{c.day}</span>
              {c.data && (
                <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>
                  {formatMoneyShort(c.data.pnl)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 18, marginTop: 18, fontSize: 12, color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(47,214,110,0.5)' }} /> Win day
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(255,77,94,0.5)' }} /> Loss day
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--card)', border: '1px solid var(--border)' }} /> No trades
        </span>
      </div>
    </div>
  );
}
