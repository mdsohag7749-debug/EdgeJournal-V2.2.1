import { useEffect, useState } from 'react';
import SidePanel from '../../components/SidePanel';
import ImageUpload from '../../components/ImageUpload';
import { todayISO } from '../../lib/utils';

const SESSION_TYPES = ['Daily', 'Weekly', 'Monthly', 'Asia', 'London', 'NYAM', 'NY Lunch', 'NYPM'];

const BLANK = {
  date: todayISO(),
  sessionType: 'Daily',
  title: '',
  description: '',
  chart: '',
};

export default function StudyFormPanel({ open, onClose, onSave, initial }) {
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
      title={initial ? 'Edit Study Entry' : 'New Study Entry'}
      subtitle="Document chart study and session observations"
      width="wide"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-accent" onClick={() => onSave(form)}>
            {initial ? 'Save Changes' : 'Save Entry'}
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field-row cols-2">
            <div className="field">
              <label>Date</label>
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
            </div>
            <div className="field">
              <label>Session / Type</label>
              <select value={form.sessionType} onChange={(e) => set('sessionType', e.target.value)}>
                {SESSION_TYPES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Title</label>
            <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. London liquidity sweep patterns" />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} style={{ minHeight: 320 }} />
          </div>
        </div>
        <div>
          <ImageUpload label="Chart Screenshot" value={form.chart} onChange={(v) => set('chart', v)} />
        </div>
      </div>
    </SidePanel>
  );
}
