import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import SidePanel from '../../components/SidePanel';
import { todayISO, uid } from '../../lib/utils';

const PERIODS = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual'];

const BLANK = {
  title: '',
  period: 'Weekly',
  targetDate: todayISO(),
  description: '',
  successMetrics: '',
  subItems: [],
  completed: false,
};

export default function GoalFormPanel({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(BLANK);
  const [newItem, setNewItem] = useState('');

  useEffect(() => {
    if (open) setForm(initial ? { ...BLANK, ...initial, subItems: initial.subItems || [] } : BLANK);
    setNewItem('');
  }, [open, initial]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addItem() {
    const text = newItem.trim();
    if (!text) return;
    set('subItems', [...form.subItems, { id: uid(), text, done: false }]);
    setNewItem('');
  }

  function toggleItem(id) {
    set('subItems', form.subItems.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  }

  function removeItem(id) {
    set('subItems', form.subItems.filter((it) => it.id !== id));
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Goal' : 'New Goal'}
      subtitle="Set a target and break it into trackable steps"
      width="narrow"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-accent" onClick={() => onSave(form)}>
            {initial ? 'Save Changes' : 'Save Goal'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field">
          <label>Title</label>
          <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Improve trade win rate to 60%" />
        </div>

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
            <label>Target Date</label>
            <input type="date" value={form.targetDate} onChange={(e) => set('targetDate', e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Description</label>
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>

        <div className="field">
          <label>Success Metrics</label>
          <textarea value={form.successMetrics} onChange={(e) => set('successMetrics', e.target.value)} placeholder="How will you know you've hit this goal?" />
        </div>

        <div className="field">
          <label>Sub-Checklist Items</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {form.subItems.map((it) => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={it.done} onChange={() => toggleItem(it.id)} style={{ accentColor: 'var(--red)' }} />
                <span style={{ flex: 1, fontSize: 13.5, textDecoration: it.done ? 'line-through' : 'none', color: it.done ? 'var(--text-faint)' : 'var(--text)' }}>
                  {it.text}
                </span>
                <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => removeItem(it.id)} aria-label="Remove item">
                  <X size={13} />
                </button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())}
                placeholder="Add a step..."
                style={{ flex: 1 }}
              />
              <button type="button" className="btn btn-ghost btn-icon" onClick={addItem} aria-label="Add item">
                <Plus size={15} />
              </button>
            </div>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, cursor: 'pointer', marginTop: 4 }}>
          <input type="checkbox" checked={form.completed} onChange={(e) => set('completed', e.target.checked)} style={{ accentColor: 'var(--red)' }} />
          Mark goal as completed
        </label>
      </div>
    </SidePanel>
  );
}
