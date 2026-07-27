import { useEffect, useState } from 'react';
import SidePanel from '../../components/SidePanel';
import { todayISO } from '../../lib/utils';

const PERIODS = ['Daily', 'Weekly', 'Monthly', 'Quarterly'];

const BLANK = {
  period: 'Daily',
  date: todayISO(),
  rating: 5,
  title: '',
  reflection: '',
  wentWell: '',
  lessons: '',
  improvements: '',
};

export default function ReflectionFormPanel({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(BLANK);

  useEffect(() => {
    if (open) setForm(initial ? { ...BLANK, ...initial } : BLANK);
  }, [open, initial]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Reflection' : 'New Reflection'}
      subtitle="Review your performance and capture what you learned"
      width="narrow"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-accent" onClick={() => onSave(form)}>
            {initial ? 'Save Changes' : 'Save Reflection'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field-row cols-2">
          <div className="field">
            <label>Period</label>
            <select value={form.period} onChange={(e) => set('period', e.target.value)}>
              {PERIODS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Rating: {form.rating}/10</label>
          <input type="range" min="1" max="10" value={form.rating} onChange={(e) => set('rating', Number(e.target.value))} style={{ accentColor: 'var(--red)' }} />
        </div>

        <div className="field">
          <label>Title</label>
          <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Give this reflection a title" />
        </div>

        <div className="field">
          <label>Reflection</label>
          <textarea value={form.reflection} onChange={(e) => set('reflection', e.target.value)} style={{ minHeight: 110 }} />
        </div>

        <div className="field">
          <label>What Went Well</label>
          <textarea value={form.wentWell} onChange={(e) => set('wentWell', e.target.value)} />
        </div>

        <div className="field">
          <label>Lessons Learned</label>
          <textarea value={form.lessons} onChange={(e) => set('lessons', e.target.value)} />
        </div>

        <div className="field">
          <label>Areas for Improvement</label>
          <textarea value={form.improvements} onChange={(e) => set('improvements', e.target.value)} />
        </div>
      </div>
    </SidePanel>
  );
}
