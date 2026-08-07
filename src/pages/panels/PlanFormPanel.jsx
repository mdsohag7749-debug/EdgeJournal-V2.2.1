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
            <label htmlFor="plan-date">Date</label>
            <input id="plan-date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="plan-bias">Bias</label>
            <select id="plan-bias" value={form.bias} onChange={(e) => set('bias', e.target.value)}>
              <option>Bullish</option>
              <option>Bearish</option>
              <option>Neutral</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="plan-events">Economic Calendar Events</label>
          <textarea id="plan-events" value={form.economicEvents} onChange={(e) => set('economicEvents', e.target.value)} placeholder="e.g. 8:30am CPI, 2:00pm FOMC minutes" />
        </div>

        <div className="field">
          <label htmlFor="plan-targets">Targets</label>
          <textarea id="plan-targets" value={form.targets} onChange={(e) => set('targets', e.target.value)} placeholder="Key levels you're watching today" />
        </div>

        <div className="field">
          <label htmlFor="plan-game-plan">Game Plan</label>
          <textarea id="plan-game-plan" value={form.gamePlan} onChange={(e) => set('gamePlan', e.target.value)} style={{ minHeight: 120 }} placeholder="How you plan to execute today" />
        </div>

        <div className="field">
          <label htmlFor="plan-notes">Additional Notes</label>
          <textarea id="plan-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        <ImageUpload label="Daily Chart Screenshot" value={form.dailyChart} onChange={(v) => set('dailyChart', v)} />
        <ImageUpload label="Intraday Chart Screenshot" value={form.intradayChart} onChange={(v) => set('intradayChart', v)} />
      </div>
    </SidePanel>
  );
}
