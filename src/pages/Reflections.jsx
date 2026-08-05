import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import ReflectionFormPanel from './panels/ReflectionFormPanel';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDate } from '../lib/utils';
import { Plus, Pencil, Trash2, MessageSquareText, Star } from 'lucide-react';

const PERIODS = ['Daily', 'Weekly', 'Monthly', 'Quarterly'];

export default function Reflections() {
  const { reflections } = useData();
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('All');
  const [confirmId, setConfirmId] = useState(null);

  const counts = useMemo(() => {
    const map = { Daily: 0, Weekly: 0, Monthly: 0, Quarterly: 0 };
    reflections.items.forEach((r) => {
      if (map[r.period] !== undefined) map[r.period] += 1;
    });
    return map;
  }, [reflections.items]);

  const filtered = useMemo(() => {
    const list = filter === 'All' ? reflections.items : reflections.items.filter((r) => r.period === filter);
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [reflections.items, filter]);

  function openNew() {
    setEditing(null);
    setPanelOpen(true);
  }
  function openEdit(r) {
    setEditing(r);
    setPanelOpen(true);
  }
  function handleSave(form) {
    if (editing) reflections.update(editing.id, form);
    else reflections.add(form);
    setPanelOpen(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>Step back and review your process</p>
        </div>
        <button className="btn btn-accent" onClick={openNew}>
          <Plus size={16} /> New Reflection
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {PERIODS.map((p) => (
          <div key={p} className="card" style={{ padding: '16px 18px' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{p}</span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, marginTop: 6 }}>{counts[p]}</div>
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>entries</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['All', ...PERIODS].map((p) => (
          <button key={p} className="btn btn-sm" onClick={() => setFilter(p)} style={{
            background: filter === p ? 'var(--red)' : 'transparent',
            color: filter === p ? '#fff' : 'var(--text-muted)',
            border: filter === p ? '1px solid var(--red)' : '1px solid var(--border)',
          }}>
            {p}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <MessageSquareText size={26} style={{ marginBottom: 10, color: 'var(--text-faint)' }} />
          <h3>No reflections here yet</h3>
          <p>Add a reflection to track how your process is evolving.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {filtered.map((r) => (
            <div key={r.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="tag tag-neutral">{r.period}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>{formatDate(r.date)}</span>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 600 }}>{r.title || 'Untitled reflection'}</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(r)} aria-label="Edit reflection">
                    <Pencil size={14} />
                  </button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setConfirmId(r.id)} aria-label="Delete reflection">
                    <Trash2 size={14} color="var(--loss)" />
                  </button>
                </div>
              </div>
              {r.rating && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--text-muted)' }}>
                  <Star size={12} fill="var(--red)" color="var(--red)" /> {r.rating}/10
                </span>
              )}
              {r.reflection && <p style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>{r.reflection}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <MiniField label="What Went Well" value={r.wentWell} />
                <MiniField label="Lessons Learned" value={r.lessons} />
                <MiniField label="Areas for Improvement" value={r.improvements} />
              </div>
            </div>
          ))}
        </div>
      )}

      <ReflectionFormPanel open={panelOpen} onClose={() => setPanelOpen(false)} onSave={handleSave} initial={editing} />
      <ConfirmDialog
        open={!!confirmId}
        title="Delete reflection?"
        message="This will permanently remove this reflection entry."
        onCancel={() => setConfirmId(null)}
        onConfirm={() => {
          reflections.remove(confirmId);
          setConfirmId(null);
        }}
      />
    </div>
  );
}

function MiniField({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 2 }}>
        {label}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{value}</p>
    </div>
  );
}
