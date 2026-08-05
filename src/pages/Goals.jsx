import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import GoalFormPanel from './panels/GoalFormPanel';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDate } from '../lib/utils';
import { Plus, Pencil, Trash2, Target, CheckCircle2 } from 'lucide-react';

const PERIODS = ['All', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual'];
const STATUSES = ['Active', 'Completed'];

function goalProgress(goal) {
  if (goal.subItems && goal.subItems.length) {
    const done = goal.subItems.filter((i) => i.done).length;
    return Math.round((done / goal.subItems.length) * 100);
  }
  return goal.completed ? 100 : 0;
}

export default function Goals() {
  const { goals } = useData();
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [periodFilter, setPeriodFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [confirmId, setConfirmId] = useState(null);

  const filtered = useMemo(() => {
    return goals.items
      .filter((g) => (periodFilter === 'All' ? true : g.period === periodFilter))
      .filter((g) => (statusFilter === 'Active' ? !g.completed : g.completed))
      .sort((a, b) => (a.targetDate || '').localeCompare(b.targetDate || ''));
  }, [goals.items, periodFilter, statusFilter]);

  function openNew() {
    setEditing(null);
    setPanelOpen(true);
  }
  function openEdit(g) {
    setEditing(g);
    setPanelOpen(true);
  }
  function handleSave(form) {
    if (editing) goals.update(editing.id, form);
    else goals.add(form);
    setPanelOpen(false);
  }
  function toggleComplete(g) {
    goals.update(g.id, { completed: !g.completed });
  }
  function toggleSubItem(g, itemId) {
    goals.update(g.id, {
      subItems: g.subItems.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it)),
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>Set targets and track your progress toward them</p>
        </div>
        <button className="btn btn-accent" onClick={openNew}>
          <Plus size={16} /> New Goal
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              className="btn btn-sm"
              onClick={() => setPeriodFilter(p)}
              style={{
                background: periodFilter === p ? 'var(--red)' : 'transparent',
                color: periodFilter === p ? '#fff' : 'var(--text-muted)',
                border: periodFilter === p ? '1px solid var(--red)' : '1px solid var(--border)',
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {STATUSES.map((s) => (
            <button
              key={s}
              className="btn btn-sm"
              onClick={() => setStatusFilter(s)}
              style={{
                background: statusFilter === s ? 'var(--white)' : 'transparent',
                color: statusFilter === s ? '#0a0a0c' : 'var(--text-muted)',
                border: statusFilter === s ? '1px solid var(--white)' : '1px solid var(--border)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Target size={26} style={{ marginBottom: 10, color: 'var(--text-faint)' }} />
          <h3>No {statusFilter.toLowerCase()} goals here</h3>
          <p>Set a new goal to start tracking progress.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {filtered.map((g) => {
            const progress = goalProgress(g);
            return (
              <div key={g.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <span className="tag tag-neutral">{g.period}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Due {formatDate(g.targetDate)}</span>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 600 }}>{g.title || 'Untitled goal'}</h3>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(g)} aria-label="Edit goal">
                      <Pencil size={13} />
                    </button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setConfirmId(g.id)} aria-label="Delete goal">
                      <Trash2 size={13} color="var(--loss)" />
                    </button>
                  </div>
                </div>

                {g.description && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{g.description}</p>}

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                    <span>Progress</span>
                    <span className="mono">{progress}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: progress >= 100 ? 'var(--win)' : 'var(--red)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>

                {g.subItems && g.subItems.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {g.subItems.map((it) => (
                      <label key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                        <input type="checkbox" checked={it.done} onChange={() => toggleSubItem(g, it.id)} style={{ accentColor: 'var(--red)' }} />
                        <span style={{ textDecoration: it.done ? 'line-through' : 'none', color: it.done ? 'var(--text-faint)' : 'var(--text)' }}>{it.text}</span>
                      </label>
                    ))}
                  </div>
                )}

                {g.successMetrics && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 3 }}>
                      Success Metrics
                    </div>
                    <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{g.successMetrics}</p>
                  </div>
                )}

                <button
                  className="btn btn-sm"
                  onClick={() => toggleComplete(g)}
                  style={{
                    marginTop: 4,
                    background: g.completed ? 'rgba(47,214,110,0.12)' : 'transparent',
                    color: g.completed ? 'var(--win)' : 'var(--text-muted)',
                    border: `1px solid ${g.completed ? 'rgba(47,214,110,0.3)' : 'var(--border)'}`,
                  }}
                >
                  <CheckCircle2 size={14} /> {g.completed ? 'Completed' : 'Mark as Complete'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <GoalFormPanel open={panelOpen} onClose={() => setPanelOpen(false)} onSave={handleSave} initial={editing} />
      <ConfirmDialog
        open={!!confirmId}
        title="Delete goal?"
        message="This will permanently remove this goal and its progress."
        onCancel={() => setConfirmId(null)}
        onConfirm={() => {
          goals.remove(confirmId);
          setConfirmId(null);
        }}
      />
    </div>
  );
}
