import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, X } from 'lucide-react';
import SidePanel from './SidePanel';
import TagChip from './TagChip';
import { TAG_PALETTE } from '../lib/tags';
import { useData } from '../context/DataContext';

// Full tag library manager: create, rename, delete, and re-color tags.
// Renames/deletes propagate to every trade carrying the tag via the
// handlers supplied by DataContext.
export default function TagManager({ open, onClose }) {
  const { tagLibrary, createTag, renameTag, deleteTag, setTagColor, trades } = useData();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const tradeCountForTag = (name) =>
    trades.items.reduce((n, t) => (Array.isArray(t.tags) && t.tags.includes(name) ? n + 1 : n), 0);

  useEffect(() => {
    if (open) {
      setNewName('');
      setEditingId(null);
      setEditName('');
    }
  }, [open]);

  function handleCreate() {
    const created = createTag(newName);
    if (created) setNewName('');
  }

  function startEdit(tag) {
    setEditingId(tag.id);
    setEditName(tag.name);
  }

  function commitEdit() {
    if (editingId) renameTag(editingId, editName);
    setEditingId(null);
    setEditName('');
  }

  function confirmDelete(tag) {
    if (window.confirm(`Delete the tag "${tag.name}"? It will be removed from every trade that uses it.`)) {
      deleteTag(tag.id);
    }
  }

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="Manage Tags"
      subtitle="Create, rename, delete, and color your trade tags."
      width="narrow"
      footer={
        <button className="btn btn-accent" onClick={onClose}>
          Done
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Create */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            New Tag
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. Reversal"
              style={{
                flex: 1,
                background: 'var(--bg-elevated)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
                padding: '9px 12px',
                fontSize: 13.5,
              }}
            />
            <button className="btn btn-ghost btn-sm" onClick={handleCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={13} /> Create
            </button>
          </div>
        </div>

        {/* Library */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Your Tags · {tagLibrary.length}
          </span>
          {tagLibrary.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>No tags yet. Create your first tag above.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tagLibrary.map((tag) => (
              <div
                key={tag.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 10,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TagChip name={tag.name} color={tag.color} title={tag.name} />
                  <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-faint)' }}>
                    {tradeCountForTag(tag.name)} trade{tradeCountForTag(tag.name) === 1 ? '' : 's'}
                  </span>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => startEdit(tag)} aria-label={`Rename ${tag.name}`} title="Rename">
                    <Pencil size={13} />
                  </button>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => confirmDelete(tag)} aria-label={`Delete ${tag.name}`} title="Delete">
                    <X size={13} />
                  </button>
                </div>

                {editingId === tag.id && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                      autoFocus
                      style={{
                        flex: 1,
                        background: 'var(--bg)',
                        border: '1.5px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text)',
                        padding: '7px 10px',
                        fontSize: 13,
                      }}
                    />
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={commitEdit} aria-label="Confirm rename">
                      <Check size={14} />
                    </button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditingId(null)} aria-label="Cancel rename">
                      <X size={14} />
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)', marginRight: 2 }}>Color:</span>
                  {TAG_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTagColor(tag.id, c)}
                      aria-label={`Set color ${c}`}
                      title={c}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: c,
                        border: tag.color === c ? '2px solid var(--text)' : '2px solid transparent',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SidePanel>
  );
}