import { useEffect, useState } from 'react';
import SidePanel from '../../components/SidePanel';
import ImageUpload from '../../components/ImageUpload';
import { todayISO } from '../../lib/utils';

const BLANK = {
  date: todayISO(),
  bias: 'Neutral',
  economicEvents: '',
  targets: '',
  gamePlan: '',
  notes: '',
  dailyChart: '',
  intradayChart: '',
};

export default function PlanFormPanel({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(BLANK);

  useEffect(() => {
    if (open) setForm(initial ? { ...BLANK, ...initial } : BLANK);
  }, [open, initial]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    onSave(form);
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Pre-Market Plan' : 'New Pre-Market Plan'}
      subtitle="Lay out your bias, targets and game plan before the session opens"
      width="narrow"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-accent" onClick={handleSave}>
            {initial ? 'Save Changes' : 'Save Plan'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field-row cols-2">
          <div className="field">
            <label>Date</label>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div className="field">
            <label>Bias</label>
            <select value={form.bias} onChange={(e) => set('bias', e.target.value)}>
              <option>Bullish</option>
              <option>Bearish</option>
              <option>Neutral</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label>Economic Calendar Events</label>
          <textarea value={form.economicEvents} onChange={(e) => set('economicEvents', e.target.value)} placeholder="e.g. 8:30am CPI, 2:00pm FOMC minutes" />
        </div>

        <div className="field">
          <label>Targets</label>
          <textarea value={form.targets} onChange={(e) => set('targets', e.target.value)} placeholder="Key levels you're watching today" />
        </div>

        <div className="field">
          <label>Game Plan</label>
          <textarea value={form.gamePlan} onChange={(e) => set('gamePlan', e.target.value)} style={{ minHeight: 120 }} placeholder="How you plan to execute today" />
        </div>

        <div className="field">
          <label>Additional Notes</label>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        <ImageUpload label="Daily Chart Screenshot" value={form.dailyChart} onChange={(v) => set('dailyChart', v)} />
        <ImageUpload label="Intraday Chart Screenshot" value={form.intradayChart} onChange={(v) => set('intradayChart', v)} />
      </div>
    </SidePanel>
  );
}
