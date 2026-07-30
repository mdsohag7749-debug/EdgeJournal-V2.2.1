import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import SidePanel from '../../components/SidePanel';
import ImageUpload from '../../components/ImageUpload';
import { TradeScreenshotManager } from '../../components/TradeScreenshots';
import { useData } from '../../context/DataContext';
import { todayISO } from '../../lib/utils';

const INSTRUMENTS = ['MNQ', 'MES', 'MYM', 'MGC', 'NQ', 'ES', 'YM', 'GC'];
const PROTOCOLS = ['LRLRC', 'HRLRC'];
const RESULTS = ['Win', 'Loss', 'BE'];

const BLANK = {
  date: todayISO(),
  entryTime: '',
  exitTime: '',
  instrument: 'NQ',
  model: '',
  protocol: 'LRLRC',
  entryPrice: '',
  exitPrice: '',
  contracts: '',
  netPnl: '',
  commission: '',
  result: 'Win',
  planId: '',
  rating: 5,
  riskChecklist: {},
  tradeChecklist: {},
  confluences: '',
  tradeManagement: '',
  notes: '',
  screenshot: '',
};

function ChecklistBlock({ title, criteria, values, onChange }) {
  const [open, setOpen] = useState(false);
  const checkedCount = criteria.filter((c) => values[c]).length;

  return (
    <div className="card" style={{ padding: 0, background: 'var(--card)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text)',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}>
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          {title}
        </span>
        <span
          className="tag"
          style={{ background: checkedCount === criteria.length && criteria.length > 0 ? 'rgba(47,214,110,0.12)' : 'rgba(255,255,255,0.06)', color: checkedCount === criteria.length && criteria.length > 0 ? 'var(--win)' : 'var(--text-muted)', borderColor: 'transparent' }}
        >
          {checkedCount}/{criteria.length}
        </span>
      </button>
      {open && (
        <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {criteria.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>No criteria defined yet. Add some in the System tab.</p>}
          {criteria.map((c) => (
            <label key={c} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!values[c]}
                onChange={(e) => onChange({ ...values, [c]: e.target.checked })}
                style={{ marginTop: 2, accentColor: 'var(--red)' }}
              />
              <span>{c}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TradeFormPanel({ open, onClose, onSave, initial }) {
  const { models, riskCriteria, checklistCriteria, plans } = useData();
  const [form, setForm] = useState(BLANK);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? { ...BLANK, ...initial, riskChecklist: initial.riskChecklist || {}, tradeChecklist: initial.tradeChecklist || {} }
          : { ...BLANK, model: models[0] || '' }
      );
    }
  }, [open, initial, models]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    onSave(form);
  }

  const sortedPlans = [...plans.items].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Trade' : 'Log Trade'}
      subtitle="Record entry, execution and review details for this trade"
      width="wide"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-accent" onClick={handleSave}>
            {initial ? 'Save Changes' : 'Save Trade'}
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 28 }}>
        {/* Left column: trade mechanics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field-row cols-3">
            <div className="field">
              <label>Date</label>
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
            </div>
            <div className="field">
              <label>Entry Time</label>
              <input type="time" value={form.entryTime} onChange={(e) => set('entryTime', e.target.value)} />
            </div>
            <div className="field">
              <label>Exit Time</label>
              <input type="time" value={form.exitTime} onChange={(e) => set('exitTime', e.target.value)} />
            </div>
          </div>

          <div className="field-row cols-3">
            <div className="field">
              <label>Instrument</label>
              <select value={form.instrument} onChange={(e) => set('instrument', e.target.value)}>
                {INSTRUMENTS.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Model</label>
              <select value={form.model} onChange={(e) => set('model', e.target.value)}>
                <option value="">Select model</option>
                {models.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Protocol</label>
              <select value={form.protocol} onChange={(e) => set('protocol', e.target.value)}>
                {PROTOCOLS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-row cols-3">
            <div className="field">
              <label>Entry Price</label>
              <input type="number" step="any" value={form.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} />
            </div>
            <div className="field">
              <label>Exit Price</label>
              <input type="number" step="any" value={form.exitPrice} onChange={(e) => set('exitPrice', e.target.value)} />
            </div>
            <div className="field">
              <label>Contracts</label>
              <input type="number" step="1" value={form.contracts} onChange={(e) => set('contracts', e.target.value)} />
            </div>
          </div>

          <div className="field-row cols-3">
            <div className="field">
              <label>Net P&L ($)</label>
              <input type="number" step="any" value={form.netPnl} onChange={(e) => set('netPnl', e.target.value)} />
            </div>
            <div className="field">
              <label>Commission ($)</label>
              <input type="number" step="any" value={form.commission} onChange={(e) => set('commission', e.target.value)} />
            </div>
            <div className="field">
              <label>Result</label>
              <select value={form.result} onChange={(e) => set('result', e.target.value)}>
                {RESULTS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-row cols-2">
            <div className="field">
              <label>Link Pre-Market Plan</label>
              <select value={form.planId} onChange={(e) => set('planId', e.target.value)}>
                <option value="">None</option>
                {sortedPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.date} · {p.bias}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Performance Rating: {form.rating}/10</label>
              <input
                type="range"
                min="1"
                max="10"
                value={form.rating}
                onChange={(e) => set('rating', Number(e.target.value))}
                style={{ accentColor: 'var(--red)', marginTop: 10 }}
              />
            </div>
          </div>

          <ChecklistBlock title="Risk Management Checklist" criteria={riskCriteria} values={form.riskChecklist} onChange={(v) => set('riskChecklist', v)} />
          <ChecklistBlock title="Trade Checklist" criteria={checklistCriteria} values={form.tradeChecklist} onChange={(v) => set('tradeChecklist', v)} />
        </div>

        {/* Right column: narrative + screenshot */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label>Confluences</label>
            <textarea value={form.confluences} onChange={(e) => set('confluences', e.target.value)} placeholder="What lined up to take this trade?" />
          </div>
          <div className="field">
            <label>Trade Management</label>
            <textarea value={form.tradeManagement} onChange={(e) => set('tradeManagement', e.target.value)} placeholder="How did you manage the trade after entry?" />
          </div>
          <div className="field">
            <label>Trade Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} style={{ minHeight: 120 }} />
          </div>
          <ImageUpload label="Execution Screenshot" value={form.screenshot} onChange={(v) => set('screenshot', v)} />
          <TradeScreenshotManager tradeId={initial?.id} />
        </div>
      </div>
    </SidePanel>
  );
}
