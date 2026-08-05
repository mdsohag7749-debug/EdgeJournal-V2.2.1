import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import StudyFormPanel from './panels/StudyFormPanel';
import Lightbox from '../components/Lightbox';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDate } from '../lib/utils';
import { Plus, Pencil, Trash2, GraduationCap } from 'lucide-react';

const FILTERS = ['All', 'Daily', 'Weekly', 'Monthly', 'Asia', 'London', 'NYAM', 'NY Lunch', 'NYPM'];

export default function Study() {
  const { study } = useData();
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('All');
  const [lightbox, setLightbox] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const filtered = useMemo(() => {
    const list = filter === 'All' ? study.items : study.items.filter((s) => s.sessionType === filter);
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [study.items, filter]);

  function openNew() {
    setEditing(null);
    setPanelOpen(true);
  }
  function openEdit(s) {
    setEditing(s);
    setPanelOpen(true);
  }
  function handleSave(form) {
    if (editing) study.update(editing.id, form);
    else study.add(form);
    setPanelOpen(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>Chart study and session breakdowns</p>
        </div>
        <button className="btn btn-accent" onClick={openNew}>
          <Plus size={16} /> New Entry
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            className="btn btn-sm"
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? 'var(--red)' : 'transparent',
              color: filter === f ? '#fff' : 'var(--text-muted)',
              border: filter === f ? '1px solid var(--red)' : '1px solid var(--border)',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <GraduationCap size={26} style={{ marginBottom: 10, color: 'var(--text-faint)' }} />
          <h3>No study entries yet</h3>
          <p>Document your chart study and session observations here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {filtered.map((s) => (
            <div key={s.id} className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {s.chart && (
                <img
                  src={s.chart}
                  alt={s.title}
                  onClick={() => setLightbox(s.chart)}
                  style={{ width: '100%', height: 150, objectFit: 'cover', cursor: 'zoom-in', borderBottom: '1px solid var(--border)' }}
                />
              )}
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <span className="tag tag-red">{s.sessionType}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{formatDate(s.date)}</span>
                    </div>
                    <h3 style={{ fontSize: 14.5, fontWeight: 600 }}>{s.title || 'Untitled entry'}</h3>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(s)} aria-label="Edit entry">
                      <Pencil size={13} />
                    </button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setConfirmId(s.id)} aria-label="Delete entry">
                      <Trash2 size={13} color="var(--loss)" />
                    </button>
                  </div>
                </div>
                {s.description && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {s.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <StudyFormPanel open={panelOpen} onClose={() => setPanelOpen(false)} onSave={handleSave} initial={editing} />
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
      <ConfirmDialog
        open={!!confirmId}
        title="Delete study entry?"
        message="This will permanently remove this entry and its screenshot."
        onCancel={() => setConfirmId(null)}
        onConfirm={() => {
          study.remove(confirmId);
          setConfirmId(null);
        }}
      />
    </div>
  );
}
