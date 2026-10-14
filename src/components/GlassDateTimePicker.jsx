import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Clock3, ChevronLeft, ChevronRight } from 'lucide-react';

const AQUA = '#42d9ff';
const glassPanel = {
  position: 'fixed',
  zIndex: 1200,
  width: 280,
  padding: 14,
  borderRadius: 16,
  border: '1px solid rgba(130, 238, 248, 0.42)',
  background: 'linear-gradient(145deg, rgba(46, 168, 184, 0.58), rgba(8, 57, 76, 0.82))',
  boxShadow: '0 18px 48px rgba(0, 8, 18, 0.42), inset 0 1px 0 rgba(224, 255, 255, 0.2)',
  backdropFilter: 'blur(24px) saturate(175%)',
  WebkitBackdropFilter: 'blur(24px) saturate(175%)',
  color: '#ecfeff',
};

const smallButton = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid rgba(149, 237, 245, 0.2)',
  borderRadius: 8,
  background: 'rgba(84, 202, 217, 0.13)',
  color: '#e9feff',
  cursor: 'pointer',
};

function parseDate(value) {
  const [year, month, day] = (value || '').split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : new Date();
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateLabel(value) {
  if (!value) return '';
  const date = parseDate(value);
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
}

function parseTime(value) {
  if (!value) return { hour: 9, minute: 0 };
  const [hour, minute] = value.split(':').map(Number);
  return { hour: Number.isFinite(hour) ? hour : 9, minute: Number.isFinite(minute) ? minute : 0 };
}

function timeLabel(value) {
  if (!value) return '';
  const { hour, minute } = parseTime(value);
  const period = hour >= 12 ? 'PM' : 'AM';
  return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
}

export default function GlassDateTimePicker({ id, label, type, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseDate(value));
  const [timeDraft, setTimeDraft] = useState(() => parseTime(value));
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 });
  const isDate = type === 'date';
  const Icon = isDate ? CalendarDays : Clock3;

  useEffect(() => {
    if (!open) return undefined;
    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = isDate ? 280 : 250;
      const height = isDate ? 380 : 320;
      const below = rect.bottom + 8;
      setPanelPosition({
        top: below + height < window.innerHeight ? below : Math.max(12, rect.top - height - 8),
        left: Math.min(Math.max(12, rect.left), window.innerWidth - width - 12),
      });
    };
    updatePosition();
    const handlePointer = (event) => {
      if (!rootRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isDate, open]);

  const calendarDays = useMemo(() => {
    if (!isDate) return [];
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1 - firstDay.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      return { date: day, currentMonth: day.getMonth() === viewDate.getMonth() };
    });
  }, [isDate, viewDate]);

  function togglePicker() {
    if (!open && !isDate) setTimeDraft(parseTime(value));
    if (!open && isDate) setViewDate(parseDate(value));
    setOpen((current) => !current);
  }

  function commitTime(next) {
    setTimeDraft(next);
    onChange(`${String(next.hour).padStart(2, '0')}:${String(next.minute).padStart(2, '0')}`);
  }

  const displayValue = isDate ? dateLabel(value) : timeLabel(value);

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%' }}>
      <input
        id={id}
        type="text"
        value={displayValue}
        readOnly
        onClick={togglePicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            togglePicker();
          }
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}${displayValue ? `: ${displayValue}` : ''}`}
        placeholder={isDate ? 'Select date' : 'Select time'}
        style={{ paddingRight: 38, cursor: 'pointer' }}
      />
      <button
        type="button"
        onClick={togglePicker}
        aria-label={`Choose ${label.toLowerCase()}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{ ...smallButton, position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 26, height: 26, border: 'none', background: 'transparent', color: 'rgba(210, 250, 255, 0.78)' }}
      >
        <Icon size={15} />
      </button>

      {open && createPortal(isDate ? (
        <div ref={panelRef} role="dialog" aria-label="Choose date" style={{ ...glassPanel, top: panelPosition.top, left: panelPosition.left }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button type="button" aria-label="Previous month" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} style={{ ...smallButton, width: 30, height: 30 }}><ChevronLeft size={17} /></button>
            <strong style={{ fontSize: 13, color: '#efffff' }}>{viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
            <button type="button" aria-label="Next month" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} style={{ ...smallButton, width: 30, height: 30 }}><ChevronRight size={17} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 5 }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <span key={day} style={{ textAlign: 'center', fontSize: 10, color: 'rgba(222, 251, 255, 0.7)', padding: '4px 0' }}>{day}</span>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {calendarDays.map(({ date, currentMonth }) => {
              const dayValue = formatDate(date);
              const selected = value === dayValue;
              return (
                <button
                  key={dayValue}
                  type="button"
                  onClick={() => { onChange(dayValue); setOpen(false); }}
                  aria-pressed={selected}
                  style={{ ...smallButton, width: '100%', height: 30, borderColor: selected ? 'rgba(132, 247, 255, 0.78)' : 'transparent', background: selected ? 'linear-gradient(135deg, rgba(66,217,255,0.72), rgba(54,224,192,0.52))' : 'rgba(121, 225, 235, 0.06)', color: selected ? '#06212d' : currentMonth ? '#e9feff' : 'rgba(220, 248, 255, 0.4)', fontSize: 11.5, fontWeight: selected ? 800 : 600 }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(163, 240, 246, 0.18)' }}>
            <button type="button" onClick={() => { onChange(''); setOpen(false); }} style={{ ...smallButton, padding: '6px 10px', fontSize: 11 }}>Clear</button>
            <button type="button" onClick={() => { const today = new Date(); onChange(formatDate(today)); setViewDate(today); setOpen(false); }} style={{ ...smallButton, padding: '6px 10px', color: AQUA, fontSize: 11 }}>Today</button>
          </div>
        </div>
      ) : (
        <div ref={panelRef} role="dialog" aria-label="Choose time" style={{ ...glassPanel, width: 250, top: panelPosition.top, left: panelPosition.left }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Clock3 size={15} color={AQUA} />
            <strong style={{ fontSize: 13 }}>Choose {label.toLowerCase()}</strong>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(222, 251, 255, 0.72)' }}>{timeLabel(`${String(timeDraft.hour).padStart(2, '0')}:${String(timeDraft.minute).padStart(2, '0')}`)}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[{ title: 'HOUR', values: Array.from({ length: 24 }, (_, i) => i), selected: timeDraft.hour, key: 'hour' }, { title: 'MIN', values: Array.from({ length: 60 }, (_, i) => i), selected: timeDraft.minute, key: 'minute' }].map((column) => (
              <div key={column.key}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(222, 251, 255, 0.64)', marginBottom: 5 }}>{column.title}</div>
                <div style={{ height: 148, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, padding: 3, borderRadius: 10, background: 'rgba(4, 47, 64, 0.25)' }}>
                  {column.values.map((number) => {
                    const active = column.selected === number;
                    return <button key={number} type="button" aria-pressed={active} onClick={() => commitTime({ ...timeDraft, [column.key]: number })} style={{ ...smallButton, minHeight: 28, background: active ? 'rgba(66,217,255,0.7)' : 'rgba(121,225,235,0.07)', color: active ? '#05212c' : '#e9feff', borderColor: active ? 'rgba(198,255,255,0.55)' : 'transparent', fontSize: 11, fontWeight: active ? 800 : 600 }}>{String(number).padStart(2, '0')}</button>;
                  })}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setOpen(false)} style={{ ...smallButton, width: '100%', marginTop: 12, padding: '7px 10px', color: AQUA, fontSize: 11, fontWeight: 700 }}>Done</button>
        </div>
      ), document.body)}
    </div>
  );
}
